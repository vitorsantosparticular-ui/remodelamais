/** Cliente REST. A sessão vai num cookie httpOnly; o JavaScript nunca vê o token. */
import type { CityState, Figure, PropertyListing, RoomInfo } from '@bairro/shared';

export interface Me {
  id: string; username: string; figure: Figure; motto: string; role: string;
  credits: number; diamonds: number; homeRoomId: string | null; lastRoomId: string | null; isMinor: boolean;
}
export type RoomListItem = RoomInfo & { users: number };

import { ApiError } from './errors';
import { demoRequest } from './demo/demoServer';
export { ApiError };
const DEMO = import.meta.env.VITE_DEMO === '1';

async function req<T>(method: string, path: string, body?: unknown): Promise<T> {
  if (DEMO) return demoRequest(method, path, body) as Promise<T>;
  const r = await fetch(path, {
    method, credentials: 'same-origin',
    headers: body !== undefined ? { 'content-type': 'application/json' } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new ApiError(r.status, (data as { error?: string }).error ?? 'Erro de ligação.');
  return data as T;
}

export const api = {
  me: () => req<Me>('GET', '/api/me'),
  login: (username: string, password: string) => req<{ ok: true }>('POST', '/api/auth/login', { username, password }),
  register: (p: { username: string; password: string; birthYear: number; figure: Figure; acceptTerms: boolean }) => req<{ ok: true }>('POST', '/api/auth/register', p),
  logout: () => req<{ ok: true }>('POST', '/api/auth/logout', {}),
  saveFigure: (figure: Figure, motto: string) => req<{ ok: true; figure: Figure; motto: string }>('PUT', '/api/me/figure', { figure, motto }),
  rooms: (tab: 'public' | 'players' | 'mine') => req<RoomListItem[]>('GET', `/api/rooms?tab=${tab}`),
  createRoom: (p: { name: string; description: string; size: string; floor: string; wall: string; access: string }) => req<{ id: string }>('POST', '/api/rooms', p),
  city: () => req<CityState>('GET', '/api/city/state'),
  people: (bairro: string) => req<Array<{ username: string; figure: Figure; motto: string }>>('GET', `/api/city/bairro/${bairro}/people`),
  act: (path: string, body: unknown) => req<{ ok: true; result: unknown; state: CityState }>('POST', path, body),
  statement: () => req<Array<{ id: string; account: 'WALLET' | 'BANK'; amount: number; balanceAfter: number; kind: string; memo: string; ts: number }>>('GET', '/api/bank/statement'),
  properties: () => req<PropertyListing[]>('GET', '/api/properties'),
  player: (username: string) => req<{ username: string; figure: Figure; motto: string; createdAt: string; homeRoomId: string | null }>('GET', `/api/players/${encodeURIComponent(username)}`),
};
