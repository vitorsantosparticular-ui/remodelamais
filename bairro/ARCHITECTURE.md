# Arquitetura — BAIRRO.PT

## Princípios
1. **O servidor é a autoridade.** O cliente envia intenções ("quero ir para 5,9", "quero dizer X"); o servidor valida,
   decide e difunde o resultado. Saldos, posse de itens, permissões e posições nunca são aceites do cliente.
2. **Código partilhado** (`@bairro/shared`) para tudo o que tem de ser igual nos dois lados: protocolo, geometria,
   A*, catálogo, validação de avatar, filtro de chat.
3. **Módulos separados** no servidor por domínio, para crescer sem se tornar um monólito emaranhado.
4. **Segurança por omissão** — o público inclui menores.

## Stack e decisões
| Camada | Escolha | Porquê |
|---|---|---|
| Cliente | React 18 + Vite + TypeScript | O jogo é uma SPA com uma única vista; o Next.js (sugerido) não traz vantagem sem SSR/SEO e complica o tempo real. Vite dá arranque instantâneo. Uma página de marketing em Next.js pode existir à parte. |
| Desenho | PixiJS v8 (WebGL/WebGPU) | Rápido, maduro, bom para pixel-art (filtragem `nearest`). |
| Estado UI | Zustand | Simples; o motor Pixi mantém o seu próprio estado e não re-renderiza React a cada passo. |
| Estilo | Tailwind v4 + classes próprias | Utilitários para layout; janelas/botões nostálgicos em CSS próprio. |
| Servidor | Node 22 + Fastify 5 (arquitetura modular) | NestJS foi ponderado; a estrutura modular por domínios dá a mesma separação com menos cerimónia. Migrar para NestJS mais tarde é possível módulo a módulo. |
| Tempo real | Socket.IO 4 | Reconexão, salas, fallback para polling. Preparado para `@socket.io/redis-adapter`. |
| BD | PostgreSQL 16 + Prisma 6 | Relacional (trocas atómicas, histórico de posse) com migrações versionadas. |
| Cache/rápido | Redis 7 (ioredis) | Limites de taxa e presença; opcional em desenvolvimento (fallback em memória). |
| Palavras-passe | scrypt (node:crypto) | Sem dependências nativas; parâmetros guardados no hash para poderem subir. |

## Módulos do servidor (`apps/server/src`)
```
config.ts, logger.ts (pino, JSON), db.ts (Prisma)
infra/kv.ts                limites de taxa e presença (Redis ou memória)
modules/auth/              registo, login, logout, sessões (token aleatório; só o SHA-256 vai para a BD)
modules/players/           /api/me, visual e lema, perfil público
modules/rooms/             serviço (BD), RoomInstance (simulação), RoomManager (quartos ativos), rotas
modules/chat/              guardar mensagens, histórico recente, retenção (30 dias)
modules/admin/audit.ts     registo de auditoria
realtime/gateway.ts        Socket.IO: autenticação no handshake, entrar em quartos, mover, chat
app.ts / index.ts          montagem e arranque (também serve apps/web/dist)
```
Módulos previstos (fases seguintes): `inventory`, `economy` (livro-razão), `trading`, `friends`, `groups`,
`notifications`, `jobs`, `events`, `moderation`, `admin`.

## Motor de quarto
- **Grelha** `width × height`; cada mosaico tem `walk`, `sit`, `z` calculados a partir da mobília (pegada com rotação).
- **Movimento:** o cliente pede um destino → o servidor calcula A* (8 direções, sem cortar esquinas, outros
  jogadores bloqueiam) → a cada `WALK_TICK_MS` (450 ms) avança um mosaico e difunde `room:users_moved`.
  Se alguém se meter no caminho, recalcula. Ao chegar a uma cadeira/banco/sofá, senta-se virado conforme a rotação.
- **Cliente:** interpola entre mosaicos durante o tick; ordenação de profundidade por `zIndex = (x+y)·100 + camada`
  (mobília 40, avatar 50, costas de cadeira viradas para o ecrã 60).
- **Quartos em memória** só enquanto têm gente; carregados da BD ao entrar.
- **Persistência:** posição gravada quando o jogador para e quando sai; ao voltar reaparece onde estava.

## Cidade e economia
- **Tempo preguiçoso (lazy):** viagens e turnos guardam `arrivesAt`/`workUntil`. `settle(userId)` resolve o que já passou
  (chegada, pagamento do turno, rendas) sempre que o jogador age; sem timers por jogador.
- **Dinheiro:** só através de `moveMoney(tx, …)` — `UPDATE … WHERE saldo >= montante` (sem negativos em corrida) +
  `LedgerEntry` com saldo resultante. Transferências e compras correm numa transação.
- **Casas únicas:** a aquisição é `updateMany WHERE ownerId IS NULL AND tenantId IS NULL` — se dois pedirem ao mesmo tempo,
  só um ganha. Cada casa tem histórico (`PropertyHistory`) e um quarto próprio cujo dono acompanha o ocupante.
- **Lugar importa:** o servidor exige estar no bairro certo para cada ação (banco na Baixa, imobiliária no Chiado, stand
  nas Avenidas, biscates no seu bairro, quartos com `bairro`).

## Protocolo Socket.IO (`packages/shared/src/protocol.ts`)
Cliente → servidor: `room:join {roomId}` (com ack), `room:leave`, `room:move {x,y}`, `chat:send {text}`. As ações da cidade são REST (`/api/city/*`, `/api/bank/*`, `/api/properties/*`, `/api/vehicles/*`, `/api/jobs/*`).
Servidor → cliente: `room:snapshot`, `room:user_joined`, `room:user_left`, `room:users_moved`, `chat:message`,
`user:figure`, `error:game`, `notice`, `room:left`, `city:presence`, `city:changed`.

## Modelo de dados (Prisma)
`User` (saldos `credits`/`diamonds`, figura JSON validada, papel, estado, casa, última posição) ·
`Session` · `Room` (dono, público/privado, tamanho, chão, paredes, porta, acesso) ·
`FurnitureDefinition` (catálogo: dimensões, empilhar/sentar/pisar, raridade, preço) ·
`FurnitureItem` (**cada peça tem ID próprio** — base para raros, trocas e histórico) ·
`ChatMessage` (com `flagged` para revisão) · `AuditLog`.

## Segurança e proteção de menores (já implementado)
- Idade mínima 13 (RGPD art. 8.º / Lei 58/2019); só se guarda o **ano** de nascimento; `isMinor` derivado.
- Cookie de sessão `httpOnly`, `SameSite=Lax`, `Secure` em produção; verificação de `Origin` em pedidos que alteram estado.
- Limites de taxa: registo (5/h por IP), login (8/10 min por IP+nome), entrar em quartos, mover, chat (5/6 s).
- Filtro de chat: palavrões e **remoção de contactos** (telefones/emails) para evitar contacto fora do jogo.
- Um socket ativo por conta; contas suspensas são recusadas no handshake e ao entrar em quartos.
- Retenção: mensagens de quarto apagadas ao fim de 30 dias (tarefa horária).
- Auditoria de registo, login e criação de quartos.

## Escala (para mais tarde)
Hoje: 1 processo. Para várias instâncias: `@socket.io/redis-adapter` para difusão, e **afinidade de quarto**
(cada quarto ativo pertence a um nó, registado no Redis) para manter a simulação autoritativa num só sítio.
Presença em Redis por nó com TTL. Sessões já estão na BD (sem estado no processo).
