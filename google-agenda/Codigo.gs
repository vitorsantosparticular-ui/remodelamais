/**
 * Agenda do site: liga a marcação de consultas ao Google Calendar da Dra. Sónia.
 *
 * O que faz:
 *  - GET  ?acao=dias&tipo=online|presencial      -> ["2026-10-20", ...]  dias com pelo menos uma hora livre
 *  - GET  ?acao=horas&dia=AAAA-MM-DD&tipo=...    -> ["10:00", "10:30", ...]  horas livres nesse dia
 *  - POST {acao:"reservar", dia, hora, tipo, nome, email, telefone, assunto, mensagem}
 *         -> cria um evento "Pedido de marcação" no calendário (fica a ocupar a hora até a Dra. confirmar)
 *
 * Uma hora só aparece no site se estiver dentro do horário abaixo e se não houver
 * nenhum evento no calendário a ocupar esse tempo (mais o intervalo entre consultas).
 * Um evento de dia inteiro (ex.: "Férias", "Tribunal") bloqueia o dia todo.
 *
 * Instalação: ver LEIA-ME.md nesta pasta.
 */

// ===== Configuração =====
const CONFIG = {
  CALENDARIO: 'primary',          // 'primary' = calendário principal da conta que publica o script
  FUSO: 'Europe/Lisbon',
  // Horário em que se podem marcar consultas (0 = domingo ... 6 = sábado). Dias sem entrada ficam fechados.
  HORARIO: {
    1: [['10:00', '18:00']],
    2: [['10:00', '18:00']],
    3: [['10:00', '18:00']],
    4: [['10:00', '18:00']],
    5: [['10:00', '18:00']],
  },
  DURACAO: { online: 30, presencial: 60 },   // minutos
  INTERVALO: 15,                // minutos livres antes e depois de cada consulta
  PASSO: 30,                    // de quanto em quanto tempo se oferecem horas (10:00, 10:30, ...)
  ANTECEDENCIA_HORAS: 24,       // não deixa marcar com menos de 24 h
  DIAS_A_MOSTRAR: 30,           // até quantos dias à frente
  COR_PEDIDO: CalendarApp.EventColor.YELLOW,
};

// ===== Pedidos do site =====
function doGet(e) {
  const p = (e && e.parameter) || {};
  const tipo = CONFIG.DURACAO[p.tipo] ? p.tipo : 'online';
  if (p.acao === 'dias') return json(diasLivres(tipo));
  if (p.acao === 'horas' || p.dia) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(p.dia || '')) return json({ erro: 'dia inválido' });
    return json(horasLivres(p.dia, tipo));
  }
  return json({ ok: true });
}

function doPost(e) {
  let d;
  try { d = JSON.parse(e.postData.contents); } catch (err) { return json({ ok: false, motivo: 'pedido inválido' }); }
  if (d.acao !== 'reservar') return json({ ok: false, motivo: 'ação desconhecida' });
  const tipo = CONFIG.DURACAO[d.tipo] ? d.tipo : null;
  if (!tipo || !/^\d{4}-\d{2}-\d{2}$/.test(d.dia || '') || !/^\d{2}:\d{2}$/.test(d.hora || '') || !limpo(d.nome) || !limpo(d.email)) {
    return json({ ok: false, motivo: 'dados em falta' });
  }
  // Evita duas marcações para a mesma hora quando dois pedidos chegam ao mesmo tempo
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    if (horasLivres(d.dia, tipo).indexOf(d.hora) === -1) return json({ ok: false, motivo: 'ocupado' });
    const inicio = dataHora(d.dia, d.hora);
    const fim = new Date(inicio.getTime() + CONFIG.DURACAO[tipo] * 60000);
    const titulo = `Pedido de marcação · ${tipo === 'online' ? 'Online' : 'Presencial'} · ${limpo(d.nome)}`;
    const descricao = [
      'Pedido feito no site. Confirmar com o cliente e mudar o título para "Consulta".',
      'Para recusar: apagar este evento (a hora volta a ficar livre no site).',
      '',
      `Nome: ${limpo(d.nome)}`,
      `Email: ${limpo(d.email)}`,
      `Telefone: ${limpo(d.telefone) || '—'}`,
      `Assunto: ${limpo(d.assunto) || '—'}`,
      `Mensagem: ${limpo(d.mensagem, 1500) || '—'}`,
      `Idioma do site: ${limpo(d.idioma) || 'PT'}`,
    ].join('\n');
    const evento = calendario().createEvent(titulo, inicio, fim, {
      description: descricao,
      location: tipo === 'online' ? 'Google Meet (enviar link ao confirmar)' : 'Rua Dr. Amorim, Ed. Casa do Povo, Loja G, 4535-211 Mozelos',
    });
    evento.setColor(CONFIG.COR_PEDIDO);
    evento.addPopupReminder(60);
    return json({ ok: true });
  } finally {
    lock.releaseLock();
  }
}

// ===== Disponibilidade =====
function diasLivres(tipo) {
  const dias = [];
  const hoje = Utilities.formatDate(new Date(), CONFIG.FUSO, 'yyyy-MM-dd');
  const base = dataHora(hoje, '12:00');
  // Um só pedido ao calendário para o período todo (mais rápido do que dia a dia)
  const todos = calendario().getEvents(dataHora(hoje, '00:00'), new Date(base.getTime() + (CONFIG.DIAS_A_MOSTRAR + 1) * 864e5));
  for (let i = 0; i <= CONFIG.DIAS_A_MOSTRAR; i++) {
    const dia = Utilities.formatDate(new Date(base.getTime() + i * 864e5), CONFIG.FUSO, 'yyyy-MM-dd');
    if (horarioDo(dia).length && horasLivres(dia, tipo, todos).length) dias.push(dia);
  }
  return dias;
}

function horasLivres(dia, tipo, todos) {
  const blocos = horarioDo(dia);
  if (!blocos.length) return [];
  const dur = CONFIG.DURACAO[tipo] * 60000, folga = CONFIG.INTERVALO * 60000, passo = CONFIG.PASSO * 60000;
  const inicioDia = dataHora(dia, '00:00'), fimDia = new Date(inicioDia.getTime() + 864e5);
  const eventos = (todos || calendario().getEvents(inicioDia, fimDia))
    .filter(ev => ev.getStartTime() < fimDia && ev.getEndTime() > inicioDia && ev.getMyStatus() !== CalendarApp.GuestStatus.NO);
  if (eventos.some(ev => ev.isAllDayEvent())) return [];
  const ocupado = eventos.map(ev => [ev.getStartTime().getTime() - folga, ev.getEndTime().getTime() + folga]);
  const minimo = Date.now() + CONFIG.ANTECEDENCIA_HORAS * 3600000;
  const horas = [];
  blocos.forEach(([de, ate]) => {
    const fimBloco = dataHora(dia, ate).getTime();
    for (let t = dataHora(dia, de).getTime(); t + dur <= fimBloco; t += passo) {
      if (t < minimo) continue;
      if (ocupado.some(([a, b]) => t < b && t + dur > a)) continue;
      horas.push(Utilities.formatDate(new Date(t), CONFIG.FUSO, 'HH:mm'));
    }
  });
  return horas;
}

// ===== Auxiliares =====
function calendario() {
  return CONFIG.CALENDARIO === 'primary' ? CalendarApp.getDefaultCalendar() : CalendarApp.getCalendarById(CONFIG.CALENDARIO);
}
function horarioDo(dia) {
  const semana = Number(Utilities.formatDate(dataHora(dia, '12:00'), CONFIG.FUSO, 'u')) % 7; // 'u': 1 = segunda ... 7 = domingo
  return CONFIG.HORARIO[semana] || [];
}
// Data/hora em hora de Portugal, seja qual for o fuso do servidor
function dataHora(dia, hora) {
  const provisoria = new Date(`${dia}T${hora}:00Z`);
  const desvio = Utilities.formatDate(provisoria, CONFIG.FUSO, 'XXX'); // ex.: +01:00
  return new Date(`${dia}T${hora}:00${desvio === 'Z' ? '+00:00' : desvio}`);
}
function limpo(v, max) { return String(v || '').replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, max || 200); }
function json(obj) { return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON); }

// Para testar no editor: Executar > testar (ver o resultado em "Registo de execução")
function testar() {
  const dias = diasLivres('online');
  Logger.log('Dias livres (online): ' + dias.join(', '));
  if (dias.length) Logger.log(`Horas livres em ${dias[0]}: ` + horasLivres(dias[0], 'online').join(', '));
}
