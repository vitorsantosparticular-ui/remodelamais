/**
 * Regras da cidade, todas no servidor. O tempo passa "sozinho": chegadas, fim de turnos e rendas
 * são resolvidos por `settle()` sempre que o jogador age ou pede o estado (e pela tarefa periódica
 * para as rendas de quem está offline). Todas as atualizações são condicionais para aguentar pedidos em paralelo.
 */
import type { Prisma, User } from '@prisma/client';
import {
  BAIRRO_BY_ID, JOB_BY_ID, MAX_SHIFTS_PER_DAY, PROPERTY_RESALE, PROPERTY_TYPES, RENT_PERIOD_DAYS, TRANSPORTS,
  VEHICLE_BY_ID, VEHICLE_RESALE, lisbonDay, tripQuote, fmtEuros,
  type CityState, type PlaceId, type PropertyListing, type PropertyType, type TransportMode,
} from '@bairro/shared';
import { prisma } from '../../db';
import { logger } from '../../logger';
import { GameError, InsufficientFunds, moveMoney } from '../economy/money';

const MAX_PROPERTIES = 3;
const MAX_VEHICLES = 3;
const MAX_TRANSFER = 50_000; // 500 € por transferência
const DAY_MS = 86_400_000;

export interface CityHooks {
  /** Tirar o jogador do quarto onde está (ao partir de viagem). */
  leaveRoom(userId: string): void;
  /** Avisar o jogador de que o estado mudou (transferência, despejo...). */
  notify(userId: string, reason: string): void;
}
let hooks: CityHooks = { leaveRoom: () => undefined, notify: () => undefined };
export const setCityHooks = (h: CityHooks) => { hooks = h; };

// ------------------------------------------------------------------ resolução do tempo
export async function settle(userId: string): Promise<User> {
  const now = new Date();
  let u = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  if (u.arrivesAt && u.travelTo && u.arrivesAt <= now) {
    await prisma.user.updateMany({
      where: { id: userId, arrivesAt: u.arrivesAt },
      data: { location: u.travelTo, travelTo: null, travelFrom: null, travelMode: null, travelStart: null, arrivesAt: null },
    });
  }
  if (u.workUntil && u.workJob && u.workUntil <= now) {
    const job = JOB_BY_ID.get(u.workJob);
    const until = u.workUntil;
    await prisma.$transaction(async tx => {
      const r = await tx.user.updateMany({ where: { id: userId, workUntil: until }, data: { workJob: null, workStart: null, workUntil: null } });
      if (r.count === 1 && job) await moveMoney(tx, userId, 'WALLET', job.pay, 'salario', job.name);
    });
  }
  await chargeDueRent({ tenantId: userId });
  u = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  return u;
}

/** Cobra rendas vencidas por débito direto no banco; sem saldo → despejo. */
export async function chargeDueRent(where: Prisma.PropertyWhereInput = {}) {
  const due = await prisma.property.findMany({ where: { ...where, tenantId: { not: null }, rentPaidUntil: { lte: new Date() } } });
  for (const p of due) {
    const tenantId = p.tenantId!, paidUntil = p.rentPaidUntil!;
    try {
      await prisma.$transaction(async tx => {
        const r = await tx.property.updateMany({
          where: { id: p.id, tenantId, rentPaidUntil: paidUntil },
          data: { rentPaidUntil: new Date(paidUntil.getTime() + RENT_PERIOD_DAYS * DAY_MS) },
        });
        if (r.count !== 1) return;
        await moveMoney(tx, tenantId, 'BANK', -p.rentWeek, 'renda', `Renda: ${p.address}`, p.id);
        await tx.propertyHistory.create({ data: { propertyId: p.id, userId: tenantId, action: 'RENT_PAID', amount: p.rentWeek } });
      });
    } catch (e) {
      if (!(e instanceof InsufficientFunds)) { logger.error({ err: e, propertyId: p.id }, 'erro a cobrar renda'); continue; }
      await prisma.$transaction(async tx => {
        const r = await tx.property.updateMany({ where: { id: p.id, tenantId, rentPaidUntil: paidUntil }, data: { tenantId: null, rentPaidUntil: null } });
        if (r.count !== 1) return;
        if (p.roomId) await tx.room.update({ where: { id: p.roomId }, data: { ownerId: null, access: 'OWNER_ONLY' } });
        await tx.propertyHistory.create({ data: { propertyId: p.id, userId: tenantId, action: 'EVICT' } });
      });
      hooks.leaveRoom(tenantId);
      hooks.notify(tenantId, `Despejo: não havia saldo no banco para pagar a renda de ${p.address}.`);
    }
  }
}

/** Onde o jogador está agora (sem gravar): durante a viagem devolve null. */
export function effectiveLocation(u: Pick<User, 'location' | 'travelTo' | 'arrivesAt'>, now = new Date()) {
  if (u.travelTo && u.arrivesAt) return u.arrivesAt <= now ? u.travelTo : null;
  return u.location;
}

export async function cityState(userId: string): Promise<CityState> {
  const u = await settle(userId);
  const [vehicles, props] = await Promise.all([
    prisma.vehicle.findMany({ where: { ownerId: userId }, orderBy: { createdAt: 'asc' } }),
    prisma.property.findMany({ where: { OR: [{ ownerId: userId }, { tenantId: userId }] }, orderBy: { updatedAt: 'asc' } }),
  ]);
  const today = lisbonDay();
  return {
    wallet: u.walletCents, bank: u.bankCents, diamonds: u.diamonds, location: u.location,
    travel: u.travelTo && u.arrivesAt && u.travelFrom && u.travelStart
      ? { from: u.travelFrom, to: u.travelTo, mode: u.travelMode as TransportMode, startedAt: u.travelStart.getTime(), arrivesAt: u.arrivesAt.getTime() } : null,
    work: u.workJob && u.workUntil && u.workStart ? { jobId: u.workJob, until: u.workUntil.getTime(), startedAt: u.workStart.getTime() } : null,
    shiftsToday: u.shiftsDay === today ? u.shiftsCount : 0,
    vehicles: vehicles.map(v => ({ id: v.id, model: v.model })),
    properties: props.map(p => ({
      id: p.id, address: p.address, bairro: p.bairro, type: p.type as PropertyType, relation: p.ownerId === userId ? 'owner' : 'tenant',
      rentWeek: p.rentWeek, rentPaidUntil: p.rentPaidUntil?.getTime() ?? null, roomId: p.roomId,
    })),
    homeRoomId: props.find(p => p.roomId)?.roomId ?? u.homeRoomId,
  };
}

function requireIdle(u: User) {
  if (u.travelTo) throw new GameError('Ainda estás em viagem.');
  if (u.workJob) throw new GameError('Estás a meio de um turno. Espera que acabe.');
}
function requirePlace(u: User, place: PlaceId) {
  const b = BAIRRO_BY_ID.get(u.location);
  if (!b?.places.includes(place)) {
    const where = [...BAIRRO_BY_ID.values()].filter(x => x.places.includes(place)).map(x => x.name).join(', ');
    throw new GameError(`Para isto tens de ir a: ${where}.`);
  }
}

// ------------------------------------------------------------------ viajar
export async function travel(userId: string, to: string, mode: TransportMode) {
  const u = await settle(userId);
  requireIdle(u);
  if (!BAIRRO_BY_ID.has(to)) throw new GameError('Esse bairro não existe.');
  if (to === u.location) throw new GameError('Já estás aqui.');
  if (!TRANSPORTS[mode]) throw new GameError('Transporte inválido.');
  let vehicleSpeed: number | undefined;
  if (mode === 'carro') {
    const vs = await prisma.vehicle.findMany({ where: { ownerId: userId } });
    if (!vs.length) throw new GameError('Não tens veículo. Passa pelo stand nas Avenidas Novas.');
    vehicleSpeed = Math.min(...vs.map(v => VEHICLE_BY_ID.get(v.model)?.secPerUnit ?? 1));
  }
  const q = tripQuote(u.location, to, mode, vehicleSpeed);
  const now = new Date();
  await prisma.$transaction(async tx => {
    const r = await tx.user.updateMany({
      where: { id: userId, travelTo: null, workJob: null, location: u.location },
      data: { travelFrom: u.location, travelTo: to, travelMode: mode, travelStart: now, arrivesAt: new Date(now.getTime() + q.seconds * 1000) },
    });
    if (r.count !== 1) throw new GameError('Não foi possível partir agora.', 409);
    if (q.cost > 0) await moveMoney(tx, userId, 'WALLET', -q.cost, 'transporte', `${TRANSPORTS[mode].name} até ${BAIRRO_BY_ID.get(to)!.name}`);
  });
  hooks.leaveRoom(userId);
  return q;
}

// ------------------------------------------------------------------ biscates
export async function startJob(userId: string, jobId: string) {
  const job = JOB_BY_ID.get(jobId);
  if (!job) throw new GameError('Esse trabalho não existe.');
  const u = await settle(userId);
  requireIdle(u);
  if (u.location !== job.bairro) throw new GameError(`Este trabalho é em ${BAIRRO_BY_ID.get(job.bairro)!.name}.`);
  const today = lisbonDay();
  const count = u.shiftsDay === today ? u.shiftsCount : 0;
  if (count >= MAX_SHIFTS_PER_DAY) throw new GameError(`Já fizeste ${MAX_SHIFTS_PER_DAY} turnos hoje. Descansa e volta amanhã!`);
  const now = new Date();
  const r = await prisma.user.updateMany({
    where: { id: userId, workJob: null, travelTo: null },
    data: { workJob: job.id, workStart: now, workUntil: new Date(now.getTime() + job.seconds * 1000), shiftsDay: today, shiftsCount: count + 1 },
  });
  if (r.count !== 1) throw new GameError('Não foi possível começar o turno.', 409);
}

// ------------------------------------------------------------------ banco
export async function deposit(userId: string, amount: number) {
  const u = await settle(userId); requireIdle(u); requirePlace(u, 'banco');
  await prisma.$transaction(async tx => {
    await moveMoney(tx, userId, 'WALLET', -amount, 'deposito', 'Depósito ao balcão');
    await moveMoney(tx, userId, 'BANK', amount, 'deposito', 'Depósito ao balcão');
  });
}

export async function withdraw(userId: string, amount: number) {
  const u = await settle(userId); requireIdle(u); requirePlace(u, 'multibanco');
  if (amount > 40_000) throw new GameError('O Multibanco só deixa levantar até 400 € de cada vez.');
  await prisma.$transaction(async tx => {
    await moveMoney(tx, userId, 'BANK', -amount, 'levantamento', 'Levantamento Multibanco');
    await moveMoney(tx, userId, 'WALLET', amount, 'levantamento', 'Levantamento Multibanco');
  });
}

export async function transfer(userId: string, toUsername: string, amount: number) {
  const u = await settle(userId); requireIdle(u); requirePlace(u, 'multibanco');
  if (amount > MAX_TRANSFER) throw new GameError(`Máximo de ${fmtEuros(MAX_TRANSFER)} por transferência.`);
  const to = await prisma.user.findUnique({ where: { usernameLower: String(toUsername).toLowerCase() } });
  if (!to || to.status !== 'ACTIVE') throw new GameError('Não existe nenhum jogador com esse nome.');
  if (to.id === userId) throw new GameError('Não podes transferir para ti próprio.');
  await prisma.$transaction(async tx => {
    const ref = `tr_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    await moveMoney(tx, userId, 'BANK', -amount, 'transferencia', `Para ${to.username}`, ref);
    await moveMoney(tx, to.id, 'BANK', amount, 'transferencia', `De ${u.username}`, ref);
  });
  hooks.notify(to.id, `Recebeste uma transferência de ${fmtEuros(amount)} de ${u.username}.`);
}

export async function statement(userId: string) {
  return prisma.ledgerEntry.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: 40 });
}

// ------------------------------------------------------------------ casas
export async function listProperties(userId: string): Promise<PropertyListing[]> {
  const rows = await prisma.property.findMany({
    orderBy: [{ bairro: 'asc' }, { price: 'asc' }],
    include: { owner: { select: { username: true } }, tenant: { select: { username: true } } },
  });
  return rows.map(p => ({
    id: p.id, bairro: p.bairro, address: p.address, type: p.type as PropertyType, price: p.price, rentWeek: p.rentWeek,
    status: p.ownerId ? 'vendida' : p.tenantId ? 'arrendada' : 'livre',
    occupant: p.owner?.username ?? p.tenant?.username ?? null,
    mine: p.ownerId === userId || p.tenantId === userId,
  }));
}

async function ensurePropertyRoom(tx: Prisma.TransactionClient, propertyId: string, userId: string) {
  const p = await tx.property.findUniqueOrThrow({ where: { id: propertyId } });
  if (p.roomId) {
    await tx.room.update({ where: { id: p.roomId }, data: { ownerId: userId, access: 'OPEN' } });
    return p.roomId;
  }
  const t = PROPERTY_TYPES[p.type as PropertyType] ?? PROPERTY_TYPES.t0;
  const room = await tx.room.create({
    data: {
      name: `${t.name} — ${p.address}`, description: `${t.name} em ${BAIRRO_BY_ID.get(p.bairro)?.name ?? p.bairro}.`,
      ownerId: userId, category: 'casas', bairro: p.bairro, width: t.size, height: t.size, floor: t.floor, wall: t.wall,
      doorX: 0, doorY: Math.floor(t.size / 2),
    },
  });
  // Peças fixas da casa (pertencem à casa, não ao jogador).
  await tx.furnitureItem.createMany({
    data: [
      { definitionId: 'cama', roomId: room.id, x: t.size - 2, y: 1, rotation: 0 },
      { definitionId: 'sofa', roomId: room.id, x: 2, y: 1, rotation: 4 },
      { definitionId: 'planta', roomId: room.id, x: t.size - 1, y: t.size - 1, rotation: 0 },
    ],
  });
  await tx.property.update({ where: { id: p.id }, data: { roomId: room.id } });
  return room.id;
}

async function propertyCount(userId: string) {
  return prisma.property.count({ where: { OR: [{ ownerId: userId }, { tenantId: userId }] } });
}

export async function buyProperty(userId: string, propertyId: string) {
  const u = await settle(userId); requireIdle(u); requirePlace(u, 'imobiliaria');
  if ((await propertyCount(userId)) >= MAX_PROPERTIES) throw new GameError(`Só podes ter ${MAX_PROPERTIES} casas.`);
  const p = await prisma.property.findUnique({ where: { id: propertyId } });
  if (!p) throw new GameError('Essa casa não existe.');
  await prisma.$transaction(async tx => {
    const r = await tx.property.updateMany({ where: { id: p.id, ownerId: null, tenantId: null }, data: { ownerId: userId } });
    if (r.count !== 1) throw new GameError('Alguém já ficou com esta casa.', 409);
    await moveMoney(tx, userId, 'BANK', -p.price, 'compra_casa', `Compra: ${p.address}`, p.id);
    await tx.propertyHistory.create({ data: { propertyId: p.id, userId, action: 'BUY', amount: p.price } });
    await ensurePropertyRoom(tx, p.id, userId);
  });
}

export async function rentProperty(userId: string, propertyId: string) {
  const u = await settle(userId); requireIdle(u); requirePlace(u, 'imobiliaria');
  if ((await propertyCount(userId)) >= MAX_PROPERTIES) throw new GameError(`Só podes ter ${MAX_PROPERTIES} casas.`);
  const p = await prisma.property.findUnique({ where: { id: propertyId } });
  if (!p) throw new GameError('Essa casa não existe.');
  await prisma.$transaction(async tx => {
    const r = await tx.property.updateMany({
      where: { id: p.id, ownerId: null, tenantId: null },
      data: { tenantId: userId, rentPaidUntil: new Date(Date.now() + RENT_PERIOD_DAYS * DAY_MS) },
    });
    if (r.count !== 1) throw new GameError('Alguém já ficou com esta casa.', 409);
    await moveMoney(tx, userId, 'BANK', -p.rentWeek, 'renda', `1.ª renda: ${p.address}`, p.id);
    await tx.propertyHistory.create({ data: { propertyId: p.id, userId, action: 'RENT', amount: p.rentWeek } });
    await ensurePropertyRoom(tx, p.id, userId);
  });
}

/** Deixar uma casa arrendada ou vender uma casa comprada (à cidade, por 70 %). */
export async function releaseProperty(userId: string, propertyId: string) {
  const u = await settle(userId); requireIdle(u); requirePlace(u, 'imobiliaria');
  const p = await prisma.property.findUnique({ where: { id: propertyId } });
  if (!p || (p.ownerId !== userId && p.tenantId !== userId)) throw new GameError('Essa casa não é tua.');
  const selling = p.ownerId === userId;
  const value = Math.round(p.price * PROPERTY_RESALE);
  await prisma.$transaction(async tx => {
    const r = await tx.property.updateMany({
      where: selling ? { id: p.id, ownerId: userId } : { id: p.id, tenantId: userId },
      data: selling ? { ownerId: null } : { tenantId: null, rentPaidUntil: null },
    });
    if (r.count !== 1) throw new GameError('Não foi possível.', 409);
    if (p.roomId) await tx.room.update({ where: { id: p.roomId }, data: { ownerId: null, access: 'OWNER_ONLY' } });
    if (selling) await moveMoney(tx, userId, 'BANK', value, 'venda_casa', `Venda: ${p.address}`, p.id);
    await tx.propertyHistory.create({ data: { propertyId: p.id, userId, action: selling ? 'SELL' : 'LEAVE', amount: selling ? value : 0 } });
  });
  hooks.leaveRoom(userId);
  return { sold: selling, value };
}

// ------------------------------------------------------------------ veículos
export async function buyVehicle(userId: string, modelId: string) {
  const m = VEHICLE_BY_ID.get(modelId);
  if (!m) throw new GameError('Esse modelo não existe.');
  const u = await settle(userId); requireIdle(u); requirePlace(u, 'stand');
  if ((await prisma.vehicle.count({ where: { ownerId: userId } })) >= MAX_VEHICLES) throw new GameError(`Só podes ter ${MAX_VEHICLES} veículos.`);
  await prisma.$transaction(async tx => {
    const v = await tx.vehicle.create({ data: { model: m.id, ownerId: userId, purchasePrice: m.price } });
    await moveMoney(tx, userId, 'BANK', -m.price, 'compra_veiculo', m.name, v.id);
  });
}

export async function sellVehicle(userId: string, vehicleId: string) {
  const u = await settle(userId); requireIdle(u); requirePlace(u, 'stand');
  const v = await prisma.vehicle.findUnique({ where: { id: vehicleId } });
  if (!v || v.ownerId !== userId) throw new GameError('Esse veículo não é teu.');
  const value = Math.round(v.purchasePrice * VEHICLE_RESALE);
  await prisma.$transaction(async tx => {
    const r = await tx.vehicle.deleteMany({ where: { id: v.id, ownerId: userId } });
    if (r.count !== 1) throw new GameError('Não foi possível.', 409);
    await moveMoney(tx, userId, 'BANK', value, 'venda_veiculo', VEHICLE_BY_ID.get(v.model)?.name ?? v.model, v.id);
  });
  return value;
}
