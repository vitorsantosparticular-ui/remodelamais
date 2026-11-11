import { config } from './config';
import { logger } from './logger';
import { buildServer } from './app';
import { prisma } from './db';

const { app } = await buildServer();
await app.listen({ port: config.port, host: config.host });
logger.info({ port: config.port }, 'BAIRRO.PT a correr');

for (const sig of ['SIGINT', 'SIGTERM'] as const) {
  process.on(sig, async () => {
    logger.info({ sig }, 'a encerrar');
    await app.close();
    await prisma.$disconnect();
    process.exit(0);
  });
}
