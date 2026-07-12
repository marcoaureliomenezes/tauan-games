# TASKS - Release: corrida-v0.1.0

> **Status:** Aprovado
> **Release ID:** corrida-v0.1.0
> **Spec:** `SPEC.md` Aprovado em 2026-07-12
> **Plan:** `PLAN.md` Aprovado em 2026-07-12
> **Criado:** 2026-07-12

## 1. Regras de execucao

- Implementacao so com este `TASKS.md` aprovado pelo operador.
- Use apenas os marcadores `[ ]`, `[-]` e `[x]`.
- Antes de editar producao, o implementador deve reservar exatamente uma tarefa aberta
  trocando `[ ]` por `[-]`.
- Nao modificar `tauan-trex/**`, `aero-fighters/**`, `space-war/**`,
  `aero-fighters-v2/**`, `vendor/**` ou `.github/**`.
- `package.json` so pode ser alterado se a tarefa declarar a necessidade concreta de
  script Corrida; por padrao, rodar Playwright com arquivo/config existente.

## 2. Tarefas

### [x] T-01 - Scaffold standalone, HUD inicial e contrato debug

**Owner:** game-developer

**Write set:**

- `corrida/index.html`
- `corrida/game.js`
- `corrida/README.md`

**Descricao:**

Criar a pasta `corrida/` com jogo web estatico em Phaser Arcade. O HTML deve carregar
`../vendor/phaser.min.js` e `game.js`, sem CDN, fetch, bundler, TypeScript ou assets
externos. A primeira cena deve inicializar canvas, pista placeholder jogavel, HUD,
carro do jogador, exatamente 3 adversarios e uma acao visivel de iniciar/reiniciar.

Expor `window.__corridaDebug` com, no minimo, `getState()`, `startRace()` e
`restartRace()`. O estado inicial deve cobrir `ready`, `status`, `lapCount`,
`totalLaps`, tempos, `player`, `opponents`, `track`, `result` e `hud`, conforme o
contrato do PLAN. `hud.controlsText` deve nomear acelerar, frear/re, estercar,
iniciar e reiniciar.

**Precondicoes:** nenhuma.

**Validacao:**

- Abrir `/corrida/index.html` em servidor estatico local sem erro de console.
- Confirmar que nao ha request de rede externa em runtime.
- Em ate 2 segundos, `window.__corridaDebug.getState().ready === true`.
- Confirmar `hud.visible === true`, `hud.lapText` nao-vazio,
  `hud.totalTimeText` nao-vazio e `opponents.length === 3`.
- Confirmar que nao resta loading visivel apos `ready === true`.

**Cobre:** R-01, R-02, R-03, R-04, R-08, AC-01, AC-02, AC-05, AC-08, AC-09.

### [-] T-02 - Pista fechada, checkpoints e limites legiveis

**Owner:** game-developer

**Write set:**

- `corrida/game.js`

**Descricao:**

Substituir o placeholder por uma pista 2D top-down autoral, fechada, desenhada por
dados locais e Phaser Graphics. Definir asfalto, fora de pista e limite com cores ou
tratamentos visualmente distintos; linha de largada/chegada; direcao valida da volta;
checkpoints em ordem; e waypoints de IA alinhados com a pista.

O contrato debug deve expor `track.palette`, `track.checkpointCount`,
`track.startLine` e `player.onTrack`. Sair da pista deve aplicar reducao previsivel de
velocidade, sem reset opaco de posicao.

**Precondicoes:** T-01.

**Validacao:**

- `track.checkpointCount >= 3`.
- `track.palette.asphalt`, `track.palette.offTrack` e `track.palette.boundary` sao
  valores distintos.
- Estado debug diferencia jogador dentro/fora da pista via `player.onTrack`.
- Cenario manual ou automatizado coloca o carro fora da pista e confirma velocidade
  reduzida sem reset de posicao.

**Cobre:** R-04, R-06, R-09, AC-02, AC-04, AC-10.

### [ ] T-03 - Controles e fisica arcade do jogador

**Owner:** game-developer

**Write set:**

- `corrida/game.js`

**Descricao:**

Implementar aceleracao, freio/re e estercamento esquerda/direita por teclado. A fisica
deve ser arcade e previsivel: aceleracao em poucos frames, arrasto, limite de
velocidade, re/freio verificavel, curva legivel e penalidade suave fora da pista. O
jogo real deve ser jogavel sem comandos debug.

**Precondicoes:** T-01, T-02.

**Validacao:**

- Com keypress real, segurar acelerar aumenta velocidade e desloca o carro em reta.
- Acelerar + esquerda/direita altera `player.angle`.
- Frear/re reduz velocidade ou produz movimento reverso verificavel.
- Controles essenciais nao exigem combinacoes complexas ou menu.

**Cobre:** R-05, R-09, AC-03, AC-09, AC-10.

### [ ] T-04 - Voltas, checkpoints validos e cronometro

**Owner:** game-developer

**Write set:**

- `corrida/game.js`

**Descricao:**

Implementar estado de corrida, contador de voltas, cronometro total, tempo da volta
atual e ultima volta. Uma volta so conta quando o jogador passa pelos checkpoints na
ordem correta e cruza a largada/chegada no sentido valido. Cruzar a linha sem
checkpoints, cortar a pista inteira ou cruzar no sentido errado nao incrementa volta.

Completar os comandos debug de aceleracao de teste:
`teleportPlayerToCheckpoint(index)` e `completePlayerLapForTest()`.

**Precondicoes:** T-02, T-03.

**Validacao:**

- `completePlayerLapForTest()` incrementa `lapCount` uma vez por volta valida.
- Cruzar a largada sem checkpoints nao incrementa `lapCount`.
- Cenario de sentido errado nao incrementa `lapCount` nem avanca checkpoint.
- `totalTimeMs` e `currentLapTimeMs` avancam durante corrida.
- `hud.totalTimeText` e `hud.currentLapTimeText` refletem os tempos.

**Cobre:** R-06, R-07, AC-04, AC-05.

### [ ] T-05 - Tres adversarios por IA de waypoints

**Owner:** game-developer

**Write set:**

- `corrida/game.js`

**Descricao:**

Implementar exatamente 3 adversarios controlados por IA simples, seguindo waypoints da
pista. Cada adversario deve avancar waypoints, completar voltas e evitar travamento
permanente em curvas, limites ou empilhamento durante corrida curta. O estado debug
deve manter, para cada adversario, `id`, `lapCount`, `waypointIndex` e `stuckMs`.

**Precondicoes:** T-02.

**Validacao:**

- `opponents.length === 3`.
- Cada adversario avanca `waypointIndex` ao longo do tempo.
- Em modo de teste, os 3 adversarios completam pelo menos uma volta.
- Nenhum adversario ultrapassa o limite definido de `stuckMs` durante corrida curta.

**Cobre:** R-08, AC-02, AC-06.

### [ ] T-06 - Fim de corrida, ranking e restart

**Owner:** game-developer

**Write set:**

- `corrida/game.js`

**Descricao:**

Concluir a corrida quando o jogador atingir `totalLaps`, congelar/parar o cronometro
final, calcular ranking com jogador e 3 adversarios, exibir resultado claro e manter
acao obvia de restart. Implementar `forceFinishForTest()` para acelerar o cenario de
fim nos testes sem substituir a jogabilidade real.

**Precondicoes:** T-04, T-05.

**Validacao:**

- Ao completar `totalLaps`, `status === "finished"`.
- `result.ranking` contem 4 participantes com `position` e `totalTimeMs`.
- `result.playerPosition` e `result.totalTimeMs` existem e sao coerentes.
- `hud.resultVisible === true` no fim.
- O tempo final para de avancar no resultado.
- `restartRace()` retorna a `ready` ou `running` com contadores reiniciados.

**Cobre:** R-07, R-08, R-10, AC-05, AC-07.

### [ ] T-07 - Suite Playwright Corrida e higiene de isolamento

**Owner:** qa-engineer

**Write set:**

- `tests/corrida/**`
- `tests/playwright.config.js` apenas se a configuracao existente exigir registro
  explicito da nova suite
- `package.json` apenas se for necessario criar script de teste Corrida

**Descricao:**

Adicionar a suite Playwright de Corrida cobrindo boot offline, primeira tela, contrato
debug, controles por keypress real, pista/checkpoints, cronometro, IA, fim/restart,
README e isolamento. Os comandos debug podem acelerar cenarios, mas os controles
essenciais devem ser provados com keypress real. A suite deve falhar em erro de
console, request externa ou import indevido de outro jogo.

**Precondicoes:** T-01, T-02, T-03, T-04, T-05, T-06.

**Validacao:**

- Rodar a suite Corrida com Playwright usando cache/artefatos fora do repo ou
  configuracao ja existente.
- AC-01 a AC-11 possuem pelo menos uma assercao automatizada ou checklist explicito
  quando a verificacao exige revisao visual/UX.
- Teste de imports/paths confirma que `corrida/` nao importa `tauan-trex/`,
  `aero-fighters/`, `space-war/` ou `aero-fighters-v2/`.
- Teste de README confirma secoes de como rodar localmente, controles e objetivo.

**Cobre:** AC-01, AC-02, AC-03, AC-04, AC-05, AC-06, AC-07, AC-08, AC-09, AC-10, AC-11.

### [ ] T-08 - README final e checklist de jogabilidade Tauan

**Owner:** game-developer

**Write set:**

- `corrida/README.md`
- `specs/releases/corrida-v0.1.0/TASKS.md` apenas para anotar evidencia de validacao
  se o workflow exigir antes da review

**Descricao:**

Finalizar o README do jogo com como rodar localmente, controles e objetivo da corrida.
Registrar, no handoff de implementacao, o checklist de UX do PLAN: primeira tela sem
loading persistente, controles visiveis, sem combinacoes ocultas, corrida curta
terminavel e restart obvio.

**Precondicoes:** T-01, T-06, T-07.

**Validacao:**

- `corrida/README.md` contem secoes de como rodar, controles e objetivo.
- Handoff de implementacao registra checklist de UX Tauan antes da review humana.
- Suite Corrida permanece verde apos ajuste do README.

**Cobre:** R-11, AC-09, AC-11.

## 3. Ordem e paralelismo

1. T-01.
2. T-02 depois de T-01.
3. T-03 depois de T-01 e T-02.
4. T-04 depois de T-02 e T-03.
5. T-05 depois de T-02; pode rodar em paralelo com T-03/T-04 se o mesmo implementador
   coordenar `corrida/game.js`.
6. T-06 depois de T-04 e T-05.
7. T-07 depois de T-01 a T-06.
8. T-08 depois de T-01, T-06 e T-07.

Como T-02 a T-06 compartilham `corrida/game.js`, duas sessoes nao devem editar essas
tarefas em paralelo sem combinacao explicita do operador.

## 4. Cobertura SPEC

| Requisito | Tarefas |
|-----------|---------|
| R-01 Jogo standalone | T-01, T-07 |
| R-02 Runtime estatico | T-01, T-07 |
| R-03 Engine Phaser Arcade | T-01 |
| R-04 Primeira tela jogavel | T-01, T-02, T-05 |
| R-05 Controles simples | T-03, T-08 |
| R-06 Pista autoral fechada | T-02, T-04 |
| R-07 Voltas e cronometro | T-04, T-06 |
| R-08 Tres adversarios | T-01, T-05, T-06 |
| R-09 Colisao e limites legiveis | T-02, T-03 |
| R-10 Fim e resultado | T-06 |
| R-11 README do jogo | T-01, T-08 |

| Acceptance Criterion | Tarefas |
|----------------------|---------|
| AC-01 boot offline | T-01, T-07 |
| AC-02 primeira tela | T-01, T-02, T-05, T-07 |
| AC-03 controles | T-03, T-07 |
| AC-04 pista e voltas | T-02, T-04, T-07 |
| AC-05 cronometro | T-01, T-04, T-06, T-07 |
| AC-06 IA | T-05, T-07 |
| AC-07 fim de corrida | T-06, T-07 |
| AC-08 standalone | T-01, T-07 |
| AC-09 qualidade Tauan | T-01, T-03, T-07, T-08 |
| AC-10 limites da pista | T-02, T-03, T-07 |
| AC-11 README | T-08, T-07 |

## 5. Criterio de aprovacao do TASKS

Este `TASKS.md` esta pronto para review quando:

- todas as workstreams W-01 a W-07 do PLAN aparecem em tarefas implementaveis;
- cada tarefa tem owner, write set, descricao, validacao e precondicoes;
- nenhum write set autoriza outros jogos, `vendor/**` ou `.github/**`;
- AC-01 a AC-11 estao cobertos pela matriz acima;
- todas as tarefas permanecem abertas (`[ ]`) ate a implementacao ser autorizada.
