---
title: demolition-ball-city-uplift-v1
status: idea
opened: 2026-08-11
description: Uplift completo do Demolition Ball (opus-5) — cidade rica e viva, espaço com homing no alvo, acessível para criança de 3 anos, equipe auxiliar de cones.
---

# demolition-ball-city-uplift-v1

Demanda do operador (2026-08-11), escopo verbatim. O jogo foi construído em 1 shot;
o trator + bola de demolição estão ótimos e NÃO devem ser refeitos — movimentos bons,
manter. O que melhorar (todos obrigatórios):

## 1. Mapa / cidade muito mais trabalhada
- Prédios com janelas e portas de verdade (hoje: bandas procedurais simples no shader,
  `src/web-games/demolition-ball/src/shaders.js`).
- Pedestres andando nas calçadas.
- Carros circulando melhorados (visual e comportamento).
- Praças, árvores, flores, prédios, pontes, casas — cidade viva.
- Sol, céu e nuvens melhorados (hoje: gradiente + disco de sol, sem nuvens).

## 2. Espaço = movimento de destruição com homing
- Ao segurar `ESPAÇO`, a bola entra em movimento orientado à destruição: busca o
  prédio alvo do contrato; se não houver alvo, busca carros passando na rua.
- Revisar o pump atual (`rig.js` — impulso tangencial fixo na direção da lança) e
  torná-lo orientado ao alvo.
- O cabo (`Z`/`X`) e o ângulo da torre/lança (`Q`/`E`) continuam manuais.

## 3. Acessível para criança de 3 anos
- Destruir o alvo deve ser fácil (hoje: thresholds 80–90%, prazos, multa colateral
  em `missions.js` — punitivo demais para criança).

## 4. Equipe auxiliar de isolamento
- Ao chegar no alvo da demolição, aparece um botão (tecla/clique).
- Ao acionar: um carro auxiliar chega, desce um homem ajudante, ele coloca cones
  ao redor da área e o tráfego é bloqueado no trecho.

## Restrições (inspecionadas)
- Manter identidade WebGL2 puro do jogo (sem engine, sem CDN, sem build) — regra do
  repo: vendor local apenas. Única dependência candidata: `snoise` MIT (webgl-noise)
  para nuvens procedurais.
- Não refazer trator/bola/pêndulo — apenas estender.

## 5. Operador visível na cabine (escopo "Plus", operador 2026-08-11)
- Ver o operador (que representa o jogador) dirigindo o trator da bola de demolição —
  personagem procedural na cab, no padrão visual do renderer.

## Decisões do grill-me (2026-08-11 — relatório + handoff validados)

- **ADR-1 (modos)**: dois modos na tela inicial — **Modo Tauan** (sem prazo, sem multa,
  threshold ~50%, um alvo por vez, botões grandes) e **Modo Contratos** (jogo atual).
- **ADR-2 (homing)**: ESPAÇO segurado = servo de velocidade buscando o alvo (sem alvo →
  carro mais próximo); `Q/E` e `Z/X` manuais; assistência mais forte no Modo Tauan.
  Validado em spike com o Rig real: 8 impactos/25s, 1º impacto ~1,1s (atual: 2/25s).
- **ADR-3 (equipe)**: perto do alvo aparece "CHAMAR EQUIPE 🚧"; furgão chega, ajudante
  desce e coloca cones; tráfego para no quarteirão até o alvo cair; 1× por contrato.
- **ADR-4 (rio)**: rio real cruzando a cidade com 2–3 pontes (cidade hoje não tem água).
- **ADR-5 (engine)**: permanecer WebGL2 puro; única dependência nova = `snoise` MIT vendor.
- **ADR-6 (operador)**: figura do operador na cabine (procedural, acompanha o slew).

## Motivation

Jogo para o filho de 3 anos do operador jogar; cidade precisa encantar visualmente
e a destruição precisa ser acessível (homing) sem perder a física de pêndulo que
já é o charme do jogo.

## Acceptance criteria (rascunho — detalhar na release-definition)

- Cidade com pedestres, fachadas detalhadas (janelas/portas), vegetação variada,
  rio com pontes, céu com sol e nuvens — validado por screenshots Playwright.
- Segurar espaço leva a bola a atingir o alvo (ou carros, sem alvo) em poucos
  segundos, com cabo e lança ainda manuais — validado por teste e2e.
- Criança consegue derrubar o alvo do contrato 1 sem ler nem cronometrar (Modo Tauan).
- Botão/tecla no alvo convoca furgão + ajudante + cones; tráfego para no trecho.
- Operador visível na cabine ao jogar.
- Baseline verde: unit (`tests/demolition-ball/unit.mjs`) + e2e Playwright.

## Estado da descoberta (2026-08-11)

- Scan completo do código (3.064 LOC, 14 módulos) + screenshots Playwright + baseline
  18 unit / 6 e2e verdes. Jogo NÃO consta em `specs/memory/product/games-catalog.md`
  (gap a cobrir na release-definition).
- Grill-me CONCLUÍDO: 4/4 respostas + escopo Plus. Relatório:
  `.dadaia/reports/tauan-games/product-engineer/2026-08-11T150217Z-refine-specs.html`;
  handoff validado em `.dadaia/handoff/tauan-games/2026-08-11T150424Z-…`.
- Próximo estágio SDD: release-definition (SPEC/PLAN/TASKS).
