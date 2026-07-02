---
slug: tech-stack
title: Tech Stack
category: core
tldr: Stack comprometida por jogo — ladder de 4 engines (Phaser, Three.js, Godot 4, UE5).
summary: Documenta a engine comprometida de cada jogo, os princípios de stack (sem build step, vendor local, zero TS), o stack de testes Playwright e o padrão de deploy. Portado do HTML legado em 2026-06-12 (migração pattern-1).
tags:
  - tech-stack
  - engines
  - testing
agent_tier: self-pull
token_estimate: 0
last_updated: "2026-06-12"
release_origin: aero-fighters-uplift-v1
---

## Stack comprometida por jogo

| Jogo | Engine | Versão | Justificativa |
|------|--------|--------|---------------|
| tauan-trex | Phaser.js (Degrau 1) | 3.60 (CDN) | Canvas, input e physics loop out-of-the-box; docs robustas; zero build step. |
| aero-fighters | Three.js (Degrau 2) | r165 (`vendor/three.module.min.js`, ES module) | 3D em browser; ES modules habilitam modularização em ~30 módulos `src/*.js`. |
| aero-fighters-v2 | Godot 4 (Degrau 3) | 4.x stable | 3D desktop indie; Forward+ cabe em Iris Xe @ 1080p; GDScript-first. Substituiu UE5 (deferido a Degrau 4) por restrição de hardware. **Trabalho PAUSADO em 2026-06-12 — foco voltou ao aero-fighters web.** |
| — | Unreal Engine 5 (Degrau 4) | 5.5 | Reservado para futuro; bloqueado por hardware (precisa RTX 3060 ou cloud GPU). |

## Princípios de stack

- **Sem build step** — jogos web são `index.html` + JS; abrem direto no browser.
- **Sem assets externos em runtime** — sprites, sons e modelos 3D são procedurais; zero dependência de load externo.
- **Vendor local commitado em `vendor/`** — libs de terceiros versionadas no repo; testes exigem operação offline (NFR-02 de testing-infra-v1).
- **Zero TypeScript nos jogos web** — JS puro, sem compilação.

## Testing stack

| Ferramenta | Versão | Uso |
|------------|--------|-----|
| Playwright (`@playwright/test`) | ^1.44 | Smoke tests + AC validation para todos os jogos |
| `npx serve` (fallback `python3 -m http.server`) | — | Static server no globalSetup dos testes |

## Padrão de deploy

- Jogos web (degraus 1–2): GitHub Pages (`gh-pages`, cada jogo em subpasta).
- Godot 4 (degrau 3): binário Linux x64 via `godot --export-release`; runs locais do operador.
- UE5 (degrau 4, futuro): executável standalone; bloqueado por hardware.

## Descartado / não adotado

| Opção | Razão |
|-------|-------|
| Kaboom.js | Menos maduro que Phaser |
| Babylon.js | Mais pesado que Three.js para o caso de uso |
| Pygame | Desktop only; objetivo é browser |
| TypeScript + bundler | Over-engineering para jogos simples; complica deploy estático |
