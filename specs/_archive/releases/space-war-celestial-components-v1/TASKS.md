# TASKS — Release: space-war-celestial-components-v1

> **Status:** Aprovado — 2026-07-03 (mandato do operador: "Define the release and implement it")
> **SPEC:** `specs/releases/space-war-celestial-components-v1/SPEC.md` [Aprovado]
> **PLAN:** `specs/releases/space-war-celestial-components-v1/PLAN.md` [Aprovado]
> **Created:** 2026-07-03

---

## Pre-implementation Checklist

- [x] SPEC.md aprovado
- [x] PLAN.md aprovado
- [x] TASKS.md aprovado
- [x] Release ativada em `specs/releases/ACTIVE.md`
- [x] Backlog promovido (`release:` no frontmatter do entry)
- [x] Nenhuma task `[-]` duplicada

---

## Write set

`space-war/src/celestial/**` (novo), `space-war/src/universe.js` (novo),
`space-war/src/bodies.js` (reduz a fachada), `tests/space-war/**`, `package.json`
(script de teste), esta release. **PROIBIDO**: `space-war/src/gravity.js`,
`space-war/src/orbits.js` (AC-05), `config.js` além de comentários/re-export.

---

## Tasks

### Wave 1 — Núcleo físico
- [x] T-CC-01 `celestial/physics.js` puro (massa→μ, espectro, raio, Hill, vis-viva,
      Kepler, gravReach, escada de destino) + `tests/space-war/tools/test-celestial-unit.js`
      (node) + script npm `test:space-war:unit`. **AC-03 (parte node), AC-10.**

### Wave 2 — Átomos e base
- [x] T-CC-02 `celestial/atoms.js`: extração verbatim de GLSL_NOISE, STAR_VERT/FRAG,
      starMaterial, DISK_*/diskMaterial+paletas, REMNANT_*, makeRadialSprite,
      flareTexture, atmosphere, ringMesh, planetTexture+cache, paintBlob, mix, hex,
      rndSeed, makeSphere, HEADLESS. `bodies.js` passa a importar de atoms (paridade).
- [x] T-CC-03 `celestial/body.js` (CelestialBody: record canônico PLAN §2 + register)
      e `celestial/motion.js` (Pinned, KeplerRail, MoonRail, EllipseRail, BinaryPair,
      NBodyDynamic — mapeamento 1:1 dos regimes de orbits.js). **AC-01 (base), AC-04.**

### Wave 3 — Taxonomia
- [x] T-CC-04 `celestial/stars.js`: Star superclasse + MainSequenceStar, RedGiant,
      RedSupergiant, WhiteDwarf, BrownDwarf, NeutronStar, BlackHole. Defaults
      derivados de massa; overrides explícitos. **AC-02, AC-03, AC-06.**
- [x] T-CC-05 `celestial/planets.js`: Planet (kinds atuais + atmosfera + anéis),
      Moon, Comet (elipse excêntrica + coma + cauda anti-solar ∝ 1/r). **AC-04, AC-09.**

### Wave 4 — Montagem declarativa
- [x] T-CC-06 `celestial/system.js` (builder único: bodies + decorações [envelope,
      pluma, remanescente, corrente de acreção] + beacon + culling + fx ticker) +
      `universe.js` (5 sistemas como dados, valores retro-calculados de config.js) +
      `bodies.js` fachada (<80 linhas; mantém buildSolarSystem/updateBodyFX/
      updateSOIView). Deletar as 5 funções bespoke. `gravity.js`/`orbits.js` com
      diff VAZIO. **AC-01, AC-05, AC-06, AC-07.**

### Wave 5 — Prova de reuso
- [x] T-CC-07 Cometa "Halley" no Sistema Solar + 6º sistema demo "Véu" (RedGiant +
      WhiteDwarf em BinaryPair + cometa) 100% dados em universe.js. **AC-08, AC-09.**

### Wave 6 — Verificação
- [x] T-CC-08 `npm run test:space-war:unit` + smoke Playwright space-war verdes;
      dev server up + registrado (`dadaia server register`); screenshots de sanidade
      (solar, binário, core, demo). QA review no fim da onda. **AC-07, AC-10.**

---

## Evidence

- Diff vazio em `gravity.js`/`orbits.js` (`git diff --stat` na review).
- Saída dos testes node + Playwright anexada na review de QA.
- Screenshots em `.dadaia/tmp/` referenciadas no handoff.
