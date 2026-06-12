---
slug: quality-bar
title: Barra de qualidade
category: product
tldr: Objetivos de produto e critérios de qualidade não-negociáveis dos jogos.
summary: Jogos realmente jogáveis para o Tauan, validados por Playwright antes da revisão do operador, operando offline e sem regressão entre releases. Portado do HTML legado em 2026-06-12.
tags:
  - product
  - quality
agent_tier: self-pull
token_estimate: 0
last_updated: "2026-06-12"
release_origin: aero-fighters-uplift-v1
---

## Propósito

- Criar jogos realmente jogáveis para Tauan — não demos, não protótipos descartáveis.
- Capturar a experiência sensorial de jogos de referência (Chrome Dino, Aero Fighters
  Assault N64) e adaptá-la ao público-alvo.
- Todo jogo passa em testes Playwright automatizados antes da revisão final do operador.
- Publicar jogos online (GitHub Pages) quando atingem maturidade visível ao jogador.

## Diferencial

Critérios de qualidade não-negociáveis:

- **Imediatamente jogável** — sem tela de loading visível, sem erros no console,
  controles simples descobertos em segundos.
- **Smoke Playwright passando** — todo jogo tem ao menos um smoke em `tests/<jogo>/`
  validando boot sem console errors.
- **Operação offline** — vendor local de libs, sem CDN/rede em runtime (NFR-02 de
  `testing-infra-v1`).
- **Sem regressão entre releases** — toda release roda a suíte do jogo afetado
  (`npm run test:aero:qa` ou equivalente) antes de fechar.

## Fluxo de uso

Toda evolução de jogo entra como release em `specs/releases/<release-id>/` com tripleto
SPEC + PLAN + TASKS aprovado pelo operador. Releases não passam por CLOSURE até a QA
suite do jogo afetado passar e o TASKS.md ter critérios de conclusão marcados.
