# Ligar a marcação do site ao Google Calendar da Dra.

Depois de ligado, o site:
- só mostra os dias e as horas em que a Dra. está livre no calendário;
- grava cada pedido no calendário como evento amarelo "Pedido de marcação · …", com os dados do cliente. A hora fica ocupada e deixa de aparecer no site.

O email de cada pedido continua a chegar como hoje.

## Como funciona a disponibilidade

- **Horário:** segunda a sexta, 10h–18h. Muda-se em `HORARIO`, no início do script.
- **Eventos:** qualquer evento no calendário ocupa esse tempo, com 15 minutos de folga antes e depois.
- **Eventos de dia inteiro:** fecham o dia todo. Servem para férias, tribunal ou formação.
- **Antecedência:** não se pode marcar com menos de 24 horas. Muda-se em `ANTECEDENCIA_HORAS`.
- **Horas oferecidas:** de 30 em 30 minutos. As consultas online duram 30 minutos e as presenciais 60.

## Instalação (uma vez, cerca de 10 minutos)

Faça estes passos **com a conta Google cujo calendário a Dra. usa**, de preferência geral@soniasantosadvogada.pt.

1. Abrir https://script.google.com e clicar em **Novo projeto**.
2. Mudar o nome do projeto para **Agenda do site**.
3. Apagar o código que lá está e colar todo o conteúdo de `Codigo.gs`. Guardar com Ctrl+S.
4. Testar o script:
   1. Na barra de cima, escolher a função **testar** e clicar em **Executar**.
   2. Aceitar as autorizações. Em "A Google não validou esta app", clicar em **Avançadas** e depois em **Aceder a Agenda do site**. É normal, porque o script é da própria Dra.
   3. No registo de execução devem aparecer os dias e as horas livres.
5. Publicar o script:
   1. Clicar em **Implementar** e depois em **Nova implementação**.
   2. Clicar na roda dentada e escolher **Aplicação Web**, com estas opções:
      - **Executar como:** Eu (a conta da Dra.)
      - **Quem tem acesso:** Qualquer pessoa
   3. Clicar em **Implementar** e copiar o **URL da aplicação Web**, que termina em `/exec`.
6. Enviar esse URL ao programador. Ele cola-o em `app.js`, na linha `const DISPONIBILIDADE_URL = '';`, e publica o site.

"Qualquer pessoa" significa que o site consegue perguntar as horas livres. O script nunca mostra os títulos nem os detalhes dos eventos da Dra., só as horas livres.

## No dia a dia

| Situação | O que fazer no Google Calendar |
|---|---|
| Chega um pedido (evento amarelo) | Confirmar com o cliente. Mudar o título para "Consulta · Nome" e, se for online, juntar o Google Meet ao evento. |
| Recusar ou desmarcar | Apagar o evento. A hora volta a ficar livre no site. |
| Bloquear um dia | Criar um evento de dia inteiro, por exemplo "Férias". |
| Bloquear umas horas | Criar um evento normal nessas horas. |

## Alterar alguma coisa no script

Depois de editar o código, é preciso publicar de novo, senão o site continua a usar a versão antiga:

1. Clicar em **Implementar** e depois em **Gerir implementações**.
2. Clicar no lápis.
3. Em **Versão**, escolher **Nova versão** e clicar em **Implementar**.

O URL não muda.
