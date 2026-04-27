# Tech Stack: tauan-games

## Jogos Simples — HTML+CSS+JS

### Linguagem e Runtime

| Item | Escolha | Justificativa |
|---|---|---|
| Linguagem | JavaScript ES6+ | Amplo suporte nos navegadores, sem necessidade de transpilação |
| Rendering | Canvas API (2D) | Controle pixel-a-pixel, desempenho adequado para jogos 2D, sem dependências |
| Estilo | CSS3 puro | Layout e overlay styling; NÃO usado para rendering de elementos dinâmicos |
| Estrutura | HTML5 | Canvas element, overlays semânticos, acessibilidade mínima |

### Game Loop

| Item | Escolha | Justificativa |
|---|---|---|
| Loop principal | requestAnimationFrame | Sincronizado com refresh rate do monitor, pausa quando aba não está ativa |
| Delta time | Derivado do timestamp do rAF | Animações frame-rate independentes |

### Persistência

| Item | Escolha | Justificativa |
|---|---|---|
| Dados entre sessões | localStorage | Web API nativa, sem dependências, síncrono para dados pequenos |
| Escopo | Chave prefixada por jogo | Evita colisão entre jogos no mesmo domínio (ex: `tauansauro_highScore`) |

### Input

| Item | Escolha | Justificativa |
|---|---|---|
| Teclado | keydown / keyup events | Padrão web, suporte universal |
| Touch | touchstart / touchend events | Suporte mobile quando aplicável |

### Ferramentas de Desenvolvimento

| Item | Escolha | Justificativa |
|---|---|---|
| Controle de versão | git | Padrão universal |
| Servidor local | Python http.server ou equivalente | Para desenvolvimento local com arquivo estático |
| Debugging | DevTools do navegador | Inspeção de canvas, profiling de FPS |

---

## Jogos Complexos — Golang

> **Placeholder** — Tech stack detalhado será definido quando o primeiro jogo Golang for planejado.

| Item | Escolha | Justificativa |
|---|---|---|
| Linguagem | Go 1.22+ | Performance, concorrência nativa, binário standalone |
| Rendering | Ebitengine (a confirmar) | Engine 2D madura para Go |

---

## Política Zero Dependências (Jogos Simples)

A arquitetura de jogos simples PROÍBE:

- `npm install` ou qualquer package manager JavaScript
- Importação de bibliotecas via CDN
- Frameworks CSS (Bootstrap, Tailwind, etc.)
- Frameworks JS (React, Vue, Angular, jQuery, etc.)
- Engines de jogo (Phaser, PixiJS, etc.)
- Bundlers (Webpack, Vite, Rollup, etc.)
- Transpilers (Babel, TypeScript, etc.)

A única dependência externa permitida é a Web API nativa do navegador.

---

## Compatibilidade de Navegadores

Jogos simples DEVEM funcionar nos seguintes navegadores em versões recentes:

| Navegador | Versão mínima |
|---|---|
| Google Chrome | 90+ |
| Mozilla Firefox | 90+ |
| Safari | 15+ |

Funcionalidades usadas DEVEM ter suporte universal nessas versões. Nenhuma API experimental ou vendor-prefixed é permitida.
