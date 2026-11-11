import type { Prisma, MoneyAccount } from '@prisma/client';

export class InsufficientFunds extends Error {
  constructor(public account: MoneyAccount) {
    super(account === 'WALLET' ? 'Não tens dinheiro suficiente na carteira.' : 'Não tens saldo suficiente no banco.');
  }
}

/** Erro de jogo com mensagem para o jogador (HTTP 400/409). */
export class GameError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}

/**
 * ÚNICA forma de mexer em dinheiro. Tem de correr dentro de uma transação.
 * A atualização é condicional (o saldo nunca fica negativo, mesmo com pedidos em simultâneo)
 * e cada movimento fica no livro-razão com o saldo resultante.
 */
export async function moveMoney(
  tx: Prisma.TransactionClient, userId: string, account: MoneyAccount, amount: number,
  kind: string, memo = '', refId?: string,
) {
  if (!Number.isInteger(amount) || amount === 0) throw new GameError('Montante inválido.');
  const field = account === 'WALLET' ? 'walletCents' : 'bankCents';
  const where: Prisma.UserWhereInput = { id: userId };
  if (amount < 0) where[field] = { gte: -amount };
  const r = await tx.user.updateMany({ where, data: { [field]: { increment: amount } } });
  if (r.count !== 1) throw new InsufficientFunds(account);
  const u = await tx.user.findUniqueOrThrow({ where: { id: userId }, select: { walletCents: true, bankCents: true } });
  const balanceAfter = account === 'WALLET' ? u.walletCents : u.bankCents;
  await tx.ledgerEntry.create({ data: { userId, account, amount, balanceAfter, kind, memo, refId } });
  return balanceAfter;
}

/** Converte "12,50" / 12.5 / "12" em cêntimos (inteiro positivo). */
export function parseEuros(v: unknown): number {
  const n = typeof v === 'number' ? v : Number(String(v ?? '').replace(/\s/g, '').replace(',', '.'));
  const c = Math.round(n * 100);
  if (!Number.isFinite(c) || c <= 0 || c > 100_000_000) throw new GameError('Indica um montante válido.');
  return c;
}
