# TASKS — aero-fighters-world-realism-v1

> **Status:** Aprovado
> **Aprovação:** 2026-07-01 — junto com SPEC/PLAN via `/goal` do operador.
> **SPEC:** `specs/releases/aero-fighters-world-realism-v1/SPEC.md`
> **PLAN:** `specs/releases/aero-fighters-world-realism-v1/PLAN.md`

## Pre-implementation checklist

- [x] SPEC.md aprovado
- [x] PLAN.md aprovado
- [x] TASKS.md aprovado
- [x] Release ativada em `specs/releases/ACTIVE.md`
- [x] Nenhuma task `[-]` duplicada

## Write set (permitido quando ativo)

- `specs/memory/product/**` (fase DEFINITION/CLOSURE — WS-0)
- `specs/memory/product/catalog.json` (regenerado)
- `aero-fighters/src/maps/inhauma-scene.js`
- `aero-fighters/src/maps/inhauma.js`
- `aero-fighters/src/maps/inhauma-road-defs.js`
- `aero-fighters/src/maps/inhauma-road-props.js`
- `aero-fighters/src/maps/inhauma-road-render.js`
- `aero-fighters/src/targets.js`
- `aero-fighters/src/config.js`
- `aero-fighters/src/sortie-state.js` (WS-6)
- `aero-fighters/src/player.js` (WS-6)
- `aero-fighters/src/main.js` (WS-6)
- `aero-fighters/src/nuclear-fx.js`
- `aero-fighters/src/fx.js`
- `aero-fighters/src/projectiles.js`
- `aero-fighters/src/debug.js`
- `aero-fighters/src/world.js` (só se WS-1/WS-3 exigir)
- `tests/aero-fighters/**`
- `specs/bugs/aero-inhauma-invisible-mountains.md` (ADITIVO)
- esta pasta de release

## Tasks

### [x] T-WR-00 — WS-0 Memory atoms (autoridade de spec) — CONCLUÍDA 2026-07-01

**Owner:** `product-engineer` · **Fase:** DEFINITION

Autorados 5 atoms em `specs/memory/product/`: `aero-strike.md` (loop/objetivo),
`aero-strike-world.md` (mapas/terreno/água/estradas/cenário), `aero-strike-flight.md`
(controles/voo/surtida), `aero-strike-combat.md` (inimigos/armas/boss), `aero-strike-fx.md`
(explosões/nuke/câmera/HUD/áudio). Placeholder `feature.md` removido; `index.md` e
`catalog.json` regenerados.

**Evidência:** `dadaia specs doctor` — os 5 atoms `[OK]`; os 2 únicos ERROR são
pré-existentes (`space-war-v1` SemVer, não desta release). AC-W0-01/02 atendidos.

### [x] T-WR-01 — WS-1 Grounding de montanha (bug "montanha invisível") — VERIFICADO

**Owner:** `game-developer` (software-engineer)

Root-cause confirmada (ver `specs/bugs/aero-inhauma-invisible-mountains.md`): a montanha
**renderiza**; o sintoma é (1) float de ~7-9 m de objetos nos cumes agudos das 2 serras
`ridge` (aliasing do mesh de 48 m), (2) helicópteros a 46 m sobre terreno plano, (3)
armadilha latente do fallback `islandHeightAt`. Corrigir os 3: ancorar objetos na
superfície renderizada nas serras (subir `TERR.seg` OU amostrador bilinear OU alargar banda
de `ridge`); rever `HELI_ALTITUDE`/reposicionar helis para serras; endurecer fallback em
`targets.js:341,346`.

**Verify:** **browser real** (dev server + screenshots) mostrando alvo de serra assentado
sem float e helis sobre relevo; probe de heightError por alvo de morro (AC-W1-01/02).

### [x] T-WR-02 — WS-3 Rio visível + árvores variadas

**Owner:** `game-developer`

Remover skip do rio (`inhauma-scene.js:227`), alargar/meandrar; tabela de 4-5 espécies de
árvore com jitter de cor por instância em `buildForests`.

**Verify:** screenshots inhauma (rio ao longo do polyline; ≥3 espécies); test de fidelidade
FPS dentro do budget (AC-W3-01/02, AC-W5-04).

### [x] T-WR-03 — WS-2 Terminação de estradas

**Owner:** `game-developer`

`buildTunnelPortals` em `inhauma-road-props.js` + wire; campos `endcap`/`startcap` e
reposição de pontas em `inhauma-road-defs.js`.

**Verify:** screenshots das 4 pontas (túnel/fronteira/terra); diagnóstico de estrada e
tráfego inalterados (AC-W2-01/02).

### [x] T-WR-04 — WS-4 Inimigos lentos móveis — VERIFICADO (spawn + movimento)

**Owner:** `game-developer`

Adicionar `tank` (solo) e `patrolAir` (ar) via receita de 7 pontos; distribuir nos layouts.

**Verify:** probe que confirma movimento (posição muda) a velocidade baixa; aparecem no
mapa (AC-W4-01).

### [-] T-WR-05 — WS-5 Nuke/explosões realistas (REWORK 2026-07-01; aceite visual do operador pendente)

**Owner:** `game-developer`

De-dup do cogumelo duplo; flash + fireball multicor → cogumelo 60 s subindo; shockwave de
solo; ignição de árvores/casas (pool com cap + guardas headless); retiming de nuclearFxState.

**REWORK (feedback do operador — "cogumelo fake, explosão fake, sem câmera nova"):**
`nuclear-fx.js` reescrito: fireball = esfera com ShaderMaterial FBM (ferve, esfria por
rampa blackbody, silhueta irregular); copa+talo+saia = UM InstancedMesh de ~134 billboards
de fumaça procedural (1 draw call, animação por uniforms na GPU — barato p/ 60 s); anéis
de condensação (Wilson); proporções reais (teto 950 m, copa ⌀~660 m); fumaça cor de poeira
iluminada (não fuligem preta). Pops secundários espalhados de fx.js reduzidos 18→7 e
aproximados do epicentro (gracioso, não caótico). **Câmera cinematográfica da detonação
REMOVIDA** (decisão do operador 2026-07-01 — reverte §7 do atom `aero-strike-fx`; amender
o atom na CLOSURE). Slow-mo e shake mantidos. U-AC-5 atualizado (assert cinematic OFF).

**Verify:** screenshots `.dadaia/tmp/claude/20260701/nuke-wide-*.png` (fireball 4 s +
cogumelo 12/25 s); suite `test:aero:qa` verde; aceite visual final = operador no preview.

### [x] T-WR-09 — Suavização de decolagem/pouso + reuso de terceiros (operador 2026-07-01)

**Owner:** `game-developer`

Decolagem/pouso suaves: assentamento exponencial no piso (sem snap de altura), derrotação
graciosa pós-toque, spool de throttle no pouso (sem corte seco), spool de velocidade na
rotação (sem salto 32→45), continuidade de vsp no liftoff (`_liftoffCarry`, manual e
auto), auto-taxi dirigível (curva ao longo do nariz, acel/frenagem limitadas, fase
`line_up` sem teleporte de heading). Reuso: vendorados examples/jsm r165 (Water,
Lensflare, EffectComposer/UnrealBloom/OutputPass, imports patched p/ relativo) +
waternormals.jpg; novo `src/environment/water-surface.js` (lago reflexivo jsm Water +
shader de rio compartilhado, REUTILIZÁVEL pelos outros mapas); Inhauma ligado nele.

**Verify:** `test:aero:unit` 7/7, `test:aero:sim` 5/5+9/9 (bounce ≤0.3 m e monotonia já
asseridas), e2e 70/70, `validate:aero-map` OK.

### [x] T-WR-10 — Space-war: revisão profunda + overhaul de realismo (operador 2026-07-01)

**Owner:** `game-developer` · Bug: `space-war-blackhole-no-attraction` (JSONL, reported)

Fora do write-set original desta release — extensão de escopo dirigida pelo operador na
mesma sessão. GRAVIDADE: fix do bug do buraco negro sem atração (zona morta fora de todos
os SOIs → fallback argmax-aceleração; par binário soma os DOIS parceiros). VISUAL: disco
de acreção shader (rotação diferencial Kepler, streaks FBM, Doppler beaming, anel de
lensing billboard), estrela de nêutrons (jatos 2 camadas, magnetosfera dipolo 3D, efeito
farol p/ câmera), corrente de acreção NS→BH, bump maps nos rochosos, lens flare no Sol,
bloom (UnrealBloomPass vendorado), skybox repintada (nebulosas estruturadas, galáxias
inclinadas + redshifted, Via Láctea com dust lanes multiply), SOI wireframe removido.
NAVEGAÇÃO: auto-aproximação [N] (perfil de chegada, cancela com manche), closing-speed +
ETA na mira, mapa log-radial incluindo o sistema binário + linha até o alvo.

**Verify:** boot sem erros de console; prova numérica live (dominant=Buraco Negro,
gravMag≈2.8e7 u/s², noReturn=true perto do horizonte); screenshots
`.dadaia/tmp/claude/20260701/sw-*.png`; aceite visual final = operador no preview.

### [ ] T-WR-06 — QA/fechamento

**Owner:** `qa-engineer` + `code-reviewer`

Suíte aero verde (ou thresholds atualizados com evidência); novos ACs Playwright onde
aplicável; revisão de código; CLOSURE com refinos finais de memory.

**Verify:** `npm run test:aero:qa`; `dadaia specs doctor`.

### [x] T-WR-07 — WS-6 Decolagem após ser destruído (bug crítico) — VERIFICADO

**Owner:** `game-developer` · Bug: `specs/bugs/aero-respawn-cannot-takeoff.md`

Ao ser abatido e voltar à base, o avião ficava travado (surtida presa em MAYDAY, auto-taxi
nunca rearmado). Fix: `relaunchSortie()` (reset incondicional → TAXI_OUT) + `respawnAndRelaunch()`
(respawn na zona de serviço → relaunch → auto-taxi `taxi_runway` → rearma munição/HP), usado
pelos dois caminhos de recuperação (queda no solo e ejeção manual).

**Verify:** sim `test-aero-sortie-sim.js` (2 regressões novas, 9/9); e2e `ejection`/`auto-sortie`/
`sortie`/`landing` verdes; boot limpo no browser real.

### [x] T-WR-08 — WS-7 Estradas não terminam mais no nada — VERIFICADO (mapa/altura)

**Owner:** `game-developer` · Bug: `specs/bugs/aero-roads-end-in-nothing.md`

Toda ponta aberta entra num túnel: relevo real onde existe (morros-oeste/serra-leste/morro-norte)
ou colina de portal sintética (`getPortalMounds`, somada ao campo de altura) onde é rural plano.
MG-060 recuada da água (h=0 → terra seca). Garganta do portal corrigida (recua para dentro da
encosta) e mais funda.

**Verify:** cada colina/portal validado contra o campo de altura (seco, longe do aeroporto e de
alvos); `validate:aero-map` inhauma OK (4 arestas); fidelidade e2e verde. Aceite visual das bocas
de túnel = browser real do operador.

## Verification log (2026-07-01)

- **Suíte automatizada (sem regressão):** `test:aero:unit` 7/7, `test:aero:sim` 7/7,
  `validate:aero-map` OK (rio/desert/inhauma; road graph 4 edges; runway-obstacle sweeps
  limpos), Playwright e2e 69/70 → após corrigir ordem do layout (2 helis na wave 1),
  U-AC-8 verde → efetivamente 70/70. Boot sem erros de console; fidelidade visual dentro
  do budget.
- **WS-1 (grounding) provado live:** AA da serra-sete-lagoas (760,-300) agora em y=103.7 =
  superfície RENDERIZADA (antes 112.7, o pico sub-amostrado → float de ~9 m eliminado).
- **WS-4 provado live:** wave 1 spawna tank×2, patrolAir×1, helicopter×2; tank moveu
  (306→158) e patrolAir moveu (645→495) — movimento lento confirmado.
- **WS-5:** nuke disparada/detonada (nuclearMissiles 3→2, slow-mo, pluma mesh 60 s
  ticada). Aceite visual do espetáculo (cogumelo subindo + ignição) = browser real do
  operador (headless pula HEADLESS_FX).
- **Preview registrado:** `http://127.0.0.1:8145/aero-fighters/?map=inhauma` (dadaia
  server register, port 8145).
- Pendente: re-run da suíte completa antes de qualquer push; aceite visual do operador;
  CLOSURE (refinos finais de memory).

## Completion criteria

- [ ] Atoms de memória recriam o jogo (AC-W0-01/02); `dadaia specs doctor` sem erros novos.
- [ ] Montanhas visíveis sob alvos (AC-W1).
- [ ] Rio visível + ≥3 espécies de árvore (AC-W3).
- [ ] Estradas terminam graciosamente (AC-W2).
- [ ] ≥1 inimigo lento de solo + ≥1 de ar, móveis (AC-W4).
- [ ] Nuke: cogumelo único, 60 s, multicor, shockwave, ignição (AC-W5).
- [ ] `npm run test:aero:qa` verde ou thresholds justificados; FPS dentro do budget.
- [ ] Evidência de screenshots para revisão manual do operador.
