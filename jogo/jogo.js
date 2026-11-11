/* Vida em Lisboa — protótipo
 * Mapa isométrico de um bairro da Baixa/Chiado, avatar que anda com toque,
 * café (trabalhar), imobiliária (arrendar casa) e casa (dormir).
 * Tudo desenhado por código (sem imagens). O progresso fica no localStorage.
 */
(() => {
'use strict';

// ---------------------------------------------------------------- mundo
const MW = 28, MH = 28;                 // tamanho do mapa em mosaicos
const OX = MH * 32 + 120, OY = 260;     // origem isométrica no mundo
const WORLD_W = (MW + MH) * 32 + 240;
const WORLD_H = (MW + MH) * 16 + OY + 140;
const iso = (gx, gy, z = 0) => ({ x: OX + (gx - gy) * 32, y: OY + (gx + gy) * 16 - z });
const paraGrelha = (x, y) => { const a = (x - OX) / 32, b = (y - OY) / 16; return { gx: (a + b) / 2, gy: (b - a) / 2 }; };
const hash = (a, b, c = 0) => { const s = Math.sin(a * 12.9898 + b * 78.233 + c * 37.719) * 43758.5453; return s - Math.floor(s); };

// ---------------------------------------------------------------- estado guardado
const CHAVE = 'vidaLisboa.v1';
const CASAS = {
  quarto: { nome: 'Quarto partilhado (r/c)', ico: '🛏️', preco: 8500,  energia: 70,  desc: 'Casa de banho partilhada com 4 estudantes.' },
  t0:     { nome: 'T0 no 2.º andar',         ico: '🏠', preco: 15000, energia: 85,  desc: 'Pequeno, mas é só teu. Vista para o elétrico.' },
  t1:     { nome: 'T1 com varanda (4.º)',    ico: '🌇', preco: 26000, energia: 100, desc: 'Varanda virada ao Tejo. O sonho lisboeta.' },
};
const estadoBase = () => ({
  criado: false, nome: '', camisola: '#2e7dd1', cabelo: '#5a3a1e', pele: '#f1c39b',
  dinheiro: 5000, energia: 80, dia: 1, minutos: 8 * 60, casa: null, casaAte: 0, gx: 13, gy: 17,
});
let E;
try { E = Object.assign(estadoBase(), JSON.parse(localStorage.getItem(CHAVE)) || {}); } catch (e) { E = estadoBase(); }
const guardar = () => { try { localStorage.setItem(CHAVE, JSON.stringify(E)); } catch (e) { /* modo privado */ } };

// ---------------------------------------------------------------- mapa
const ESTRADA_X = [12, 13];   // rua do elétrico (ao longo de gy)
const ESTRADA_Y = [12, 13];   // rua transversal (ao longo de gx)
function tipoChao(gx, gy) {
  if (ESTRADA_X.includes(gx) || ESTRADA_Y.includes(gy)) return 'estrada';
  if (gx >= 15 && gy >= 15) return 'praca';
  if (gx >= 3 && gx <= 10 && gy >= 22) return 'jardim';
  return 'passeio';
}

// Edifícios: x,y = canto de trás; w ao longo de gx; d ao longo de gy; h = altura em px
const EDIFICIOS = [
  { x: 0, y: 0, w: 4, d: 4, h: 150, cor: 0xf0cf6e, portadas: true },
  { x: 4, y: 0, w: 3, d: 3, h: 120, cor: 0xe9a3a0 },
  { x: 7, y: 0, w: 4, d: 3, h: 165, cor: 0xf3efe6, varandas: true },
  { x: 0, y: 4, w: 3, d: 4, h: 130, cor: 0x9fc7a9, portadas: true },
  { x: 0, y: 8, w: 3, d: 3, h: 110, cor: 0xe6b98a, letreiro: ['MERCEARIA', '#7a2d1d', '#ffe9b0'] },
  { x: 15, y: 0, w: 4, d: 3, h: 140, cor: 0xb9d3ea, varandas: true },
  { x: 19, y: 0, w: 4, d: 3, h: 170, cor: 0xf0cf6e, portadas: true },
  { x: 23, y: 0, w: 5, d: 4, h: 125, cor: 0xe9a3a0, varandas: true },
  { x: 23, y: 5, w: 5, d: 5, h: 150, cor: 0xf3efe6, portadas: true, letreiro: ['FARMÁCIA', '#1d6b35', '#ffffff'] },
  { x: 0, y: 15, w: 3, d: 5, h: 150, cor: 0xd88f6d, varandas: true },
  { x: 0, y: 20, w: 3, d: 4, h: 120, cor: 0xf0cf6e, portadas: true },
  { x: 0, y: 24, w: 3, d: 4, h: 100, cor: 0xb9d3ea },
  { id: 'cafe', x: 6, y: 5, w: 5, d: 5, h: 112, cor: 0xf3e2b3, portadas: true,
    porta: { gx: 11, gy: 7 }, rotulo: '☕ Café A Bica' },
  { id: 'imob', x: 15, y: 6, w: 5, d: 4, h: 126, cor: 0xf2b8a6, varandas: true,
    porta: { gx: 17, gy: 10 }, rotulo: '🔑 Tejo Imóveis' },
  { id: 'casa', x: 5, y: 15, w: 5, d: 6, h: 176, cor: 0xeef3fa, azulejo: true, varandas: true,
    porta: { gx: 10, gy: 17 }, rotulo: '🏠 Casa' },
];
EDIFICIOS.forEach(b => { b.prof = iso(b.x + b.w, b.y + b.d).y; });

const ARVORES = [[16, 16], [26, 16], [16, 26], [26, 26], [11, 2], [14, 3], [11, 24], [4, 23], [8, 26], [2, 11], [24, 11]];
const CANDEEIROS = [[11, 11], [14, 11], [11, 14], [14, 14], [11, 4], [14, 20], [19, 15], [22, 26]];
const BANCOS = [[18, 21], [23, 20], [6, 24]];
const MESAS = [[7, 10], [9, 10], [7, 11]];
const FONTE = { x: 20, y: 20, w: 2, d: 2 };

// grelha de bloqueios
const bloqueado = Array.from({ length: MW }, () => new Uint8Array(MH));
EDIFICIOS.forEach(b => { for (let i = b.x; i < b.x + b.w; i++) for (let j = b.y; j < b.y + b.d; j++) if (i < MW && j < MH) bloqueado[i][j] = 1; });
[...ARVORES, ...CANDEEIROS, ...BANCOS, ...MESAS].forEach(([i, j]) => { bloqueado[i][j] = 1; });
for (let i = FONTE.x; i < FONTE.x + FONTE.w; i++) for (let j = FONTE.y; j < FONTE.y + FONTE.d; j++) bloqueado[i][j] = 1;
const livre = (i, j) => i >= 0 && j >= 0 && i < MW && j < MH && !bloqueado[i][j];

// A* com 8 direções, sem cortar esquinas
function caminho(sx, sy, tx, ty) {
  if (!livre(tx, ty)) return null;
  const id = (x, y) => x * MH + y;
  const g = new Map([[id(sx, sy), 0]]), de = new Map(), aberto = [{ x: sx, y: sy, f: 0 }], fechado = new Set();
  const h = (x, y) => { const dx = Math.abs(x - tx), dy = Math.abs(y - ty); return Math.max(dx, dy) + 0.414 * Math.min(dx, dy); };
  while (aberto.length) {
    let k = 0; for (let i = 1; i < aberto.length; i++) if (aberto[i].f < aberto[k].f) k = i;
    const c = aberto.splice(k, 1)[0], cid = id(c.x, c.y);
    if (c.x === tx && c.y === ty) {
      const r = []; let cur = cid;
      while (de.has(cur)) { r.unshift({ x: Math.floor(cur / MH), y: cur % MH }); cur = de.get(cur); }
      return r;
    }
    if (fechado.has(cid)) continue; fechado.add(cid);
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
      if (!dx && !dy) continue;
      const nx = c.x + dx, ny = c.y + dy;
      if (!livre(nx, ny) || (dx && dy && (!livre(c.x + dx, c.y) || !livre(c.x, c.y + dy)))) continue;
      const ng = g.get(cid) + (dx && dy ? 1.414 : 1), nid = id(nx, ny);
      if (ng < (g.has(nid) ? g.get(nid) : Infinity)) { g.set(nid, ng); de.set(nid, cid); aberto.push({ x: nx, y: ny, f: ng + h(nx, ny) }); }
    }
  }
  return null;
}
function livreMaisProximo(tx, ty) {
  for (let r = 0; r <= 4; r++) {
    let melhor = null, md = 1e9;
    for (let i = tx - r; i <= tx + r; i++) for (let j = ty - r; j <= ty + r; j++)
      if (livre(i, j)) { const d = Math.hypot(i - tx, j - ty); if (d < md) { md = d; melhor = { x: i, y: j }; } }
    if (melhor) return melhor;
  }
  return null;
}

// Ordenação de profundidade: quem está à frente de um edifício é desenhado por cima dele
function profundidade(px, py) {
  let d = iso(px, py).y;
  for (const b of EDIFICIOS) {
    const x1 = b.x + b.w, y1 = b.y + b.d;
    if ((px >= x1 || py >= y1) && px > b.x - 1.5 && py > b.y - 1.5 && px < x1 + 3 && py < y1 + 3) d = Math.max(d, b.prof + 1);
  }
  return d;
}

// ---------------------------------------------------------------- cores
const escurecer = (c, f) => (Math.round(((c >> 16) & 255) * f) << 16) | (Math.round(((c >> 8) & 255) * f) << 8) | Math.round((c & 255) * f);
const hexNum = s => parseInt(s.replace('#', ''), 16);
const misturar = (a, b, t) => {
  const r = (a >> 16 & 255) + ((b >> 16 & 255) - (a >> 16 & 255)) * t;
  const g = (a >> 8 & 255) + ((b >> 8 & 255) - (a >> 8 & 255)) * t;
  const bl = (a & 255) + ((b & 255) - (a & 255)) * t;
  return (Math.round(r) << 16) | (Math.round(g) << 8) | Math.round(bl);
};
const TELHA = 0xc8553d, CONTORNO = 0x2a2018;

// ---------------------------------------------------------------- desenho
function poli(g, cor, pts, alpha = 1) { g.fillStyle(cor, alpha); g.fillPoints(pts, true); }
function contorno(g, pts, alpha = 0.55) { g.lineStyle(1, CONTORNO, alpha); g.strokePoints(pts, true, true); }
const quad = (f, u0, u1, z0, z1) => [f(u0, z0), f(u1, z0), f(u1, z1), f(u0, z1)];
function linha(g, a, b, cor, larg = 1, alpha = 1) { g.lineStyle(larg, cor, alpha); g.lineBetween(a.x, a.y, b.x, b.y); }

// caixa isométrica genérica
function caixa(g, x0, y0, w, d, z0, h, cTopo, cEsq, cDir, cont = true) {
  const x1 = x0 + w, y1 = y0 + d, z1 = z0 + h;
  const topo = [iso(x0, y0, z1), iso(x1, y0, z1), iso(x1, y1, z1), iso(x0, y1, z1)];
  const esq = [iso(x0, y1, z0), iso(x1, y1, z0), iso(x1, y1, z1), iso(x0, y1, z1)];
  const dir = [iso(x1, y1, z0), iso(x1, y0, z0), iso(x1, y0, z1), iso(x1, y1, z1)];
  poli(g, cEsq, esq); poli(g, cDir, dir); poli(g, cTopo, topo);
  if (cont) { contorno(g, esq, 0.5); contorno(g, dir, 0.5); contorno(g, topo, 0.5); }
}

function janelaFachada(g, f, u, z0, b) {
  if (b.varandas) {
    poli(g, 0xd9d3c6, quad(f, u - 0.32, u + 0.32, z0 - 3, z0));
  }
  poli(g, 0xf7f4ee, quad(f, u - 0.2, u + 0.2, z0 - 1, z0 + 21));
  poli(g, 0x2b3f5c, quad(f, u - 0.15, u + 0.15, z0 + 2, z0 + 19));
  linha(g, f(u - 0.1, z0 + 4), f(u - 0.02, z0 + 16), 0x6d8fb8);
  linha(g, f(u, z0 + 2), f(u, z0 + 19), 0xf7f4ee);
  if (b.portadas) {
    poli(g, 0x2f6b3c, quad(f, u - 0.33, u - 0.21, z0, z0 + 20));
    poli(g, 0x2f6b3c, quad(f, u + 0.21, u + 0.33, z0, z0 + 20));
  }
  if (b.varandas) {
    linha(g, f(u - 0.3, z0 + 8), f(u + 0.3, z0 + 8), 0x1d1d1d);
    for (let k = -0.3; k <= 0.31; k += 0.1) linha(g, f(u + k, z0), f(u + k, z0 + 8), 0x1d1d1d);
  }
}
function porta(g, f, u, cor, alta = 30) {
  poli(g, 0xf3efe6, quad(f, u - 0.22, u + 0.22, 0, alta + 2));
  poli(g, cor, quad(f, u - 0.17, u + 0.17, 0, alta - 1));
  linha(g, f(u, 0), f(u, alta - 1), escurecer(cor, 0.6));
  poli(g, 0xe2c05a, quad(f, u + 0.05, u + 0.09, 13, 15));
  poli(g, 0x9c9488, quad(f, u - 0.26, u + 0.26, 0, 2));
}
function montra(g, f, u0, u1) {
  poli(g, 0xf3efe6, quad(f, u0, u1, 6, 31));
  poli(g, 0x2b3f5c, quad(f, u0 + 0.05, u1 - 0.05, 8, 29));
  for (let u = u0 + 0.25; u < u1 - 0.1; u += 0.8) linha(g, f(u, 10), f(u + 0.15, 26), 0x6d8fb8);
}
function toldo(g, f, fora, u0, u1, c1, c2) {
  for (let u = u0, k = 0; u < u1 - 0.01; u += 0.25, k++) {
    const b = Math.min(u + 0.25, u1);
    poli(g, k % 2 ? c2 : c1, [f(u, 40), f(b, 40), fora(b, 30), fora(u, 30)]);
    poli(g, escurecer(k % 2 ? c2 : c1, 0.8), [fora(u, 30), fora(b, 30), fora(b, 25), fora(u, 25)]);
  }
  contorno(g, [f(u0, 40), f(u1, 40), fora(u1, 30), fora(u1, 25), fora(u0, 25), fora(u0, 30)], 0.6);
}
function azulejos(g, f, len, H) {
  for (let i = 0; i < len * 6; i++) for (let j = 0; j < Math.floor(H / 7); j++) {
    const u = i / 6, z = j * 7;
    if ((i + j) % 2 === 0) poli(g, 0x2a5ea8, quad(f, u + 0.03, u + 0.14, z + 1.5, z + 5.5));
    else poli(g, 0x7fa6dc, quad(f, u + 0.07, u + 0.1, z + 3, z + 4));
  }
}

function desenharEdificio(cena, b) {
  const g = cena.add.graphics().setDepth(b.prof);
  const x0 = b.x, y0 = b.y, w = b.w, d = b.d, H = b.h, x1 = x0 + w, y1 = y0 + d, ym = (y0 + y1) / 2;
  const R = Math.min(30, d * 7);
  const FL = (u, z) => iso(x0 + u, y1, z), FR = (u, z) => iso(x1, y1 - u, z);
  const foraL = (u, z) => iso(x0 + u, y1 + 0.45, z), foraR = (u, z) => iso(x1 + 0.45, y1 - u, z);
  const cE = b.cor, cD = escurecer(b.cor, 0.8);

  // água de trás do telhado
  poli(g, escurecer(TELHA, 0.72), [iso(x0, y0, H), iso(x1, y0, H), iso(x1, ym, H + R), iso(x0, ym, H + R)]);
  // fachadas
  const fl = quad(FL, 0, w, 0, H), fr = quad(FR, 0, d, 0, H);
  poli(g, cE, fl); poli(g, cD, fr);
  if (b.azulejo) { azulejos(g, FL, w, H); azulejos(g, FR, d, H); poli(g, 0x000000, fr, 0.14); }
  poli(g, 0x9c9488, quad(FL, 0, w, 0, 4)); poli(g, 0x857e73, quad(FR, 0, d, 0, 4));
  poli(g, 0xfaf7f0, quad(FL, 0, w, H - 6, H)); poli(g, 0xd8d3c8, quad(FR, 0, d, H - 6, H));
  poli(g, 0xfaf7f0, quad(FL, 0, w, 36, 39)); poli(g, 0xd8d3c8, quad(FR, 0, d, 36, 39));
  // pilares de cantaria nos cantos
  poli(g, 0xfaf7f0, quad(FL, 0, 0.1, 0, H)); poli(g, 0xece6da, quad(FL, w - 0.1, w, 0, H));
  poli(g, 0xd8d3c8, quad(FR, d - 0.1, d, 0, H));

  // andares
  const nAnd = Math.floor((H - 50) / 32);
  for (let a = 0; a < nAnd; a++) {
    const z0 = 48 + a * 32;
    for (let k = 0; k < w; k++) janelaFachada(g, FL, k + 0.5, z0, b);
    for (let k = 0; k < d; k++) janelaFachada(g, FR, k + 0.5, z0, b);
  }

  // rés-do-chão
  if (b.id === 'cafe') {
    const uP = y1 - (b.porta.gy + 0.5);
    montra(g, FR, 0.3, uP - 0.35); montra(g, FR, uP + 0.35, d - 0.3);
    porta(g, FR, uP, 0x2b3f5c);
    montra(g, FL, 0.3, w - 0.3);
    toldo(g, FR, foraR, 0.2, d - 0.2, 0x2f6b3c, 0xf3ead2);
    toldo(g, FL, foraL, 0.2, w - 0.2, 0x2f6b3c, 0xf3ead2);
  } else if (b.id === 'imob') {
    const uP = b.porta.gx + 0.5 - x0;
    montra(g, FL, 0.3, uP - 0.35); montra(g, FL, uP + 0.35, w - 0.3);
    porta(g, FL, uP, 0x2b3f5c);
    // anúncios na montra
    for (const u of [0.6, 1.2, 1.8, 3.2, 3.8, 4.4]) {
      poli(g, 0xffffff, quad(FL, u - 0.17, u + 0.17, 12, 26));
      poli(g, 0xc8553d, [FL(u - 0.1, 19), FL(u, 24), FL(u + 0.1, 19)]);
      poli(g, 0x3e8fc7, quad(FL, u - 0.07, u + 0.07, 14, 19));
    }
    montra(g, FR, 0.3, d - 0.3);
    toldo(g, FL, foraL, 0.2, w - 0.2, 0x2a6aa8, 0xffffff);
  } else if (b.id === 'casa') {
    const uP = y1 - (b.porta.gy + 0.5);
    for (let k = 0; k < d; k++) if (Math.abs(k + 0.5 - uP) > 0.6) janelaFachada(g, FR, k + 0.5, 8, { portadas: true });
    for (let k = 0; k < w; k++) janelaFachada(g, FL, k + 0.5, 8, { portadas: true });
    poli(g, 0xf3efe6, quad(FR, uP - 0.3, uP + 0.3, 0, 36));
    porta(g, FR, uP, 0x7a3f1d, 33);
  } else {
    const uP = Math.floor(w / 2) + 0.5;
    for (let k = 0; k < w; k++) if (k + 0.5 !== uP) janelaFachada(g, FL, k + 0.5, 8, b);
    for (let k = 0; k < d; k++) montra(g, FR, k + 0.15, k + 0.85);
    porta(g, FL, uP, 0x7a3f1d);
  }

  // empena e água da frente
  poli(g, cD, [iso(x1, y1, H), iso(x1, y0, H), iso(x1, ym, H + R)]);
  const frente = [iso(x0, y1, H), iso(x1, y1, H), iso(x1, ym, H + R), iso(x0, ym, H + R)];
  poli(g, TELHA, frente);
  for (let u = 0.2; u < w; u += 0.2) {
    linha(g, iso(x0 + u, y1, H), iso(x0 + u, ym, H + R), 0xa8402b, 1, 0.7);
    linha(g, iso(x0 + u, y0, H), iso(x0 + u, ym, H + R), 0x7a2e1f, 1, 0.5);
  }
  linha(g, iso(x0, ym, H + R), iso(x1, ym, H + R), 0xe07a5f, 2);
  // chaminé
  caixa(g, x0 + w * 0.7, ym - 0.6, 0.4, 0.4, H + R * 0.3, 22, 0xf3efe6, 0xe9e3d6, 0xcfc8b9);

  contorno(g, fl); contorno(g, fr); contorno(g, frente);
  contorno(g, [iso(x1, y1, H), iso(x1, y0, H), iso(x1, ym, H + R)]);

  // letreiros nas fachadas
  if (b.id === 'cafe') letreiro(cena, b, 'CAFÉ  A  BICA', '#1f4d2b', '#f4d27a', 'dir', y1 - (b.porta.gy + 0.5), 64);
  if (b.id === 'imob') letreiro(cena, b, 'TEJO IMÓVEIS', '#1f5f92', '#ffffff', 'esq', b.porta.gx + 0.5 - x0, 64);
  if (b.id === 'casa') letreiro(cena, b, 'Nº 28', '#2a5ea8', '#ffffff', 'dir', y1 - (b.porta.gy + 0.5), 52);
  if (b.letreiro) letreiro(cena, b, b.letreiro[0], b.letreiro[1], b.letreiro[2], 'dir', d / 2, 46);

  if (b.id) {
    // área clicável = silhueta do prédio
    const sil = [iso(x0, y1, 0), iso(x1, y1, 0), iso(x1, y0, 0), iso(x1, y0, H), iso(x1, ym, H + R), iso(x0, ym, H + R), iso(x0, y1, H)];
    g.setInteractive(new Phaser.Geom.Polygon(sil), Phaser.Geom.Polygon.Contains);
    g.input.cursor = 'pointer';
    g.setData('edificio', b.id);
    const topo = iso(x0 + w / 2, ym, H + R + 30);
    const t = cena.add.text(topo.x, topo.y, b.rotulo, {
      fontFamily: 'Verdana, sans-serif', fontStyle: 'bold', fontSize: '12px', color: '#ffffff',
      backgroundColor: '#1f5f92', padding: { x: 7, y: 4 }, stroke: '#000000', strokeThickness: 2,
    }).setOrigin(0.5, 1).setDepth(6000).setResolution(2).setInteractive({ cursor: 'pointer' });
    t.setData('edificio', b.id);
    cena.tweens.add({ targets: t, y: topo.y - 5, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
  }
  return g;
}

// letreiro com o texto inclinado para a fachada isométrica
let nLetreiros = 0;
function letreiro(cena, b, texto, fundo, cor, lado, uCentro, z) {
  const F = 'bold 10px Verdana, sans-serif';
  const m = document.createElement('canvas').getContext('2d'); m.font = F;
  const W = Math.ceil(m.measureText(texto).width) + 14, bh = 15, Ht = bh + Math.ceil(W / 2) + 1;
  const key = 'letreiro' + (nLetreiros++);
  const ct = cena.textures.createCanvas(key, W, Ht), c = ct.getContext();
  if (lado === 'esq') c.setTransform(1, 0.5, 0, 1, 0, 0); else c.setTransform(1, -0.5, 0, 1, 0, W / 2);
  c.fillStyle = '#000'; c.fillRect(0, 0, W, bh);
  c.fillStyle = fundo; c.fillRect(1, 1, W - 2, bh - 2);
  c.fillStyle = cor; c.font = F; c.textBaseline = 'middle'; c.fillText(texto, 7, bh / 2 + 1);
  ct.refresh();
  const x1 = b.x + b.w, y1 = b.y + b.d, du = W / 32;
  const p = lado === 'esq' ? iso(b.x + uCentro - du / 2, y1, z) : iso(x1, y1 - (uCentro - du / 2), z);
  cena.add.image(p.x, p.y, key).setOrigin(0, lado === 'esq' ? 0 : (W / 2) / Ht).setDepth(b.prof + 0.5);
}

// ---------------------------------------------------------------- avatar em pixel-art
const CABECA_FRENTE = [
  '................', '.....KKKKKK.....', '....KHHHHHHKK...', '...KHHHHHHHHHK..', '..KHHHHHHHHHHK..',
  '..KHHHSSSHHSHK..', '..KHSSSSSSSSSK..', '..KSSSSSESSESK..', '..KSSSSSESSESK..', '..KsSSSSSSSSSK..',
  '...KsSSSSSMMSK..', '....KsSSSSSSK...', '.....KKSSSKK....',
];
const CABECA_COSTAS = [
  '................', '.....KKKKKK.....', '....KHHHHHHKK...', '...KHHHHHHHHHK..', '..KHHHHHHHHHHK..',
  '..KHHHHHHHHHHK..', '..KHHHHHHHHHHK..', '..KHHHHHHHHHHK..', '..KHHHHHHHHHhK..', '..KhHHHHHHHHhK..',
  '...KhhHHHHHhK...', '....KsSSSSsK....', '.....KKSSSKK....',
];
const CORPO = [
  '.....KKTTTKK....', '...KKTTTTTTTKK..', '..KTTTTTTTTTTTK.', '..KTtTTTTTTTtTK.', '..KTtTTTTTTTtTK.',
  '..KTKTTTTTTTKTK.', '..KSKTTTTTTTKSK.', '..KSKPPPPPPPKSK.', '...KKPPPPPPPKK..',
];
const PERNAS = {
  S: ['....KPPPKPPPK...', '....KPPPKPPPK...', '....KPPpKPPpK...', '....KPPPKPPPK...', '....KPPPKPPPK...', '....KBBBKBBBK...', '....KBBBKBBBBK..', '....KKKKKKKKKK..'],
  A: ['....KPPPKPPPK...', '...KPPPK.KPPPK..', '...KPPPK.KPPPK..', '..KPPpK...KPPpK.', '..KPPPK...KPPPK.', '..KBBBK...KBBBK.', '..KBBBBK..KBBBBK', '..KKKKKK..KKKKKK'],
  B: ['....KPPPKPPPK...', '....KPPPKPPPK...', '...KPPPK.KPPPK..', '...KPpPK.KPPpK..', '..KPPPK...KPPPK.', '..KBBBK...KBBBK.', '.KBBBBK...KBBBBK', '.KKKKKK...KKKKKK'],
};
const PX = 2, AV_W = 16 * PX, AV_H = 30 * PX;
function texturaAvatar(cena, key, cores) {
  const pal = {
    K: '#1d1612', E: '#1d1612', M: '#b5574a', B: '#2b2b30',
    H: cores.cabelo, h: sombra(cores.cabelo), S: cores.pele, s: sombra(cores.pele),
    T: cores.camisola, t: sombra(cores.camisola), P: cores.calcas || '#2c3e66', p: sombra(cores.calcas || '#2c3e66'),
  };
  const quadros = [];
  for (const vista of ['F', 'C']) for (const p of ['S', 'A', 'B']) quadros.push([vista + p, (vista === 'F' ? CABECA_FRENTE : CABECA_COSTAS).concat(CORPO, PERNAS[p])]);
  let ct = cena.textures.exists(key) ? cena.textures.get(key) : null;
  if (!ct) {
    ct = cena.textures.createCanvas(key, AV_W * quadros.length, AV_H);
    quadros.forEach(([n], i) => ct.add(n, 0, i * AV_W, 0, AV_W, AV_H));
  }
  const c = ct.getContext();
  c.clearRect(0, 0, ct.width, ct.height);
  quadros.forEach(([, linhas], i) => {
    linhas.forEach((l, y) => [...l].forEach((ch, x) => {
      if (ch === '.') return;
      c.fillStyle = pal[ch]; c.fillRect(i * AV_W + x * PX, y * PX, PX, PX);
    }));
  });
  ct.refresh();
}
function sombra(hex) { const n = hexNum(hex); return '#' + escurecer(n, 0.72).toString(16).padStart(6, '0'); }

// ---------------------------------------------------------------- bonecos
class Boneco {
  constructor(cena, key, nome, gx, gy, opts = {}) {
    this.cena = cena; this.key = key; this.nome = nome; this.opts = opts;
    this.px = gx + 0.5; this.py = gy + 0.5; this.caminho = []; this.tempo = 0;
    this.frente = true; this.virado = false; this.aoChegar = null;
    const p = iso(this.px, this.py);
    this.sombra = cena.add.ellipse(0, 0, 30, 12, 0x000000, 0.22);
    this.spr = cena.add.sprite(0, 2, key, 'FS').setOrigin(0.5, 1);
    this.c = cena.add.container(p.x, p.y, [this.sombra, this.spr]);
    this.c.setSize(AV_W, AV_H);
    this.etiqueta = cena.add.text(p.x, p.y, nome, {
      fontFamily: 'Verdana, sans-serif', fontSize: '10px', color: opts.jogador ? '#ffd84a' : '#ffffff',
      backgroundColor: 'rgba(0,0,0,0.55)', padding: { x: 4, y: 1 },
    }).setOrigin(0.5, 1).setDepth(6001).setResolution(2);
    if (!opts.jogador) {
      this.spr.setInteractive({ cursor: 'pointer' });
      this.spr.setData('boneco', this);
    }
    this.balao = null;
    this.atualizarVisual();
  }
  irPara(tx, ty, aoChegar) {
    const alvo = livre(tx, ty) ? { x: tx, y: ty } : livreMaisProximo(tx, ty);
    if (!alvo) return false;
    const emCurso = this.caminho[0];
    const ini = emCurso || { x: Math.floor(this.px), y: Math.floor(this.py) };
    const r = caminho(ini.x, ini.y, alvo.x, alvo.y);
    if (!r) return false;
    this.caminho = emCurso ? [emCurso, ...r] : r;
    this.aoChegar = aoChegar || null;
    if (!this.caminho.length) { const f = this.aoChegar; this.aoChegar = null; if (f) f(); }
    return true;
  }
  get aAndar() { return this.caminho.length > 0; }
  get mosaico() { return { x: Math.floor(this.px), y: Math.floor(this.py) }; }
  update(dt) {
    if (this.caminho.length) {
      const n = this.caminho[0], tx = n.x + 0.5, ty = n.y + 0.5;
      const dx = tx - this.px, dy = ty - this.py, dist = Math.hypot(dx, dy);
      const vel = (this.opts.velocidade || 3.4) * (this.opts.jogador && E.energia <= 0 ? 0.55 : 1);
      const passo = vel * dt;
      const sx = dx - dy, sy = dx + dy;
      if (dist > 0.001) { this.frente = sy > -0.01; this.virado = sx < -0.01; }
      if (dist <= passo) {
        this.px = tx; this.py = ty; this.caminho.shift();
        if (!this.caminho.length) { const f = this.aoChegar; this.aoChegar = null; if (f) f(); }
      } else { this.px += dx / dist * passo; this.py += dy / dist * passo; }
      this.tempo += dt;
    } else this.tempo = 0;
    this.atualizarVisual();
  }
  atualizarVisual() {
    const p = iso(this.px, this.py);
    this.c.setPosition(p.x, p.y).setDepth(profundidade(this.px, this.py));
    const ciclo = ['A', 'S', 'B', 'S'];
    const q = this.caminho.length ? ciclo[Math.floor(this.tempo * 9) % 4] : 'S';
    this.spr.setFrame((this.frente ? 'F' : 'C') + q).setFlipX(this.frente ? this.virado : !this.virado);
    this.spr.y = this.caminho.length && q !== 'S' ? 1 : 2;
    this.etiqueta.setPosition(p.x, p.y - AV_H - 2);
    if (this.balao) this.balao.setPosition(p.x, p.y - AV_H - 20 - this.balao.subida);
  }
  dizer(texto, ms = 4500) {
    const cena = this.cena;
    if (this.balao) this.balao.destroy();
    const t = cena.add.text(0, 0, '', { fontFamily: 'Verdana, sans-serif', fontSize: '11px', color: '#000000', wordWrap: { width: 190 } })
      .setResolution(2);
    t.setText(texto);
    const w = Math.max(40, t.width + 14), h = t.height + 10;
    t.setPosition(-w / 2 + 7, -h + 5);
    const g = cena.add.graphics();
    g.fillStyle(0x000000, 1).fillRoundedRect(-w / 2 - 1, -h - 1, w + 2, h + 2, 6);
    g.fillStyle(0xffffff, 1).fillRoundedRect(-w / 2, -h, w, h, 5);
    g.fillStyle(0x000000, 1).fillTriangle(-6, -1, 6, -1, 0, 8);
    g.fillStyle(0xffffff, 1).fillTriangle(-4, -2, 4, -2, 0, 5);
    const b = cena.add.container(0, 0, [g, t]).setDepth(7000);
    b.subida = 0;
    this.balao = b;
    cena.tweens.add({ targets: b, subida: 10, duration: ms, ease: 'Sine.out' });
    cena.time.delayedCall(ms, () => { if (this.balao === b) { this.balao = null; } cena.tweens.add({ targets: b, alpha: 0, duration: 300, onComplete: () => b.destroy() }); });
    this.atualizarVisual();
  }
}

// ---------------------------------------------------------------- NPCs
const NPCS = [
  { nome: 'Fatima_Alfama', camisola: '#2b2b30', cabelo: '#b9b9b9', pele: '#f1c39b', calcas: '#5b2a3a', gx: 8, gy: 12,
    falas: ['Ó filho, já comeste?', 'Sardinha fresquinha só no Santo António!', 'Isto antigamente era tudo mais barato…', 'Cuidado com o elétrico!'] },
  { nome: 'Klaus.Turista', camisola: '#f28c28', cabelo: '#e0b44a', pele: '#f6d2b8', calcas: '#c9b48a', gx: 18, gy: 13,
    falas: ['Where is the pastel de nata?', 'Obrigado! Obrigado!', 'So many hills…', 'Is this the famous tram 28?'] },
  { nome: 'ZeDoTukTuk', camisola: '#3fa34d', cabelo: '#1f1a17', pele: '#c98e62', gx: 13, gy: 21,
    falas: ['Tuk-tuk! Alfama, Castelo, 20 euros!', 'Vai um passeio, amigo?', 'Hoje está fraco, só alemães.'] },
  { nome: 'Rita_Estudante', camisola: '#8a4fd1', cabelo: '#b5502a', pele: '#f1c39b', calcas: '#2c3e66', gx: 20, gy: 24,
    falas: ['As rendas estão impossíveis 😩', 'Alguém sabe de um quarto barato?', 'Vou ali ao café estudar.', 'Ginjinha logo à noite?'] },
];

// ---------------------------------------------------------------- tempo e luz
const NOITE = 0x4b5796, AURORA = 0xf0c0b0, DIA = 0xffffff, POR = 0xf6b27a;
const CHAVES_LUZ = [[0, NOITE, 1], [5, NOITE, 1], [6.5, AURORA, 0.35], [8, DIA, 0], [17.5, DIA, 0], [19.2, POR, 0.3], [20.5, NOITE, 1], [24, NOITE, 1]];
function luz(h) {
  for (let i = 0; i < CHAVES_LUZ.length - 1; i++) {
    const [a, ca, na] = CHAVES_LUZ[i], [b, cb, nb] = CHAVES_LUZ[i + 1];
    if (h >= a && h <= b) { const t = (h - a) / (b - a); return { cor: misturar(ca, cb, t), noite: na + (nb - na) * t }; }
  }
  return { cor: DIA, noite: 0 };
}
const fmtHora = m => String(Math.floor(m / 60) % 24).padStart(2, '0') + ':' + String(Math.floor(m % 60)).padStart(2, '0');
const euros = c => (c / 100).toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' });

// ---------------------------------------------------------------- cena
class Bairro extends Phaser.Scene {
  constructor() { super('bairro'); }

  create() {
    cena = this;
    this.cameras.main.setBounds(0, 0, WORLD_W, WORLD_H).setBackgroundColor('#0e1b2a');
    this.desenharChao();
    this.desenharDecoracao();
    EDIFICIOS.forEach(b => desenharEdificio(this, b));
    this.criarElectrico();

    // noite: retângulo em modo multiplicar sobre todo o mundo
    this.noite = this.add.rectangle(0, 0, WORLD_W, WORLD_H, 0xffffff).setOrigin(0).setDepth(5000).setBlendMode(Phaser.BlendModes.MULTIPLY);

    // cursor de mosaico
    this.cursor = this.add.graphics().setDepth(-500);

    // jogador
    texturaAvatar(this, 'jogador', E);
    this.jogador = new Boneco(this, 'jogador', E.nome || 'Lisboeta', E.gx, E.gy, { jogador: true });
    this.cameras.main.startFollow(this.jogador.c, true, 0.12, 0.12);

    // NPCs
    this.npcs = NPCS.map((n, i) => {
      texturaAvatar(this, 'npc' + i, n);
      const b = new Boneco(this, 'npc' + i, n.nome, n.gx, n.gy, { velocidade: 2.4 });
      b.falas = n.falas; b.espera = 1 + Math.random() * 3; b.proxFala = 6 + Math.random() * 14;
      return b;
    });

    this.configurarInput();
    this.aplicarZoom();
    this.scale.on('resize', () => this.aplicarZoom());
    this.relogioGuardar = 0;
    iniciarUI();
  }

  aplicarZoom() {
    const cam = this.cameras.main;
    cam.setZoom(zoomAtual);
  }

  // ---------- chão
  desenharChao() {
    const g = this.make.graphics({}, false);
    const BASE = { passeio: 0xcdbf9f, estrada: 0x3d4045, praca: 0xcdbf9f, jardim: 0x5f9a3c };
    for (let i = 0; i < MW; i++) for (let j = 0; j < MH; j++) {
      const t = tipoChao(i, j);
      poli(g, BASE[t], [iso(i, j), iso(i + 1, j), iso(i + 1, j + 1), iso(i, j + 1)]);
      if (t === 'jardim') {
        poli(g, 0x74b04c, [iso(i + 0.02, j + 0.02), iso(i + 0.98, j + 0.02), iso(i + 0.98, j + 0.98), iso(i + 0.02, j + 0.98)]);
        for (let k = 0; k < 5; k++) {
          const p = iso(i + hash(i, j, k), j + hash(j, i, k + 9));
          linha(g, p, { x: p.x - 1, y: p.y - 4 }, 0x4f8a2f); linha(g, p, { x: p.x + 2, y: p.y - 3 }, 0x8fcf5f);
        }
        continue;
      }
      const n = t === 'estrada' ? 2 : 3, gap = t === 'estrada' ? 0.035 : 0.025;
      for (let a = 0; a < n; a++) for (let b = 0; b < n; b++) {
        const u0 = i + a / n + gap, u1 = i + (a + 1) / n - gap, v0 = j + b / n + gap, v1 = j + (b + 1) / n - gap;
        const r = hash(i * 3 + a, j * 3 + b);
        let cor;
        if (t === 'estrada') cor = [0x5d6168, 0x666a72, 0x53575d][Math.floor(r * 3)];
        else if (t === 'praca') {
          const cu = (u0 + u1) / 2, cv = (v0 + v1) / 2;
          const onda = ((cv + 1.4 * Math.sin(cu * 0.75)) % 3 + 3) % 3;
          cor = onda < 1 ? [0x2e2e33, 0x38383e][r > 0.5 ? 1 : 0] : [0xeee7d4, 0xf3eddc, 0xe8e0cb][Math.floor(r * 3)];
        } else cor = [0xeee7d4, 0xe4dcc6, 0xf3eddc][Math.floor(r * 3)];
        poli(g, cor, [iso(u0, v0), iso(u1, v0), iso(u1, v1), iso(u0, v1)]);
      }
    }
    // lancis entre passeio e estrada
    for (let i = 0; i < MW; i++) for (let j = 0; j < MH; j++) {
      if (tipoChao(i, j) === 'estrada') continue;
      const est = (x, y) => x >= 0 && y >= 0 && x < MW && y < MH && tipoChao(x, y) === 'estrada';
      if (est(i + 1, j)) linha(g, iso(i + 1, j), iso(i + 1, j + 1), 0xfbf8f0, 2);
      if (est(i - 1, j)) linha(g, iso(i, j), iso(i, j + 1), 0xfbf8f0, 2);
      if (est(i, j + 1)) linha(g, iso(i, j + 1), iso(i + 1, j + 1), 0xfbf8f0, 2);
      if (est(i, j - 1)) linha(g, iso(i, j), iso(i + 1, j), 0xfbf8f0, 2);
    }
    // passadeiras
    for (const gy of [10, 15]) for (const gx of [12, 13]) for (let k = 0; k < 5; k++) {
      const u = gx + k * 0.2 + 0.04;
      poli(g, 0xf4f1ea, [iso(u, gy + 0.12), iso(u + 0.11, gy + 0.12), iso(u + 0.11, gy + 0.88), iso(u, gy + 0.88)]);
    }
    for (const gx of [10, 15]) for (const gy of [12, 13]) for (let k = 0; k < 5; k++) {
      const v = gy + k * 0.2 + 0.04;
      poli(g, 0xf4f1ea, [iso(gx + 0.12, v), iso(gx + 0.88, v), iso(gx + 0.88, v + 0.11), iso(gx + 0.12, v + 0.11)]);
    }
    // carris do elétrico
    for (const gx of [12.78, 13.22]) {
      linha(g, iso(gx, 0), iso(gx, MH), 0x2a2c30, 3);
      linha(g, iso(gx, 0), iso(gx, MH), 0xaab0b8, 1);
    }
    // espessura do "ilhéu" (estilo quarto de hotel de pixéis)
    poli(g, 0x7a6f5c, [iso(0, MH), iso(MW, MH), iso(MW, MH, -16), iso(0, MH, -16)]);
    poli(g, 0x5e5545, [iso(MW, MH), iso(MW, 0), iso(MW, 0, -16), iso(MW, MH, -16)]);
    // sombras estáticas
    ARVORES.forEach(([i, j]) => { const p = iso(i + 0.5, j + 0.5); g.fillStyle(0x000000, 0.18).fillEllipse(p.x + 6, p.y, 54, 24); });
    EDIFICIOS.forEach(b => {
      const s = 0.9;
      poli(g, 0x000000, [iso(b.x + b.w, b.y + b.d), iso(b.x + b.w + s, b.y + b.d), iso(b.x + b.w + s, b.y + s), iso(b.x + b.w, b.y)], 0.12);
    });
    const rt = this.add.renderTexture(0, 0, WORLD_W, WORLD_H).setOrigin(0).setDepth(-1000);
    rt.draw(g); g.destroy();
  }

  // ---------- árvores, candeeiros, bancos, fonte...
  desenharDecoracao() {
    this.brilhos = [];
    const tex = this.textures.createCanvas('brilho', 200, 120), c = tex.getContext();
    const gr = c.createRadialGradient(100, 60, 2, 100, 60, 60);
    gr.addColorStop(0, 'rgba(255,214,130,0.85)'); gr.addColorStop(1, 'rgba(255,214,130,0)');
    c.setTransform(1, 0, 0, 0.6, 0, 24); c.fillStyle = gr; c.fillRect(0, 0, 200, 200); tex.refresh();
    const tex2 = this.textures.createCanvas('brilho2', 40, 40), c2 = tex2.getContext();
    const gr2 = c2.createRadialGradient(20, 20, 1, 20, 20, 20);
    gr2.addColorStop(0, 'rgba(255,240,190,1)'); gr2.addColorStop(1, 'rgba(255,220,140,0)');
    c2.fillStyle = gr2; c2.fillRect(0, 0, 40, 40); tex2.refresh();

    ARVORES.forEach(([i, j]) => {
      const g = this.add.graphics().setDepth(profundidade(i + 0.5, j + 0.5)), p = iso(i + 0.5, j + 0.5);
      g.fillStyle(0x4a3220).fillRect(p.x - 4, p.y - 36, 8, 36);
      g.fillStyle(0x6b4a2e).fillRect(p.x - 3, p.y - 36, 4, 36);
      const bolas = [[0, -56, 24, 0x5d3f96], [-15, -48, 16, 0x6d4aa8], [15, -50, 17, 0x6d4aa8], [-6, -64, 16, 0x8a63c9], [8, -62, 14, 0x8a63c9], [-3, -70, 10, 0xa883e0], [-12, -56, 8, 0xa883e0], [12, -58, 7, 0xc8a8f2]];
      bolas.forEach(([dx, dy, r, cor]) => { g.fillStyle(cor).fillCircle(p.x + dx, p.y + dy, r); });
      for (let k = 0; k < 10; k++) g.fillStyle(0xd7bff7).fillRect(p.x - 18 + hash(i, j, k) * 34, p.y - 76 + hash(j, i, k) * 36, 2, 2);
    });

    CANDEEIROS.forEach(([i, j]) => {
      const g = this.add.graphics().setDepth(profundidade(i + 0.5, j + 0.5)), p = iso(i + 0.5, j + 0.5);
      g.fillStyle(0x1f2a26).fillRect(p.x - 4, p.y - 6, 8, 6);
      g.fillStyle(0x2b3a35).fillRect(p.x - 1, p.y - 60, 3, 56);
      g.fillStyle(0x1f2a26).fillRect(p.x - 7, p.y - 74, 14, 3).fillRect(p.x - 6, p.y - 62, 12, 2);
      g.fillStyle(0xffe8a0).fillRect(p.x - 5, p.y - 71, 10, 9);
      g.fillStyle(0x1f2a26).fillRect(p.x - 1, p.y - 71, 2, 9).fillTriangle(p.x - 7, p.y - 74, p.x + 7, p.y - 74, p.x, p.y - 80);
      const b1 = this.add.image(p.x, p.y, 'brilho').setDepth(5001).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0);
      const b2 = this.add.image(p.x, p.y - 66, 'brilho2').setDepth(5002).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0);
      this.brilhos.push(b1, b2);
    });

    BANCOS.forEach(([i, j]) => {
      const g = this.add.graphics().setDepth(profundidade(i + 0.5, j + 0.5));
      caixa(g, i + 0.1, j + 0.3, 0.8, 0.07, 12, 13, 0xb07a45, 0x9a6a3c, 0x7d5530);
      caixa(g, i + 0.15, j + 0.4, 0.06, 0.3, 0, 10, 0x2b2b30, 0x2b2b30, 0x1d1d20, false);
      caixa(g, i + 0.79, j + 0.4, 0.06, 0.3, 0, 10, 0x2b2b30, 0x2b2b30, 0x1d1d20, false);
      caixa(g, i + 0.1, j + 0.37, 0.8, 0.36, 10, 3, 0xc58b51, 0x9a6a3c, 0x7d5530);
    });

    MESAS.forEach(([i, j]) => {
      const g = this.add.graphics().setDepth(profundidade(i + 0.5, j + 0.5));
      caixa(g, i + 0.1, j + 0.35, 0.22, 0.22, 0, 10, 0xb5b9be, 0x8d9196, 0x74787d);
      caixa(g, i + 0.46, j + 0.46, 0.08, 0.08, 0, 15, 0x666, 0x555555, 0x444444, false);
      caixa(g, i + 0.25, j + 0.25, 0.5, 0.5, 15, 2, 0xf4f1ea, 0xd9d4c8, 0xc5c0b4);
      caixa(g, i + 0.68, j + 0.6, 0.22, 0.22, 0, 10, 0xb5b9be, 0x8d9196, 0x74787d);
      linha(g, iso(i + 0.5, j + 0.5, 17), iso(i + 0.5, j + 0.5, 50), 0x444444, 2);
      const A = iso(i + 0.5, j + 0.5, 60), T = iso(i + 0.5, j - 0.3, 45), Rr = iso(i + 1.3, j + 0.5, 45), Bt = iso(i + 0.5, j + 1.3, 45), L = iso(i - 0.3, j + 0.5, 45);
      poli(g, 0x24552f, [A, L, T]); poli(g, 0xd9cfb5, [A, T, Rr]);
      poli(g, 0xf3ead2, [A, Rr, Bt]); poli(g, 0x2f6b3c, [A, Bt, L]);
      contorno(g, [L, Bt, Rr, A], 0.6);
      g.fillStyle(0xffffff).fillRect(iso(i + 0.5, j + 0.5, 17).x - 2, iso(i + 0.5, j + 0.5, 21).y, 4, 4);
    });

    // fonte da praça
    const f = this.add.graphics().setDepth(profundidade(FONTE.x + 1, FONTE.y + 1.6));
    const { x: fx, y: fy } = FONTE;
    caixa(f, fx + 0.1, fy + 0.1, 1.8, 1.8, 0, 12, 0xd9d2c3, 0xc9c1b0, 0xa9a190);
    caixa(f, fx + 0.25, fy + 0.25, 1.5, 1.5, 2, 9, 0x4f9fd6, 0xc9c1b0, 0xa9a190, false);
    poli(f, 0x7cc0ea, [iso(fx + 0.5, fy + 0.4, 11), iso(fx + 1.2, fy + 0.4, 11), iso(fx + 1.2, fy + 0.6, 11), iso(fx + 0.5, fy + 0.6, 11)], 0.8);
    caixa(f, fx + 0.85, fy + 0.85, 0.3, 0.3, 11, 26, 0xd9d2c3, 0xc9c1b0, 0xa9a190);
    caixa(f, fx + 0.6, fy + 0.6, 0.8, 0.8, 37, 5, 0x4f9fd6, 0xc9c1b0, 0xa9a190);
    caixa(f, fx + 0.93, fy + 0.93, 0.14, 0.14, 42, 10, 0x6e8a6f, 0x5c7a5d, 0x4a654b);
    this.fonteTopo = iso(fx + 1, fy + 1, 52);
    this.time.addEvent({ delay: 120, loop: true, callback: () => this.gota() });

    // paragem do elétrico
    const pg = this.add.graphics().setDepth(profundidade(14.2, 7.5)), pp = iso(14.15, 7.5);
    pg.fillStyle(0x2b3a35).fillRect(pp.x - 1, pp.y - 52, 3, 52);
    pg.fillStyle(0x000000).fillRect(pp.x - 12, pp.y - 66, 24, 15);
    pg.fillStyle(0xf5c518).fillRect(pp.x - 11, pp.y - 65, 22, 13);
    this.add.text(pp.x, pp.y - 58, '28E', { fontFamily: 'Verdana', fontStyle: 'bold', fontSize: '9px', color: '#000' })
      .setOrigin(0.5).setDepth(pg.depth + 0.1).setResolution(2);
  }

  gota() {
    const p = this.fonteTopo;
    const r = this.add.rectangle(p.x + (Math.random() - 0.5) * 4, p.y, 2, 2, 0xbfe6ff).setDepth(profundidade(FONTE.x + 1, FONTE.y + 1.6) + 0.1);
    const dx = (Math.random() - 0.5) * 34;
    this.tweens.add({ targets: r, x: p.x + dx, duration: 700, ease: 'Linear' });
    this.tweens.add({ targets: r, y: p.y - 10, duration: 220, ease: 'Quad.out', yoyo: false,
      onComplete: () => this.tweens.add({ targets: r, y: p.y + 38, alpha: 0.3, duration: 480, ease: 'Quad.in', onComplete: () => r.destroy() }) });
  }

  // ---------- elétrico 28
  criarElectrico() {
    const g = this.add.graphics();
    const x0 = 12.2, w = 1.6, d = 3.2;
    const amarelo = 0xf5c518;
    caixa(g, x0 + 0.1, 0.1, w - 0.2, d - 0.2, 0, 6, 0x222222, 0x222222, 0x1a1a1a, false);
    caixa(g, x0, 0, w, d, 6, 22, amarelo, amarelo, 0xd9a90f);
    caixa(g, x0, 0, w, d, 28, 18, 0xf6f2e6, 0xf6f2e6, 0xd8d2c2);
    caixa(g, x0 + 0.05, 0.05, w - 0.1, d - 0.1, 46, 4, 0xd0d0d0, 0xbdbdbd, 0xa5a5a5);
    // janelas laterais (face direita = lado do passeio)
    const FR = (u, z) => iso(x0 + w, d - u, z), FL = (u, z) => iso(x0 + u, d, z);
    for (let u = 0.25; u < d - 0.3; u += 0.48) poli(g, 0x2b3f5c, quad(FR, u, u + 0.32, 30, 43));
    poli(g, 0x2b3f5c, quad(FL, 0.25, w - 0.25, 30, 43));
    poli(g, 0x111111, quad(FL, 0.45, w - 0.45, 21, 27));
    linha(g, FL(0.5, 24), FL(0.75, 24), 0xffd23f, 2);
    poli(g, 0xfff4b0, quad(FL, 0.15, 0.3, 10, 14)); poli(g, 0xfff4b0, quad(FL, w - 0.3, w - 0.15, 10, 14));
    // pantógrafo até ao fio
    linha(g, iso(x0 + w / 2, d / 2, 50), iso(13, d / 2 - 0.5, 78), 0x222222, 2);
    this.electrico = { g, t: -8, espera: 4 };
    // fio aéreo
    const fio = this.add.graphics().setDepth(4000);
    linha(fio, iso(13, 0, 78), iso(13, MH, 78), 0x1a1a1a, 1, 0.45);
  }
  atualizarElectrico(dt) {
    const el = this.electrico;
    if (el.espera > 0) { el.espera -= dt; el.g.setVisible(false); return; }
    el.g.setVisible(true);
    el.t += dt * 1.6;
    if (el.t > MH + 2) { el.t = -6; el.espera = 18 + Math.random() * 20; return; }
    const o = iso(0, el.t), z = iso(0, 0);
    el.g.setPosition(o.x - z.x, o.y - z.y).setDepth(iso(13.8, el.t + 3.2).y);
    if (!el.tocou && el.t > 2) { el.tocou = true; this.textoFlutuante(iso(13, el.t + 1.6, 80), 'dlim dlim! 🔔'); }
    if (el.t < 0) el.tocou = false;
  }
  textoFlutuante(p, txt) {
    const t = this.add.text(p.x, p.y, txt, { fontFamily: 'Verdana', fontStyle: 'bold', fontSize: '11px', color: '#ffffff', stroke: '#000', strokeThickness: 3 })
      .setOrigin(0.5).setDepth(7000).setResolution(2);
    this.tweens.add({ targets: t, y: p.y - 30, alpha: 0, duration: 1800, delay: 400, onComplete: () => t.destroy() });
    return t;
  }

  // ---------- input (toque / rato)
  configurarInput() {
    const cam = this.cameras.main;
    let inicio = null, arrastar = false;
    this.input.on('pointerdown', p => { inicio = { x: p.x, y: p.y }; arrastar = false; });
    this.input.on('pointermove', p => {
      if (p.isDown && inicio) {
        if (!arrastar && Math.hypot(p.x - inicio.x, p.y - inicio.y) > 10) { arrastar = true; cam.stopFollow(); }
        if (arrastar) { cam.scrollX -= (p.x - p.prevPosition.x) / cam.zoom; cam.scrollY -= (p.y - p.prevPosition.y) / cam.zoom; }
      }
      if (p.wasTouch) return;
      this.mostrarCursor(p.worldX, p.worldY);
    });
    this.input.on('pointerup', (p, sobre) => {
      if (arrastar || !inicio) { inicio = null; return; }
      inicio = null;
      if (ocupado) return;
      fecharJanela();
      const alvo = sobre && sobre[0];
      if (alvo && alvo.getData('edificio')) return irParaEdificio(alvo.getData('edificio'));
      if (alvo && alvo.getData('boneco')) {
        const b = alvo.getData('boneco');
        return b.dizer(b.falas[Math.floor(Math.random() * b.falas.length)]);
      }
      const { gx, gy } = paraGrelha(p.worldX, p.worldY);
      const i = Math.floor(gx), j = Math.floor(gy);
      if (i < 0 || j < 0 || i >= MW || j >= MH) return;
      this.mostrarCursor(p.worldX, p.worldY, true);
      cam.startFollow(this.jogador.c, true, 0.12, 0.12);
      if (!this.jogador.irPara(i, j, () => aoChegar())) aviso('Não consegues chegar aí.');
    });
  }
  mostrarCursor(wx, wy, toque) {
    const { gx, gy } = paraGrelha(wx, wy), i = Math.floor(gx), j = Math.floor(gy);
    this.cursor.clear();
    if (i < 0 || j < 0 || i >= MW || j >= MH) return;
    const pts = [iso(i, j), iso(i + 1, j), iso(i + 1, j + 1), iso(i, j + 1)];
    this.cursor.lineStyle(2, livre(i, j) ? 0xffffff : 0xff5a3c, 0.9).strokePoints(pts, true, true);
    this.cursor.fillStyle(0xffffff, 0.12).fillPoints(pts, true);
    if (toque) { this.cursor.alpha = 1; this.tweens.add({ targets: this.cursor, alpha: 0, duration: 600, delay: 200 }); }
    else { this.tweens.killTweensOf(this.cursor); this.cursor.alpha = 1; }
  }

  update(_, ms) {
    const dt = Math.min(ms, 100) / 1000;
    this.jogador.update(dt);
    this.npcs.forEach(n => {
      n.update(dt);
      if (!n.aAndar) {
        n.espera -= dt;
        if (n.espera <= 0) {
          const m = n.mosaico;
          for (let k = 0; k < 10; k++) {
            const tx = m.x + Math.round((Math.random() - 0.5) * 14), ty = m.y + Math.round((Math.random() - 0.5) * 14);
            if (livre(tx, ty) && n.irPara(tx, ty)) break;
          }
          n.espera = 2 + Math.random() * 5;
        }
      }
      n.proxFala -= dt;
      if (n.proxFala <= 0) { n.proxFala = 14 + Math.random() * 20; n.dizer(n.falas[Math.floor(Math.random() * n.falas.length)]); }
    });
    this.atualizarElectrico(dt);

    // relógio: 1 segundo real = 2 minutos no jogo
    if (!ocupado && E.criado) {
      avancarTempo(dt * 2);
      E.energia = Math.max(0, E.energia - dt * 2 / 15);
    }
    const l = luz((E.minutos / 60) % 24);
    this.noite.fillColor = l.cor;
    this.brilhos.forEach(b => b.setAlpha(l.noite * 0.95));

    this.relogioGuardar += dt;
    if (this.relogioGuardar > 5) { this.relogioGuardar = 0; guardarPosicao(); }
    atualizarHUD();
  }
}

// ---------------------------------------------------------------- lógica do jogo
let cena = null, ocupado = false;
let zoomAtual = Math.min(window.innerWidth, window.innerHeight) >= 900 ? 2 : 1;

function guardarPosicao() { if (!cena) return; const m = cena.jogador.mosaico; E.gx = m.x; E.gy = m.y; guardar(); }

function avancarTempo(min) {
  E.minutos += min;
  while (E.minutos >= 1440) { E.minutos -= 1440; novoDia(); }
}
function novoDia() {
  E.dia++;
  if (E.casa && E.dia > E.casaAte) {
    E.casa = null;
    aviso('📄 O contrato de arrendamento acabou e não renovaste. Perdeste a casa!', 5000);
  }
  guardar();
}
const horaAtual = () => E.minutos / 60;

function irParaEdificio(id) {
  const b = EDIFICIOS.find(x => x.id === id);
  cena.cameras.main.startFollow(cena.jogador.c, true, 0.12, 0.12);
  if (!cena.jogador.irPara(b.porta.gx, b.porta.gy, () => aoChegar())) aviso('Não consegues chegar à porta.');
}
function aoChegar() {
  const m = cena.jogador.mosaico;
  guardarPosicao();
  const b = EDIFICIOS.find(x => x.porta && x.porta.gx === m.x && x.porta.gy === m.y);
  if (b) abrirEdificio(b.id);
}

function abrirEdificio(id) {
  if (id === 'cafe') return janelaCafe();
  if (id === 'imob') return janelaImob();
  if (id === 'casa') return janelaCasa();
}

function cartao(ico, titulo, sub, botao, acao, opts = {}) {
  return `<div class="cartao ${opts.atual ? 'atual' : ''}"><div class="ico">${ico}</div><div><b>${titulo}</b><small>${sub}</small></div>
    <button class="${opts.cor || 'verde'}" data-acao="${acao}" data-valor="${opts.valor || ''}" ${opts.desativado ? 'disabled' : ''}>${botao}</button></div>`;
}

function janelaCafe() {
  const h = horaAtual(), aberto = h >= 7 && h < 23, podeTurno = h >= 7 && h <= 19;
  let txt = aberto
    ? (podeTurno ? 'O Sr. Armando precisa de ajuda ao balcão. Paga 7 € à hora.' : 'Já não há turnos hoje, mas ainda se serve uma bica.')
    : 'Está fechado. O café abre às 7h00.';
  abrirJanela('☕ Café A Bica — Chiado', `<p>${txt}</p><div class="opcoes">
    ${cartao('🧑‍🍳', 'Trabalhar um turno', '4 horas · +28,00 € · −25 energia', 'Trabalhar', 'trabalhar', { desativado: !podeTurno || E.energia < 25 })}
    ${cartao('☕', 'Uma bica', '0,80 € · +6 energia', 'Pedir', 'comprar', { valor: 'bica', cor: 'azul', desativado: !aberto || E.dinheiro < 80 })}
    ${cartao('🥧', 'Pastel de nata', '1,30 € · +10 energia', 'Comer', 'comprar', { valor: 'nata', cor: 'azul', desativado: !aberto || E.dinheiro < 130 })}
  </div>${E.energia < 25 && podeTurno ? '<p class="nota">Estás demasiado cansado para trabalhar. Bebe uma bica ou vai dormir.</p>' : ''}`);
}

function janelaImob() {
  const h = horaAtual(), aberto = h >= 9 && h < 19;
  let html = `<p>${aberto ? 'Temos pouca oferta e muita procura… mas para si arranja-se sempre qualquer coisa no <b>Prédio Nº 28</b>.' : 'A imobiliária está fechada. Horário: 9h00–19h00.'}</p>`;
  if (E.casa) html += `<p>Contrato atual: <b>${CASAS[E.casa].nome}</b>, pago até ao <b>dia ${E.casaAte}</b>.</p>`;
  html += '<div class="opcoes">' + Object.entries(CASAS).map(([k, c]) => {
    const atual = E.casa === k;
    return cartao(c.ico, c.nome, `${euros(c.preco)}/semana · dormir: energia até ${c.energia}<br>${c.desc}`,
      atual ? 'Renovar' : 'Arrendar', 'arrendar', { valor: k, atual, desativado: !aberto || E.dinheiro < c.preco });
  }).join('') + '</div><p class="nota">Paga-se a semana adiantada (7 dias). Se não renovares a tempo, perdes a casa.</p>';
  abrirJanela('🔑 Tejo Imóveis', html);
}

function janelaCasa() {
  if (!E.casa) {
    abrirJanela('🏠 Prédio Nº 28', `<p>A porta está fechada. Ainda não tens casa aqui — passa pela <b>imobiliária</b> do outro lado da rua.</p>
      <div class="opcoes">${cartao('🪑', 'Dormir no banco da praça', 'Até às 8h00 · energia até 35', 'Dormir', 'dormir', { valor: 'banco', cor: 'vermelho' })}</div>`);
    return;
  }
  const c = CASAS[E.casa], h = horaAtual(), noite = h >= 18 || h < 6;
  abrirJanela('🏠 A tua casa', `<p><b>${c.nome}</b><br>Renda paga até ao dia ${E.casaAte} (hoje é dia ${E.dia}).</p><div class="opcoes">
    ${noite ? cartao('😴', 'Dormir', `Até às 8h00 · energia até ${c.energia}`, 'Dormir', 'dormir', { valor: 'casa' })
            : cartao('💤', 'Fazer uma sesta', '2 horas · +25 energia', 'Sesta', 'dormir', { valor: 'sesta' })}
  </div>${noite ? '' : '<p class="nota">Só podes dormir a noite toda a partir das 18h00.</p>'}`);
}

const ACOES = {
  trabalhar() {
    fecharJanela();
    transicao('A tirar bicas e a servir torradas…', () => {
      avancarTempo(240); E.energia = Math.max(0, E.energia - 25); E.dinheiro += 2800; guardar();
    }, () => { aviso('+28,00 € — turno feito! O Sr. Armando ficou contente.'); cena.jogador.dizer('Uff, que turno! 💪'); });
  },
  comprar(v) {
    const it = v === 'bica' ? { p: 80, e: 6, f: 'Que rica bica ☕' } : { p: 130, e: 10, f: 'Hmm, pastel de nata quentinho! 🥧' };
    if (E.dinheiro < it.p) return aviso('Não tens dinheiro suficiente.');
    E.dinheiro -= it.p; E.energia = Math.min(100, E.energia + it.e); guardar();
    cena.jogador.dizer(it.f); janelaCafe();
  },
  arrendar(k) {
    const c = CASAS[k];
    if (E.dinheiro < c.preco) return aviso('Não tens dinheiro suficiente.');
    const renovar = E.casa === k && E.casaAte >= E.dia;
    E.dinheiro -= c.preco;
    E.casaAte = (renovar ? E.casaAte : E.dia - 1) + 7;
    E.casa = k; guardar();
    aviso(renovar ? `Contrato renovado até ao dia ${E.casaAte}.` : `🎉 Arrendaste: ${c.nome}! Pago até ao dia ${E.casaAte}.`, 4000);
    cena.jogador.dizer(renovar ? 'Mais uma semana garantida!' : 'Finalmente tenho casa em Lisboa! 🎉');
    janelaImob();
  },
  dormir(v) {
    fecharJanela();
    const ateOito = () => { const m = E.minutos; avancarTempo(m < 480 ? 480 - m : 1440 - m + 480); };
    if (v === 'sesta') {
      return transicao('Zzz…', () => { avancarTempo(120); E.energia = Math.min(CASAS[E.casa].energia, E.energia + 25); guardar(); },
        () => cena.jogador.dizer('Que bela sesta 😌'));
    }
    if (v === 'banco') {
      return transicao('Uma noite fria no banco da praça…', () => { ateOito(); E.energia = Math.max(E.energia, 35); guardar(); },
        () => { aviso(`Bom dia! Dia ${E.dia}. As costas não agradecem…`); cena.jogador.dizer('Ai as costas… preciso de uma casa.'); });
    }
    transicao('Zzz… boa noite, Lisboa.', () => { ateOito(); if (E.casa) E.energia = Math.max(E.energia, CASAS[E.casa].energia); guardar(); },
      () => { aviso(`☀️ Bom dia! Dia ${E.dia}, 08:00.`); cena.jogador.dizer('Bom dia, Lisboa! ☀️'); });
  },
  // menu
  visual() { janelaCriar(true); },
  ajuda() { janelaAjuda(); },
  recomecar() {
    abrirJanela('Recomeçar', `<p>Tens a certeza? Perdes o dinheiro, a casa e o progresso guardados neste dispositivo.</p>
      <div class="opcoes"><button class="vermelho" data-acao="recomecarSim">Sim, recomeçar do zero</button></div>`);
  },
  recomecarSim() { try { localStorage.removeItem(CHAVE); } catch (e) { /* */ } location.reload(); },
  corCamisola(v) { rascunho.camisola = v; janelaCriar(rascunho.editar); },
  corCabelo(v) { rascunho.cabelo = v; janelaCriar(rascunho.editar); },
  corPele(v) { rascunho.pele = v; janelaCriar(rascunho.editar); },
  entrar() {
    const nome = ($('nome-avatar').value || '').trim().replace(/\s+/g, '_').slice(0, 18) || ('Lisboeta' + Math.floor(Math.random() * 900 + 100));
    const primeira = !E.criado;
    Object.assign(E, { nome, camisola: rascunho.camisola, cabelo: rascunho.cabelo, pele: rascunho.pele, criado: true });
    guardar();
    texturaAvatar(cena, 'jogador', E);
    cena.jogador.etiqueta.setText(nome);
    fecharJanela(true); mostrarUI();
    if (primeira) {
      cena.jogador.dizer('Olá, Lisboa! 👋');
      setTimeout(() => aviso('Toca no chão para andar. Toca nos edifícios para entrar.', 5000), 600);
    }
  },
};

// ---------------------------------------------------------------- UI (HTML)
const $ = id => document.getElementById(id);
let rascunho = null;
function abrirJanela(titulo, html, semFechar) {
  $('janela-titulo').textContent = titulo; $('janela-corpo').innerHTML = html;
  $('janela-fechar').hidden = !!semFechar; $('janela').hidden = false;
}
function fecharJanela(forcar) { if (forcar || !$('janela-fechar').hidden) $('janela').hidden = true; }
let avisoT = 0;
function aviso(txt, ms = 3000) {
  const a = $('aviso'); a.textContent = txt; a.hidden = false;
  clearTimeout(avisoT); avisoT = setTimeout(() => { a.hidden = true; }, ms);
}
function transicao(txt, meio, fim) {
  ocupado = true; const n = $('negro'); n.textContent = ''; n.classList.add('on');
  aviso(txt, 1600);
  setTimeout(() => { meio(); setTimeout(() => { n.classList.remove('on'); ocupado = false; if (fim) fim(); }, 900); }, 800);
}

const CORES_CAMISOLA = ['#2e7dd1', '#d63b3b', '#3fa34d', '#f2b01e', '#8a4fd1', '#2b2b30', '#f28cb8'];
const CORES_CABELO = ['#5a3a1e', '#1f1a17', '#e0b44a', '#b5502a', '#b9b9b9'];
const CORES_PELE = ['#f6d2b8', '#f1c39b', '#d9a07a', '#a9734f', '#6e4a33'];
function janelaCriar(editar) {
  if (!rascunho || rascunho.editar !== editar) rascunho = { camisola: E.camisola, cabelo: E.cabelo, pele: E.pele, editar, nome: E.nome };
  const nomeAtual = $('nome-avatar') ? $('nome-avatar').value : rascunho.nome;
  rascunho.nome = nomeAtual;
  const bolas = (lista, sel, acao) => lista.map(c => `<button style="background:${c}" class="${c === sel ? 'sel' : ''}" data-acao="${acao}" data-valor="${c}" aria-label="${c}"></button>`).join('');
  abrirJanela(editar ? 'Mudar o visual' : 'Bem-vindo a Lisboa! 🇵🇹', `
    ${editar ? '' : '<p>Acabaste de chegar à Baixa com 50 € no bolso. Arranja trabalho no <b>café</b>, arrenda casa na <b>imobiliária</b> e não te esqueças de <b>dormir</b>.</p>'}
    <canvas id="pre-avatar" width="64" height="120" style="float:right;image-rendering:pixelated;margin-left:10px"></canvas>
    <label>O teu nome<input type="text" id="nome-avatar" maxlength="18" value="${(nomeAtual || '').replace(/"/g, '')}" placeholder="ex.: Tuga_2010"></label>
    <div>Camisola</div><div class="cores">${bolas(CORES_CAMISOLA, rascunho.camisola, 'corCamisola')}</div>
    <div>Cabelo</div><div class="cores">${bolas(CORES_CABELO, rascunho.cabelo, 'corCabelo')}</div>
    <div>Pele</div><div class="cores">${bolas(CORES_PELE, rascunho.pele, 'corPele')}</div>
    <div class="opcoes"><button class="verde" data-acao="entrar">${editar ? 'Guardar' : 'Entrar no bairro'}</button></div>
    ${editar ? '' : '<p class="nota">O progresso fica guardado neste dispositivo (localStorage).</p>'}`, !editar || !E.criado);
  // pré-visualização
  texturaAvatar(cena, 'previa', rascunho);
  const src = cena.textures.get('previa').getSourceImage(), cv = $('pre-avatar').getContext('2d');
  cv.imageSmoothingEnabled = false; cv.clearRect(0, 0, 64, 120); cv.drawImage(src, 0, 0, AV_W, AV_H, 0, 0, 64, 120);
}
function janelaAjuda() {
  abrirJanela('Menu', `<p><b>Como jogar</b><br>
    • Toca no chão para andar; arrasta para mover a câmara.<br>
    • ☕ <b>Café A Bica</b>: trabalha turnos de 4h (7h–19h) e compra bicas.<br>
    • 🔑 <b>Tejo Imóveis</b>: arrenda casa à semana (9h–19h).<br>
    • 🏠 <b>Casa</b>: dorme para recuperar energia.<br>
    • Escreve na barra de baixo para falar.</p>
    <div class="opcoes"><button class="azul" data-acao="visual">Mudar o visual</button>
    <button class="vermelho" data-acao="recomecar">Recomeçar do zero</button></div>`);
}

function mostrarUI() { $('hud').hidden = false; $('chat').hidden = false; }
function atualizarHUD() {
  $('hud-nome').textContent = E.nome || '—';
  $('hud-dinheiro').textContent = euros(E.dinheiro);
  const en = $('hud-energia'); en.style.width = Math.round(E.energia) + '%'; en.classList.toggle('baixa', E.energia < 25);
  $('hud-dia').textContent = 'Dia ' + E.dia;
  $('hud-hora').textContent = fmtHora(E.minutos);
  $('hud-casa').textContent = E.casa ? `${CASAS[E.casa].ico} ${CASAS[E.casa].nome} · até dia ${E.casaAte}` : '🚪 Sem casa';
}

function iniciarUI() {
  $('janela-corpo').addEventListener('click', e => {
    const b = e.target.closest('[data-acao]');
    if (!b || b.disabled) return;
    ACOES[b.dataset.acao](b.dataset.valor);
  });
  $('janela-fechar').addEventListener('click', () => { $('janela').hidden = true; });
  $('btn-menu').addEventListener('click', janelaAjuda);
  $('btn-zoom').addEventListener('click', () => { zoomAtual = zoomAtual === 1 ? 2 : 1; cena.aplicarZoom(); });
  $('chat').addEventListener('submit', e => {
    e.preventDefault();
    const t = $('chat-texto').value.trim();
    if (t) cena.jogador.dizer(t);
    $('chat-texto').value = '';
    $('chat-texto').blur();
  });
  ['pagehide', 'beforeunload'].forEach(ev => window.addEventListener(ev, guardarPosicao));
  document.addEventListener('visibilitychange', () => { if (document.hidden) guardarPosicao(); });
  if (E.criado) { mostrarUI(); aviso(`Bem-vindo de volta, ${E.nome}!`); }
  else janelaCriar(false);
}

new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'jogo',
  pixelArt: true,
  backgroundColor: '#0e1b2a',
  scale: { mode: Phaser.Scale.RESIZE, width: window.innerWidth, height: window.innerHeight },
  input: { activePointers: 2 },
  scene: [Bairro],
});
})();
