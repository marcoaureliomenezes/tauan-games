# PLAN — Release: space-war-phases-and-roster-v1

> **Status:** Aprovado — 2026-07-07

Ordem de implementação (cada onda = commit(s) próprios, suíte verde entre ondas):

1. **W1 (P0):** boundary helper único (`systemBoundaryFactor(pos)` em nav ou
   celestial/system) consumido por starfield/postfx/journey; remover floor de
   journey; β_vis = β·boundary. Higgs: perfil Plummer + wellReach em gravity.js
   + higgs.js. Nuke: gate de captura por v_rel/v_esc em weapons.js.
   Testes unit (higgs profile, nuke gate) + e2e journey atualizado.
2. **W2 (P1):** config.js literais finais (script de snapshot gera valores,
   diff = 0); SystemRuntime + dispose; sweep de código morto; rename
   game.phase→game.screen; dados por sistema no registry SYSTEMS.
3. **W3 (P2):** fases — buildSystem(key) na origem + disposeSystem();
   travel-phase sem bodies; nav/map/starlod/journey por descritores; gravity
   sem fallback interestelar por bodies; ship landing parametrizado; debug API
   ganha loadSystem; testes e2e de fase.
4. **W4 (P3):** physics.js: eggletonLobe(q), l1Distance(q) + unit; STAR_VERT
   uTideDir/uTideAmp; curved stream (TubeGeometry em arco L1→disco, rebuild
   barato por frame ou anchored update); universe.js novo roster; remap
   campaign/missions/enemies/map/starlod; menu/config headers.
5. **W5 (P4):** polish (inimigos×wells, laser worldVel, SOI blend, margens,
   pinch gate, solver dt) + passada final de testes.
6. **W6:** QA end-of-alpha, security push-verdict, push, PR, CI verde.

Riscos: (a) rebase-na-origem quebra testes que usam goTo cross-system — debug
API ganha `loadSystem(key)`; (b) colapso do config precisa de snapshot-diff
antes/depois; (c) stream curvo por frame — usar geometria estática re-anchored
(atualizar matriz, não rebuild) como o accretionStream atual já faz.
