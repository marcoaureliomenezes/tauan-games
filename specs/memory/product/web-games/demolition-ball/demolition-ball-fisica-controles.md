---
slug: demolition-ball-fisica-controles
title: Demolition Ball — física e controles
category: product
tldr: Pêndulo com cabo inextensível em sub-passos de 12,5 ms; destruição E=½mv² em células de 2,5 m com flood-fill de colapso; WASD/QE/RF/ZX/ESPAÇO/C.
summary: As leis físicas do rig e da destruição, o spawn seguro da bola e o mapa de teclas — o que NÃO pode ser refeito (identidade do jogo).
tags: [product, demolition-ball, fisica, controles]
token_estimate: 0
last_updated: "2026-08-11"
release_origin: v0.9.0
---

## Pêndulo (NÃO refazer — excelente desde o 1-shot)

- Bola = massa pontual sob gravidade+arrasto, restrita ao comprimento do cabo a
  partir da ponta da lança; o cabo só PUXA (projeção + remoção da componente
  radial de afastamento). Tensão devolvida ao chassi (o balanço puxa o trator).
- Integração em sub-passos fixos de 12,5 ms (`clamp(ceil(dt/0.0125),1,5)`).
- Impacto: fecha > 1,2 m/s → E = ½mv² × `world.damageMultiplier` vira orçamento
  de dano gasto em cone a partir do contato; a energia gasta SAI da bola.
- Colapso: flood-fill de suporte do chão após cada impacto; células sem caminho
  de carga caem como escombros.

## Spawn seguro (R-04, v0.9.0)

`safeBallPos(pos, radius, world)` — clamp acima do solo e para fora de
footprints vivos; usado no constructor do Rig e no `teleportBallTo` dos testes.

## Barreiras do trator

Colide com footprints de estruturas; **não atravessa o rio fora das pontes**
([[demolition-ball-cidade-viva]]); limite do mundo em `CITY_HALF + 120`.

## Teclas

WASD dirigir · Q/E lança · R/F elevação · Z/X cabo · ESPAÇO homing ·
SHIFT reverso · C equipe 🚧 · M mapa · V câmera · N som · arrastar = olhar.
Cabine aberta com operador visível (colete laranja + capacete) que gira com a
torre — R-12.
