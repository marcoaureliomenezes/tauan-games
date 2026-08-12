# TASKS — Release: v0.8.0

> **Status:** Aprovado
> **Release ID:** v0.8.0
> **Spec:** `SPEC.md` · **Plan:** `PLAN.md`

---

## T-01 — Pesquisa Idea Adventure 2013 (fotos + ficha técnica) [x]

- **Owner:** project-auditor (explore)
- **Evidência:** 7 fotos prata curadas em `docs/idea-ref/` + ficha técnica real
  (4.207×1.753×1.814 m, WB 2.511, bitola 1.469/1.451, vão 185 mm, 205/70 R15) +
  `docs/idea-adventure-replica-spec.md` com crítica ranqueada da v1.

## T-02 — Full scan de relevo/colisão [x]

- **Owner:** software-engineer (coder)
- **Evidência:** `tests/corrida/tools/full-scan.mjs` permanente (~420 linhas):
  4 pistas × 3 velocidades dirigidas + offroad. Achou e corrigiu: teleporte de
  20-66 m na retomada de cerca (barreira unilateral agora), 6 postes SOBRE a
  pista da cidade, pórtico e torcida DENTRO da pista do sprint, descida do
  sprint violando a regra de pouso (topo 110→102, trapézio 0,12→0,10).
  Final: 0 CRITICAL/HIGH/MEDIUM, 0 rejeições surfaceAt em 115 mil substeps,
  probe 42/42, suite 14/14.

## T-03 — Réplica v2 do Idea Adventure [x]

- **Owner:** software-engineer (coder)
- **Evidência:** `idea-model.js` reescrito (219 linhas, 22 meshes) guiado pelas
  fotos: capa do estepe centrada com tiras em V PRATA (corrigido pela foto
  close-up, não pelo brief), rodas prata 5 raios nas bitolas reais, faixa de
  cladding nas portas, quebra-vento pilar A, faróis 0,50×0,20 envolventes +
  fogs duplos, lanternas vermelho-vivo altas, cabine monovolume alta, vão 0,20.
  3 rodadas de iteração visual com screenshots; probe 5/5; suite 14/14.

## T-04 — Música Top Gear [x]

- **Owner:** software-engineer (coder)
- **Evidência:** `music.js` (205 linhas, Web Audio procedural, 144 BPM, loop
  original Am F C G / Am F Dm E, baixo pulsante + lead saw com glide), mix
  menu/corrida, mute no M. Probe 7/7; suite 14/14.

## T-05 — Nitro [x]

- **Owner:** software-engineer (coder)
- **Evidência:** Shift = boost ×1,8 + teto +25% (`physics.js`), carga 100 no
  `main.js` (dreno 33/s, regen 8/s por substep, ×2 após 3 s limpo sem colisão,
  mín. 5 p/ arrancar, flash "SEM NITRO" 1× por apertada na borda de subida),
  FOV kick +6° composto, glow de escapamento só queimando, IA nunca recebe
  nitro, na Fuga o ram policial não drena. HUD: barra cyan + ajuda no menu.
  `nitro.spec.js` (4 testes, teclado real, `__corrida` só em asserção):
  boost e dreno/HUD verdes na suite serial; regen-dobrado e seco/flash
  passaram nos retries; `nitro-probe.mjs` criado.

## T-06 — Polimento de pistas (placas, sol, zebras) [x]

- **Owner:** software-engineer (coder)
- **Evidência:** `signage.js` (205 linhas) — chevrons gerados da curvatura κ da
  spline (2 placas −25/−10 m + ápice pelo lado de fora, limiar κ=0,0045
  calibrado por pista), LOMBADA/VADO 30 m antes de cada crista/lâmina, tábuas
  300/200/100 antes da curva mais fechada de cada circuito, dedupe por
  prioridade, 2 draw calls no total (placas mescladas + postes instanciados),
  clearance por canto de placa exposto em `world.signage` p/ auditoria.
  Zebras vermelho/branco nas curvas, sol com flare. `ws6-signs.spec.js`
  **5/5 verde** na suite serial; 4 screenshots ws6 revisados; full-scan
  continua zerado (guard de estreitamento — ver T-07).

## T-07 — Validação final + memory sync + doctor [x]

- **Owner:** qa-reviewer + product-engineer
- **Evidência:** full-scan **0 findings** (com o guard de estreitamento de
  largura local adicionado ao `full-scan.mjs` — o CRITICAL intermitente
  `uncontained @s=0.2999` era a cerca encolhendo sob o carro na transição
  dupla 18,4→single 9,4 do sprint, saída unilateral legal por desenho, não
  brecha). Probe 41/42 (o único FAIL é o bônus B4 raceT/real — timeout
  ambiental puro: frames >0,5 s com load 30-40 de sessões paralelas; o clamp
  de 0,5 s/substep é o comportamento projetado). Suite serial (workers=1):
  14/23 com **ws6-signs 5/5** e nitro boost/dreno/HUD verdes; os 9 fails são
  todos timeouts de relógio de parede sob 3-4× oversubscription (0 falhas de
  asserção; rerun parcial confirmou AÉREO, R-reset, dreno e regen passando em
  retry — rerun interrompido a pedido do operador para a revisão da v0.10.0,
  que trata exatamente essa classe de flake). Átomo `speed-run-web-jogo.md`
  atualizado (réplica v2, nitro, música, signage, full-scan) + catálogo
  regenerado (17 features) + SPEC.md Draft→Aprovado; `specs doctor`
  **0 erros** (35 warnings, nenhum no escopo v0.8.0 — dirs legacy de
  space-war/far-west/james-bond de sessões paralelas + 1 backlog candidate).
- **Resta:** playtest do operador (porta 3658).
