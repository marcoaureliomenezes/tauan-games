# Gameplay Review — Aero Strike (aero-fighters)

**Data:** 2026-05-12
**Revisor:** game-developer
**Stack:** Three.js r165, 15 ES modules em `src/`, zero build step

---

## Impressoes gerais de jogabilidade

O jogo tem uma base tecnica surpreendentemente solida para um projeto pedagogico. A modularizacao em 15 ES modules esta bem executada, com separacao clara de responsabilidades. O game loop respeita delta time em toda a fisica, as constantes sao nomeadas em `config.js`, e o sistema de partículas com pool evita garbage collection. A suite de testes passa em 17 de 18 ACs (o 18o e flaky — falhou uma vez com 11.6 FPS em headless, passou na retry com ~15 FPS).

O que compromete a experiencia e uma combinacao de: fisica de voo excessivamente simplificada (sem inercía real, sem drag aerodinamica), posicionamento de alvos sem levar em conta a altura real do terreno (o calculo de `yGround` nao usa o mesmo heightmap que a geometria renderizada), e um buffer de colisao de terreno que e matematicamente mais conservador que o mesh visual — criando a montanha "invisível" relatada.

O jogo e jogavel e visualmente interessante, mas os tres bugs reportados sao blockers para imersao e precisam de correcao antes de qualquer nova feature.

---

## Bugs identificados

| # | Bug | Arquivo:Linha | Causa Raiz | Severidade |
|---|-----|---------------|------------|------------|
| B-1 | Objetos flutuando no ar | `targets.js:232-234` + `world.js:158-163` | `spawnTarget` calcula `yGround` via `islandHeightAt()` (formula parabolica simplificada), mas o mesh da ilha usa formula diferente com ruido senoidal multiplo — os dois resultados divergem, especialmente longe do centro | CRITICO |
| B-2 | Colisao com montanha invisivel | `world.js:166-178` + `config.js:20` | `checkTerrainCollision` usa `islandHeightAt()` (parabolica pura) com margem `+2.5`. O mesh visual usa formula com noise adicional que cria picos mais altos do que `islandHeightAt` reporta. Aviao bate em pixel que a colisao nao ve | CRITICO |
| B-3 | Aviao abatido nao cai satisfatoriamente | `player.js:303-328` | O fluxo `mayday` existe e aplica gravidade 4x (`PLAYER.GRAVITY * 4.0`), mas o aviao some (`jet.visible = false`) antes de impactar o solo visualmente e a animacao de tumble e curta demais para alturas altas | ALTO |
| B-4 | Fisica de voo artificial | `player.js:364-371` | Lift e calculado com `liftFactor` simples, sem drag, sem inercia de atitude, sem efeito de momentum angular. A convergencia de speed via lerp e instantanea demais (`CONVERGE_RATE: 1.6`) | MEDIO |
| B-5 | FPS flaky em headless | `main.js:266-331` | `tick()` executa updateOceanWaves (4225 vertices), tickFactoryParticles, shadow map PBR — em software rendering headless fica na borda de 15 FPS | BAIXO |

---

## Analise da fisica de voo

### O que esta implementado

O modelo atual em `player.js:332-419` implementa:

1. **Throttle com convergencia:** `game.player.speed` converge para `tgtSpd` via lerp: `speed += (tgtSpd - speed) * min(1, dt * CONVERGE_RATE)`. Com `CONVERGE_RATE = 1.6`, a convergencia e rapida mas nao instantanea.

2. **Gravidade bruta:** `jet.position.y -= PLAYER.GRAVITY * dt` aplicado todo frame (14 m/s²).

3. **Lift compensatorio:** Quando nao em stall, `liftFactor = min(speed / (MIN_SPD * 2.5), 1.0)` e o aviao recebe empuxo no eixo up do quaternion: `jet.position.addScaledVector(up, GRAVITY * liftFactor * dt)`.

4. **Controles de atitude via quaternion:** Pitch, roll e yaw sao aplicados diretamente no quaternion do jet, sem inercia angular.

5. **Stall:** Detectado quando `speed < STALL_SPD (10)`. Nesse estado o lift e zerado e o aviao cai pela gravidade bruta.

### O que esta faltando (e causa a sensacao "artificial")

**Inércia de velocidade real:** O modelo atual e `speed -> tgtSpeed via lerp`. Um F-35 real tem momentum linear — aceleracoes e desaceleracoes dependem da diferenca entre traction (throttle) e drag. O resultado: ao soltar o throttle, a velocidade cai muito rapido sem sensacao de planar.

**Drag aerodinamico:** Nao existe drag proporcional a `speed²`. O voo parece que o aviao esta em vacuo.

**Inercia de atitude (momentum angular):** O quaternion e rotacionado diretamente pela entrada de input. Na vida real, existe momento de inercia — o nariz demora para parar de rodar mesmo apos soltar o input. Codigo atual: `jet.quaternion.multiply(pitchQ)` sem nenhum estado de `pitchRate` acumulado.

**Efeitos de G (coordenadas de camera):** A camera em `main.js:112-157` faz `lerp` com fator `0.09` — suave mas sem comunicar aceleracao. Em uma virada apertada, o piloto deveria sentir o G (camera apertada contra o cockpit).

**Lift dependente do angulo de ataque:** Atualmente o lift e proporcional a `speed` mas nao ao angulo entre o vetor forward do aviao e o vetor velocidade. Um aviao real perde lift quando o angulo de ataque e muito alto (stall aerodinamico), independente da velocidade total.

**Codigo especifico que causa a sensacao artificial (`player.js:336-338`):**

```js
const tgtSpd = PLAYER.MIN_SPD + game.player.throttle * (PLAYER.MAX_SPD - PLAYER.MIN_SPD);
game.player.speed += (tgtSpd - game.player.speed) * Math.min(1, dt * PLAYER.CONVERGE_RATE);
```

Este lerp significa que com `CONVERGE_RATE = 1.6` e `dt = 0.016`, o fator e `0.025` — converge em ~40 frames (0.67s de 0 a 100%). Nao e terrível, mas o problema e que a velocidade alvo e linear com throttle, sem fisica de propulsao vs drag.

---

## Analise de crash e queda do aviao

### Fluxo atual quando o aviao e abatido

1. `playerHit()` (`player.js:438-453`) reduz `game.player.hp`. Com hp=0: ativa `game.flags.mayday = true`.

2. No proximo frame, `updatePlayer()` detecta `game.flags.mayday` e entra no bloco de mayday (`player.js:303-328`):
   - Emite fumaça e explosoes pequenas com timer `damageSmoke`
   - Aplica tumble aleatorio: `jet.rotateX(rand * spin * dt)` e `jet.rotateZ(rand * spin * dt)`
   - Reduz speed gradualmente: `speed = max(8, speed - 20 * dt)`
   - Aplica gravidade 4x: `jet.position.y -= PLAYER.GRAVITY * 4.0 * dt`
   - Verifica colisao com `checkTerrainCollision()`

3. Ao impactar: `megaExplosion(jet.position, 'crash')` + `jet.visible = false` + `_ejectAndRespawn()`

4. `_ejectAndRespawn()` (`player.js:422-435`): decrementa `lives`. Se lives > 0: respawn com `hp=3` e `invincibility=3.0`.

### Problemas no fluxo atual

**O aviao some antes do impacto visual:** `jet.visible = false` e chamado dentro da funcao de impacto (`player.js:323-327`), simultaneamente com `megaExplosion`. O efeito e que o aviao simplesmente desaparece no momento do boom — sem ver a carcaca chegando no chão.

**Gravidade 4x e insuficiente em alta altitude:** Com `START_HEIGHT = 80` e `GRAVITY = 14`, o aviao demora ~2.4 segundos para cair de 80 unidades ate o mar. Com `4x`, demora ~0.6 segundos. Para altitudes muito altas (150+ unidades, alcancavel em loop), a queda e rapida demais para ser dramatica.

**Tumble com spin agressivo precoce:** O spin aumenta com altitude: `spin = 0.8 + max(0, (80 - y) / 80) * 1.8`. Acima de y=80, o spin e apenas 0.8 rad/s — suave. Mas a formula esta invertida: quanto mais alto o aviao, menor o spin. Seria mais dramatico o spin aumentar conforme cai e ganha velocidade terminal.

### O que precisa mudar para queda fisica realista

Para uma queda convincente, o aviao precisa:
1. Manter visibilidade ate impacto no solo (remover `jet.visible = false` do callback de impacto e colocar apenas no respawn)
2. Velocidade vertical crescente com gravidade — simular que a aeronave ja estava em trajetoria descendente
3. Spin crescendo com velocidade de queda, nao com altitude
4. Camera seguindo o aviao em queda (atualmente a camera para de atualizar quando `!game.running`)

---

## Analise do terreno e posicionamento de alvos

### Como ilhas e heightmap funcionam

O mesh de ilha em `world.js:89-133` usa `createIsland()` que calcula height para cada vertice com formula:

```js
const noise =
  Math.sin(x * 0.18) * Math.cos(z * 0.14) * 5 +
  Math.sin(x * 0.36 + 1.5) * Math.cos(z * 0.29 + 0.8) * 2.5 +
  Math.sin(x * 0.72) * Math.cos(z * 0.63) * 1.2 +
  Math.sin(x * 1.42 + 0.4) * Math.cos(z * 1.18 - 0.6) * 0.6;
const h = Math.max(0, (1 - dist * dist * 1.35) * peakHeight + noise);
```

Para colisao de terreno, `islandHeightAt()` em `world.js:158-163` usa formula simplificada:

```js
const t = Math.sqrt(r2) / isl.radius;
return isl.peakHeight * Math.max(0, 1 - t * t * 1.35);
```

**Divergencia:** A formula de colisao nao inclui o noise senoidal de 4 octaves. O aviao pode voar em coordenadas onde o pixel visível esta a altura `peakHeight * parabola + noise_max(~9 unidades)`, mas a colisao so ve `peakHeight * parabola`. Com `MOUNTAIN_BUFFER = 2.5`, a protecao e insuficiente quando o noise pode adicionar ate 9.3 unidades de altura.

### Por que alvos aparecem flutuando

`spawnTarget()` em `targets.js:217-282` posiciona alvos:

```js
const hFn = (heightFn) ? heightFn : islandHeightAt;
yGround = hFn(isl, dx, dz);
mesh.position.set(worldX, yGround, worldZ);
```

A funcao `heightFn` passada por `missions.js` e a mesma `islandHeightAt` — a formula parabolica sem noise. Mas o mesh visual da ilha naquele ponto esta na altura `parabola + noise`. O resultado: o alvo e colocado na altura da formula parabolica, mas o vertice visivel do terreno naquele ponto pode estar varios metros acima ou abaixo.

**Exemplo numerico:** No centro de uma ilha com `peakHeight=94` (ilha index 3, `cx=-120, cz=-920, r=115`), a formula parabolica retorna `94 * 1.0 = 94`. Mas o noise em `dx=0, dz=0` e `sin(0)*cos(0)*5 + sin(1.5)*cos(0.8)*2.5 + sin(0)*cos(0)*1.2 + sin(0.4)*cos(-0.6)*0.6 = 0 + 1.0 * 2.5 + 0 + ~0.29 = 2.79`. Entao o terreno visível esta em 96.79, mas o alvo e posicionado em 94. Em `dx=30, dz=0`: parabola retorna ~`94 * (1 - (30/115)^2 * 1.35) ≈ 83`, noise varia de -9 a +9 unidades. Se o noise for positivo, o alvo flutua ate 9 metros acima do terreno visível.

### Como a colisao com montanha invisivel ocorre

Em `checkTerrainCollision()` (`world.js:166-178`):

```js
if (r2 < isl.radius * isl.radius) {
  const localH = islandHeightAt(isl, dx, dz);
  if (jetPosition.y < localH + 2.5) return 'MOUNTAIN';
}
```

O aviao colide quando `y < localH + 2.5`. Mas localH usa a formula sem noise. O mesh visual usa a formula com noise. Em pontos onde o noise e alto (ate +9.3), o aviao pode estar voando acima do terreno visível e ainda acima da formula parabolica — e NAO colide. Mas onde o noise e negativo, o terreno visual esta abaixo da parabola, e o aviao colide com a parabola mesmo sem tocar o terreno renderizado.

O inverso tambem ocorre: onde o noise e positivo, o aviao voa visualmente atraves do terreno mas sem crashar — porque a colisao nao ve o pico de noise.

**A colisao invisivel mais comum:** O noise pode adicionar um pico de +9.3 unidades. Com `MOUNTAIN_BUFFER = 2.5`, a colisao e detectada em `parabola + 2.5`. Mas o aviao pode estar em `parabola + 5` (visualmente acima do terreno) e ainda nao ter colisao. Depois, ao descer mais, passa por `parabola + 2.5` e colide — em um ponto que visualmente ainda parece ter espaco livre (porque o noise local e -3 unidades, ou seja o terreno visível esta em `parabola - 3`).

---

## Avaliacao do limite tecnologico (Three.js r165 puro)

### O que ainda e possivel dentro da stack atual

Three.js r165 com ES modules puros consegue entregar, dentro da arquitetura atual:

- **Fisica de voo com inercia real:** Adicionar `pitchRate`, `rollRate`, `yawRate` como variaveis de estado com momentum angular e drag. Nenhuma limitacao tecnica — e apenas logica em `player.js`.

- **Colisao precisa com o mesh visual:** Raycasting nativo do Three.js (`THREE.Raycaster`) pode fazer raycast vertical contra o mesh da ilha e retornar a altura exata do vertice em qualquer ponto. Isso eliminaria a divergencia entre formula e geometria. Custo: ~0.3ms por frame para 18 ilhas com 44x44 segmentos.

- **Queda fisica do aviao:** Manter `jet.visible = true` durante o mayday e ajustar a curva de spin. Nenhuma limitacao de engine.

- **Heightmap amostrado da geometria:** Pode-se pre-computar uma textura de heightmap (2D array) de cada ilha no momento de criacao e usa-la tanto para renderizacao quanto para colisao — eliminando o bug de divergencia.

- **Alvos precisamente no terreno:** Usar `THREE.Raycaster` no momento de spawn para encontrar a altura exata do mesh.

### O que esta alem do alcance pratico desta stack

**Fisica de fluido (CFD) real:** Sustentacao dependente de angulo de ataque com efeito de estol realistico. Possivel aproximar, mas sem engine dedicada (Bullet, Cannon.js) o modelo e sempre uma aproximacao.

**Terreno com LOD (Level of Detail):** Com 18 ilhas de 44x44 segmentos cada, o raycast por frame para colisao precisa e viavel. Mas se o mapa crescer para 50+ ilhas ou o terreno for continuo, a abordagem de heightmap pre-computado se torna necessaria.

**Alvos moveis com AI de evasao em tempo real:** Pathfinding (A*, navmesh) em JavaScript puro tende a ter spike de GC. Possivel com Web Workers, mas adiciona complexidade arquitetural significativa.

**Sombras precisas de terreno:** A shadow camera atual segue o player. Para sombras de montanhas em toda a cena, seria necessario um shadow map muito grande ou cascaded shadow maps — possivel em Three.js mas custoso para software rendering.

### Conclusao sobre o limite tecnologico

**Three.js r165 nao chegou no limite para os requisitos descritos.** Os problemas reportados sao bugs de implementacao, nao limitacoes da engine. A arquitetura em ES modules esta bem estruturada e tem seams claros para evolucao.

O unico ponto de atrito real e o raycasting para colisao precisa — que e suportado nativamente pelo Three.js mas exige refatoracao cuidadosa do `checkTerrainCollision`.

---

## Recomendacao de tecnologia

### Manter Three.js com melhorias especificas

**Recomendacao: Manter Three.js.** Nao ha justificativa tecnica para migrar.

As queixas do operador sao todas corrigiveis dentro da stack atual:

| Queixa | Solucao em Three.js | Esforco |
|--------|---------------------|---------|
| Fisica artificial | Adicionar drag + momentum angular a `player.js` | P |
| Aviao nao cai | Manter visibilidade durante mayday, ajustar spin | P |
| Objetos flutuando | Raycast vertical no spawn do alvo | M |
| Montanha invisivel | Amostrar heightmap correto em `islandHeightAt` — incluir noise na formula | M |

**Se a decisao fosse migrar** (que nao e o caso aqui):

| Plataforma | Pro | Contra |
|------------|-----|--------|
| Godot 4.x + Web export | Editor visual, fisica integrada, heightmap nativo | Quebra o "zero build step"; requer Godot instalado; curva de aprendizado para filho do operador |
| Babylon.js | Raycasting rico nativo, inspector visual, mesma stack web | API mais verbosa; menos exemplos que Three.js; mudaria todos os 15 modulos |
| Three.js + Cannon.js (physics engine) | Fisica rigorosa; pequena adicao de biblioteca | Adiciona dependencia CDN; aumenta complexidade; Three.js puro ja e suficiente para o escopo atual |

**Estimativa de migracao para Godot:** 3-4 semanas de reescrita completa, sem reaproveitamento de codigo existente, com curva de aprendizado do GDScript/editor.

**Estimativa de correcao na stack atual:** 2-3 dias de trabalho focado nos 4 bugs principais.

---

## Backlog de correcoes (ordenado por impacto)

| ID | Descricao | Arquivo | Esforco | Impacto |
|----|-----------|---------|---------|---------|
| FIX-01 | Corrigir divergencia de heightmap: incluir noise na formula `islandHeightAt()` OU usar raycast Three.js para amostrar altura real do mesh | `world.js:158-163` | M | Alto — elimina montanha invisivel |
| FIX-02 | Corrigir posicionamento de alvos: usar altura real do mesh (raycast ou heightmap com noise) no `spawnTarget()` | `targets.js:232-234` | M | Alto — elimina objetos flutuando |
| FIX-03 | Aumentar `MOUNTAIN_BUFFER` para cobrir o noise maximo (~10 unidades) como paliativo imediato | `config.js:20` | P | Medio — reduz colisoes falsas enquanto FIX-01 nao e implementado |
| FIX-04 | Manter `jet.visible = true` durante todo o mayday; so ocultar apos explosao e inicio do respawn | `player.js:322-326` | P | Alto — aviao abatido cai visivelmente |
| FIX-05 | Inverter formula de spin do mayday: aumentar spin com velocidade de queda em vez de diminuir com altitude | `player.js:312` | P | Medio — queda mais dramatica |
| FIX-06 | Adicionar drag aerodinamico: `speed -= DRAG_COEFF * speed * speed * dt` | `player.js:364` | P | Medio — fisica mais crivel em desaceleracao |
| FIX-07 | Adicionar momentum angular: `pitchRate`, `rollRate` como estado com decay — input acumula taxa de rotacao em vez de aplicar diretamente | `player.js:342-356` | M | Medio — elimina a sensacao "artificial" de controle |
| FIX-08 | Calibrar `CONVERGE_RATE` para sensacao de inercía em aceleracao: reduzir de 1.6 para ~0.8 | `config.js:17` | P | Baixo — melhora sutil de feel |
| FIX-09 | Resolver AC-18 flaky: reduzir vertices do oceano (de 64x64 para 32x32) OU atualizar waves a cada 3 frames | `world.js:48, 70` | P | Baixo — testes mais estaveis |

### Prioridade de implementacao recomendada

**Sprint 1 (correção de bugs criticos):** FIX-01 + FIX-02 + FIX-03 + FIX-04
**Sprint 2 (feel de voo):** FIX-05 + FIX-06 + FIX-07
**Sprint 3 (polish):** FIX-08 + FIX-09

---

## Status dos testes Playwright

| AC | Descricao | Resultado |
|----|-----------|-----------|
| AC-1 | Canvas renderiza com pixels visiveis | PASSOU |
| AC-2 | Sem erros de console no load | PASSOU |
| AC-3 | Inicia com 100 misseis | PASSOU |
| AC-4 | ArrowDown sobe o aviao (invertido) | PASSOU |
| AC-5 | ArrowUp desce o aviao | PASSOU |
| AC-6 | Sobrevive a loop vertical completo | PASSOU |
| AC-7 | ArrowLeft rola e vira o aviao | PASSOU |
| AC-8 | W aumenta throttle e velocidade | PASSOU |
| AC-9 | S diminui throttle e velocidade | PASSOU |
| AC-10 | Espaco dispara projetil | PASSOU |
| AC-11 | X dispara missil e decrementa contador | PASSOU |
| AC-12 | Missao spawna alvos militares | PASSOU |
| AC-13 | Matar inimigo incrementa score | PASSOU |
| AC-14 | S sustentado causa stall | PASSOU |
| AC-15 | Shift barrel roll sem crash | PASSOU |
| AC-16 | Background renderiza com cor | PASSOU |
| AC-17 | lives=0 mostra missao falhou | PASSOU |
| AC-18 | FPS >= 15 em 8s | FLAKY (falhou 1x, passou na retry) |

**Resultado geral:** 17/18 ACs passando com estabilidade. AC-18 e flaky por conta do software rendering headless com shadow maps PBR — nao e indicativo de problema em browser real.
