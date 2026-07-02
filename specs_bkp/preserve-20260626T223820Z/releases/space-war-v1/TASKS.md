# TASKS: Space War — Solar System Flight & Combat

> **Status:** Aprovado — 2026-06-13 (operador: "Go ahead, do your best work.")
> **SPEC:** `specs/releases/space-war-v1/SPEC.md` [Aprovado]
> **PLAN:** `specs/releases/space-war-v1/PLAN.md` [Aprovado]
> **Created:** 2026-06-13

---

## Pre-implementation Checklist

- [x] SPEC.md aprovado
- [x] PLAN.md aprovado
- [x] TASKS.md aprovado
- [x] Nenhuma task em progresso duplicada

---

## Write set

`space-war/**`, `index.html` (card do catálogo), `tests/` (smoke), esta release.

---

## Tasks

### Wave 1 — Fundação
- [x] T-SW-01 `config.js` — unidades, tempo, GFAC, tabela de corpos (Sol/8 planetas/luas) e cores.
- [x] T-SW-02 `state.js` + `scene.js` — estado global `window.__spaceWar`, scene/camera/renderer/luzes.
- [x] T-SW-03 `skybox.js` — skybox galáctico procedural (Via Láctea, Andrômeda, Magalhães, nebulosas, buracos negros, supernova, quasares redshift).
- [x] T-SW-04 `bodies.js` — Sol + planetas + luas, materiais procedurais, atmosferas, anéis.
- [x] T-SW-05 `orbits.js` — órbitas cinemáticas (Kepler relativo, Terra 30 min, rotações) + `main.js` loop básico.

### Wave 2 — Gravidade + nave
- [x] T-SW-06 `gravity.js` — campo newtoniano sobre a nave + zona de não-retorno do Sol.
- [x] T-SW-07 `ship.js` — nave 6-DOF, throttle, decolagem da Terra, atmosfera/horizonte.
- [x] T-SW-08 `input.js` — controles teclado/mouse.
- [x] T-SW-09 `hud.js` + `map.js` — HUD e mapa do sistema (M).

### Wave 3 — Combate + missões
- [x] T-SW-10 `weapons.js` — laser + nukes + projéteis.
- [x] T-SW-11 `enemies.js` — naves inimigas, estações, defesas, IA simples.
- [x] T-SW-12 `missions.js` + `fx.js` — missões de bombardeio + partículas/explosão de nuke.

### Wave 4 — Polish + QA
- [x] T-SW-13 `index.html` do jogo + card no catálogo raiz.
- [x] T-SW-14 Afinação visual (cores vibrantes) + balance de gravidade.
- [x] T-SW-15 Smoke test Playwright (`window.__spaceWar`, sem erro fatal de console).

### Wave 5 — Feedback de playtest do operador (2026-06-13)
- [x] T-SW-16 Navegabilidade: voo arcade (a nave voa para onde aponta) mantendo gravidade real.
- [x] T-SW-17 Navegação: `nav.js` — seletor de alvo (T), seta/mira na tela com distância, piloto automático de mira (C); alvo default = objetivo da missão.
- [x] T-SW-18 Estrelas realistas: skybox repintado com pontos 1px nítidos (antes pareciam grandes); difração rara.
- [x] T-SW-19 `__swDebug` API + audit visual de todos os corpos; testes AC-09 (nav) e AC-10 (align); Sol re-tunado p/ não-retorno valer no turbo.
- [x] T-SW-20 Bug: inimigos da Lua abatiam a nave na decolagem. Fix: Terra/Lua = zona segura (sem caças), escudo de 6s pós-decolagem, sem dano enquanto pousado, alcance/dano inimigo reduzidos; HUD "SEGURE [W] PARA DECOLAR"; teste AC-11 (sobrevive ao início).

### Wave 6 — Overhaul de escala + física realista (feedback do operador)
- [x] T-SW-21 Escala grande: corpos ~100x maiores (Terra 20→2000, etc.), distâncias astronômicas (Netuno 16k→320k); planetas pequenos de longe, ENORMES de perto. Log-depth buffer + far 3M + skybox 1.5M.
- [x] T-SW-22 Física newtoniana real (inércia; removido o modelo arcade) + freio (X). Gravidade SOI-DOMINANTE (patched conics): um corpo te governa por vez → dá pra ORBITAR e o Sol não te arranca da Terra. Probe confirma órbita estável (r~3600 mantido 8s, HP 100).
- [x] T-SW-23 Bolhas de SOI visíveis (wireframe, aparecem ao se aproximar). Combate/efeitos reescalados (inimigos, lasers, nukes, explosões, base de missão, mapa).
