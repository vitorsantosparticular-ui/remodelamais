import { CHAT_RETENTION_DAYS, type ChatMessageDTO } from '@bairro/shared';
import { prisma } from '../../db';
import { logger } from '../../logger';

export async function saveMessage(roomId: string, userId: string, username: string, text: string, flagged: boolean): Promise<ChatMessageDTO> {
  const m = await prisma.chatMessage.create({ data: { roomId, userId, text, flagged } });
  return { id: m.id, userId, username, text, ts: m.createdAt.getTime() };
}

/** Últimas mensagens do quarto (histórico mostrado ao entrar), dentro do prazo de retenção. */
export async function recentMessages(roomId: string, take = 20): Promise<ChatMessageDTO[]> {
  const since = new Date(Date.now() - CHAT_RETENTION_DAYS * 86400_000);
  const rows = await prisma.chatMessage.findMany({
    where: { roomId, createdAt: { gte: since } }, orderBy: { createdAt: 'desc' }, take,
    include: { user: { select: { username: true } } },
  });
  return rows.reverse().map(m => ({ id: m.id, userId: m.userId, username: m.user.username, text: m.text, ts: m.createdAt.getTime() }));
}

/** Política de retenção: apaga mensagens mais antigas que CHAT_RETENTION_DAYS. */
export async function purgeOldMessages() {
  const before = new Date(Date.now() - CHAT_RETENTION_DAYS * 86400_000);
  const { count } = await prisma.chatMessage.deleteMany({ where: { createdAt: { lt: before } } });
  if (count) logger.info({ count }, 'mensagens antigas apagadas (retenção)');
}
