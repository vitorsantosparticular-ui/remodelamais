import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { validateFigure } from '@bairro/shared';
import { prisma } from '../../db';
import { config } from '../../config';
import type { Gateway } from '../../realtime/gateway';
import { currentUser } from '../auth/routes';
import { filterChat } from '@bairro/shared';

const figureBody = z.object({ figure: z.unknown(), motto: z.string().max(60).optional() });

export function playerRoutes(app: FastifyInstance, gw: Gateway) {
  /** Dados privados do próprio jogador. Nunca expõe o ano de nascimento nem o hash. */
  app.get('/api/me', async (req, reply) => {
    const u = await currentUser(req);
    if (!u) return reply.code(401).send({ error: 'Sessão terminada.' });
    return {
      id: u.id, username: u.username, figure: validateFigure(u.figure), motto: u.motto, role: u.role,
      credits: u.credits, diamonds: u.diamonds, homeRoomId: u.homeRoomId, lastRoomId: u.lastRoomId,
      isMinor: new Date().getFullYear() - u.birthYear < config.adultAge, createdAt: u.createdAt,
    };
  });

  app.put('/api/me/figure', async (req, reply) => {
    const u = await currentUser(req);
    if (!u) return reply.code(401).send({ error: 'Sessão terminada.' });
    const body = figureBody.safeParse(req.body);
    const figure = body.success ? validateFigure(body.data.figure) : null;
    if (!body.success || !figure) return reply.code(400).send({ error: 'Visual inválido.' });
    const motto = body.data.motto !== undefined ? filterChat(body.data.motto).text.slice(0, 60) : u.motto;
    await prisma.user.update({ where: { id: u.id }, data: { figure, motto } });
    gw.figureChanged(u.id, figure, motto);
    return { ok: true, figure, motto };
  });

  /** Perfil público (sem dados pessoais). */
  app.get<{ Params: { username: string } }>('/api/players/:username', async (req, reply) => {
    const me = await currentUser(req);
    if (!me) return reply.code(401).send({ error: 'Sessão terminada.' });
    const u = await prisma.user.findUnique({ where: { usernameLower: req.params.username.toLowerCase() } });
    if (!u || u.status === 'DELETED') return reply.code(404).send({ error: 'Jogador não encontrado.' });
    return { username: u.username, figure: validateFigure(u.figure), motto: u.motto, createdAt: u.createdAt, homeRoomId: u.homeRoomId };
  });
}
