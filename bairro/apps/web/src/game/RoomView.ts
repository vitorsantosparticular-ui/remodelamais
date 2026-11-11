/**
 * Motor de quarto isométrico no cliente (PixiJS v8).
 * Só DESENHA o que o servidor diz: as posições chegam por eventos e são interpoladas.
 * O clique num mosaico gera apenas um pedido ("quero ir para x,y").
 */
import { Application, Container, Graphics, Sprite, Text, Texture, Rectangle, TextureStyle, type FederatedPointerEvent } from 'pixi.js';
import {
  tileToScreen, screenToTile, FURNITURE_BY_ID, footprint, WALK_TICK_MS,
  type RoomSnapshot, type RoomUserState, type RoomItemState, type Figure, type ChatMessageDTO,
} from '@bairro/shared';
import { renderAvatarSheet, viewForDir, AV_W, AV_H, FRAMES, type FrameName } from './avatar';
import { drawItem } from './furniture';
import { poly, pt, line, darken, hash } from './draw';

TextureStyle.defaultOptions.scaleMode = 'nearest';

interface AvatarNode {
  state: RoomUserState;
  root: Container;
  sprite: Sprite;
  shadow: Graphics;
  label: Text;
  frames: Record<FrameName, Texture>;
  from: { x: number; y: number; z: number };
  to: { x: number; y: number; z: number };
  t0: number;
  walkTime: number;
}

interface Bubble { node: Container; y: number; born: number }

const FLOOR: Record<string, { a: number; b: number; gap: number }> = {
  calcada: { a: 0xeee7d4, b: 0xe4dcc6, gap: 0xcdbf9f },
  madeira: { a: 0xc08a55, b: 0xb07a45, gap: 0x8a5a30 },
  azulejo: { a: 0xf4f6f8, b: 0x2f6fb6, gap: 0xc9d3dd },
  alcatifa: { a: 0x9c2f3a, b: 0x8f2a35, gap: 0x7a2330 },
  relva: { a: 0x74b04c, b: 0x6aa646, gap: 0x5f9a3c },
  areia: { a: 0xf0dca6, b: 0xe8d29a, gap: 0xd8c288 },
};
const WALL: Record<string, number> = { branca: 0xf1eee6, amarela: 0xf0cf6e, azulejo: 0xeef3fa, rosa: 0xe9a3a0 };
const WALL_H = 116;

export interface RoomViewCallbacks {
  onTileClick(x: number, y: number): void;
  onAvatarClick(userId: string): void;
}

export class RoomView {
  readonly app = new Application();
  private world = new Container({ sortableChildren: true });
  private overlay = new Container();
  private hover = new Graphics();
  private avatars = new Map<string, AvatarNode>();
  private itemNodes: Graphics[] = [];
  private bubbles: Bubble[] = [];
  private sheetCache = new Map<string, Record<FrameName, Texture>>();
  private snap: RoomSnapshot | null = null;
  private zoom = 1;
  private drag: { x: number; y: number; moved: boolean; ox: number; oy: number } | null = null;
  private pan = { x: 0, y: 0 };

  constructor(private cb: RoomViewCallbacks) {}

  async mount(el: HTMLElement) {
    await this.app.init({ resizeTo: el, background: '#0e1b2a', antialias: false, resolution: Math.min(window.devicePixelRatio || 1, 2), autoDensity: true });
    el.appendChild(this.app.canvas);
    this.app.stage.addChild(this.world, this.overlay);
    this.app.stage.eventMode = 'static';
    this.app.stage.hitArea = this.app.screen;
    this.app.stage.on('pointerdown', e => this.pointerDown(e));
    this.app.stage.on('pointermove', e => this.pointerMove(e));
    this.app.stage.on('pointerup', e => this.pointerUp(e));
    this.app.stage.on('pointerupoutside', () => { this.drag = null; });
    this.app.ticker.add(() => this.frame());
    this.app.renderer.on('resize', () => this.layout());
    this.zoom = Math.min(el.clientWidth, el.clientHeight) >= 900 ? 2 : 1;
  }

  destroy() { this.app.destroy(true, { children: true }); }

  setZoom(z: number) { this.zoom = z; this.layout(); }
  getZoom() { return this.zoom; }

  // ------------------------------------------------------------------ quarto
  load(snap: RoomSnapshot) {
    this.snap = snap;
    this.world.removeChildren().forEach(c => { if (c !== this.hover) c.destroy({ children: true }); });
    this.hover.clear();
    this.avatars.clear(); this.itemNodes = [];
    this.bubbles.forEach(b => b.node.destroy({ children: true })); this.bubbles = [];
    this.pan = { x: 0, y: 0 };
    const floor = new Graphics(); floor.zIndex = -1e7;
    this.drawFloor(floor);
    this.world.addChild(floor);
    this.hover.zIndex = -1e6; this.world.addChild(this.hover);
    for (const it of snap.items) this.addItem(it);
    for (const u of snap.users) this.addUser(u);
    this.centerOnSelf();
    this.layout();
  }

  /** Em ecrãs pequenos (quarto maior que o ecrã), começa centrado no próprio avatar. */
  private centerOnSelf() {
    const me = this.snap && this.avatars.get(this.snap.you);
    if (!me || !this.snap) return;
    const { width: W, height: H } = this.snap.room;
    const roomW = (W + H) * 32 * this.zoom;
    if (roomW <= this.app.screen.width * 0.95) return;
    const mid = tileToScreen(W / 2, H / 2), s = tileToScreen(me.state.x + 0.5, me.state.y + 0.5);
    this.pan = { x: -(s.x - mid.x) * this.zoom, y: -(s.y - mid.y) * this.zoom * 0.6 };
  }

  private drawFloor(g: Graphics) {
    const { room } = this.snap!;
    const W = room.width, H = room.height;
    const f = FLOOR[room.floor] ?? FLOOR.madeira;
    // espessura do chão (frente)
    poly(g, [pt(0, H), pt(W, H), pt(W, H, -10), pt(0, H, -10)], darken(f.gap, 0.8));
    poly(g, [pt(W, H), pt(W, 0), pt(W, 0, -10), pt(W, H, -10)], darken(f.gap, 0.62));
    for (let x = 0; x < W; x++) for (let y = 0; y < H; y++) {
      poly(g, [pt(x, y), pt(x + 1, y), pt(x + 1, y + 1), pt(x, y + 1)], f.gap);
      if (room.floor === 'calcada') {
        for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) {
          const u0 = x + a / 3 + 0.025, v0 = y + b / 3 + 0.025, u1 = u0 + 1 / 3 - 0.05, v1 = v0 + 1 / 3 - 0.05;
          const onda = (((v0 + 1.4 * Math.sin(u0 * 0.75)) % 4) + 4) % 4 < 1;
          const c = onda ? 0x34343a : [0xeee7d4, 0xe4dcc6, 0xf3eddc][Math.floor(hash(x * 3 + a, y * 3 + b) * 3)];
          poly(g, [pt(u0, v0), pt(u1, v0), pt(u1, v1), pt(u0, v1)], c);
        }
      } else if (room.floor === 'madeira') {
        for (let k = 0; k < 4; k++) {
          const v0 = y + k / 4 + 0.02, v1 = v0 + 0.25 - 0.04;
          poly(g, [pt(x + 0.01, v0), pt(x + 0.99, v0), pt(x + 0.99, v1), pt(x + 0.01, v1)], hash(x, y, k) > 0.5 ? f.a : f.b);
        }
      } else if (room.floor === 'azulejo') {
        poly(g, [pt(x + 0.03, y + 0.03), pt(x + 0.97, y + 0.03), pt(x + 0.97, y + 0.97), pt(x + 0.03, y + 0.97)], (x + y) % 2 ? f.a : 0xdfe7ef);
        poly(g, [pt(x + 0.5, y + 0.2), pt(x + 0.8, y + 0.5), pt(x + 0.5, y + 0.8), pt(x + 0.2, y + 0.5)], f.b, (x + y) % 2 ? 1 : 0.35);
      } else {
        poly(g, [pt(x + 0.02, y + 0.02), pt(x + 0.98, y + 0.02), pt(x + 0.98, y + 0.98), pt(x + 0.02, y + 0.98)], hash(x, y) > 0.5 ? f.a : f.b);
      }
    }
    if (room.wall !== 'nenhuma') this.drawWalls(g);
    else {
      // espaço exterior: marca a entrada com um tapete de calçada mais escura
      poly(g, [pt(room.doorX, room.doorY), pt(room.doorX + 1, room.doorY), pt(room.doorX + 1, room.doorY + 1), pt(room.doorX, room.doorY + 1)], 0x8a8f96, 0.5);
    }
  }

  private drawWalls(g: Graphics) {
    const { room } = this.snap!;
    const c = WALL[room.wall] ?? WALL.branca;
    const W = room.width, H = room.height;
    const L = c, R = darken(c, 0.82);
    // parede de trás-direita (ao longo de x, em y=0) e de trás-esquerda (ao longo de y, em x=0)
    poly(g, [pt(0, 0), pt(W, 0), pt(W, 0, WALL_H), pt(0, 0, WALL_H)], R, 1, true);
    for (let y = 0; y < H; y++) {
      if (y === room.doorY && room.doorX === 0) continue;
      poly(g, [pt(0, y), pt(0, y + 1), pt(0, y + 1, WALL_H), pt(0, y, WALL_H)], L);
    }
    if (room.doorX === 0) {
      const y = room.doorY;
      poly(g, [pt(0, y), pt(0, y + 1), pt(0, y + 1, WALL_H), pt(0, y, WALL_H)], L);
      poly(g, [pt(0, y + 0.1), pt(0, y + 0.9), pt(0, y + 0.9, 70), pt(0, y + 0.1, 70)], 0x1a1410);
    }
    poly(g, [pt(0, 0), pt(0, H), pt(0, H, WALL_H), pt(0, 0, WALL_H)], L, 0, true);
    if (room.wall === 'azulejo') {
      for (let i = 0; i < W * 4; i++) for (let j = 0; j < 6; j++) {
        if ((i + j) % 2) continue;
        const u = i / 4;
        poly(g, [pt(u + 0.04, 0, 6 + j * 8), pt(u + 0.21, 0, 6 + j * 8), pt(u + 0.21, 0, 12 + j * 8), pt(u + 0.04, 0, 12 + j * 8)], 0x2a5ea8, 0.9);
      }
      for (let i = 0; i < H * 4; i++) for (let j = 0; j < 6; j++) {
        if ((i + j) % 2) continue;
        const v = i / 4;
        if (room.doorX === 0 && v >= room.doorY && v < room.doorY + 1) continue;
        poly(g, [pt(0, v + 0.04, 6 + j * 8), pt(0, v + 0.21, 6 + j * 8), pt(0, v + 0.21, 12 + j * 8), pt(0, v + 0.04, 12 + j * 8)], 0x2a5ea8, 0.9);
      }
    }
    // rodapé e topo da parede
    line(g, pt(0, 0, WALL_H), pt(W, 0, WALL_H), darken(R, 0.7), 3);
    line(g, pt(0, 0, WALL_H), pt(0, H, WALL_H), darken(L, 0.7), 3);
    // janela na parede da direita
    if (W >= 6) {
      const u = Math.floor(W / 2) - 0.6;
      poly(g, [pt(u, 0, 40), pt(u + 1.2, 0, 40), pt(u + 1.2, 0, 92), pt(u, 0, 92)], 0xf7f4ee, 1, true);
      poly(g, [pt(u + 0.1, 0, 45), pt(u + 1.1, 0, 45), pt(u + 1.1, 0, 87), pt(u + 0.1, 0, 87)], 0x7fb8e6);
      line(g, pt(u + 0.6, 0, 45), pt(u + 0.6, 0, 87), 0xf7f4ee, 2);
    }
  }

  private addItem(it: RoomItemState) {
    const def = FURNITURE_BY_ID.get(it.defId);
    const { back, front } = drawItem(it);
    const fp = def ? footprint(def, it.rotation) : { w: 1, l: 1 };
    const depth = (it.x + fp.w - 1 + it.y + fp.l - 1) * 100;
    back.zIndex = depth + 40 + it.z;
    front.zIndex = depth + 60 + it.z;
    this.world.addChild(back, front);
    this.itemNodes.push(back, front);
  }

  // ------------------------------------------------------------------ avatares
  private framesFor(f: Figure) {
    const key = JSON.stringify(f);
    let fr = this.sheetCache.get(key);
    if (!fr) {
      const base = Texture.from(renderAvatarSheet(f));
      fr = Object.fromEntries(FRAMES.map((n, i) => [n, new Texture({ source: base.source, frame: new Rectangle(i * AV_W, 0, AV_W, AV_H) })])) as Record<FrameName, Texture>;
      this.sheetCache.set(key, fr);
    }
    return fr;
  }

  addUser(u: RoomUserState) {
    if (this.avatars.has(u.id)) this.removeUser(u.id);
    const frames = this.framesFor(u.figure);
    const root = new Container();
    const shadow = new Graphics().ellipse(0, 0, 15, 6).fill({ color: 0x000000, alpha: 0.22 });
    const sprite = new Sprite(frames.FS);
    sprite.anchor.set(0.5, 1); sprite.y = 2;
    sprite.eventMode = 'static'; sprite.cursor = 'pointer';
    sprite.on('pointertap', e => { e.stopPropagation(); this.cb.onAvatarClick(u.id); });
    const label = new Text({ text: u.username, style: { fontFamily: 'Verdana, sans-serif', fontSize: 10, fill: u.id === this.snap?.you ? 0xffd84a : 0xffffff, stroke: { color: 0x000000, width: 3 } } });
    label.anchor.set(0.5, 1); label.y = -AV_H - 2; label.resolution = 2;
    root.addChild(shadow, sprite, label);
    this.world.addChild(root);
    const p = { x: u.x, y: u.y, z: u.z };
    const node: AvatarNode = { state: { ...u }, root, sprite, shadow, label, frames, from: p, to: p, t0: 0, walkTime: 0 };
    this.avatars.set(u.id, node);
    this.place(node, p);
  }

  removeUser(id: string) {
    const n = this.avatars.get(id);
    if (n) { n.root.destroy({ children: true }); this.avatars.delete(id); }
  }

  setFigure(id: string, f: Figure) {
    const n = this.avatars.get(id);
    if (n) { n.frames = this.framesFor(f); n.state.figure = f; }
  }

  applyMoves(moves: Array<Pick<RoomUserState, 'id' | 'x' | 'y' | 'z' | 'dir' | 'status'>>) {
    const now = performance.now();
    for (const m of moves) {
      const n = this.avatars.get(m.id);
      if (!n) continue;
      n.from = this.currentPos(n, now);
      n.to = { x: m.x, y: m.y, z: m.z };
      n.t0 = now;
      n.state = { ...n.state, ...m };
    }
  }

  private currentPos(n: AvatarNode, now: number) {
    const t = Math.min(1, (now - n.t0) / WALK_TICK_MS);
    return { x: n.from.x + (n.to.x - n.from.x) * t, y: n.from.y + (n.to.y - n.from.y) * t, z: n.from.z + (n.to.z - n.from.z) * t };
  }

  private place(n: AvatarNode, p: { x: number; y: number; z: number }) {
    const s = tileToScreen(p.x + 0.5, p.y + 0.5);
    const sitting = n.state.status.sit !== undefined;
    n.root.position.set(s.x, s.y - p.z * 32 + (sitting ? 10 : 0));
    n.shadow.visible = !sitting;
    n.root.zIndex = (Math.round(p.x) + Math.round(p.y)) * 100 + 50 + (sitting ? 5 : 0);
  }

  private frame() {
    const now = performance.now();
    const dt = this.app.ticker.deltaMS;
    for (const n of this.avatars.values()) {
      const p = this.currentPos(n, now);
      const moving = now - n.t0 < WALK_TICK_MS && (n.from.x !== n.to.x || n.from.y !== n.to.y);
      n.walkTime = moving ? n.walkTime + dt : 0;
      const { view, flip } = viewForDir(n.state.dir);
      const pose = n.state.status.sit !== undefined && !moving ? 'T' : moving ? (['A', 'S', 'B', 'S'] as const)[Math.floor(n.walkTime / 110) % 4] : 'S';
      n.sprite.texture = n.frames[`${view}${pose}` as FrameName];
      n.sprite.scale.x = flip ? -1 : 1;
      this.place(n, p);
    }
    // balões sobem devagar e desaparecem
    for (const b of this.bubbles) {
      const age = now - b.born;
      b.node.alpha = age > 25_000 ? Math.max(0, 1 - (age - 25_000) / 3000) : 1;
    }
    this.bubbles = this.bubbles.filter(b => { if (b.node.alpha <= 0 || b.y < 4) { b.node.destroy({ children: true }); return false; } return true; });
  }

  // ------------------------------------------------------------------ chat (balões no topo, à moda clássica)
  chat(m: ChatMessageDTO) {
    const n = this.avatars.get(m.userId);
    const name = new Text({ text: `${m.username}: `, style: { fontFamily: 'Verdana, sans-serif', fontSize: 11, fontWeight: 'bold', fill: 0x000000 } });
    const txt = new Text({ text: m.text, style: { fontFamily: 'Verdana, sans-serif', fontSize: 11, fill: 0x000000, wordWrap: true, wordWrapWidth: 260 } });
    name.resolution = txt.resolution = 2;
    txt.x = name.width; name.y = txt.y = 4;
    const w = Math.min(name.width + txt.width + 14, 420), h = Math.max(txt.height, 14) + 8;
    const bg = new Graphics()
      .roundRect(-1, -1, w + 2, h + 2, 7).fill(0x000000)
      .roundRect(0, 0, w, h, 6).fill(m.userId === this.snap?.you ? 0xfff8d6 : 0xffffff)
      .poly([w / 2 - 5, h, w / 2 + 5, h, w / 2, h + 6]).fill(0x000000);
    const node = new Container();
    name.x = 7; txt.x = 7 + name.width;
    node.addChild(bg, name, txt);
    // fica por cima do jogador que falou; os anteriores sobem
    let sx = this.app.screen.width / 2;
    if (n) sx = n.root.getGlobalPosition().x;
    node.x = Math.max(6, Math.min(this.app.screen.width - w - 6, sx - w / 2));
    const lane = this.app.screen.width < 640 ? 100 : 84;
    for (const b of this.bubbles) { b.y -= h + 6; b.node.y = b.y; }
    node.y = lane;
    this.overlay.addChild(node);
    this.bubbles.push({ node, y: lane, born: performance.now() });
  }

  // ------------------------------------------------------------------ câmara e input
  private layout() {
    if (!this.snap) return;
    const { width: W, height: H } = this.snap.room;
    this.world.scale.set(this.zoom);
    const mid = tileToScreen(W / 2, H / 2);
    this.world.x = Math.round(this.app.screen.width / 2 - mid.x * this.zoom + this.pan.x);
    this.world.y = Math.round(this.app.screen.height / 2 - (mid.y - 40) * this.zoom + this.pan.y);
  }

  private tileAt(e: FederatedPointerEvent) {
    const local = this.world.toLocal(e.global);
    const t = screenToTile(local.x, local.y);
    return { x: Math.floor(t.x), y: Math.floor(t.y) };
  }

  private pointerDown(e: FederatedPointerEvent) {
    this.drag = { x: e.global.x, y: e.global.y, moved: false, ox: this.pan.x, oy: this.pan.y };
  }

  private pointerMove(e: FederatedPointerEvent) {
    if (this.drag) {
      const dx = e.global.x - this.drag.x, dy = e.global.y - this.drag.y;
      if (!this.drag.moved && Math.hypot(dx, dy) > 8) this.drag.moved = true;
      if (this.drag.moved) { this.pan = { x: this.drag.ox + dx, y: this.drag.oy + dy }; this.layout(); this.hover.clear(); return; }
    }
    if (e.pointerType === 'touch') return;
    this.drawHover(this.tileAt(e));
  }

  private pointerUp(e: FederatedPointerEvent) {
    const d = this.drag; this.drag = null;
    if (!d || d.moved || !this.snap) return;
    const t = this.tileAt(e);
    if (t.x < 0 || t.y < 0 || t.x >= this.snap.room.width || t.y >= this.snap.room.height) return;
    this.drawHover(t);
    this.cb.onTileClick(t.x, t.y);
  }

  private drawHover(t: { x: number; y: number }) {
    this.hover.clear();
    if (!this.snap || t.x < 0 || t.y < 0 || t.x >= this.snap.room.width || t.y >= this.snap.room.height) return;
    const ps = [pt(t.x, t.y), pt(t.x + 1, t.y), pt(t.x + 1, t.y + 1), pt(t.x, t.y + 1)].flatMap(p => [p.x, p.y]);
    this.hover.poly(ps).fill({ color: 0xffffff, alpha: 0.15 }).poly(ps).stroke({ width: 2, color: 0xffffff, alpha: 0.85 });
  }

  /** Utilizado para testes e para o painel de quem está no quarto. */
  get userIds() { return [...this.avatars.keys()]; }
}

