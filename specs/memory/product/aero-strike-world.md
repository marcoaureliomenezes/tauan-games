---
slug: aero-strike-world
title: Aero Strike — mundo e mapas
category: product
tldr: 4 mapas jogáveis, uma verdade de superfície única, terreno por heightfield, água/rio, estradas autorais e cenário (árvores/estruturas).
summary: Especifica os 4 mapas do Aero Strike, o modelo de superfície surfaceInfoAt, o terreno de cada mapa (ilhas, mesas, morros, heightfield contínuo de Inhauma), água e rio, a rede de estradas por spline e o cenário (árvores instanciadas, estruturas). Detalhe suficiente para recriar o mundo.
tags:
  - product
  - aero-strike
  - world
  - maps
agent_tier: self-pull
token_estimate: 0
last_updated: "2026-07-01"
release_origin: aero-fighters-world-realism-v1
---

## Propósito

Descrever o mundo jogável do Aero Strike: os mapas, como o terreno é gerado e colidido, e
o cenário — com detalhe suficiente para recriar o mundo. Parte de [[aero-strike]].

## Visão geral

### Verdade de superfície (contrato central)

Toda colisão, pouso e HUD leem **uma** função por mapa: `surfaceInfoAt(x,z)` retorna
`{height, kind}` com `kind ∈ water | land | mountain | runway | taxiway | service |
structure`. O pavimento de aeroporto é testado primeiro (retângulos). A colisão
(`checkTerrainCollision`) segue: pavimento nunca colide; montanha se `y < height +
MOUNTAIN_BUFFER(5)`; água se `y < 1.5`; senão solo se `y < height + 1.2`. **Regra de ouro
para reimplementação:** a função de altura de colisão e a geração do mesh visual devem
casar exatamente — se divergirem, o jogador colide com "nada" ou atravessa o visível.

### Os 4 mapas

Registrados em `maps/index.js` (`MAP_KEYS = ['islands','desert','rio','inhauma']`); cada um
expõe `{create, heightAt, update, layout, label}`. A função de altura ativa é trocada por
`setActiveHeightFn`. **Todo mapa tem aeroporto** e popula `game.islands[]` com domos de
colisão `{cx,cz,radius,peakHeight,...}`.

| Mapa | Rótulo | Terreno | Água | Aeroporto |
|------|--------|---------|------|-----------|
| `islands` | Mar do Sul | Oceano 10000 + **18 ilhas-domo** (`ISLAND_DEFS`), colorido por altitude (areia→grama→floresta→rocha→neve), palmeiras instanciadas, anéis de espuma | Oceano animado (3 senos), textura procedural | Atol elevado |
| `desert` | Deserto | Piso 12000 + **10 mesas/canyons** (`MESA_DEFS`), 320 rochas/cactos instanciados, fog âmbar | — | Pista no piso |
| `rio` | Rio de Janeiro | Oceano + **8 morros nomeados** (Pão de Açúcar, Corcovado, Dois Irmãos, Pedra da Gávea, Tijuca, 3 favelas), zona urbana (asfalto, praia de Copacabana, arranha-céus instanciados) | Oceano `z < -230`, praia | Santos Dumont |
| `inhauma` | Inhauma-MG (realista) | **Heightfield FBM contínuo** (ver abaixo) — mapa de trabalho ativo | Rio + reservatório + barragem | Aeródromo com exclusão |

### Terreno de Inhauma (mapa realista, foco atual)

- **Altura contínua:** `inhaumaContinuousHeight(x,z)` é a verdade única (visual +
  colisão). Base = `fbm2D(0.0011, 5 oct)·30 − 4 + ridgedFbm2D(0.0008, 4 oct)·18`, mais
  **features nomeadas** (`INHAUMA_FEATURES`: rise urbano, morros, pico da serra de Sete
  Lagoas ~96 m, vale), menos o carve do rio e a bacia do reservatório.
- **Morros/serras NÃO são meshes separados** — são deformações do heightfield. O terreno
  visual é renderizado como **chunks reciclados ao redor do player** (~9 chunks 2600×2600).
  **Invariante de visibilidade (WS-1):** onde há altura de montanha e um objeto posicionado
  na altura absoluta (ex.: antiaérea no topo da serra, helicóptero), **deve** haver mesh de
  terreno visível — caso contrário o objeto fluta sobre terreno invisível (bug corrigido
  nesta release; ver `specs/bugs/aero-inhauma-invisible-mountains.md`).
- **Projeção:** origem OSM `lat −19.47, lon −44.46`, escala `0.06`, `x=leste, z=norte`. O
  dump OSM bruto (2169 arestas de estrada) foi **abandonado** no course-correction de
  2026-07-01 em favor de estradas autorais por spline (ver abaixo; registro em
  `specs/releases/v0.2.0/TASKS.md` seção Course Correction).
- **Coordenadas globais:** destro, `−Z` = frente/norte, `+X` = leste, `+Y` = cima. O nariz
  do jato aponta para `−Z` local. Altitude do HUD = `y` do mundo em metros honestos.

### Água e rio (Inhauma)

- `WATER_LEVEL = 4.5`. **Rio** = polyline (meia-largura ~60, vale ~200) que **escava** o
  heightfield ao longo de todo o traçado; **reservatório** = bacia; **barragem** = box de
  concreto. A superfície de água é uma fita de `PlaneGeometry` por segmento com textura
  animada que rola.
- **Invariante (WS-3):** a fita de água deve ser desenhada ao longo de **todo** o polyline
  do rio (não só a jusante da barragem), com largura perceptível de voo. Voar contra o rio
  se comporta como água (`kind:'water'` → splash/afundamento).

### Estradas (Inhauma, autorais por spline)

- **4 corredores** definidos por poucos pontos de controle (`inhauma-road-defs.js`),
  densificados por **Catmull-Rom pura-JS** (12 m) para dados/colisão e por
  `THREE.CatmullRomCurve3` centrípeta (8 m) para a fita visual:
  - `mg-238` (rodovia, larg. 15), `anel-inhauma` (regional em anel fechado, 11),
    `amg-0360` (rua, 8), `mg-060` (regional, 9).
- A fita segue a altura do terreno; um **carve de leito** (`applyInhaumaRoadBed`) achata a
  faixa para a estrada não flutuar. Props: faixas, marcadores de borda, postes, placas
  (MG-238/MG-060/AMG-0360/Anel). **30 carros** circulam em loop (rodovia 30, regional 24,
  rua 19; caminhões ×0.78).
- **Invariante (WS-2):** estradas abertas não terminam abruptamente no ar. Cada ponta
  entra num **portal de túnel** num flanco de serra existente (sem pico), ou se estende à
  fronteira (some no fog), ou termina em malha urbana/terra seca. O anel é fechado.

### Cenário: árvores e estruturas

- **Árvores** (`buildForests`): espalhadas por bandas de altitude, excluídas de
  aeroporto/urbano/rio/estrada. **Devem ter 3-5 espécies visualmente distintas** (pinho,
  folhosa, arbusto, seca, palmeira), cada uma um par de InstancedMesh, com jitter de cor
  por instância — sem "clones uniformes" (WS-3). Instanciado por performance.
- **Estruturas** (Inhauma): barragem, torres de refrigeração nuclear + domo do reator,
  fábricas, blocos de cidade, igreja — registram AABBs; `inhaumaStructureInfoAt(x,z)`
  devolve `{height, kind:'structure', id}`.

## Estado runtime tocado

- `game.islands[]` (domos de colisão de todo mapa), `game.activeMap`, a função de altura
  ativa (`setActiveHeightFn`), estruturas registradas de Inhauma.

## Dependências

- [[aero-strike]] — o jogo. [[aero-strike-flight]] — como o mundo é voado/colidido.
- [[aero-strike-fx]] — a nuke deforma terreno e (WS-5) incendeia árvores/casas.
