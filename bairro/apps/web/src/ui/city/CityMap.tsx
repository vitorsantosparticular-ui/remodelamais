import { useEffect, useMemo, useState } from 'react';
import { BAIRROS, BAIRRO_BY_ID, PLACE_INFO, lisbonHour, type Figure } from '@bairro/shared';
import { useGame } from '../../store';
import { renderAvatarSheet, AV_W, AV_H } from '../../game/avatar';

/** Ligações de estrada entre bairros (só para desenho). */
const ROADS: Array<[string, string]> = [
  ['belem', 'campo-ourique'], ['campo-ourique', 'avenidas'], ['campo-ourique', 'bairro-alto'], ['avenidas', 'parque-nacoes'],
  ['avenidas', 'baixa'], ['bairro-alto', 'chiado'], ['chiado', 'baixa'], ['baixa', 'alfama'], ['chiado', 'cais-sodre'],
  ['cais-sodre', 'belem'], ['alfama', 'parque-nacoes'], ['cais-sodre', 'baixa'],
];
/** Percurso do elétrico amarelo. */
const TRAM = ['campo-ourique', 'bairro-alto', 'chiado', 'baixa', 'alfama'];

const RIVER = 'M0,545 C120,530 260,522 380,516 S520,522 600,498 S760,452 820,380 S900,250 1000,170 L1000,620 L0,620 Z';

function avatarHead(f: Figure) {
  const sheet = renderAvatarSheet(f);
  const c = document.createElement('canvas');
  c.width = AV_W; c.height = AV_H;
  c.getContext('2d')!.drawImage(sheet, 0, 0, AV_W, AV_H, 0, 0, AV_W, AV_H);
  return c.toDataURL();
}

/** Mapa da cidade (ecrã principal). Todo o desenho é original e vetorial com ar de pixel-art. */
export function CityMap() {
  const city = useGame(s => s.city);
  const me = useGame(s => s.me);
  const presence = useGame(s => s.presence);
  const open = useGame(s => s.bairroOpen);
  const set = useGame(s => s.set);
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 250); return () => clearInterval(t); }, []);
  const avatar = useMemo(() => (me ? avatarHead(me.figure) : ''), [me?.figure]); // eslint-disable-line react-hooks/exhaustive-deps

  // Posição do jogador: no bairro, ou a meio da viagem.
  let pos = { x: 0, y: 0 };
  if (city) {
    const here = BAIRRO_BY_ID.get(city.location)!;
    pos = { x: here.x, y: here.y };
    if (city.travel) {
      const a = BAIRRO_BY_ID.get(city.travel.from)!, b = BAIRRO_BY_ID.get(city.travel.to)!;
      const t = Math.max(0, Math.min(1, (now - city.travel.startedAt) / (city.travel.arrivesAt - city.travel.startedAt)));
      pos = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
    }
  }
  const hour = lisbonHour(new Date(now));
  const night = hour < 6 || hour >= 21 ? 0.45 : hour < 8 ? 0.45 * (8 - hour) / 2 : hour > 19 ? 0.45 * (hour - 19) / 2 : 0;

  return (
    <svg className="city-map" viewBox="0 0 1000 620" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Mapa de Lisboa">
      <defs>
        <pattern id="ruas" width="22" height="22" patternUnits="userSpaceOnUse" patternTransform="rotate(-12)">
          <rect width="22" height="22" fill="#eadfc4" />
          <path d="M0 0H22M0 0V22" stroke="#dccfae" strokeWidth="2" />
        </pattern>
        <pattern id="ondas" width="40" height="14" patternUnits="userSpaceOnUse">
          <rect width="40" height="14" fill="#3f86b8" />
          <path d="M0 9 Q10 4 20 9 T40 9" stroke="#5aa0cf" strokeWidth="2" fill="none" />
        </pattern>
        <pattern id="calcada" width="12" height="12" patternUnits="userSpaceOnUse">
          <rect width="12" height="12" fill="#f3ead2" />
          <path d="M0 8 Q3 4 6 8 T12 8" stroke="#2e2e33" strokeWidth="2" fill="none" />
        </pattern>
      </defs>

      <rect width="1000" height="620" fill="url(#ruas)" />
      {/* Monsanto */}
      <path d="M20,190 C60,120 190,110 230,170 C270,230 250,330 190,370 C120,410 30,380 20,300 Z" fill="#7fb35a" stroke="#5f9a3c" strokeWidth="3" />
      {[[80, 200], [130, 170], [170, 240], [100, 290], [190, 320], [60, 330], [150, 360]].map(([x, y], i) => (
        <g key={i}><circle cx={x} cy={y} r="11" fill="#4f8a2f" /><circle cx={x - 3} cy={y - 3} r="5" fill="#6cc062" /></g>
      ))}
      <text x="120" y="270" className="map-area">Monsanto</text>
      {/* rio Tejo */}
      <path d={RIVER} fill="url(#ondas)" stroke="#2a5e86" strokeWidth="4" />
      <text x="640" y="585" className="map-area river">Rio Tejo</text>
      {/* ponte */}
      <g stroke="#c8402e" strokeWidth="5" strokeLinecap="square">
        <line x1="330" y1="520" x2="290" y2="620" />
        <line x1="322" y1="540" x2="322" y2="500" /><line x1="300" y1="595" x2="300" y2="555" />
      </g>
      <path d="M322,500 Q311,552 300,555" stroke="#c8402e" strokeWidth="2" fill="none" />
      {/* praça da Baixa */}
      <rect x="590" y="455" width="54" height="34" fill="url(#calcada)" stroke="#bfae84" strokeWidth="2" />

      {/* estradas */}
      {ROADS.map(([a, b]) => {
        const A = BAIRRO_BY_ID.get(a)!, B = BAIRRO_BY_ID.get(b)!;
        return <g key={a + b}><line x1={A.x} y1={A.y} x2={B.x} y2={B.y} stroke="#b9a77e" strokeWidth="9" strokeLinecap="round" /><line x1={A.x} y1={A.y} x2={B.x} y2={B.y} stroke="#fbf6e8" strokeWidth="5" strokeLinecap="round" /></g>;
      })}
      {/* linha do elétrico */}
      <polyline points={TRAM.map(id => `${BAIRRO_BY_ID.get(id)!.x},${BAIRRO_BY_ID.get(id)!.y}`).join(' ')} fill="none" stroke="#f5c518" strokeWidth="3" strokeDasharray="8 6" />
      {/* viagem em curso */}
      {city?.travel && (() => {
        const A = BAIRRO_BY_ID.get(city.travel.from)!, B = BAIRRO_BY_ID.get(city.travel.to)!;
        return <line x1={A.x} y1={A.y} x2={B.x} y2={B.y} stroke="#1f5f92" strokeWidth="4" strokeDasharray="2 8" strokeLinecap="round" />;
      })()}

      {/* bairros */}
      {BAIRROS.map(b => {
        const n = presence[b.id] ?? 0;
        const here = city?.location === b.id && !city?.travel;
        const icon = PLACE_INFO[b.places.find(p => p !== 'multibanco' && p !== 'trabalho') ?? b.places[0]].icon;
        const w = Math.max(b.name.length * 7.4 + 20, 70);
        return (
          <g key={b.id} className={`bairro ${open === b.id ? 'open' : ''} ${here ? 'here' : ''}`} transform={`translate(${b.x},${b.y})`}
            onClick={() => set({ bairroOpen: b.id })} role="button" tabIndex={0} aria-label={`${b.name}, ${n} pessoas`}
            onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') set({ bairroOpen: b.id }); }}>
            <circle r="16" className="pin" />
            <text y="5" textAnchor="middle" className="pin-icon">{icon}</text>
            <g transform="translate(0,24)">
              <rect x={-w / 2} width={w} height="20" rx="4" className="tag" />
              <text y="14" textAnchor="middle" className="tag-text">{b.name}</text>
            </g>
            {n > 0 && <g transform="translate(14,-14)"><circle r="10" className="count" /><text y="4" textAnchor="middle" className="count-text">{n}</text></g>}
          </g>
        );
      })}

      {/* o jogador */}
      {city && avatar && (
        <g transform={`translate(${pos.x - 16},${pos.y - 76})`} className="me-marker" pointerEvents="none">
          <ellipse cx="16" cy="62" rx="12" ry="4" fill="#000" opacity=".25" />
          <image href={avatar} width={AV_W} height={AV_H} style={{ imageRendering: 'pixelated' }} />
        </g>
      )}

      <rect width="1000" height="620" fill="#0b1640" opacity={night} pointerEvents="none" />
    </svg>
  );
}
