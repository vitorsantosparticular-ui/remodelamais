import { prisma } from '../../db';
import { config } from '../../config';
import { newToken, sha256 } from './passwords';

export const SESSION_COOKIE = 'bairro_sid';

export async function createSession(userId: string) {
  const token = newToken();
  const expiresAt = new Date(Date.now() + config.sessionDays * 86400_000);
  await prisma.session.create({ data: { userId, tokenHash: sha256(token), expiresAt } });
  return { token, expiresAt };
}

/** Devolve o utilizador ATIVO dono do token, ou null. */
export async function userFromToken(token: string | undefined) {
  if (!token) return null;
  const s = await prisma.session.findUnique({ where: { tokenHash: sha256(token) }, include: { user: true } });
  if (!s || s.expiresAt < new Date() || s.user.status !== 'ACTIVE') return null;
  return s.user;
}

export async function destroySession(token: string | undefined) {
  if (token) await prisma.session.deleteMany({ where: { tokenHash: sha256(token) } });
}

export function parseCookies(header: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of (header ?? '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0) {
      try { out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim()); } catch { /* cookie inválido */ }
    }
  }
  return out;
}
