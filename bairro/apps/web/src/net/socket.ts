/** Ligação Socket.IO. Encaminha eventos do servidor para o motor Pixi e para o estado React. */
import { io, type Socket } from 'socket.io-client';
import type { ClientToServer, ServerToClient } from '@bairro/shared';
import { useGame } from '../store';
import type { RoomView } from '../game/RoomView';

export type GameSocket = Socket<ServerToClient, ClientToServer>;

export function connectGame(view: RoomView, firstRoom: string): GameSocket {
  const s: GameSocket = io({ withCredentials: true, transports: ['websocket', 'polling'] });
  const g = useGame.getState;
  let currentRoom = firstRoom;

  s.on('connect', () => {
    g().set({ connected: true });
    joinRoom(s, currentRoom);
  });
  s.on('disconnect', () => g().set({ connected: false }));
  s.on('connect_error', err => {
    if (err.message === 'nao_autenticado') { g().set({ me: null }); s.disconnect(); }
  });

  s.on('room:snapshot', snap => {
    currentRoom = snap.room.id;
    view.load(snap);
    g().set({ room: snap.room, users: Object.fromEntries(snap.users.map(u => [u.id, u])), chat: snap.chat, selectedUserId: null });
  });
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
  s.on('error:game', e => g().notify(e.message));
  s.on('notice', e => g().notify(e.message));
  return s;
}

export function joinRoom(s: GameSocket, roomId: string) {
  s.emit('room:join', { roomId }, r => { if (!r.ok) useGame.getState().notify(r.error ?? 'Não foi possível entrar.'); });
}
