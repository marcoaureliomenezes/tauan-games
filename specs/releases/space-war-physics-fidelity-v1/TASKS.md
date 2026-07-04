# TASKS — Release: space-war-physics-fidelity-v1

> **Status:** Aprovado — 2026-07-04 · **SPEC:** [Aprovado] · **PLAN:** [Aprovado]

## Write set

`space-war/src/**`, `tests/space-war/**`, `package.json`, esta release.
**PROIBIDO:** `aero-fighters/**`, `tauan-trex/**`, `vendor/**`.

## Tasks

- [x] T-PF-01 Config/massas: μ_NS 2.0e12 (TOV), μ_SgrA 4.0e13 + disco mais tênue,
      companheira Betelgeuse, disco.inner = 3·rs (binário 480 / sgr 2700), photonRing
      2.6·rs. Estrelas S rederivam. **AC-02, AC-03(geometria).**
- [x] T-PF-02 NS BRILHA: light def + núcleo emissivo azul-branco + corona + halo +
      strobe óptico ~30 Hz + toro/jatos mais vivos. Mata o bug
      `space-war-neutron-star-too-dim`. **AC-01.**
- [x] T-PF-03 Corrente de acreção re-narrada: gás do REMANESCENTE → disco do BN. **P1-4.**
- [x] T-PF-04 Paczyński–Wiita kind-gated + zona de dano de maré + unit test
      (ISCO 3.5rs estável / 2.9rs mergulha; gradiente de maré). **AC-03, AC-04.**
- [x] T-PF-05 Beaming 0.35/0.85 + lightForMass (D-7) + assist fade em SOI (D-6). **P2-9/11/12.**
- [x] T-PF-06 [G] Bomba traçadora gravitacional: infinita, luminosa, trilha. **AC-05.**
- [x] T-PF-07 [H] Bomba de Higgs: game.wells em computeGravity, braços de plasma
      (estica/reabsorve), roll 30/70, mergulho→supernova, supernova multicolorida
      H/O/S + dano. **AC-05.**
- [x] T-PF-08 Escala dinâmica de aproximação (D-5): renderScale, raio efetivo em
      contato/gravidade/pouso/bases, trilhos de luas expandem, caps por tipo,
      probe de horizonte-reto. **AC-06.**
- [x] T-PF-09 e2e novos + suíte completa verde + QA + security + push/PR/CI. **AC-07.**
