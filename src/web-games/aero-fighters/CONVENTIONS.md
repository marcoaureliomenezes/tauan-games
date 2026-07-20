# Aero Strike — Convenções de Código

> Regras curtas e práticas para humanos e agentes evoluindo este jogo. Complementam o `ARCHITECTURE.md`.

## Limites duros

- **Tamanho de módulo:** ≤ 250 linhas (guideline). Exceção tolerada: `targets.js` pode chegar a ~350 por conter 5 builders de alvo + AA fire.
- **Tamanho de função:** ≤ 60 linhas.
- **Imports por módulo:** ≤ 6 imports do projeto (não conta `three`).
- **Side-effects no load:** ZERO. Importar um módulo nunca pode iniciar o game loop, tocar áudio, ou adicionar mesh à cena. Apenas `main.js` orquestra ações.
- **Texturas procedurais (canvas) são permitidas** (T-V-03, release `aero-fighters-inhauma-visual-uplift-v1`, operador 2026-07-18): `THREE.CanvasTexture` gerada em runtime (padrão já usado em `maps/desert.js` e nas placas de `inhauma-road-props.js`) para janelas de prédios, splat/detail de terreno, normal maps de ruído etc. O que continua proibido é asset externo (arquivo de imagem baixado) — tudo gerado em código, offline.

## Nomenclatura

- Arquivos: `lowercase.js` (single-word) ou `lower-kebab.js` (compostos). Ex.: `audio.js`, `target-types.js`.
- Exports nomeados sempre. **Sem** `export default`.
- Funções de update se chamam `updateX(dt, ...)`.
- Spawners se chamam `spawnX(...)`.
- Construtores de mesh se chamam `makeX()`.
- Constantes em UPPER_SNAKE_CASE quando exportadas de `config.js`.

## Documentação

- **Topo de cada módulo:** bloco de 3 linhas dizendo (1) o que o módulo faz, (2) o que exporta de mais importante, (3) "para adicionar X, edite Y".
- **JSDoc curto** em exports: `/** @param {number} dt segundos desde último frame */`.
- Comentários explicativos em **português**.
- Sem comentários redundantes ("incrementa contador" sobre `i++`).

## Onde vai cada coisa nova

| Quero adicionar... | Vai em... |
|--------------------|-----------|
| Novo tipo de alvo (ex.: silo de míssil) | `targets.js` (builder `makeSilo`) + entrada em `config.TARGETS` + slot em `missions.js` |
| Novo som | `audio.js` (novo método na API do `audio`) |
| Nova tecla / comando | `input.js` (nova flag) + listener em `main.js` |
| Novo widget no HUD | `hud.js` (campo no diff + render) e `index.html` (span novo) |
| Novo efeito visual | `fx.js` (ou novo módulo `fx-xxx.js` se for grande) |
| Nova missão | edita `missions.js` (`TARGET_LAYOUT`) |
| Avião inimigo voando | NOVO `enemies.js`. Não grudar em `targets.js` (alvos são estáticos por design). |
| Cenário novo (deserto etc.) | NOVO módulo `world-desert.js` substituindo `world.js` |

## Contrato `window.game`

- `window.game` é exposto **apenas para tests externos** (`tests/aero-fighters/smoke.spec.js` lê).
- `window.audio` idem.
- **Apenas estes módulos podem ESCREVER em `game.*`:**
  - `state.js` — define a estrutura inicial e `resetState()`
  - `player.js#updatePlayer` — escreve `game.player.x/y/pitch/speed/throttle/stalled`
  - `targets.js#killTarget` — incrementa `game.score`, `game.kills`, `game.targetsDestroyed`
  - `missions.js` — define `game.cycle`, `game.running`, `game.targetsTotal`, `game.targetsDestroyed`
- Cada lugar que escreve em `game` precisa de um comentário `// CONTRATO: writer de game.X`.
- Leitura é livre.

## Exceções de acoplamento documentadas

- `projectiles.js` **pode** importar `damageTarget` de `targets.js`. (Cheaper alpha-coupling — ver ARCHITECTURE.md seção 7.2.)
- `world.js` **pode** importar `explosion` de `fx.js` para o flak ambiente.
- `targets.js` **pode** importar `spawnBullet` (`projectiles.js`) e `spawnPickup` (`projectiles.js`).
- Qualquer outro acoplamento horizontal entre `entities` (player/targets/projectiles) é proibido sem nova entrada nesta tabela.

## Antes de mudar código existente

1. Use `grep -rn 'nomeDaFuncao' src/` para achar todos os usos.
2. Se for adicionar feature nova, primeiro escreva 1 frase explicando "onde vai" usando a tabela acima.
3. Não copie e cole. Se vai duplicar 5+ linhas, extraia função em `config.js` ou no módulo origem.
4. Se precisa de variável global nova, **pare**. Use `state.js`.
5. Rode `npx playwright test tests/aero-fighters/` antes do commit.

## Para o Tauan (quando ele crescer)

- O jogo começa em `src/main.js` e usa `src/config.js` para todos os números.
- **Mude um número em `config.js`** (ex.: `PLAYER.MAX_SPD: 80` para `200`) e veja o que acontece no jogo.
- Adicionar uma fábrica nova: edita `missions.js` e adiciona uma linha com `[island_idx, dx, dz, 'factory']`.
- Trocar a cor do avião: edita `player.js`, procura `0x2d3037` e muda.
