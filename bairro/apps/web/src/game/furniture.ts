/**
 * Desenho da mobília (arte original). Cada `sprite` do catálogo tem uma função que desenha
 * a peça no seu mosaico de origem. Algumas peças devolvem uma segunda camada ("frente")
 * que tem de ficar à frente de quem está sentado (ex.: costas de uma cadeira virada para trás).
 */
import { Graphics } from 'pixi.js';
import { FURNITURE_BY_ID, footprint, type RoomItemState } from '@bairro/shared';
import { box, poly, pt, line, darken, hash } from './draw';

type Drawer = (g: Graphics, x: number, y: number, w: number, l: number, rot: number, z: number, front: Graphics) => void;

const WOOD = 0xa0683a, WOOD_D = 0x7a4a26, IRON = 0x2b2f2e;

/** Encosto de cadeira/sofá conforme a rotação (0=N, 2=E, 4=S, 6=O: para onde está virado quem se senta). */
function backrest(g: Graphics, front: Graphics, x: number, y: number, w: number, l: number, rot: number, z0: number, h: number, color: number, t = 0.12) {
  if (rot === 4) box(g, x, y, w, t, z0, h, color);              // virado para S → encosto atrás (N)
  else if (rot === 2) box(g, x, y, t, l, z0, h, color);         // virado para E → encosto a O
  else if (rot === 0) box(front, x, y + l - t, w, t, z0, h, color); // virado para N → encosto à frente
  else box(front, x + w - t, y, t, l, z0, h, color);            // virado para O → encosto à frente
}

const DRAW: Record<string, Drawer> = {
  cadeira(g, x, y, _w, _l, rot, z, front) {
    for (const [dx, dy] of [[0.22, 0.22], [0.7, 0.22], [0.22, 0.7], [0.7, 0.7]]) box(g, x + dx, y + dy, 0.08, 0.08, z, 13, IRON, IRON, 0x1a1c1b, false);
    box(g, x + 0.18, y + 0.18, 0.64, 0.64, z + 13, 3, 0xc8553d);
    backrest(g, front, x + 0.18, y + 0.18, 0.64, 0.64, rot, z + 16, 16, 0xb04a35);
  },
  mesa(g, x, y, _w, _l, _r, z) {
    box(g, x + 0.45, y + 0.45, 0.1, 0.1, z, 18, 0x555555, 0x555555, 0x333333, false);
    box(g, x + 0.3, y + 0.3, 0.4, 0.4, z, 2, 0x444444);
    box(g, x + 0.12, y + 0.12, 0.76, 0.76, z + 18, 2, 0xf4f1ea, 0xd9d4c8, 0xc5c0b4);
    // chávena de café
    const c = pt(x + 0.45, y + 0.5, z + 21);
    g.rect(c.x - 3, c.y - 4, 6, 5).fill(0xffffff).rect(c.x + 3, c.y - 3, 2, 2).fill(0xffffff);
  },
  balcao(g, x, y, w, l, _r, z) {
    box(g, x, y, w, l, z, 26, 0xe9e1cf, 0xd4c7aa, 0xb59f78);
    box(g, x - 0.05, y - 0.05, w + 0.1, l + 0.1, z + 26, 3, 0x6b4a2e);
    // vitrine com bolos
    box(g, x + 0.15, y + 0.2, w - 0.3, l - 0.4, z + 29, 10, 0xcfe6f3, 0xbcd7e8, 0xa3c3d8);
    for (let i = 0; i < l * 2 - 1; i++) {
      const c = pt(x + 0.5, y + 0.45 + i * 0.5, z + 33);
      g.circle(c.x, c.y, 3).fill(i % 2 ? 0xe2a23c : 0xf3d27a);
    }
  },
  maquina(g, x, y, _w, _l, _r, z) {
    box(g, x + 0.2, y + 0.2, 0.6, 0.6, z, 4, 0x6b4a2e);
    box(g, x + 0.25, y + 0.25, 0.5, 0.5, z + 4, 22, 0xb9bec4, 0xa3a9b0, 0x878d94);
    box(g, x + 0.3, y + 0.3, 0.4, 0.4, z + 26, 3, 0x2b2f2e);
    const c = pt(x + 0.75, y + 0.5, z + 12);
    g.rect(c.x - 2, c.y, 4, 3).fill(0x2b2f2e);
    g.circle(pt(x + 0.75, y + 0.35, z + 18).x, pt(x + 0.75, y + 0.35, z + 18).y, 2).fill(0xd64545);
  },
  banco(g, x, y, w, l, rot, z, front) {
    const legs = w > l ? [[0.1, 0.4], [w - 0.18, 0.4]] : [[0.4, 0.1], [0.4, l - 0.18]];
    for (const [dx, dy] of legs) box(g, x + dx, y + dy, 0.08, 0.3, z, 10, IRON, IRON, 0x1a1c1b, false);
    box(g, x + 0.08, y + 0.15, w - 0.16, l - 0.3, z + 10, 3, WOOD);
    backrest(g, front, x + 0.08, y + 0.15, w - 0.16, l - 0.3, rot, z + 13, 12, WOOD_D, 0.08);
  },
  sofa(g, x, y, w, l, rot, z, front) {
    const c = 0x7b2d4a;
    box(g, x + 0.05, y + 0.05, w - 0.1, l - 0.1, z, 14, c);
    if (w > l) { box(g, x + 0.05, y + 0.05, 0.15, l - 0.1, z + 14, 6, darken(c, 0.9)); box(front, x + w - 0.2, y + 0.05, 0.15, l - 0.1, z + 14, 6, darken(c, 0.9)); }
    else { box(g, x + 0.05, y + 0.05, w - 0.1, 0.15, z + 14, 6, darken(c, 0.9)); box(front, x + 0.05, y + l - 0.2, w - 0.1, 0.15, z + 14, 6, darken(c, 0.9)); }
    backrest(g, front, x + 0.05, y + 0.05, w - 0.1, l - 0.1, rot, z + 14, 16, darken(c, 0.85), 0.2);
  },
  tapete(g, x, y, w, l, _r, z) {
    poly(g, [pt(x + 0.05, y + 0.05, z), pt(x + w - 0.05, y + 0.05, z), pt(x + w - 0.05, y + l - 0.05, z), pt(x + 0.05, y + l - 0.05, z)], 0xf1e3c4, 1, true);
    poly(g, [pt(x + 0.2, y + 0.2, z), pt(x + w - 0.2, y + 0.2, z), pt(x + w - 0.2, y + l - 0.2, z), pt(x + 0.2, y + l - 0.2, z)], 0x2f5f9a);
    // motivos bordados ao estilo tradicional
    for (let i = 0; i < 4; i++) {
      const cx = x + 0.45 + (i % 2) * (w - 0.9), cy = y + 0.45 + Math.floor(i / 2) * (l - 0.9);
      poly(g, [pt(cx, cy - 0.15, z), pt(cx + 0.15, cy, z), pt(cx, cy + 0.15, z), pt(cx - 0.15, cy, z)], 0xd9a03c);
    }
    const cx = x + w / 2, cy = y + l / 2;
    poly(g, [pt(cx, cy - 0.35, z), pt(cx + 0.35, cy, z), pt(cx, cy + 0.35, z), pt(cx - 0.35, cy, z)], 0xc8553d);
    poly(g, [pt(cx, cy - 0.15, z), pt(cx + 0.15, cy, z), pt(cx, cy + 0.15, z), pt(cx - 0.15, cy, z)], 0xf1e3c4);
  },
  planta(g, x, y, _w, _l, _r, z) {
    box(g, x + 0.3, y + 0.3, 0.4, 0.4, z, 14, 0xc8553d, 0xb34a34, 0x963c2a);
    const c = pt(x + 0.5, y + 0.5, z + 14);
    for (const [dx, dy, r, col] of [[0, -12, 10, 0x3f8f3a], [-8, -6, 7, 0x4fa64a], [8, -8, 7, 0x4fa64a], [-2, -20, 7, 0x6cc062]] as const) g.circle(c.x + dx, c.y + dy, r).fill(col);
  },
  cama(g, x, y, w, l, _r, z) {
    box(g, x + 0.05, y + 0.05, w - 0.1, l - 0.1, z, 12, WOOD, WOOD, WOOD_D);
    box(g, x + 0.1, y + 0.1, w - 0.2, l - 0.2, z + 12, 5, 0xf4f1ea);
    const along = l > w;
    box(g, x + 0.12, y + 0.12, along ? w - 0.24 : 0.5, along ? 0.5 : l - 0.24, z + 17, 4, 0xffffff);
    box(g, along ? x + 0.1 : x + 0.65, along ? y + 0.65 : y + 0.1, along ? w - 0.2 : w - 0.75, along ? l - 0.75 : l - 0.2, z + 17, 2, 0x3e8fc7);
    box(g, x, y, along ? w : 0.08, along ? 0.08 : l, z, 26, WOOD_D);
  },
  candeeiro(g, x, y, _w, _l, _r, z) {
    const b = pt(x + 0.5, y + 0.5, z);
    g.rect(b.x - 4, b.y - 6, 8, 6).fill(0x1f2a26);
    g.rect(b.x - 1, b.y - 62, 3, 58).fill(0x2b3a35);
    g.rect(b.x - 7, b.y - 76, 14, 3).fill(0x1f2a26).rect(b.x - 6, b.y - 64, 12, 2).fill(0x1f2a26);
    g.rect(b.x - 5, b.y - 73, 10, 9).fill(0xffe8a0);
    g.poly([b.x - 7, b.y - 76, b.x + 7, b.y - 76, b.x, b.y - 82]).fill(0x1f2a26);
  },
  arvore(g, x, y, _w, _l, _r, z) {
    const b = pt(x + 0.5, y + 0.5, z);
    g.ellipse(b.x + 4, b.y, 26, 11).fill({ color: 0x000000, alpha: 0.16 });
    g.rect(b.x - 4, b.y - 38, 8, 38).fill(0x4a3220).rect(b.x - 3, b.y - 38, 4, 38).fill(0x6b4a2e);
    for (const [dx, dy, r, c] of [[0, -58, 24, 0x5d3f96], [-15, -50, 16, 0x6d4aa8], [15, -52, 17, 0x6d4aa8], [-6, -66, 16, 0x8a63c9], [8, -64, 14, 0x8a63c9], [-3, -72, 10, 0xa883e0], [12, -60, 7, 0xc8a8f2]] as const) g.circle(b.x + dx, b.y + dy, r).fill(c);
    for (let k = 0; k < 10; k++) g.rect(b.x - 18 + hash(x, y, k) * 34, b.y - 78 + hash(y, x, k) * 36, 2, 2).fill(0xd7bff7);
  },
  chafariz(g, x, y, w, l, _r, z) {
    box(g, x + 0.1, y + 0.1, w - 0.2, l - 0.2, z, 12, 0xd9d2c3, 0xc9c1b0, 0xa9a190);
    poly(g, [pt(x + 0.25, y + 0.25, z + 12), pt(x + w - 0.25, y + 0.25, z + 12), pt(x + w - 0.25, y + l - 0.25, z + 12), pt(x + 0.25, y + l - 0.25, z + 12)], 0x4f9fd6);
    poly(g, [pt(x + 0.5, y + 0.4, z + 12), pt(x + 1.2, y + 0.4, z + 12), pt(x + 1.2, y + 0.55, z + 12), pt(x + 0.5, y + 0.55, z + 12)], 0x9fd3f2, 0.8);
    box(g, x + w / 2 - 0.15, y + l / 2 - 0.15, 0.3, 0.3, z + 12, 26, 0xd9d2c3, 0xc9c1b0, 0xa9a190);
    box(g, x + w / 2 - 0.4, y + l / 2 - 0.4, 0.8, 0.8, z + 38, 5, 0x4f9fd6, 0xc9c1b0, 0xa9a190);
    box(g, x + w / 2 - 0.07, y + l / 2 - 0.07, 0.14, 0.14, z + 43, 12, 0x6e8a6f, 0x5c7a5d, 0x4a654b);
  },
  galo(g, x, y, _w, _l, _r, z) {
    box(g, x + 0.3, y + 0.3, 0.4, 0.4, z, 8, 0xf4f1ea);
    const b = pt(x + 0.5, y + 0.5, z + 8);
    // corpo preto com corações coloridos, crista vermelha (arte original inspirada no artesanato)
    g.ellipse(b.x, b.y - 12, 9, 10).fill(0x1d1d1f);
    g.ellipse(b.x - 9, b.y - 18, 5, 9).fill(0x1d1d1f);
    g.circle(b.x + 7, b.y - 24, 5).fill(0x1d1d1f);
    g.poly([b.x + 4, b.y - 30, b.x + 7, b.y - 35, b.x + 9, b.y - 30, b.x + 12, b.y - 33, b.x + 11, b.y - 27]).fill(0xd62f2f);
    g.poly([b.x + 11, b.y - 24, b.x + 16, b.y - 23, b.x + 11, b.y - 21]).fill(0xf2b01e);
    for (const [dx, dy, c] of [[-3, -14, 0xd62f2f], [3, -10, 0xf2b01e], [-1, -7, 0x3fa34d], [-9, -20, 0x2e7dd1]] as const) g.circle(b.x + dx, b.y + dy, 2).fill(c);
    line(g, { x: b.x - 2, y: b.y - 3 }, { x: b.x - 2, y: b.y }, 0xf2b01e, 2);
    line(g, { x: b.x + 3, y: b.y - 3 }, { x: b.x + 3, y: b.y }, 0xf2b01e, 2);
  },
};

/** Cria os gráficos de uma peça: `back` (normal) e `front` (camada à frente de quem está sentado). */
export function drawItem(item: RoomItemState, baseZ = 0) {
  const def = FURNITURE_BY_ID.get(item.defId);
  const back = new Graphics(), front = new Graphics();
  if (!def) { box(back, item.x + 0.2, item.y + 0.2, 0.6, 0.6, 0, 20, 0xff00ff); return { back, front, w: 1, l: 1 }; }
  const { w, l } = footprint(def, item.rotation);
  (DRAW[def.sprite] ?? DRAW.planta)(back, item.x, item.y, w, l, item.rotation, baseZ + item.z * 32, front);
  return { back, front, w, l };
}
