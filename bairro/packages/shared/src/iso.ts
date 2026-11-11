/** Geometria isométrica partilhada entre cliente e servidor. */
export const TILE_W = 64;
export const TILE_H = 32;
/** Altura (px) de uma unidade de altura (z = 1) — empilhamento de mobília. */
export const Z_UNIT = 32;

export interface Point { x: number; y: number }

/** Mosaico (x,y,z) → coordenadas de ecrã relativas à origem do quarto (centro do topo do mosaico 0,0). */
export function tileToScreen(x: number, y: number, z = 0): Point {
  return { x: (x - y) * (TILE_W / 2), y: (x + y) * (TILE_H / 2) - z * Z_UNIT };
}

/** Coordenadas de ecrã → mosaico (fracionário). Usar Math.floor para obter o índice. */
export function screenToTile(sx: number, sy: number): Point {
  const a = sx / (TILE_W / 2);
  const b = sy / (TILE_H / 2);
  return { x: (a + b) / 2, y: (b - a) / 2 };
}

/** Direções no estilo clássico: 0 = norte (y-1) e no sentido dos ponteiros do relógio. */
export const DIRS: ReadonlyArray<readonly [number, number]> = [
  [0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1],
];

export function directionFromDelta(dx: number, dy: number): number {
  const sx = Math.sign(dx), sy = Math.sign(dy);
  const i = DIRS.findIndex(([a, b]) => a === sx && b === sy);
  return i < 0 ? 2 : i;
}
