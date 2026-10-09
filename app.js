// ===== Configuração =====
// Página de marcações do Google Calendar da Dra. Sónia (Agenda de marcações / Appointment schedule).
// Em Google Calendar: Criar > Agenda de marcações > Partilhar > Incorporar > copiar o link do iframe.
// Quando estiver preenchido, o site mostra o calendário real (com disponibilidade e pagamento do Google)
// em vez da marcação de demonstração.
const AGENDA_URL = '';
// Alternativa sem Google Calendar: link de pagamento (Stripe Payment Link, SumUp, easypay).
const PAGAMENTO_URL = '';
// Consultas: duração e preço (sem IVA). Horário do escritório: segunda a sexta, 10h–18h; 15 min entre consultas.
const CONSULTAS = {
  online: { min: 30, preco: 35, tipo: 'Consulta online por videochamada (30 min, 35 € + IVA)' },
  presencial: { min: 60, preco: 70, tipo: 'Consulta presencial no escritório (60 min, 70 € + IVA)' },
};
const ABERTURA = 10 * 60, FECHO = 18 * 60, INTERVALO = 15, IVA = 0.23;
function horasPara(tipo) {
  const dur = CONSULTAS[tipo].min, lista = [];
  for (let m = ABERTURA; m + dur <= FECHO; m += dur + INTERVALO) lista.push(`${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`);
  return lista;
}
const tipoAtual = () => document.querySelector('input[name="Modalidade"]:checked')?.value || 'online';
const euros = v => new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(v);
const DIAS_DISPONIVEIS = 15; // dias úteis mostrados na marcação
// Disponibilidade real (opcional): endereço que recebe ?dia=AAAA-MM-DD e devolve as horas livres em JSON,
// ex.: ["10:00","14:30"]. Pode ser um Google Apps Script ligado ao Google Calendar da Dra.
// Vazio = usa a lista HORAS acima.
const DISPONIBILIDADE_URL = '';

// ===== Idiomas =====
const IDIOMAS = ['pt', 'en', 'fr', 'de', 'it'];
const LOCALE = { pt: 'pt-PT', en: 'en-GB', fr: 'fr-FR', de: 'de-DE', it: 'it-IT' };
const T = window.TRADUCOES || {};
const original = {};
document.querySelectorAll('[data-i18n]').forEach(el => { original[el.dataset.i18n] = el.innerHTML; });
let idioma = 'pt';

const t = chave => (T[idioma] && T[idioma][chave]) || (T.pt && T.pt[chave]) || original[chave] || '';

function aplicarIdioma(lang) {
  idioma = IDIOMAS.includes(lang) ? lang : 'pt';
  document.documentElement.lang = idioma === 'pt' ? 'pt-PT' : idioma;
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const k = el.dataset.i18n;
    el.innerHTML = (idioma !== 'pt' && T[idioma] && T[idioma][k]) || original[k];
  });
  document.querySelector('.idiomas__atual').textContent = idioma.toUpperCase();
  document.querySelectorAll('[data-lang]').forEach(b => b.setAttribute('aria-current', b.dataset.lang === idioma));
  try { localStorage.setItem('idioma', idioma); } catch (e) {}
  montarFaixa();
  document.querySelectorAll('.cartao').forEach(c => { if (c.querySelector('.cartao__mais')) textoMais(c); });
  montarDatas();
  atualizarResumo();
}

const seletor = document.querySelector('.idiomas');
const seletorBtn = seletor.querySelector('.idiomas__btn');
seletorBtn.addEventListener('click', e => {
  e.stopPropagation();
  const aberto = seletor.classList.toggle('aberto');
  seletorBtn.setAttribute('aria-expanded', aberto);
});
document.addEventListener('click', () => { seletor.classList.remove('aberto'); seletorBtn.setAttribute('aria-expanded', false); });
document.querySelectorAll('[data-lang]').forEach(b => b.addEventListener('click', () => aplicarIdioma(b.dataset.lang)));

// Faixa contínua: duplica o conteúdo para o movimento não ter cortes
const trilho = document.querySelector('[data-faixa]');
function montarFaixa() {
  trilho.querySelectorAll('[data-clone]').forEach(n => n.remove());
  [...trilho.children].forEach(n => { const c = n.cloneNode(true); c.setAttribute('data-clone', ''); c.removeAttribute('data-i18n'); trilho.appendChild(c); });
}

// ===== Listas de serviços abreviadas =====
function textoMais(cartao) {
  const total = cartao.querySelectorAll('li').length;
  const aberto = cartao.classList.contains('aberto');
  cartao.querySelector('.cartao__mais-txt').textContent = aberto ? t('areas.menos') : `${t('areas.mais')} (${total})`;
}
document.querySelectorAll('.cartao').forEach(cartao => {
  const btn = cartao.querySelector('.cartao__mais');
  if (!btn) return;
  btn.addEventListener('click', () => {
    const aberto = cartao.classList.toggle('aberto');
    btn.setAttribute('aria-expanded', aberto);
    textoMais(cartao);
    if (!aberto && cartao.getBoundingClientRect().top < 0) cartao.scrollIntoView({ block: 'start' });
    if (window.ScrollTrigger) ScrollTrigger.refresh();
  });
});

// ===== Menu, topo e progresso =====
const menuBtn = document.querySelector('.menu-btn');
const nav = document.getElementById('nav');
const fecharMenu = () => { document.body.classList.remove('menu-aberto'); menuBtn.setAttribute('aria-expanded', false); };
menuBtn.addEventListener('click', () => menuBtn.setAttribute('aria-expanded', document.body.classList.toggle('menu-aberto')));
nav.querySelectorAll('a').forEach(a => a.addEventListener('click', fecharMenu));

const topo = document.getElementById('topo');
const barra = document.querySelector('.progresso');
const aoScroll = () => {
  topo.classList.toggle('solido', scrollY > 40);
  const max = document.documentElement.scrollHeight - innerHeight;
  barra.style.transform = `scaleX(${max > 0 ? scrollY / max : 0})`;
};
addEventListener('scroll', aoScroll, { passive: true });
aoScroll();

document.querySelectorAll('.faq details').forEach(d => d.addEventListener('toggle', () => {
  if (d.open) document.querySelectorAll('.faq details').forEach(o => { if (o !== d) o.open = false; });
}));
document.getElementById('ano').textContent = new Date().getFullYear();
document.querySelectorAll('[data-anos]').forEach(el => { el.textContent = (new Date().getFullYear() - 2005) + '+'; });

// ===== Marcação da consulta online =====
const reserva = document.getElementById('reserva');
if (AGENDA_URL) {
  const agenda = document.getElementById('agenda');
  agenda.innerHTML = `<iframe src="${AGENDA_URL}" title="Agenda" loading="lazy"></iframe>`;
  agenda.hidden = false;
  reserva.hidden = true;
}
const etapas = [...reserva.querySelectorAll('.etapa')];
const marcas = [...reserva.querySelectorAll('.reserva__passos span')];
const caixaDatas = document.getElementById('datas');
const caixaHoras = document.getElementById('horas');
let etapa = 1;

function diasUteis(n) {
  const dias = [];
  const d = new Date(); d.setHours(12, 0, 0, 0);
  while (dias.length < n) {
    d.setDate(d.getDate() + 1);
    if (d.getDay() !== 0 && d.getDay() !== 6) dias.push(new Date(d));
  }
  return dias;
}
const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

function montarDatas() {
  const escolhida = reserva.querySelector('input[name="dia"]:checked')?.value;
  const loc = LOCALE[idioma];
  const fSem = new Intl.DateTimeFormat(loc, { weekday: 'short' });
  const fMes = new Intl.DateTimeFormat(loc, { month: 'short' });
  caixaDatas.innerHTML = diasUteis(DIAS_DISPONIVEIS).map(d => `
    <label class="opcao" title="${new Intl.DateTimeFormat(loc, { weekday: 'long', day: 'numeric', month: 'long' }).format(d)}"><input type="radio" name="dia" value="${iso(d)}" ${iso(d) === escolhida ? 'checked' : ''}>
      <span><small>${fSem.format(d).replace('.', '').slice(0, 3)}</small><b>${d.getDate()}</b><small>${fMes.format(d).replace('.', '')}</small></span></label>`).join('');
}
// Horas: só aparecem depois de escolher o dia (a caixa abre com uma animação)
const painelHoras = document.getElementById('painel-horas');
const painelContinuar = document.getElementById('painel-continuar');
const estadoHoras = document.getElementById('horas-estado');
let pedidoHoras = 0;
async function obterHorarios(dia) {
  if (!DISPONIBILIDADE_URL) { await new Promise(r => setTimeout(r, 450)); return horasPara(tipoAtual()); }
  const r = await fetch(`${DISPONIBILIDADE_URL}${DISPONIBILIDADE_URL.includes('?') ? '&' : '?'}dia=${dia}&tipo=${tipoAtual()}`);
  if (!r.ok) throw new Error(r.status);
  return r.json();
}
async function mostrarHoras(dia) {
  const n = ++pedidoHoras;
  document.querySelector('.dias__dica').classList.add('oculta');
  painelHoras.classList.add('aberto');
  painelContinuar.classList.remove('aberto');
  caixaHoras.innerHTML = '';
  estadoHoras.hidden = false;
  estadoHoras.innerHTML = `<span class="gira" aria-hidden="true"></span>${t('res.aVerificar')}`;
  let horas = [];
  try { horas = await obterHorarios(dia); } catch (e) { horas = null; }
  if (n !== pedidoHoras) return;
  if (!horas) { estadoHoras.textContent = t('res.erroHoras'); return; }
  if (!horas.length) { estadoHoras.textContent = t('res.semVagas'); return; }
  estadoHoras.hidden = true;
  caixaHoras.innerHTML = horas.map((h, i) => `<label class="opcao" style="animation-delay:${i * 40}ms"><input type="radio" name="hora" value="${h}"><span>${h}</span></label>`).join('');
}
caixaDatas.addEventListener('change', e => { if (e.target.name === 'dia') mostrarHoras(e.target.value); });
document.querySelectorAll('input[name="Modalidade"]').forEach(r => r.addEventListener('change', () => {
  reserva.elements['Tipo de pedido'].value = CONSULTAS[tipoAtual()].tipo;
  const dia = reserva.querySelector('input[name="dia"]:checked')?.value;
  if (dia) mostrarHoras(dia);
  atualizarResumo();
}));
caixaHoras.addEventListener('change', e => { if (e.target.name === 'hora') painelContinuar.classList.add('aberto'); });
document.querySelectorAll('[data-dias]').forEach(b => b.addEventListener('click', () => {
  caixaDatas.scrollBy({ left: Math.sign(+b.dataset.dias) * caixaDatas.clientWidth, behavior: 'smooth' });
}));

function dataEscolhida() {
  const dia = reserva.querySelector('input[name="dia"]:checked')?.value;
  const hora = reserva.querySelector('input[name="hora"]:checked')?.value;
  if (!dia || !hora) return null;
  const [a, m, d] = dia.split('-').map(Number);
  const txt = new Intl.DateTimeFormat(LOCALE[idioma], { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(a, m - 1, d));
  return `${txt} · ${hora}`;
}
function atualizarResumo() {
  const c = CONSULTAS[tipoAtual()];
  document.getElementById('resumo-tipo').textContent = t(tipoAtual() === 'online' ? 'res.online' : 'res.presencial');
  document.getElementById('resumo-total').textContent = `${euros(c.preco)} + IVA (${euros(c.preco * (1 + IVA))})`;
  document.getElementById('resumo-data').textContent = dataEscolhida() || '—';
  document.getElementById('resumo-nome').textContent = reserva.querySelector('#r-nome').value || '—';
}

function irPara(n) {
  etapa = n;
  etapas.forEach(e => { e.hidden = Number(e.dataset.etapa) !== n; });
  marcas.forEach((m, i) => m.classList.toggle('feito', i < n));
  atualizarResumo();
  const atual = etapas[n - 1];
  if (window.gsap && !calmo) gsap.from(atual, { opacity: 0, x: 24, duration: .6, ease: 'expo.out' });
}

function aviso(el, msg) {
  el.setCustomValidity(msg); el.reportValidity();
  el.addEventListener('input', () => el.setCustomValidity(''), { once: true });
}

reserva.addEventListener('click', e => {
  if (e.target.closest('[data-anterior]')) irPara(etapa - 1);
  if (!e.target.closest('[data-seguinte]')) return;
  if (etapa === 1) {
    if (!reserva.querySelector('input[name="dia"]:checked')) { aviso(caixaDatas.querySelector('input'), t('res.erroDia')); return; }
    if (!reserva.querySelector('input[name="hora"]:checked')) { const h = caixaHoras.querySelector('input'); if (h) aviso(h, t('res.erroHora')); return; }
  }
  if (etapa === 2) {
    const nome = reserva.querySelector('#r-nome');
    const email = reserva.querySelector('#r-email');
    const consent = reserva.querySelector('#r-consent');
    if (!nome.value.trim()) { aviso(nome, t('res.erroNome')); return; }
    if (!email.value.trim() || !email.checkValidity()) { aviso(email, t('res.erroEmail')); return; }
    if (!consent.checked) { aviso(consent, t('res.erroConsent')); return; }
  }
  irPara(etapa + 1);
});
reserva.addEventListener('change', atualizarResumo);
// Data e hora do envio, na hora de Portugal
const agoraLisboa = () => new Intl.DateTimeFormat('pt-PT', { timeZone: 'Europe/Lisbon', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date()) + ' (hora de Portugal)';

// Envio para o Netlify Forms (os pedidos chegam por email, configurado no painel do Netlify)
async function enviarFormulario(form, extra = {}) {
  const dados = new FormData(form);
  dados.delete('dia'); dados.delete('hora');
  dados.set('Pedido enviado em', agoraLisboa());
  Object.entries(extra).forEach(([k, v]) => dados.set(k, v));
  const r = await fetch('/', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(dados).toString() });
  if (!r.ok) throw new Error('Envio falhou: ' + r.status);
}
const medir = (evento) => { try { window.medirConversao && window.medirConversao(evento); } catch (e) {} };

reserva.addEventListener('submit', async e => {
  e.preventDefault();
  const botao = reserva.querySelector('button[type="submit"]');
  const erro = reserva.querySelector('[data-etapa="3"] .form__erro');
  const dia = reserva.querySelector('input[name="dia"]:checked')?.value;
  const hora = reserva.querySelector('input[name="hora"]:checked')?.value;
  const [ano, mes, d] = (dia || '').split('-').map(Number);
  const dataPT = dia ? new Intl.DateTimeFormat('pt-PT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(ano, mes - 1, d)) + ' às ' + hora : '';
  botao.disabled = true; erro.hidden = true;
  try {
    await enviarFormulario(reserva, { 'Data e hora pedida': dataPT, 'Idioma do site': idioma.toUpperCase() });
    irPara(4);
    medir('marcacao');
    const tipoTxt = t(tipoAtual() === 'online' ? 'res.online' : 'res.presencial');
    const msg = `${t('nina.msg')} ${tipoTxt} · ${dataEscolhida() || ''} · ${reserva.querySelector('#r-nome').value}`;
    document.getElementById('nina-link').href = 'https://wa.me/351964822700?text=' + encodeURIComponent(msg);
    if (PAGAMENTO_URL) {
      const email = encodeURIComponent(reserva.querySelector('#r-email').value);
      setTimeout(() => { location.href = `${PAGAMENTO_URL}${PAGAMENTO_URL.includes('?') ? '&' : '?'}prefilled_email=${email}`; }, 1500);
    }
  } catch (err) {
    erro.hidden = false;
  } finally {
    botao.disabled = false;
  }
});

// Formulário de contacto
const formContacto = document.getElementById('form-contacto');
formContacto.addEventListener('submit', async e => {
  e.preventDefault();
  const consent = formContacto.querySelector('#f-consent');
  if (!consent.checked) { aviso(consent, t('res.erroConsent')); return; }
  const botao = formContacto.querySelector('button[type="submit"]');
  const ok = formContacto.querySelector('.form__ok'), erro = formContacto.querySelector('.form__erro');
  botao.disabled = true; ok.hidden = true; erro.hidden = true;
  try {
    await enviarFormulario(formContacto, { 'Idioma do site': idioma.toUpperCase() });
    ok.hidden = false;
    formContacto.reset();
    medir('contacto');
  } catch (err) {
    erro.hidden = false;
    botao.disabled = false;
  }
});

// ===== Animações =====
const calmo = matchMedia('(prefers-reduced-motion: reduce)').matches;
if (window.gsap && window.ScrollTrigger && !calmo) {
  gsap.registerPlugin(ScrollTrigger);
  gsap.timeline({ delay: 1.05, defaults: { ease: 'expo.out' } })
    .from('.hero h1 .linha > span', { yPercent: 110, duration: 1.4, stagger: .12 })
    .from('.hero .eyebrow, .hero .lead, .hero__acoes, .hero__selos', { y: 24, opacity: 0, duration: 1.2, stagger: .1 }, '<.2')
    .from('.hero__media', { clipPath: 'inset(0 0 0 100%)', duration: 1.8, ease: 'expo.inOut' }, 0)
    .from('.hero__media img', { scale: 1.25, duration: 2.4 }, 0)
    .from('.selo', { scale: 0, rotate: -90, duration: 1.4, ease: 'back.out(1.6)' }, .8)
    .from('.topo__inner', { y: -30, opacity: 0, duration: 1, clearProps: 'transform,opacity' }, .3);

  gsap.utils.toArray('[data-reveal]').forEach(el => {
    gsap.from(el, { y: 50, opacity: 0, duration: 1.2, ease: 'expo.out', scrollTrigger: { trigger: el, start: 'top 90%' } });
  });
  gsap.fromTo('.hero__media img', { yPercent: 0 }, { yPercent: 8, ease: 'none', scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true } });
  gsap.utils.toArray('[data-parallax] img').forEach(img => {
    // Começa encostada ao topo (não corta a cabeça) e sobe ligeiramente com o scroll
    gsap.fromTo(img, { yPercent: 0 }, { yPercent: -6, ease: 'none', scrollTrigger: { trigger: img.parentElement, scrub: true } });
  });
  gsap.utils.toArray('.galeria img').forEach((img, i) => {
    const s = i % 2 ? 1 : -1;
    gsap.fromTo(img, { yPercent: -4 * s }, { yPercent: 4 * s, ease: 'none', scrollTrigger: { trigger: img.parentElement, scrub: true } });
  });
  // Galeria do escritório: desliza na horizontal enquanto se faz scroll (só em ecrãs largos)
  ScrollTrigger.matchMedia({
    '(min-width: 961px)': () => {
      const trilho = document.querySelector('.galeria__trilho');
      const janela = document.querySelector('.galeria__janela');
      const distancia = () => Math.max(0, trilho.scrollWidth - janela.clientWidth);
      const mov = gsap.to(trilho, { x: () => -distancia(), ease: 'none',
        scrollTrigger: { trigger: '.escritorio', pin: '.escritorio__pin', start: 'top top', end: () => '+=' + distancia() * 1.2, scrub: 1, invalidateOnRefresh: true } });
      gsap.utils.toArray('.g img').forEach(img => {
        gsap.fromTo(img, { xPercent: 6 }, { xPercent: -6, ease: 'none',
          scrollTrigger: { trigger: img.parentElement, containerAnimation: mov, start: 'left right', end: 'right left', scrub: true } });
      });
    }
  });
  gsap.from('.passos__linha span', { scaleX: 0, ease: 'none', scrollTrigger: { trigger: '.passos', start: 'top 75%', end: 'bottom 60%', scrub: true } });
}

if (!calmo && matchMedia('(hover: hover)').matches) {
  document.querySelectorAll('.magnetico').forEach(b => {
    b.addEventListener('mousemove', e => {
      const r = b.getBoundingClientRect();
      b.style.transform = `translate(${(e.clientX - r.left - r.width / 2) * .25}px, ${(e.clientY - r.top - r.height / 2) * .35}px)`;
    });
    b.addEventListener('mouseleave', () => { b.style.transform = ''; });
  });
}

// ===== Arranque =====
let inicial = 'pt';
try { inicial = localStorage.getItem('idioma') || ''; } catch (e) {}
if (!inicial) {
  const nav2 = (navigator.language || 'pt').slice(0, 2).toLowerCase();
  inicial = IDIOMAS.includes(nav2) ? nav2 : 'pt';
}
aplicarIdioma(inicial);
