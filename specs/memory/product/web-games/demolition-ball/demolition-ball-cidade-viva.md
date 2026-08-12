---
slug: demolition-ball-cidade-viva
title: Demolition Ball — cidade viva
category: product
tldr: Cidade 7x7 determinística com rio+3 pontes, fachadas em shader, pedestres imunes, tráfego e equipe de cones.
summary: Como a cidade da v0.9.0 é gerada e animada — city.js, traffic.js (severed/closedEdges), pedestrians.js, crew.js, fachadas/céu em shaders.js.
tags: [product, demolition-ball, cidade, trafego, pedestres]
token_estimate: 0
last_updated: "2026-08-11"
release_origin: v0.9.0
---

## Geração (`city.js`, semente fixa 20260725)

- Grade 7×7 (BLOCK 62 m, ROAD 16 m); estruturas em voxels de 2,5 m.
- **Rio (R-07)**: coluna de quarteirões `RIVER_COL=1`, água rebaixada (chão e
  asfalto DIVIDIDOS em volta — nunca desenhar água sob asfalto), muros de pedra,
  margens gramadas; **pontes em j=2,4,6** (tabuleiro y=0,12 + guarda-corpos +
  pilares). `city.river.onBridge(z)` é a autoridade de travessia.
- Praças (13%): caminhos cruzados, 10 árvores (3 variantes), 4 canteiros de
  flores com cor própria; quarteirões residenciais ganham árvores de calçada.

## Fachadas e céu (`shaders.js`)

- Estilo por instância em `i_scale.w` (1 torre-vidro, 2 apartamento, 3 casa,
  4 galpão, 5 loja, 6 silo), padrão ancorado em MUNDO (células alinham).
- Céu: gradiente de manhã + nuvens `snoise` 3 oitavas (1 em `?quality=low` via
  `u_cloudHq`). GOTCHA histórico: o sky pass do 1-shot NUNCA desenhava (quad no
  far plane × depth LESS) — o céu era o clearColor; corrigido na v0.9.0
  desligando depth test no passe.

## Tráfego (`traffic.js`)

- Grafo de nós de interseção; `severedEdges` (rio sem ponte) + `closedEdges`
  (equipe de cones) — `isBlocked()` vale para spawn e `pickNext`.
- 3 modelos (sedan/caminhonete/van) com vidro, faróis e lanternas; fila/freio
  originais intactos.

## Pedestres e equipe

- `pedestrians.js`: 56 walkers (perímetro de quarteirão, atravessam praças) +
  2 pacers por ponte; fogem de bola rápida (<11 m) e do trator (<6 m); IMUNES —
  jamais feridos, jamais na água, jamais dentro de estruturas.
- `crew.js` (R-11): estado idle→driving→placing→holding→collecting→leaving;
  botão 🚧/tecla C a ≤30 m do alvo, 1× por contrato; 28 cones no perímetro;
  fecha as 4 arestas do quarteirão em `traffic.closedEdges` e reabre na recolha.
