import { useEffect, useState } from 'react';
import {
  BAIRRO_BY_ID, PLACE_INFO, TRANSPORTS, VEHICLE_BY_ID, fmtEuros, tripQuote, type Figure, type PlaceId, type TransportMode,
} from '@bairro/shared';
import { useGame, type WindowId } from '../../store';
import { api } from '../../api';
import { act } from '../../cityActions';
import { AvatarPreview } from '../AvatarEditor';

export const fmtDur = (s: number) => (s >= 60 ? `${Math.floor(s / 60)} min ${String(Math.round(s % 60)).padStart(2, '0')} s` : `${Math.round(s)} s`);

const WINDOW_FOR: Partial<Record<PlaceId, WindowId>> = {
  banco: 'banco', multibanco: 'multibanco', imobiliaria: 'imobiliaria', stand: 'stand', trabalho: 'trabalho',
};

/** Painel do bairro: locais (se estás lá), quem está, ou como lá chegar. */
export function BairroPanel({ onEnterRoom }: { onEnterRoom: (roomId: string) => void }) {
  const id = useGame(s => s.bairroOpen);
  const city = useGame(s => s.city);
  const me = useGame(s => s.me);
  const presence = useGame(s => s.presence);
  const set = useGame(s => s.set);
  const [people, setPeople] = useState<Array<{ username: string; figure: Figure; motto: string }>>([]);
  const b = id ? BAIRRO_BY_ID.get(id) : undefined;
  const here = !!city && city.location === id && !city.travel;
  const count = id ? presence[id] ?? 0 : 0;

  useEffect(() => {
    if (!id) return;
    api.people(id).then(setPeople).catch(() => setPeople([]));
  }, [id, count]);

  if (!b || !city || !me) return null;
  const myHomes = city.properties.filter(p => p.bairro === b.id && p.roomId);
  const bestVehicle = city.vehicles.map(v => VEHICLE_BY_ID.get(v.model)!).filter(Boolean).sort((x, y) => x.secPerUnit - y.secPerUnit)[0];

  function openPlace(p: PlaceId) {
    const w = WINDOW_FOR[p];
    if (w) return set({ window: w });
    if ((p === 'praca' || p === 'cafe') && b!.roomId) return onEnterRoom(b!.roomId);
    if (p === 'casa_pais' && me!.homeRoomId) return onEnterRoom(me!.homeRoomId);
  }

  return (
    <aside className="bairro-panel" aria-label={`Bairro ${b.name}`}>
      <div className="bp-head">
        <div className="min-w-0">
          <h2>{b.name}</h2>
          <p>{b.blurb}</p>
        </div>
        <button className="win-close" onClick={() => set({ bairroOpen: null })} aria-label="Fechar">✕</button>
      </div>

      {here ? (
        <>
          <h3>Estás aqui</h3>
          <div className="places">
            {b.places.map(p => (
              <button key={p} className="place" onClick={() => openPlace(p)}>
                <span className="pi">{PLACE_INFO[p].icon}</span><span>{PLACE_INFO[p].name}</span>
              </button>
            ))}
            {myHomes.map(h => (
              <button key={h.id} className="place mine" onClick={() => onEnterRoom(h.roomId!)}>
                <span className="pi">🏡</span><span>A tua casa<small>{h.address}</small></span>
              </button>
            ))}
          </div>
        </>
      ) : city.travel ? (
        <p className="bp-note">Estás em viagem para {BAIRRO_BY_ID.get(city.travel.to)?.name}. Espera chegar para fazeres outra viagem.</p>
      ) : (
        <>
          <h3>Ir para {b.name}</h3>
          <div className="trips">
            {(Object.keys(TRANSPORTS) as TransportMode[]).filter(m => m !== 'carro' || bestVehicle).map(m => {
              const q = tripQuote(city.location, b.id, m, m === 'carro' ? bestVehicle?.secPerUnit : undefined);
              const t = TRANSPORTS[m];
              const cantPay = q.cost > city.wallet;
              return (
                <button key={m} className="trip" disabled={cantPay || !!city.work}
                  onClick={async () => { if (await act('/api/city/travel', { to: b.id, mode: m })) set({ bairroOpen: null }); }}>
                  <span className="pi">{m === 'carro' ? bestVehicle!.icon : t.icon}</span>
                  <span className="min-w-0"><b>{m === 'carro' ? bestVehicle!.name : t.name}</b><small>{fmtDur(q.seconds)}</small></span>
                  <span className="price">{q.cost ? fmtEuros(q.cost) : 'grátis'}</span>
                </button>
              );
            })}
          </div>
          {city.work && <p className="bp-note">Estás a meio de um turno. Acaba primeiro.</p>}
          <p className="bp-note">Os bilhetes e o combustível pagam-se com o dinheiro da carteira.</p>
        </>
      )}

      <h3>Quem está aqui ({count})</h3>
      <div className="people">
        {people.length === 0 && <p className="bp-note">Ninguém por aqui de momento.</p>}
        {people.map(p => (
          <div key={p.username} className="person" title={p.motto}>
            <AvatarPreview figure={p.figure} scale={1} single />
            <span>{p.username}</span>
          </div>
        ))}
      </div>
    </aside>
  );
}
