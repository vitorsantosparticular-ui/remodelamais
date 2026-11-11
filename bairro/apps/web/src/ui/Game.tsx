import { useEffect, useRef, useState, type FormEvent } from 'react';
import { CHAT_MAX_LENGTH, type Figure } from '@bairro/shared';
import { RoomView } from '../game/RoomView';
import { connectGame, enterRoom, leaveRoom, type GameSocket } from '../net/socket';
import { refreshCity } from '../cityActions';
import { BAIRRO_BY_ID, JOB_BY_ID, TRANSPORTS, fmtEuros } from '@bairro/shared';
import { CityMap } from './city/CityMap';
import { BairroPanel, fmtDur } from './city/BairroPanel';
import { AssetsWindow, AtmWindow, BankWindow, JobsWindow, RealEstateWindow, StandWindow } from './city/PlaceWindows';
import { useGame } from '../store';
import { api } from '../api';
import { Navigator } from './Navigator';
import { AvatarEditor, AvatarPreview } from './AvatarEditor';
import { Window } from './Window';

/** Ecrã principal: viewport do jogo + barra de ferramentas + janelas. */
export function Game() {
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<RoomView | null>(null);
  const sock = useRef<GameSocket | null>(null);
  const { me, room, window: win, set, connected, mode, city } = useGame();

  useEffect(() => {
    let alive = true;
    const v = new RoomView({
      onTileClick: (x, y) => sock.current?.emit('room:move', { x, y }),
      onAvatarClick: id => useGame.getState().set({ selectedUserId: id }),
    });
    view.current = v;
    let mounted = false;
    v.mount(host.current!).then(() => {
      mounted = true;
      if (!alive) { v.destroy(); return; }
      sock.current = connectGame(v);
      (window as unknown as { __bairro: unknown }).__bairro = { view: v, socket: sock.current };
    });
    refreshCity();
    return () => { alive = false; sock.current?.disconnect(); if (mounted) v.destroy(); };
  }, []);

  // Quando a viagem ou o turno acabam, pede o estado novo ao servidor.
  useEffect(() => {
    const ends = [city?.travel?.arrivesAt, city?.work?.until].filter((t): t is number => !!t);
    if (!ends.length) return;
    const ms = Math.max(200, Math.min(...ends) - Date.now() + 300);
    const t = setTimeout(async () => {
      const before = useGame.getState().city;
      await refreshCity();
      const after = useGame.getState().city;
      if (before?.travel && !after?.travel) useGame.getState().notify(`Chegaste a ${BAIRRO_BY_ID.get(after!.location)?.name}!`);
      if (before?.work && !after?.work) useGame.getState().notify(`Turno acabado: +${fmtEuros(JOB_BY_ID.get(before.work.jobId)?.pay ?? 0)} na carteira.`);
    }, ms);
    return () => clearTimeout(t);
  }, [city?.travel?.arrivesAt, city?.work?.until]);

  const enter = (roomId: string) => { set({ window: null }); enterRoom(sock.current, roomId); };
  if (!me) return null;
  const inRoom = mode === 'room';

  return (
    <div className={`game ${inRoom ? 'in-room' : 'in-city'}`}>
      <div ref={host} className="viewport" style={{ visibility: inRoom ? 'visible' : 'hidden' }} />
      {!inRoom && (
        <div className="city-layer">
          <CityMap />
          <BairroPanel onEnterRoom={enter} />
        </div>
      )}

      <div className="hud-top">
        <div className="panel">
          {inRoom ? <>
            <div className="room-name">{room?.name ?? 'A entrar…'}</div>
            <div className="room-sub">{room?.ownerName ? `Quarto de ${room.ownerName}` : room?.description}</div>
          </> : <CityStatus />}
        </div>
        <div className="panel wallet" aria-label="Dinheiro">
          <span title="Carteira">👛 {city ? fmtEuros(city.wallet) : '—'}</span>
          <span title="Conta bancária">🏦 {city ? fmtEuros(city.bank) : '—'}</span>
          <span title="Diamantes"><i className="gem" /> {city?.diamonds ?? me.diamonds}</span>
        </div>
      </div>
      {!connected && <div className="offline">Sem ligação ao servidor. A tentar de novo…</div>}

      {win === 'navigator' && <Navigator onEnter={enter} />}
      {win === 'avatar' && <AvatarWindow />}
      {win === 'chatlog' && <ChatLog />}
      {win === 'banco' && city && <BankWindow />}
      {win === 'multibanco' && city && <AtmWindow />}
      {win === 'trabalho' && city && <JobsWindow />}
      {win === 'stand' && city && <StandWindow />}
      {win === 'imobiliaria' && city && <RealEstateWindow />}
      {win === 'bens' && city && <AssetsWindow onEnterRoom={enter} />}
      {inRoom && <SelectedUser />}
      <Toast />

      <div className="toolbar">
        <div className="tools">
          {inRoom
            ? <button className="tool" onClick={() => leaveRoom(sock.current)} title="Sair para o mapa (M)"><span>🗺️</span><small>Mapa</small></button>
            : <button className="tool" onClick={() => set({ bairroOpen: city?.location ?? null })} title="O bairro onde estás"><span>📍</span><small>Aqui</small></button>}
          <button className="tool" onClick={() => set({ window: win === 'bens' ? null : 'bens' })} title="Casas, veículos e dinheiro"><span>🎒</span><small>Bens</small></button>
          <button className="tool" onClick={() => set({ window: win === 'avatar' ? null : 'avatar' })} title="Mudar o visual"><span>👕</span><small>Visual</small></button>
          <button className="tool" onClick={() => set({ window: win === 'navigator' ? null : 'navigator' })} title="Quartos dos jogadores (N)"><span>🧭</span><small>Quartos</small></button>
          {inRoom && <>
            <button className="tool" onClick={() => set({ window: win === 'chatlog' ? null : 'chatlog' })} title="Histórico do chat"><span>💬</span><small>Histórico</small></button>
            <button className="tool" onClick={() => view.current?.setZoom(view.current.getZoom() === 1 ? 2 : 1)} title="Zoom"><span>🔍</span><small>Zoom</small></button>
          </>}
        </div>
        {inRoom ? <ChatInput socket={sock} /> : <div className="chat city-hint">Toca num bairro para veres o que há lá ou para viajares. {useGame.getState().online > 0 && `${useGame.getState().online} jogador(es) na cidade.`}</div>}
        <button className="tool" onClick={async () => { await api.logout(); sock.current?.disconnect(); set({ me: null, room: null, city: null, mode: 'city' }); }} title="Sair"><span>🚪</span><small>Sair</small></button>
      </div>
      <Shortcuts onMap={() => leaveRoom(sock.current)} />
    </div>
  );
}

/** Onde estou / o que estou a fazer, com barra de progresso. */
function CityStatus() {
  const city = useGame(s => s.city);
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 500); return () => clearInterval(t); }, []);
  if (!city) return <div className="room-name">A abrir a cidade…</div>;
  const hour = new Intl.DateTimeFormat('pt-PT', { timeZone: 'Europe/Lisbon', hour: '2-digit', minute: '2-digit' }).format(now);
  let label = `Em ${BAIRRO_BY_ID.get(city.location)?.name}`, sub = `Lisboa, ${hour}`, pct: number | null = null;
  if (city.travel) {
    const left = Math.max(0, (city.travel.arrivesAt - now) / 1000);
    label = `A caminho de ${BAIRRO_BY_ID.get(city.travel.to)?.name}`;
    sub = `${TRANSPORTS[city.travel.mode].icon} ${TRANSPORTS[city.travel.mode].name} · faltam ${fmtDur(left)}`;
    pct = (now - city.travel.startedAt) / (city.travel.arrivesAt - city.travel.startedAt);
  } else if (city.work) {
    const job = JOB_BY_ID.get(city.work.jobId);
    const left = Math.max(0, (city.work.until - now) / 1000);
    label = `${job?.icon} ${job?.name}`;
    sub = `A trabalhar · faltam ${fmtDur(left)} · ${fmtEuros(job?.pay ?? 0)}`;
    pct = (now - city.work.startedAt) / (city.work.until - city.work.startedAt);
  }
  return (
    <div className="status">
      <div className="room-name">{label}</div>
      <div className="room-sub">{sub}</div>
      {pct !== null && <div className="bar"><div style={{ width: `${Math.min(100, Math.max(0, pct * 100))}%` }} /></div>}
    </div>
  );
}

function ChatInput({ socket }: { socket: React.RefObject<GameSocket | null> }) {
  const [text, setText] = useState('');
  function send(e: FormEvent) {
    e.preventDefault();
    const t = text.trim();
    if (t) socket.current?.emit('chat:send', { text: t });
    setText('');
  }
  return (
    <form className="chat" onSubmit={send}>
      <input id="chat-input" value={text} onChange={e => setText(e.target.value)} maxLength={CHAT_MAX_LENGTH} placeholder="Escreve aqui e carrega Enter…" autoComplete="off" enterKeyHint="send" />
    </form>
  );
}

function AvatarWindow() {
  const me = useGame(s => s.me)!;
  const set = useGame(s => s.set);
  const [figure, setFigure] = useState<Figure>(me.figure);
  const [motto, setMotto] = useState(me.motto);
  const [busy, setBusy] = useState(false);
  async function save() {
    setBusy(true);
    try {
      const r = await api.saveFigure(figure, motto);
      set({ me: { ...me, figure: r.figure, motto: r.motto }, window: null });
      useGame.getState().notify('Visual guardado!');
    } catch (e) { useGame.getState().notify((e as Error).message); } finally { setBusy(false); }
  }
  return (
    <Window title="O teu visual" onClose={() => set({ window: null })} width={520} className="win-left">
      <div className="grid gap-3">
        <AvatarEditor figure={figure} onChange={setFigure} />
        <label className="field">Lema<input id="motto" value={motto} maxLength={60} onChange={e => setMotto(e.target.value)} placeholder="Uma frase sobre ti" /></label>
        <button className="btn green" onClick={save} disabled={busy}>Guardar visual</button>
      </div>
    </Window>
  );
}

function ChatLog() {
  const chat = useGame(s => s.chat);
  const set = useGame(s => s.set);
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => end.current?.scrollIntoView({ block: 'end' }), [chat.length]);
  return (
    <Window title="Histórico do quarto" onClose={() => set({ window: null })} width={340} className="win-right">
      <div className="chatlog">
        {chat.length === 0 && <p className="muted">Ainda ninguém disse nada neste quarto.</p>}
        {chat.map(m => (
          <p key={m.id}><time>{new Date(m.ts).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}</time> <b>{m.username}:</b> {m.text}</p>
        ))}
        <div ref={end} />
      </div>
      <p className="muted mt-2">As mensagens dos quartos são apagadas ao fim de 30 dias.</p>
    </Window>
  );
}

function SelectedUser() {
  const id = useGame(s => s.selectedUserId);
  const u = useGame(s => (id ? s.users[id] : undefined));
  const set = useGame(s => s.set);
  if (!u) return null;
  return (
    <div className="user-card panel">
      <button className="x" onClick={() => set({ selectedUserId: null })} aria-label="Fechar">✕</button>
      <AvatarPreview figure={u.figure} scale={1} single />
      <div className="min-w-0">
        <b>{u.username}</b>
        <p>{u.motto || '—'}</p>
      </div>
    </div>
  );
}

function Toast() {
  const toast = useGame(s => s.toast);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (!toast) return;
    setVisible(true);
    const t = setTimeout(() => setVisible(false), 3500);
    return () => clearTimeout(t);
  }, [toast]);
  return toast && visible ? <div className="toast" role="status">{toast.text}</div> : null;
}

/** Atalhos: Enter foca o chat, N abre o navegador, H vai para casa, Esc fecha janelas. */
function Shortcuts({ onMap }: { onMap: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = (e.target as HTMLElement).matches('input, select, textarea');
      const s = useGame.getState();
      if (e.key === 'Escape') { s.set({ window: null, selectedUserId: null }); (document.activeElement as HTMLElement)?.blur(); return; }
      if (typing) return;
      if (e.key === 'Enter') { document.getElementById('chat-input')?.focus(); e.preventDefault(); }
      if (e.key.toLowerCase() === 'n') s.set({ window: s.window === 'navigator' ? null : 'navigator' });
      if (e.key.toLowerCase() === 'm' && s.mode === 'room') onMap();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onMap]);
  return null;
}
