/**
 * Testes da camada "vida na cidade": viagens, biscates, banco, casas, despejo, stand e corridas
 * (pedidos em simultâneo). O tempo é avançado mexendo nas datas na BD (arrivesAt / workUntil).
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import type { CityState } from '@bairro/shared';
import { buildServer } from '../src/app';
import { createMemoryKV } from '../src/infra/kv';
import { prisma } from '../src/db';

let base = '';
let close: () => Promise<void>;
const sfx = Math.random().toString(36).slice(2, 7);
const A = `cid_a_${sfx}`, B = `cid_b_${sfx}`;
const cookies: Record<string, string> = {};

before(async () => {
  const { app } = await buildServer({ kv: createMemoryKV() });
  await app.listen({ port: 0, host: '127.0.0.1' });
  base = `http://127.0.0.1:${(app.server.address() as AddressInfo).port}`;
  close = () => app.close();
  for (const n of [A, B]) {
    const r = await fetch(base + '/api/auth/register', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username: n, password: 'palavra-passe-1', birthYear: 1990, acceptTerms: true }),
    });
    assert.equal(r.status, 200);
    cookies[n] = (r.headers.get('set-cookie') ?? '').split(';')[0];
  }
});
after(async () => {
  const ids = (await prisma.user.findMany({ where: { username: { in: [A, B] } } })).map(u => u.id);
  await prisma.property.updateMany({ where: { OR: [{ ownerId: { in: ids } }, { tenantId: { in: ids } }] }, data: { ownerId: null, tenantId: null, rentPaidUntil: null } });
  await prisma.user.deleteMany({ where: { id: { in: ids } } });
  await close();
  await prisma.$disconnect();
});

async function call(who: string, method: string, path: string, body?: unknown) {
  const r = await fetch(base + path, {
    method, headers: { cookie: cookies[who], ...(body ? { 'content-type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: r.status, json: await r.json() as { error?: string; state?: CityState } & Record<string, unknown> };
}
const state = async (who: string) => (await call(who, 'GET', '/api/city/state')).json as unknown as CityState;
const user = (n: string) => prisma.user.findUniqueOrThrow({ where: { username: n } });
/** "Avança o relógio": a viagem/turno em curso termina já. */
const finishTravel = async (n: string) => prisma.user.update({ where: { username: n }, data: { arrivesAt: new Date(Date.now() - 1000) } });
const finishWork = async (n: string) => prisma.user.update({ where: { username: n }, data: { workUntil: new Date(Date.now() - 1000) } });
async function goTo(n: string, bairro: string) {
  const r = await call(n, 'POST', '/api/city/travel', { to: bairro, mode: 'pe' });
  assert.equal(r.status, 200, r.json.error);
  await finishTravel(n);
  assert.equal((await state(n)).location, bairro);
}

test('estado inicial: 150 € na carteira, em casa dos pais em Campo de Ourique', async () => {
  const s = await state(A);
  assert.equal(s.wallet, 15000);
  assert.equal(s.bank, 0);
  assert.equal(s.location, 'campo-ourique');
  assert.ok(s.homeRoomId);
});

test('viagem de metro: cobra o bilhete, bloqueia ações durante a viagem e chega ao destino', async () => {
  const r = await call(A, 'POST', '/api/city/travel', { to: 'baixa', mode: 'metro' });
  assert.equal(r.status, 200);
  assert.equal(r.json.state!.wallet, 15000 - 185);
  assert.equal(r.json.state!.travel!.to, 'baixa');
  assert.equal((await call(A, 'POST', '/api/city/travel', { to: 'alfama', mode: 'pe' })).status, 400, 'não se parte a meio de uma viagem');
  assert.equal((await call(A, 'POST', '/api/jobs/start', { id: 'panfletos' })).status, 400, 'não se trabalha em viagem');
  await finishTravel(A);
  const s = await state(A);
  assert.equal(s.location, 'baixa');
  assert.equal(s.travel, null);
  assert.equal((await call(A, 'POST', '/api/city/travel', { to: 'avenidas', mode: 'carro' })).status, 400, 'sem veículo não há carro');
});

test('biscate: só no bairro certo; paga ao fim do turno com registo no livro-razão', async () => {
  assert.equal((await call(A, 'POST', '/api/jobs/start', { id: 'cafe' })).status, 400, 'o café é no Chiado');
  const r = await call(A, 'POST', '/api/jobs/start', { id: 'panfletos' });
  assert.equal(r.status, 200);
  assert.equal(r.json.state!.work!.jobId, 'panfletos');
  assert.equal((await call(A, 'POST', '/api/city/travel', { to: 'chiado', mode: 'pe' })).status, 400, 'não se sai a meio do turno');
  const before = (await state(A)).wallet;
  await finishWork(A);
  const s = await state(A);
  assert.equal(s.wallet, before + 900);
  assert.equal(s.work, null);
  assert.equal(s.shiftsToday, 1);
  const st = await call(A, 'GET', '/api/bank/statement');
  assert.ok((st.json as unknown as Array<{ kind: string; amount: number }>).some(e => e.kind === 'salario' && e.amount === 900));
});

test('banco: depósito ao balcão, levantamento e transferência entre jogadores', async () => {
  assert.equal((await call(A, 'POST', '/api/bank/deposit', { amount: '100,50' })).status, 200);
  let s = await state(A);
  assert.equal(s.bank, 10050);
  assert.equal((await call(A, 'POST', '/api/bank/deposit', { amount: 9999 })).status, 400, 'não deposita o que não tem');
  assert.equal((await call(A, 'POST', '/api/bank/deposit', { amount: -5 })).status, 400, 'montante negativo recusado');
  assert.equal((await call(A, 'POST', '/api/bank/withdraw', { amount: 20 })).status, 200);
  assert.equal((await call(A, 'POST', '/api/bank/transfer', { to: B, amount: 30 })).status, 200);
  s = await state(A);
  assert.equal(s.bank, 10050 - 2000 - 3000);
  assert.equal((await state(B)).bank, 3000);
  assert.equal((await call(B, 'POST', '/api/bank/deposit', { amount: 10 })).status, 400, 'B não está na Baixa: não há balcão');
});

test('corrida: dois levantamentos em simultâneo nunca deixam o saldo negativo', async () => {
  await prisma.user.update({ where: { username: A }, data: { bankCents: 10000 } });
  const rs = await Promise.all([1, 2, 3].map(() => call(A, 'POST', '/api/bank/withdraw', { amount: 40 })));
  const ok = rs.filter(r => r.status === 200).length;
  assert.equal(ok, 2, 'só há saldo para dois levantamentos de 40 €');
  assert.equal((await user(A)).bankCents, 2000);
});

test('casas: só na imobiliária; arrendar, casa única, quarto próprio e despejo por falta de saldo', async () => {
  assert.equal((await call(A, 'POST', '/api/properties/rent', { id: 'alf-1' })).status, 400, 'fora da imobiliária');
  await goTo(A, 'chiado');
  await goTo(B, 'chiado');
  await prisma.user.update({ where: { username: A }, data: { bankCents: 50000 } });
  await prisma.user.update({ where: { username: B }, data: { bankCents: 50000 } });
  // Os dois tentam a mesma casa ao mesmo tempo: só um fica com ela.
  const [ra, rb] = await Promise.all([call(A, 'POST', '/api/properties/rent', { id: 'alf-1' }), call(B, 'POST', '/api/properties/rent', { id: 'alf-1' })]);
  assert.deepEqual([ra.status, rb.status].sort(), [200, 409]);
  const winner = ra.status === 200 ? A : B, loser = winner === A ? B : A;
  const ws = await state(winner);
  assert.equal(ws.properties.length, 1);
  assert.equal(ws.properties[0].relation, 'tenant');
  assert.ok(ws.properties[0].roomId, 'a casa tem quarto próprio');
  assert.equal(ws.homeRoomId, ws.properties[0].roomId, 'a casa nova passa a ser a casa do jogador');
  assert.equal(ws.bank, 50000 - 11000);
  assert.equal((await state(loser)).bank, 50000, 'quem perdeu não pagou nada');
  const list = (await call(loser, 'GET', '/api/properties')).json as unknown as Array<{ id: string; status: string; occupant: string }>;
  assert.equal(list.find(p => p.id === 'alf-1')!.status, 'arrendada');

  // Semana seguinte sem saldo → despejo.
  await prisma.user.update({ where: { username: winner }, data: { bankCents: 100 } });
  await prisma.property.update({ where: { id: 'alf-1' }, data: { rentPaidUntil: new Date(Date.now() - 1000) } });
  const after = await state(winner);
  assert.equal(after.properties.length, 0, 'despejado');
  const hist = await prisma.propertyHistory.findMany({ where: { propertyId: 'alf-1' }, orderBy: { createdAt: 'asc' } });
  assert.deepEqual(hist.slice(-2).map(h => h.action), ['RENT', 'EVICT']);
});

test('renda paga automaticamente quando há saldo', async () => {
  await prisma.user.update({ where: { username: A }, data: { bankCents: 100000 } });
  assert.equal((await call(A, 'POST', '/api/properties/rent', { id: 'cs-1' })).status, 200);
  const paid1 = (await prisma.property.findUniqueOrThrow({ where: { id: 'cs-1' } })).rentPaidUntil!;
  await prisma.property.update({ where: { id: 'cs-1' }, data: { rentPaidUntil: new Date(Date.now() - 1000) } });
  const s = await state(A);
  assert.equal(s.properties.length, 1);
  assert.equal(s.bank, 100000 - 14000 - 14000);
  assert.ok(s.properties[0].rentPaidUntil! > Date.now(), 'pago até à semana seguinte');
  assert.ok(paid1);
  assert.equal((await call(A, 'POST', '/api/properties/release', { id: 'cs-1' })).status, 200);
});

test('stand: comprar veículo nas Avenidas e usá-lo para viajar', async () => {
  await prisma.user.update({ where: { username: A }, data: { bankCents: 200000 } });
  assert.equal((await call(A, 'POST', '/api/vehicles/buy', { id: 'mota125' })).status, 400, 'o stand é nas Avenidas');
  await goTo(A, 'avenidas');
  const r = await call(A, 'POST', '/api/vehicles/buy', { id: 'mota125' });
  assert.equal(r.status, 200);
  assert.equal(r.json.state!.vehicles.length, 1);
  assert.equal(r.json.state!.bank, 200000 - 120000);
  assert.equal((await call(A, 'POST', '/api/vehicles/buy', { id: 'descapotavel' })).status, 400, 'sem saldo');
  const t = await call(A, 'POST', '/api/city/travel', { to: 'belem', mode: 'carro' });
  assert.equal(t.status, 200);
  const travel = t.json.state!.travel!;
  assert.equal(travel.mode, 'carro');
});
