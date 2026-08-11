# SPEC — Release: v0.7.0

**Status:** Aprovado
**Release ID:** v0.7.0
**Owner:** product-engineer
**Opened:** 2026-08-10

---

## 1. Problem and context

Operator playtested speed-run (web e Godot, 2026-08-10): Godot = trash (lag,
câmera lenta, M.A.V.S spamming InputMap errors) → deleted. Web tem bug CRÍTICO:
colisões invisíveis no meio da pista ("pedras invisíveis"). Diretiva: o jogo web
deve ficar IMPECÁVEL — colher os elementos superiores do Godot antes de deletá-lo,
corrigir a física/arquitetura, e elevar o visual.

Três investigações fundamentam esta release (evidências em PLAN.md):
1. **Autópsia web**: 6 mecanismos de colisão invisível (M1 hairpin wrong-leg
   capture é o primário); frame-rate coupling global; churn de 90 texturas
   canvas por corrida; steering ~84% authority em alta (twitchy).
2. **Dossiê Godot**: Idea Adventure como spec de ~30 caixas com dimensões
   exatas; formato sprint A→B com cidades; modo perseguição (~150 linhas);
   crests gaussianos; câmera speed-FOV.
3. **Pesquisa OSS**: nossas escolhas de componentes estão CERTAS (Three.js,
   física custom arcade, GLB Quaternius, spline tracks) — as falhas são
   arquiteturais: falta fixed-timestep e spline como fonte única de colisão/
   AI/respawn (padrão da indústria arcade).

## 2. Objective

Speed-run web impecável: zero colisões invisíveis, física frame-rate-independent,
steering calibrado, rampas que projetam (nunca seguidas de curva), visual de
fundo rico (parallax, montanhas, nuvens, árvores, prédios), e os elementos
Godot (Idea, pista sprint, modo perseguição) portados.

## 3. Scope

- **R-01 — Colisões invisíveis ZERO (P0):** M1 validação espacial+temporal do
  `surfaceAt` (nunca capturar perna errada em hairpin; `sHint` rejeita saltos
  implausíveis); M2 cerca visual robusta (alpha coverage); M3 colisor 0.1–0.2
  FORA da cerca visual; M4 colisor por veículo (OBB/cápsula do bbox); M5
  ordenação car-car antes do fence-clamp; M6 grip consistente nas bordas.
- **R-02 — Fixed timestep (P0):** accumulator 60/120 Hz + interpolação de
  render; ruído por segundo; fim do slow-motion <20 FPS.
- **R-03 — Steering (P0):** falloff de sensibilidade em alta velocidade
  (≈−30% em top speed) mantendo agilidade em baixa.
- **R-04 — Rampas (P1):** lançamento garantido (projeção com vy da crista +
  air-drag leve); REGRA DE PISTA: nenhuma curva após rampa — validar/ajustar
  as 3 pistas para que toda lombada tenha trecho reto de aterrissagem.
- **R-05 — Visual/fundo (P1):** prédios instanciados com pool de texturas
  (fim das 90 canvas únicas), anel de nuvens billboard (parallax k≈0.3),
  horizonte texturizado, LOD de árvores, textura de chão com detalhe,
  gantry/crowd no grid.
- **R-06 — Idea Adventure (P2):** reconstruir o box-spec Godot em Three.js
  (~30 partes com coords exatas do dossiê) substituindo o SUV GLB recolorido.
- **R-07 — Pista sprint A→B (P2):** nova pista ponto-a-ponto entre duas
  cidades (formato Godot: trechos dual/single/dirt/ford, cidades visíveis nos
  endpoints, checkpoints por progresso, HUD "Faltam X km").
- **R-08 — Modo perseguição (P2):** polícia com lightbar, barra de vida,
  spike strips, "VOCÊ ESCAPOU/PEGO" — port do dossiê §3.
- **R-09 — Deletar src/godot/speed-run** ao final (colheita concluída).
- **R-10 — Qualidade:** dispose no restart, PMREM cacheado, spec Playwright
  com input REAL (teclado), validação em browser pelo operador.

## 4. Out of scope

- Trocar Three.js ou adotar engine de física WASM (pesquisa confirmou:
  arcade custom é a escolha certa para Cruis'n-style).
- Novas pistas além da sprint (R-07).
- Godot — encerrado para corrida.

## 5. Dependencies and risks

| Risco | Mitigação |
|---|---|
| M1 toca a query central do jogo — regressão sutil | spec Playwright com input real dirigindo hairpins (R-10) antes de marcar done |
| Escopo grande (R-01..R-08) | ordem P0→P2; operador valida em browser após cada workstream |
| Deletar Godot antes dos ports maduros | dossiê completo no PLAN; delete é a ÚLTIMA task |
