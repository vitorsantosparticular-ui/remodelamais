/**
 * MODO DEMONSTRAÇÃO (um jogador, sem servidor): simula a API e o socket no próprio browser,
 * com as MESMAS regras partilhadas (@bairro/shared) e o mesmo motor de quarto do servidor.
 * Guarda o progresso no localStorage. Ativo só quando VITE_DEMO=1 (build da página de demonstração).
 */
import {
  BAIRROS, BAIRRO_BY_ID, DEFAULT_FIGURE, FURNITURE, JOB_BY_ID, MAX_SHIFTS_PER_DAY, PROPERTIES, PROPERTY_RESALE, PROPERTY_TYPES,
  PUBLIC_ROOMS, RENT_PERIOD_DAYS, START_BAIRRO, START_WALLET, TRANSPORTS, VEHICLE_BY_ID, VEHICLE_RESALE, ROOM_SIZES,
  filterChat, lisbonDay, tripQuote, validateFigure, fmtEuros,
  type CityState, type ChatMessageDTO, type Figure, type PropertyListing, type PropertyType, type RoomInfo, type RoomItemState,
  type TransportMode, type FloorType, type WallType,
} from '@bairro/shared';
import { RoomInstance } from '../../../server/src/modules/rooms/RoomInstance';
import { ApiError } from '../errors';

const KEY = 'bairro.demo.v1';
const DAY = 86_400_000;
const ME = 'eu';

interface Ledger { id: string; account: 'WALLET' | 'BANK'; amount: number; balanceAfter: number; kind: string; memo: string; ts: number }
interface Save {
  username: string; figure: Figure; motto: string;
  wallet: number; bank: number; location: string;
  travel: CityState['travel']; work: CityState['work'];
  shiftsDay: string; shiftsCount: number;
  vehicles: Array<{ id: string; model: string; price: number }>;
  /** Ocupação das casas: dono/inquilino ('eu' ou nome de um bot). */
  props: Record<string, { owner?: string; tenant?: string; paidUntil?: number }>;
  ledger: Ledger[];
  rooms: RoomInfo[];
  lastPos: Record<string, { x: number; y: number }>;
}

let S: Save | null = load();
function load(): Save | null { try { const v = localStorage.getItem(KEY); return v ? JSON.parse(v) : null; } catch { return null; } }
function save() { try { if (S) localStorage.setItem(KEY, JSON.stringify(S)); } catch { /* sem armazenamento */ } }
const uid = () => Math.random().toString(36).slice(2, 10);
const err = (msg: string, status = 400) => new ApiError(status, msg);

function freshSave(username: string, figure: Figure): Save {
  return {
    username, figure, motto: 'Novo no bairro!', wallet: START_WALLET, bank: 0, location: START_BAIRRO,
    travel: null, work: null, shiftsDay: '', shiftsCount: 0, vehicles: [], ledger: [], rooms: [], lastPos: {},
    // Algumas casas já estão ocupadas por outros moradores (dá vida à imobiliária).
    props: { 'chi-1': { tenant: 'Rita_Estudante', paidUntil: Date.now() + 365 * DAY }, 'bel-1': { owner: 'Klaus.Turista' }, 'alf-2': { tenant: 'Fatima_Alfama', paidUntil: Date.now() + 365 * DAY } },
  };
}

// ------------------------------------------------------------------ dinheiro (mesma regra do servidor: nunca negativo + registo)
function money(account: 'WALLET' | 'BANK', amount: number, kind: string, memo: string) {
  const s = S!;
  const field = account === 'WALLET' ? 'wallet' : 'bank';
  if (s[field] + amount < 0) throw err(account === 'WALLET' ? 'Não tens dinheiro suficiente na carteira.' : 'Não tens saldo suficiente no banco.');
  s[field] += amount;
  s.ledger.unshift({ id: uid(), account, amount, balanceAfter: s[field], kind, memo, ts: Date.now() });
  s.ledger = s.ledger.slice(0, 60);
}
function parseEuros(v: unknown) {
  const n = typeof v === 'number' ? v : Number(String(v ?? '').replace(/\s/g, '').replace(',', '.'));
  const c = Math.round(n * 100);
  if (!Number.isFinite(c) || c <= 0 || c > 100_000_000) throw err('Indica um montante válido.');
  return c;
}

// ------------------------------------------------------------------ tempo
function settle() {
  const s = S!, now = Date.now();
  if (s.travel && s.travel.arrivesAt <= now) { s.location = s.travel.to; s.travel = null; }
  if (s.work && s.work.until <= now) {
    const job = JOB_BY_ID.get(s.work.jobId); s.work = null;
    if (job) money('WALLET', job.pay, 'salario', job.name);
  }
  for (const [id, o] of Object.entries(s.props)) {
    if (o.tenant !== ME || !o.paidUntil || o.paidUntil > now) continue;
    const p = PROPERTIES.find(x => x[0] === id)!;
    try { money('BANK', -p[5], 'renda', `Renda: ${p[2]}`); o.paidUntil += RENT_PERIOD_DAYS * DAY; }
    catch { delete s.props[id]; notice(`Despejo: não havia saldo no banco para pagar a renda de ${p[2]}.`); leaveIfIn(`casa-${id}`); }
  }
  save();
}
function requireIdle() {
  if (S!.travel) throw err('Ainda estás em viagem.');
  if (S!.work) throw err('Estás a meio de um turno. Espera que acabe.');
}
function requirePlace(place: string) {
  if (!BAIRRO_BY_ID.get(S!.location)?.places.includes(place as never)) {
    throw err(`Para isto tens de ir a: ${BAIRROS.filter(b => b.places.includes(place as never)).map(b => b.name).join(', ')}.`);
  }
}
function cityState(): CityState {
  settle();
  const s = S!;
  const props = Object.entries(s.props).filter(([, o]) => o.owner === ME || o.tenant === ME).map(([id, o]) => {
    const p = PROPERTIES.find(x => x[0] === id)!;
    return { id, address: p[2], bairro: p[1], type: p[3] as PropertyType, relation: o.owner === ME ? 'owner' as const : 'tenant' as const, rentWeek: p[5], rentPaidUntil: o.paidUntil ?? null, roomId: `casa-${id}` };
  });
  return {
    wallet: s.wallet, bank: s.bank, diamonds: 0, location: s.location, travel: s.travel, work: s.work,
    shiftsToday: s.shiftsDay === lisbonDay() ? s.shiftsCount : 0,
    vehicles: s.vehicles.map(v => ({ id: v.id, model: v.model })), properties: props,
    homeRoomId: props[0]?.roomId ?? 'casa-pais',
  };
}

// ------------------------------------------------------------------ API simulada
export async function demoRequest(method: string, path: string, body: unknown): Promise<unknown> {
  await new Promise(r => setTimeout(r, 60));
  const b = (body ?? {}) as Record<string, unknown>;
  const route = `${method} ${path.split('?')[0]}`;
  if (route === 'GET /api/me') {
    if (!S) throw err('Sessão terminada.', 401);
    return { id: ME, username: S.username, figure: S.figure, motto: S.motto, role: 'PLAYER', credits: 0, diamonds: 0, homeRoomId: 'casa-pais', lastRoomId: null, isMinor: false };
  }
  if (route === 'POST /api/auth/register' || route === 'POST /api/auth/login') {
    const name = String(b.username ?? '').trim();
    if (!/^[A-Za-z0-9_.-]{3,16}$/.test(name)) throw err('O nome deve ter 3 a 16 caracteres: letras, números, _ . ou -');
    if (route.endsWith('login')) {
      if (!S || S.username.toLowerCase() !== name.toLowerCase()) throw err('Nesta demonstração não há essa conta neste browser. Cria uma conta.', 401);
      return { ok: true };
    }
    if (b.acceptTerms !== true) throw err('Tens de aceitar as regras do bairro.');
    S = freshSave(name, validateFigure(b.figure) ?? DEFAULT_FIGURE); save();
    return { ok: true };
  }
  if (!S) throw err('Sessão terminada.', 401);
  if (route === 'POST /api/auth/logout') return { ok: true };
  if (route === 'PUT /api/me/figure') {
    const f = validateFigure(b.figure); if (!f) throw err('Visual inválido.');
    S.figure = f; S.motto = filterChat(String(b.motto ?? '')).text.slice(0, 60); save();
    sock?.figureChanged(f);
    return { ok: true, figure: f, motto: S.motto };
  }
  if (route === 'GET /api/rooms') {
    const tab = new URLSearchParams(path.split('?')[1]).get('tab');
    const list = tab === 'mine' ? S.rooms : tab === 'players' ? [] : PUBLIC_ROOMS.map(r => roomInfo(r.id)!);
    return list.map(r => ({ ...r, users: sock?.countIn(r.id) ?? 0 }));
  }
  if (route === 'POST /api/rooms') {
    const name = String(b.name ?? '').trim();
    if (name.length < 3) throw err('O nome do quarto precisa de 3 caracteres.');
    const n = ROOM_SIZES[(b.size as keyof typeof ROOM_SIZES) ?? 'medio'] ?? 9;
    const r: RoomInfo = { id: `quarto-${uid()}`, name, description: String(b.description ?? ''), ownerId: ME, ownerName: S.username, isPublic: false, category: 'casas',
      width: n, height: n, floor: b.floor as FloorType, wall: b.wall as WallType, doorX: 0, doorY: Math.floor(n / 2), access: 'OPEN', maxUsers: 25 };
    S.rooms.push(r); save();
    return { id: r.id };
  }
  if (route === 'GET /api/city/state') return cityState();
  if (route.startsWith('GET /api/city/bairro/')) {
    const id = path.split('/')[4];
    cityState();
    const people = BOTS.filter(x => x.bairro === id).map(x => ({ username: x.name, figure: x.figure, motto: x.lines[0] }));
    if (!S.travel && S.location === id) people.unshift({ username: S.username, figure: S.figure, motto: S.motto });
    return people;
  }
  if (route === 'GET /api/bank/statement') return S.ledger;
  if (route === 'GET /api/properties') {
    return PROPERTIES.map(([id, bairro, address, type, price, rentWeek]): PropertyListing => {
      const o = S!.props[id] ?? {};
      return { id, bairro, address, type: type as PropertyType, price, rentWeek, status: o.owner ? 'vendida' : o.tenant ? 'arrendada' : 'livre',
        occupant: o.owner === ME || o.tenant === ME ? S!.username : o.owner ?? o.tenant ?? null, mine: o.owner === ME || o.tenant === ME };
    });
  }
  if (method === 'POST') {
    settle();
    const result = action(path, b);
    save();
    return { ok: true, result, state: cityState() };
  }
  throw err('Não disponível na demonstração.', 404);
}

function action(path: string, b: Record<string, unknown>) {
  const s = S!;
  switch (path) {
    case '/api/city/travel': {
      requireIdle();
      const to = String(b.to), mode = b.mode as TransportMode;
      if (!BAIRRO_BY_ID.has(to)) throw err('Esse bairro não existe.');
      if (to === s.location) throw err('Já estás aqui.');
      if (!TRANSPORTS[mode]) throw err('Transporte inválido.');
      let spu: number | undefined;
      if (mode === 'carro') {
        if (!s.vehicles.length) throw err('Não tens veículo. Passa pelo stand nas Avenidas Novas.');
        spu = Math.min(...s.vehicles.map(v => VEHICLE_BY_ID.get(v.model)!.secPerUnit));
      }
      const q = tripQuote(s.location, to, mode, spu);
      if (q.cost) money('WALLET', -q.cost, 'transporte', `${TRANSPORTS[mode].name} até ${BAIRRO_BY_ID.get(to)!.name}`);
      const now = Date.now();
      s.travel = { from: s.location, to, mode, startedAt: now, arrivesAt: now + q.seconds * 1000 };
      sock?.leaveRoom(true);
      return q;
    }
    case '/api/jobs/start': {
      const job = JOB_BY_ID.get(String(b.id)); if (!job) throw err('Esse trabalho não existe.');
      requireIdle();
      if (s.location !== job.bairro) throw err(`Este trabalho é em ${BAIRRO_BY_ID.get(job.bairro)!.name}.`);
      const today = lisbonDay(), count = s.shiftsDay === today ? s.shiftsCount : 0;
      if (count >= MAX_SHIFTS_PER_DAY) throw err(`Já fizeste ${MAX_SHIFTS_PER_DAY} turnos hoje. Descansa e volta amanhã!`);
      const now = Date.now();
      s.work = { jobId: job.id, startedAt: now, until: now + job.seconds * 1000 }; s.shiftsDay = today; s.shiftsCount = count + 1;
      return null;
    }
    case '/api/bank/deposit': { requireIdle(); requirePlace('banco'); const a = parseEuros(b.amount); money('WALLET', -a, 'deposito', 'Depósito ao balcão'); money('BANK', a, 'deposito', 'Depósito ao balcão'); return null; }
    case '/api/bank/withdraw': {
      requireIdle(); requirePlace('multibanco'); const a = parseEuros(b.amount);
      if (a > 40_000) throw err('O Multibanco só deixa levantar até 400 € de cada vez.');
      money('BANK', -a, 'levantamento', 'Levantamento Multibanco'); money('WALLET', a, 'levantamento', 'Levantamento Multibanco'); return null;
    }
    case '/api/bank/transfer': {
      requireIdle(); requirePlace('multibanco'); const a = parseEuros(b.amount);
      const bot = BOTS.find(x => x.name.toLowerCase() === String(b.to).toLowerCase());
      if (!bot) throw err('Na demonstração só podes transferir para os moradores (ex.: Rita_Estudante).');
      if (a > 50_000) throw err(`Máximo de ${fmtEuros(50_000)} por transferência.`);
      money('BANK', -a, 'transferencia', `Para ${bot.name}`); return null;
    }
    case '/api/properties/rent':
    case '/api/properties/buy': {
      requireIdle(); requirePlace('imobiliaria');
      const id = String(b.id), p = PROPERTIES.find(x => x[0] === id); if (!p) throw err('Essa casa não existe.');
      const o = s.props[id];
      if (o && (o.owner || o.tenant)) throw err('Alguém já ficou com esta casa.', 409);
      if (Object.values(s.props).filter(x => x.owner === ME || x.tenant === ME).length >= 3) throw err('Só podes ter 3 casas.');
      if (path.endsWith('buy')) { money('BANK', -p[4], 'compra_casa', `Compra: ${p[2]}`); s.props[id] = { owner: ME }; }
      else { money('BANK', -p[5], 'renda', `1.ª renda: ${p[2]}`); s.props[id] = { tenant: ME, paidUntil: Date.now() + RENT_PERIOD_DAYS * DAY }; }
      return null;
    }
    case '/api/properties/release': {
      requireIdle(); requirePlace('imobiliaria');
      const id = String(b.id), o = s.props[id], p = PROPERTIES.find(x => x[0] === id);
      if (!o || !p || (o.owner !== ME && o.tenant !== ME)) throw err('Essa casa não é tua.');
      if (o.owner === ME) money('BANK', Math.round(p[4] * PROPERTY_RESALE), 'venda_casa', `Venda: ${p[2]}`);
      delete s.props[id];
      return null;
    }
    case '/api/vehicles/buy': {
      const m = VEHICLE_BY_ID.get(String(b.id)); if (!m) throw err('Esse modelo não existe.');
      requireIdle(); requirePlace('stand');
      if (s.vehicles.length >= 3) throw err('Só podes ter 3 veículos.');
      money('BANK', -m.price, 'compra_veiculo', m.name); s.vehicles.push({ id: uid(), model: m.id, price: m.price }); return null;
    }
    case '/api/vehicles/sell': {
      requireIdle(); requirePlace('stand');
      const v = s.vehicles.find(x => x.id === b.id); if (!v) throw err('Esse veículo não é teu.');
      money('BANK', Math.round(v.price * VEHICLE_RESALE), 'venda_veiculo', VEHICLE_BY_ID.get(v.model)?.name ?? v.model);
      s.vehicles = s.vehicles.filter(x => x !== v); return null;
    }
  }
  throw err('Não disponível na demonstração.', 404);
}

// ------------------------------------------------------------------ quartos
function roomInfo(id: string): RoomInfo | null {
  const pub = PUBLIC_ROOMS.find(r => r.id === id);
  if (pub) return { id, name: pub.name, description: pub.description, ownerId: null, ownerName: null, isPublic: true, category: pub.category,
    width: pub.width, height: pub.height, floor: pub.floor as FloorType, wall: pub.wall as WallType, doorX: pub.doorX, doorY: pub.doorY, access: 'OPEN', maxUsers: pub.maxUsers };
  if (id === 'casa-pais') return { id, name: 'Quarto em casa dos pais', description: 'Um dia vou ter casa própria!', ownerId: ME, ownerName: S!.username, isPublic: false, category: 'casas',
    width: 8, height: 8, floor: 'madeira', wall: 'amarela', doorX: 0, doorY: 4, access: 'OPEN', maxUsers: 25 };
  if (id.startsWith('casa-')) {
    const p = PROPERTIES.find(x => x[0] === id.slice(5)); if (!p) return null;
    const t = PROPERTY_TYPES[p[3] as PropertyType];
    return { id, name: `${t.name} — ${p[2]}`, description: `${t.name} em ${BAIRRO_BY_ID.get(p[1])?.name}.`, ownerId: ME, ownerName: S!.username, isPublic: false, category: 'casas',
      width: t.size, height: t.size, floor: t.floor as FloorType, wall: t.wall as WallType, doorX: 0, doorY: Math.floor(t.size / 2), access: 'OPEN', maxUsers: 25 };
  }
  return S!.rooms.find(r => r.id === id) ?? null;
}
function roomBairro(id: string) {
  if (id === 'casa-pais') return START_BAIRRO;
  if (id.startsWith('casa-')) return PROPERTIES.find(x => x[0] === id.slice(5))?.[1] ?? null;
  return PUBLIC_ROOMS.find(r => r.id === id)?.bairro ?? null;
}
function roomItems(id: string): RoomItemState[] {
  const it = (defId: string, x: number, y: number, rotation = 0): RoomItemState => ({ id: uid(), defId, x, y, z: 0, rotation });
  const pub = PUBLIC_ROOMS.find(r => r.id === id);
  if (pub) return pub.items.map(([d, x, y, r]) => it(d, x, y, r));
  if (id === 'casa-pais') return [it('tapete_arraiolos', 3, 3), it('sofa', 3, 1, 4), it('planta', 7, 0), it('cama', 6, 5), it('mesa_cafe', 4, 6), it('cadeira_cafe', 3, 6, 2)];
  const info = roomInfo(id);
  if (id.startsWith('casa-') && info) return [it('cama', info.width - 2, 1), it('sofa', 2, 1, 4), it('planta', info.width - 1, info.height - 1)];
  return [];
}
void FURNITURE;

// ------------------------------------------------------------------ moradores (bots) que dão vida à cidade
interface Bot { name: string; figure: Figure; bairro: string; lines: string[] }
const BOTS: Bot[] = [
  { name: 'Fatima_Alfama', bairro: 'baixa', figure: { body: 'b', skin: '#f1c39b', hair: 'apanhado', hairColor: '#b9b9b9', shirt: 'manga', shirtColor: '#2b2b30', trousersColor: '#7a5230', shoesColor: '#2b2b30' },
    lines: ['Ó filho, já comeste?', 'Isto antigamente era tudo mais barato…', 'Cuidado com o elétrico!', 'As sardinhas este ano estão caras!'] },
  { name: 'Klaus.Turista', bairro: 'chiado', figure: { body: 'a', skin: '#f6d2b8', hair: 'curto', hairColor: '#e0b44a', shirt: 'tshirt', shirtColor: '#f2b01e', trousersColor: '#7a5230', shoesColor: '#f4f1ea' },
    lines: ['Where is the pastel de nata?', 'Obrigado! Obrigado!', 'So many hills…', 'Comprei uma moradia em Belém. Muito sol!'] },
  { name: 'Rita_Estudante', bairro: 'chiado', figure: { body: 'a', skin: '#f1c39b', hair: 'comprido', hairColor: '#b5502a', shirt: 'riscas', shirtColor: '#8a4fd1', trousersColor: '#2c3e66', shoesColor: '#2b2b30' },
    lines: ['As rendas estão impossíveis 😩', 'Arranjei um T1 no Chiado, mas fiquei sem dinheiro para comer.', 'Vou estudar para o café.', 'Já foste às obras no Parque das Nações? Pagam bem!'] },
  { name: 'ZeDoTukTuk', bairro: 'baixa', figure: { body: 'b', skin: '#c98e62', hair: 'rapado', hairColor: '#1f1a17', shirt: 'tshirt', shirtColor: '#3fa34d', trousersColor: '#2c3e66', shoesColor: '#2b2b30' },
    lines: ['Tuk-tuk! Alfama e Castelo, 20 euros!', 'Vai um passeio, amigo?', 'O táxi é caro, compra uma mota no stand!'] },
];
const REPLIES: Array<[RegExp, string]> = [
  [/\b(ol[aá]|boas|bom dia|boa tarde|boa noite|oi)\b/i, 'Olá! Tudo bem contigo?'],
  [/casa|renda|arrend/i, 'Vai à imobiliária no Chiado. Começa por um T0 em Alfama, é o mais barato.'],
  [/dinheiro|trabalh|emprego|biscate/i, 'Faz biscates! Nas obras do Parque das Nações paga-se melhor.'],
  [/carro|mota|stand/i, 'O stand é nas Avenidas Novas. Uma mota já poupa muito tempo.'],
  [/banco|depositar/i, 'O balcão do banco é aqui na Baixa. Multibanco há em todo o lado.'],
  [/\?$/, 'Boa pergunta… sei lá eu!'],
];
// Os moradores mudam de bairro de vez em quando.
setInterval(() => { const b = BOTS[Math.floor(Math.random() * BOTS.length)]; b.bairro = BAIRROS[Math.floor(Math.random() * BAIRROS.length)].id; sock?.presence(); }, 45_000);

// ------------------------------------------------------------------ socket simulado
type Handler = (...a: unknown[]) => void;
let sock: DemoSocket | null = null;
let notices: string[] = [];
function notice(m: string) { if (sock) sock.fire('notice', { message: m }); else notices.push(m); }
function leaveIfIn(roomId: string) { if (sock?.roomId === roomId) sock.leaveRoom(true); }

class DemoSocket {
  connected = false;
  roomId: string | null = null;
  private handlers = new Map<string, Handler[]>();
  private inst: RoomInstance | null = null;
  private botTimer: ReturnType<typeof setInterval> | null = null;
  private presTimer: ReturnType<typeof setInterval>;

  constructor() {
    sock = this;
    setTimeout(() => { this.connected = true; this.fire('connect'); this.presence(); notices.forEach(n => this.fire('notice', { message: n })); notices = []; }, 50);
    this.presTimer = setInterval(() => this.presence(), 4000);
  }
  on(ev: string, fn: Handler) { this.handlers.set(ev, [...(this.handlers.get(ev) ?? []), fn]); return this; }
  off(ev: string, fn?: Handler) { this.handlers.set(ev, fn ? (this.handlers.get(ev) ?? []).filter(h => h !== fn) : []); return this; }
  fire(ev: string, ...a: unknown[]) { (this.handlers.get(ev) ?? []).forEach(h => h(...a)); }
  disconnect() { this.leaveRoom(false); clearInterval(this.presTimer); this.connected = false; if (sock === this) sock = null; return this; }

  presence() {
    if (!S) return;
    const counts: Record<string, number> = {};
    for (const b of BOTS) counts[b.bairro] = (counts[b.bairro] ?? 0) + 1;
    const here = S.travel ? null : S.location;
    if (here) counts[here] = (counts[here] ?? 0) + 1;
    this.fire('city:presence', { counts, total: BOTS.length + 1 });
  }
  countIn(roomId: string) { return this.inst && this.roomId === roomId ? this.inst.users.size : BOTS.filter(b => b.bairro === roomBairro(roomId) && PUBLIC_ROOMS.some(r => r.id === roomId)).length; }
  figureChanged(f: Figure) { const u = this.inst?.users.get(ME); if (u) { u.figure = f; this.fire('user:figure', { id: ME, figure: f }); } }

  emit(ev: string, p?: Record<string, unknown>, ack?: (r: { ok: boolean; error?: string }) => void) {
    if (ev === 'room:join') this.join(String(p?.roomId), ack ?? (() => undefined));
    else if (ev === 'room:leave') this.leaveRoom(false);
    else if (ev === 'room:move' && this.inst) this.inst.requestMove(ME, Number(p?.x), Number(p?.y));
    else if (ev === 'chat:send' && this.inst) this.chat(ME, S!.username, String(p?.text ?? ''), true);
    return this;
  }

  private join(roomId: string, ack: (r: { ok: boolean; error?: string }) => void) {
    settle();
    const info = roomInfo(roomId);
    if (!info) return ack({ ok: false, error: 'Esse quarto não existe.' });
    const bairro = roomBairro(roomId);
    if (bairro) {
      if (S!.travel) return ack({ ok: false, error: 'Ainda estás em viagem.' });
      if (S!.location !== bairro) return ack({ ok: false, error: `Este sítio fica em ${BAIRRO_BY_ID.get(bairro)?.name}. Vai até lá primeiro.` });
    }
    if (roomId.startsWith('casa-') && roomId !== 'casa-pais' && !cityState().properties.some(p => p.roomId === roomId)) return ack({ ok: false, error: 'Esta casa já não é tua.' });
    this.leaveRoom(false);
    const inst = new RoomInstance(info, roomItems(roomId), {
      broadcastMoves: (_r, moves) => this.fire('room:users_moved', moves),
      persistPosition: (id, _r, x, y) => { if (id === ME) { S!.lastPos[roomId] = { x, y }; save(); } },
    });
    this.inst = inst; this.roomId = roomId;
    inst.add({ id: ME, username: S!.username, figure: S!.figure, motto: S!.motto, socketId: 'local' }, S!.lastPos[roomId] ?? null);
    const bots = PUBLIC_ROOMS.some(r => r.id === roomId) ? BOTS.filter(b => b.bairro === bairro) : [];
    for (const b of bots) {
      const spot = inst.nearestFree(2 + Math.floor(Math.random() * (info.width - 4)), 2 + Math.floor(Math.random() * (info.height - 4)));
      inst.add({ id: `bot:${b.name}`, username: b.name, figure: b.figure, motto: b.lines[0], socketId: 'bot' }, spot);
    }
    ack({ ok: true });
    this.fire('room:snapshot', { room: info, items: inst.items, users: [...inst.users.values()].map(u => inst.publicUser(u)), chat: [] as ChatMessageDTO[], you: ME });
    if (bots.length) {
      this.botTimer = setInterval(() => {
        for (const b of bots) {
          const r = Math.random();
          if (r < 0.35) inst.requestMove(`bot:${b.name}`, Math.floor(Math.random() * info.width), Math.floor(Math.random() * info.height));
          else if (r < 0.42) this.chat(`bot:${b.name}`, b.name, b.lines[Math.floor(Math.random() * b.lines.length)], false);
        }
      }, 3000);
    }
  }

  leaveRoom(byServer: boolean) {
    if (this.botTimer) clearInterval(this.botTimer);
    this.botTimer = null;
    this.inst?.dispose(); this.inst = null; this.roomId = null;
    if (byServer) this.fire('room:left');
  }

  private chat(id: string, username: string, raw: string, fromPlayer: boolean) {
    const { text } = filterChat(raw);
    if (!text) return;
    this.fire('chat:message', { id: uid(), userId: id, username, text, ts: Date.now() });
    if (!fromPlayer || !this.inst) return;
    const present = BOTS.filter(b => this.inst!.users.has(`bot:${b.name}`));
    const reply = REPLIES.find(([re]) => re.test(text));
    if (present.length && reply) {
      const b = present[Math.floor(Math.random() * present.length)];
      setTimeout(() => { if (this.inst?.users.has(`bot:${b.name}`)) this.chat(`bot:${b.name}`, b.name, reply[1], false); }, 1500 + Math.random() * 1500);
    }
  }
}

export function createDemoSocket() { return new DemoSocket(); }
