# PLAN — Release: corrida-v0.1.0

> **Status:** Aprovado
> **Release ID:** corrida-v0.1.0
> **Spec:** `SPEC.md` Aprovado em 2026-07-12
> **Criado:** 2026-07-12

## 1. Estrategia

Criar Corrida como um novo jogo web 2D isolado em `corrida/`, usando Phaser Arcade
vendor-local, JavaScript estatico e testes Playwright focados em comportamento
observavel. A implementacao deve ser pequena o bastante para um primeiro jogavel, mas
com contratos de estado suficientes para validar boot, controles, voltas, IA, pista,
resultado e README sem depender de inspecao visual fragil do canvas.

O plano nao reaproveita mundo, estradas, veiculos, mapas, splines, texturas ou logica de
outros jogos. A unica dependencia runtime compartilhada autorizada e a biblioteca
Phaser ja commitada em `vendor/phaser.min.js`.

## 2. Decisoes de arquitetura

- **D-01 — Pasta isolada:** todo codigo runtime de Corrida vive em `corrida/`.
  Nenhum modulo de `corrida/` pode importar caminhos de `tauan-trex/`,
  `aero-fighters/`, `space-war/` ou `aero-fighters-v2/`.
- **D-02 — Phaser Arcade simples:** usar `vendor/phaser.min.js` via `index.html`, sem
  bundler, TypeScript, assets remotos ou build step.
- **D-03 — Estado de teste minimo:** expor em runtime um contrato debug somente de
  leitura e comandos de teste deterministicos em `window.__corridaDebug`, sem depender
  de DOM scraping para regras de jogo.
- **D-04 — Pista por dados locais:** representar pista, checkpoints, linha de
  largada/chegada e waypoints de IA como dados autorais no proprio jogo. O shape pode
  ser desenhado por Phaser Graphics; assets externos nao sao necessarios.
- **D-05 — Fisica arcade previsivel:** carro do jogador usa aceleracao, freio/re,
  arrasto e esterçamento simples. Fora da pista aplica multiplicador de velocidade menor e
  nunca reseta posicao de forma opaca.
- **D-06 — IA por waypoints:** os 3 adversarios seguem waypoints da pista com ajuste
  simples de direcao e velocidade. O objetivo e completar corrida curta de forma
  robusta, nao simular pilotos realistas.
- **D-07 — Corrida curta:** usar uma quantidade pequena e fixa de voltas para o primeiro
  jogavel, suficiente para provar contador, cronometro, ranking e restart.

## 3. Contrato debug/teste

O implementador deve entregar um contrato estavel em `window.__corridaDebug` para os
testes. O contrato pode crescer se necessario, mas deve cobrir no minimo:

```js
{
  getState(): {
    ready: boolean,
    status: "ready" | "running" | "finished",
    lapCount: number,
    totalLaps: number,
    totalTimeMs: number,
    currentLapTimeMs: number,
    lastLapTimeMs: number | null,
    player: {
      x: number,
      y: number,
      speed: number,
      angle: number,
      onTrack: boolean,
      checkpointIndex: number
    },
    opponents: Array<{
      id: string,
      lapCount: number,
      waypointIndex: number,
      stuckMs: number
    }>,
    track: {
      palette: { asphalt: string, offTrack: string, boundary: string },
      checkpointCount: number,
      startLine: { x: number, y: number, width: number, height: number }
    },
    result: null | {
      ranking: Array<{ id: string, position: number, totalTimeMs: number }>,
      playerPosition: number,
      totalTimeMs: number
    },
    hud: {
      visible: boolean,
      lapText: string,
      totalTimeText: string,
      currentLapTimeText: string,
      resultVisible: boolean
    }
  },
  startRace(): void,
  restartRace(): void,
  teleportPlayerToCheckpoint(index: number): void,
  completePlayerLapForTest(): void,
  forceFinishForTest(): void
}
```

Comandos de teste devem existir apenas para acelerar cenarios Playwright. O jogo real
continua jogavel por teclado e nao deve exigir esses comandos.

## 4. Workstreams

### W-01 — Scaffold standalone e boot offline

Criar `corrida/index.html`, `corrida/game.js` e `corrida/README.md` inicial. O HTML
carrega Phaser a partir de `../vendor/phaser.min.js` e o JS local, sem CDN, sem fetch e
sem assets externos. A primeira cena deve inicializar canvas, pista, HUD, jogador,
3 adversarios e uma acao obvia de iniciar/reiniciar.

Validacao:

- Playwright abre `/corrida/index.html` em servidor estatico local.
- O teste falha em qualquer erro de console ou request externa.
- `window.__corridaDebug.getState().ready === true` em ate 2 segundos.
- HUD provavel via contrato debug: `hud.visible === true`, `hud.lapText` contem a
  volta atual/total e `hud.totalTimeText` nao-vazio ja na primeira tela (AC-02/AC-05).
- AC-09 observavel: apos `ready === true`, o teste asserta que nenhum texto/overlay de
  loading permanece visivel (contrato debug expõe `hud.visible` e ausencia de node de
  loading no DOM/estado), e que a primeira tela exibe instrucoes visiveis nomeando
  acelerar, frear/re, esterçar, iniciar e reiniciar (string de instrucoes exposta no
  contrato debug, ex. `hud.controlsText`, verificada pelo teste). O checklist de UX do
  implementador/tester registra a descoberta dos controles sem combinacoes ocultas
  antes da review humana.

### W-02 — Pista, limites e contrato visual

Implementar uma pista fechada top-down original com asfalto, fora de pista e limites
visualmente distintos. Definir linha de largada/chegada, direcao da volta e checkpoints
em ordem. O estado debug deve expor paleta, quantidade de checkpoints, linha de largada
e `player.onTrack`.

Validacao:

- Teste confirma `checkpointCount >= 3`.
- Teste confirma que as cores/labels de asfalto, fora de pista e limite sao distintas
  no contrato debug.
- Teste dirige ou teleporta o jogador para fora da pista e verifica reducao previsivel
  de velocidade sem reset opaco.

### W-03 — Controle e fisica do jogador

Implementar acelerar, frear/re e esterçar esquerda/direita por teclado. O carro deve
responder em poucos frames, mover em reta ao acelerar, virar de forma legivel e manter
controle suficiente para uma crianca descobrir sem combinacoes.

Validacao:

- Playwright segura acelerar e observa aumento de posicao/velocidade.
- Playwright combina acelerar + esquerda/direita e observa mudanca de angulo.
- Playwright testa frear/re como reducao de velocidade ou movimento reverso
  verificavel.

### W-04 — Voltas, checkpoints e cronometro

Implementar estado de corrida, contador de voltas, cronometro total, tempo de volta
atual e ultima volta. Uma volta so conta depois que o jogador passa pelos checkpoints
na ordem correta e cruza a largada/chegada no sentido valido.

Validacao:

- Teste usa comandos debug para completar uma volta valida e verifica incremento de
  `lapCount`.
- Teste tenta cruzar a linha sem checkpoints e verifica que `lapCount` nao incrementa.
- Cenario de sentido errado: apos progresso parcial de checkpoints (via
  `teleportPlayerToCheckpoint`), o teste dirige/teleporta o jogador para cruzar a
  linha de largada no sentido invalido e verifica que `lapCount` NAO incrementa e o
  progresso de checkpoint nao avanca (R-06/AC-04).
- Teste verifica que `totalTimeMs` e `currentLapTimeMs` avancam durante corrida, e que
  `hud.totalTimeText`/`hud.currentLapTimeText` refletem esses valores no HUD; no
  estado final, `hud.resultVisible === true` com tempo congelado (AC-05/AC-07).

### W-05 — Tres adversarios IA

Implementar exatamente 3 adversarios por IA simples, todos seguindo a pista por
waypoints, completando voltas e evitando travamento permanente em corrida curta. A IA
pode usar velocidade constante ajustada por curva e separacao simples para reduzir
empilhamento.

Validacao:

- Teste confirma `opponents.length === 3`.
- Playwright aguarda cada adversario avancar waypoints e completar pelo menos uma volta
  em modo de teste.
- Teste falha se algum adversario acumular `stuckMs` acima do limite definido.

### W-06 — Fim de corrida, ranking e restart

Implementar conclusao ao atingir `totalLaps`, congelamento/parada do cronometro final,
ranking com jogador e adversarios, exibicao clara do resultado e acao de restart que
retorna ao estado jogavel.

Validacao:

- Teste forca ou completa as voltas e verifica `status === "finished"`.
- Teste confirma `result.ranking` com 4 participantes, `playerPosition` e
  `totalTimeMs`.
- Teste aciona restart e verifica retorno a `ready` ou `running` com contadores
  reiniciados.

### W-07 — README e higiene de isolamento

Finalizar `corrida/README.md` com como rodar localmente, controles e objetivo da
corrida. Adicionar testes Playwright sob `tests/corrida/` ou integrar arquivo
equivalente na suite compartilhada. `package.json` so pode ser alterado se for
necessario expor script de teste especifico.

Validacao:

- Check automatizado confirma existencia de `corrida/README.md` e secoes de rodar,
  controles e objetivo.
- Revisao de imports/paths confirma que `corrida/` nao importa outros jogos.
- A suite Corrida passa isolada e nao exige rede externa.

## 5. Ordem de implementacao

1. W-01 scaffold + boot offline + contrato debug inicial.
2. W-02 pista/checkpoints/limites.
3. W-03 fisica e controles do jogador.
4. W-04 voltas e cronometro.
5. W-05 adversarios IA.
6. W-06 fim, ranking e restart.
7. W-07 README, isolamento e consolidacao dos testes.

Dependencias:

- W-03 depende de W-01 e W-02.
- W-04 depende de W-02 e W-03.
- W-05 depende de W-02.
- W-06 depende de W-04 e W-05.
- W-07 pode iniciar junto com W-01, mas so fecha depois dos testes dos demais
  workstreams.

## 6. Write set permitido

Implementacao autorizada somente nos caminhos abaixo:

- `corrida/**`
- `tests/corrida/**`
- `tests/**` apenas para registrar a suite Corrida em configuracao compartilhada
  existente, se o repo ja exigir esse padrao
- `package.json` apenas se necessario para script de teste Corrida
- `specs/releases/corrida-v0.1.0/**`

Fora de escopo para implementacao:

- `tauan-trex/**`
- `aero-fighters/**`
- `space-war/**`
- `aero-fighters-v2/**`
- `vendor/**`
- `.github/**`

## 7. Mapeamento SPEC -> PLAN

| Requisito | Workstreams | Validacao principal |
|-----------|-------------|---------------------|
| R-01 Jogo standalone | W-01, W-07 | AC-08, revisao de imports/paths |
| R-02 Runtime estatico | W-01, W-07 | AC-01, smoke sem rede/build |
| R-03 Engine Phaser Arcade | W-01 | AC-01, revisao de HTML/runtime |
| R-04 Primeira tela jogavel | W-01, W-02, W-05 | AC-02 |
| R-05 Controles simples | W-03 | AC-03, AC-09 |
| R-06 Pista autoral fechada | W-02, W-04 | AC-04, AC-10 |
| R-07 Voltas e cronometro | W-04, W-06 | AC-04, AC-05, AC-07 |
| R-08 Tres adversarios | W-05, W-06 | AC-02, AC-06, AC-07 |
| R-09 Colisao e limites legiveis | W-02, W-03 | AC-10 |
| R-10 Fim e resultado | W-06 | AC-07 |
| R-11 README do jogo | W-07 | AC-11 |

| Acceptance Criterion | Workstreams |
|----------------------|-------------|
| AC-01 boot offline | W-01, W-07 |
| AC-02 primeira tela | W-01, W-02, W-05 |
| AC-03 controles | W-03 |
| AC-04 pista e voltas | W-02, W-04 |
| AC-05 cronometro | W-04, W-06 |
| AC-06 IA | W-05 |
| AC-07 fim de corrida | W-06 |
| AC-08 standalone | W-01, W-07 |
| AC-09 qualidade Tauan | W-01, W-03, W-07 |
| AC-10 limites da pista | W-02, W-03 |
| AC-11 README | W-07 |

## 8. Riscos e controles

- **Risco:** testes passarem por comandos debug e nao provarem jogabilidade real.
  **Controle:** comandos debug so aceleram estados; controles essenciais devem ter
  teste com keypress real.
- **Risco:** IA travar em curva por colisao ou waypoint ruim.
  **Controle:** expor `waypointIndex` e `stuckMs`; teste exige progresso temporal dos
  3 adversarios.
- **Risco:** canvas tornar pistas/limites dificeis de validar.
  **Controle:** contrato debug declara paleta e estado `onTrack`; revisao visual ainda
  confere legibilidade.
- **Risco:** escopo crescer para simulador.
  **Controle:** fisica arcade, corrida curta, sem garagem, campanha, multiplayer ou
  upgrades.

## 9. Criterio de conclusao do PLAN

O PLAN esta completo quando os workstreams acima forem transformados em `TASKS.md`
aprovado, mantendo o mesmo write set, a mesma estrategia de teste e a cobertura total
dos requisitos R-01 a R-11.
