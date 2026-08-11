# PLAN — Release: far-west-character-v1

> **Status:** Aprovado
> **Release ID:** far-west-character-v1
> **Spec:** `SPEC.md` Aprovado
> **Criado:** 2026-07-18

## 1. Estratégia

1. **Pose (player.js):** iterar a pose de montaria por screenshots de referência:
   coxas quase horizontais abraçando o barril do cavalo, canelas verticais para
   baixo, pés planos; tronco com lean ∝ velocidade (0° parado → ~18° galope) e
   herdando o pitch do cavalo; reins opcionais. Validar interpenetração por
   screenshots em 4 ângulos × 5 estados (idle/walk/trot/gallop/jump-apex).
2. **Colisão (novo collision.js):** registry de colisores cilíndricos — árvores
   (raio do tronco), rochas (raio ≈ bounding sphere × 0.8), prédios/tendas
   (footprint retangular aproximado por círculos ou AABB). Spatial hash por chunk
   (256 m) para query barata. Resolução no horse.js após integrar: push-out na
   normal + projeção da velocidade (slide). Cascos nunca penetram; câmera de 3ª
   pessoa também evita clip com obstáculos altos.
3. **Mira/tiro (combat.js + camera.js):** auditar a cadeia: crosshair é sempre o
   centro da tela; ray = camera.unproject(centro). Bug provável: origem/direção do
   raycast divergindo da câmera ativa (1ª vs 3ª pessoa) ou tracer saindo do ponto
   errado. Corrigir para: hitscan ray da câmera ativa pelo centro; tracer do
   cano→impacto; crosshair projetada sobre o ponto de impacto (opcional).
4. **Protocolo de validação visual obrigatório:** screenshots salvos em /tmp,
   inspecionados um a um; qualquer pose/colisão/impacto que não "faz sentido" na
   imagem volta para iteração antes de fechar.

## 2. Write set

`far-west/src/{player,horse,camera,combat,collision,config,main,vegetation,towns,villages,camp,fx}.js`,
`tests/far-west/far-west.spec.js`.

## 3. Riscos

| Risco | Mitigação |
|-------|-----------|
| Pose óssea nunca ler natural com o rig Adventurer | iterar por screenshots; pior caso: pose híbrida (pernas congeladas + tronco animado) já é o caminho — refinar ângulos |
| Colisão travar o jogador em floresta densa | slide (não stop), raio do cavalo conservador (0.55 m), colisores só de tronco/rocha grande |
| Performance da query de colisão | spatial hash por chunk; <20 candidatos por frame |
