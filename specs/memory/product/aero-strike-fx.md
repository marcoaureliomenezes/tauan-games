---
slug: aero-strike-fx
title: Aero Strike — efeitos, nuke, câmera, HUD e áudio
category: product
tldr: Explosões pooladas + mega-explosão; a nuke (flash → fireball → cogumelo ~60s → shockwave → ignição de cenário); câmeras, HUD e áudio sintetizado.
summary: Especifica o sistema de FX do Aero Strike — explosões pooladas, mega-explosão, e o espetáculo da nuke (flash, fireball, cogumelo persistente, shockwave, ignição de árvores/casas), além dos 5 modos de câmera, do HUD e do motor de áudio Web Audio. Detalhe suficiente para recriar o espetáculo.
tags:
  - product
  - aero-strike
  - fx
  - nuke
  - audio
agent_tier: self-pull
token_estimate: 0
last_updated: "2026-07-01"
release_origin: aero-fighters-world-realism-v1
---

## Propósito

Descrever como o jogo mostra destruição, se enquadra, se ouve e se lê — com detalhe
suficiente para recriar o espetáculo. Parte de [[aero-strike]].

## Visão geral

### Explosões (pool de partículas — `fx.js`)

Todo visual efêmero é **poolado** e atualizado por `updateParticles(dt, playerPos)` com
fade por distância. Pools: fireballs aditivos, debris, fumaça, sparks, trilhas de míssil,
colunas de fogo sustentado; shockwaves/flashes/cicatrizes sob demanda. `scheduleDelayed`
(sincronizado ao loop) substitui `setTimeout`.

- **`explosion(pos, scale, color)`** — fireballs (crescem, caem, somem), colunas de fogo
  sustentado (2,5-4 s), debris, fumaça que transiciona preto→cinza, sparks aditivos, e um
  anel de shockwave no solo se `y < 20`.
- **`megaExplosion(pos, kind)`** — em camadas: flash + 3 fireballs coloridos escalonados
  (amarelo/laranja/vermelho) + 2 shockwaves + 3-5 sub-pops. Usada em bases/fábricas/boss e
  no crash do jogador.
- **Paleta de fogo** (`COLORS`): `flameYellow`, `fireOrange`, `fireRed`, `fireYellow`.
  **Regra (WS-5):** explosões devem usar **múltiplas cores de fogo** (branco-quente →
  amarelo → laranja → vermelho), não uma cor plana.

### A nuke (espetáculo)

A nuke é o clímax visual. **Contrato de produto (WS-5):**

1. **Autoridade única** — a nuke renderiza **um** cogumelo (sem duplicação de sistemas). O
   burst inicial violento (poucos segundos) pode usar partículas; a **pluma persistente** é
   mesh (`nuclear-fx.js`, ≈4 meshes) — nunca centenas de partículas por 60 s (FPS).
2. **Flash** — clarão branco de tela (DOM `#nuke-flash`) + core branco-quente na origem.
3. **Fireball multicor** que **sobe e afunila no talo**, virando o cogumelo (não uma esfera
   separada); cor por rampa de vida branco→amarelo→laranja→vermelho.
4. **Cogumelo atômico persistente ~60 s**, subindo à atmosfera (talo + copa/anvil que
   alarga conforme sobe), com turbulência e leve rotação; fade nos últimos ~15 s.
5. **Shockwave de solo** visível varrendo para fora (~600-800 m em 2-4 s).
6. **Ignição de cenário** — árvores e casas próximas ao epicentro **pegam fogo** por alguns
   segundos (fogo em loop), como num impacto nuclear real. Contagem com **cap rígido** por
   performance (nearest ~30-50), com guarda headless.
7. **Câmera dedicada** — enquadramento lateral wide dolly que acompanha o cogumelo subir;
   slow-mo global 0.35× por 1,5 s (nunca em test/headless); onda de choque chega à câmera
   com atraso físico (`dist/340 m/s`).
8. Cratera/cicatriz no piso + coluna de fumaça residual por ~60 s.

`nuclearFxState` (lido pelo debug HUD) expõe o estágio `flash→fireball→mushroom→
dissipating` e deve refletir a timeline de ~60 s. `factory-fx.js` provê o pool dedicado de
fumaça (chaminés + coluna residual da nuke), nunca compartilhado com explosões.

### Câmera (5 modos, tecla C)

Chase, Wide Chase, Cockpit-Nose, Flyby-Cinematic, Orbit-Inspection — cada um com offset e
FOV; follow por lerp suave, look-ahead na direção da frente. Shake por acertos/nuke
(`game.flags.cameraShake {intensity,duration}`). A nuke dispara uma tomada
cinematográfica lateral que recua enquanto o cogumelo sobe.

### HUD e minimapa

- **HUD** (`hud.js`, diff-render em spans do `index.html`): vidas (♥), barra de dano,
  score, munição (MSLS/HVY/T NUK), SPD, THR %, **ALT em metros honestos**, ALVOS
  destruídos/total, aviso STALL, guia de aproximação (distância/alinhamento à pista no
  RTB), barra de HP do boss.
- **Minimapa** (`ui/minimap.js`): canvas 180 px, plota ilhas, alvos (AA vermelho / navio
  azul / amarelo), pista e o ponto verde do jogador.

### Áudio (Web Audio 100% sintetizado — `audio.js`)

Sons gerados por síntese (sem arquivos), lazy-init no primeiro input, panners 3D HRTF:
motor contínuo (segue speed/throttle), canhão, míssil, explosão + mega-explosão (thump de
sub-grave), tiro de AA, beep de lock, hit, alarme de mayday, whoosh de quase-acerto,
chatter de rádio + estática, vento (escala com altitude), boom ambiente distante. `toggle()`
muta.

### Nota de headless

Caminhos `HEADLESS`/`navigator.webdriver` reduzem geometria, desligam sombras, pulam o
slow-mo da nuke e a ignição de cenário, e renderizam em 0.35× — para os testes Playwright
rodarem estáveis. Novos FX pesados **devem** respeitar essa guarda.

## Estado runtime tocado

- Pools internos de `fx.js`/`nuclear-fx.js`/`factory-fx.js`; `nuclearFxState`;
  `game.flags.{cameraShake, nukeSlowmo, nukeShockArrival}`.

## Dependências

- [[aero-strike]] — o jogo. [[aero-strike-combat]] — o que dispara os FX.
- [[aero-strike-world]] — a nuke deforma terreno e incendeia árvores/casas.
