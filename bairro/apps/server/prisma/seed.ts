/**
 * Seed idempotente: catálogo de mobília + espaços públicos iniciais.
 * Pode correr várias vezes; os espaços públicos são repostos com a mobília definida aqui.
 */
import { PrismaClient } from '@prisma/client';
import { FURNITURE } from '@bairro/shared';

const prisma = new PrismaClient();

type Item = [defId: string, x: number, y: number, rotation?: number];
interface PublicRoom {
  id: string; name: string; description: string; category: string; sortOrder: number;
  width: number; height: number; floor: string; wall: string; doorX: number; doorY: number; maxUsers: number; items: Item[];
}

const PUBLIC_ROOMS: PublicRoom[] = [
  {
    id: 'praca-central', name: 'Praça Central', description: 'O coração do bairro. Ponto de encontro, chafariz e jacarandás.',
    category: 'publico', sortOrder: 1, width: 16, height: 16, floor: 'calcada', wall: 'nenhuma', doorX: 0, doorY: 8, maxUsers: 50,
    items: [
      ['chafariz', 7, 7], ['jacaranda', 2, 2], ['jacaranda', 13, 2], ['jacaranda', 2, 13], ['jacaranda', 13, 13],
      ['banco_jardim', 6, 4, 4], ['banco_jardim', 6, 11, 0], ['banco_jardim', 11, 7, 6], ['banco_jardim', 3, 7, 2],
      ['candeeiro_rua', 4, 4], ['candeeiro_rua', 11, 4], ['candeeiro_rua', 4, 11], ['candeeiro_rua', 11, 11],
      ['planta', 9, 1], ['planta', 1, 9],
    ],
  },
  {
    id: 'cafe-portugues', name: 'Café Português', description: 'Uma bica, um pastel de nata e dois dedos de conversa.',
    category: 'publico', sortOrder: 2, width: 10, height: 9, floor: 'azulejo', wall: 'azulejo', doorX: 0, doorY: 6, maxUsers: 30,
    items: [
      ['balcao', 8, 1, 0], ['maquina_cafe', 9, 4], ['maquina_cafe', 9, 0],
      ['mesa_cafe', 3, 2], ['cadeira_cafe', 2, 2, 2], ['cadeira_cafe', 4, 2, 6],
      ['mesa_cafe', 3, 5], ['cadeira_cafe', 2, 5, 2], ['cadeira_cafe', 4, 5, 6], ['cadeira_cafe', 3, 6, 0],
      ['mesa_cafe', 6, 6], ['cadeira_cafe', 5, 6, 2], ['cadeira_cafe', 7, 6, 6],
      ['sofa', 1, 0, 4], ['planta', 0, 0], ['planta', 9, 8], ['galo_barcelos', 6, 0],
    ],
  },
];

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
  console.log(`Seed: ${FURNITURE.length} móveis, ${PUBLIC_ROOMS.length} espaços públicos.`);
}

main().finally(() => prisma.$disconnect());
