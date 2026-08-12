# TASKS — Release: far-west-uplift-v1

> **Status:** Aprovado
> **Release ID:** far-west-uplift-v1
> **Spec:** `SPEC.md` Aprovado · **Plan:** `PLAN.md` Aprovado
> **Criado:** 2026-07-18

## Tarefas

- [x] **T-UP-01 — Cavaleiro sentado + pulo + velocidade + controles CS + visual**
  - **Owner:** game-developer
  - **Write set:** `far-west/src/player.js`, `far-west/src/input.js`,
    `far-west/src/camera.js`, `far-west/src/combat.js`, `far-west/src/horse.js`,
    `far-west/src/terrain.js`, `far-west/src/sky.js`, `far-west/src/water.js`,
    `far-west/src/main.js`, `far-west/src/assets.js`, `far-west/src/fx.js`,
    `far-west/src/config.js`, `far-west/src/hud.js`, `far-west/index.html`,
    `far-west/styles.css`, `tests/far-west/far-west.spec.js`.
  - **Descricao:** executar o PLAN integralmente: pose de montaria sem clipping,
    galope ~14 m/s com FOV kick + poeira, pulo no [espaço], mira livre com mouse
    (LMB atira, F = ADS) nas duas câmeras e em movimento, terreno com splat de
    4 texturas procedurais, sombras PCF, bloom sutil, água reflexiva, materiais
    GLB corrigidos; atualizar os testes afetados pelo remap (espaço→pulo,
    tiro→botão do mouse).
  - **Validacao:** suíte `tests/far-west/` verde com os novos controles; sim
    headless: pulo sobe e desce no heightAt, LMB decrementa ammo, pose sentada
    visível em screenshot nas duas câmeras; zero console errors.
  - **Precondicoes:** nenhuma.
