import { useEffect, useRef, useState, type FormEvent } from 'react';
import { CHAT_MAX_LENGTH, type Figure } from '@bairro/shared';
import { RoomView } from '../game/RoomView';
import { connectGame, joinRoom, type GameSocket } from '../net/socket';
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
  const { me, room, window: win, set, connected } = useGame();

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
      const m = useGame.getState().me!;
      sock.current = connectGame(v, m.lastRoomId ?? 'praca-central');
      (window as unknown as { __bairro: unknown }).__bairro = { view: v, socket: sock.current };
    });
    return () => { alive = false; sock.current?.disconnect(); if (mounted) v.destroy(); };
  }, []);

  const enter = (roomId: string) => sock.current && joinRoom(sock.current, roomId);
  if (!me) return null;

  return (
    <div className="game">
      <div ref={host} className="viewport" />
      <div className="hud-top">
        <div className="panel">
          <div className="room-name">{room?.name ?? 'A ligar…'}</div>
          <div className="room-sub">{room?.ownerName ? `Quarto de ${room.ownerName}` : room?.description}</div>
        </div>
        <div className="panel wallet" aria-label="Carteira">
          <span title="Créditos"><i className="coin" /> {me.credits}</span>
          <span title="Diamantes"><i className="gem" /> {me.diamonds}</span>
        </div>
      </div>
      {!connected && <div className="offline">Sem ligação ao servidor. A tentar de novo…</div>}

      {win === 'navigator' && <Navigator onEnter={enter} />}
      {win === 'avatar' && <AvatarWindow />}
      {win === 'chatlog' && <ChatLog />}
      <SelectedUser />
      <Toast />

      <div className="toolbar">
        <div className="tools">
          <button className="tool" onClick={() => set({ window: win === 'navigator' ? null : 'navigator' })} title="Navegador (N)"><span>🧭</span><small>Navegar</small></button>
          <button className="tool" onClick={() => me.homeRoomId && enter(me.homeRoomId)} title="Ir para a tua casa"><span>🏠</span><small>Casa</small></button>
          <button className="tool" onClick={() => set({ window: win === 'avatar' ? null : 'avatar' })} title="Mudar o visual"><span>👕</span><small>Visual</small></button>
          <button className="tool" onClick={() => set({ window: win === 'chatlog' ? null : 'chatlog' })} title="Histórico do chat"><span>💬</span><small>Histórico</small></button>
          <button className="tool" onClick={() => view.current?.setZoom(view.current.getZoom() === 1 ? 2 : 1)} title="Zoom"><span>🔍</span><small>Zoom</small></button>
        </div>
        <ChatInput socket={sock} />
        <button className="tool" onClick={async () => { await api.logout(); sock.current?.disconnect(); set({ me: null, room: null }); }} title="Sair"><span>🚪</span><small>Sair</small></button>
      </div>
      <Shortcuts />
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
      <AvatarPreview figure={u.figure} scale={1} />
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
function Shortcuts() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = (e.target as HTMLElement).matches('input, select, textarea');
      const s = useGame.getState();
      if (e.key === 'Escape') { s.set({ window: null, selectedUserId: null }); (document.activeElement as HTMLElement)?.blur(); return; }
      if (typing) return;
      if (e.key === 'Enter') { document.getElementById('chat-input')?.focus(); e.preventDefault(); }
      if (e.key.toLowerCase() === 'n') s.set({ window: s.window === 'navigator' ? null : 'navigator' });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  return null;
}
