import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import Fastify, { type FastifyBaseLogger } from 'fastify';
import cookie from '@fastify/cookie';
import fastifyStatic from '@fastify/static';
import { config } from './config';
import { logger } from './logger';
import { createKV, type KV } from './infra/kv';
import { createGateway } from './realtime/gateway';
import { authRoutes } from './modules/auth/routes';
import { playerRoutes } from './modules/players/routes';
import { roomRoutes } from './modules/rooms/routes';
import { purgeOldMessages } from './modules/chat/service';

const WEB_DIST = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../web/dist');

/** Monta o servidor HTTP + tempo real. Usado pelo arranque e pelos testes. */
export async function buildServer(opts: { kv?: KV } = {}) {
  const app = Fastify({ loggerInstance: logger as FastifyBaseLogger, trustProxy: true, bodyLimit: 32 * 1024 });
  const kv = opts.kv ?? await createKV();
  await app.register(cookie);

  // Proteção CSRF: pedidos que alteram estado só de origens conhecidas (o cookie também é SameSite=Lax).
  app.addHook('onRequest', async (req, reply) => {
    if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') return;
    const origin = req.headers.origin;
    const self = `${req.protocol}://${req.headers.host}`;
    if (origin && origin !== self && !config.webOrigin.includes(origin)) {
      return reply.code(403).send({ error: 'Origem não permitida.' });
    }
  });

  const gw = createGateway(app.server, kv);
  app.get('/api/health', async () => ({ ok: true, online: await kv.onlineCount() }));
  authRoutes(app, kv);
  playerRoutes(app, gw);
  roomRoutes(app, gw);

  // Em produção o servidor também serve o cliente compilado (apps/web/dist).
  if (existsSync(WEB_DIST)) {
    await app.register(fastifyStatic, { root: WEB_DIST });
    app.setNotFoundHandler((req, reply) => {
      if (req.url.startsWith('/api/') || req.url.startsWith('/socket.io')) return reply.code(404).send({ error: 'Não encontrado.' });
      return reply.sendFile('index.html');
    });
  }

  const retention = setInterval(() => purgeOldMessages().catch(e => logger.error({ err: e }, 'retenção falhou')), 60 * 60_000);
  app.addHook('onClose', async () => {
    clearInterval(retention);
    gw.io.disconnectSockets(true);
    await new Promise(r => setTimeout(r, 200)); // deixar os handlers de saída gravar posições
    await kv.close();
  });
  purgeOldMessages().catch(() => undefined);
  return { app, gw, kv };
}
