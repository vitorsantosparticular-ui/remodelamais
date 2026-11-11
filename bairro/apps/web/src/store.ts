/** Estado do cliente (Zustand). Guarda só o que a interface React precisa; o motor Pixi tem o seu. */
import { create } from 'zustand';
import type { ChatMessageDTO, RoomInfo, RoomUserState } from '@bairro/shared';
import type { Me } from './api';

export type WindowId = 'navigator' | 'avatar' | 'chatlog' | 'profile' | null;

interface State {
  me: Me | null;
  booting: boolean;
  connected: boolean;
  room: RoomInfo | null;
  users: Record<string, RoomUserState>;
  chat: ChatMessageDTO[];
  window: WindowId;
  selectedUserId: string | null;
  toast: { id: number; text: string } | null;
  set: (p: Partial<State>) => void;
  notify: (text: string) => void;
  addChat: (m: ChatMessageDTO) => void;
}

export const useGame = create<State>((set) => ({
  me: null, booting: true, connected: false, room: null, users: {}, chat: [], window: null, selectedUserId: null, toast: null,
  set: p => set(p),
  notify: text => set({ toast: { id: Date.now(), text } }),
  addChat: m => set(s => ({ chat: [...s.chat.slice(-99), m] })),
}));
