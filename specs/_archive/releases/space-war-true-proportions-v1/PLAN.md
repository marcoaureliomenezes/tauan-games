# PLAN — Release: space-war-true-proportions-v1

> **Status:** Aprovado — 2026-07-04
> **Base:** feature/space-war-photometric-stars-v1 (stacked em PR #17)

## Decisões

- **D-1 (uma reforma, não mais uma camada):** o bloco WALL-SCALE de config.js é
  REMOVIDO (não empilhamos um ÷10 por cima do ×10). O pipeline de escala fica:
  approach-scale (×22/9/6 — mantida: dá corpos grandes vs nave SEM quebrar
  ângulos) → distâncias ×4 → **proporção verdadeira** (novo bloco único:
  centros ×5, SOI solar honesta, far/skybox, gauges fotométricos).
  Números-alvo: Sol R 11000 (μ re-gauge v_esc preservada), Terra 2200@440k
  (Sol 2.9° do chão da Terra), Saturno 5490@1.96M (0.36° da Terra), Lua 594
  (órbita re-floor k≈1 → trilho/balística originais), Betelgeuse 60000,
  planetas de Betelgeuse ÷4, centros: binário ~22.8M, veil ~26.8M.
- **D-2 (cull universal + pontos):** updateSOIView culla TODOS os sistemas
  (inclusive solar); Betelgeuse sem alwaysVisible; starlod ganha glow do solar
  de volta; gauges: PHOTO_D0 2M, D0_SYS 6M (visibilidade a 20-30M).
- **D-3 (BN/NS por referência, componível):** diskMaterial ganha modo
  ESPIRAL (uSpiral: estrias log-spiral + hot inner rim) usado pelos dois BNs;
  jato vira componente reutilizado (NS needles + BN bipolar). Nada de textura
  externa — tudo procedural (CSP do Pages).
- **D-4 (remanescente/corrente):** decorações ganham `fadeR` (rampa de opacidade
  por distância, visível de longe, sem pop de cull); corrente de acreção =
  TubeGeometry sobre curva espiral (CatmullRom no plano do disco) recomputada
  por frame barato (pontos fixos no frame do par).
- **D-5 (leis nos testes, não números):** testes unit/e2e re-derivam expectativas
  do config (v_esc do Sol = √(2μ/R); ângulos por θ=2R/d) — a próxima mudança de
  escala não reescreve testes.
- **D-6 (fp32):** anel a ~30M → ULP 2-4u: só SPRITES fotométricos vivem lá
  quando longe (malhas culladas); modelView f64 do CPU cobre o resto. Sem
  camera-relative nesta release.

## Ordem

1. T-TP-01 config.js: remover wall-scale; novo bloco proporção-verdadeira;
   re-derivações (moons k, SOIs, FLARE, RENDER, OVERDRIVE, gauges photo).
2. T-TP-02 cull universal + glow solar (system.js, starlod.js).
3. T-TP-03 BN (stars.js + atoms.js diskMaterial espiral + jets) e Sgr A* rim.
4. T-TP-04 NS redesign (needles, halo, core 90).
5. T-TP-05 remanescente fade + corrente espiral (system.js) + jato da nave
   (ship.js — bola azul) + reflexo.
6. T-TP-06 testes: unit sweep re-derivado; physics.spec AC-06 → proporções;
   novo proportions.spec (AC-01/02/05/06); BH/NS specs (AC-03/04).
7. T-TP-07 QA + security + push + PR (stacked, base main p/ CI) + CI verde.

## Riscos

- **R-1 cadeia de derivações do config:** moon k, SOI fit, periodFactor √(8/5)
  do wall REMOVIDO junto (períodos keplerianos com μ_sol re-gauge) — adjudicado
  pelo unit sweep (ele valida pares, luas⊂SOI, gauge v_esc).
- **R-2 e2e existentes com números mágicos** (goTo distMul, alturas): revisar
  physics/journey/photometric/campaign specs — trocar para proporções.
- **R-3 headless perf:** BN disco 5× + espiral = mais fragmentos perto do BN;
  segmentos HEADLESS baixos preservados.
- **R-4 balística das luas:** k≈1 devolve v_moon original ✓ (lição T-WR-11).
