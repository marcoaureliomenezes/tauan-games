---
slug: tech-stack
title: Tech Stack
category: core
tldr: Stack comprometida por jogo — 5 jogos web em src/web-games (Three.js r165 / WebGL2 puro), assets CC0 vendorizados.
summary: "Engine comprometida de cada jogo web, princípios de stack (sem build, vendor local, zero TS), stack de testes com a política medida no CI (v0.10.0: workers:1, testIgnore + jobs dedicados, run-start clean, polling) e padrão de deploy."
tags:
  - tech-stack
  - engines
  - testing
token_estimate: 0
last_updated: "2026-08-12"
release_origin: v0.10.0
---

## Stack comprometida por jogo

### Grupo `src/web-games/`

| Jogo | Engine | Versão | Justificativa |
|------|--------|--------|---------------|
| aero-fighters | Three.js (Degrau 2) | r165 (`vendor/three.module.min.js`) | 3D em browser; ~30 módulos ES. |
| james-bond | Three.js (Degrau 2) + Yuka 0.7.8 + Howler 2.2.4 (vendor) | r165 | FPS com navegação A* e áudio Web Audio. |
| space-war (⚠ raiz) | Three.js (Degrau 2) | r165 | Física real documentada; `celestial/` testável em node. |
| speed-run | Three.js (Degrau 2) + GLTFLoader | r165 | Corrida arcade; GLB Quaternius CC0. |


## Princípios de stack

- **Sem build step nos jogos web** — `index.html` + JS direto no browser.
- **Assets: procedurais OU terceiros CC0 vendorizados** — modelos GLB
  (Quaternius via poly.pizza) em `vendor/models/` com `LICENSES.md`; emenda
  2026-07-18 à regra "tudo procedural": componentes de terceiros confiáveis são
  PREFERÍVEIS a reinventar (lei do operador).
- **Vendor local commitado** — testes exigem operação offline.
- **Zero TypeScript nos jogos web** — JS puro.
  procedural em código, headless CLI para import/teste/export.

## Testing stack

| Ferramenta | Uso |
|------------|-----|
| Playwright ^1.44 | Smokes + ACs de todos os jogos web (`tests/<jogo>/`, `TEST_PORT` p/ sessões concorrentes) |
| `npx serve` / `python3 -m http.server` | Servidor estático dos testes |

**Suíte e CI (v0.10.0, medido):** workers:1 (workers:2 inviável no runner —
SwiftShader); config raiz com `testIgnore` de james-bond/demolition-ball, que
rodam em workflows dedicados com `paths` filter (`james-bond-ci.yml`,
`demolition-ball-ci.yml`); `ci.yml` com `paths` + `concurrency:
cancel-in-progress`; run-start clean + teardown de pid garantido; polling
(`waitForFunction`) no lugar de sleeps fixos; `PW_GL_ARGS=1` opt-in (default
OFF — A/B negativo no CI).

## Padrão de deploy

- **Web** (`src/web-games/`): GitHub Pages via `.github/workflows/pages.yml`;
  hub `index.html` na raiz com um card por jogo.
  distribuição por GitHub Releases; export web WASM descartado (performance).

## Descartado / não adotado

| Opção | Razão |
|-------|-------|
| Kaboom.js / Babylon.js / Pygame / TS+bundler | como antes (maturidade/peso/browser/over-engineering) |
| Unity | desenvolvimento sem editor GUI é impraticável (comunidade) — agente não opera |
| Unreal 5 p/ corrida | editor-cêntrico + dezenas de GB + sem export web viável |
