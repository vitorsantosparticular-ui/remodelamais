import {
  FURNITURE_BY_ID, footprint, findPath, directionFromDelta, WALK_TICK_MS,
  type RoomInfo, type RoomItemState, type RoomUserState, type Tile,
} from '@bairro/shared';

interface TileInfo { walk: boolean; sit: boolean; z: number; sitDir: number }

export interface RoomUser extends RoomUserState {
  socketId: string;
  path: Tile[];
  goal: Tile | null;
}

export interface RoomCallbacks {
  /** Mudanças de posição a difundir aos clientes do quarto. */
  broadcastMoves(roomId: string, moves: Array<Pick<RoomUserState, 'id' | 'x' | 'y' | 'z' | 'dir' | 'status'>>): void;
  /** O jogador parou: guardar posição na base de dados. */
  persistPosition(userId: string, roomId: string, x: number, y: number): void;
}

/**
 * Um quarto carregado em memória. É a ÚNICA fonte de verdade sobre onde está cada jogador:
 * o cliente só pede "quero ir para (x,y)" e o servidor calcula e avança o caminho, passo a passo.
 */
export class RoomInstance {
  readonly users = new Map<string, RoomUser>();
  private tiles: TileInfo[] = [];
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(public info: RoomInfo, public items: RoomItemState[], private cb: RoomCallbacks) {
    this.rebuildTiles();
  }

  get id() { return this.info.id; }
  get channel() { return `room:${this.info.id}`; }

  /** Recalcula a grelha de mosaicos a partir da mobília (chamar depois de mudar mobília). */
  rebuildTiles() {
    const { width, height } = this.info;
    this.tiles = Array.from({ length: width * height }, () => ({ walk: true, sit: false, z: 0, sitDir: 2 }));
    const sorted = [...this.items].sort((a, b) => a.z - b.z);
    for (const it of sorted) {
      const def = FURNITURE_BY_ID.get(it.defId);
      if (!def) continue;
      const { w, l } = footprint(def, it.rotation);
      for (let x = it.x; x < it.x + w; x++) for (let y = it.y; y < it.y + l; y++) {
        const t = this.tile(x, y);
        if (!t) continue;
        const top = it.z + def.stackHeight;
        if (def.canWalk) { t.z = Math.max(t.z, top); }
        else if (def.canSit) { t.walk = true; t.sit = true; t.z = top; t.sitDir = it.rotation; }
        else { t.walk = false; t.sit = false; }
      }
    }
    const door = this.tile(this.info.doorX, this.info.doorY);
    if (door) door.walk = true;
  }

  tile(x: number, y: number): TileInfo | undefined {
    if (x < 0 || y < 0 || x >= this.info.width || y >= this.info.height) return undefined;
    return this.tiles[y * this.info.width + x];
  }

  private occupiedBy(x: number, y: number, except?: string) {
    for (const u of this.users.values()) if (u.id !== except && u.x === x && u.y === y) return u;
    return undefined;
  }

  isFree(x: number, y: number, except?: string) {
    const t = this.tile(x, y);
    return !!t && t.walk && !this.occupiedBy(x, y, except);
  }

  /** Mosaico livre mais próximo de (x,y) — usado para pôr o jogador à porta. */
  nearestFree(x: number, y: number): Tile | null {
    for (let r = 0; r < Math.max(this.info.width, this.info.height); r++) {
      for (let dx = -r; dx <= r; dx++) for (let dy = -r; dy <= r; dy++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        if (this.isFree(x + dx, y + dy)) return { x: x + dx, y: y + dy };
      }
    }
    return null;
  }

  add(user: Omit<RoomUser, 'x' | 'y' | 'z' | 'dir' | 'status' | 'path' | 'goal'>, spawn: Tile | null): RoomUser {
    let pos = spawn && this.isFree(spawn.x, spawn.y) ? spawn : null;
    pos ??= this.nearestFree(this.info.doorX, this.info.doorY) ?? { x: this.info.doorX, y: this.info.doorY };
    const t = this.tile(pos.x, pos.y)!;
    const u: RoomUser = {
      ...user, x: pos.x, y: pos.y, z: t.z, dir: t.sit ? t.sitDir : 2,
      status: t.sit ? { sit: t.z } : {}, path: [], goal: null,
    };
    this.users.set(u.id, u);
    return u;
  }

  remove(userId: string) {
    const u = this.users.get(userId);
    this.users.delete(userId);
    return u;
  }

  /** Pedido de movimento do cliente. Devolve false se for impossível (o cliente não decide nada). */
  requestMove(userId: string, x: number, y: number): boolean {
    const u = this.users.get(userId);
    if (!u || !Number.isInteger(x) || !Number.isInteger(y)) return false;
    if (!this.isFree(x, y, userId)) return false;
    const path = this.pathFor(u, { x, y });
    if (!path) return false;
    u.path = path; u.goal = { x, y };
    if (path.length) this.ensureTicking();
    return true;
  }

  private pathFor(u: RoomUser, to: Tile) {
    return findPath({ x: u.x, y: u.y }, to, this.info.width, this.info.height, (x, y) => this.isFree(x, y, u.id));
  }

  private ensureTicking() {
    if (!this.timer) this.timer = setInterval(() => this.tick(), WALK_TICK_MS);
  }

  /** Avança um mosaico por jogador em movimento e difunde as novas posições. */
  tick() {
    const moves: Array<Pick<RoomUserState, 'id' | 'x' | 'y' | 'z' | 'dir' | 'status'>> = [];
    for (const u of this.users.values()) {
      if (!u.path.length) continue;
      let next = u.path[0];
      if (!this.isFree(next.x, next.y, u.id)) {
        // Alguém se meteu no caminho: recalcular até ao destino.
        const again = u.goal ? this.pathFor(u, u.goal) : null;
        if (!again || !again.length) { u.path = []; u.goal = null; this.cb.persistPosition(u.id, this.id, u.x, u.y); continue; }
        u.path = again; next = again[0];
      }
      u.path.shift();
      u.dir = directionFromDelta(next.x - u.x, next.y - u.y);
      u.x = next.x; u.y = next.y;
      const t = this.tile(u.x, u.y)!;
      u.z = t.z;
      u.status = {};
      if (!u.path.length) {
        u.goal = null;
        if (t.sit) { u.status = { sit: t.z }; u.dir = t.sitDir; }
        this.cb.persistPosition(u.id, this.id, u.x, u.y);
      }
      moves.push({ id: u.id, x: u.x, y: u.y, z: u.z, dir: u.dir, status: u.status });
    }
    if (moves.length) this.cb.broadcastMoves(this.id, moves);
    if (![...this.users.values()].some(u => u.path.length) && this.timer) { clearInterval(this.timer); this.timer = null; }
  }

  publicUser(u: RoomUser): RoomUserState {
    return { id: u.id, username: u.username, figure: u.figure, motto: u.motto, x: u.x, y: u.y, z: u.z, dir: u.dir, status: u.status };
  }

  dispose() { if (this.timer) clearInterval(this.timer); this.timer = null; }
}
