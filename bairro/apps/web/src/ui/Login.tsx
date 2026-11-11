import { useState, type FormEvent } from 'react';
import { DEFAULT_FIGURE, type Figure } from '@bairro/shared';
import { api, ApiError } from '../api';
import { useGame } from '../store';
import { AvatarEditor, AvatarPreview } from './AvatarEditor';
import { Window } from './Window';

const YEAR = new Date().getFullYear();

/** Entrada e criação de conta. Recolhe só o ano de nascimento (minimização de dados). */
export function Login() {
  const [tab, setTab] = useState<'entrar' | 'criar'>('entrar');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [birthYear, setBirthYear] = useState<number | ''>('');
  const [accept, setAccept] = useState(false);
  const [figure, setFigure] = useState<Figure>({ ...DEFAULT_FIGURE });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = useGame(s => s.set);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(''); setBusy(true);
    try {
      if (tab === 'entrar') await api.login(username, password);
      else {
        if (!birthYear) throw new ApiError(400, 'Indica o ano em que nasceste.');
        await api.register({ username, password, birthYear: Number(birthYear), figure, acceptTerms: accept });
      }
      set({ me: await api.me() });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro inesperado.');
    } finally { setBusy(false); }
  }

  return (
    <div className="login-bg">
      <div className="login-wrap">
        <header className="text-center">
          <h1 className="logo">BAIRRO<span>.PT</span></h1>
          <p className="tagline">O teu bairro virtual. Faz amigos, decora a tua casa, vive a cidade.</p>
        </header>
        <Window title={tab === 'entrar' ? 'Entrar no bairro' : 'Criar o teu lisboeta'} width={tab === 'criar' ? 560 : 380}>
          <div className="tabs" role="tablist">
            <button role="tab" aria-selected={tab === 'entrar'} className={tab === 'entrar' ? 'on' : ''} onClick={() => { setTab('entrar'); setError(''); }}>Entrar</button>
            <button role="tab" aria-selected={tab === 'criar'} className={tab === 'criar' ? 'on' : ''} onClick={() => { setTab('criar'); setError(''); }}>Criar conta</button>
          </div>
          <form onSubmit={submit} className="grid gap-3">
            {tab === 'criar' && <AvatarEditor figure={figure} onChange={setFigure} />}
            <label className="field">Nome no bairro
              <input id="username" autoComplete="username" value={username} onChange={e => setUsername(e.target.value)} maxLength={16} required placeholder="ex.: Tuga_2010" />
            </label>
            <label className="field">Palavra-passe
              <input id="password" type="password" autoComplete={tab === 'entrar' ? 'current-password' : 'new-password'} value={password} onChange={e => setPassword(e.target.value)} minLength={tab === 'criar' ? 8 : 1} required />
            </label>
            {tab === 'criar' && (
              <>
                <label className="field">Ano de nascimento
                  <select id="birthYear" value={birthYear} onChange={e => setBirthYear(e.target.value ? Number(e.target.value) : '')} required>
                    <option value="">Escolhe…</option>
                    {Array.from({ length: 90 }, (_, i) => YEAR - i).map(y => <option key={y} value={y}>{y}</option>)}
                  </select>
                </label>
                <label className="flex gap-2 items-start text-[11px] font-normal">
                  <input id="accept" type="checkbox" checked={accept} onChange={e => setAccept(e.target.checked)} required />
                  <span>Aceito as regras do bairro: respeito por todos, nada de partilhar contactos ou dados pessoais, e denunciar quem se portar mal.</span>
                </label>
              </>
            )}
            {error && <p className="err" role="alert">{error}</p>}
            <button className="btn green" disabled={busy}>{busy ? 'Um momento…' : tab === 'entrar' ? 'Entrar' : 'Criar conta e entrar'}</button>
            {tab === 'entrar' && (
              <div className="flex items-center gap-3 text-[11px] font-normal text-slate-600">
                <AvatarPreview figure={DEFAULT_FIGURE} scale={1} />
                <span>Ainda não tens conta? Escolhe <b>Criar conta</b>: é grátis e demora um minuto.</span>
              </div>
            )}
          </form>
        </Window>
        <p className="foot">Precisas de ter pelo menos 13 anos. Só guardamos o ano de nascimento, nunca a data completa.</p>
      </div>
    </div>
  );
}
