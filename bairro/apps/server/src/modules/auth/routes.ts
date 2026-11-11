import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { DEFAULT_FIGURE, validateFigure } from '@bairro/shared';
import { prisma } from '../../db';
import { config } from '../../config';
import type { KV } from '../../infra/kv';
import { hashPassword, verifyPassword } from './passwords';
import { createSession, destroySession, SESSION_COOKIE, userFromToken } from './sessions';
import { createHomeRoom } from '../rooms/service';
import { audit } from '../admin/audit';

const USERNAME = /^[A-Za-z0-9_.-]{3,16}$/;
const RESERVED = ['admin', 'moderador', 'staff', 'bairro', 'sistema', 'suporte'];

const registerBody = z.object({
  username: z.string().regex(USERNAME, 'O nome deve ter 3 a 16 caracteres: letras, números, _ . ou -'),
  password: z.string().min(8, 'A palavra-passe precisa de pelo menos 8 caracteres').max(128),
  birthYear: z.number().int(),
  figure: z.unknown().optional(),
  acceptTerms: z.literal(true, { errorMap: () => ({ message: 'Tens de aceitar as regras do bairro.' }) }),
});
const loginBody = z.object({ username: z.string().max(32), password: z.string().max(128) });

function setSessionCookie(reply: FastifyReply, token: string, expires: Date) {
  reply.setCookie(SESSION_COOKIE, token, { path: '/', httpOnly: true, sameSite: 'lax', secure: config.cookieSecure, expires });
}

/** Utilizador autenticado do pedido (ou null). */
export async function currentUser(req: FastifyRequest) {
  return userFromToken(req.cookies[SESSION_COOKIE]);
}

export function authRoutes(app: FastifyInstance, kv: KV) {
  app.post('/api/auth/register', async (req, reply) => {
    if (!(await kv.rateLimit(`register:${req.ip}`, 5, 60 * 60_000))) {
      return reply.code(429).send({ error: 'Demasiados registos a partir desta rede. Tenta mais tarde.' });
    }
    const parsed = registerBody.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.issues[0].message });
    const { username, password, birthYear } = parsed.data;
    const year = new Date().getFullYear();
    if (birthYear < year - 110 || birthYear > year) return reply.code(400).send({ error: 'Ano de nascimento inválido.' });
    if (year - birthYear < config.minAge) {
      return reply.code(403).send({ error: `Precisas de ter pelo menos ${config.minAge} anos para criar conta.` });
    }
    const lower = username.toLowerCase();
    if (RESERVED.some(r => lower.includes(r))) return reply.code(400).send({ error: 'Esse nome está reservado.' });
    if (await prisma.user.findUnique({ where: { usernameLower: lower } })) return reply.code(409).send({ error: 'Esse nome já está ocupado.' });

    const figure = validateFigure(parsed.data.figure) ?? DEFAULT_FIGURE;
    const passwordHash = await hashPassword(password);
    const user = await prisma.$transaction(async tx => {
      const u = await tx.user.create({ data: { username, usernameLower: lower, passwordHash, birthYear, figure, motto: 'Novo no bairro!' } });
      await createHomeRoom(tx, u.id, u.username);
      return u;
    });
    const s = await createSession(user.id);
    setSessionCookie(reply, s.token, s.expiresAt);
    await audit(user.id, 'auth.register', { username }, req.ip);
    return { ok: true };
  });

  app.post('/api/auth/login', async (req, reply) => {
    const parsed = loginBody.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'Pedido inválido.' });
    const lower = parsed.data.username.toLowerCase();
    if (!(await kv.rateLimit(`login:${req.ip}:${lower}`, 8, 10 * 60_000))) {
      return reply.code(429).send({ error: 'Demasiadas tentativas. Espera 10 minutos.' });
    }
    const user = await prisma.user.findUnique({ where: { usernameLower: lower } });
    const ok = user ? await verifyPassword(parsed.data.password, user.passwordHash) : false;
    if (!user || !ok) return reply.code(401).send({ error: 'Nome ou palavra-passe errados.' });
    if (user.status !== 'ACTIVE') return reply.code(403).send({ error: 'Esta conta está suspensa.' });
    const s = await createSession(user.id);
    await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    setSessionCookie(reply, s.token, s.expiresAt);
    await audit(user.id, 'auth.login', null, req.ip);
    return { ok: true };
  });

  app.post('/api/auth/logout', async (req, reply) => {
    await destroySession(req.cookies[SESSION_COOKIE]);
    reply.clearCookie(SESSION_COOKIE, { path: '/' });
    return { ok: true };
  });
}
