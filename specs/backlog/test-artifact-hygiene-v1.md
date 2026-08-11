---
title: "Higiene de artefatos de teste — lixo de execução nunca consumido e nunca deletado (INADMISSÍVEL)"
status: candidate
opened: 2026-08-11
description: >-
  A suíte gera artefatos sem consumidor e sem política de retenção; o disco acumula
  lixo de execução indefinidamente. Medido em 2026-08-11:
  src/web-games/tests/screenshots/ cresceu de 5,5 MB para 75 MB em um único dia;
  pid files órfãos chegam a abortar runs futuros. O operador classificou:
  inadmissível.
intents:
  - subject:
      kind: doc
      ref: memory/architecture.md#macro-1-arquitetura-dos-web-games-srcweb-games
    change: >-
      Higiene de artefatos da suíte de testes de src/web-games/ — (1)
      tests/globalSetup.js: limpar artefatos da execução anterior no início do run
      (screenshots/, playwright-report/, test-results/, pid files mortos) — política
      run-start clean; (2) tests/globalTeardown.js: garantir remoção do
      .server-*.pid mesmo em morte anormal do processo (trap/finally), eliminando a
      classe de pid órfão; (3) tests/ specs com page.screenshot incondicional: todo
      artefato escrito deve ter consumidor definido (upload no CI em falha, ou
      inspeção local documentada) OU não ser escrito — screenshots de caminho feliz
      sem consumidor são proibidos; (4) src/web-games/.gitignore: cobrir todos os
      dirs de artefatos gerados (defesa em profundidade, não permissão de acumular).
---

# Higiene de artefatos de teste — lixo de execução nunca consumido e nunca deletado (INADMISSÍVEL)

## Description

A suíte gera artefatos sem consumidor e sem política de retenção; o disco acumula lixo
de execução indefinidamente. Medido em 2026-08-11: `src/web-games/tests/screenshots/`
cresceu de 5,5 MB para 75 MB EM UM ÚNICO DIA de execuções (untracked, jamais limpo,
jamais consumido); `tests/playwright-report/` (516 KB) regenerado a cada run e nunca
removido; 6 arquivos `.server-*.pid` órfãos de runs crashados — e um pid file órfão com
porta ocupada faz `globalSetup.js:35` ABORTAR runs futuros (o lixo não é só desperdício,
quebra execução). O operador classificou: inadmissível.

## Mudanças propostas (detalhe por alvo)

1. `src/web-games/tests/globalSetup.js` — limpar artefatos da execução anterior no
   início do run (screenshots/, playwright-report/, test-results/, pid files mortos) —
   política run-start clean.
2. `src/web-games/tests/globalTeardown.js` — garantir remoção do `.server-*.pid` mesmo
   em morte anormal do processo (trap/finally), eliminando a classe de pid órfão.
3. `src/web-games/tests/` (specs com `page.screenshot` incondicional) — todo artefato
   escrito deve ter consumidor definido (upload no CI em falha, ou inspeção local
   documentada) OU não ser escrito; screenshots de caminho feliz sem consumidor são
   proibidos.
4. `src/web-games/.gitignore` — cobrir todos os dirs de artefatos gerados (defesa em
   profundidade, não permissão de acumular).

## Evidence

- Report: `.dadaia/reports/tauan-games/qa-engineer/2026-08-11T180616Z-test-runtime-efficiency-both-repos.html`
- Handoff: `.dadaia/handoff/tauan-games/2026-08-11T180616Z-qa-engineer-test-runtime-efficiency-both-repos.handoff.json`

## Acceptance criteria

Após um run completo da suíte, o working tree fica limpo (`git status`) e nenhum
artefato de run anterior sobrevive ao início do run seguinte; zero pid files órfãos
após `kill -9` de um run.
