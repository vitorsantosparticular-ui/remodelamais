export const FLOOR_TYPES = ['calcada', 'madeira', 'azulejo', 'alcatifa', 'relva', 'areia'] as const;
export const WALL_TYPES = ['nenhuma', 'branca', 'amarela', 'azulejo', 'rosa'] as const;
export type FloorType = typeof FLOOR_TYPES[number];
export type WallType = typeof WALL_TYPES[number];
export const ROOM_ACCESS = ['OPEN', 'OWNER_ONLY'] as const;
export type RoomAccess = typeof ROOM_ACCESS[number];
export const ROOM_SIZES = { pequeno: 6, medio: 9, grande: 12 } as const;
/** Duração de um passo no servidor (ms). Os clientes interpolam neste intervalo. */
export const WALK_TICK_MS = 450;
