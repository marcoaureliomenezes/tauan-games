# PLAN.md — Tauansauro v0.0.1

**Feature:** Implementação do jogo Tauansauro (runner side-scrolling)  
**Versão:** 0.0.1  
**Status:** Aprovado  
**Baseado em:** `specs/SPEC.md`, `specs/foundation/SPEC.md`, `specs/features/tauansauro/SPEC.md`  

---

## 1. Decisões Técnicas Congeladas

| Categoria | Decisão | Justificativa |
|---|---|---|
| Canvas size | 900x300px | Mais espaço horizontal que o Chrome Dino, permite melhores composições visuais |
| Delta time | Normalizado a 60fps (dt/16.67) | Simplifica cálculos de física sem perder frame-independência |
| Dino drawing | T-Rex estilizado com corpo arredondado, cauda, braços pequenos, olhos expressivos | Mais personalidade que o pixel art do Chrome |
| Dino animation | 2-frame leg cycle (corrida), 1 pose pulo, 1 pose game over | Suficiente para fluidez sem complexidade excessiva |
| Cacto drawing | Procedural com variação: small (1 tronco), large (2-3 troncos + braços) | Visual orgânico sem sprites externos |
| Pterodáctilo | 2-frame wing flap, corpo estilizado, bico, sombra no chão | Animado mas simples, sombra ajuda o jogador |
| Chão | Linha superior + textura de pontos/triângulos procedurais | Marrom alaranjado com profundidade visual |
| Céu dia | Gradiente azul claro→azul, sol circular amarelo, 2-3 nuvens brancas estáticas | Alegre e limpo |
| Céu noite | Gradiente azul escuro→roxo, lua crescente, 15-20 estrelas | Atmosférico e imersivo |
| Transição dia/noite | Alpha crossfade: ambos os céus desenhados, alpha oscila em 1s | Suave e sem pop-in |
| Score display | Canvas text, font monospace, canto superior direito | Clássico e legível |
| High score display | Prefixo "HI", cor cinza claro, ao lado do score | Discreto mas presente |
| Game over overlay | Overlay semi-transparente escuro + "GAME OVER" canvas text + "Press SPACE" | Impactante sem ser intrusivo |
| Color palette | Ground: #D2691E, Sky day: #87CEEB→#4A90D9, Sky night: #1a1a2e→#16213e, Cactus: #2d5a27, Ptero: #8B7355 | Paleta quente e coerente |
| Collision | Hitbox shrink 6px por lado em todos os elementos | Margem justa para o jogador |
| Speed curve | Linear: +10px/s a cada 100pts, cap 700px/s | Progressivo mas jogável |
| Obstacle spawn | Array de obstáculos ativos, spawn quando último passou do min gap | Controle simples e previsível |

---

## 2. Constantes de Jogo

```javascript
// Canvas e dimensões
const CANVAS_WIDTH = 900;
const CANVAS_HEIGHT = 300;
const GROUND_Y = 250;

// Física
const GRAVITY = 2500;           // px/s²
const JUMP_FORCE = -700;        // px/s (upward)
const INITIAL_SPEED = 300;      // px/s
const MAX_SPEED = 700;          // px/s
const SPEED_INCREMENT = 10;     // px/s per 100 score points

// Spawn e obstáculos
const MIN_OBSTACLE_GAP = 400;   // px
const MAX_OBSTACLE_GAP = 900;   // px
const PTERODACTYL_MIN_SCORE = 300;
const HITBOX_SHRINK = 6;        // px per side

// Ciclo dia/noite
const DAY_NIGHT_MILESTONE = 200;    // points
const DAY_NIGHT_TRANSITION_MS = 1000;

// Animação
const BLINK_INTERVAL_MIN = 2000;    // ms
const BLINK_INTERVAL_MAX = 4000;    // ms
const BLINK_DURATION = 150;         // ms
```

---

## 3. Estrutura de Estado

```javascript
const gameState = {
    // Estado geral
    status: 'start',      // 'start' | 'playing' | 'gameOver'
    
    // Métricas
    score: 0,
    highScore: 0,
    
    // Física e movimento
    speed: INITIAL_SPEED,
    distance: 0,
    
    // Dino
    dino: {
        x: 50,
        y: GROUND_Y,
        vy: 0,
        onGround: true,
        runFrame: 0,           // 0 ou 1 para ciclo de corrida
        runTimer: 0,
        blinkTimer: 0,
        isBlinking: false,
        eyeState: 'normal'     // 'normal' | 'blink' | 'dead'
    },
    
    // Input
    wantsToJump: false,
    
    // Cenário
    groundOffset: 0,
    skyPhase: 'day',       // 'day' | 'night'
    skyTransition: 0,      // 0.0 (day) to 1.0 (night)
    
    // Obstáculos
    obstacles: [],         // Array de { type, x, y, width, height, hitbox }
    nextSpawnDistance: 0,
    
    // Timing
    lastTime: 0
};
```

---

## 4. Funções de Render (API Canvas)

| Função | Responsabilidade |
|---|---|
| `drawSky(ctx, phase, transition)` | Desenha céu com gradiente, sol/lua, nuvens/estrelas |
| `drawGround(ctx, offset)` | Desenha chão com scroll, cor, textura procedural |
| `drawDino(ctx, dinoState)` | Desenha dino procedural com animação de membros e olhos |
| `drawCactus(ctx, cactus)` | Desenha cacto procedural (small/large) |
| `drawPterodactyl(ctx, ptero, wingFrame)` | Desenha pterodáctilo com wing flap e sombra |
| `drawScore(ctx, score, highScore)` | Desenha score e high score no canvas |
| `drawGameOver(ctx, score, highScore)` | Desenha overlay de game over |
| `drawStartScreen(ctx)` | Desenha tela inicial com dino e instrução |

---

## 5. Fluxos de Game State

### Start → Playing
1. Detectar espaço/seta para cima
2. Resetar estado do jogo (score, speed, obstacles, dino)
3. Carregar highScore do localStorage
4. Mudar status para 'playing'
5. Iniciar game loop

### Playing → Game Over
1. Detectar colisão AABB entre dino e qualquer obstáculo
2. Mudar status para 'gameOver'
3. Atualizar highScore se necessário
4. Persistir novo highScore no localStorage
5. Exibir overlay de game over

### Game Over → Start (Restart)
1. Detectar espaço/seta para cima
2. Resetar estado completo
3. Mudar status para 'playing'
4. Iniciar novo game loop

---

## 6. Ciclo Dia/Noite

| Score | Fase |
|---|---|
| 0-199 | Dia |
| 200-399 | Noite |
| 400-599 | Dia |
| 600-799 | Noite |
| ... | Alterna a cada 200pts |

Transição: alpha crossfade de 1s quando crossing milestone.

---

## 7. Matriz de Rastreabilidade

| RF | Cobertura no plano |
|---|---|
| FR-001 a FR-005 (Game States) | Seção 5, Estado, Tasks T02-T03, T14 |
| FR-006 a FR-013 (Dino) | Seção 2, 3, Tasks T04-T06 |
| FR-014 a FR-017 (Cactos) | Seção 2, 4, Task T10 |
| FR-018 a FR-022 (Pterodáctilos) | Seção 2, 4, Tasks T11-T12 |
| FR-023 a FR-025 (Colisão) | Seção 2, Tasks T13-T14 |
| FR-026 a FR-029 (Chão) | Seção 2, 4, Task T07 |
| FR-030 a FR-037 (Céu e Dia/Noite) | Seção 2, 4, 6, Tasks T08-T09 |
| FR-038 a FR-041 (Score) | Seção 3, 4, Task T15 |
| FR-042 a FR-046 (High Score) | Seção 3, Tasks T15-T16 |
| FR-047 a FR-050 (Dificuldade) | Seção 2, Task T17 |
| FR-051 a FR-054 (Controles) | Tasks T02-T03 |
| FR-055 a FR-058 (Visual) | Seção 1, Tasks T04-T09, T18 |

---

## Fora de Escopo (conforme spec)

- Duck/agachar mecânica
- Touch/mobile controls
- Som e música
- Power-ups ou coletáveis
- Modo multiplayer
- Leaderboard online
- Salvar estado de partida em andamento
