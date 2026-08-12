# SPEC — Release: space-war-true-proportions-v1

> **Status:** Aprovado — 2026-07-04 (operador: "HArd bugs about proportions...
> Do hard here. Work heavy." — 9 screenshots + 5 referências em
> `/home/marco/workspace/dadaia/bug-space-war`, todas revisadas uma a uma)
> **Origem:** bugs `space-war-fake-apparent-proportions`,
> `space-war-cross-system-visibility`, `space-war-blackhole-look-not-approved`,
> `space-war-neutron-star-look-not-approved` (operator-reported, HIGH×3+MEDIUM).
> **Base:** feature/space-war-photometric-stars-v1 (PR #17, stacked). **Segment:** rc-1

## 1. Objetivo

Volumes aparentes HONESTOS (θ = 2R/d, como a natureza): corpos crescem quando nos
APROXIMAMOS e encolhem quando viajamos. Sistemas estelares a "anos-luz": de outro
sistema NADA além de um ponto/glow fotométrico — jamais um disco de Saturno.
Buraco negro e estrela de nêutrons dignos das referências do operador.

**Retificação explícita do operador:** a demanda anterior "10× maiores antes da
colisão" foi mal-concebida como inflação ESTÁTICA de raios (wall-scale). O
operador rejeita: "I cannot see the sun so bigger from the earth, it's fake...
they should become bigger while we approach, but small as we travel. Like in
nature." AC-06 da physics-fidelity-v1 fica SUPERSEDED por esta release.

## 2. Acceptance Criteria

- **AC-01 (proporções no sistema solar):** raios de planetas/luas/Sol revertidos
  à escala pré-wall (Terra 2200, Sol 11000, Lua 594…), μ ∝ f revertido junto
  (v_circ/v_esc de superfície preservadas — gauge de T-WR-15). Do chão/órbita
  baixa da Terra o Sol subtende 2°–8° (não ~30°); Saturno visto da Terra < 1°.
  Luas: órbitas re-derivadas (piso 2.1R) com períodos Kepler (√(k³/f)) — a
  velocidade linear volta ao gauge balístico (nuke 1600 alcança a Lua).
  Unit sweep re-adjudica: SOIs sem overlap, luas ⊂ SOI do pai, v_esc do Sol
  derivado do config (não constante mágica).
- **AC-02 (anos-luz entre sistemas):** centros dos sistemas ×5 (anel ~19–29M u);
  SOI/raio do solar volta a conter só Netuno (~2.4M); RENDER.far cobre o anel
  (pontos fotométricos apenas — malhas só no sistema corrente). O CULL vale
  também para o SOLAR (sai o skip) e Betelgeuse perde `alwaysVisible`: de outro
  sistema, TODO sistema é no máximo ponto/glow (solar volta a ter glow, lum 1.0).
  e2e: da vizinhança do buraco negro, nenhum corpo do solar com mesh visível;
  glows/pontos ≤ px de teto; viagem [Z] continua 3:00–6:00 (clamp existente).
- **AC-03 (buraco negro das referências):** BN estelar rs 160→480 (3×), disco
  5× (outer 3200→16 000, inner na ISCO 3·rs, photon ring 2.6·rs, tideKillR
  ~16·rs), shader do disco com ESTRIAS ESPIRAIS turbulentas + borda interna
  branca-quente (referências Sagitário), JATO bipolar no BN estelar (refs),
  monte lenseado proporcional. Sgr A* ganha as estrias/rim (mantém doutrina
  quiescente). e2e: geometria (5×/3×/ISCO/anel) + estruturas no grafo.
- **AC-04 (estrela de nêutrons das referências):** raio visual 30→90, núcleo
  OFUSCANTE branco-azul + halo macio grande, JATOS-AGULHA polares longos e
  brilhantes (needles das refs), gaiola dipolo visível, rotação rápida
  (spin/farol preservados), strobe 30 Hz preservado. e2e: estruturas + jets no
  grafo + raio novo; física (μ TOV, PW rs=R/2.5) coerente.
- **AC-05 (bola de plasma / remanescente):** o remanescente de supernova FADE-IN
  à distância (visível de ≥3× o raio do sistema, opacidade rampa) em vez do
  pop do cull 1.15×; corrente de acreção deixa de ser cano rígido: TUBO ESPIRAL
  curvo (refs) animado caindo no plano do disco. e2e: decoração visível a 2.5×
  raio do sistema (flag), spiral no grafo.
- **AC-06 (nave sem bola azul):** a "bola de plasma" colada à cauda da nave
  (screenshots 02-39/10-46) é eliminada — jato do motor proporcional ao
  throttle, SEM balão esférico em THR 0%; reflexo do casco sutil (sem retângulo
  branco estourado). e2e: relatório da nave (escala do jato ∝ throttle).
- **AC-07 (regressão):** suíte space-war completa + unit node verdes; journey/
  photometric specs adaptados aos novos números via LEIS (não constantes
  mágicas); aero intocado.

## 3. Não-escopo

Origem camera-relative (fp32 nos pontos distantes é subpixel), WebGPU, dual-scene.
Kerr/frame-dragging. Rework do sistema caótico/núcleo além das escalas.

## 4. Write set

`space-war/src/**`, `tests/space-war/**`, esta pasta, `specs/bugs/` (ADDITIVE),
amendment em `specs/releases/space-war-physics-fidelity-v1/SPEC.md` (nota de
supersessão do AC-06). **Proibido:** `aero-fighters/**`, `vendor/**`.
