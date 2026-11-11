import { randomBytes, scrypt as scryptCb, timingSafeEqual, createHash } from 'node:crypto';

const PARAMS = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };

function scrypt(pw: string, salt: Buffer, len: number, n: number): Promise<Buffer> {
  return new Promise((res, rej) => scryptCb(pw, salt, len, { ...PARAMS, N: n }, (e, k) => (e ? rej(e) : res(k))));
}

/** Hash de palavra-passe com scrypt (node:crypto, sem dependências nativas). */
export async function hashPassword(pw: string): Promise<string> {
  const salt = randomBytes(16);
  const h = await scrypt(pw, salt, 64, PARAMS.N);
  return ['scrypt', PARAMS.N, salt.toString('base64'), h.toString('base64')].join('$');
}

export async function verifyPassword(pw: string, stored: string): Promise<boolean> {
  const [alg, n, s, h] = stored.split('$');
  if (alg !== 'scrypt' || !s || !h) return false;
  const expected = Buffer.from(h, 'base64');
  const got = await scrypt(pw, Buffer.from(s, 'base64'), expected.length, Number(n));
  return got.length === expected.length && timingSafeEqual(got, expected);
}

export const newToken = () => randomBytes(32).toString('base64url');
export const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');
