# SPEC — Release: space-war-photometric-stars-v1

> **Status:** Aprovado — 2026-07-04 (operador: "So fix. Apply R1. Review the neutron
> star. I can barely see it")
> **Origem:** revisão profunda 2026-07-04 (`.dadaia/reports/tauan-games/software-architect/`
> `2026-07-04T043851Z-space-war-simulation-tech-review.html`, apêndice A) + bugs
> `space-war-starfield-fixed-size-points`, `space-war-distant-suns-oversized`,
> `space-war-neutron-star-barely-visible` (todos operator-reported).
> **Base:** feature/space-war-interstellar-journey-v1 (PR #16, stacked). **Segment:** rc-1

## 1. Objetivo

Estrelas são fontes PONTUAIS não-resolvidas: um ponto de PSF de tamanho ~fixo cujo
BRILHO segue o fluxo F ∝ L/d² — nunca um disco que nasce já no tamanho máximo.
Aplicar o cânone dos planetários (Stellarium/Celestia/Gaia Sky) às 3 superfícies:

1. **Starfield da viagem** — quads instanciados fotométricos: nascem apagados na
   borda do wrap, ACENDEM ao aproximar, e só CRESCEM na passagem rasante (glare
   ∝ √(I−1), Spencer 1995). Some o clamp de 7px do `gl_PointSize`.
2. **Estrelas de sistema à distância** — LOD ponto↔disco por tamanho angular
   (θ=2R/d vs pixel, histerese 2px↑/1px↓): sub-pixel vira ponto fotométrico
   (mesh/corona/FBM desligados); corona com TETO de pixels; flare ∝ fluxo (sem
   piso 0.22). Beacons de sistema (sprites de 40k fixos) viram GLOWS fotométricos
   com L = Σ luminosidades dos membros.
3. **Estrela de nêutrons** — pulsar é a fonte pontual mais brilhante do jogo
   (L jogável 80; real Crab ~1.2e5 L☉, comprimido como as massas): ponto
   azul-branco ofuscante e ESTROBOSCÓPICO visível de qualquer sistema — resolve
   "I can barely see it" (disco de R=30 é sub-pixel além de ~36k u).

## 2. Física de referência (apêndice A da revisão)

- Fluxo/magnitude: `F ∝ L/d²`; `m = −2.5·log₁₀F`; `I = 10^(0.4(m_ref−m))` —
  equivalente jogável: `I = L·(D0/d)²` com D0 = distância de gauge.
- PSF: núcleo de tamanho FIXO (1.5–3px); saturou (I>1) → glare cresce ∝ √(I−1)
  (conserva energia — Spencer, SIGGRAPH 1995). Sub-pixel: esmaecer por cobertura
  (α = clamp(I,0,1)), nunca encolher abaixo de 1px.
- Transição ponto↔disco: θ_px = (2R/d)/θ_pixel; sobe a disco em 2px, desce a
  ponto em 1px (histerese anti-flicker — escada Celestia/Gaia Sky).
- Quads instanciados, NÃO GL_POINTS: spec WebGL só garante 1px de teto;
  WebGPU nem tem gl_PointSize (future-proof).
- Relatividade preservada (aberração +β, T′=δT, beaming δ⁴ — AC-04 da journey).

## 3. Acceptance Criteria

- **AC-01 (starfield fotométrico):** starfield em quads instanciados
  (`game.starfield.mode === 'instanced-quads'`, ≥2000 estrelas); intensidade
  I = L·(D0/d)² no shader (espelho GLSL das leis unit-provadas em
  `celestial/physics.js`); fade na borda da célula do wrap; tamanho = núcleo fixo
  + glare √(I−1) com teto. Relatividade da journey intacta (β sobe/desce — e2e
  journey.spec segue verde).
- **AC-02 (LOD ponto↔disco):** toda estrela luminosa tem ponto fotométrico de
  cena; θ_px < 1 → modo ponto (mesh+corona invisíveis); θ_px ≥ 2 → modo disco;
  histerese unit-provada. Diagnóstico `game.starLod[key] = {mode, discPx, I, px}`.
- **AC-03 (corona/flare honestos):** corona com teto em pixels
  (≤ max(3·discPx, px do glare)); flare do Sol ∝ fluxo (FLARE_FULL/d)², sem piso
  0.22 — some o blob de 141px a 4M u. Política/diag `game.sunFlareVisible`
  preservada (regressão AC-10 campanha verde).
- **AC-04 (pulsar visível — operador):** de QUALQUER sistema (d ~5M u), o farol
  fotométrico do binário (fluxo SOMADO dominado pela NS, lum 80/80.7) é visível
  com I > 1, px ≥ 4 e modulado pelo strobe 30 Hz (`game.pulsarStrobe`); dentro do
  sistema (d < 0.9·raio) o glow cede ao PONTO individual da NS (I ≫ 1, px no
  teto, estroboscópico); perto (goTo 400·R) resolve o disco com a anatomia viva
  (physics.spec AC-01 segue verde).
- **AC-05 (glows de sistema):** beacons fixos de 40k substituídos por glows
  fotométricos (L_sys = Σ lum dos membros; some dentro de 0.9·raio do sistema —
  política atual preservada). Diagnóstico `game.sysGlow`.
- **AC-06 (sanitização pré-bloom):** passe de lente clampa NaN/Inf e overbright
  (teto 64) em TODAS as saídas — o bloom nunca mais espalha NaN.
- **AC-07 (regressão):** suíte completa verde (smoke/campanha/física/journey +
  novo photometric.spec); unit node de todas as leis novas; aero intocado.

## 4. Não-escopo

Origem camera-relative, dual-scene/reversed-Z, WebGPU/TSL, pmndrs/postprocessing,
Vite/TS (releases R2/R3 do roteiro). Planetas continuam sem ponto fotométrico
(refletem luz; sub-pixel invisível é honesto).

## 5. Write set

`space-war/src/**`, `tests/space-war/**`, esta pasta, `specs/bugs/` (ADDITIVE).
**Proibido:** `aero-fighters/**`, `tauan-trex/**`, `vendor/**`.
