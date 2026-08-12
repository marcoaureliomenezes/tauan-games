---
title: "Backlog — Future (direção estratégica de médio/longo prazo)"
status: idea
opened: 2026-08-11
description: >-
  Notas de direção estratégica de médio/longo prazo para o repositório
  tauan-games (ladder das engines, identidade visual, distribuição, qualidade,
  coordenação multi-agente). Não são features prontas para virar release.
---

# Backlog — Future

Ideias e direcionamentos de médio/longo prazo para o repositório `tauan-games`. Não são
features prontas para virar release — são notas de direção estratégica para o produto
como um todo.

## Convenções

- Diferente de `ideas.md` (frases curtas) e `candidates.md` (linhas formatadas), este
  arquivo permite seções livres com discussão narrativa.
- Quando um item amadurecer e ganhar contorno de feature, mover para `candidates.md`.

---

## Ladder das três engines

O repositório segue uma ladder pedagógica de complexidade crescente:

1. **Phaser.js 2D** — degrau didático 2D (game loop, input, física simples); sem jogo
   ativo desde a remoção do `tauan-trex` (v0.6.0, 2026-08-10).
2. **Three.js 3D** (`aero-fighters`, hoje Aero Strike) — modularização ES module, geometria
   procedural, materiais PBR, sombras, fog, skybox.
3. **Unreal Engine 5** — degrau industrial reservado (Blueprints, Niagara, Nanite,
   Lumen, build pipeline real); bloqueado por hardware.

Cada degrau só faz sentido depois que o anterior está estabilizado. A migração para UE5
não deve começar enquanto a release `v0.0.5` estiver in-progress.

## Identidade visual do repositório

Hoje cada jogo tem sua própria estética (T-Rex monocromático pixel; Aero Strike facetado
moderno). Faltam:
- Logo do repositório (proposta: um aviãozinho minimalista monocor).
- Página de landing em `index.html` listando os jogos com thumbnails.
- Palette compartilhada entre jogos (decisão futura — não bloqueante).

## Distribuição

- Hoje: jogos rodam em `npx serve` localmente.
- Próximo passo: GitHub Pages no branch `gh-pages`, cada jogo em subpasta. Já mencionado em
  `memory/tech-stack.html` mas ainda não implementado como release.
- Longo prazo: empacotamento para PWA (instalável no tablet do Tauan).

## Qualidade

A release `v0.0.4` (já arquivada) estabeleceu uma harness Playwright
robusta para o Aero Strike. Direção futura:
- Estender a harness para todos os jogos com smoke tests + critério "Tauan-friendly".
- Capturar regressões visuais (visual regression / screenshot diff) — candidata em
  `candidates.md`.
- Tempo de carregamento alvo: jogo jogável em menos de 2s no tablet do Tauan.

## Coordenação multi-agente

O repositório agora é território exclusivo dos três agentes `game-*` (game-developer,
game-designer, game-tester) per `.claude/rules/game-developer-scope.md`. Direção futura:
- Cada release deve ter contribuições rastreáveis dos três sub-domínios (lógica / design /
  testes) — não só "game-developer faz tudo".
- product-engineer é tie-breaker em divergências (matriz em
  `.claude/rules/game-agents-coordination.md`).

## Curadoria (2026-08-11, project-manager)

Normalização BL-SCHEMA: arquivo de notas sem frontmatter falhava o doctor; adicionado
frontmatter canônico com `status: idea` (notas não-vinculadas, isentas de intents).
Conteúdo original preservado.
