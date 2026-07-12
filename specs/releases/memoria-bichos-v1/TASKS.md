# TASKS — Release: memoria-bichos-v1

> **Status:** Aprovado
> **Release ID:** memoria-bichos-v1
> **Spec:** `SPEC.md` Aprovado
> **Plan:** `PLAN.md` Aprovado
> **Criado:** 2026-07-12

## Tarefas

- [ ] **T-MB-01 — Scaffold standalone, primeira tela e catalogo**
  - **Owner:** game-developer
  - **Write set:** `memoria-bichos/index.html`, `memoria-bichos/styles.css`,
    `memoria-bichos/game.js`, `memoria-bichos/README.md`, `index.html`.
  - **Descricao:** criar a pasta `memoria-bichos/` com HTML/CSS/JS locais, sem CDN,
    sem build step e sem chamadas de rede; entregar a primeira tela visual do jogo com
    tres controles grandes para iniciar os niveis de 6, 12 e 20 cartas; adicionar no
    catalogo principal um link navegavel para `memoria-bichos/`; criar o README inicial
    com as secoes obrigatorias.
  - **Validacao:** abrir `/memoria-bichos/` em servidor estatico e confirmar, por
    revisao local, que nao ha tela de loading visivel, que os tres controles de nivel
    existem, que os arquivos carregados sao locais e que o catalogo principal contem o
    link para o novo jogo.
  - **Precondicoes:** nenhuma.

- [ ] **T-MB-02 — Smoke Playwright offline e navegacao inicial**
  - **Owner:** qa-engineer
  - **Write set:** `tests/memoria-bichos/memoria-bichos.spec.js`, `package.json`.
  - **Descricao:** adicionar a primeira fatia da suite Playwright do novo jogo cobrindo
    boot offline, ausencia de console errors, ausencia de requests externos, navegacao
    do catalogo principal para `/memoria-bichos/`, existencia da primeira tela e dos
    tres controles de nivel; alterar `package.json` somente se for necessario expor
    script dedicado sem dependencia nova.
  - **Validacao:** a fatia de smoke executa em servidor estatico, falha para qualquer
    request externo e prova que o catalogo navega para o jogo.
  - **Precondicoes:** T-MB-01.

- [ ] **T-MB-03 — Modelo deterministico, niveis e cartas observaveis**
  - **Owner:** game-developer
  - **Write set:** `memoria-bichos/game.js`, `memoria-bichos/styles.css`,
    `memoria-bichos/index.html`.
  - **Descricao:** implementar o estado local do jogo com niveis fixos de 6, 12 e 20
    cartas, embaralhamento normal local e modo deterministico de teste via query string
    ou hook local; garantir que cada carta inicie fechada em grade legivel e exponha
    dados observaveis como animal, estado e identificador estavel para Playwright
    validar comportamento sem depender de sorte.
  - **Validacao:** em servidor estatico, iniciar manualmente cada nivel e confirmar
    6/12/20 cartas, 3/6/10 pares, cartas inicialmente fechadas, animais grandes e dados
    DOM observaveis; revisar que nenhum arquivo do jogo importa ou referencia
    codigo/assets de outros jogos.
  - **Precondicoes:** T-MB-02.

- [ ] **T-MB-04 — Testes de niveis, determinismo e standalone**
  - **Owner:** qa-engineer
  - **Write set:** `tests/memoria-bichos/memoria-bichos.spec.js`.
  - **Descricao:** ampliar a suite Playwright para iniciar os tres niveis, contar
    cartas e pares, provar que todas comecam fechadas, iniciar uma partida com deck
    deterministico e checar que os arquivos do novo jogo nao importam nem referenciam
    codigo/assets de Tauan T-Rex, Aero Strike, Space War, Corrida ou Aero Fighters V2.
  - **Validacao:** os testes de niveis e determinismo passam sem sorte; o check de
    standalone falha se surgirem imports ou paths para outros jogos.
  - **Precondicoes:** T-MB-03.

- [ ] **T-MB-05 — Jogada de duas cartas, match e mismatch**
  - **Owner:** game-developer
  - **Write set:** `memoria-bichos/game.js`, `memoria-bichos/styles.css`.
  - **Descricao:** implementar interacao por clique/toque para revelar exatamente duas
    cartas por jogada, bloquear uma terceira abertura durante a avaliacao, incrementar
    tentativas uma vez por par revelado, manter matches abertos com estado persistente
    de encontrados e sinal visual temporario nao-audio, e fechar mismatches dentro da
    janela temporal definida.
  - **Validacao:** em partida deterministica, acionar cartas por ponteiro e confirmar
    que uma terceira carta nao abre durante o bloqueio; confirmar que match persiste
    aberto com indicador visual temporario e que mismatch fica visivel antes de fechar.
  - **Precondicoes:** T-MB-04.

- [ ] **T-MB-06 — Testes de ponteiro, bloqueio, match e mismatch**
  - **Owner:** qa-engineer
  - **Write set:** `tests/memoria-bichos/memoria-bichos.spec.js`.
  - **Descricao:** ampliar a suite Playwright para cobrir eventos de ponteiro,
    bloqueio de terceira carta durante avaliacao, incremento de tentativas por par
    revelado, persistencia de match, estado visual persistente de carta encontrada,
    sinal visual nao-audio detectavel por pelo menos 600 ms e janela de mismatch com
    cartas visiveis por pelo menos 650 ms e fechadas novamente ate 1200 ms.
  - **Validacao:** os testes medem as janelas temporais do SPEC e provam que a terceira
    interacao durante o bloqueio nao corrompe o estado do tabuleiro.
  - **Precondicoes:** T-MB-05.

- [ ] **T-MB-07 — Vitoria, estrelas e acoes finais**
  - **Owner:** game-developer
  - **Write set:** `memoria-bichos/game.js`, `memoria-bichos/styles.css`,
    `memoria-bichos/index.html`.
  - **Descricao:** encerrar a partida somente quando todos os pares do nivel forem
    encontrados; calcular estrelas pela formula fixa do SPEC; exibir tela final com
    acoes claras para jogar novamente e trocar de nivel.
  - **Validacao:** concluir partidas deterministicamente no nivel de 6 cartas com 3, 5
    e 6 ou mais tentativas e confirmar localmente 3, 2 e 1 estrela; confirmar que os
    botoes finais reiniciam o nivel e retornam para a selecao.
  - **Precondicoes:** T-MB-06.

- [ ] **T-MB-08 — Testes de vitoria, estrelas e acoes finais**
  - **Owner:** qa-engineer
  - **Write set:** `tests/memoria-bichos/memoria-bichos.spec.js`.
  - **Descricao:** ampliar a suite Playwright para concluir partidas deterministicas,
    validar estado final, validar botoes de repetir e trocar de nivel, e cobrir as tres
    faixas obrigatorias de estrelas no nivel pequeno: 3 tentativas = 3 estrelas, 5
    tentativas = 2 estrelas, 6 ou mais tentativas = 1 estrela.
  - **Validacao:** os testes concluem a partida pequena sem depender de sorte e provam
    as tres faixas de estrelas definidas em R-11/AC-08.
  - **Precondicoes:** T-MB-07.

- [ ] **T-MB-09 — README e UX final do jogo**
  - **Owner:** game-developer
  - **Write set:** `memoria-bichos/README.md`, `memoria-bichos/styles.css`,
    `memoria-bichos/index.html`.
  - **Descricao:** finalizar o README com como rodar localmente, objetivo, niveis e
    controles por clique/toque; ajustar responsividade e legibilidade das grades de 6,
    12 e 20 cartas em desktop e mobile sem ampliar o escopo de gameplay.
  - **Validacao:** README existe e cobre as quatro secoes obrigatorias; as grades de 6,
    12 e 20 cartas permanecem legiveis em viewports desktop e mobile; controles e acoes
    principais continuam descobertos visualmente, sem leitura obrigatoria.
  - **Precondicoes:** T-MB-08.

- [ ] **T-MB-10 — Checks finais Playwright, README e regressao minima**
  - **Owner:** qa-engineer
  - **Write set:** `tests/memoria-bichos/memoria-bichos.spec.js`, `package.json`.
  - **Descricao:** adicionar ou ajustar checks finais de README, UX/layout e regressao
    minima do catalogo sem tocar em codigo do jogo; alterar `package.json` somente se
    for necessario expor script de teste dedicado sem dependencia nova.
  - **Validacao:** a suite do novo jogo passa completa; README e validado quanto a como
    rodar, objetivo, niveis e controles; as grades de 6, 12 e 20 cartas sao verificadas
    em viewports desktop e mobile; a suite compartilhada aplicavel confirma que o link
    do catalogo nao quebrou jogos existentes.
  - **Precondicoes:** T-MB-09.

## Cobertura requisito -> tarefas

| Requisito | Tarefas |
|-----------|---------|
| R-01 | T-MB-01, T-MB-04 |
| R-02 | T-MB-01, T-MB-02, T-MB-09, T-MB-10 |
| R-03 | T-MB-01, T-MB-03, T-MB-04 |
| R-04 | T-MB-01, T-MB-02, T-MB-09, T-MB-10 |
| R-05 | T-MB-03, T-MB-04 |
| R-06 | T-MB-03, T-MB-04, T-MB-09, T-MB-10 |
| R-07 | T-MB-05, T-MB-06 |
| R-08 | T-MB-05, T-MB-06 |
| R-09 | T-MB-05, T-MB-06 |
| R-10 | T-MB-03, T-MB-04, T-MB-09, T-MB-10 |
| R-11 | T-MB-07, T-MB-08 |
| R-12 | T-MB-01, T-MB-09, T-MB-10 |

## Cobertura AC -> tarefas

| AC | Tarefas |
|----|---------|
| AC-01 | T-MB-01, T-MB-02, T-MB-09, T-MB-10 |
| AC-02 | T-MB-01, T-MB-02, T-MB-09, T-MB-10 |
| AC-03 | T-MB-01, T-MB-03, T-MB-04 |
| AC-04 | T-MB-05, T-MB-06 |
| AC-05 | T-MB-05, T-MB-06 |
| AC-06 | T-MB-05, T-MB-06 |
| AC-07 | T-MB-05, T-MB-06 |
| AC-08 | T-MB-07, T-MB-08 |
| AC-09 | T-MB-03, T-MB-04, T-MB-06, T-MB-08 |
| AC-10 | T-MB-01, T-MB-03, T-MB-04 |
| AC-11 | T-MB-01, T-MB-03, T-MB-04, T-MB-09, T-MB-10 |
| AC-12 | T-MB-01, T-MB-09, T-MB-10 |

## Ordem de execucao

T-MB-01 -> T-MB-02 -> T-MB-03 -> T-MB-04 -> T-MB-05 -> T-MB-06 -> T-MB-07 ->
T-MB-08 -> T-MB-09 -> T-MB-10.

As tarefas de QA sao intercaladas para realizar a sequencia incremental do PLAN: cada
fatia de comportamento ganha evidencia Playwright antes da proxima fatia de gameplay
depender dela. `tests/memoria-bichos/memoria-bichos.spec.js` aparece em multiplas
tarefas porque a mesma suite cresce por fatias; essa sobreposicao e sempre serializada
por precondicoes explicitas. `game.js`, `styles.css` e `index.html` tambem aparecem em
mais de uma tarefa apenas quando uma fatia posterior precisa evoluir a superficie
central do jogo, sempre com dependencia direta da fatia anterior. Tarefas que escrevem
codigo ou superficie do jogo em `memoria-bichos/` pertencem a `game-developer`, conforme
o `AGENTS.md` repo-scoped; fatias Playwright puras permanecem com `qa-engineer`.
