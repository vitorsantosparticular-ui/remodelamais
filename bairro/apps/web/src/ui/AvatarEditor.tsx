import { useEffect, useRef } from 'react';
import {
  BODY_TYPES, CLOTH_COLORS, HAIR_COLORS, HAIR_STYLES, SHIRT_STYLES, SKIN_COLORS, type Figure,
} from '@bairro/shared';
import { renderAvatarSheet, AV_W, AV_H } from '../game/avatar';

const LABELS: Record<string, string> = {
  curto: 'Curto', espetado: 'Espetado', comprido: 'Comprido', rapado: 'Rapado', apanhado: 'Apanhado',
  tshirt: 'T-shirt', manga: 'Manga comprida', riscas: 'Às riscas', a: 'Corpo A', b: 'Corpo B',
};

/** Pré-visualização do avatar (frente e costas), ampliada sem suavização. */
export function AvatarPreview({ figure, scale = 2 }: { figure: Figure; scale?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current; if (!c) return;
    const sheet = renderAvatarSheet(figure);
    const ctx = c.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.drawImage(sheet, 0, 0, AV_W, AV_H, 0, 0, AV_W * scale, AV_H * scale);
    ctx.drawImage(sheet, AV_W * 4, 0, AV_W, AV_H, AV_W * scale + 8, 0, AV_W * scale, AV_H * scale);
  }, [figure, scale]);
  return <canvas ref={ref} width={AV_W * scale * 2 + 8} height={AV_H * scale} className="pixel" aria-label="Pré-visualização do avatar" />;
}

function Swatches({ list, value, onPick, label }: { list: readonly string[]; value: string; onPick: (v: string) => void; label: string }) {
  return (
    <fieldset className="flex flex-wrap gap-1.5" aria-label={label}>
      {list.map(c => (
        <button key={c} type="button" className={`swatch ${c === value ? 'sel' : ''}`} style={{ background: c }} onClick={() => onPick(c)} aria-label={`${label} ${c}`} aria-pressed={c === value} />
      ))}
    </fieldset>
  );
}

function Options<T extends string>({ list, value, onPick }: { list: readonly T[]; value: T; onPick: (v: T) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {list.map(o => <button key={o} type="button" className={`chip ${o === value ? 'sel' : ''}`} onClick={() => onPick(o)}>{LABELS[o] ?? o}</button>)}
    </div>
  );
}

/** Editor de visual. As peças disponíveis vêm do pacote partilhado; o servidor valida a escolha. */
export function AvatarEditor({ figure, onChange }: { figure: Figure; onChange: (f: Figure) => void }) {
  const up = (p: Partial<Figure>) => onChange({ ...figure, ...p } as Figure);
  return (
    <div className="grid grid-cols-[auto_1fr] gap-4 items-start max-[420px]:grid-cols-1">
      <div className="preview-box"><AvatarPreview figure={figure} scale={2} /></div>
      <div className="grid gap-2 min-w-0">
        <div className="lbl">Corpo</div><Options list={BODY_TYPES} value={figure.body} onPick={body => up({ body })} />
        <div className="lbl">Pele</div><Swatches label="Pele" list={SKIN_COLORS} value={figure.skin} onPick={skin => up({ skin })} />
        <div className="lbl">Cabelo</div><Options list={HAIR_STYLES} value={figure.hair} onPick={hair => up({ hair })} />
        <Swatches label="Cor do cabelo" list={HAIR_COLORS} value={figure.hairColor} onPick={hairColor => up({ hairColor })} />
        <div className="lbl">Camisola</div><Options list={SHIRT_STYLES} value={figure.shirt} onPick={shirt => up({ shirt })} />
        <Swatches label="Cor da camisola" list={CLOTH_COLORS} value={figure.shirtColor} onPick={shirtColor => up({ shirtColor })} />
        <div className="lbl">Calças</div><Swatches label="Cor das calças" list={CLOTH_COLORS} value={figure.trousersColor} onPick={trousersColor => up({ trousersColor })} />
        <div className="lbl">Sapatos</div><Swatches label="Cor dos sapatos" list={CLOTH_COLORS} value={figure.shoesColor} onPick={shoesColor => up({ shoesColor })} />
      </div>
    </div>
  );
}
