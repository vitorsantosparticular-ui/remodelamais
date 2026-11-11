# BAIRRO.PT

Mundo social virtual português, multijogador e persistente, ao estilo dos jogos de "vida na cidade":
começas a viver em casa dos pais em Campo de Ourique com 150 € no bolso, fazes biscates pelos bairros de Lisboa,
guardas dinheiro no banco, arrendas ou compras casa, compras carro — e encontras outros jogadores nas praças e cafés
(quartos isométricos em pixel-art com chat em tempo real).
Inspirado na era de ouro dos hotéis virtuais (2008–2012) e nas simulações de vida, com identidade e arte **originais**.

> Estado: **Fase 1 + Fase 2 (parcial) + Cidade e bens.** Ver [ROADMAP.md](ROADMAP.md) e [DEVLOG.md](DEVLOG.md).

## O que já funciona
**Cidade (ecrã principal)**
- Mapa de Lisboa com 9 bairros, presença em tempo real (quantos jogadores há em cada bairro) e dia/noite pela hora real de Lisboa.
- Viajar a pé, de metro, de táxi ou no teu veículo — demora tempo real e custa dinheiro da carteira.
- Biscates diferentes em cada bairro (turnos em tempo real, máximo 8 por dia).
- Banco do Bairro (depósitos ao balcão, na Baixa), Multibanco em todos os bairros (levantar, transferir para outros jogadores), extrato.
- Imobiliária no Chiado: 15 casas **únicas** para arrendar (renda semanal por débito direto; sem saldo = despejo) ou comprar; cada casa tem o seu quarto.
- Stand nas Avenidas Novas: 5 veículos; ter veículo torna as viagens mais rápidas.

**Quartos**
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
