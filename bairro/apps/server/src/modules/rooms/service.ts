import type { Prisma, Room, User } from '@prisma/client';
import { FLOOR_TYPES, WALL_TYPES, START_BAIRRO, type RoomInfo, type RoomItemState, type FloorType, type WallType } from '@bairro/shared';
import { prisma } from '../../db';

type RoomWithOwner = Room & { owner: Pick<User, 'username'> | null };

export function toRoomInfo(r: RoomWithOwner): RoomInfo {
  return {
    id: r.id, name: r.name, description: r.description, ownerId: r.ownerId, ownerName: r.owner?.username ?? null,
    isPublic: r.isPublic, category: r.category, width: r.width, height: r.height,
    floor: (FLOOR_TYPES as readonly string[]).includes(r.floor) ? r.floor as FloorType : 'madeira',
    wall: (WALL_TYPES as readonly string[]).includes(r.wall) ? r.wall as WallType : 'branca',
    doorX: r.doorX, doorY: r.doorY, access: r.access, maxUsers: r.maxUsers,
  };
}

export async function loadRoom(roomId: string): Promise<{ info: RoomInfo; items: RoomItemState[] } | null> {
  const r = await prisma.room.findUnique({ where: { id: roomId }, include: { owner: { select: { username: true } }, items: true } });
  if (!r) return null;
  return {
    info: toRoomInfo(r),
    items: r.items.map(i => ({ id: i.id, defId: i.definitionId, x: i.x, y: i.y, z: i.z, rotation: i.rotation })),
  };
}

/** Quarto inicial de cada jogador, com alguma mobília para não começar vazio. */
export async function createHomeRoom(tx: Prisma.TransactionClient, userId: string, username: string) {
  const room = await tx.room.create({
    data: {
      name: 'Quarto em casa dos pais', description: `O quarto de ${username}. Um dia vou ter casa própria!`, ownerId: userId, category: 'casas', bairro: START_BAIRRO,
      width: 8, height: 8, floor: 'madeira', wall: 'amarela', doorX: 0, doorY: 4,
    },
  });
  const starter: Array<[string, number, number, number]> = [
    ['tapete_arraiolos', 3, 3, 0], ['sofa', 3, 1, 4], ['planta', 7, 0, 0], ['cama', 6, 5, 0], ['mesa_cafe', 4, 6, 0], ['cadeira_cafe', 3, 6, 2],
  ];
  await tx.furnitureItem.createMany({
    data: starter.map(([definitionId, x, y, rotation]) => ({ definitionId, ownerId: userId, roomId: room.id, x, y, z: 0, rotation })),
  });
  await tx.user.update({ where: { id: userId }, data: { homeRoomId: room.id } });
  return room;
}

export async function listPublicRooms() {
  return prisma.room.findMany({ where: { isPublic: true }, orderBy: { sortOrder: 'asc' }, include: { owner: { select: { username: true } } } });
}

export async function listRoomsOf(userId: string) {
  return prisma.room.findMany({ where: { ownerId: userId }, orderBy: { createdAt: 'asc' }, include: { owner: { select: { username: true } } } });
}

/** Quartos abertos de outros jogadores (para o separador "Quartos" do navegador). */
export async function listOpenPlayerRooms(take = 30) {
  return prisma.room.findMany({
    where: { isPublic: false, access: 'OPEN', owner: { status: 'ACTIVE' } },
    orderBy: { updatedAt: 'desc' }, take, include: { owner: { select: { username: true } } },
  });
}
