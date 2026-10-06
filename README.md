# Site — Sónia Alexandra Santos, Advogada RL

Site estático (HTML + CSS + JS), sem build. Para ver, basta abrir `index.html` no browser.

- `index.html` — conteúdo em português (marcado com `data-i18n`)
- `i18n.js` — traduções EN, FR, DE, IT
- `app.js` — idiomas, marcação da consulta online, animações (GSAP via CDN)
- `styles.css` — design (paleta e tipografia da marca)

## Por preencher
- **Contactos** (secção Contacto em `index.html`): telefone, email, morada, horário e número de WhatsApp (`wa.me/351…`, 3 sítios).
- **Pagamento da consulta online (30 €)**: em `app.js`, colocar em `PAGAMENTO_URL` o link de pagamento
  (ex.: Stripe Payment Link, SumUp, easypay com MB WAY). Horas e nº de dias disponíveis também se mudam aí.
- **Equipa**: fotos `img/equipa-sonia.jpg`, `img/equipa-2.jpg`, `img/equipa-3.jpg` e nomes/funções em `index.html`.

## Publicar
GitHub Pages (Settings → Pages) ou Netlify (arrastar a pasta).
