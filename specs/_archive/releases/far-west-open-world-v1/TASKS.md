# TASKS — Release: far-west-open-world-v1

> **Status:** Aprovado
> **Release ID:** far-west-open-world-v1
> **Spec:** `SPEC.md` Aprovado
> **Plan:** `PLAN.md` Aprovado
> **Criado:** 2026-07-18

## Tarefas

- [x] **T-FW-01 — Vendor: addons three, simplex-noise, packs GLTF CC0**
  - **Owner:** game-developer
  - **Write set:** `vendor/jsm/**`, `vendor/simplex-noise.js`, `vendor/models/**`.
  - **Descricao:** vendorizar GLTFLoader, Sky, PointerLockControls (+ deps internas)
    do three r165; simplex-noise.js (ESM); baixar packs GLTF CC0 (cavalo, cowboy,
    veado, cobra, aguia, NPCs masculinos/femininos, nativos, locomotiva+vagoes,
    arvores/rochas) para `vendor/models/`; escrever `vendor/models/LICENSES.md` com
    fonte, URL e licenca de cada pack, confirmando CC0 no ato do download.
  - **Validacao:** nenhum arquivo fora do write set; LICENSES.md cobre 100% dos
    modelos; nenhum asset binario acima de 15 MB sem necessidade.
  - **Precondicoes:** nenhuma.

- [x] **T-FW-02 — Scaffold + contratos (state, config, index, assets, input)**
  - **Owner:** game-developer
  - **Write set:** `far-west/index.html`, `far-west/styles.css`, `far-west/src/state.js`,
    `far-west/src/config.js`, `far-west/src/main.js`, `far-west/src/input.js`,
    `far-west/src/assets.js`, `far-west/src/utils.js`, `far-west/README.md`.
  - **Descricao:** scaffold no padrao aero-fighters: import map para `vendor/`,
    `window.game` em state.js, config.js com todas as constantes, loop em main.js,
    input map unico, assets.js com registry GLTF + fallbacks procedurais por
    categoria (animal, pessoa, vegetacao, veiculo, prop). Esqueleto de
    `terrain.heightAt(x,z)`/`normalAt(x,z)` ja definido como contrato (implementacao
    em T-FW-03).
  - **Validacao:** pagina abre sem console errors; `window.game` existe com
    `world/player/entities/ui`; assets.js retorna fallbacks quando GLTF ausente.
  - **Precondicoes:** T-FW-01.

- [x] **T-FW-03 — Mundo: terreno chunks/LOD, rios+pontes, ceu, vegetacao**
  - **Owner:** game-developer
  - **Write set:** `far-west/src/terrain.js`, `far-west/src/water.js`,
    `far-west/src/sky.js`, `far-west/src/vegetation.js`, `far-west/src/world.js`,
    `far-west/src/config.js`.
  - **Descricao:** heightmap 2048x2048 seed fixa (simplex fBm), chunks 8x8 com 2 LODs
    por distancia da camera, material por altitude/inclinacao (neve/rocha/grama/
    trilha), rios como canais descendentes com trechos rasos (vaus) e profundos +
    >=2 pontes de madeira, lagos, Sky addon + FogExp2 + ciclo dia/noite, scatter
    instanciado de arvores/rochas/arbustos por bioma. `heightAt`/`normalAt`
    bilinear exatos contra a malha de alta resolucao.
  - **Validacao:** sim headless: `heightAt` bate com raycast na malha (tolerancia
    0.1 m) em 200 amostras; FPS >= 30 em 1024x768; vaus marcados em
    `world.fords` e pontes em `world.bridges`.
  - **Precondicoes:** T-FW-02.

- [x] **T-FW-04 — Cavalo + cameras 1a/3a pessoa**
  - **Owner:** game-developer
  - **Write set:** `far-west/src/horse.js`, `far-west/src/player.js`,
    `far-west/src/camera.js`, `far-west/src/config.js`.
  - **Descricao:** marchas parado/passo/trote/galope com aceleracao e curvas suaves,
    stamina drenando no galope e recuperando nas demais, corpo alinhado a
    `normalAt`, reducao de velocidade em subida/agua rasa, bloqueio em agua
    profunda (exceto ponte), camera 3a pessoa follow com colisao basica e 1a
    pessoa nos olhos do cowboy com cabeca do cavalo visivel; [V] alterna.
  - **Validacao:** sim headless de marchas/stamina/terreno; Playwright: WASD/Shift/V
    alteram `game.player` e `game.ui.cameraMode`.
  - **Precondicoes:** T-FW-03.

- [x] **T-FW-05 — Combate: mira [F], tiro [espaco], recarga [R]**
  - **Owner:** game-developer
  - **Write set:** `far-west/src/combat.js`, `far-west/src/fx.js`,
    `far-west/src/hud.js`, `far-west/src/config.js`.
  - **Descricao:** revolver hitscan com dispersao reduzida ao mirar (zoom leve),
    tracer + impacto, 6 balas no tambor + reserva, recarga com tempo, dano por
    alvo (veado abate, bandido rende, nativo derruba), crosshair contextual.
  - **Validacao:** sim headless de dispersao/dano; HUD mostra municao; Playwright
    dispara contra alvo de teste e ve contadores.
  - **Precondicoes:** T-FW-04.

- [x] **T-FW-06 — Entidades: cidades, aldeias, trem, fauna, bandidos, acampamento**
  - **Owner:** game-developer
  - **Write set:** `far-west/src/towns.js`, `far-west/src/villages.js`,
    `far-west/src/train.js`, `far-west/src/animals.js`, `far-west/src/bandits.js`,
    `far-west/src/camp.js`, `far-west/src/npcs.js`, `far-west/src/config.js`.
  - **Descricao:** 2 cidades (predios procedurais tipicos: saloon, banco, hotel,
    loja; NPCs caminhando; carrocas em rotas), 2 aldeias com <=10 arqueiros cada
    (flechas com arco balistico quando jogador <40 m), trem em spline fechada com
    locomotiva+vagoes e cruzamento sinalizado, veados em bandos com fuga, cobras
    com ataque de proximidade, aguias circulando, 5 bandidos fugitivos com rotas
    de fuga, rendicao ao serem atingidos e captura por proximidade [E];
    acampamento fixo com fogueira/tenda, entrega de veado [E] enchendo comida,
    recuperacao de vida/municao.
  - **Validacao:** sim headless: fuga de veado, flecha de arqueiro no alcance,
    rendicao+captura de bandido, entrega de veado altera `game.player.food`;
    contadores de entidades em `window.game.entities`.
  - **Precondicoes:** T-FW-05.

- [x] **T-FW-07 — Mapa [M], minimapa, HUD completo, audio**
  - **Owner:** game-developer
  - **Write set:** `far-west/src/map.js`, `far-west/src/hud.js`,
    `far-west/src/audio.js`, `far-west/styles.css`.
  - **Descricao:** mapa fullscreen canvas 2D com relevo (do heightmap), rios,
    cidades, aldeias, acampamento e marcadores dos bandidos; minimapa rotativo no
    canto; HUD com vida/stamina/fome/municao/bandidos capturados; audio WebAudio
    sintetizado (galope por marcha, tiro, recarga, ambiente, trem).
  - **Validacao:** [M] abre/fecha mapa com marcadores corretos; HUD reflete
    `game.player`; nenhum arquivo de audio externo.
  - **Precondicoes:** T-FW-06.

- [x] **T-FW-08 — Smoke Playwright + catalogo + README final**
  - **Owner:** qa-engineer
  - **Write set:** `tests/far-west/**`, `index.html`, `package.json`,
    `far-west/README.md`.
  - **Descricao:** suite Playwright: boot offline sem console errors, zero requests
    externos (interceptar e reprovar), canvas WebGL renderiza (pixel nao-preto),
    `window.game` expoe mundo/entidades, interacao basica (marcha, camera, tiro
    contra alvo de teste, mapa); link no catalogo principal; README com controles,
    objetivo e como rodar.
  - **Validacao:** `npx playwright test tests/far-west` verde em servidor estatico.
  - **Precondicoes:** T-FW-07.
