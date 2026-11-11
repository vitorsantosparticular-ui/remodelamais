import type { Server as HttpServer } from 'node:http';
import { Server, type Socket } from 'socket.io';
import {
  validateFigure, DEFAULT_FIGURE, filterChat, CHAT_RATE,
  type ClientToServer, type ServerToClient,
} from '@bairro/shared';
import type { User } from '@prisma/client';
import { prisma } from '../db';
import { logger } from '../logger';
import { config } from '../config';
import type { KV } from '../infra/kv';
import { parseCookies, SESSION_COOKIE, userFromToken } from '../modules/auth/sessions';
import { RoomManager } from '../modules/rooms/RoomManager';
import { recentMessages, saveMessage } from '../modules/chat/service';
import { effectiveLocation, settle } from '../modules/city/service';
import { BAIRRO_BY_ID } from '@bairro/shared';

type GameSocket = Socket<ClientToServer, ServerToClient, Record<string, never>, { user: User }>;

/**
 * Camada de tempo real. Cada evento do cliente é uma INTENÇÃO validada aqui:
 * autenticação no handshake, permissões de quarto, limites de taxa, filtro de chat.
 */
export function createGateway(http: HttpServer, kv: KV) {
  const io = new Server<ClientToServer, ServerToClient, Record<string, never>, { user: User }>(http, {
    cors: { origin: config.webOrigin, credentials: true },
    maxHttpBufferSize: 16 * 1024,
  });

  const rooms = new RoomManager({
    broadcastMoves: (roomId, moves) => io.to(`room:${roomId}`).emit('room:users_moved', moves),
    persistPosition: (userId, roomId, x, y) => {
      prisma.user.update({ where: { id: userId }, data: { lastRoomId: roomId, lastX: x, lastY: y } })
        .catch(e => logger.error({ err: e, userId }, 'falha a guardar posição'));
    },
  });
  /** Um só socket ativo por jogador (abrir noutro separador fecha o anterior). */
  const socketOf = new Map<string, GameSocket>();

  io.use(async (socket, next) => {
    try {
      const token = parseCookies(socket.handshake.headers.cookie)[SESSION_COOKIE];
      const user = await userFromToken(token);
      if (!user) return next(new Error('nao_autenticado'));
      socket.data.user = user;
      next();
    } catch (e) { next(e as Error); }
  });

  async function leaveCurrentRoom(socket: GameSocket) {
    const uid = socket.data.user.id;
    const roomId = rooms.userRoom.get(uid);
    if (!roomId) return;
    const inst = rooms.peek(roomId);
    const u = inst?.remove(uid);
    rooms.userRoom.delete(uid);
    socket.leave(`room:${roomId}`);
    io.to(`room:${roomId}`).emit('room:user_left', { id: uid });
    if (u) await prisma.user.update({ where: { id: uid }, data: { lastRoomId: roomId, lastX: u.x, lastY: u.y } }).catch(() => undefined);
    rooms.unloadIfEmpty(roomId);
  }

  io.on('connection', async (socket: GameSocket) => {
    const user = socket.data.user;
    const old = socketOf.get(user.id);
    if (old && old.id !== socket.id) {
      old.emit('notice', { message: 'Entraste noutro separador ou dispositivo. Esta ligação foi fechada.' });
      await leaveCurrentRoom(old);
      old.disconnect(true);
    }
    socketOf.set(user.id, socket);
    await kv.setOnline(user.id, true);
    logger.info({ userId: user.id }, 'ligado');

    socket.on('room:join', async (p, ack) => {
      const reply = typeof ack === 'function' ? ack : () => undefined;
      try {
        if (!(await kv.rateLimit(`join:${user.id}`, 10, 10_000))) return reply({ ok: false, error: 'Calma! Estás a mudar de quarto demasiado depressa.' });
        const roomId = typeof p?.roomId === 'string' ? p.roomId : '';
        const inst = await rooms.get(roomId);
        if (!inst) return reply({ ok: false, error: 'Esse quarto não existe.' });
        const fresh = await settle(user.id);
        if (fresh.status !== 'ACTIVE') { socket.disconnect(true); return; }
        const isStaff = fresh.role !== 'PLAYER';
        // Quartos com bairro: é preciso estar lá (e não em viagem).
        const roomBairro = await prisma.room.findUnique({ where: { id: roomId }, select: { bairro: true } });
        if (roomBairro?.bairro && !isStaff) {
          if (fresh.travelTo) return reply({ ok: false, error: 'Ainda estás em viagem.' });
          if (fresh.location !== roomBairro.bairro) {
            return reply({ ok: false, error: `Este sítio fica em ${BAIRRO_BY_ID.get(roomBairro.bairro)?.name ?? roomBairro.bairro}. Vai até lá primeiro.` });
          }
        }
        if (inst.info.access === 'OWNER_ONLY' && inst.info.ownerId !== fresh.id && !isStaff) {
          return reply({ ok: false, error: 'Este quarto é privado.' });
        }
        if (rooms.userRoom.get(fresh.id) !== roomId && inst.users.size >= inst.info.maxUsers && !isStaff) {
          return reply({ ok: false, error: 'O quarto está cheio.' });
        }
        await leaveCurrentRoom(socket);
        const spawn = fresh.lastRoomId === roomId && fresh.lastX != null && fresh.lastY != null ? { x: fresh.lastX, y: fresh.lastY } : null;
        const ru = inst.add({
          id: fresh.id, username: fresh.username, figure: validateFigure(fresh.figure) ?? DEFAULT_FIGURE,
          motto: fresh.motto, socketId: socket.id,
        }, spawn);
        rooms.userRoom.set(fresh.id, roomId);
        await socket.join(inst.channel);
        socket.to(inst.channel).emit('room:user_joined', inst.publicUser(ru));
        socket.emit('room:snapshot', {
          room: inst.info, items: inst.items, users: [...inst.users.values()].map(u => inst.publicUser(u)),
          chat: await recentMessages(roomId), you: fresh.id,
        });
        await prisma.user.update({ where: { id: fresh.id }, data: { lastRoomId: roomId, lastX: ru.x, lastY: ru.y } });
        reply({ ok: true });
      } catch (e) {
        logger.error({ err: e }, 'room:join falhou');
        reply({ ok: false, error: 'Erro ao entrar no quarto.' });
      }
    });

    socket.on('room:leave', async () => { await leaveCurrentRoom(socket); });

    socket.on('room:move', async p => {
      const roomId = rooms.userRoom.get(user.id);
      if (!roomId || !p) return;
      if (!(await kv.rateLimit(`move:${user.id}`, 12, 2000))) return;
      rooms.peek(roomId)?.requestMove(user.id, Number(p.x), Number(p.y));
    });

    socket.on('chat:send', async p => {
      const roomId = rooms.userRoom.get(user.id);
      if (!roomId || typeof p?.text !== 'string') return;
      if (!(await kv.rateLimit(`chat:${user.id}`, CHAT_RATE.max, CHAT_RATE.windowMs))) {
        return socket.emit('error:game', { code: 'flood', message: 'Estás a escrever muito depressa. Espera uns segundos.' });
      }
      const { text, flagged } = filterChat(p.text);
      if (!text) return;
      try {
        const msg = await saveMessage(roomId, user.id, user.username, text, flagged);
        io.to(`room:${roomId}`).emit('chat:message', msg);
      } catch (e) { logger.error({ err: e }, 'chat falhou'); }
    });

    socket.on('disconnect', async () => {
      if (socketOf.get(user.id)?.id === socket.id) {
        socketOf.delete(user.id);
        await leaveCurrentRoom(socket);
        await kv.setOnline(user.id, false);
      }
      logger.info({ userId: user.id }, 'desligado');
    });
  });

  /** Atualiza a figura de um jogador nos quartos onde está (chamado pela API REST). */
  function figureChanged(userId: string, figure: User['figure'], motto: string) {
    const roomId = rooms.userRoom.get(userId);
    const inst = roomId ? rooms.peek(roomId) : undefined;
    const u = inst?.users.get(userId);
    const f = validateFigure(figure);
    if (u && f) { u.figure = f; u.motto = motto; io.to(`room:${roomId}`).emit('user:figure', { id: userId, figure: f }); }
  }

  /** Desliga um jogador (suspensão, logout). */
  function kick(userId: string, message: string) {
    const s = socketOf.get(userId);
    if (s) { s.emit('notice', { message }); s.disconnect(true); }
  }

  /** Tira o jogador do quarto (ex.: partiu de viagem, foi despejado). */
  function leaveRoomOf(userId: string) {
    const s = socketOf.get(userId);
    if (s) leaveCurrentRoom(s).then(() => s.emit('room:left')).catch(() => undefined);
  }
  function notify(userId: string, message: string) {
    const s = socketOf.get(userId);
    if (s) { s.emit('notice', { message }); s.emit('city:changed', { reason: message }); }
  }
  const onlineUserIds = () => [...socketOf.keys()];

  // Presença por bairro, difundida a todos a cada 4 s (só se mudou).
  let lastPresence = '';
  const presenceTimer = setInterval(async () => {
    try {
      const ids = onlineUserIds();
      const rows = ids.length ? await prisma.user.findMany({ where: { id: { in: ids } }, select: { location: true, travelTo: true, arrivesAt: true } }) : [];
      const counts: Record<string, number> = {};
      for (const r of rows) { const l = effectiveLocation(r); if (l) counts[l] = (counts[l] ?? 0) + 1; }
      const payload = { counts, total: ids.length };
      const key = JSON.stringify(payload);
      if (key !== lastPresence) { lastPresence = key; io.emit('city:presence', payload); }
    } catch (e) { logger.error({ err: e }, 'presença falhou'); }
  }, 4000);
  io.engine.on('close', () => clearInterval(presenceTimer));

  return { io, rooms, figureChanged, kick, leaveRoomOf, notify, onlineUserIds, stop: () => clearInterval(presenceTimer) };
}
export type Gateway = ReturnType<typeof createGateway>;
