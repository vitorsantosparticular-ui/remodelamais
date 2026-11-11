# Diário de desenvolvimento — BAIRRO.PT

## 2026-11-11 — Fase 1 + primeiro marco jogável

### Implementado
- Monorepo `bairro/` (npm workspaces): `packages/shared`, `apps/server`, `apps/web`.
- Servidor Fastify + Socket.IO + Prisma/PostgreSQL + Redis; módulos auth, players, rooms, chat, audit.
- Cliente React + PixiJS: entrada/registo com editor de avatar, viewport isométrico, barra de ferramentas,
  navegador de quartos, criação de quartos, editor de visual, histórico do chat, cartão de jogador, atalhos (Enter, N, Esc).
- Arte original desenhada por código: avatar em pixel-art (8 quadros), 13 peças de mobília, 6 chãos, 5 paredes.
- Seed: catálogo + Praça Central (16×16) + Café Português (10×9). Cada conta nova recebe uma casa mobilada (8×8).

### Testado
- `npm test` (servidor, BD e Redis reais) — **8/8**: registo/login/validações (nome duplicado, menor de 13, palavra-passe errada),
  socket sem sessão recusado, 2 jogadores no mesmo quarto (entrada, movimento visto pelo outro, destino bloqueado ignorado),
  chat em tempo real com filtro e remoção de contactos, anti-spam, sentar num banco, posição retomada ao voltar, quarto privado.
- Ponta-a-ponta no Chromium (`e2e/dois-jogadores.cjs`): duas contas criadas pela interface (desktop 1280×800 e telemóvel 390×844),
  ambas na Praça, clique para andar visto pelo outro jogador, chat com balões nos dois ecrãs, navegador → Café, botão Casa.
  Sem erros de JavaScript.
- `tsc` sem erros em shared, server e web; `vite build` OK.

### Não testado
- `docker compose` (Dockerfile e compose escritos mas não corridos neste ambiente).
- Várias instâncias do servidor (não suportado ainda; ver ARCHITECTURE.md › Escala).

### Problemas conhecidos
- `/api/me` devolve 401 antes de entrar (comportamento correto, mas aparece na consola do browser).
- Ordenação de profundidade de peças com mais de um mosaico pode falhar em casos raros (avatar ao lado de um balcão comprido).
- Avatares têm 4 vistas + espelho (frente/costas), não 8 desenhos distintos.
- O cliente expõe `window.__bairro` (vista e socket) para testes; não dá poderes extra porque o servidor valida tudo, mas deve sair em produção.

### Decisões
- Vite em vez de Next.js e Fastify modular em vez de NestJS (justificação em ARCHITECTURE.md).
- Movimento por ticks no servidor (450 ms por mosaico) com interpolação no cliente: simples, autoritativo e barato em rede.
- Só o ano de nascimento é guardado; idade mínima 13 anos.
- Chat filtra contactos (telefones/emails) para proteger menores.

## Estado das funcionalidades
| Funcionalidade | Estado |
|---|---|
| Registo / login / logout / sessões | ✅ funciona |
| Editor de avatar + guardar visual | ✅ funciona |
| Quartos públicos e privados, navegador, criar quarto | ✅ funciona |
| Movimento autoritativo, sentar | ✅ funciona |
| Chat em tempo real, histórico, filtro, anti-spam, retenção | ✅ funciona |
| Carteira (créditos/diamantes) | 🟡 só leitura (saldo inicial 500 créditos; sem transações ainda) |
| Perfil público | 🟡 API existe; janela de perfil simplificada (cartão ao clicar no avatar) |
| Modo de construção / inventário / loja / trocas | ⬜ fase 3 |
| Amigos, mensagens privadas, denúncias, bloqueios | ⬜ fase 4 |
| Trabalhos, propriedades, eventos | ⬜ fase 5 |
| Moderação e administração | ⬜ fase 6 (apenas auditoria e papéis na BD) |
