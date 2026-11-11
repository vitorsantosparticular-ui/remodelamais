import { DIRS } from './iso';

export interface Tile { x: number; y: number }

/**
 * A* em 8 direções sem cortar esquinas. Usado pelo servidor (autoritativo)
 * e pelo cliente (só para pré-visualização, nunca para decidir posições).
 * `walkable(x, y)` deve devolver true se o mosaico pode ser pisado.
 * Devolve a lista de mosaicos SEM o de partida, ou null se não houver caminho.
 */
export function findPath(
  from: Tile, to: Tile, width: number, height: number,
  walkable: (x: number, y: number) => boolean, maxNodes = 4000,
): Tile[] | null {
  if (from.x === to.x && from.y === to.y) return [];
  if (!walkable(to.x, to.y)) return null;
  const key = (x: number, y: number) => y * width + x;
  const g = new Map<number, number>([[key(from.x, from.y), 0]]);
  const came = new Map<number, number>();
  const open: Array<{ x: number; y: number; f: number }> = [{ x: from.x, y: from.y, f: 0 }];
  const closed = new Set<number>();
  const h = (x: number, y: number) => {
    const dx = Math.abs(x - to.x), dy = Math.abs(y - to.y);
    return Math.max(dx, dy) + 0.414 * Math.min(dx, dy);
  };
  const inside = (x: number, y: number) => x >= 0 && y >= 0 && x < width && y < height;
  let visited = 0;
  while (open.length) {
    let best = 0;
    for (let i = 1; i < open.length; i++) if (open[i].f < open[best].f) best = i;
    const cur = open.splice(best, 1)[0];
    const ck = key(cur.x, cur.y);
    if (cur.x === to.x && cur.y === to.y) {
      const path: Tile[] = [];
      let k = ck;
      while (came.has(k)) { path.unshift({ x: k % width, y: Math.floor(k / width) }); k = came.get(k)!; }
      return path;
    }
    if (closed.has(ck)) continue;
    closed.add(ck);
    if (++visited > maxNodes) return null;
    for (const [dx, dy] of DIRS) {
      const nx = cur.x + dx, ny = cur.y + dy;
      if (!inside(nx, ny) || !walkable(nx, ny)) continue;
      if (dx && dy && (!walkable(cur.x + dx, cur.y) || !walkable(cur.x, cur.y + dy))) continue;
      const ng = g.get(ck)! + (dx && dy ? 1.414 : 1);
      const nk = key(nx, ny);
      if (ng < (g.get(nk) ?? Infinity)) {
        g.set(nk, ng); came.set(nk, ck);
        open.push({ x: nx, y: ny, f: ng + h(nx, ny) });
      }
    }
  }
  return null;
}
