# PLAN — Release: space-war-photometric-stars-v1

> **Status:** Aprovado — 2026-07-04
> **Base:** feature/space-war-interstellar-journey-v1 (stacked em PR #16)

## Decisões de arquitetura

- **D-1 (leis puras primeiro):** toda a fotometria vive em `celestial/physics.js`
  (puro, node-testável): `pointIntensity(L,d,D0)`, `pointPx(I,core,glareK,max)`,
  `discPx(R,d,pxAngle)`, `lodStep(prev,discPx)` (histerese 2/1),
  `lumForStar(def)` (override `def.lum` → default por kind:
  star 0.6 · redgiant 8 · redsupergiant 60 · whitedwarf 0.02 · neutron 80).
  O shader do starfield é ESPELHO GLSL das mesmas fórmulas (padrão journeyProfile).
- **D-2 (starfield = quads instanciados):** `InstancedBufferGeometry` (plano 1×1,
  atributos por instância iPos/iColor/iLum); billboard via colunas right/up da
  câmera; NormalBlending + depthWrite:false (gotcha NaN preservado); mesma
  aberração/Doppler/beaming da journey. `uD0` de campo = 120k (NEAR) / 260k (FAR):
  típico I 0.05–1 (poeira que acende), rasante satura → glare cresce.
- **D-3 (LOD em módulo próprio):** `celestial/starlod.js` — pós-build, move os
  filhos visuais de cada estrela luminosa p/ um subgrupo `nearViz` (PointLight
  fica no grupo — continua iluminando o sistema em modo ponto) e cria o sprite
  fotométrico de cena. Um único update por frame decide modo, aplica teto da
  corona, escala/opacidade do ponto (NS: × pulsarStrobe) e alimenta `game.starLod`.
- **D-4 (beacons → glows):** `buildSystemBeacons`/`_beacons` saem de system.js;
  starlod cria 1 glow fotométrico por sistema culled (L_sys = Σ lum), mesma regra
  de visibilidade (fora de 0.9·raio). Tints preservados.
- **D-5 (flare ∝ fluxo):** stars.js troca o fator linear com piso 0.22 por
  `(FLARE_FULL/d)²` clampado [0,1]; cutoff e `game.sunFlareVisible` intocados.
- **D-6 (sanitize no lens pass):** função GLSL `sanitize()` aplicada nas 3 saídas
  do LENS_SHADER (early-return base ×2 + saída final): NaN→0, clamp [0,64].
- **D-7 (lum é atributo declarado):** massas/raios do jogo são comprimidos p/
  jogabilidade — derivar L deles (M^3.5 ou R²T⁴) inverte a hierarquia visual.
  `lum` é declarado por corpo (config/universe), com defaults por kind (D-1),
  documentado como compressão consciente (mesma doutrina do μ do Sgr A*).

## Ordem de implementação

1. `celestial/physics.js` — leis fotométricas + unit node.
2. `config.js`/`universe.js` — atributos `lum` (NS 80, Betelgeuse 60, Sol 1.0,
   Siwarha 0.9, Azurak 0.5, Karvon 0.18, palette core 0.3–0.9, Véu 8/0.02).
3. `starfield.js` — rewrite quads instanciados (mantém API build/update + diags).
4. `celestial/starlod.js` (novo) + `system.js` (remove beacons) + `main.js` (wire).
5. `stars.js` — flare ∝ fluxo.
6. `postfx.js` — sanitize.
7. Testes: bloco fotométrico no unit node + `tests/space-war/photometric.spec.js`;
   suíte completa local (TEST_PORT=8189).

## Riscos e mitigação

- **R-1 physics.spec AC-01 (anatomia do pulsar a 400·R):** d=12k → discPx≈3 → modo
  disco; traverse acha os sprites. Verificado no plano de teste — sem mudança.
- **R-2 journey.spec (starfield.stars ≥2000):** contagens preservadas
  (HEADLESS 1400+700). Campo `stars` mantido no diag.
- **R-3 log-depth × ShaderMaterial:** starfield antigo já não escrevia log-depth
  (depthWrite:false, renderOrder −8) — quads mantêm flags idênticas.
- **R-4 headless swiftshader:** asserts por DIAGNÓSTICO (game.starLod/sysGlow),
  não por pixel — imune a rasterização por CPU.
