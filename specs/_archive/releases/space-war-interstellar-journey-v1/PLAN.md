# PLAN — Release: space-war-interstellar-journey-v1

> **Status:** Aprovado — 2026-07-04 · **SPEC:** [Aprovado]

## Decisões de engenharia

- **D-1 (journey.js puro + integração):** o PERFIL (a, v, x por s=t/T) vive em função
  pura node-testável (`journeyProfile(D, T, t)`); o autopilot integra a POSIÇÃO da
  nave ao longo da linha origem→alvo (pos = lerp + perfil), zera acumulação de
  gravidade durante a queima (a queima domina ~10³×) mas mantém colisão/heat ativos.
  Estado em `game.journey = {active, s, T, D, dir, beta, from, to}`.
- **D-2 (T ∝ D):** T = clamp(180 + 180·(D−D_min)/(D_max−D_min), 180, 360) s — par
  mais próximo ~3:00, mais distante ~6:00 (a demanda do operador).
- **D-3 ([Z] contextual):** input.js roteia 'assist' → main decide: alvo de outro
  sistema → journeyToggle(); senão toggle de assist (comportamento atual intacto).
  Abort: [Z] de novo ou [X]; velocidade residual = dir·min(v_atual, 9000).
- **D-4 (starfield.js):** 2 camadas de chunks wrap-around (hash inteiro determinístico
  xorshift): NEAR (chunk 90k, ~28 estrelas/chunk, grid 5³ ao redor da câmera → ~3500)
  como THREE.Points sizeAttenuation + FAR (chunk 400k, esparso, pontos maiores).
  Reposicionamento por wrap (posição = hash·chunk + offset — recycling sem alocação).
  Cores: paleta espectral (M vermelha → O azul, pesos reais ~76% M). Nebulosas:
  ~10 billboards (NormalBlending) em chunks de 1.2M, paletas Hα/O III/reflexão.
  Fade: opacity ∝ distância ao sistema mais próximo (dentro do raio do sistema → 0).
- **D-5 (relatividade no shader):** starfield ShaderMaterial com uniforms
  {uBeta, uDir}: no vértice, direção câmera→estrela aberrada pela fórmula real;
  no fragmento, recolor por δ (lookup blackbody 1D aproximado por rampa) e brilho
  δ⁴ com clamp 6×. β_visual = 0.985·(v/v_pico_max_global) — REALISTA, sem warp
  cinematográfico (decisão do operador). Skybox: passe leve no postfx (convergência
  radial frontal ∝ β² + tint) — barato, coerente.
- **D-6 (bulbo):** skybox.js pinta na direção NORMALIZADA do centro do sistema core:
  elipse quente 0xffd9a0/0xffb060 multi-blob + fendas de poeira escuras por cima
  (multiply) + granulado de estrelas denso local. Sem ponto central.
- **D-7 (nave visível):** jato = ConeGeometry shader gradiente (branco-azul→laranja
  transparente, NormalBlending, comprimento ∝ throttle + overdrive/journey);
  wingtips: 2 esferas emissivas vermelhas (0xff2a2a) c/ pulso 1.2 Hz + halo pequeno;
  rim: emissive fraco 0x202830 no casco + PointLight fraca presa à nave (reflexo).
- **D-8 (testes de tempo):** e2e NÃO espera 3 min: `__swDebug.journeyWarp(s)` salta o
  progresso; unit node valida o perfil; e2e valida engate/uniforms/aborto/chegada.

## Riscos

- R-1: starfield custo de fragmento em headless — Points com size pequeno, floor FPS
  já tolerante; fade-out dentro de sistemas corta o custo no smoke.
- R-2: journey × gravidade (poços/PW durante a queima) — gravidade desligada na
  queima (D-1), colisões seguem (matar a queima se surfaceContact — improvável).
- R-3: skybox repaint custo de boot — uma vez só (paint-time, como as galáxias).

## Ordem

T-IJ-01 perfil+autopilot → T-IJ-02 starfield+nebulosas → T-IJ-03 relatividade →
T-IJ-04 bulbo → T-IJ-05 nave visível → T-IJ-06 testes+QA+security+push/PR/CI.
