/** Ligação Socket.IO. Encaminha eventos do servidor para o motor Pixi e para o estado React. */
import { io, type Socket } from 'socket.io-client';
import type { ClientToServer, ServerToClient } from '@bairro/shared';
import { useGame } from '../store';
import type { RoomView } from '../game/RoomView';
import { refreshCity } from '../cityActions';
import { createDemoSocket } from '../demo/demoServer';

export type GameSocket = Socket<ServerToClient, ClientToServer>;

/** Liga ao servidor. O jogo começa no mapa; só se entra num quarto quando o jogador escolhe. */
export function connectGame(view: RoomView): GameSocket {
  const s: GameSocket = import.meta.env.VITE_DEMO === '1'
    ? createDemoSocket() as unknown as GameSocket
    : io({ withCredentials: true, transports: ['websocket', 'polling'] });
  const g = useGame.getState;

  s.on('connect', () => {
    g().set({ connected: true });
    // Depois de uma quebra de ligação, volta a entrar no quarto onde estava.
    const room = g().room;
    if (g().mode === 'room' && room) enterRoom(s, room.id);
  });
  s.on('disconnect', () => g().set({ connected: false }));
  s.on('connect_error', err => {
    if (err.message === 'nao_autenticado') { g().set({ me: null }); s.disconnect(); }
  });

  s.on('room:snapshot', snap => {
    view.load(snap);
    g().set({ mode: 'room', room: snap.room, users: Object.fromEntries(snap.users.map(u => [u.id, u])), chat: snap.chat, selectedUserId: null });
  });
  s.on('room:left', () => g().set({ mode: 'city', room: null, users: {}, selectedUserId: null }));
  s.on('room:user_joined', u => { view.addUser(u); g().set({ users: { ...g().users, [u.id]: u } }); });
  s.on('room:user_left', ({ id }) => {
    view.removeUser(id);
    const users = { ...g().users }; delete users[id];
    g().set({ users, selectedUserId: g().selectedUserId === id ? null : g().selectedUserId });
  });
  s.on('room:users_moved', moves => view.applyMoves(moves));
  s.on('chat:message', m => { view.chat(m); g().addChat(m); });
  s.on('user:figure', ({ id, figure }) => {
    view.setFigure(id, figure);
    const u = g().users[id];
    if (u) g().set({ users: { ...g().users, [id]: { ...u, figure } } });
  });
  s.on('city:presence', p => g().set({ presence: p.counts, online: p.total }));
  s.on('city:changed', () => { refreshCity(); });
  s.on('error:game', e => g().notify(e.message));
  s.on('notice', e => g().notify(e.message));
  return s;
}

export function enterRoom(s: GameSocket | null, roomId: string) {
  if (!s) return;
  s.emit('room:join', { roomId }, r => { if (!r.ok) useGame.getState().notify(r.error ?? 'Não foi possível entrar.'); });
}

export function leaveRoom(s: GameSocket | null) {
  s?.emit('room:leave');
  useGame.getState().set({ mode: 'city', room: null, users: {}, selectedUserId: null, window: null });
}
