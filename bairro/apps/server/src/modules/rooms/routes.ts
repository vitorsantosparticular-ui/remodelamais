import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { FLOOR_TYPES, WALL_TYPES, ROOM_SIZES, filterChat } from '@bairro/shared';
import { prisma } from '../../db';
import { config } from '../../config';
import type { Gateway } from '../../realtime/gateway';
import { currentUser } from '../auth/routes';
import { listOpenPlayerRooms, listPublicRooms, listRoomsOf, toRoomInfo } from './service';
import { audit } from '../admin/audit';

const createBody = z.object({
  name: z.string().trim().min(3, 'O nome do quarto precisa de 3 caracteres.').max(40),
  description: z.string().trim().max(140).default(''),
  size: z.enum(Object.keys(ROOM_SIZES) as [keyof typeof ROOM_SIZES, ...Array<keyof typeof ROOM_SIZES>]),
  floor: z.enum(FLOOR_TYPES),
  wall: z.enum(WALL_TYPES),
  access: z.enum(['OPEN', 'OWNER_ONLY']).default('OPEN'),
});

export function roomRoutes(app: FastifyInstance, gw: Gateway) {
  app.get<{ Querystring: { tab?: string } }>('/api/rooms', async (req, reply) => {
    const me = await currentUser(req);
    if (!me) return reply.code(401).send({ error: 'Sessão terminada.' });
    const tab = req.query.tab ?? 'public';
    const rows = tab === 'mine' ? await listRoomsOf(me.id) : tab === 'players' ? await listOpenPlayerRooms() : await listPublicRooms();
    return rows.map(r => ({ ...toRoomInfo(r), users: gw.rooms.userCount(r.id) }));
  });

  app.post('/api/rooms', async (req, reply) => {
    const me = await currentUser(req);
    if (!me) return reply.code(401).send({ error: 'Sessão terminada.' });
    const body = createBody.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: body.error.issues[0].message });
    const count = await prisma.room.count({ where: { ownerId: me.id } });
    if (count >= config.maxRoomsPerUser) return reply.code(400).send({ error: `Já tens ${config.maxRoomsPerUser} quartos.` });
    const n = ROOM_SIZES[body.data.size];
    const room = await prisma.room.create({
      data: {
        name: filterChat(body.data.name).text, description: filterChat(body.data.description).text,
        ownerId: me.id, category: 'casas', width: n, height: n, floor: body.data.floor, wall: body.data.wall,
        access: body.data.access, doorX: 0, doorY: Math.floor(n / 2),
      },
    });
    await audit(me.id, 'room.create', { roomId: room.id }, req.ip);
    return { id: room.id };
  });
}
