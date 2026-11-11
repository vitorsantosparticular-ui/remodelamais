/**
 * Gerador de avatares em pixel-art (arte original, desenhada a partir de mapas de carateres).
 * Cada figura gera uma folha com 8 quadros: vista de Frente/Costas × pose S(parado)/A/B(andar)/T(sentado).
 * Legenda: K contorno · S/s pele · H/h cabelo · E olhos · M boca · T/t camisola · U braço (manga)
 *          A antebraço (manga comprida = camisola; t-shirt = pele) · P/p calças · B sapatos
 */
import type { Figure } from '@bairro/shared';

export const PX = 2;
export const AV_W = 16 * PX;
export const AV_H = 30 * PX;
export const FRAMES = ['FS', 'FA', 'FB', 'FT', 'CS', 'CA', 'CB', 'CT'] as const;
export type FrameName = typeof FRAMES[number];

const HEAD_FRONT = [
  '................', '................', '.....KKKKKK.....', '....KSSSSSSKK...', '...KSSSSSSSSSK..', '..KSSSSSSSSSSK..',
  '..KSSSSSSSSSSK..', '..KSSSSSESSESK..', '..KSSSSSESSESK..', '..KsSSSSSSSSSK..', '...KsSSSSSMMSK..', '....KsSSSSSSK...',
  '.....KKSSSKK....',
];
const HEAD_BACK = [
  '................', '................', '.....KKKKKK.....', '....KSSSSSSKK...', '...KSSSSSSSSSK..', '..KSSSSSSSSSSK..',
  '..KSSSSSSSSSSK..', '..KSSSSSSSSSSK..', '..KSSSSSSSSSsK..', '..KsSSSSSSSSsK..', '...KsSSSSSSsK...', '....KsSSSSsK....',
  '.....KKSSSKK....',
];
/** Penteados como camadas sobre a cabeça ('.' mantém o que está por baixo). [sobreposição, última linha de cabelo atrás] */
const HAIR: Record<Figure['hair'], { over: string[]; backTo: number }> = {
  curto: { backTo: 9, over: [
    '................', '.....KKKKKK.....', '....KHHHHHHKK...', '...KHHHHHHHHHK..', '..KHHHHHHHHHHK..', '..KHHH...HH.HK..', '...H............'] },
  espetado: { backTo: 9, over: [
    '...K.K.K.K.K....', '..KHKHKHKHKHK...', '...KHHHHHHHHHK..', '..KHHHHHHHHHHK..', '..KHHHHHHHHHHK..', '..KHH.......HK..'] },
  comprido: { backTo: 12, over: [
    '................', '.....KKKKKK.....', '....KHHHHHHKK...', '...KHHHHHHHHHK..', '..KHHHHHHHHHHK..', '..KHHHHH.HHHHK..',
    '..KHH.......HK..', '..KHH.......HK..', '..KHh.......hK..', '..KHh.......hK..', '..KHh.......hK..', '..KHh.......hK..',
    '..KKK......KK...'] },
  rapado: { backTo: 8, over: [
    '................', '................', '.....KKKKKK.....', '....KhhhhhhKK...', '...KhhhhhhhhhK..', '..Khh.....hh.K..'] },
  apanhado: { backTo: 9, over: [
    '......KKKK......', '.....KHHHHK.....', '....KKHHHHKK....', '...KHHHHHHHHHK..', '..KHHHHHHHHHHK..', '..KHHH.....HHK..'] },
};
const BODY: Record<Figure['body'], string[]> = {
  a: ['.....KKTTTKK....', '...KKTTTTTTTKK..', '..KUTTTTTTTTTUK.', '..KUtTTTTTTTtUK.', '..KAtTTTTTTTtAK.',
    '..KAKTTTTTTTKAK.', '..KSKTTTTTTTKSK.', '..KSKPPPPPPPKSK.', '...KKPPPPPPPKK..'],
  b: ['.....KKTTTKK....', '..KKTTTTTTTTKK..', '.KUTTTTTTTTTTUK.', '.KUtTTTTTTTTtUK.', '.KAtTTTTTTTTtAK.',
    '.KAKTTTTTTTTKAK.', '.KSKTTTTTTTTKSK.', '.KSKPPPPPPPPKSK.', '..KKPPPPPPPPKK..'],
};
const LEGS: Record<'S' | 'A' | 'B' | 'T', string[]> = {
  S: ['....KPPPKPPPK...', '....KPPPKPPPK...', '....KPPpKPPpK...', '....KPPPKPPPK...', '....KPPPKPPPK...', '....KBBBKBBBK...', '....KBBBKBBBBK..', '....KKKKKKKKKK..'],
  A: ['....KPPPKPPPK...', '...KPPPK.KPPPK..', '...KPPPK.KPPPK..', '..KPPpK...KPPpK.', '..KPPPK...KPPPK.', '..KBBBK...KBBBK.', '..KBBBBK..KBBBBK', '..KKKKKK..KKKKKK'],
  B: ['....KPPPKPPPK...', '....KPPPKPPPK...', '...KPPPK.KPPPK..', '...KPpPK.KPPpK..', '..KPPPK...KPPPK.', '..KBBBK...KBBBK.', '.KBBBBK...KBBBBK', '.KKKKKK...KKKKKK'],
  T: ['....KPPPKPPPK...', '....KPPpKPPpK...', '....KBBBKBBBK...', '....KKKKKKKKK...', '................', '................', '................', '................'],
};

function shade(hex: string, f = 0.72) {
  const n = parseInt(hex.slice(1), 16);
  const c = (s: number) => Math.round(((n >> s) & 255) * f).toString(16).padStart(2, '0');
  return `#${c(16)}${c(8)}${c(0)}`;
}

function overlay(base: string[], over: string[]) {
  return base.map((row, i) => {
    const o = over[i];
    if (!o) return row;
    return [...row].map((ch, j) => (o[j] && o[j] !== '.' ? o[j] : ch)).join('');
  });
}

function headFor(f: Figure, view: 'F' | 'C') {
  const hair = HAIR[f.hair];
  if (view === 'F') return overlay(HEAD_FRONT, hair.over);
  // Costas: silhueta do penteado nas linhas de cima e cabelo a cobrir a nuca até `backTo`.
  const top = overlay(HEAD_BACK, hair.over.slice(0, 5));
  const fill = f.hair === 'rapado' ? 'h' : 'H';
  return top.map((row, i) => (i <= hair.backTo ? row.replace(/[Ss]/g, (_, j: number) => (j === row.lastIndexOf('s') && i > 7 ? 'h' : fill)) : row));
}

/** Desenha a folha de quadros da figura num canvas (AV_W*8 × AV_H). */
export function renderAvatarSheet(f: Figure): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = AV_W * FRAMES.length; canvas.height = AV_H;
  const ctx = canvas.getContext('2d')!;
  const arm = f.shirt === 'manga' ? f.shirtColor : f.skin;
  const pal: Record<string, string> = {
    K: '#1d1612', E: '#1d1612', M: '#b5574a', S: f.skin, s: shade(f.skin), H: f.hairColor, h: shade(f.hairColor),
    T: f.shirtColor, t: shade(f.shirtColor), U: f.shirtColor, A: arm, P: f.trousersColor, p: shade(f.trousersColor),
    B: f.shoesColor,
  };
  FRAMES.forEach((name, i) => {
    const view = name[0] as 'F' | 'C';
    const pose = name[1] as 'S' | 'A' | 'B' | 'T';
    const rows = [...headFor(f, view), ...BODY[f.body], ...LEGS[pose]];
    rows.forEach((row, y) => [...row].forEach((ch, x) => {
      if (ch === '.') return;
      let color = pal[ch];
      // Camisola às riscas: linhas alternadas em branco no tronco.
      if (f.shirt === 'riscas' && ch === 'T' && y >= 15 && y % 2 === 0) color = '#f4f1ea';
      ctx.fillStyle = color;
      ctx.fillRect(i * AV_W + x * PX, y * PX, PX, PX);
    }));
  });
  return canvas;
}

/** Vista e espelho para cada uma das 8 direções. */
export function viewForDir(dir: number): { view: 'F' | 'C'; flip: boolean } {
  const d = [[0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1]][((dir % 8) + 8) % 8];
  const sx = d[0] - d[1], sy = d[0] + d[1];
  const view = sy >= 0 ? 'F' : 'C';
  return { view, flip: view === 'F' ? sx < 0 : sx > 0 };
}
