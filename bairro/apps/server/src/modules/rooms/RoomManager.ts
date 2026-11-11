import { RoomInstance, type RoomCallbacks } from './RoomInstance';
import { loadRoom } from './service';

/**
 * Mantém os quartos ativos em memória. Um quarto é carregado da BD quando alguém entra
 * e descarregado quando fica vazio. Nota: com várias instâncias do servidor, cada quarto
 * terá de pertencer a um só nó (ver ARCHITECTURE.md, "Escala").
 */
export class RoomManager {
  private rooms = new Map<string, RoomInstance>();
  private loading = new Map<string, Promise<RoomInstance | null>>();
  /** Em que quarto está cada jogador. */
  readonly userRoom = new Map<string, string>();

  constructor(private cb: RoomCallbacks) {}

  async get(roomId: string): Promise<RoomInstance | null> {
    const r = this.rooms.get(roomId);
    if (r) return r;
    if (!this.loading.has(roomId)) {
      this.loading.set(roomId, loadRoom(roomId).then(data => {
        this.loading.delete(roomId);
        if (!data) return null;
        const inst = new RoomInstance(data.info, data.items, this.cb);
        this.rooms.set(roomId, inst);
        return inst;
      }));
    }
    return this.loading.get(roomId)!;
  }

  peek(roomId: string) { return this.rooms.get(roomId); }

  userCount(roomId: string) { return this.rooms.get(roomId)?.users.size ?? 0; }

  unloadIfEmpty(roomId: string) {
    const r = this.rooms.get(roomId);
    if (r && r.users.size === 0) { r.dispose(); this.rooms.delete(roomId); }
  }

  /** Força recarregar da BD (ex.: depois de editar o quarto). */
  invalidate(roomId: string) {
    const r = this.rooms.get(roomId);
    if (r && r.users.size === 0) this.unloadIfEmpty(roomId);
  }
}
