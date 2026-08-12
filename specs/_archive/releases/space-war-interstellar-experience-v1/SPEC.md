# SPEC — Release: space-war-interstellar-experience-v1

> **Status:** Aprovado — 2026-07-04 (operador: "Nossa viagem interestelar precisa
> estar impecável" — 3 pontos + perfil 30/40/30 + sem colisão)
> **Origem:** bug `space-war-interstellar-experience-flat` (operator-reported,
> HIGH) + brief `physics-brief-relativistic-passage.md` (referências).
> **Base:** feature/space-war-true-proportions-v1 (PR #18, stacked). **Segment:** rc-1

## 1. Objetivo (a demanda literal, entendida)

1. **Estrelas que cruzamos CRESCEM**: estrela perto do centro da tela (nossa
   trajetória) tem parâmetro de impacto pequeno — ao nos aproximarmos dela,
   ANTES de cruzá-la, seu tamanho aparente cresce (θ = 2R/d — d despenca perto
   da passagem). Estrelas que se afastam do centro não crescem. Hoje tudo fica
   ponto pequeno (teto de 12px).
2. **Concentração à frente MUITO mais evidente** (headlight): a β≈0.995 uma
   estrela a 90° aparece a arccos(0.995) ≈ 5.7° — o céu inteiro se agrupa num
   cone frontal brilhante (beaming δ⁴) enquanto a traseira esvazia. Hoje o β
   visual mal chega a 0.985 por instantes (pico do brachistochrone).
3. **Parallax + alongamento**: estrelas passando perto varrem taxa angular
   enorme (ω = v·senθ/d) — viram RISCOS tangenciais (persistência de visão,
   como nos sims de referência), não pontos estáticos.
4. **Perfil 30/40/30**: 30% do tempo acelerando, 40% em velocidade MÁXIMA
   (cruzeiro — o efeito relativístico dura), 30% freando.
   v_max = D/(0.7T), a = v_max/(0.3T).
5. **Sem colisão na viagem**: impossível colidir com corpos durante a queima
   (REVERTE o abort-por-impacto do rc-1 da journey, por demanda explícita).

## 2. Acceptance Criteria

- **AC-01 (perfil trapezoidal):** `journeyProfileTrapezoid` puro em physics.js:
  x(T)=D exato, v contínua em s=0.3/0.7, cruzeiro plano em v_max=D/(0.7T),
  fases 'accel'/'coast'/'decel'. Unit node. journey.js usa o novo perfil;
  β_visual = 0.995·v/v_max; HUD mostra ACELERANDO/CRUZEIRO/FREANDO.
- **AC-02 (crescimento na passagem):** starfield ganha pseudo-raio por estrela
  (iRad): px += 2·iRad/(d·θ_px) com teto suave (~48px) — passagens próximas
  CRESCEM antes de cruzar; distantes ficam pontos. Diag `game.starfieldFx`.
- **AC-03 (headlight forte):** β até 0.995 no cruzeiro (40% do tempo);
  beaming clamp 5→9; traseira até 0.02. e2e: em coast, β ≥ 0.98 e uniformes.
- **AC-04 (riscos tangenciais):** quad alongado na direção radial-de-tela do
  fluxo aparente, comprimento ∝ ω = v·senθ_ap/d (clamp) — estrelas próximas
  viram riscos ao passar; paradas, voltam a pontos (streak 0 → PSF circular).
- **AC-05 (imunidade):** durante a viagem, contato com superfície NÃO aborta
  nem mata (diag `journey.immune`); chegada/aborto manual intactos.
- **AC-06 (regressão):** suíte space-war completa verde; journey.spec adaptado
  ao trapezoide (β sobe→PLATÔ→cai); aero intocado.

## 3. Não-escopo

Dilatação temporal, starbow (segue mito), warp-tunnel de cinema, geração de
sistemas no corredor.

## 4. Write set

`space-war/src/{journey.js,starfield.js,hud.js,celestial/physics.js}`,
`tests/space-war/**`, esta pasta. **Proibido:** `aero-fighters/**`, `vendor/**`.
