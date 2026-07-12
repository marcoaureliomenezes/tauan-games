# SPEC — Release: corrida-v0.1.0

> **Status:** Aprovado
> **Release ID:** corrida-v0.1.0
> **Consumes:** corrida-primeiro-jogavel-v1
> **Criado:** 2026-07-12
> **Origem:** backlog `corrida-primeiro-jogavel-v1` + handoff
> `2026-07-12T041911Z-product-engineer-corrida-release-scope.handoff.json`.

## 1. Problema

O tauan-games precisa de um novo jogo leve, independente e imediatamente jogavel para
Tauan: um primeiro jogavel de corrida 2D top-down, feito para abrir direto no browser,
explicar-se pelos proprios controles e terminar uma corrida curta com resultado claro.

Hoje o catalogo tem jogos de corrida zero. Reaproveitar mundo, estradas, carros ou
logica do Aero Strike violaria a independencia dos jogos e tornaria um primeiro
jogavel simples dependente de um jogo 3D complexo. Esta release deve criar Corrida
como jogo novo, standalone, no degrau Phaser/2D web.

## 2. Escopo escolhido

### Backlog consumido

| Item | Decisao | Cobertura |
|------|---------|-----------|
| `corrida-primeiro-jogavel-v1` | Picked e consumido integralmente | Requisitos R-01 a R-11 |

### Bugs escolhidos

Nenhum bug foi escolhido para esta release. Bugs abertos de Aero Strike/Inhauma foram
deferidos por pertencerem a outro jogo; bugs ja marcados como corrigidos foram
excluidos como historico, nao como trabalho vivo.

### Auditorias escolhidas

Nenhum achado de auditoria foi escolhido para esta release.

## 3. Requisitos

- **R-01 — Jogo standalone:** criar Corrida como jogo web em pasta propria `corrida/`,
  sem dependencia runtime de `tauan-trex/`, `aero-fighters/`, `space-war/` ou codigo
  de mundo/veiculos desses jogos. A unica dependencia compartilhada permitida e
  `vendor/` para biblioteca local e `tests/` para validacao.
- **R-02 — Runtime estatico:** o jogo deve rodar por `index.html` + JavaScript
  estatico, sem build step, sem servidor proprio e sem chamadas de rede em runtime.
  O mesmo artefato deve funcionar em servidor estatico local e em GitHub Pages.
- **R-03 — Engine Phaser Arcade:** o gameplay deve usar Phaser/Arcade como engine 2D
  da release. Nao introduzir quinta engine, bundler, TypeScript ou stack nativa.
- **R-04 — Primeira tela jogavel:** ao abrir a pagina, o jogador deve ver a pista,
  o carro do jogador, 3 adversarios, HUD basico e uma forma imediata de iniciar ou
  reiniciar a corrida, sem configuracao previa.
- **R-05 — Controles simples:** teclado deve cobrir acelerar, frear/re e esterçar
  para esquerda/direita. Os controles precisam ser simples o bastante para uma crianca
  descobrir em segundos; nao exigir combinacoes, troca de marcha ou menus.
- **R-06 — Pista autoral fechada:** entregar uma pista 2D top-down original, fechada,
  com linha de largada/chegada, direcao de volta e checkpoints suficientes para
  impedir contagem falsa por cruzar a linha no sentido errado ou cortar a pista inteira.
- **R-07 — Voltas e cronometro:** a corrida deve ter contador de voltas, cronometro
  total e tempo de volta atual ou ultima volta no HUD. A conclusao da corrida ocorre
  quando a quantidade definida de voltas e completada.
- **R-08 — Tres adversarios:** existir exatamente 3 adversarios controlados por IA
  simples no primeiro jogavel. Eles devem seguir a pista, completar voltas e evitar
  travar permanentemente em curvas, paredes ou uns nos outros durante uma corrida curta.
- **R-09 — Colisao e limites legiveis:** pista, grama/fora de pista e limites devem
  ser visualmente distinguiveis. Sair da pista deve ter consequencia leve e previsivel
  (por exemplo, reducao de velocidade), sem punicao opaca nem reset frequente.
- **R-10 — Fim e resultado:** ao terminar a corrida, o jogo deve mostrar resultado
  claro com posicao/ranking final, tempo total e acao obvia para correr novamente.
- **R-11 — README do jogo:** `corrida/README.md` deve explicar como rodar localmente,
  controles e objetivo da corrida, seguindo a regra de documentacao minima do projeto.

## 4. Acceptance Criteria

- **AC-01 (boot offline):** Corrida abre em servidor estatico local sem erro de
  console, sem request de rede externa e sem build step. Evidencia: smoke Playwright
  do jogo.
- **AC-02 (primeira tela):** em ate 2 segundos apos o boot em ambiente de teste, a
  cena contem pista, carro do jogador, HUD e 3 adversarios instanciados. Evidencia:
  teste Playwright lendo estado debug minimo ou DOM/canvas contract definido no PLAN.
- **AC-03 (controles):** acelerar, frear/re e esterçar esquerda/direita movem o carro
  de forma verificavel em teste automatizado ou probe de estado. O carro nao fica
  parado quando o jogador segura acelerar numa reta.
- **AC-04 (pista e voltas):** completar uma volta valida incrementa o contador; cruzar
  a linha sem passar pelos checkpoints nao incrementa. Evidencia: teste de estado ou
  teste de gameplay acelerado.
- **AC-05 (cronometro):** HUD mostra tempo total e informacao de volta; o tempo avanca
  durante a corrida e para ou congela no resultado final.
- **AC-06 (IA):** os 3 adversarios conseguem completar pelo menos uma volta em modo de
  teste sem ficarem presos permanentemente. Evidencia: Playwright aguarda progresso de
  volta/waypoint dos tres adversarios.
- **AC-07 (fim de corrida):** ao completar a quantidade definida de voltas, o jogo
  entra em estado final e exibe ranking/resultado com tempo total e opcao de restart.
- **AC-08 (standalone):** nenhum arquivo de `corrida/` importa modulo de outro jogo ou
  reusa assets/logica de Aero Strike, Space War ou Tauan T-Rex. Evidencia: revisao de
  imports/paths e smoke passando com somente dependencias permitidas.
- **AC-09 (qualidade Tauan):** nao ha tela de loading visivel, erro de console ou
  controle essencial escondido em combinacao complexa. Evidencia: smoke + revisao de
  UX pelo implementador/tester antes da review humana.
- **AC-10 (limites da pista):** pista, area fora de pista e limites sao visualmente
  distinguiveis (cores/texturas distintas verificaveis via contrato debug/canvas
  definido no PLAN), e sair da pista aplica a consequencia leve especificada em R-09
  (reducao de velocidade previsivel), sem reset opaco de posicao. Evidencia: teste de
  estado dirigindo o carro para fora da pista e assertando velocidade reduzida e
  retorno controlado.
- **AC-11 (README):** `corrida/README.md` existe e cobre como rodar localmente, os
  controles e o objetivo da corrida. Evidencia: check automatizado de existencia +
  presenca das tres secoes, e revisao de conteudo na review de codigo.

## 5. Nao-escopo

- Multiplayer, split-screen, online leaderboard ou persistencia de progresso.
- Editor de pistas, selecao de carros, upgrades, loja, garagem ou campanha.
- Fisica realista de simulador, marcha manual, dano mecanico ou pit stop.
- Reaproveitamento de estradas, terreno, carros, mapas, splines, texturas ou logica de
  Aero Strike.
- Alteracoes em `tauan-trex/`, `aero-fighters/`, `space-war/`, `aero-fighters-v2/` ou
  em `vendor/`, salvo se o PLAN aprovado declarar explicitamente uma necessidade de
  vendor ja existente.

## 6. Sanitizacao e exclusoes

| Item | Resultado | Motivo |
|------|-----------|--------|
| Bugs Aero Strike/Inhauma abertos | Deferidos | Validam outro jogo e nao pertencem ao primeiro jogavel Corrida. |
| Bugs ja marcados como corrigidos | Excluidos | Historico resolvido; nao sao escopo vivo. |
| Backlogs Space War ativos/deferidos | Deferidos | Outro jogo e outra linha de produto. |
| Backlogs Aero Strike ativos | Deferidos | Outro jogo; nao devem contaminar Corrida. |
| `agent-orchestration`, `backlog-future`, `candidates`, `ideas` | Excluidos | Superficies de planejamento/referencia, nao itens escolhidos. |

Nao ha links de subsuncao: nenhum bug escolhido foi coberto por backlog escolhido.

## 7. Conformidade

- **Constituicao:** respeita projetos independentes, simplicidade primeiro e README
  obrigatorio por jogo.
- **Arquitetura:** Corrida entra como jogo isolado de Degrau 1/Phaser em pasta propria;
  compartilha apenas `vendor/` e `tests/`, sem acoplamento horizontal.
- **Tech stack:** mantem `index.html` + JS estatico, sem build step, sem rede em
  runtime, com operacao compativel com GitHub Pages.
- **Quality bar:** exige boot sem erro, controles descobertos em segundos, smoke
  Playwright e operacao offline.

## 8. Traceability

| Origem | Requisitos | Acceptance Criteria |
|--------|------------|---------------------|
| `corrida-primeiro-jogavel-v1`: jogo standalone/publicavel | R-01, R-02, R-03, R-11 | AC-01, AC-08, AC-11 |
| `corrida-primeiro-jogavel-v1`: primeira tela jogavel | R-04, R-05 | AC-02, AC-03, AC-09 |
| `corrida-primeiro-jogavel-v1`: pista autoral com voltas | R-06, R-07, R-09 | AC-04, AC-05, AC-10 |
| `corrida-primeiro-jogavel-v1`: 3 adversarios IA | R-08 | AC-02, AC-06 |
| `corrida-primeiro-jogavel-v1`: fim/ranking | R-10 | AC-07 |
| Memory `architecture.md` | R-01, R-03 | AC-08 |
| Memory `tech-stack.md` | R-02, R-03 | AC-01 |
| Memory `overview.md` + `quality-bar.md` | R-04, R-05, R-11 | AC-01, AC-02, AC-09 |

## 9. Write set esperado para PLAN/TASKS

O PLAN deve detalhar e restringir o write set antes da implementacao. A expectativa de
produto para esta release e:

- `corrida/**`
- `tests/corrida/**` ou arquivo equivalente na suite Playwright compartilhada
- `package.json` apenas se necessario para script de teste
- `specs/releases/corrida-v0.1.0/**`

Arquivos de outros jogos ficam proibidos para esta release.
