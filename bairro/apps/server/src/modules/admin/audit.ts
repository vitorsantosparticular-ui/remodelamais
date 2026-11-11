import type { Prisma } from '@prisma/client';
import { prisma } from '../../db';
import { logger } from '../../logger';

/** Registo de auditoria (ações de conta agora; ações de administração na fase 6). */
export async function audit(actorId: string | null, action: string, data: Prisma.InputJsonValue | null, ip?: string) {
  try {
    await prisma.auditLog.create({ data: { actorId, action, data: data ?? undefined, ip } });
  } catch (e) {
    logger.error({ err: e, action }, 'falha no registo de auditoria');
  }
}
