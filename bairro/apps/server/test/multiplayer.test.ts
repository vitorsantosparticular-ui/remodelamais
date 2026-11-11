/**
 * Teste de integração do primeiro marco: duas contas autenticadas no mesmo quarto,
 * movimento autoritativo, chat em tempo real e persistência na base de dados.
 * Requer PostgreSQL (DATABASE_URL) com migrações e seed aplicados.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { io as ioc, type Socket } from 'socket.io-client';
import type { AddressInfo } from 'node:net';
import type { ClientToServer, ServerToClient, RoomSnapshot } from '@bairro/shared';
import { buildServer } from '../src/app';
import { createMemoryKV } from '../src/infra/kv';
import { prisma } from '../src/db';

type CSocket = Socket<ServerToClient, ClientToServer>;
let base = '';
let close: () => Promise<void>;
const suffix = Math.random().toString(36).slice(2, 7);
const sockets: CSocket[] = [];

before(async () => {
  const { app } = await buildServer({ kv: createMemoryKV() });
  await app.listen({ port: 0, host: '127.0.0.1' });
  base = `http://127.0.0.1:${(app.server.address() as AddressInfo).port}`;
  close = () => app.close();
});
after(async () => {
  sockets.forEach(s => s.disconnect());
  await prisma.user.deleteMany({ where: { username: { endsWith: suffix } } });
  await close();
  await prisma.$disconnect();
});

async function post(path: string, body: unknown, cookie = '') {
  const r = await fetch(base + path, { method: 'POST', headers: { 'content-type': 'application/json', cookie }, body: JSON.stringify(body) });
  return { status: r.status, json: await r.json() as Record<string, unknown>, cookie: (r.headers.get('set-cookie') ?? '').split(';')[0] };
}
async function register(name: string) {
  const r = await post('/api/auth/register', { username: name, password: 'palavra-passe-1', birthYear: 1995, acceptTerms: true });
  assert.equal(r.status, 200, JSON.stringify(r.json));
  assert.match(r.cookie, /^bairro_sid=/);
  return r.cookie;
}
function connect(cookie: string): Promise<CSocket> {
  return new Promise((res, rej) => {
    const s: CSocket = ioc(base, { extraHeaders: { cookie }, transports: ['websocket'], forceNew: true });
    sockets.push(s);
    s.once('connect', () => res(s));
    s.once('connect_error', rej);
  });
}
const once = <K extends keyof ServerToClient>(s: CSocket, ev: K, pred: (a: Parameters<ServerToClient[K]>[0]) => boolean = () => true, ms = 5000) =>
  new Promise<Parameters<ServerToClient[K]>[0]>((res, rej) => {
    const t = setTimeout(() => rej(new Error(`timeout à espera de ${ev}`)), ms);
    const h = (a: Parameters<ServerToClient[K]>[0]) => { if (pred(a)) { clearTimeout(t); s.off(ev, h as never); res(a); } };
    s.on(ev, h as never);
  });
const join = (s: CSocket, roomId: string) => new Promise<{ ok: boolean; error?: string }>(res => s.emit('room:join', { roomId }, res));

let cookieA = '', cookieB = '';
let A: CSocket, B: CSocket;
const nameA = `ana_${suffix}`, nameB = `rui_${suffix}`;

test('registo, login e validações', async () => {
  cookieA = await register(nameA);
  cookieB = await register(nameB);
  assert.equal((await post('/api/auth/register', { username: nameA, password: 'outra-pass-1', birthYear: 1990, acceptTerms: true })).status, 409);
  assert.equal((await post('/api/auth/register', { username: `kid_${suffix}`, password: 'palavra-passe-1', birthYear: new Date().getFullYear() - 10, acceptTerms: true })).status, 403);
  assert.equal((await post('/api/auth/login', { username: nameA, password: 'errada-123' })).status, 401);
  const ok = await post('/api/auth/login', { username: nameA.toUpperCase(), password: 'palavra-passe-1' });
  assert.equal(ok.status, 200);
  const me = await (await fetch(base + '/api/me', { headers: { cookie: ok.cookie } })).json() as { username: string; credits: number; homeRoomId: string };
  assert.equal(me.username, nameA);
  assert.equal(me.credits, 500);
  assert.ok(me.homeRoomId, 'cada jogador tem uma casa');
});

test('socket sem sessão é recusado', async () => {
  await assert.rejects(connect('bairro_sid=falso'));
});

test('dois jogadores no mesmo quarto: entrada, movimento e chat em tempo real', async () => {
  A = await connect(cookieA);
  B = await connect(cookieB);
  const snapA = once(A, 'room:snapshot');
  assert.deepEqual(await join(A, 'praca-central'), { ok: true });
  const sa = await snapA as RoomSnapshot;
  assert.equal(sa.room.name, 'Praça Central');
  assert.ok(sa.items.length > 5);

  const joinedSeenByA = once(A, 'room:user_joined', u => u.username === nameB);
  const snapB = once(B, 'room:snapshot');
  assert.deepEqual(await join(B, 'praca-central'), { ok: true });
  const sb = await snapB as RoomSnapshot;
  assert.equal(sb.users.length >= 2, true);
  await joinedSeenByA;

  // Movimento: A pede um destino; B tem de ver A a chegar lá, passo a passo.
  const target = { x: 5, y: 9 };
  const arrived = once(B, 'room:users_moved', ms => ms.some(m => m.id === sa.you && m.x === target.x && m.y === target.y), 10_000);
  A.emit('room:move', target);
  await arrived;

  // Destino bloqueado (chafariz) é ignorado pelo servidor.
  let movedToFountain = false;
  const h = (ms: Array<{ id: string; x: number; y: number }>) => { if (ms.some(m => m.id === sa.you && m.x === 7 && m.y === 7)) movedToFountain = true; };
  B.on('room:users_moved', h);
  A.emit('room:move', { x: 7, y: 7 });
  await new Promise(r => setTimeout(r, 1200));
  B.off('room:users_moved', h);
  assert.equal(movedToFountain, false);

  // Chat em tempo real, com filtro.
  const msg = once(B, 'chat:message', m => m.username === nameA);
  A.emit('chat:send', { text: 'Olá Rui! Bora à praia? merda de calor' });
  const m = await msg;
  assert.equal(m.text, 'Olá Rui! Bora à praia? ***** de calor');
  const contact = once(B, 'chat:message', mm => mm.username === nameA && mm.text.includes('[contacto removido]'));
  A.emit('chat:send', { text: 'liga-me 912 345 678' });
  await contact;

  // Persistência: posição e mensagens na BD.
  await new Promise(r => setTimeout(r, 300));
  const ua = await prisma.user.findUniqueOrThrow({ where: { username: nameA } });
  assert.deepEqual([ua.lastRoomId, ua.lastX, ua.lastY], ['praca-central', target.x, target.y]);
  const saved = await prisma.chatMessage.count({ where: { userId: ua.id } });
  assert.equal(saved, 2);
});

test('anti-spam: limite de mensagens', async () => {
  const errs: string[] = [];
  A.on('error:game', e => errs.push(e.code));
  for (let i = 0; i < 8; i++) A.emit('chat:send', { text: `spam ${i}` });
  await new Promise(r => setTimeout(r, 600));
  assert.ok(errs.includes('flood'));
});

test('sentar: ao parar num banco o jogador fica sentado e virado para a frente do banco', async () => {
  const sit = once(A, 'room:users_moved', ms => ms.some(m => m.x === 6 && m.y === 4 && m.status.sit !== undefined), 10_000);
  B.emit('room:move', { x: 6, y: 4 });
  const ms = await sit;
  const m = ms.find(x => x.x === 6 && x.y === 4)!;
  assert.equal(m.dir, 4, 'banco com rotação 4 → virado para sul');
  assert.equal(m.status.sit, 0.5);
});

test('ao voltar a entrar, o jogador reaparece onde estava', async () => {
  A.disconnect();
  A = await connect(cookieA);
  const snap = once(A, 'room:snapshot');
  assert.equal((await join(A, 'praca-central')).ok, true);
  const s = await snap as RoomSnapshot;
  const me = s.users.find(u => u.id === s.you)!;
  assert.deepEqual([me.x, me.y], [5, 9]);
  assert.ok(s.chat.some(c => c.text.startsWith('Olá Rui')), 'histórico recente do quarto');
});

test('quarto privado: só o dono entra', async () => {
  const r = await post('/api/rooms', { name: 'Esconderijo', size: 'pequeno', floor: 'madeira', wall: 'rosa', access: 'OWNER_ONLY' }, cookieA);
  assert.equal(r.status, 200);
  const roomId = r.json.id as string;
  assert.deepEqual(await join(B, roomId), { ok: false, error: 'Este quarto é privado.' });
  assert.equal((await join(A, roomId)).ok, true);
});
