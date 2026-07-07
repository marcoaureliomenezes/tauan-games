# QA End-of-Alpha Review — space-war-phases-and-roster-v1

- **Data:** 2026-07-07 · **Agente:** qa-engineer · **Branch:** `feature/space-war-phases-and-roster-v1` (6 commits sobre origin/main, HEAD `fdf1d56`)
- **Escopo:** P0 (starfield boundary / Higgs Plummer / nuke gate), P1 (config literais, dead-code, screen rename), P2 (sistemas-como-fases + floating origin), P3 (roster Devorador/Pulsar/Betelgeuse), P4 (polish).

## Verdict: **CHANGES_REQUIRED**

A engenharia é de alta qualidade e os testes existentes são **honestos** (sem slop detectado: nenhuma asserção infalível, sem duplicação, os `waitForTimeout` são janelas de física com asserções reais depois). Mas **três Acceptance Criteria do SPEC não têm evidência de teste** e o gate da nuke sofre do risco "executed-path" (fórmula testada, wiring não). Para rc-1, os gaps abaixo precisam de testes antes do ship.

## Evidência executada (tudo VERDE)

| Suíte | Resultado |
|---|---|
| `tests/space-war/tools/test-physics-unit.js` | 19/19 pass (inclui os 5 testes novos: Higgs Plummer, boundaryFade, escapeSpeed, Eggleton, L1) |
| `tests/space-war/tools/test-celestial-unit.js` | pass |
| `tests/space-war/tools/test-ballistics-unit.js` | pass |
| `TEST_PORT=8394 npx playwright test tests/space-war/journey.spec.js` | 5/5 pass (40.4s) — inclui a asserção nova P0-1 "journey engajada DENTRO do sistema → fade≤0.05 e β≤0.05" |

## O que está BEM coberto

- **P0-1 starfield boundary:** unit (`boundaryFade` monotônico/smoothstep) + e2e (journey.spec:83-89 dentro→sem streaks; cruzeiro β>0.9; chegada). Excelente par unit+e2e.
- **P0-2 Higgs Plummer:** unit exemplar (pico=cap, monotônico, 1/d² verificado por razão a(4k)/a(8k)≈4, zero em reach, taper contínuo) + wiring real em `gravity.js` via `higgsWellAccel` puro. physics.spec exercita o poço vivo.
- **P3 Roche/Eggleton/L1:** unit contra valores publicados (q=1 → 0.3789; resíduo de força ~0 no L1 co-rotante) + invariante config "gigante enche o lóbulo ±5%". AC-06 (metade física) OK.
- **P2 fases (parcial):** photometric.spec agora afirma `sunLod === null` (corpos descarregados) e glow-por-descritor; physics.spec troca de sistema via `loadSystem` e reverifica TOV/hierarquia; proportions.spec usa posição galáctica origin+pos. journey.spec chega em Betelgeuse e ENCONTRA o corpo (load-on-arrival implícito).
- **Roster remap:** todos os specs migraram binary/chaotic/veil → pulsar/devorador coerentemente; `game.phase→game.screen` propagado nos 8 specs.

## Findings (ranqueados)

1. **HIGH — AC-07 sem e2e: fluxo missão pendente → viagem → materialização.** `missions.js:163-238` (`markPending`, `onSystemLoaded`, `onSystemUnloaded`) é o coração do P2 e não há e2e que avance a campanha para a fase 2, verifique `mission.pending === true` + nav mirando o sistema, faça a viagem (journeyWarp) e afirme que `onSystemLoaded` materializou sites/alvos/spawns (e que `killed` é retomado). campaign.spec AC-02/03 só chega até o label "FASE 2". Adicionar 1 teste em campaign.spec.
2. **HIGH — AC-05 sem evidência: dispose sem vazamento.** O SPEC promete "renderer.info sem crescimento monotônico entre fases". Nenhum teste lê `renderer.info`. Adicionar e2e: load/unload N ciclos (`loadSystem('binary')`→`loadSystem('solar')`×3) e afirmar `renderer.info.memory.geometries/textures` estável; incluir `game.enemies.length===0` e `game.projectiles.length===0` pós-unload (`clearEnemies`/`clearProjectiles` hoje sem teste).
3. **MEDIUM — P0-3 nuke gate: fórmula testada, wiring não (executed-path).** O unit cobre `escapeSpeed`; o gate real `bound = inDisk || |v_rel| < 1.5·v_esc` em `weapons.js:296-298` nunca é executado por teste. Um flyby hiperbólico que segue balístico (e o caso capturado co-orbital) precisam de e2e ou sim-node no caminho real.
4. **MEDIUM — AC-04 sem o teste prometido: snapshot de config diff=0.** O SPEC promete "valores finais idênticos aos efetivos de hoje (snapshot antes/depois no teste unit)". Não existe teste de snapshot; só invariantes de massa/geometria. Se o snapshot foi comparado manualmente no T-PR-04, registrar a evidência; senão, comparar `config.js` importado no branch vs origin/main num teste one-shot ou documentar a verificação no PLAN.
5. **MEDIUM — AC-06 (metade visual) sem e2e: teardrop + rocheStream.** proportions.spec AC-03 carrega o binário mas só inspeciona o BH. Falta afirmar no doador: `uTideAmp > 0`, `uTideDir` apontando ao BH, e a existência do TubeGeometry do stream com hot spot (mesmo padrão de traverse já usado no spec).
6. **LOW — world rebase no vazio sem teste.** `world.js` REBASE_LIMIT=1M (origin+=pos, shift hooks p/ projéteis/trilhas) não tem teste. Um e2e que voe/teleporte para o vazio além de 1M e afirme `|ship.pos| < 1M` com `world.origin` deslocado (e trilha de tracer contínua) fecharia o floating origin.
7. **LOW — P4 sem testes: laser inimigo herda frameVel (`weapons.js:63-71`), bias de poço nos inimigos (`enemies.js:159-171`), blend de SOI (`gravity.js:131-137`).** Aceitável para alpha; o blend de SOI mereceria pelo menos um unit de continuidade (w contínuo em domDist=0.9·soi e 1.0·soi) já que `computeGravity` é importável.
8. **INFO — physics.spec AC-02 usa `waitForTimeout(300)` para worldVel.** Preferir `waitForFunction(() => s1.worldVel)` — não é slop (a asserção falha se não vier), mas é uma corrida latente em headless lento.

## Honestidade dos testes — sem objeções

- Sem asserções infalíveis; razões numéricas com tolerâncias justificadas; comentários explicam o porquê físico de cada limiar.
- Sem inflação: 8 specs e2e + 3 units para um jogo deste tamanho está na proporção certa da pirâmide.
- Os testes deletados (chaotic/veil) foram migrados, não silenciados.

## Condição de aprovação

Resolver os findings 1-2 (HIGH) e 3-5 (MEDIUM: teste ou evidência registrada). 6-8 podem ir ao backlog. Rerodar `npm run test:space-war` completo + units e me reinvocar contra o novo commit.
