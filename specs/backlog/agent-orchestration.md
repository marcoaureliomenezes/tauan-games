---
title: "Agent Orchestration — notas vivas de coordenação"
status: idea
opened: 2026-08-11
description: >-
  Documento vivo (não é spec nem feature) para registrar atritos, decisões de
  orquestração e ajustes de matriz de autoridade dos agentes game-* observados
  durante releases deste repositório.
---

# Backlog — Agent Orchestration

Notas sobre coordenação dos agentes que atuam neste repositório. Não é spec — é um
documento vivo para registrar atritos, decisões de orquestração e ajustes de matriz de
autoridade observados durante releases.

## Agentes autorizados em `repos/tauan-games/`

| Agente | Sub-domínio | Escreve |
|---|---|---|
| `game-developer` | Lógica | C++/JS/Blueprints (gameplay), IA, física, balística, mecânicas |
| `game-designer` | Design | Assets estáticos/procedurais, materiais, mapas, áudio, scripts de pipeline |
| `game-tester` | Testes | Scripts Playwright/UE5 automation, reports HTML com evidências |

Demais agentes (`product-engineer`, `software-architect`, `software-engineer`,
`devops-engineer`, etc.) podem **ler** arquivos deste repo para contexto mas **não
escrevem**. Exceção: o `product-engineer` é o guardião exclusivo de `specs/` e pode
editar specs/PLAN/TASKS deste repo, sem tocar em código de jogo.

## Tie-breakers conhecidos

- Decisões UE5-específicas: `game-developer` vence sobre `software-architect`.
- Conflito entre `game-developer` e `game-designer` em assets que afetam gameplay (ex.:
  hitbox de inimigo, layout de mapa que afeta missão): `product-engineer` decide.
- Critério "Tauan-friendly" (criança consegue jogar): autoridade final de `game-tester`,
  porque ele tem o teste automatizado.

## Atritos registrados

(vazio — popular conforme ocorrer)

## Curadoria (2026-08-11, project-manager)

Normalização BL-SCHEMA: arquivo de notas sem frontmatter falhava o doctor; adicionado
frontmatter canônico com `status: idea` (notas não-vinculadas, isentas de intents).
Conteúdo original preservado.
