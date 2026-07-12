---
slug: quality-assurance
title: Quality Assurance
category: core
tldr: QA standards, anti-slop rules, and test discipline for this workspace.
summary: Documents QA standards, anti-slop laws, test discipline (TDD, no fabricated tests), and the pre-commit/pre-push gate sequence.
tags:
  - quality-assurance
  - testing
  - anti-slop
token_estimate: 0
last_updated: "2026-06-12"
release_origin: aero-fighters-uplift-v1
---

## Visão geral

- Todo jogo tem ao menos um smoke Playwright em `tests/<jogo>/` validando boot sem
  console errors; releases não fecham sem a suíte do jogo afetado verde
  (`npm run test:aero:qa` ou equivalente).
- Operação offline obrigatória nos testes (vendor local, sem CDN — NFR-02 de
  `testing-infra-v1`).
- Anti-slop: sem testes fabricados que apenas espelham a implementação; um teste novo
  deve validar comportamento observável do jogo (AC do SPEC).
- Critério de jogabilidade (ver [[quality-bar]]): sem loading visível, sem erros no
  console, controles descobertos em segundos.
