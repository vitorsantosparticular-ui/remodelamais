/**
 * A cidade: bairros, locais, transportes, biscates, veículos e tipos de casa.
 * Partilhado: o cliente usa para desenhar e mostrar preços; o servidor usa para VALIDAR e cobrar.
 * Valores monetários em cêntimos.
 */

export type PlaceId = 'banco' | 'multibanco' | 'imobiliaria' | 'stand' | 'praca' | 'cafe' | 'casa_pais' | 'trabalho';

export interface Bairro {
  id: string;
  name: string;
  /** Posição no mapa (0..1000 × 0..620). */
  x: number; y: number;
  blurb: string;
  places: PlaceId[];
  /** Quarto isométrico ligado a este bairro (espaço público), se houver. */
  roomId?: string;
}

export const BAIRROS: Bairro[] = [
  { id: 'campo-ourique', name: 'Campo de Ourique', x: 300, y: 300, blurb: 'Bairro de famílias, mercado e elétrico 28. Aqui vive a tua família.', places: ['casa_pais', 'multibanco'] },
  { id: 'avenidas', name: 'Avenidas Novas', x: 540, y: 170, blurb: 'Escritórios, avenidas largas e o stand de automóveis.', places: ['stand', 'trabalho', 'multibanco'] },
  { id: 'parque-nacoes', name: 'Parque das Nações', x: 905, y: 95, blurb: 'Torres de vidro, rio largo e obras por todo o lado.', places: ['trabalho', 'multibanco'] },
  { id: 'bairro-alto', name: 'Bairro Alto', x: 445, y: 375, blurb: 'Ruelas, tascas e noites longas.', places: ['trabalho', 'multibanco'] },
  { id: 'chiado', name: 'Chiado', x: 525, y: 420, blurb: 'Livrarias, cafés históricos e a imobiliária.', places: ['cafe', 'imobiliaria', 'trabalho', 'multibanco'], roomId: 'cafe-portugues' },
  { id: 'baixa', name: 'Baixa', x: 615, y: 440, blurb: 'O centro: a praça, o banco e muito turista.', places: ['praca', 'banco', 'trabalho', 'multibanco'], roomId: 'praca-central' },
  { id: 'alfama', name: 'Alfama', x: 720, y: 400, blurb: 'Becos, roupa a secar e fado ao fim da tarde.', places: ['trabalho', 'multibanco'] },
  { id: 'cais-sodre', name: 'Cais do Sodré', x: 470, y: 485, blurb: 'Estação, rio e a rua cor-de-rosa.', places: ['trabalho', 'multibanco'] },
  { id: 'belem', name: 'Belém', x: 120, y: 470, blurb: 'Monumentos, jardins e pastéis acabados de sair do forno.', places: ['trabalho', 'multibanco'] },
];
export const BAIRRO_BY_ID = new Map(BAIRROS.map(b => [b.id, b]));
export const START_BAIRRO = 'campo-ourique';

export const PLACE_INFO: Record<PlaceId, { name: string; icon: string }> = {
  banco: { name: 'Banco do Bairro', icon: '🏦' },
  multibanco: { name: 'Multibanco', icon: '🏧' },
  imobiliaria: { name: 'Imobiliária Sete Colinas', icon: '🔑' },
  stand: { name: 'Stand Avenida Motors', icon: '🚗' },
  praca: { name: 'Praça Central', icon: '⛲' },
  cafe: { name: 'Café Português', icon: '☕' },
  casa_pais: { name: 'Casa dos pais', icon: '🏠' },
  trabalho: { name: 'Biscates', icon: '💼' },
};

/** Distância em "unidades de cidade" (px do mapa / 10). */
export function distance(a: string, b: string) {
  const A = BAIRRO_BY_ID.get(a), B = BAIRRO_BY_ID.get(b);
  if (!A || !B) return Infinity;
  return Math.hypot(A.x - B.x, A.y - B.y) / 10;
}

// ------------------------------------------------------------------ transportes
export type TransportMode = 'pe' | 'metro' | 'taxi' | 'carro';
export interface Transport { id: TransportMode; name: string; icon: string; secPerUnit: number; baseCost: number; costPerUnit: number }
export const TRANSPORTS: Record<TransportMode, Transport> = {
  pe: { id: 'pe', name: 'A pé', icon: '🚶', secPerUnit: 2, baseCost: 0, costPerUnit: 0 },
  metro: { id: 'metro', name: 'Metro', icon: 'Ⓜ️', secPerUnit: 0.8, baseCost: 185, costPerUnit: 0 },
  taxi: { id: 'taxi', name: 'Táxi', icon: '🚕', secPerUnit: 0.3, baseCost: 325, costPerUnit: 8 },
  carro: { id: 'carro', name: 'O teu veículo', icon: '🚗', secPerUnit: 0.35, baseCost: 0, costPerUnit: 5 },
};

/** Duração (s) e custo (cêntimos) de uma viagem. Para 'carro' usa a velocidade do melhor veículo. */
export function tripQuote(from: string, to: string, mode: TransportMode, vehicleSecPerUnit?: number) {
  const d = distance(from, to);
  const t = TRANSPORTS[mode];
  const spu = mode === 'carro' && vehicleSecPerUnit ? vehicleSecPerUnit : t.secPerUnit;
  return { seconds: Math.max(3, Math.round(d * spu)), cost: Math.round(t.baseCost + t.costPerUnit * d) };
}

// ------------------------------------------------------------------ biscates (trabalho por turnos em tempo real)
export interface Job { id: string; bairro: string; name: string; icon: string; seconds: number; pay: number }
export const JOBS: Job[] = [
  { id: 'panfletos', bairro: 'baixa', name: 'Distribuir panfletos', icon: '📄', seconds: 45, pay: 900 },
  { id: 'cafe', bairro: 'chiado', name: 'Turno ao balcão do café', icon: '☕', seconds: 90, pay: 2200 },
  { id: 'escritorio', bairro: 'avenidas', name: 'Estafeta de escritório', icon: '📦', seconds: 120, pay: 3200 },
  { id: 'obras', bairro: 'parque-nacoes', name: 'Ajudante nas obras', icon: '🏗️', seconds: 180, pay: 5200 },
  { id: 'tasca', bairro: 'bairro-alto', name: 'Servir à mesa numa tasca', icon: '🍷', seconds: 90, pay: 2400 },
  { id: 'guia', bairro: 'alfama', name: 'Guia turístico a pé', icon: '🗺️', seconds: 150, pay: 4200 },
  { id: 'estacao', bairro: 'cais-sodre', name: 'Bilheteira da estação', icon: '🎫', seconds: 120, pay: 3000 },
  { id: 'pastelaria', bairro: 'belem', name: 'Embalar pastéis de nata', icon: '🥧', seconds: 120, pay: 3400 },
];
export const JOB_BY_ID = new Map(JOBS.map(j => [j.id, j]));
/** Turnos por dia (dia de Lisboa). Evita transformar o jogo num clicador infinito. */
export const MAX_SHIFTS_PER_DAY = 8;

// ------------------------------------------------------------------ veículos
export interface VehicleModel { id: string; name: string; icon: string; price: number; secPerUnit: number }
export const VEHICLES: VehicleModel[] = [
  { id: 'mota125', name: 'Mota 125 cc', icon: '🛵', price: 120000, secPerUnit: 0.32 },
  { id: 'citadino', name: 'Citadino usado (2009)', icon: '🚗', price: 300000, secPerUnit: 0.3 },
  { id: 'utilitario', name: 'Utilitário a gasóleo', icon: '🚙', price: 950000, secPerUnit: 0.26 },
  { id: 'carrinha', name: 'Carrinha de 7 lugares', icon: '🚐', price: 1400000, secPerUnit: 0.26 },
  { id: 'descapotavel', name: 'Descapotável vermelho', icon: '🏎️', price: 3800000, secPerUnit: 0.2 },
];
export const VEHICLE_BY_ID = new Map(VEHICLES.map(v => [v.id, v]));
/** Percentagem devolvida ao vender de volta à cidade. */
export const VEHICLE_RESALE = 0.6;

// ------------------------------------------------------------------ casas
export type PropertyType = 't0' | 't1' | 't2' | 'loft' | 'moradia';
export const PROPERTY_TYPES: Record<PropertyType, { name: string; size: number; floor: string; wall: string }> = {
  t0: { name: 'T0', size: 6, floor: 'madeira', wall: 'branca' },
  t1: { name: 'T1', size: 8, floor: 'madeira', wall: 'amarela' },
  t2: { name: 'T2', size: 10, floor: 'alcatifa', wall: 'branca' },
  loft: { name: 'Loft', size: 11, floor: 'azulejo', wall: 'branca' },
  moradia: { name: 'Moradia', size: 12, floor: 'madeira', wall: 'rosa' },
};
export const PROPERTY_RESALE = 0.7;
export const RENT_PERIOD_DAYS = 7;

/** Dinheiro inicial: 150 € na carteira. */
export const START_WALLET = 15000;

export const fmtEuros = (c: number) => (c / 100).toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' });

/** Dia de calendário em Lisboa (para o limite de turnos). */
export function lisbonDay(d = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Lisbon', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
}
export function lisbonHour(d = new Date()) {
  const p = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Lisbon', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(d);
  return Number(p.find(x => x.type === 'hour')!.value) + Number(p.find(x => x.type === 'minute')!.value) / 60;
}

// ------------------------------------------------------------------ estado do jogador na cidade (DTO)
export interface CityState {
  wallet: number;
  bank: number;
  diamonds: number;
  location: string;
  travel: { from: string; to: string; mode: TransportMode; startedAt: number; arrivesAt: number } | null;
  work: { jobId: string; until: number; startedAt: number } | null;
  shiftsToday: number;
  vehicles: Array<{ id: string; model: string }>;
  properties: Array<{ id: string; address: string; bairro: string; type: PropertyType; relation: 'owner' | 'tenant'; rentWeek: number; rentPaidUntil: number | null; roomId: string | null }>;
  homeRoomId: string | null;
}

export interface PropertyListing {
  id: string; bairro: string; address: string; type: PropertyType; price: number; rentWeek: number;
  status: 'livre' | 'vendida' | 'arrendada'; occupant: string | null; mine: boolean;
}
