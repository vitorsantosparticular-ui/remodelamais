# Roteiro — BAIRRO.PT

Legenda: ✅ feito e testado · 🟡 parcial · ⬜ por fazer

## Fase 1 — Fundações
- ✅ Inspeção do repositório e decisão de arquitetura (monorepo em `bairro/`)
- ✅ Estrutura do projeto (shared / server / web), TypeScript em todo o lado
- ✅ Base de dados (PostgreSQL + Prisma, migração inicial, seed idempotente)
- ✅ Autenticação (registo, login, logout, sessões, limites de taxa, idade mínima)
- 🟡 Perfis de jogador (lema, visual, perfil público por API; falta janela de perfil completa)
- ✅ Interface inicial do jogo (viewport, barra de ferramentas, carteira, janelas)

## Fase 2 — A experiência clássica
- ✅ Sistema de avatar (pixel-art original, editor com pré-visualização, validação no servidor)
- ✅ Motor de quarto isométrico (chão, paredes, porta, mobília, profundidade, sentar)
- ✅ Movimento autoritativo por clique/toque
- ✅ Chat em tempo real (balões, histórico, filtro, anti-spam, retenção)
- ✅ Espaços públicos: Praça Central, Café Português
- ✅ Quartos privados: casa inicial, criar quartos, acesso aberto/só dono
- ⬜ Restantes espaços públicos: Discoteca, Centro Comercial, Parque, Praia, Salão de Jogos, Estação, Universidade, Bairro Residencial
- ⬜ Emotes e gestos (acenar, dançar), sussurrar, gritar
- ⬜ Mais peças de roupa: acessórios, chapéus, óculos, roupa sazonal e rara; guardar conjuntos
- ⬜ 8 direções de desenho completas (hoje 4 vistas + espelho)

## Cidade e bens (prioridade pedida: estilo "vida na cidade")
- ✅ Mapa da cidade como ecrã principal (9 bairros, presença em tempo real, dia/noite de Lisboa)
- ✅ Viagens com tempo real e custo (a pé, metro, táxi, veículo próprio)
- ✅ Biscates por bairro (turnos em tempo real, limite diário)
- ✅ Banco: carteira e conta, depósito, levantamento, transferências entre jogadores, extrato (livro-razão)
- ✅ Casas únicas: arrendar (débito direto semanal, despejo), comprar, vender, deixar; histórico de donos; quarto por casa
- ✅ Stand: comprar e vender veículos
- ⬜ Mais locais por bairro: supermercado, loja de roupa, ginásio, universidade, discoteca, praia (Costa/Cascais)
- ⬜ Arrendar a outros jogadores (senhorios), mercado de casas entre jogadores
- ⬜ Garagem e estacionamento, multas, seguro, revisão do carro

## Fase 3 — Economia
- 🟡 Livro-razão de transações: feito para o dinheiro (carteira/banco); falta diamantes e fichas sazonais
- ⬜ Inventário e **modo de construção** (arrastar, rodar, empilhar, guardar mobília)
- ⬜ Loja de mobília e de roupa (raridades, edições limitadas)
- ⬜ Trocas entre jogadores (confirmação dupla, atómicas), mercado, histórico de posse
- ⬜ Recompensas diárias, coleções

## Fase 4 — Mundo social
- ⬜ Amigos, pedidos, estado online, mensagens privadas (com regras para menores)
- ⬜ Seguir, bloquear, **denunciar**
- ⬜ Grupos, convites para quartos, notificações
- ⬜ Eventos e minijogos (quiz, labirinto, corrida, concursos de dança/moda/decoração, caça ao tesouro), classificações

## Fase 5 — Vida virtual
- ⬜ Profissões (empregado de café, DJ, músico, lojista, empreendedor, designer, agente imobiliário, organizador de eventos, construtor, artista)
- ⬜ Competências, experiência, reputação, estatuto
- ⬜ Propriedades (comprar/arrendar com moeda do jogo), negócios geridos por jogadores
- ⬜ Eventos sazonais: Santos Populares, Carnaval, Natal, Halloween, verão na praia, futebol (conteúdo original)

## Fase 6 — Jogo ao vivo
- ⬜ Painel de moderação e administração (papéis, suspensões, denúncias, anúncios, lojas, eventos), tudo auditado
- ⬜ Definições de privacidade e controlos parentais; exportação e eliminação de dados (RGPD)
- ⬜ Escala horizontal (adaptador Redis + afinidade de quarto), monitorização de erros, backups automáticos, CI/CD
- ⬜ Otimização móvel (edição de mobília simplificada), PWA
- ⬜ Monetização transparente e só cosmética (assinatura opcional); sem caixas de recompensa nem vantagens pagas
