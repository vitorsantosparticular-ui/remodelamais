import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createKV } from '../src/infra/kv';

test('Redis: limite de taxa e presença', { skip: !process.env.REDIS_URL }, async () => {
  const kv = await createKV();
  const key = `teste:${Math.random()}`;
  const r = [];
  for (let i = 0; i < 4; i++) r.push(await kv.rateLimit(key, 3, 5000));
  assert.deepEqual(r, [true, true, true, false]);
  await kv.setOnline('u1', true);
  assert.equal(await kv.isOnline('u1'), true);
  await kv.setOnline('u1', false);
  assert.equal(await kv.isOnline('u1'), false);
  await kv.close();
});
