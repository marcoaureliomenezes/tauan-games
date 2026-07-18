---
slug: tech-stack
title: Tech Stack
category: core
tldr: Stack comprometida por jogo — grupos src/web-games (Phaser/Three.js/DOM) e src/godot (Godot 4.7), assets CC0 vendorizados.
summary: Engine comprometida de cada jogo nos dois grupos de tecnologia, princípios de stack (sem build, vendor local, zero TS), stack de testes (Playwright + Godot headless) e padrão de deploy. Atualizado 2026-07-18 na reestruturação src/.
tags:
  - tech-stack
  - engines
  - testing
token_estimate: 0
last_updated: "2026-07-18"
release_origin: repo-restructure-src-20260718
---

## Stack comprometida por jogo

### Grupo `src/web-games/`

| Jogo | Engine | Versão | Justificativa |
|------|--------|--------|---------------|
| memoria-bichos | DOM puro (Degrau 0) | — | Jogo de cartas infantil; HTML/CSS/JS bastam. |
| tauan-trex | Phaser.js (Degrau 1) | 3.x (`vendor/phaser.min.js`) | Canvas, input e physics loop prontos; zero build. |
| aero-fighters | Three.js (Degrau 2) | r165 (`vendor/three.module.min.js`) | 3D em browser; ~30 módulos ES. |
| far-west | Three.js (Degrau 2) | r165 | Open-world procedural determinístico. |
| james-bond | Three.js (Degrau 2) + Yuka 0.7.8 + Howler 2.2.4 (vendor) | r165 | FPS com navegação A* e áudio Web Audio. |
| space-war (⚠ raiz) | Three.js (Degrau 2) | r165 | Física real documentada; `celestial/` testável em node. |
| speed-run | Three.js (Degrau 2) + GLTFLoader | r165 | Corrida arcade; GLB Quaternius CC0. |

### Grupo `src/godot/`

| Jogo | Engine | Versão | Justificativa |
|------|--------|--------|---------------|
| speed-run | Godot 4 (Degrau 3) | 4.7.1 (`~/.local/bin/godot4`) | VehicleBody3D + gráficos de engine real; decisão do operador 2026-07-18 após pesquisa (Unity/Unreal são editor-GUI-cêntricos; Godot opera por texto+CLI). |
| aero-fighters-v2 | Godot 4 (Degrau 3) | 4.x stable | Forward+ cabe em Iris Xe @1080p; cel-shading; OSM+SRTM. |

UE5 (Degrau 4) segue reservado — bloqueado por hardware.

## Princípios de stack

- **Sem build step nos jogos web** — `index.html` + JS direto no browser.
- **Assets: procedurais OU terceiros CC0 vendorizados** — modelos GLB
  (Quaternius via poly.pizza) em `vendor/models/` com `LICENSES.md`; emenda
  2026-07-18 à regra "tudo procedural": componentes de terceiros confiáveis são
  PREFERÍVEIS a reinventar (lei do operador).
- **Vendor local commitado** — testes exigem operação offline.
- **Zero TypeScript nos jogos web** — JS puro.
- **Godot sem editor GUI** — cenas `.tscn` texto + GDScript, construção
  procedural em código, headless CLI para import/teste/export.

## Testing stack

| Ferramenta | Uso |
|------------|-----|
| Playwright ^1.44 | Smokes + ACs de todos os jogos web (`tests/<jogo>/`, `TEST_PORT` p/ sessões concorrentes) |
| `npx serve` / `python3 -m http.server` | Servidor estático dos testes |
| `godot4 --headless` + env vars | Import, smoke com exit code (`CORRIDA_TEST=1`), screenshots (`CORRIDA_SHOT`) |
| `tests/probe.gd` (padrão sonda) | Medição empírica de convenções físicas da engine |

## Padrão de deploy

- **Web** (`src/web-games/`): GitHub Pages via `.github/workflows/pages.yml`;
  hub `index.html` na raiz com um card por jogo.
- **Godot** (`src/godot/`): binário Linux x64 via `godot4 --export-release`;
  distribuição por GitHub Releases; export web WASM descartado (performance).

## Descartado / não adotado

| Opção | Razão |
|-------|-------|
| Kaboom.js / Babylon.js / Pygame / TS+bundler | como antes (maturidade/peso/browser/over-engineering) |
| Unity | desenvolvimento sem editor GUI é impraticável (comunidade) — agente não opera |
| Unreal 5 p/ corrida | editor-cêntrico + dezenas de GB + sem export web viável |
| Godot web export (WASM) | 200 fps desktop → 15-20 browser documentado; desktop-first |
