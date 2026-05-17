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

1. **Phaser.js 2D** (`tauan-trex`) — primeiro contato com game loop, input, física simples.
2. **Three.js 3D** (`aero-fighters`, hoje Aero Strike) — modularização ES module, geometria
   procedural, materiais PBR, sombras, fog, skybox.
3. **Unreal Engine 5** (`aero-fighters-v2`, futuro) — engine industrial, Blueprints,
   Niagara, Nanite, Lumen, build pipeline real.

Cada degrau só faz sentido depois que o anterior está estabilizado. A migração para UE5
não deve começar enquanto a release `aero-fighters-mission-realism-v1` estiver in-progress.

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

A release `aero-fighters-qa-hardening-v1` (já arquivada) estabeleceu uma harness Playwright
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
