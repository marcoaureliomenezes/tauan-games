# Spec: Feature — Tauansauro

> **Status:** Em revisão
> **Versão:** 1.0
> **Autor:** Marco Menezes
> **Referências:** `specs/SPEC.md`, `specs/constitution.md`, `specs/memory/architecture.md`, `specs/foundation/SPEC.md`

---

## Contexto

Tauansauro é o primeiro jogo do tauan-games. É um runner side-scrolling inspirado no Chrome Dino Game, mas com identidade visual própria, ciclo dia/noite e um dinossauro mais bem ilustrado — desenhado proceduralmente via Canvas API com animação de membros.

O jogador controla um dinossauro que corre automaticamente. O objetivo é sobreviver o máximo possível pulando obstáculos (cactos no chão e pterodáctilos voando). A dificuldade aumenta progressivamente com o score. O ciclo visual alterna entre dia e noite em milestones de pontuação.

**O que NÃO é este jogo:** Tauansauro NÃO é um quiz game. NÃO usa Speech Recognition. NÃO depende de APIs externas. É um runner puro com estética própria.

---

## Glossário

| Termo | Definição |
|---|---|
| **Tauansauro** | O dinossauro jogador; personagem principal do jogo |
| **Runner** | Gênero de jogo side-scrolling onde o jogador corre automaticamente e desvia de obstáculos |
| **Cacto** | Obstáculo terrestre posicionado no chão; varia em tamanho |
| **Pterodáctilo** | Obstáculo aéreo; voa em alturas variadas; exige timing diferente do cacto |
| **Ciclo dia/noite** | Transição visual automática do cenário baseada em milestones de score |
| **Fase do dia** | Período visual do cenário: `dia` (sol + nuvens) ou `noite` (lua + estrelas) |
| **Chão** | Superfície marrom alaranjada sobre a qual o dinossauro corre; scrolla horizontalmente |
| **Céu** | Fundo estático do jogo; não scrolla; alterna entre dia e noite |
| **High score** | Recorde de pontuação persistido entre sessões via localStorage |
| **Hitbox** | Caixa de colisão AABB usada para detecção de impacto; pode ser menor que o sprite visual |

---

## Usuários e Goals

### US-001: Jogar uma partida rápida

- **Como** jogador casual
- **Quero** abrir o jogo e começar a jogar imediatamente
- **Para** me divertir em sessões curtas sem necessidade de tutorial ou configuração

**Critérios de Aceite:**
- Dado que abro o jogo, quando a tela carrega, então vejo a tela de start com o Tauansauro e a mensagem para pressionar espaço
- Dado que estou na tela de start, quando pressiono espaço, então o jogo inicia e o dinossauro começa a correr
- Dado que estou jogando, quando pressiono espaço ou seta para cima, então o dinossauro pula

### US-002: Desviar de obstáculos e pontuar

- **Como** jogador
- **Quero** pular cactos e pterodáctilos para sobreviver mais tempo
- **Para** alcançar uma pontuação cada vez maior

**Critérios de Aceite:**
- Dado que o jogo está em andamento, quando cactos aparecem da direita, então posso pular para desviar
- Dado que o jogo está em andamento, quando pterodáctilos aparecem em alturas variadas, então posso pular ou agachar para desviar (conforme a altura)
- Dado que desvio com sucesso de um obstáculo, então o score incrementa
- Dado que colido com um obstáculo, então o jogo termina (game over)

### US-003: Ver o ciclo dia/noite

- **Como** jogador
- **Quero** ver o cenário alternar entre dia e noite
- **Para** ter uma experiência visual dinâmica que reflete meu progresso

**Critérios de Aceite:**
- Dado que estou jogando, quando atinjo o milestone de score X, então o cenário transita de dia para noite ou vice-versa
- Dado que é dia, então o céu exibe sol e nuvens
- Dado que é noite, então o céu exibe lua e estrelas

### US-004: Ver e bater meu recorde

- **Como** jogador
- **Quero** ver meu high score e tentar superá-lo
- **Para** ter motivação para jogar novamente

**Critérios de Aceite:**
- Dado que tenho um high score salvo, quando abro o jogo, então vejo o high score na tela
- Dado que meu score atual supera o high score, quando o jogo atualiza, então o high score é atualizado em tempo real
- Dado que faço um novo recorde, quando o jogo termina, então o high score é persistido via localStorage

### US-005: Recomeçar após game over

- **Como** jogador
- **Quero** reiniciar rapidamente após perder
- **Para** tentar novamente sem fricção

**Critérios de Aceite:**
- Dado que o jogo terminou, quando vejo a tela de game over, então há opção clara de reiniciar
- Dado que estou na tela de game over, quando pressiono espaço, então o jogo reinicia com estado limpo

---

## Requisitos Funcionais

### Game States

- FR-001: The game shall have exactly three states: `start`, `playing` and `gameOver`.
- FR-002: The `start` state shall display the Tauansauro character, the game title and a "Press Space to Start" message.
- FR-003: The `playing` state shall run the game loop with the dino running, obstacles spawning, ground scrolling and score incrementing.
- FR-004: The `gameOver` state shall display the final score, the high score and a "Press Space to Restart" message.
- FR-005: Transitioning from `gameOver` to `playing` shall reset all game state (score, obstacles, dino position, speed) to initial values.

### Dinossauro (Tauansauro)

- FR-006: The dino shall be drawn procedurally via Canvas API with detailed illustration superior to the Chrome Dino sprite.
- FR-007: The dino shall have a running animation with alternating leg movement while on the ground.
- FR-008: The dino shall have a jumping animation when airborne (legs extended or tucked).
- FR-009: The dino shall be positioned on the ground by default and jump when the player presses space or up arrow.
- FR-010: The jump shall follow a parabolic arc controlled by gravity and jump force constants.
- FR-011: The dino shall not be able to jump while already airborne (no double jump).
- FR-012: The dino shall not be able to jump during the `start` or `gameOver` states.
- FR-013: The dino hitbox shall be slightly smaller than its visual representation to provide fair collision margins.

### Obstáculos — Cactos

- FR-014: Cactus obstacles shall spawn from the right edge of the canvas and move leftward at game speed.
- FR-015: Cacti shall appear in at least two size variations: small (single) and large (tall or grouped).
- FR-016: Cacti shall always be positioned on the ground (bottom-aligned).
- FR-017: Cactus spawn timing shall include random intervals within a defined minimum and maximum gap.

### Obstáculos — Pterodáctilos

- FR-018: Pterodactyl obstacles shall spawn from the right edge of the canvas and move leftward at game speed.
- FR-019: Pterodactyls shall appear at varying flight heights: low (requires jump), mid (requires jump or duck), and high (can be passed without action).
- FR-020: Pterodactyls shall have a wing-flapping animation drawn procedurally via Canvas.
- FR-021: Pterodactyls shall only begin appearing after the player reaches a minimum score threshold (to avoid overwhelming new players).
- FR-022: A pterodactyl's flight height shall be randomly selected from the defined height tiers at spawn time.

### Colisão

- FR-023: Collision detection shall use AABB (Axis-Aligned Bounding Boxes) between the dino's hitbox and each obstacle's hitbox.
- FR-024: Collision with any obstacle shall immediately transition the game to `gameOver` state.
- FR-025: Hitboxes shall be smaller than visual sprites by a fairness margin defined per element type.

### Chão

- FR-026: The ground shall be rendered as a horizontal surface with marrom alaranjado (orange-brown) coloring.
- FR-027: The ground shall scroll leftward at game speed to create the illusion of forward movement.
- FR-028: The ground texture shall tile seamlessly for continuous scrolling.
- FR-029: The ground shall have a distinct top line or edge to visually separate it from the sky.

### Céu e Ciclo Dia/Noite

- FR-030: The sky (background) shall be static — it does NOT scroll.
- FR-031: The game shall alternate between two sky phases: `dia` (day) and `noite` (night).
- FR-032: During `dia`, the sky shall display a sun and clouds.
- FR-033: During `noite`, the sky shall display a moon and stars.
- FR-034: The transition between `dia` and `noite` shall be triggered automatically at score milestones.
- FR-035: The first transition milestone shall occur at 200 points, alternating every 200 points thereafter (200 = noite, 400 = dia, 600 = noite, etc.).
- FR-036: The transition shall be a smooth visual crossfade over a defined duration (not an instant swap).
- FR-037: Clouds (during dia) and stars (during noite) shall be static decorative elements, not interactive.

### Pontuação

- FR-038: The score shall increment continuously while the game is in `playing` state.
- FR-039: The score increment rate shall be based on distance traveled, not on time alone.
- FR-040: The score shall be displayed during `playing` and `gameOver` states.
- FR-041: Score display shall use a pixel/arcade-style font rendered via Canvas or a web-safe monospace fallback.

### High Score

- FR-042: The high score shall be persisted via `localStorage` with key `tauansauro_highScore`.
- FR-043: The high score shall be loaded on game start with a defensive try/catch fallback to 0.
- FR-044: The high score shall be displayed alongside the current score during `playing` and `gameOver` states.
- FR-045: When the current score exceeds the high score, the high score display shall update in real time and flash or indicate a new record visually.
- FR-046: On game over, if the current score exceeds the stored high score, the new value shall be written to `localStorage`.

### Dificuldade Progressiva

- FR-047: Game speed shall increase progressively as the score increases.
- FR-048: The speed increase shall follow a defined curve (e.g., linear with a cap) governed by named constants.
- FR-049: Obstacle spawn frequency shall increase with game speed (shorter gaps between obstacles at higher speeds).
- FR-050: There shall be a maximum speed cap to keep the game playable.

### Controles

- FR-051: The player shall jump by pressing Space or ArrowUp.
- FR-052: The browser's default behavior for Space (scroll) and ArrowUp (scroll) shall be prevented during gameplay.
- FR-053: Key events shall be captured on `keydown` for jump triggering.
- FR-054: Only the first keypress while grounded shall trigger a jump; holding the key shall not produce repeated jumps.

### Visual e Estilo

- FR-055: The dino character shall be drawn with more detail and personality than the Chrome Dino — expressive eyes, defined body shape, visible limbs with animation.
- FR-056: The overall color palette shall be warm: orange-brown ground, blue sky (dia) or dark blue/purple sky (noite), green cacti, brown/gray pterodactyls.
- FR-057: The game canvas shall have a fixed logical resolution defined by named constants.
- FR-058: The canvas shall be centered on screen with a clean, minimal surrounding style.

---

## Requisitos Não-Funcionais

- NFR-001: [Performance] The game shall maintain at least 30 FPS on mid-range hardware (2020+ laptop with integrated graphics).
- NFR-002: [Usabilidade] The game shall be immediately playable without instructions beyond the start screen message.
- NFR-003: [Acessibilidade] The game shall be playable using only keyboard. Touch support is optional for v1.0.
- NFR-004: [Compatibilidade] The game shall work on Chrome 90+, Firefox 90+ and Safari 15+.
- NFR-005: [Offline] The game shall be fully playable offline after initial page load. No network requests during gameplay.
- NFR-006: [Tamanho] The total game payload (HTML + CSS + JS, excluding external fonts) shall be under 50KB uncompressed.
- NFR-007: [Justiça] Collision hitboxes shall be forgiving — slightly smaller than visual sprites — to give the player a fair experience.

---

## Parâmetros de Jogo (Valores Iniciais Sugeridos)

| Parâmetro | Valor sugerido | Tipo |
|---|---|---|
| Canvas logical width | 800px | constant |
| Canvas logical height | 300px | constant |
| Ground Y position | 250px | constant |
| Initial game speed | 300px/s | constant |
| Max game speed | 700px/s | constant |
| Speed increase rate | +10px/s per 100 score | constant |
| Jump force | -700px/s (upward) | constant |
| Gravity | 2500px/s² | constant |
| Score milestone for day/night switch | 200 points | constant |
| Pterodactyl minimum score | 300 points | constant |
| Min obstacle gap | 400px | constant |
| Max obstacle gap | 900px | constant |
| Hitbox shrink margin | 6px per side | constant |
| Day/night transition duration | 1000ms | constant |

> Estes valores são sugestões iniciais. O refinamento visual e de jogabilidade pode ajustá-los durante implementação, desde que permaneçam como constantes nomeadas (nunca magic numbers).

---

## State Machine Visual

```
          Space (start)
  START ──────────────────▶ PLAYING
    ▲                          │
    │                          │ collision
    │                          ▼
    │                      GAME OVER
    │                          │
    └──────────────────────────┘
                         Space (restart)
```

---

## Estrutura de Arquivos

```
games/tauansauro/
├── index.html
├── style.css
└── game.js
```

Nenhum diretório `assets/` é necessário — todos os elementos visuais são desenhados proceduralmente via Canvas.

---

## Fora de Escopo (v1.0)

- Duck/agachar como mecânica de desvio (pterodáctilos altos podem ser ignorados, baixos exigem pulo)
- Touch/mobile controls
- Som e música
- Power-ups ou coletáveis
- Modo multiplayer
- Leaderboard online
- Salvar estado de partida em andamento
- Seleção de dificuldade manual
- Customização do personagem

---

## Questões Abertas

1. O dinossauro deve ter expressão facial (olhos piscando, reação ao game over)? **Sugestão:** sim, para dar mais personalidade — a decidir no refinamento visual.
2. Os cactos devem ter variação de cor (verde claro / verde escuro) ou apenas tamanho? **Sugestão:** variação de tamanho apenas — a decidir no refinamento visual.
3. O pterodáctilo deve ter sombra projetada no chão como indicador visual? **Sugestão:** sim — a decidir no refinamento visual.
