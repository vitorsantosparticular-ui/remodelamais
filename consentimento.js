// Aviso de cookies (RGPD) e medição de conversões.
// Nada de medição é carregado antes de o visitante aceitar.
// Preencher os IDs quando as contas existirem; vazios = nada é carregado.
const MEDICAO = {
  GA4_ID: '',               // Google Analytics 4, ex.: 'G-XXXXXXXXXX'
  GOOGLE_ADS_ID: '',        // Google Ads, ex.: 'AW-123456789'
  GOOGLE_ADS_LABELS: {      // rótulos de conversão do Google Ads (opcional)
    marcacao: '',           // ex.: 'AbCdEfGhIjk'
    contacto: '',
    consulta: '',
    whatsapp: '',
  },
  META_PIXEL_ID: '',        // Meta (Facebook/Instagram), ex.: '123456789012345'
};

(function () {
  const CHAVE = 'consentimento-cookies';
  const VALIDADE_DIAS = 180;

  const TEXTOS = {
    pt: { t: 'Cookies e privacidade', d: 'Usamos cookies de medição para perceber como o site é usado e melhorar os nossos anúncios. Só são ativados se aceitar.', a: 'Aceitar', r: 'Recusar', s: 'Saber mais' },
    en: { t: 'Cookies and privacy', d: 'We use measurement cookies to understand how the site is used and to improve our ads. They are only enabled if you accept.', a: 'Accept', r: 'Decline', s: 'Learn more' },
    fr: { t: 'Cookies et confidentialité', d: 'Nous utilisons des cookies de mesure pour comprendre l’utilisation du site et améliorer nos annonces. Ils ne sont activés qu’avec votre accord.', a: 'Accepter', r: 'Refuser', s: 'En savoir plus' },
    de: { t: 'Cookies und Datenschutz', d: 'Wir verwenden Mess-Cookies, um die Nutzung der Website zu verstehen und unsere Anzeigen zu verbessern. Sie werden nur mit Ihrer Zustimmung aktiviert.', a: 'Akzeptieren', r: 'Ablehnen', s: 'Mehr erfahren' },
    it: { t: 'Cookie e privacy', d: 'Utilizziamo cookie di misurazione per capire come viene usato il sito e migliorare i nostri annunci. Vengono attivati solo con il suo consenso.', a: 'Accetta', r: 'Rifiuta', s: 'Maggiori informazioni' },
  };
  const lingua = () => (document.documentElement.lang || 'pt').slice(0, 2);
  const txt = () => TEXTOS[lingua()] || TEXTOS.pt;

  function ler() {
    try {
      const v = JSON.parse(localStorage.getItem(CHAVE) || 'null');
      if (v && Date.now() - v.data < VALIDADE_DIAS * 864e5) return v.escolha;
    } catch (e) {}
    return null;
  }
  function gravar(escolha) {
    try { localStorage.setItem(CHAVE, JSON.stringify({ escolha, data: Date.now() })); } catch (e) {}
  }

  // ---------- Medição (só depois de aceitar) ----------
  let carregado = false;
  function carregarScript(src) {
    const s = document.createElement('script'); s.async = true; s.src = src; document.head.appendChild(s);
  }
  function ativarMedicao() {
    if (carregado) return; carregado = true;
    const gId = MEDICAO.GA4_ID || MEDICAO.GOOGLE_ADS_ID;
    if (gId) {
      window.dataLayer = window.dataLayer || [];
      window.gtag = function () { dataLayer.push(arguments); };
      gtag('consent', 'default', { ad_storage: 'granted', analytics_storage: 'granted', ad_user_data: 'granted', ad_personalization: 'granted' });
      gtag('js', new Date());
      if (MEDICAO.GA4_ID) gtag('config', MEDICAO.GA4_ID, { anonymize_ip: true });
      if (MEDICAO.GOOGLE_ADS_ID) gtag('config', MEDICAO.GOOGLE_ADS_ID);
      carregarScript('https://www.googletagmanager.com/gtag/js?id=' + gId);
    }
    if (MEDICAO.META_PIXEL_ID) {
      !function (f, b, e, v, n, t, s) { if (f.fbq) return; n = f.fbq = function () { n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments); }; if (!f._fbq) f._fbq = n; n.push = n; n.loaded = !0; n.version = '2.0'; n.queue = []; t = b.createElement(e); t.async = !0; t.src = v; s = b.getElementsByTagName(e)[0]; s.parentNode.insertBefore(t, s); }(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');
      fbq('init', MEDICAO.META_PIXEL_ID);
      fbq('track', 'PageView');
    }
  }

  // Chamado pelos formulários e botões: 'marcacao', 'contacto', 'consulta', 'whatsapp', 'telefone'
  window.medirConversao = function (evento) {
    if (ler() !== 'aceite') return;
    const ga = { marcacao: 'generate_lead', contacto: 'generate_lead', consulta: 'generate_lead', whatsapp: 'contact', telefone: 'contact' }[evento] || evento;
    if (window.gtag) {
      gtag('event', ga, { event_category: 'conversao', event_label: evento });
      const label = MEDICAO.GOOGLE_ADS_LABELS[evento];
      if (MEDICAO.GOOGLE_ADS_ID && label) gtag('event', 'conversion', { send_to: MEDICAO.GOOGLE_ADS_ID + '/' + label });
    }
    if (window.fbq) fbq('track', { marcacao: 'Schedule', whatsapp: 'Contact', telefone: 'Contact' }[evento] || 'Lead');
  };

  // Cliques no WhatsApp e no telefone contam como contacto
  document.addEventListener('click', e => {
    const a = e.target.closest('a[href]'); if (!a) return;
    if (a.href.includes('wa.me/')) window.medirConversao('whatsapp');
    else if (a.href.startsWith('tel:')) window.medirConversao('telefone');
  });

  // ---------- Aviso ----------
  const css = `
  .cookies{position:fixed;z-index:200;left:16px;right:16px;bottom:calc(16px + env(safe-area-inset-bottom,0px));max-width:440px;margin-left:auto;
    background:#fffaf6;color:#5a4d43;border:1px solid #e1d0c1;border-radius:6px;padding:22px 22px 20px;box-shadow:0 30px 60px -25px rgba(47,37,30,.45);
    font:300 .9rem/1.55 "Montserrat",system-ui,sans-serif;transform:translateY(20px);opacity:0;transition:transform .5s cubic-bezier(.16,1,.3,1),opacity .5s}
  .cookies.on{transform:none;opacity:1}
  .cookies::before{content:"";position:absolute;left:0;right:0;top:0;height:3px;border-radius:6px 6px 0 0;background:linear-gradient(115deg,#9c7d55,#c9a874 30%,#ecd7a8 50%,#c4a575 70%,#9c7d55)}
  .cookies h2{margin:0 0 6px;font:400 1.15rem "Marcellus",Georgia,serif;color:#4f4035}
  .cookies p{margin:0 0 16px}
  .cookies a{color:#4f4035;text-decoration:underline;text-decoration-color:#b0915f;text-underline-offset:3px}
  .cookies__acoes{display:flex;gap:10px;flex-wrap:wrap}
  .cookies button{flex:1 1 120px;cursor:pointer;padding:12px 16px;border-radius:2px;font:600 .7rem "Montserrat",sans-serif;letter-spacing:.18em;text-transform:uppercase;border:1px solid #b0915f}
  .cookies .aceitar{background:linear-gradient(115deg,#7d6243,#a2804f 35%,#c4a370 50%,#a2804f 65%,#7d6243);color:#fff;border-color:transparent;text-shadow:0 1px 1px rgba(70,50,30,.3)}
  .cookies .recusar{background:transparent;color:#4f4035}
  .cookies button:focus-visible{outline:2px solid #b0915f;outline-offset:2px}
  @media (max-width:640px){.cookies{left:12px;right:12px;bottom:calc(12px + env(safe-area-inset-bottom,0px));padding:18px}}
  @media (prefers-reduced-motion:reduce){.cookies{transition:none}}`;
  let caixa;
  function render() {
    if (!caixa) return;
    const t = txt();
    caixa.innerHTML = `<h2 id="cookies-titulo">${t.t}</h2><p>${t.d} <a href="/privacidade.html#cookies">${t.s}</a></p>
      <div class="cookies__acoes"><button type="button" class="recusar">${t.r}</button><button type="button" class="aceitar">${t.a}</button></div>`;
    caixa.querySelector('.aceitar').onclick = () => { gravar('aceite'); fechar(); ativarMedicao(); };
    caixa.querySelector('.recusar').onclick = () => { gravar('recusado'); fechar(); };
  }
  function mostrar() {
    if (!document.getElementById('cookies-css')) {
      const st0 = document.createElement('style'); st0.id = 'cookies-css'; st0.textContent = css; document.head.appendChild(st0);
    }
    if (!caixa) {
      caixa = document.createElement('section');
      caixa.className = 'cookies'; caixa.setAttribute('role', 'dialog'); caixa.setAttribute('aria-labelledby', 'cookies-titulo');
      document.body.appendChild(caixa);
    }
    render();
    requestAnimationFrame(() => requestAnimationFrame(() => caixa.classList.add('on')));
  }
  function fechar() { const c = caixa; if (!c) return; caixa = null; c.classList.remove('on'); setTimeout(() => c.remove(), 500); }

  // Reabrir a partir do rodapé ("Definições de cookies")
  window.abrirCookies = function () { if (caixa) return; mostrar(); };
  document.addEventListener('click', e => { if (e.target.closest('[data-cookies]')) { e.preventDefault(); window.abrirCookies(); } });

  new MutationObserver(() => render()).observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });

  const inicio = () => {
    const escolha = ler();
    if (escolha === 'aceite') ativarMedicao();
    else if (escolha === null) setTimeout(mostrar, 1600);
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', inicio); else inicio();
})();
