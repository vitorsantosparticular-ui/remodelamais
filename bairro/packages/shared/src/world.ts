/** Dados do mundo: espaços públicos e casas. Usados pelo seed da BD e pela versão de demonstração. */
export type SeedItem = [defId: string, x: number, y: number, rotation?: number];
export interface PublicRoomSeed {
  id: string; bairro: string; name: string; description: string; category: string; sortOrder: number;
  width: number; height: number; floor: string; wall: string; doorX: number; doorY: number; maxUsers: number; items: SeedItem[];
}

export const PUBLIC_ROOMS: PublicRoomSeed[] = [
  {
    id: 'praca-central', bairro: 'baixa', name: 'Praça Central', description: 'O coração do bairro. Ponto de encontro, chafariz e jacarandás.',
    category: 'publico', sortOrder: 1, width: 16, height: 16, floor: 'calcada', wall: 'nenhuma', doorX: 0, doorY: 8, maxUsers: 50,
    items: [
      ['chafariz', 7, 7], ['jacaranda', 2, 2], ['jacaranda', 13, 2], ['jacaranda', 2, 13], ['jacaranda', 13, 13],
      ['banco_jardim', 6, 4, 4], ['banco_jardim', 6, 11, 0], ['banco_jardim', 11, 7, 6], ['banco_jardim', 3, 7, 2],
      ['candeeiro_rua', 4, 4], ['candeeiro_rua', 11, 4], ['candeeiro_rua', 4, 11], ['candeeiro_rua', 11, 11],
      ['planta', 9, 1], ['planta', 1, 9],
    ],
  },
  {
    id: 'cafe-portugues', bairro: 'chiado', name: 'Café Português', description: 'Uma bica, um pastel de nata e dois dedos de conversa.',
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

// [id, bairro, morada, tipo, preço (cêntimos), renda semanal (cêntimos)]
export const PROPERTIES: Array<[string, string, string, string, number, number]> = [
  ['alf-1', 'alfama', 'Beco do Carneiro, 3 — r/c', 't0', 4_500_000, 11_000],
  ['alf-2', 'alfama', 'Rua de São Miguel, 12 — 1.º', 't0', 5_200_000, 12_500],
  ['alf-3', 'alfama', 'Largo do Chafariz de Dentro, 7 — 2.º', 't1', 8_900_000, 19_000],
  ['ba-1', 'bairro-alto', 'Rua da Rosa, 41 — 3.º', 't0', 5_500_000, 13_000],
  ['ba-2', 'bairro-alto', 'Travessa da Queimada, 9 — 1.º', 't1', 9_800_000, 21_000],
  ['chi-1', 'chiado', 'Rua Garrett, 60 — 4.º', 't1', 14_000_000, 26_000],
  ['chi-2', 'chiado', 'Rua do Carmo, 15 — 2.º', 't2', 22_000_000, 38_000],
  ['bx-1', 'baixa', 'Rua dos Fanqueiros, 28 — 3.º', 't1', 12_500_000, 24_000],
  ['co-1', 'campo-ourique', 'Rua Ferreira Borges, 101 — 2.º Esq.', 't1', 11_000_000, 20_000],
  ['co-2', 'campo-ourique', 'Rua Saraiva de Carvalho, 77 — 5.º Dto.', 't2', 18_000_000, 30_000],
  ['av-1', 'avenidas', 'Av. da República, 34 — 6.º', 't2', 20_000_000, 33_000],
  ['pn-1', 'parque-nacoes', 'Passeio do Báltico, 4 — 9.º', 'loft', 26_000_000, 38_000],
  ['pn-2', 'parque-nacoes', 'Rua do Pólo Norte, 2 — 12.º', 'loft', 29_000_000, 42_000],
  ['cs-1', 'cais-sodre', 'Rua Nova do Carvalho, 5 — 1.º', 't0', 6_000_000, 14_000],
  ['bel-1', 'belem', 'Rua de Belém, 88 — Moradia', 'moradia', 55_000_000, 65_000],
];

