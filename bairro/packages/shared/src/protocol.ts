import type { Figure } from './avatar';
import type { FloorType, WallType, RoomAccess } from './rooms';

/** Contrato de mensagens Socket.IO. O cliente só envia INTENÇÕES; o servidor decide o resultado. */

export interface PublicUser { id: string; username: string; figure: Figure; motto: string }

export interface RoomUserState extends PublicUser {
  x: number; y: number; z: number; dir: number;
  /** Ação atual: 'sit' quando sentado em mobília. */
  status: { sit?: number } ;
}

export interface RoomItemState {
  id: string; defId: string; x: number; y: number; z: number; rotation: number;
}

export interface RoomInfo {
  id: string; name: string; description: string; ownerId: string | null; ownerName: string | null;
  isPublic: boolean; category: string; width: number; height: number;
  floor: FloorType; wall: WallType; doorX: number; doorY: number; access: RoomAccess; maxUsers: number;
}

export interface RoomSnapshot {
  room: RoomInfo;
  items: RoomItemState[];
  users: RoomUserState[];
  chat: ChatMessageDTO[];
  you: string;
}

export interface ChatMessageDTO { id: string; userId: string; username: string; text: string; ts: number }

export interface ServerToClient {
  'room:snapshot': (s: RoomSnapshot) => void;
  'room:user_joined': (u: RoomUserState) => void;
  'room:user_left': (p: { id: string }) => void;
  /** O servidor tirou-te do quarto (viagem, despejo). */
  'room:left': () => void;
  'room:users_moved': (p: Array<Pick<RoomUserState, 'id' | 'x' | 'y' | 'z' | 'dir' | 'status'>>) => void;
  'chat:message': (m: ChatMessageDTO) => void;
  'user:figure': (p: { id: string; figure: Figure }) => void;
  'error:game': (p: { code: string; message: string }) => void;
  'notice': (p: { message: string }) => void;
  /** Quantos jogadores ligados estão em cada bairro (atualizado a cada poucos segundos). */
  'city:presence': (p: { counts: Record<string, number>; total: number }) => void;
  /** O estado do jogador mudou por algo externo (transferência recebida, despejo...). */
  'city:changed': (p: { reason: string }) => void;
}

export interface ClientToServer {
  'room:join': (p: { roomId: string }, ack: (r: { ok: boolean; error?: string }) => void) => void;
  'room:leave': () => void;
  'room:move': (p: { x: number; y: number }) => void;
  'chat:send': (p: { text: string }) => void;
}
