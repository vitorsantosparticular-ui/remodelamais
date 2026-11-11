import { useEffect, useState, type FormEvent } from 'react';
import {
  BAIRROS, BAIRRO_BY_ID, JOBS, MAX_SHIFTS_PER_DAY, PROPERTY_RESALE, PROPERTY_TYPES, VEHICLES, VEHICLE_BY_ID, VEHICLE_RESALE,
  fmtEuros, type PropertyListing,
} from '@bairro/shared';
import { api } from '../../api';
import { act } from '../../cityActions';
import { useGame } from '../../store';
import { Window } from '../Window';
import { fmtDur } from './BairroPanel';

const close = () => useGame.getState().set({ window: null });

function Balances() {
  const city = useGame(s => s.city)!;
  return (
    <div className="balances">
      <div><small>Carteira</small><b>{fmtEuros(city.wallet)}</b></div>
      <div><small>Conta bancária</small><b>{fmtEuros(city.bank)}</b></div>
    </div>
  );
}

function Statement() {
  const city = useGame(s => s.city);
  const [rows, setRows] = useState<Awaited<ReturnType<typeof api.statement>> | null>(null);
  useEffect(() => { api.statement().then(setRows).catch(() => setRows([])); }, [city?.wallet, city?.bank]);
  return (
    <details className="statement">
      <summary>Ver movimentos</summary>
      <table>
        <tbody>
          {rows?.map(r => (
            <tr key={r.id}>
              <td>{new Date(r.ts).toLocaleString('pt-PT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</td>
              <td>{r.memo || r.kind}<small>{r.account === 'BANK' ? 'Banco' : 'Carteira'}</small></td>
              <td className={r.amount < 0 ? 'neg' : 'pos'}>{r.amount > 0 ? '+' : ''}{fmtEuros(r.amount)}</td>
            </tr>
          ))}
          {rows?.length === 0 && <tr><td colSpan={3}>Ainda não há movimentos.</td></tr>}
        </tbody>
      </table>
    </details>
  );
}

function AmountForm({ label, button, onSubmit, extra }: { label: string; button: string; onSubmit: (amount: string, to: string) => Promise<boolean>; extra?: boolean }) {
  const [amount, setAmount] = useState('');
  const [to, setTo] = useState('');
  async function submit(e: FormEvent) { e.preventDefault(); if (await onSubmit(amount, to)) { setAmount(''); setTo(''); } }
  return (
    <form className="amount-form" onSubmit={submit}>
      {extra && <label className="field">Para (nome do jogador)<input value={to} onChange={e => setTo(e.target.value)} required maxLength={16} /></label>}
      <label className="field">{label}<input inputMode="decimal" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0,00 €" required /></label>
      <button className="btn green">{button}</button>
    </form>
  );
}

export function BankWindow() {
  return (
    <Window title="🏦 Banco do Bairro — balcão" onClose={close} width={420} className="win-left">
      <p className="muted mb-2">Deposita aqui o dinheiro da carteira. As rendas são pagas por débito direto da conta.</p>
      <Balances />
      <AmountForm label="Depositar" button="Depositar" onSubmit={a => act('/api/bank/deposit', { amount: a }, 'Depósito feito.')} />
      <Statement />
    </Window>
  );
}

export function AtmWindow() {
  return (
    <Window title="🏧 Multibanco" onClose={close} width={420} className="win-left">
      <Balances />
      <AmountForm label="Levantar (até 400 €)" button="Levantar" onSubmit={a => act('/api/bank/withdraw', { amount: a }, 'Levantamento feito.')} />
      <h4 className="sub">Transferência para outro jogador</h4>
      <AmountForm extra label="Montante (até 500 €)" button="Transferir" onSubmit={(a, to) => act('/api/bank/transfer', { amount: a, to }, 'Transferência enviada.')} />
      <Statement />
    </Window>
  );
}

export function JobsWindow() {
  const city = useGame(s => s.city)!;
  const jobs = JOBS.filter(j => j.bairro === city.location);
  return (
    <Window title={`💼 Biscates em ${BAIRRO_BY_ID.get(city.location)?.name}`} onClose={close} width={400} className="win-left">
      <p className="muted mb-2">Turnos em tempo real. O pagamento vai para a carteira no fim. Hoje: {city.shiftsToday}/{MAX_SHIFTS_PER_DAY} turnos.</p>
      <div className="list">
        {jobs.map(j => (
          <div key={j.id} className="row">
            <span className="pi">{j.icon}</span>
            <span className="min-w-0"><b>{j.name}</b><small>{fmtDur(j.seconds)} · {fmtEuros(j.pay)}</small></span>
            <button className="btn green" disabled={!!city.work || city.shiftsToday >= MAX_SHIFTS_PER_DAY}
              onClick={async () => { if (await act('/api/jobs/start', { id: j.id }, 'Mãos à obra!')) close(); }}>Começar</button>
          </div>
        ))}
      </div>
      <p className="muted mt-2">Há biscates diferentes em cada bairro. Os mais longe pagam melhor.</p>
    </Window>
  );
}

export function StandWindow() {
  const city = useGame(s => s.city)!;
  return (
    <Window title="🚗 Stand Avenida Motors" onClose={close} width={460} className="win-left">
      <Balances />
      <p className="muted mb-2">Paga-se pela conta bancária. Com veículo próprio viajas mais depressa (só pagas combustível).</p>
      <div className="list">
        {VEHICLES.map(v => (
          <div key={v.id} className="row">
            <span className="pi">{v.icon}</span>
            <span className="min-w-0"><b>{v.name}</b><small>{fmtEuros(v.price)} · {Math.round((2 / v.secPerUnit) * 10) / 10}× mais rápido que a pé</small></span>
            <button className="btn green" disabled={city.bank < v.price} onClick={() => act('/api/vehicles/buy', { id: v.id }, `${v.name} é teu!`)}>Comprar</button>
          </div>
        ))}
      </div>
      {city.vehicles.length > 0 && <h4 className="sub">A tua garagem</h4>}
      <div className="list">
        {city.vehicles.map(v => {
          const m = VEHICLE_BY_ID.get(v.model);
          return (
            <div key={v.id} className="row">
              <span className="pi">{m?.icon}</span>
              <span className="min-w-0"><b>{m?.name}</b><small>Vale {fmtEuros(Math.round((m?.price ?? 0) * VEHICLE_RESALE))} na retoma</small></span>
              <button className="btn" onClick={() => act('/api/vehicles/sell', { id: v.id }, 'Veículo vendido.')}>Vender</button>
            </div>
          );
        })}
      </div>
    </Window>
  );
}

export function RealEstateWindow() {
  const city = useGame(s => s.city)!;
  const [list, setList] = useState<PropertyListing[] | null>(null);
  const [filter, setFilter] = useState('todos');
  const load = () => api.properties().then(setList).catch(() => setList([]));
  useEffect(() => { load(); }, [city.bank]);
  const rows = (list ?? []).filter(p => filter === 'todos' || p.bairro === filter);
  return (
    <Window title="🔑 Imobiliária Sete Colinas" onClose={close} width={560} className="win-left">
      <Balances />
      <p className="muted mb-2">Cada casa é única: se outro jogador ficar com ela, deixa de estar disponível. Rendas semanais por débito direto; se não houver saldo, há despejo.</p>
      <label className="field mb-2">Bairro
        <select value={filter} onChange={e => setFilter(e.target.value)}>
          <option value="todos">Todos</option>
          {BAIRROS.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
      </label>
      <div className="list">
        {!list && <p className="muted">A carregar…</p>}
        {rows.map(p => (
          <div key={p.id} className={`row ${p.mine ? 'mine' : ''}`}>
            <span className="pi">{p.type === 'moradia' ? '🏡' : p.type === 'loft' ? '🏙️' : '🏠'}</span>
            <span className="min-w-0">
              <b>{PROPERTY_TYPES[p.type].name} · {p.address}</b>
              <small>{BAIRRO_BY_ID.get(p.bairro)?.name} · renda {fmtEuros(p.rentWeek)}/semana · venda {fmtEuros(p.price)}</small>
              {p.status !== 'livre' && <small className={p.mine ? 'ok' : 'taken'}>{p.mine ? (p.status === 'vendida' ? 'É tua' : 'Arrendada por ti') : `${p.status === 'vendida' ? 'Vendida a' : 'Arrendada por'} ${p.occupant}`}</small>}
            </span>
            <span className="actions">
              {p.status === 'livre' && <>
                <button className="btn green" disabled={city.bank < p.rentWeek} onClick={async () => { await act('/api/properties/rent', { id: p.id }, 'Casa arrendada! Já podes entrar.'); load(); }}>Arrendar</button>
                <button className="btn" disabled={city.bank < p.price} onClick={async () => { await act('/api/properties/buy', { id: p.id }, 'Parabéns, casa própria!'); load(); }}>Comprar</button>
              </>}
              {p.mine && <button className="btn" onClick={async () => { await act('/api/properties/release', { id: p.id }, p.status === 'vendida' ? 'Casa vendida.' : 'Contrato terminado.'); load(); }}>
                {p.status === 'vendida' ? `Vender (${fmtEuros(Math.round(p.price * PROPERTY_RESALE))})` : 'Deixar'}</button>}
            </span>
          </div>
        ))}
      </div>
    </Window>
  );
}

export function AssetsWindow({ onEnterRoom }: { onEnterRoom: (roomId: string) => void }) {
  const city = useGame(s => s.city)!;
  const me = useGame(s => s.me)!;
  return (
    <Window title="🎒 Os meus bens" onClose={close} width={440} className="win-left">
      <Balances />
      <h4 className="sub">Casas</h4>
      <div className="list">
        <div className="row">
          <span className="pi">🏠</span>
          <span className="min-w-0"><b>Quarto em casa dos pais</b><small>Campo de Ourique · grátis (a mãe agradece que arrumes)</small></span>
          <button className="btn" disabled={city.location !== 'campo-ourique' || !!city.travel} onClick={() => me.homeRoomId && onEnterRoom(me.homeRoomId)}>Entrar</button>
        </div>
        {city.properties.map(p => (
          <div key={p.id} className="row mine">
            <span className="pi">🏡</span>
            <span className="min-w-0">
              <b>{PROPERTY_TYPES[p.type].name} · {p.address}</b>
              <small>{BAIRRO_BY_ID.get(p.bairro)?.name} · {p.relation === 'owner' ? 'Casa própria' : `Arrendada · paga até ${new Date(p.rentPaidUntil!).toLocaleDateString('pt-PT')} · ${fmtEuros(p.rentWeek)}/semana`}</small>
            </span>
            <button className="btn" disabled={city.location !== p.bairro || !!city.travel} onClick={() => p.roomId && onEnterRoom(p.roomId)}>Entrar</button>
          </div>
        ))}
        {city.properties.length === 0 && <p className="muted">Ainda vives com os pais. Junta dinheiro e passa pela imobiliária no Chiado!</p>}
      </div>
      <h4 className="sub">Veículos</h4>
      <div className="list">
        {city.vehicles.map(v => { const m = VEHICLE_BY_ID.get(v.model); return <div key={v.id} className="row"><span className="pi">{m?.icon}</span><span><b>{m?.name}</b></span></div>; })}
        {city.vehicles.length === 0 && <p className="muted">Sem veículo. Andas a pé, de metro ou de táxi.</p>}
      </div>
      <p className="muted mt-2">Para entrar numa casa tens de estar no bairro dela.</p>
    </Window>
  );
}
