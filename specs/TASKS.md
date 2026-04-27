# TASKS.md — Tauansauro v0.0.1

**Feature:** Implementação completa do jogo Tauansauro  
**Versão:** 0.0.1  
**Status:** Aprovado  
**Baseado em:** `specs/PLAN.md`, `specs/features/tauansauro/SPEC.md`  

---

## Convenções deste backlog

- Cada task é uma unidade de commit pequena e verificável.
- Definition of Done por task: código funcional + testado manualmente + alinhado com especificação.
- Sempre citar o RF coberto pela task em review de implementação.
- Qualquer mudança em `specs/` durante implementação deve atualizar `z_bug_specs.md` se restar novo gap.

---

## Phase 0 — Scaffolding

### T01 — Criar estrutura de diretório do jogo `[FR-001, RF-ARCH-010]`
- Criar `games/tauansauro/` com `index.html`, `style.css`, `game.js` vazios na estrutura canônica
- Verificar: arquivos existem e seguem convenção de nomenclatura

---

## Phase 1 — Game Loop e Estados

### T02 — Implementar canvas, game loop e estados `[FR-001, RF-ARCH-001, RF-ARCH-002]`
- Configurar canvas 900x300px em `index.html`
- Implementar `requestAnimationFrame` game loop em `game.js`
- Implementar delta time normalizado (dt/16.67)
- Implementar os 3 game states: `start`, `playing`, `gameOver`
- **Verificação:** O loop roda sem erros; states são printados no console ao mudar

### T03 — Implementar input handling `[FR-051, FR-052, FR-053, FR-054, RF-ARCH-006]`
- Capturar `keydown` para Space e ArrowUp
- Chamar `preventDefault()` para prevenir scroll
- Implementar pattern de "intent" (registrar `wantsToJump`, consumir em `update`)
- Garantir: não dispara double jump se tecla mantida
- **Verificação:** Pressionar espaço loga "jump intent" no console apenas uma vez por pressão

---

## Phase 2 — Dinossauro (Tauansauro)

### T04 — Implementar drawDino procedural `[FR-006, FR-055, RF-ARCH-011]`
- Implementar função `drawDino(ctx, dino)`
- Desenhar: corpo arredondado, cauda, braços pequenos, patas, olhos expressivos
- Cores: corpo #2d5a27 (verde escuro), barriga mais clara, olhos brancos + pupilas pretas
- **Verificação:** Dino aparece no canvas na posição correta

### T05 — Implementar animação do dino `[FR-007, FR-008]`
- Implementar 2-frame leg cycle durante corrida (alternar posição das pernas)
- Implementar pose de pulo (pernas estendidas para trás)
- Implementar pose de game over (corpo caído, olhos X)
- Implementar timer/blink para olhos piscando
- **Verificação:** Animação fluida, pernas alternam, olhos piscam a cada 2-4s

### T06 — Implementar física do pulo `[FR-009, FR-010, FR-011, FR-012]`
- Implementar gravidade constante (GRAVITY = 2500)
- Implementar jump force (JUMP_FORCE = -700)
- Implementar parabolic arc (vy += gravity * dt; y += vy * dt)
- Implementar detecção de solo (onGround)
- Bloquear pulo se !onGround ou estado != 'playing'
- **Verificação:** Pulo suave, arc parabólico, não dá double jump

---

## Phase 3 — Cenário (Chão e Céu)

### T07 — Implementar drawGround com scroll `[FR-026, FR-027, FR-028, FR-029]`
- Implementar função `drawGround(ctx, offset)`
- Cor: #D2691E (marrom alaranjado)
- Desenhar linha superior definida
- Implementar textura procedural (pontos/triângulos aleatórios)
- Implementar scroll contínuo (groundOffset += speed * dt)
- **Verificação:** Chão aparece, scrolla suavemente para esquerda

### T08 — Implementar drawSky dia e noite `[FR-030, FR-032, FR-033]`
- Implementar função `drawSky(ctx, phase, transition)`
- Dia: gradiente azul claro→azul, sol amarelo, 2-3 nuvens brancas
- Noite: gradiente azul escuro→roxo, lua crescente, 15-20 estrelas
- **Verificação:** Ambos os céus desenham corretamente quando chamados

### T09 — Implementar ciclo dia/noite automático `[FR-031, FR-034, FR-035, FR-036, FR-037]`
- Implementar lógica de milestone (a cada 200pts alterna)
- Implementar alpha crossfade de 1s ao crossing milestone
- Estado: skyPhase e skyTransition (0.0 a 1.0)
- **Verificação:** Ao atingir 200pts, transição suave de dia para noite ocorre

---

## Phase 4 — Obstáculos

### T10 — Implementar drawCactus e spawn `[FR-014, FR-015, FR-016, FR-017]`
- Implementar função `drawCactus(ctx, cactus)`
- Variações: small (1 tronco), large (2-3 troncos + braços)
- Cor: #2d5a27
- Implementar spawn com random gap entre MIN_OBSTACLE_GAP e MAX_OBSTACLE_GAP
- **Verificação:** Cactos aparecem, movem para esquerda, diferentes tamanhos

### T11 — Implementar drawPterodactyl `[FR-018, FR-019, FR-020, FR-021, FR-022]`
- Implementar função `drawPterodactyl(ctx, ptero, wingFrame)`
- Cor: #8B7355
- 2-frame wing flap animação
- 3 alturas: low (requer pulo), mid (pode ignorar), high (ignora)
- Só spawna se score >= PTERODACTYL_MIN_SCORE (300)
- Desenhar sombra elíptica no chão
- **Verificação:** Pterodáctilo aparece após 300pts, asa bate, sombra segue

### T12 — Implementar sistema de obstáculos `[FR-014, FR-018]`
- Array `gameState.obstacles` para objetos ativos
- Cada obstáculo: { type, x, y, width, height, hitbox }
- Update: x -= speed * dt
- Remove quando x < -width (off-screen)
- Spawn novo quando último obstáculo passou do min gap
- **Verificação:** Obstáculos spawnam, movem, removem; spawn timing funciona

---

## Phase 5 — Colisão e Game Over

### T13 — Implementar colisão AABB `[FR-023, FR-024, FR-025]`
- Implementar função `checkCollision(dino, obstacle)`
- Hitbox shrink 6px por lado
- Verificar: dino.x < obs.x + obs.w && dino.x + dino.w > obs.x && ... (AABB)
- **Verificação:** Colisão detectada quando dino sobrepõe obstáculo

### T14 — Implementar game over state e restart `[FR-003, FR-004, FR-005, FR-024]`
- Implementar transição para 'gameOver' em colisão
- Desenhar overlay semi-transparente
- Desenhar "GAME OVER" e score final
- Desenhar "Press SPACE to Restart"
- Implementar reset de estado em restart
- **Verificação:** Game over funciona, restart limpa estado e recomeça

---

## Phase 6 — Score e High Score

### T15 — Implementar score incremental e display `[FR-038, FR-039, FR-040, FR-041]`
- Implementar incremento baseado em distância (distance += speed * dt)
- Converter distância em pontos (score = floor(distance / 10))
- Desenhar score no canto superior direito (font monospace)
- **Verificação:** Score aumenta conforme jogo avança

### T16 — Implementar high score com localStorage `[FR-042, FR-043, FR-044, FR-045, FR-046]`
- Implementar `loadHighScore()` com try/catch defensivo
- Implementar `saveHighScore(score)`
- Exibir "HI" + highScore ao lado do score
- Implementar flash visual quando score > highScore
- Persistir novo highScore em game over
- **Verificação:** High score persiste entre sessões, flash funciona

---

## Phase 7 — Dificuldade e Polish

### T17 — Implementar dificuldade progressiva `[FR-047, FR-048, FR-049, FR-050]`
- Implementar speed curve: speed = INITIAL_SPEED + (score / 100) * SPEED_INCREMENT
- Cap em MAX_SPEED
- Ajustar spawn frequency: gap = lerp(MAX_GAP, MIN_GAP, speed/maxSpeed)
- **Verificação:** Jogo acelera conforme score aumenta, mas não ultrapassa cap

### T18 — Polish final e refinamentos `[FR-055, FR-056, FR-057, FR-058]`
- Ajustar posições e tamanhos para melhor composição visual
- Implementar olhos arregalados no game over
- Ajustar cores e contrastes
- Adicionar comentários explicativos no código
- Revisar código contra RF-CONV-002 (ordem do game.js)
- **Verificação:** Jogo visualmente atraente, código bem comentado

---

## Ordem Obrigatória

```
T01 → T02 → T03 → T04 → T05 → T06 → T07 → T08 → T09 → T10 → T11 → T12 → T13 → T14 → T15 → T16 → T17 → T18
```

---

## Anti-padrões Proibidos Durante Implementação

| Anti-padrão | Proibição |
|---|---|
| setInterval para game loop | Usar apenas requestAnimationFrame |
| Magic numbers | Todas as constantes devem ser nomeadas |
| Estado mutável global fora do gameState | Proibido |
| Rendering em update() | Separar update e render |
| DOM manipulation em elementos de jogo | Apenas canvas para elementos dinâmicos |
| Import de código externo | Zero dependências |
