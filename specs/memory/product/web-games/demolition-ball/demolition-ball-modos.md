---
slug: demolition-ball-modos
title: Demolition Ball — modos de jogo
category: product
tldr: Modo Tauan (sem prazo/multa, 1 alvo, threshold 0.5, dano x2.5, homing forte) vs Modo Contratos (jogo original); seleção no overlay, trava ao começar.
summary: Os dois modos da v0.9.0 (ADR-1), como o MissionSystem é parametrizado e o que cada modo muda.
tags: [product, demolition-ball, modos, acessibilidade]
token_estimate: 0
last_updated: "2026-08-11"
release_origin: v0.9.0
---

## Os dois modos (`src/modes.js`)

| Parâmetro | 🧒 Tauan (padrão) | 💼 Contratos |
|---|---|---|
| Prazo (deadline) | nunca | `spec.time` do contrato |
| Multa colateral | não | sim (45 $/célula) |
| Alvos por contrato | 1 (força `singleTarget`) | `spec.count` |
| Threshold | 0.5 fixo | `spec.threshold` (0.8–0.9) |
| Dano da bola | ×2.5 (`world.damageMultiplier`) | ×1 |
| Homing (ESPAÇO) | gain 2.6 / cap 34 m/s² / cruise 15 | gain 2.0 / cap 26 / cruise 14 |

## Leis

- Seleção só no overlay inicial; `selectMode()` reconstrói o `MissionSystem`
  (re-rola a cadeia) e **trava quando o jogo começa**.
- `MissionSystem(structures, seed, opts)` — o modo entra por opts
  (`singleTarget`, `thresholdOverride`, `deadlines`, `collateralFines`);
  o Modo Contratos usa exatamente os defaults do jogo original.
- Homing (ADR-2): servo de VELOCIDADE com aceleração horizontal limitada em
  `rig.stepBall`; alvo = estrutura corrente do contrato, senão o carro mais
  próximo; `Q/E`/`Z/X` permanecem manuais; SHIFT segue impulso reverso clássico.
- Contratos 1–2 têm `time: 0` por design (sem cronômetro) mesmo no Modo
  Contratos — testes não devem assumir deadline > 0 no contrato 1.
