---
slug: demolition-ball-jogo
title: Demolition Ball — o jogo
category: product
tldr: Trator-guindaste com bola de demolição de 4,2 t numa cidade procedural viva; contratos de destruição; WebGL2 100% próprio (zero libs, só snoise MIT).
summary: Identidade, intuito e leis do demolition-ball (src/web-games/demolition-ball). Construído em 1 shot, memorializado e expandido na v0.9.0.
tags: [product, demolition-ball, demolicao]
token_estimate: 0
last_updated: "2026-08-11"
release_origin: v0.9.0
---

## Intuito

Operar uma máquina de demolição de verdade: a bola é um pêndulo físico preso a
um cabo inextensível, e derrubar prédios exige embalo, mira e paciência — ou,
no Modo Tauan, só segurar ESPAÇO e ver a bola buscar o alvo ([[demolition-ball-modos]]).
Público primário: o filho de 3 anos do operador.

## Identidade técnica (LEI)

- **WebGL2 puro**: renderer (forward + shadow map PCF + GGX), física, destruição
  volumétrica, áudio (WebAudio) e UI escritos do zero NESTE diretório.
- **Nenhuma dependência** além de `src/vendor/snoise.js` (webgl-noise, MIT) para
  as nuvens — decisão ADR-5 da v0.9.0. Sem build, sem CDN.
- Cidade determinística (mesma semente = mesma cidade); teste/debug via
  `window.__demolition`.
- 3 draw calls instanciados (box/esfera/cilindro) + static mesh + partículas;
  `?quality=low` para rasterizador de software (CI).

## Estrutura

`src/`: `main.js` (wiring/HUD/câmera), `rig.js` (máquina+pêndulo+operador),
`city.js` (geração, rio), `destruction.js`, `debris.js`, `missions.js`,
`modes.js`, `traffic.js`, `pedestrians.js`, `crew.js`, `renderer.js`,
`shaders.js`, `geometry.js`, `gl.js`, `math.js`, `minimap.js`, `audio.js`,
`vendor/snoise.js`. Testes: `src/web-games/tests/demolition-ball/`
(unit.mjs headless + e2e Playwright com config GL dedicada).
