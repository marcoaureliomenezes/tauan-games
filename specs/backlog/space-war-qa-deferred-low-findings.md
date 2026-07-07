# space-war — achados LOW/INFO deferidos da QA end-of-alpha (phases-and-roster-v1)

**Origem:** specs/audits/2026-07-07-qa-space-war-phases-roster.md (achados 6–8,
deferidos com aval da QA na re-verificação do commit 5e707b2).

- [ ] **QA-6 (LOW):** teste do rebase de floating-origin do vazio (world.js:
  REBASE_LIMIT 1M + shift hooks — nave/câmera/partículas/projéteis/trilhas).
  Sugestão: e2e que aborta uma journey no meio do vazio e assere continuidade
  visual (posição da câmera relativa à nave invariante ao rebase).
- [ ] **QA-7 (LOW):** cobertura P4 — laser inimigo herda worldVel do âncora;
  bias de poço de Higgs nos inimigos; unit de continuidade de computeGravity
  na fronteira 0.9/1.0·soi (blend da aceleração de frame).
- [ ] **QA-8 (INFO):** physics.spec AC-02 usa waitForTimeout(300) p/ worldVel —
  trocar por waitForFunction (raça latente, não flakou até hoje).
