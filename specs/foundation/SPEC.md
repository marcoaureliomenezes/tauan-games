# Spec: Foundation — Arquitetura e Qualidade de Jogos

> **Status:** Aprovado
> **Versão:** 1.0
> **Escopo:** Princípios de arquitetura, design e qualidade que governam **toda** a implementação de jogos no tauan-games
> **Referências:** `specs/constitution.md`

---

## Contexto

Esta spec congela a arquitetura de implementação dos jogos do tauan-games. Ela existe para impedir que cada jogo reabra decisões sobre game loop, rendering, estado, organização de código e convenções visuais.

**Problema central a evitar:** jogos inconsistentes que cada um inventa seu próprio padrão de loop, estado, rendering e organização de arquivos, tornando manutenção e evolução impraticáveis.

---

## Requisitos de Arquitetura

### RF-ARCH-001: Game Loop com requestAnimationFrame
Every canvas-based game shall use `requestAnimationFrame` as the sole driver of the game loop. `setInterval` and `setTimeout` are prohibited for game logic timing.

### RF-ARCH-002: Separação update/render
The game loop shall call separate `update(deltaTime)` and `render(ctx)` functions. Update modifies state; render draws state. No rendering logic shall exist in update; no state mutation shall exist in render.

### RF-ARCH-003: Delta time frame-rate independente
All movement, speed and animation calculations shall be based on delta time derived from `requestAnimationFrame` timestamps, not on frame count assumptions.

### RF-ARCH-004: Estado explícito por jogo
Each game shall maintain a single explicit state object. Global mutable state outside this object is prohibited. State transitions must be explicit and validated.

### RF-ARCH-005: Game states canônicos
Each game shall implement at minimum three canonical game states: `start`, `playing`, and `gameOver`. Additional states are allowed per game spec.

### RF-ARCH-006: Input como intenção
Input event handlers shall record intent (e.g., `wantsToJump = true`) without mutating game state directly. The `update()` function consumes intent and clears it.

### RF-ARCH-007: Colisão AABB
Collision detection shall use Axis-Aligned Bounding Boxes. Hitboxes may be smaller than visual sprites to provide player-fair margins.

### RF-ARCH-008: Rendering via Canvas API
All dynamic game elements shall be rendered using Canvas 2D API. DOM manipulation is restricted to static UI overlays (score, messages, start/game-over screens).

### RF-ARCH-009: Auto-contenção por jogo
No game shall import or reference code from another game. Each game is a standalone unit under `games/<jogo-name>/`.

### RF-ARCH-010: Estrutura de arquivo canônica
Each simple game shall follow the canonical structure: `index.html`, `style.css`, `game.js`, and optionally `assets/`.

### RF-ARCH-011: Funções de draw por elemento
Each drawable game element shall have its own dedicated draw function (e.g., `drawDino(ctx, dino)`, `drawCactus(ctx, cactus)`).

### RF-ARCH-012: Persistência defensiva
All `localStorage` reads shall be wrapped in try/catch with sensible default fallbacks. Data corruption or unavailable storage shall not crash the game.

### RF-ARCH-013: Dificuldade progressiva explícita
Games that support progressive difficulty shall express it through explicit parameters (speed, spawn rate, etc.) that change over time or score, never randomly.

### RF-ARCH-014: Zero dependências externas
Simple games (HTML+CSS+JS) shall have zero external dependencies. No npm, no CDN imports, no frameworks, no libraries beyond Web APIs.

### RF-ARCH-015: Desenho procedural preferido
Character and element illustration shall prefer procedural Canvas drawing over sprite sheets when it yields better visual quality or smaller asset footprint. Sprite sheets are allowed when procedural drawing is impractical.

---

## Guardrails Anti-Slope Code

### RF-SLOPE-001: Sem lógica em event handlers
Input event handlers shall only record intent. Game logic in event handlers is prohibited.

### RF-SLOPE-002: Sem estado mutável global
Mutable state outside the explicit game state object is prohibited. Constants and configuration objects are allowed at module level.

### RF-SLOPE-003: Sem rendering em update
The `update()` function shall not draw to canvas. The `render()` function shall not modify game state.

### RF-SLOPE-004: Sem hardcoded magic numbers
Game parameters (speeds, positions, sizes, intervals) shall be named constants or configuration objects. Raw numeric literals in game logic are prohibited except for trivially obvious values (0, 1, -1).

### RF-SLOPE-005: Sem bypass de specs
If the implementation encounters a missing or conflicting behavior contract, it shall stop and update the specs instead of inventing behavior in code.

### RF-SLOPE-006: Revisão obrigatória ao alterar specs
Any task that edits files under `specs/` shall run a spec consistency review before completion. Remaining issues shall be logged in `z_bug_specs.md`.

---

## Requisitos de Qualidade

### RF-QA-001: Funciona nos 3 navegadores principais
Each game shall work correctly on Chrome 90+, Firefox 90+ and Safari 15+.

### RF-QA-002: FPS estável
Games shall maintain at least 30 FPS on mid-range hardware. The game loop shall handle frame drops gracefully without teleporting objects.

### RF-QA-003: Sem alert/prompt/confirm
Use of `alert()`, `prompt()` or `confirm()` is prohibited. All feedback to the player uses DOM overlays or canvas text rendering.

### RF-QA-004: Prevenção de comportamento padrão
Keyboard input that triggers browser default behavior (e.g., space bar scrolling) shall have `preventDefault()` called on relevant events.

### RF-QA-005: Responsividade mínima
The game canvas shall have a defined logical resolution. CSS scaling may adapt to window size, but the logical coordinate system remains fixed per game spec.

### RF-QA-006: Cleanup ao sair
When a game transitions to `gameOver` or `start`, all active animations, intervals and pending input states shall be reset cleanly.

---

## Convenções de Código

### RF-CONV-001: Nomenclatura JavaScript

| Elemento | Convenção | Exemplo |
|---|---|---|
| Variáveis e funções | camelCase | `gameSpeed`, `drawDino()` |
| Constantes de módulo | UPPER_SNAKE_CASE | `GRAVITY`, `JUMP_FORCE` |
| Classes / construtores | PascalCase | `GameObject`, `DinoCharacter` |
| IDs e classes CSS | kebab-case | `game-over-screen`, `score-display` |

### RF-CONV-002: Ordem do game.js
The `game.js` file shall follow this order:
1. Constants and configuration
2. State initialization
3. Input handling
4. Update logic
5. Rendering logic
6. Game loop
7. Initialization / bootstrap

### RF-CONV-003: Funções de draw são puras de rendering
Draw functions receive context and state, and only draw. They shall not modify state or trigger side effects.

### RF-CONV-004: CSS mínimo e funcional
`style.css` handles layout, typography, overlay positioning and canvas centering. It does not control game element appearance — that is Canvas territory.

### RF-CONV-005: HTML semântico mínimo
`index.html` shall contain: canvas element, overlay containers for start/game-over screens, and score display elements. No game logic in HTML attributes.

---

## Fora de Escopo desta Spec

- Detalhes comportamentais de cada jogo (ver `specs/features/<jogo>/SPEC.md`)
- Arquitetura Golang para jogos complexos
- CI/CD ou automação de testes
- Publicação ou distribuição de jogos
