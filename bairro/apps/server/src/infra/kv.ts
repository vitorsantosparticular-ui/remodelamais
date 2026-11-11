import { Redis } from 'ioredis';
import { config } from '../config';
import { logger } from '../logger';

/**
 * Armazenamento rápido para limites de taxa e presença.
 * Com REDIS_URL usa Redis (partilhado entre instâncias); sem ele usa memória (1 instância só).
 */
export interface KV {
  /** Devolve true se a ação é permitida (janela fixa). */
  rateLimit(key: string, max: number, windowMs: number): Promise<boolean>;
  setOnline(userId: string, online: boolean): Promise<void>;
  isOnline(userId: string): Promise<boolean>;
  onlineCount(): Promise<number>;
  close(): Promise<void>;
}

class MemoryKV implements KV {
  private hits = new Map<string, { n: number; until: number }>();
  private online = new Set<string>();
  async rateLimit(key: string, max: number, windowMs: number) {
    const now = Date.now();
    const h = this.hits.get(key);
    if (!h || h.until < now) { this.hits.set(key, { n: 1, until: now + windowMs }); return true; }
    h.n++;
    return h.n <= max;
  }
  async setOnline(id: string, on: boolean) { if (on) this.online.add(id); else this.online.delete(id); }
  async isOnline(id: string) { return this.online.has(id); }
  async onlineCount() { return this.online.size; }
  async close() { /* nada a fechar */ }
}

class RedisKV implements KV {
  private closed = false;
  constructor(private r: Redis) {}
  async rateLimit(key: string, max: number, windowMs: number) {
    if (this.closed) return false;
    const k = `rl:${key}`;
    const n = await this.r.incr(k);
    if (n === 1) await this.r.pexpire(k, windowMs);
    return n <= max;
  }
  async setOnline(id: string, on: boolean) {
    if (this.closed) return;
    if (on) await this.r.sadd('online', id); else await this.r.srem('online', id);
  }
  async isOnline(id: string) { return !this.closed && (await this.r.sismember('online', id)) === 1; }
  async onlineCount() { return this.closed ? 0 : this.r.scard('online'); }
  async close() { this.closed = true; await this.r.quit(); }
}

export const createMemoryKV = (): KV => new MemoryKV();

export async function createKV(): Promise<KV> {
  if (!config.redisUrl) { logger.warn('REDIS_URL não definido: a usar memória local'); return new MemoryKV(); }
  const r = new Redis(config.redisUrl, { lazyConnect: true, maxRetriesPerRequest: 2 });
  await r.connect();
  // Presença é reconstruída no arranque. Com várias instâncias isto passa a ser por instância (fase 6).
  await r.del('online');
  logger.info('Redis ligado');
  return new RedisKV(r);
}
