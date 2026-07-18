# PLAN — Release: far-west-uplift-v1

> **Status:** Aprovado
> **Release ID:** far-west-uplift-v1
> **Spec:** `SPEC.md` Aprovado
> **Criado:** 2026-07-18

## 1. Estratégia

Quatro frentes independentes sobre o código existente, sem tocar em mundo/entidades:

1. **Pose de montaria** (player.js): inspecionar os clips do Adventurer GLB; se não
   houver clip de montaria, posar os bones das pernas (coxas ~80° para frente,
   joelhos dobrados, pés para baixo) uma vez no carregamento e congelar essa pose
   como base; tronco usa Idle/Idle_Gun. Ajustar offset da sela.
2. **Controles CS** (input.js, camera.js, combat.js, horse.js): pointer lock
   permanente; mouse vira mira/câmera; LMB = tiro; espaço = pulo; F = ADS; cavalo
   segue yaw do mouse suavemente quando não mira; mira livre no galope.
3. **Pulo + velocidade** (horse.js, config.js): física vertical simples (vy,
   gravidade, ground = heightAt/bridgeAt), clip Gallop_Jump, GALLOP_SPD 14,
   aceleração maior, FOV kick, shake, poeira.
4. **Visual** (terrain.js, sky.js, water.js, main.js, assets.js): splat shader com
   4 texturas procedurais canvas (grass/dirt/rock/snow, com variação de escala),
   sombras PCFSoft com bias corrigido, UnrealBloom sutil (addons já vendorados),
   Water.js reflexivo nos rios/lago, densidade extra de arbustos/grama perto da
   câmera, correção de materiais GLB (roughness ~0.9, sem metalness).

## 2. Write set

`far-west/src/{player,input,camera,combat,horse,terrain,sky,water,main,assets,fx,config,hud}.js`,
`far-west/index.html`, `far-west/styles.css`, `tests/far-west/far-west.spec.js`.

## 3. Riscos

| Risco | Mitigação |
|-------|-----------|
| Rig do GLB não permite pose de montaria limpa | fallback: pose óssea manual congelada; validar por screenshot |
| Splat shader quebrar o heightAt/visual | shader custom leve (onBeforeCompile) mantendo vertexColors como fallback |
| FPS cair com bloom/água reflexiva | bloom em half-res; água reflexiva só no lago se custar; medir antes/depois |
| Testes quebrarem com remap de teclas | atualizar spec (espaço→pulo, tiro→mouse) na mesma task |
