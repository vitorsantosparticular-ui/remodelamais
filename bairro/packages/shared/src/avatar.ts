/** Sistema de avatar: partes disponíveis e validação (o servidor rejeita figuras inválidas). */
export const SKIN_COLORS = ['#f6d2b8', '#f1c39b', '#d9a07a', '#a9734f', '#6e4a33'] as const;
export const HAIR_COLORS = ['#5a3a1e', '#1f1a17', '#e0b44a', '#b5502a', '#b9b9b9', '#3c5fa8', '#d64f8a'] as const;
export const CLOTH_COLORS = ['#2e7dd1', '#d63b3b', '#3fa34d', '#f2b01e', '#8a4fd1', '#2b2b30', '#f28cb8', '#f4f1ea', '#2c3e66', '#7a5230', '#1f8a8a'] as const;
export const HAIR_STYLES = ['curto', 'espetado', 'comprido', 'rapado', 'apanhado'] as const;
export const SHIRT_STYLES = ['tshirt', 'manga', 'riscas'] as const;
export const BODY_TYPES = ['a', 'b'] as const;

export interface Figure {
  [key: string]: string;
  body: typeof BODY_TYPES[number];
  skin: string;
  hair: typeof HAIR_STYLES[number];
  hairColor: string;
  shirt: typeof SHIRT_STYLES[number];
  shirtColor: string;
  trousersColor: string;
  shoesColor: string;
}

export const DEFAULT_FIGURE: Figure = {
  body: 'a', skin: SKIN_COLORS[1], hair: 'curto', hairColor: HAIR_COLORS[0],
  shirt: 'tshirt', shirtColor: CLOTH_COLORS[0], trousersColor: CLOTH_COLORS[8], shoesColor: CLOTH_COLORS[5],
};

const inList = (list: readonly string[], v: unknown): v is string => typeof v === 'string' && list.includes(v);

/** Devolve uma figura válida ou null. Nunca confiar na figura enviada pelo cliente sem isto. */
export function validateFigure(f: unknown): Figure | null {
  if (!f || typeof f !== 'object') return null;
  const o = f as Record<string, unknown>;
  if (!inList(BODY_TYPES, o.body) || !inList(SKIN_COLORS, o.skin) || !inList(HAIR_STYLES, o.hair)
    || !inList(HAIR_COLORS, o.hairColor) || !inList(SHIRT_STYLES, o.shirt) || !inList(CLOTH_COLORS, o.shirtColor)
    || !inList(CLOTH_COLORS, o.trousersColor) || !inList(CLOTH_COLORS, o.shoesColor)) return null;
  return {
    body: o.body as Figure['body'], skin: o.skin, hair: o.hair as Figure['hair'], hairColor: o.hairColor,
    shirt: o.shirt as Figure['shirt'], shirtColor: o.shirtColor, trousersColor: o.trousersColor, shoesColor: o.shoesColor,
  };
}
