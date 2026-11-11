/** Primitivas de desenho isométrico sobre Graphics do PixiJS. Unidades: mosaicos em x/y, píxeis em z. */
import { Graphics } from 'pixi.js';
import { tileToScreen } from '@bairro/shared';

export type P = { x: number; y: number };
export const pt = (x: number, y: number, zPx = 0): P => { const s = tileToScreen(x, y); return { x: s.x, y: s.y - zPx }; };
const flat = (ps: P[]) => ps.flatMap(p => [p.x, p.y]);
export const OUTLINE = 0x2a2018;

export function poly(g: Graphics, ps: P[], color: number, alpha = 1, outline = false) {
  g.poly(flat(ps)).fill({ color, alpha });
  if (outline) g.poly(flat(ps)).stroke({ width: 1, color: OUTLINE, alpha: 0.55 });
}

export function line(g: Graphics, a: P, b: P, color: number, width = 1, alpha = 1) {
  g.moveTo(a.x, a.y).lineTo(b.x, b.y).stroke({ width, color, alpha });
}

export function darken(c: number, f: number) {
  return (Math.round(((c >> 16) & 255) * f) << 16) | (Math.round(((c >> 8) & 255) * f) << 8) | Math.round((c & 255) * f);
}

/** Caixa isométrica: face esquerda (plano y = y1), direita (x = x1) e topo. */
export function box(g: Graphics, x0: number, y0: number, w: number, l: number, z0: number, h: number, top: number, left?: number, right?: number, outline = true) {
  const x1 = x0 + w, y1 = y0 + l, z1 = z0 + h;
  const L = left ?? darken(top, 0.88), R = right ?? darken(top, 0.74);
  if (h > 0) {
    poly(g, [pt(x0, y1, z0), pt(x1, y1, z0), pt(x1, y1, z1), pt(x0, y1, z1)], L, 1, outline);
    poly(g, [pt(x1, y1, z0), pt(x1, y0, z0), pt(x1, y0, z1), pt(x1, y1, z1)], R, 1, outline);
  }
  poly(g, [pt(x0, y0, z1), pt(x1, y0, z1), pt(x1, y1, z1), pt(x0, y1, z1)], top, 1, outline);
}

export function hash(a: number, b: number, c = 0) {
  const s = Math.sin(a * 12.9898 + b * 78.233 + c * 37.719) * 43758.5453;
  return s - Math.floor(s);
}
