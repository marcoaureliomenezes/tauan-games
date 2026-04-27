# Architecture: tauan-games

## Visão Geral

O repositório tauan-games organiza jogos como unidades independentes, cada uma em seu próprio diretório, com specs próprias e evolução independente.

```
tauan-games/
├── README.md
├── specs/                       # Specs do produto e dos jogos
│   ├── constitution.md
│   ├── SPEC.md
│   ├── PLAN.md
│   ├── TASKS.md
│   ├── memory/
│   │   ├── product.md
│   │   ├── architecture.md
│   │   └── tech-stack.md
│   ├── foundation/
│   │   └── SPEC.md
│   └── features/
│       └── <jogo-name>/
│           └── SPEC.md
└── games/                       # Código dos jogos
    └── <jogo-name>/
        ├── index.html           # Entry point do jogo
        ├── style.css            # Estilos do jogo
        ├── game.js              # Lógica principal do jogo
        └── assets/              # Sprites, sons, etc. (se houver)
```

---

## Arquitetura de Jogos Simples (HTML+CSS+JS)

### Estrutura de Diretório de um Jogo

```
games/<jogo-name>/
├── index.html
├── style.css
├── game.js
└── assets/          # Opcional — imagens, sons
```

### Separation of Concerns

| Arquivo | Responsabilidade |
|---|---|
| `index.html` | Estrutura do DOM: canvas, overlays (start screen, game over), score display |
| `style.css` | Layout, tipografia, overlay styling. NÃO controla rendering do canvas |
| `game.js` | Toda lógica de jogo: game loop, física, colisão, estado, rendering canvas, input |

### Game Loop

Todo jogo baseado em Canvas DEVE usar o padrão:

```
requestAnimationFrame(gameLoop)

function gameLoop(timestamp) {
    update(deltaTime)
    render(ctx)
    requestAnimationFrame(gameLoop)
}
```

- `update(deltaTime)`: atualiza estado do jogo (posição, velocidade, colisão, score).
- `render(ctx)`: desenha o estado atual no canvas.
- `deltaTime` é derivado do timestamp do `requestAnimationFrame` para animações frame-rate independentes.

### Rendering

- Elementos dinâmicos (jogador, obstáculos, chão,背景) são renderizados via Canvas API.
- UI estática (score, high score, mensagens de start/game over) pode usar DOM elements sobre o canvas.
- Cada elemento desenhável DEVE ter sua própria função de draw (ex: `drawDino(ctx, dino)`, `drawCactus(ctx, cactus)`).

### Estado do Jogo

Cada jogo DEVE ter um objeto de estado explícito:

```javascript
const gameState = {
    status: 'start',  // 'start' | 'playing' | 'gameOver'
    score: 0,
    highScore: 0,
    // ... estado específico do jogo
}
```

- Transições de estado são explícitas e validadas.
- Nenhum estado mutável global fora do objeto de estado do jogo.

### Input Handling

- Input é capturado via `addEventListener` em `keydown` e/ou `keyup`.
- Input DEVE ser processado no `update()`, não no event handler. O handler apenas registra a intenção.
- Prevenção de comportamento padrão do navegador (ex: scroll com espaço) é obrigatória.

### Persistência Local

- `localStorage` é o único mecanismo permitido para persistência de dados entre sessões.
- Uso típico: high score, configurações do jogador.
- Dados gravados DEVEM ser lidos com fallback defensivo (try/catch, valor padrão).

### Colisão

- Detecção de colisão usa Axis-Aligned Bounding Boxes (AABB).
- Hitboxes podem ser menores que o sprite visual para dar margem de justiça ao jogador.
- A lógica de colisão DEVE ser separada da lógica de rendering.

### Dificuldade Progressiva

- Jogos que suportam dificuldade progressiva DEVEM fazê-lo através de parâmetros explícitos (velocidade, frequência de obstáculos, etc.).
- A dificuldade DEVE aumentar ao longo do tempo ou do score, nunca aleatoriamente.

---

## Arquitetura de Jogos Complexos (Golang)

> **Placeholder** — Nenhum jogo complexo está especificado ainda. Esta seção será expandida quando o primeiro jogo Golang for planejado.

Princípios gerais:
- Cada jogo Golang vive em `games/<jogo-name>/` como um módulo Go independente.
- Build produz um binário standalone.
- Rendering via Ebitengine ou equivalente.
- Specs seguem o mesmo padrão SDD dos jogos simples.

---

## Princípio Operacional

- `specs/` é a fonte única da verdade sobre comportamento e contratos.
- `games/` é a implementação, sempre derivada das specs.
- Nenhum jogo importa código de outro jogo.
- Cada jogo é executável de forma standalone.
