/**
 * Catálogo base de mobília. É a fonte para o seed da tabela FurnitureDefinition;
 * o cliente usa `sprite` para saber como desenhar. Toda a arte é original e desenhada por código.
 */
export type Rarity = 'COMMON' | 'UNCOMMON' | 'RARE' | 'EPIC' | 'LEGENDARY' | 'LIMITED';

export interface FurnitureDef {
  id: string;
  name: string;
  category: string;
  /** Dimensões na rotação 0 (largura ao longo de x, comprimento ao longo de y). */
  width: number;
  length: number;
  /** Altura de empilhamento (unidades z) — onde assenta o que for posto por cima. */
  stackHeight: number;
  canSit: boolean;
  canWalk: boolean;
  canStack: boolean;
  rarity: Rarity;
  price: number;
  sprite: string;
}

export const FURNITURE: FurnitureDef[] = [
  { id: 'cadeira_cafe', name: 'Cadeira de café', category: 'cafe', width: 1, length: 1, stackHeight: 0.5, canSit: true, canWalk: false, canStack: false, rarity: 'COMMON', price: 3, sprite: 'cadeira' },
  { id: 'mesa_cafe', name: 'Mesa de esplanada', category: 'cafe', width: 1, length: 1, stackHeight: 0.6, canSit: false, canWalk: false, canStack: true, rarity: 'COMMON', price: 4, sprite: 'mesa' },
  { id: 'balcao', name: 'Balcão de pastelaria', category: 'cafe', width: 1, length: 3, stackHeight: 0.9, canSit: false, canWalk: false, canStack: true, rarity: 'UNCOMMON', price: 12, sprite: 'balcao' },
  { id: 'maquina_cafe', name: 'Máquina de café', category: 'cafe', width: 1, length: 1, stackHeight: 0.5, canSit: false, canWalk: false, canStack: false, rarity: 'UNCOMMON', price: 8, sprite: 'maquina' },
  { id: 'banco_jardim', name: 'Banco de jardim', category: 'exterior', width: 2, length: 1, stackHeight: 0.5, canSit: true, canWalk: false, canStack: false, rarity: 'COMMON', price: 5, sprite: 'banco' },
  { id: 'jacaranda', name: 'Jacarandá', category: 'exterior', width: 1, length: 1, stackHeight: 3, canSit: false, canWalk: false, canStack: false, rarity: 'RARE', price: 20, sprite: 'arvore' },
  { id: 'candeeiro_rua', name: 'Candeeiro de rua', category: 'exterior', width: 1, length: 1, stackHeight: 2.5, canSit: false, canWalk: false, canStack: false, rarity: 'COMMON', price: 6, sprite: 'candeeiro' },
  { id: 'chafariz', name: 'Chafariz', category: 'exterior', width: 2, length: 2, stackHeight: 1, canSit: false, canWalk: false, canStack: false, rarity: 'EPIC', price: 60, sprite: 'chafariz' },
  { id: 'sofa', name: 'Sofá de veludo', category: 'sala', width: 2, length: 1, stackHeight: 0.5, canSit: true, canWalk: false, canStack: false, rarity: 'COMMON', price: 10, sprite: 'sofa' },
  { id: 'tapete_arraiolos', name: 'Tapete de Arraiolos', category: 'sala', width: 2, length: 2, stackHeight: 0.02, canSit: false, canWalk: true, canStack: true, rarity: 'UNCOMMON', price: 15, sprite: 'tapete' },
  { id: 'planta', name: 'Vaso com planta', category: 'sala', width: 1, length: 1, stackHeight: 1, canSit: false, canWalk: false, canStack: false, rarity: 'COMMON', price: 3, sprite: 'planta' },
  { id: 'cama', name: 'Cama de solteiro', category: 'quarto', width: 1, length: 2, stackHeight: 0.6, canSit: true, canWalk: false, canStack: false, rarity: 'COMMON', price: 12, sprite: 'cama' },
  { id: 'galo_barcelos', name: 'Galo de Barcelos', category: 'raros', width: 1, length: 1, stackHeight: 0.8, canSit: false, canWalk: false, canStack: false, rarity: 'LEGENDARY', price: 250, sprite: 'galo' },
];

export const FURNITURE_BY_ID = new Map(FURNITURE.map(f => [f.id, f]));

/** Pegada da mobília tendo em conta a rotação (0/2/4/6; 2 e 6 trocam largura e comprimento). */
export function footprint(def: Pick<FurnitureDef, 'width' | 'length'>, rotation: number) {
  return rotation % 4 === 2 ? { w: def.length, l: def.width } : { w: def.width, l: def.length };
}
