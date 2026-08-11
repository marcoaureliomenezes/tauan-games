# TASKS — Release: far-west-character-v1

> **Status:** Aprovado
> **Release ID:** far-west-character-v1
> **Spec:** `SPEC.md` Aprovado · **Plan:** `PLAN.md` Aprovado
> **Criado:** 2026-07-18

## Tarefas

- [x] **T-CH-01 — Character: pose única homem-cavalo + colisão + mira/tiro coerente**
  - **Owner:** game-developer
  - **Write set:** `src/web-games/far-west/src/player.js`, `src/web-games/far-west/src/horse.js`,
    `src/web-games/far-west/src/camera.js`, `src/web-games/far-west/src/combat.js`, `src/web-games/far-west/src/collision.js` (new),
    `src/web-games/far-west/src/config.js`, `src/web-games/far-west/src/main.js`, `src/web-games/far-west/src/vegetation.js`,
    `src/web-games/far-west/src/towns.js`, `src/web-games/far-west/src/villages.js`, `src/web-games/far-west/src/camp.js`,
    `src/web-games/far-west/src/fx.js`, `tests/far-west/far-west.spec.js`.
  - **Descricao:** executar o PLAN integralmente — pose de montaria validada por
    screenshots multi-ângulo × 5 estados sem interpenetração; tronco com lean por
    velocidade; colisores (rochas, troncos, construções) com push-out + slide;
    cadeia mira→tiro corrigida (ray da câmera ativa pelo centro, tracer cano→impacto);
    testes novos: colisão (cavalo não penetra rocha), impacto sob a crosshair.
  - **Validacao:** suíte verde; sim: push contra rocha 5 s com penetração 0;
    tiro em rocha a 30 m com impacto <0.5 m da crosshair; screenshots de referência
    inspecionados (4 ângulos × idle/walk/trot/gallop/jump) confirmando figura única.
  - **Precondicoes:** nenhuma.
