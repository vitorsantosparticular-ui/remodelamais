# Site — Sónia Alexandra Santos, Advogada RL

Site estático (HTML + CSS + JS), sem build. Para ver, basta abrir `index.html` no browser.

- `index.html` — conteúdo em português (marcado com `data-i18n`)
- `i18n.js` — traduções EN, FR, DE, IT
- `app.js` — idiomas, marcação da consulta online, animações (GSAP via CDN)
- `styles.css` — design (paleta e tipografia da marca)
- `privacidade.html` — Política de Privacidade (RGPD)

## Por preencher
- **Contactos** (secção Contacto em `index.html`): telefone, email, morada, horário e número de WhatsApp (`wa.me/351…`, 3 sítios).
- **Agenda (Google Calendar)**: em `app.js`, colocar em `AGENDA_URL` o link da *Agenda de marcações* do Google Calendar
  da Dra. Sónia (Criar → Agenda de marcações → Partilhar → Incorporar). O site passa a mostrar a disponibilidade real
  e as marcações entram diretamente no calendário dela. O pagamento dos 30 € pode ser exigido na própria agenda (Stripe).
  Sem Google Calendar: usar `PAGAMENTO_URL` (Stripe Payment Link, SumUp, easypay) com a marcação de demonstração.
- **Equipa**: fotos `img/equipa-sonia.jpg`, `img/equipa-2.jpg`, `img/equipa-3.jpg` e nomes/funções em `index.html`.

- **Política de Privacidade** (`privacidade.html`): preencher NIPC, morada, email, prestador de pagamentos, alojamento e data.
- **Rodapé**: n.º de cédula profissional.

## Domínios
- Principal: **soniasantosadvogada.pt**
- **drasoniasantos.pt** e as versões `www` redirecionam para o principal (ver `netlify.toml`).

## Publicar
GitHub Pages (Settings → Pages) ou Netlify (arrastar a pasta).
