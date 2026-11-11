# BAIRRO.PT

Mundo social virtual português, multijogador e persistente: quartos isométricos em pixel-art,
avatares personalizáveis, chat em tempo real, e (nas próximas fases) mobília, economia, trabalhos e eventos.
Inspirado na era de ouro dos hotéis virtuais (2008–2012) e nas simulações de vida, com identidade e arte **originais**.

> Estado: **Fase 1 concluída + início da Fase 2** (primeiro marco jogável). Ver [ROADMAP.md](ROADMAP.md) e [DEVLOG.md](DEVLOG.md).

## O que já funciona
- Criar conta (com ano de nascimento: mínimo 13 anos) e entrar; sessão em cookie httpOnly.
- Editor de avatar com pré-visualização (corpo, pele, 5 penteados, cores, 3 tipos de camisola, calças, sapatos).
- Praça Central e Café Português (espaços públicos) e uma **casa própria** mobilada para cada jogador.
- Clicar/tocar para andar — o **servidor** calcula o caminho (A*, 8 direções) e avança passo a passo.
- Sentar em cadeiras, bancos e sofás.
- Vários jogadores no mesmo quarto em tempo real; chat com balões, histórico, filtro e anti-spam.
- Navegador de quartos (públicos, de jogadores, os meus) e criação de quartos (tamanho, chão, paredes, acesso).
- Posição, quartos, mobília e mensagens guardadas em PostgreSQL.

## Arrancar em desenvolvimento
Requisitos: Node 22.9+, PostgreSQL 16, Redis 7 (opcional — sem ele usa memória).

```bash
cd bairro
npm install
cp .env.example apps/server/.env      # ajustar DATABASE_URL / REDIS_URL
npm run db:migrate                     # cria as tabelas
npm run db:seed                        # catálogo de mobília + espaços públicos
npm run dev                            # servidor :3001 + cliente Vite :5173
```
Abrir http://localhost:5173, criar duas contas (ex.: uma janela normal e outra privada) e entrar na Praça Central.

### Produção (um só processo)
```bash
npm run build && npm start             # o servidor serve o cliente compilado em http://localhost:3001
```
Ou com Docker: `docker compose up --build` (PostgreSQL + Redis + app).

## Testes
```bash
npm test                               # integração no servidor: 2 contas, movimento, chat, permissões, persistência
node e2e/dois-jogadores.cjs /tmp       # ponta-a-ponta no browser (Playwright), com o servidor a correr
```

## Estrutura
```
bairro/
  packages/shared/   tipos do protocolo, geometria isométrica, A*, catálogo de mobília, avatar, filtro de chat
  apps/server/       Fastify + Socket.IO + Prisma (PostgreSQL) + Redis — autoridade sobre tudo o que importa
  apps/web/          React + PixiJS + Zustand + Tailwind — interface e motor de desenho
  e2e/               testes de ponta-a-ponta no browser
```
Detalhes em [ARCHITECTURE.md](ARCHITECTURE.md).

## Nota sobre este repositório
Esta pasta vive temporariamente dentro do repositório do site `remodelamais` e está excluída da publicação
do Netlify (`/bairro/*` devolve 404). Recomenda-se movê-la para um repositório próprio: basta copiar a pasta `bairro/`.
