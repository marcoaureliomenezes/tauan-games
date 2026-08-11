---
slug: space-war-jogo
title: Space War — o jogo
category: product
tldr: Combate e exploração espacial com física real documentada — 6 sistemas estelares, balística sob gravidade, viagem interestelar relativística, Sgr A*.
summary: Intuito, mapas (sistemas), lógica e características do space-war (Three.js; ainda na raiz, migração p/ src/web-games pendente).
tags: [product, space-war, espaço, física]
token_estimate: 0
last_updated: "2026-07-18"
release_origin: repo-restructure-src-20260718
---

## Intuito
Jogo de nave com FÍSICA COM SUPORTE NA REALIDADE (lei do projeto): gravitação,
órbitas de Kepler, balística sob campo gravitacional e relatividade visível na
viagem interestelar — tudo documentado no código.

## Mapas (6 sistemas + campanha)
Sistemas estelares como DADOS em `universe.js` (taxonomia NASA de estrelas
parametrizada por massa em `celestial/`), incluindo Sistema Solar (planetas com
texturas fiéis: bandas de Júpiter/GRS, Dark Spot de Netuno, calotas de Marte) e
Sgr A* (buraco negro com estrelas S orbitando). Campanha de 5 fases em
`campaign.js`.

## Lógica
`celestial/` puro e testável em node; `gravity.js`/`orbits.js` consomem o record
canônico; `ballistics.js` (solução de tiro) recebe `gravityFn` injetada e serve
mira, HUD e nuke balística. Viagem interestelar: starfield com aberração
relativística (cos θ' = (cos θ+β)/(1+β cos θ)), Doppler e beaming com tetos
visuais documentados (β geom ≤ 0,90); corredor de estrelas nasce gradual com a
velocidade e morre na chegada. Queda em planeta = queima até desintegrar.
Teto 45k u/s em voo livre (Euler perto do BH injetava energia).

## Características
Three.js r165; oclusão manual do lensflare (log-depth quebra a nativa);
billboards nos eixos da câmera (cross NaN em driver Iris Xe). ⚠ Pasta ainda na
raiz do repo; migra p/ src/web-games/space-war quando a sessão concorrente
liberar.
