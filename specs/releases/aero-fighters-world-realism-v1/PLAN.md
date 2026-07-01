# PLAN — aero-fighters-world-realism-v1

> **Status:** Aprovado
> **Aprovação:** 2026-07-01 — junto com SPEC via `/goal` do operador.
> **SPEC:** `specs/releases/aero-fighters-world-realism-v1/SPEC.md`
> **Política:** ≤ 300 linhas. Anchors file:line são de reconhecimento read-only
> (2026-07-01); reconfirmar antes de editar.

Todos os caminhos são relativos a `aero-fighters/`.

## WS-0 — Memory atoms (fase DEFINITION)

Autorar em `specs/memory/product/`:

- `aero-strike.md` — loop: boot → map-select → `startGame` → `spawnMission` (WAVE_SIZES
  [10,14,20]) → destruir alvos → boss → sortie RTB/land/service → próxima. 3 vidas × 3 HP.
- `aero-strike-world.md` — 4 mapas (`maps/index.js` MAP_KEYS islands/desert/rio/inhauma);
  `surfaceInfoAt(x,z)→{height,kind}` (`world.js:219-242`) é a verdade única;
  `checkTerrainCollision` (`world.js:247-256`); inhauma heightfield contínuo
  (`inhaumaContinuousHeight` `inhauma-scene.js:81`, FBM+ridged+features−carve), chunks
  reciclados (`buildInhaumaTerrain` `inhauma-scene.js:175-193`), água WATER_LEVEL 4.5,
  RIVER polyline, estradas (4 corredores spline), árvores (`buildForests`), estruturas.
- `aero-strike-flight.md` — controles (↑=nariz DOWN invertido; ↓=UP; A/D roll+yaw; Q/E
  rudder; W/S throttle; Space canhão; X/B/T mísseis; C câmera; Shift roll; J eject),
  modelo de energia (constantes de `config.js:6-39`), FSM sortie (`sortie-state.js`),
  aeroporto (`airport.js`), auto-taxi (`auto-taxi.js`), pouso (FLARE_LO 2.2).
- `aero-strike-combat.md` — 8 alvos (`config.js:98-107` + `targets.js` MAKERS), boss
  (`boss.js` HP 200), ally-war (`wingmen.js`+`ally-war.js`), armas (`config.js:42-107`),
  lock-on (`crosshair.js` cone ±15°).
- `aero-strike-fx.md` — `fx.js` (pools + explosion/megaExplosion + nuclearExplosion),
  `nuclear-fx.js` (mesh mushroom + nuclearFxState), `factory-fx.js`, câmera cinematográfica
  da nuke, HUD, áudio sintetizado.

Depois: `dadaia memory catalog generate` + `dadaia specs doctor`.

## WS-1 — Montanhas visíveis

Arquivos: `src/maps/inhauma-scene.js` (`buildInhaumaTerrain`/`updateInfiniteTerrain`
`:175-193`, `INHAUMA_FEATURES` `:28-50`), `src/maps/inhauma.js`, possivelmente
`src/config.js` (raio de chunks).

1. Ler `buildInhaumaTerrain`/`updateInfiniteTerrain` e confirmar a causa: chunks só cobrem
   `N×N` ao redor do player; serras distantes (serra-leste ~1300,120 peak 97; serra Sete
   Lagoas 760,-300) ficam sem chunk quando o player está longe, mas alvos de morro (AA em
   760,-300; helicópteros) sentam na altura absoluta → flutuam sobre "nada".
2. Correção (escolher a de menor custo que resolva o AC):
   - (a) Aumentar cobertura de chunks para englobar as features nomeadas (mais draw calls);
   - (b) Renderizar as `INHAUMA_FEATURES` (serras) como meshes de morro dedicados sempre
     presentes (baixo custo — poucas features), sobrepostos ao heightfield, garantindo
     que todo alvo de morro tenha terreno visível sob si; ou
   - (c) Ancorar chunks extras nas coordenadas das features além do anel do player.
   Preferir (b) se as features forem poucas e localizadas (mais barato que ampliar o anel).
3. Verificação: probe Playwright que, para cada entrada de morro de `TARGET_LAYOUT_INHAUMA`,
   faz raycast para baixo a partir do alvo e confirma interseção com mesh de terreno
   próximo à `inhaumaContinuousHeight(x,z)`.

## WS-2 — Terminação de estradas

Arquivos: `src/maps/inhauma-road-props.js` (novo `buildTunnelPortals`, wire em
`addRoadDetailProps` `:159-165`, já chamado de `inhauma-road-render.js:116`);
`src/maps/inhauma-road-defs.js` (corredores `:23-46`, `buildRoadsFromDefs` `:89-106` —
adicionar campo `endcap`/`startcap`).

1. `buildTunnelPortals(roads, heightAt, material)`: por corredor com `endcap:'tunnel'`
   (ou `startcap`), posição+tangente via `samplePolyline(road.points, routeLength-1)` /
   `samplePolyline(road.points, 1)`; Group = 2 pilares + lintel + garganta escura
   (`BoxGeometry`, material concreto `0xb9b9b3`), `rotation.set(0, ang, 0)`, senta em
   `heightAt(x,z)`. 2-4 portais, Meshes simples.
2. Reposicionar pontas em `inhauma-road-defs.js`:
   - `mg-238` NE: append `[1330,-150],[1335,-70]`, `endcap:'tunnel'` (flanco serra-leste).
   - `amg-0360` início: `startcap:'tunnel'` (flanco morro-norte, já a ~40 m).
   - `amg-0360` norte / `mg-060` norte: estender último ponto ~250 m na tangente (some no
     fog).
   - `mg-060` sul: terminar ~(-800,400) em terra seca (NÃO no vértice de rio submerso).
3. Não quebrar importabilidade Node de `inhauma-road-defs.js` (portal geo fica no lado
   THREE em `-road-props.js`).

## WS-3 — Árvores + rio

Árvores — `src/maps/inhauma-scene.js` `buildForests` `:332-363`:
1. Tabela de espécies (const de módulo): 4-5 entradas {trunkGeo, crownGeo, crownColor(s),
   faixa de escala/altura}. Ex.: pinho (cone estreito, verde escuro), folhosa (copa
   Icosahedron/Sphere, verde médio), arbusto (sem tronco, esfera baixa, oliva), seca
   (marrom), palmeira (reuso de `scatterPalms`).
2. 1 par de InstancedMesh por espécie; bucketizar os pontos espalhados por banda de
   altitude (`h` em `:339-345`) e `game.rng` para variedade.
3. Jitter de cor por instância via `instanceColor` (copiar padrão de `buildTown`
   `:388-398`). Manter `frustumCulled=false`, `castShadow=false`.

Rio — `src/maps/inhauma-scene.js` `buildInhaumaWater` `:214-235`:
1. Remover/relaxar o skip a montante `if ((a.x+a.z) < (DAM.x+DAM.z)-40) continue;` (`:227`)
   → toda aresta `RIVER[i]→RIVER[i+1]` desenha fita.
2. Alargar `RIVER_W` (`:21`) e/ou adicionar pontos a `RIVER` (`:17-20`) para meandro. Vale
   já escavado (`inhaumaBaseHeight` `:62-71`); sem mudança de terreno.
3. Onde estrada cruza rio: rotear ao redor (editar `RIVER`/road-defs) ou ponte (reuso de
   `buildDam` `:240-262`). Árvores já evitam o rio (filtro `:343`).

## WS-4 — Inimigos lentos móveis

Arquivos: `src/targets.js` (MAKERS `:281-290`, spawnTarget `:330-413`, updateTargets
`:458-469`, killTarget `:422-452`), `src/config.js` (TARGETS `:98-107`, SLOW_TARGETS
`:123-132`, TARGET_LAYOUT* `:184/214/233/260`).

Para `tank` (solo) e `patrolAir` (ar), replicar o padrão `armedConvoy`/`helicopter`:
1. `makeTank()`/`makePatrolAir()` + registrar em MAKERS.
2. Linha em TARGETS (hp/score/hr2/dropChance).
3. Constantes em SLOW_TARGETS: `TANK_SPEED 6`, `TANK_RANGE`, `TANK_INTERVAL`;
   `PATROLAIR_SPEED ~7`, `PATROLAIR_ALTITUDE ~90`, range/interval.
4. spawnTarget: adicionar tipos à linha `airborneAltitude` (`:356`, tank=0,
   patrolAir=alt), ao bloco de path (`:384-388`, `pathNear`), e às ternárias
   `fireInterval`/`range` (`:397-403`).
5. Dispatch em updateTargets: `updateTank`/`updatePatrolAir` = one-liners chamando
   `updatePathTarget(t, dt, SPEED, altitude)` + opcional `slowTargetFire(...)`.
6. killTarget: adicionar tipos ao branch de explosão mid-tier (`:433`).
7. Slots `[idx,dx,dz,'tank'|'patrolAir']` nos 4 layouts.

## WS-5 — Nuke/explosões

Arquivos: `src/nuclear-fx.js` (autoridade da pluma), `src/fx.js` (primitivos + burst
inicial + novo pool de fogo de props), `src/projectiles.js` (trigger `:377-414`),
`src/maps/inhauma-scene.js` (expor árvores/estruturas), `src/config.js` (tuning), `src/debug.js`
(nuclearFxState).

1. **De-dup:** `projectiles.js:381-382` chama um único entry point. Manter
   `nuclearExplosion` como burst inicial de ~3 s (partículas) OU rebaixá-lo a primitivo;
   a pluma persistente vira só `nuclear-fx.js`. Remover cogumelo duplo.
2. **Flash/fireball multicor** (`nuclear-fx.js#spawnNuclearFx`/`updateNuclearFx`): rampa
   de cor branco→`flameYellow`→`fireOrange`→`fireRed` no material da fireball (lerp por
   vida, padrão `fx.js:546-548`); +1-2 shells aditivos; acoplar `fireball.y` a `plumeH`.
3. **Cogumelo 60 s** (`updateNuclearFx` `:45-80`): gate `t>7`→`t>60` (`:71`); `plumeH`
   sobe (ease) a ~1500-2500 em ~45 s e segura; copa alarga (anvil); turbulência via
   `noise.js` + rotação lenta existente (`:63`); fade nos últimos ~15 s. Manter mesh
   (≈4 draws), NUNCA partículas por 60 s.
4. **Shockwave** dedicado no `nuclear-fx.js` (o `ring` existente, sweep 2-4 s até ~600-800
   m, fade). 1 draw.
5. **Ignitar props:** em `inhauma-scene.js` expor `inhaumaTrees[]` (push em `buildForests`
   `:347`) + `getInhaumaStructures()` (sobre `structures[]` `:104-124`). Novo pool de fogo
   em loop em `fx.js` (modelar em `factory-fx.js` `:39-72` + `fireGlowItems`): `propFires[]`
   com cap 40-60 slots, queima 20-40 s, ticado dentro de `updateParticles`. No trigger
   (`projectiles.js` junto a `applyNuclearShockwave` `:387`): consultar árvores/estruturas
   dentro de `BLAST_RADIUS` (400), **cap** (nearest ~30-50), `spawnPropFire(pos)` cada, com
   `fxDelay` de limpeza. Guarda `HEADLESS_FX` + guarda testMode.
6. **Retiming** de `nuclearFxState.stage` (`:65`) e leituras em `debug.js:140` para 60 s.

## Ordem de execução

WS-0 (DEFINITION) → flip ACTIVE para IMPLEMENTATION → WS-1 (bug sério) → WS-3 (rio+árvores,
localizado) → WS-2 (estradas) → WS-4 (inimigos) → WS-5 (nuke, maior). Verificar (Playwright
+ screenshot) após cada WS. CLOSURE: refinos finais de memory + evidência.

## Riscos

- **FPS (U-AC-8 frágil):** árvores instanciadas, pluma mesh (não partículas 60 s), cap de
  ignição, guardas headless. Rodar test de fidelidade após WS-3 e WS-5.
- **Chunk/terreno:** WS-1 pode aumentar draw calls; medir budget.
- **Importabilidade Node** de `inhauma-road-defs.js`: geometria fica no lado THREE.
- **Testes só-GH (panel/e2e):** rodar suíte aero localmente após mudanças visuais.
