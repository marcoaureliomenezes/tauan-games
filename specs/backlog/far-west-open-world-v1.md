---
title: Far West — open-world cowboy horse-riding game (operator 2026-07-18)
status: picked
opened: 2026-07-18
release: far-west-open-world-v1
description: "Novo jogo web 3D de mundo aberto — cowboy a cavalo caçando bandidos fugitivos em paisagem de faroeste (montanhas, florestas, rios), com 1ª/3ª pessoa, caça a veados, acampamento, 2 cidades, 2 aldeias indígenas e trem. Stack proposta — Three.js r165 vendored + packs GLTF CC0."
intents:
  - subject:
      kind: catalog
      ref: games-catalog
    change: "novo jogo 'far-west' (Degrau 2, Three.js r165): mundo aberto procedural (terreno montanhoso em chunks com LOD, florestas, rios com vaus e pontes), cavalgada 1ª/3ª pessoa, ciclo de caça a bandidos fugitivos com mapa, mira [F] + tiro [espaço], caça a veados para alimentar o acampamento, 2 cidades de faroeste vivas (NPCs, carroças), 2 aldeias indígenas hostis (≤10 arqueiros cada), trem em linha férrea atravessando o mapa, fauna (veados, cobras, águias)."
  - subject:
      kind: doc
      ref: memory/tech-stack.md#Stack comprometida por jogo
    change: "registrar far-west como Three.js r165 (Degrau 2) + vendor/jsm ampliado (GLTFLoader, Sky, PointerLockControls) + vendor/models/ com packs GLTF CC0 (Quaternius/Kenney) — primeira exceção planejada ao 'sem assets externos' via assets CC0 commitados no repo (offline mantido)."
---

# Far West — open-world cowboy game

## Demand verbatim (operator, 2026-07-18)

"far-west será o nome do jogo. usará tecnologia web. O intuito é o jogador ser um
cowboy que cavalga por um mundo de paisagens exuberantes, montanhosas, florestas
temperadas. Cavalgamos em um mapa aberto e precisamos capturar bandidos fugitivos.
Teremos um mapa. [...] atravessar rios rasos ou pontes em rios profundos [...] uma arma
e podemos pressionar F para mirar e espaço para atirar. [...] visão em que podemos
alternar entre primeira pessoa e terceira pessoa. primeira pessoa vê a visão do cowboy
e a cabeça do cavalo. [...] bixos como veados, cobras. podemos nos alimentar de veados
(mata-los e leva-los para nosso acampamento). Teremos um acampamento. [...] uma linha
de trem com um trem de ferro bem realista atravessando o mapa. Os principais elementos
do mapa são 2 cidades pequenas de faroeste, 2 tribos indígenas, nosso acampamento. [...]
animais (águias, cobras, veados), árvores naturais do faroeste americano. Ao se
aproximar de aldeias indígenas podemos ser atacados com flechas e mesmo revidar com
tiros. Cada aldeia não tem mais de 10 índios. Nas cidades temos movimento de pessoas,
carroças, cavalos, construções comuns de cidades do faroeste americano. [...] criar um
mapa e experiência de navegabilidade no cavalo o mais realistas possíveis. Pesquise por
componentes externos e jogos de exemplo [...] escolha a melhor stack [...] jogável via
browser."

## Pesquisa de stack e componentes (2026-07-18, web research com licenças verificadas)

### Engine: **Three.js r165 vendored (manter — Degrau 2)**

- Restrições do repo (sem build step, offline, JS puro, GitHub Pages) eliminam Godot
  web-export (COOP/COEP, `.wasm` pesado) e PlayCanvas (fluxo centrado em editor online).
- Babylon.js não agrega nada concreto para este jogo e custa 3–4× o bundle; manter o
  motor da casa preserva o conhecimento e o `vendor/` existente.

### Componentes reutilizáveis (vendorizar, não reinventar)

| Componente | Repo | Licença | Uso |
|---|---|---|---|
| simplex-noise.js | jwagner/simplex-noise.js | MIT ✓ | ruído p/ heightmap, florestas, rios |
| THREE.Terrain | IceCreamYou/THREE.Terrain | MIT ✓ (r160+ compat.) | Diamond-Square/Perlin, filtros (cliffs, canyons), blended material por altitude/inclinação, ScatterMeshes p/ florestas |
| SimonDev ProceduralTerrain (Partes 1–10) | simondevyoutube/ProceduralTerrain_Part1..10 | MIT ✓ | referência de terreno em **chunks com LOD (quadtree)** — adaptar, não é lib |
| SimonDev ThirdPersonCamera + CharacterController | simondevyoutube/ThreeJS_Tutorial_* | MIT ✓ | base da câmera 3ª pessoa e máquina de estados de animação |
| three.js addons r165 (Sky, PointerLockControls, GLTFLoader) | mrdoob/three.js | MIT ✓ | dia/noite + céu atmosférico + FogExp2; mira 1ª pessoa; loader dos packs GLTF — copiar para `vendor/jsm/` |
| Packs GLTF **Quaternius** (animais animados, pessoas, trem, natureza, buildings) + Kenney (props) | quaternius.com / kenney.nl | **CC0** (confirmar no ato do download) | cavalo, veados, cobras, águias, NPCs, trem, árvores, construções — animados e rigados |

**Achado negativo importante:** não existe projeto open-source maduro de horse-riding em
Three.js nem jogo de faroeste web reutilizável. O controlador do cavalo (marchas
passo/trote/galope, clamp no heightmap, alinhamento à normal da encosta, alternância
1ª/3ª pessoa) será feito à mão sobre a base SimonDev — é o diferencial do jogo.

### Hand-roll (pouco, e é o jogo em si)

- Heightmap query (interpolação bilinear) + alinhamento a encostas — tudo depende disso.
- Locomotion do cavalo (transições de marcha, curvas, stamina).
- IA simples: fuga de veados, águias circulando, arqueiros das aldeias, bandidos
  fugitivos, vagões/trem em splines.
- Mapa/minimapa 2D (canvas, projeção ortográfica + marcadores de bandidos).
- Loop de jogo: mira/tiro, captura de bandidos, acampamento/alimentação.

### Decisão de assets (quebra planejada de princípio)

O princípio "sem assets externos em runtime" vira "**sem assets externos em runtime —
tudo commitado em `vendor/models/`**": packs GLTF CC0 vendorizados mantêm o jogo 100%
offline e servível do GitHub Pages. Modelos procedural-puros foram descartados para
personagens/animais porque a locomotion "realistic-ish" procedural é o maior risco do
projeto; props simples (tendas, cercas, acampamento) podem seguir procedurais low-poly.

## Acceptance criteria (rascunho para release-definition)

1. Mundo aberto navegável a cavalo: terreno montanhoso com horizonte, florestas
   temperadas, rios (vaus rasos atravessáveis, pontes em rios profundos), trilhas.
2. Alternância 1ª pessoa (cabeça do cavalo visível) / 3ª pessoa (cowboy + cavalo).
3. Mapa com marcadores dos bandidos fugitivos; captura como loop central.
4. Arma: [F] mira, [espaço] atira; veados caçáveis e transportáveis ao acampamento.
5. 2 cidades com NPCs/carroças/construções de faroeste; 2 aldeias (≤10 arqueiros
   cada) que atacam com flechas ao nos aproximarmos e podem ser revidadas.
6. Trem atravessando o mapa em linha férrea; fauna ambiental (águias, cobras, veados).
7. Tudo offline (vendor/ commitado), sem build step, `index.html` + ES modules,
   Playwright smoke tests verdes, deploy GitHub Pages em subpasta.
8. Módulos `src/*.js` ≤ 250 linhas (convenção do repo).

## Open questions para a grill/release-definition

- Tamanho-alvo do mapa e orçamento de performance (Iris Xe @ 1080p é a referência do repo?).
- Bandidos: captura letal/não-letal? Recompensa/economia ou objetivo único?
- Estilo visual: low-poly estilizado (Quaternius) — o "bem realista" do operador cabe
  no realismo de *comportamento* (cavalo, terreno, física de travessia) mais do que fotorrealismo?
- Persistência (save em localStorage) ou sessão única?
