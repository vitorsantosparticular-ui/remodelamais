import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { BAIRRO_BY_ID, validateFigure } from '@bairro/shared';
import { prisma } from '../../db';
import type { KV } from '../../infra/kv';
import type { Gateway } from '../../realtime/gateway';
import { currentUser } from '../auth/routes';
import { GameError, InsufficientFunds, parseEuros } from '../economy/money';
import * as city from './service';
import { audit } from '../admin/audit';

const travelBody = z.object({ to: z.string(), mode: z.enum(['pe', 'metro', 'taxi', 'carro']) });
const amountBody = z.object({ amount: z.union([z.number(), z.string()]) });
const transferBody = z.object({ to: z.string().max(32), amount: z.union([z.number(), z.string()]) });
const idBody = z.object({ id: z.string().max(64) });

/** Envolve uma ação: autenticação, limite de taxa, erros de jogo → 400 com mensagem, e devolve o estado novo. */
function action(kv: KV, fn: (userId: string, body: unknown, req: FastifyRequest) => Promise<unknown>) {
  return async (req: FastifyRequest, reply: FastifyReply) => {
    const u = await currentUser(req);
    if (!u) return reply.code(401).send({ error: 'Sessão terminada.' });
    if (!(await kv.rateLimit(`city:${u.id}`, 40, 10_000))) return reply.code(429).send({ error: 'Calma! Demasiadas ações seguidas.' });
    try {
      const result = await fn(u.id, req.body, req);
      return { ok: true, result, state: await city.cityState(u.id) };
    } catch (e) {
      if (e instanceof GameError) return reply.code(e.status).send({ error: e.message });
      if (e instanceof InsufficientFunds) return reply.code(400).send({ error: e.message });
      if (e instanceof z.ZodError) return reply.code(400).send({ error: 'Pedido inválido.' });
      throw e;
    }
  };
}

export function cityRoutes(app: FastifyInstance, gw: Gateway, kv: KV) {
  app.get('/api/city/state', async (req, reply) => {
    const u = await currentUser(req);
    if (!u) return reply.code(401).send({ error: 'Sessão terminada.' });
    return city.cityState(u.id);
  });

  /** Quem está ligado e neste bairro agora. */
  app.get<{ Params: { id: string } }>('/api/city/bairro/:id/people', async (req, reply) => {
    const u = await currentUser(req);
    if (!u) return reply.code(401).send({ error: 'Sessão terminada.' });
    if (!BAIRRO_BY_ID.has(req.params.id)) return reply.code(404).send({ error: 'Bairro desconhecido.' });
    const ids = gw.onlineUserIds();
    const rows = await prisma.user.findMany({ where: { id: { in: ids } }, select: { username: true, figure: true, motto: true, location: true, travelTo: true, arrivesAt: true } });
    return rows.filter(r => city.effectiveLocation(r) === req.params.id).slice(0, 50)
      .map(r => ({ username: r.username, figure: validateFigure(r.figure), motto: r.motto }));
  });

  app.post('/api/city/travel', action(kv, async (id, body) => {
    const b = travelBody.parse(body);
    return city.travel(id, b.to, b.mode);
  }));
  app.post('/api/jobs/start', action(kv, async (id, body) => city.startJob(id, idBody.parse(body).id)));

  app.post('/api/bank/deposit', action(kv, async (id, body) => city.deposit(id, parseEuros(amountBody.parse(body).amount))));
  app.post('/api/bank/withdraw', action(kv, async (id, body) => city.withdraw(id, parseEuros(amountBody.parse(body).amount))));
  app.post('/api/bank/transfer', action(kv, async (id, body, req) => {
    const b = transferBody.parse(body);
    const amount = parseEuros(b.amount);
    await city.transfer(id, b.to, amount);
    await audit(id, 'bank.transfer', { to: b.to, amount }, req.ip);
  }));
  app.get('/api/bank/statement', async (req, reply) => {
    const u = await currentUser(req);
    if (!u) return reply.code(401).send({ error: 'Sessão terminada.' });
    const rows = await city.statement(u.id);
    return rows.map(r => ({ id: r.id, account: r.account, amount: r.amount, balanceAfter: r.balanceAfter, kind: r.kind, memo: r.memo, ts: r.createdAt.getTime() }));
  });

  app.get('/api/properties', async (req, reply) => {
    const u = await currentUser(req);
    if (!u) return reply.code(401).send({ error: 'Sessão terminada.' });
    return city.listProperties(u.id);
  });
  app.post('/api/properties/buy', action(kv, async (id, body) => city.buyProperty(id, idBody.parse(body).id)));
  app.post('/api/properties/rent', action(kv, async (id, body) => city.rentProperty(id, idBody.parse(body).id)));
  app.post('/api/properties/release', action(kv, async (id, body) => city.releaseProperty(id, idBody.parse(body).id)));

  app.post('/api/vehicles/buy', action(kv, async (id, body) => city.buyVehicle(id, idBody.parse(body).id)));
  app.post('/api/vehicles/sell', action(kv, async (id, body) => city.sellVehicle(id, idBody.parse(body).id)));
}
