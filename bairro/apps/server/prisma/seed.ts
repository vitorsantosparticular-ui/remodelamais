/**
 * Seed idempotente: catálogo de mobília + espaços públicos iniciais.
 * Pode correr várias vezes; os espaços públicos são repostos com a mobília definida aqui.
 */
import { PrismaClient } from '@prisma/client';
import { FURNITURE, PUBLIC_ROOMS, PROPERTIES } from '@bairro/shared';

const prisma = new PrismaClient();

async function main() {
  for (const f of FURNITURE) {
    const { id, ...data } = f;
    await prisma.furnitureDefinition.upsert({ where: { id }, create: f, update: data });
  }
  for (const r of PUBLIC_ROOMS) {
    const { items, id, ...data } = r;
    await prisma.room.upsert({ where: { id }, create: { id, ...data, isPublic: true, access: 'OPEN' }, update: { ...data, isPublic: true } });
    await prisma.furnitureItem.deleteMany({ where: { roomId: id, ownerId: null } });
    await prisma.furnitureItem.createMany({
      data: items.map(([definitionId, x, y, rotation = 0]) => ({ definitionId, roomId: id, x, y, z: 0, rotation })),
    });
  }
  // Quartos em casa dos pais (contas antigas) ficam em Campo de Ourique.
  await prisma.room.updateMany({ where: { homeOf: { isNot: null }, bairro: null }, data: { bairro: 'campo-ourique' } });

  // Casas: cada uma é única. Só cria as que faltam (não mexe em donos/inquilinos existentes).
  for (const [id, bairro, address, type, price, rentWeek] of PROPERTIES) {
    await prisma.property.upsert({ where: { id }, create: { id, bairro, address, type, price, rentWeek }, update: { bairro, address, type, price, rentWeek } });
  }
  console.log(`Seed: ${PROPERTIES.length} casas.`);
  console.log(`Seed: ${FURNITURE.length} móveis, ${PUBLIC_ROOMS.length} espaços públicos.`);
}

main().finally(() => prisma.$disconnect());
