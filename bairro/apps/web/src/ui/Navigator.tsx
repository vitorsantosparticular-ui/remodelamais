import { useEffect, useState, type FormEvent } from 'react';
import { FLOOR_TYPES, WALL_TYPES } from '@bairro/shared';
import { api, type RoomListItem } from '../api';
import { useGame } from '../store';
import { Window } from './Window';

type Tab = 'public' | 'players' | 'mine' | 'create';
const TABS: Array<[Tab, string]> = [['public', 'Espaços públicos'], ['players', 'Quartos'], ['mine', 'Os meus'], ['create', 'Criar']];
const FLOOR_LABEL: Record<string, string> = { calcada: 'Calçada', madeira: 'Madeira', azulejo: 'Azulejo', alcatifa: 'Alcatifa', relva: 'Relva', areia: 'Areia' };
const WALL_LABEL: Record<string, string> = { nenhuma: 'Sem paredes', branca: 'Branca', amarela: 'Amarela', azulejo: 'Azulejo', rosa: 'Rosa' };

/** Navegador central: viajar entre espaços públicos e quartos de jogadores sem sair do jogo. */
export function Navigator({ onEnter }: { onEnter: (roomId: string) => void }) {
  const [tab, setTab] = useState<Tab>('public');
  const [rooms, setRooms] = useState<RoomListItem[] | null>(null);
  const [error, setError] = useState('');
  const set = useGame(s => s.set);
  const current = useGame(s => s.room?.id);

  useEffect(() => {
    if (tab === 'create') return;
    setRooms(null); setError('');
    api.rooms(tab).then(setRooms).catch(e => setError(e.message));
  }, [tab]);

  return (
    <Window title="Navegador" onClose={() => set({ window: null })} width={420} className="win-left">
      <div className="tabs" role="tablist">
        {TABS.map(([id, label]) => <button key={id} role="tab" aria-selected={tab === id} className={tab === id ? 'on' : ''} onClick={() => setTab(id)}>{label}</button>)}
      </div>
      {tab === 'create' ? <CreateRoom onCreated={id => { onEnter(id); set({ window: null }); }} /> : (
        <div className="room-list">
          {error && <p className="err">{error}</p>}
          {!rooms && !error && <p className="muted">A carregar…</p>}
          {rooms?.length === 0 && <p className="muted">{tab === 'mine' ? 'Ainda não criaste quartos. Usa o separador Criar.' : 'Não há quartos abertos de momento.'}</p>}
          {rooms?.map(r => (
            <button key={r.id} className={`room-row ${r.id === current ? 'here' : ''}`} onClick={() => { onEnter(r.id); set({ window: null }); }}>
              <span className={`occ ${r.users > 0 ? 'on' : ''}`}>{r.users}</span>
              <span className="min-w-0">
                <b>{r.name}</b>
                <small>{r.ownerName ? `de ${r.ownerName}` : r.description}{r.access === 'OWNER_ONLY' ? ' · 🔒 privado' : ''}</small>
              </span>
            </button>
          ))}
        </div>
      )}
    </Window>
  );
}

function CreateRoom({ onCreated }: { onCreated: (id: string) => void }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [size, setSize] = useState('medio');
  const [floor, setFloor] = useState('madeira');
  const [wall, setWall] = useState('branca');
  const [access, setAccess] = useState('OPEN');
  const [error, setError] = useState('');
  async function submit(e: FormEvent) {
    e.preventDefault(); setError('');
    try { onCreated((await api.createRoom({ name, description, size, floor, wall, access })).id); }
    catch (err) { setError((err as Error).message); }
  }
  return (
    <form className="grid gap-2" onSubmit={submit}>
      <label className="field">Nome do quarto<input id="room-name" value={name} onChange={e => setName(e.target.value)} maxLength={40} required minLength={3} /></label>
      <label className="field">Descrição<input id="room-desc" value={description} onChange={e => setDescription(e.target.value)} maxLength={140} /></label>
      <div className="grid grid-cols-2 gap-2">
        <label className="field">Tamanho<select id="room-size" value={size} onChange={e => setSize(e.target.value)}>
          <option value="pequeno">Pequeno (6×6)</option><option value="medio">Médio (9×9)</option><option value="grande">Grande (12×12)</option></select></label>
        <label className="field">Acesso<select id="room-access" value={access} onChange={e => setAccess(e.target.value)}>
          <option value="OPEN">Aberto a visitas</option><option value="OWNER_ONLY">Só eu</option></select></label>
        <label className="field">Chão<select id="room-floor" value={floor} onChange={e => setFloor(e.target.value)}>{FLOOR_TYPES.map(f => <option key={f} value={f}>{FLOOR_LABEL[f]}</option>)}</select></label>
        <label className="field">Paredes<select id="room-wall" value={wall} onChange={e => setWall(e.target.value)}>{WALL_TYPES.map(w => <option key={w} value={w}>{WALL_LABEL[w]}</option>)}</select></label>
      </div>
      {error && <p className="err">{error}</p>}
      <button className="btn green">Criar e entrar</button>
    </form>
  );
}
