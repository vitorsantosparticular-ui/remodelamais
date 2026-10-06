// ===== Configuração =====
// Página de marcações do Google Calendar da Dra. Sónia (Agenda de marcações / Appointment schedule).
// Em Google Calendar: Criar > Agenda de marcações > Partilhar > Incorporar > copiar o link do iframe.
// Quando estiver preenchido, o site mostra o calendário real (com disponibilidade e pagamento do Google)
// em vez da marcação de demonstração.
const AGENDA_URL = '';
// Alternativa sem Google Calendar: link de pagamento (Stripe Payment Link, SumUp, easypay).
const PAGAMENTO_URL = '';
const HORAS = ['10:00', '11:00', '12:00', '14:30', '15:30', '16:30', '17:30'];
const DIAS_DISPONIVEIS = 12; // dias úteis mostrados na marcação

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
    <label class="opcao"><input type="radio" name="dia" value="${iso(d)}" ${iso(d) === escolhida ? 'checked' : ''}>
      <span><small>${fSem.format(d).replace('.', '')}</small><b>${d.getDate()}</b><small>${fMes.format(d).replace('.', '')}</small></span></label>`).join('');
}
caixaHoras.innerHTML = HORAS.map(h => `<label class="opcao"><input type="radio" name="hora" value="${h}"><span>${h}</span></label>`).join('');

function dataEscolhida() {
  const dia = reserva.querySelector('input[name="dia"]:checked')?.value;
  const hora = reserva.querySelector('input[name="hora"]:checked')?.value;
  if (!dia || !hora) return null;
  const [a, m, d] = dia.split('-').map(Number);
  const txt = new Intl.DateTimeFormat(LOCALE[idioma], { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(a, m - 1, d));
  return `${txt} · ${hora}`;
}
function atualizarResumo() {
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
    if (!reserva.querySelector('input[name="hora"]:checked')) { aviso(caixaHoras.querySelector('input'), t('res.erroHora')); return; }
  }
  if (etapa === 2) {
    const nome = reserva.querySelector('#r-nome');
    const email = reserva.querySelector('#r-email');
    if (!nome.value.trim()) { aviso(nome, t('res.erroNome')); return; }
    if (!email.value.trim() || !email.checkValidity()) { aviso(email, t('res.erroEmail')); return; }
  }
  irPara(etapa + 1);
});
reserva.addEventListener('change', atualizarResumo);
reserva.addEventListener('submit', e => {
  e.preventDefault();
  irPara(4);
  if (PAGAMENTO_URL) {
    const email = encodeURIComponent(reserva.querySelector('#r-email').value);
    setTimeout(() => { location.href = `${PAGAMENTO_URL}${PAGAMENTO_URL.includes('?') ? '&' : '?'}prefilled_email=${email}`; }, 1500);
  }
});

// Formulário de contacto
const formContacto = document.getElementById('form-contacto');
formContacto.addEventListener('submit', e => {
  e.preventDefault();
  formContacto.querySelector('.form__ok').hidden = false;
  formContacto.querySelector('button[type="submit"]').disabled = true;
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
    .from('.topo', { y: -30, opacity: 0, duration: 1 }, .3);

  gsap.utils.toArray('[data-reveal]').forEach(el => {
    gsap.from(el, { y: 50, opacity: 0, duration: 1.2, ease: 'expo.out', scrollTrigger: { trigger: el, start: 'top 90%' } });
  });
  gsap.fromTo('.hero__media img', { yPercent: 0 }, { yPercent: 8, ease: 'none', scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true } });
  gsap.utils.toArray('.cartao li').forEach(li => {
    gsap.from(li, { x: -16, opacity: 0, duration: .8, ease: 'power3.out', scrollTrigger: { trigger: li, start: 'top 95%' } });
  });
  gsap.utils.toArray('[data-parallax] img').forEach(img => {
    gsap.fromTo(img, { yPercent: -6 }, { yPercent: 6, ease: 'none', scrollTrigger: { trigger: img.parentElement, scrub: true } });
  });
  gsap.utils.toArray('.galeria img').forEach((img, i) => {
    const s = i % 2 ? 1 : -1;
    gsap.fromTo(img, { yPercent: -4 * s }, { yPercent: 4 * s, ease: 'none', scrollTrigger: { trigger: img.parentElement, scrub: true } });
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
