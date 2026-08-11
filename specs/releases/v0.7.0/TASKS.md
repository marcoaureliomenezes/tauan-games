# TASKS — Release: v0.7.0

> **Status:** Aprovado
> **Release ID:** v0.7.0
> **Spec:** `SPEC.md` · **Plan:** `PLAN.md`

---

## T-01 — Investigações (autópsia web, dossiê Godot, pesquisa OSS) [x]

- **Owner:** project-auditor (3 subagentes explore)
- **Evidência:** M1–M6 root-caused (hairpin wrong-leg capture = "pedras
  invisíveis"); dossiê Godot completo (Idea ~30 partes com coords, sprint A→B,
  chase ~150 linhas); veredito OSS — stack certa, falhas arquiteturais
  (fixed-dt + spline-source-of-truth).

## T-02 — WS-1: colisões invisíveis + fixed timestep + steering [x]

- **Owner:** software-engineer (subagente coder)
- **Write set:** `src/{world.js, physics.js, main.js, cars.js, textures.js}`,
  `tests/corrida/tools/probe.mjs` (novo).
- **Evidência:** probe 11/11 — 0 ghost wall-hits no hairpin mais apertado;
  fence collider FORA da visual (FENCE_OFF 2.55); cápsulas por bbox (truck não
  bate no ar); accumulator 120 Hz (slow-motion impossível, raceT/wall=0.857 a
  ~2 fps); steering −27..−33% por carro em top speed (falloff 1/(1+av/150) —
  /60 overshootava −50%). Suite 5/5.

## T-03 — WS-2: rampas projetadas + regra sem-curva-após-rampa [x]

- **Owner:** software-engineer (subagente coder)
- **Write set:** `src/physics.js` (jump region), `src/world.js` (σ bump),
  `src/tracks.js`, probe PART D/E.
- **Evidência:** vy 0.35→1.1 (1.36 s airborne medido, cap 3+v·0.16, air-drag
  6%/s, landing dip ×1.5); σ físico 5 u (lombada de verdade); 9 bumps movidos
  para retas (κ<0.002 em zona de pouso de 92 u), 1 sacrificado na cidade;
  forest hills amp 22→16 (cristas lançavam para curvas). Probe 36/36, suite 5/5.

## T-04 — WS-3: visual/fundo (parallax, prédios, nuvens, árvores) [x]

- **Owner:** software-engineer (subagente coder)
- **Write set:** `src/{world.js, textures.js, main.js}` (scenery/PMREM apenas).
- **Evidência:** cidade 257→105 draw calls (−59%), texturas GPU 49→27; prédios
  instanciados (pool 7 fachadas), montanhas texturizadas (neve/estrato/mata) +
  anel médio k=0.3, 38 nuvens impostoras, árvores LOD 2 níveis, chão 512²
  multi-escala + overlay, gantry+torcida; dispose do worldRoot + PMREM cacheado.
  Screenshots ws3-*.png verificados. Suite 5/5.

## T-05 — WS-4: Idea Adventure 2013 procedural [x]

- **Owner:** software-engineer (subagente coder)
- **Write set:** `src/idea-model.js` (novo), `src/cars.js` (branch idea).
- **Evidência:** 15 meshes, spec exata do Godot (estepe externo, cladding,
  roof rails, para-brisa rakeado); colLen/colWid 4.15×1.75; rodas giram/esterçam
  com input real (probe 5/5); screenshots ws4-*.png. Suite 5/5.

## T-06 — WS-5: pista sprint A→B + modo perseguição [x]

- **Owner:** software-engineer (subagente coder)
- **Entrega:** "Serra do Tauan" (Tauan City → Vila Serrana, trechos
  dual/single/dirt/ford, 3 crests na regra, cidades visíveis, HUD "Faltam X km")
  + modo Fuga (3 policiais PIT, barra de vida, spike strips, VOCÊ ESCAPOU/PEGO).
- **Evidência:** suite 10/10 (5 novas em sprint.spec.js), probe 42/42 (3 crests
  da sprint com κ<0.002), screenshots ws5-*.png verificados (cidade destino
  visível, vado, perseguição com giroflex + spike). 2 fixes colaterais: finish
  por referência de carro (softlock pós-linha) e sem ré após cruzar a linha.
- **Evidência:** spline aberta (tension 0,22) com profile 2→110→4 m (descida
  trapezoidal slope máx 0,111 < gatilho 0,118 — sem micro-hops); 2.017 m;
  larguras por trecho (dupla 18,4/single 9,4/terra 6,8) + cercas com lacunas
  nos estradões (fenceless no visual E no colisor); 2 vados (lâmina ~90 m,
  superfície water = grip terra + arrasto 1,6); cidades endpoint instanciadas
  (26 caixas pastel/ponta) + pórtico CHEGADA — VILA SERRANA. Probe 42/42 —
  PART E cobre as 3 cristas (decola @60, κmáx 0,0012–0,0019 < 0,002 nas zonas
  de pouso de 87–92 u); PART A/B restritos a pistas fechadas (raceT congela no
  sprint). Suite 10/10 (5 smoke + 5 novos: menu MODO, sprint A→B completo em
  ~47 s com pódio, pancada da polícia tira vida 8, spike strip fura pneu
  (v×0,55 + grip 2 s + 12 dano), finais VOCÊ ESCAPOU e PEGO alcançáveis).
  Fix colateral: chegada do jogador usa `c === G.player` (probes st.ai) e
  carro terminado não engata ré. Screenshots ws5-{sprint-start,ford,
  vila-serrana,chase}.png verificados. `node --check` em todos os arquivos.

## T-07 — Higiene: wheel-geometry leak + spec input-real [x]

- **Owner:** software-engineer
- **Evidência:** `_wheelGeoCache` por modelo (gpuGeo estável 102 em 3 restarts,
  antes +48/restart) + `disposeProcCarGeometries()`; `input.spec.js` novo com 4
  testes de teclado real (acelera, vira sinal correto, salto na sprint, R reseta).
  Suite final: 14/14 (4.3m).

## T-08 — Deletar src/godot/speed-run + memory sync + doctor [x]

- **Owner:** product-engineer
- **Entrega:** colheita concluída → `rm -rf src/godot/speed-run`; atoms
  speed-run (web reescrito: novo estado) e godot (remover); games-catalog;
  doctor 0/0; validação final do operador em browser.
