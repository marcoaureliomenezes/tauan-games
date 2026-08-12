# PORT-GODOT — v0.3.10

> Documento de port para `src/godot/aero-fighters/` (NÃO tocado nesta release —
> escopo SOMENTE web). Captura fórmulas, constantes, coordenadas e geometria de
> setores das duas ondas: (N) nuke/firestorm e (D) defesa. Fontes:
> `src/web-games/aero-fighters/src/{config.js,nuclear-fx.js,firestorm.js,projectiles.js}`
> e `src/{maps/inhauma-scene.js,maps/inhauma-defense.js,defense/*.js}`.
> Todas as coordenadas são do mundo web (x/z no plano, y = altura em metros,
> 1 unidade = 1 m). Probes medidos em 2026-07-20/21 sobre
> `inhaumaVisualSurfaceHeight` (DEM Chamonix 13 m/px + contribuições autorais).

## Onda N — nuke / firestorm

### N.1 Bola de fogo (nuclear-fx.js)

- Raio máx do núcleo inalterado: `FIREBALL_R_MAX = 130` m (contrato de teste:
  ≤ 131 m). Estágios inalterados: `flash → fireball → mushroom`.
- Curvas puras exportadas (espelhadas pelo teste Node T-09):
  - `fireballGrowthAt(t)` — raio do núcleo; monotônica não-decrescente; cresce de
    `FIREBALL_R_BASE` até `FIREBALL_R_MAX` com easing, sem snap no cap.
  - `fireballFadeAt(t)` — opacidade do núcleo.
  - `fireballRiseAt(t, plumeH)` — subida do cogumelo; nunca ultrapassa `plumeH`.
- Rework visual (T-N-01): núcleo branco-quente mais definido, turbulência FBM
  mais rica, borda incandescente — SÓ shader/mesh (`FIRE_VERT`/`FIRE_FRAG`);
  nenhuma curva/raio/estágio mudou. Portar o look, não os números.

### N.2 Firestorm (firestorm.js — novo módulo)

- `NUKE_FIRESTORM` (config.js): `RADIUS 260` (= 2 × FIREBALL_R_MAX),
  `FIRE_S 60`, `SMOKE_S 120`, `MAX_EMITTERS 64`, `FLAME_POOL 160`,
  `SMOKE_POOL 120`.
- Ciclo por objeto ignição: **fogo 60 s → só fumaça +120 s → carbonizado
  (preto) permanente**. Curvas puras: `firestormPhaseAt(t)` (fase por tempo) e
  `firestormCharAt(t)` (fator de escurecimento 0→1; preto integral a partir de
  60 s).
- Ignição: `igniteNearbyProps` (projectiles.js) passou a usar `RADIUS 260` e a
  cobrir também `game.targets` (antes só árvores/estruturas). Blindados
  (`tank, fTank, fApc, warship, armedConvoy`) sofrem dano pesado não-letal;
  o resto morre queimado (na prática o shockwave já matou — o wreck fica preto).
- Carbonização (T-N-03) — o port precisa dos MESMOS ponteiros:
  - **Quarteirões instanciados** (inhauma-city.js): `block.charRefs` = mapa
    estrutura→índice de instância no InstancedMesh; escurecer via
    `setColorAt` lerp→preto.
  - **Marcos soltos**: `registerStructure(id,x,z,halfX,halfZ,topY, extra)` ganhou
    o parâmetro `extra` — `{ charRoot: Object3D }` (inhauma-scene.js:458).
    Estruturas registradas ficam `{ id, x, z, halfX, halfZ, topY, block?,
    charRoot? }` via `getInhaumaStructures()`.
  - **Árvores**: `inhaumaTrees` agora é índice por árvore
    `{ x, y, z, crown, trunk, ci }` (ci = índice de instância na coroa/tronco).
  - **Veículos/inimigos (Groups)**: materiais são COMPARTILHADOS por cache —
    clonar 1× por unidade antes de escurecer; escurecimento progressivo durante
    o fogo, preto total ao fim das chamas.
- Guards: não roda headless (`navigator.webdriver`) exceto `?testMode=1`; cap de
  64 emissores priorizando os focos mais perto do epicentro; pools bounded.
  Tick central: `updateFirestorm(dt)` chamado por main.js junto a updatePropFires.

## Onda D — defesa (inhauma-defense)

### D.1 Morro da bateria 2.5× (T-D-01)

- Constantes (`AA_DEFENSE`, config.js): `HILL_POS {x:-760, z:-480}`,
  `HILL_RADIUS_X_M 340`, `HILL_RADIUS_Z_M 540` (elíptico, alongado no eixo do
  vale), `HILL_PEAK_M 136`, `HILL_TOWN_KEEPOUT_M 280`,
  `SOLDIER_POS = HILL_POS` (bateria NO TOPO), `LOOK_AT {x:-250, z:250}`.
- **Fórmula** (inhauma-scene.js `hillContribution`, somada em
  `inhaumaBaseHeight` depois das portal mounds, antes do entalhe do rio):
  ```
  t  = hypot((x - HILL_POS.x)/RX, (z - HILL_POS.z)/RZ)
  h += t >= 1 ? 0 : HILL_PEAK_M * (1 + cos(PI * t)) / 2     // perfil cosseno
  ```
  DESVIO deliberado da curva quadrática das portal mounds (`1 - t²·1.3`): a
  quadrática cravava a MG-060 num degrau de ~13 m/amostra (guard
  ROAD_BED_P99 ≤ 8 do validate:aero-map); com o cosseno o p99 medido é 6,6.
- Medidos (probe 2026-07-21): cota do topo **250,1 m** (era ~101 m no ombro);
  piso da cidade (centro da TOWN_SHELF) **8,2 m**; proeminência **241,9 m =
  2,50×** a anterior (96,6 m). Distância do topo à borda da TOWN_SHELF: 434 m —
  a cidade ficou intacta (zero da curva no flanco leste ~298 m); o keep-out de
  280 m em buildTown é a trava para crescimentos futuros do shelf.
- Horizonte limpo em **2 corredores** a partir do olho (topo + 1,7 m):
  SUL azimutes 90-135° e NORTE 300-345° — elevação máxima do terreno em 3 km
  < -0,3° (medido: az 300° = -0,3°, demais ≤ -2,0°). Azimute aqui: 0°=+x,
  90°=+z.
- Câmera: `PITCH_MIN -0,3491 rad (-20°)` (era -10°) para olhar a cidade/tropas
  de cima; `PITCH_MAX +85°`; yaw livre 360°.

### D.2 Quatro frentes (T-D-02)

- Eixo-frente (defense-director.js): `frontAxis = atan2(LOOK_AT.z - SOLDIER.z,
  LOOK_AT.x - SOLDIER.x)` ≈ atan2(730, 510) ≈ 0,96 rad (~55°).
- `DIR_SECTORS 4` → setores de 90° centrados em `frontAxis + k·(π/2)`, k=0..3;
  k=0 = frente (sobre a cidade), k=2 = retaguarda.
- Sorteio (determinístico, rng seedado `:defense-director`):
  `pickSquadDirection` consome **2 draws** (setor, jitter):
  `sector = floor(rng()*4)`; `dir = frontAxis + sector·(π/2) +
  (rng()*2-1)·DIR_SECTOR_JITTER`, com `DIR_SECTOR_JITTER 0,6` rad (< 45° —
  nunca invade o setor vizinho).
- A horda (T-W-05) NÃO é quantizada: direção continua `rng()*2π`.
- Spawn: esquadrilha inteira entra pela MESMA direção em anel de
  `FIGHTER_SPAWN_DIST 2300` m (±10%) ao redor de LOOK_AT, alt 230-330 m.

### D.3 Retaguarda coberta (T-D-03)

- Eixo-traseiro unitário (allied-batteries.js `rearAxis`):
  `rearAxis = normalize(SOLDIER_POS - LOOK_AT)` (x/z).
- Bateria FIXA em `SOLDIER_POS + rearAxis · REAR_BATT_DIST(340)` =
  **(-954,7, -758,7)**, cota medida **220,0 m** (ombro NW reverso; a crista de
  250 m a cobre da cidade). Mesh idêntica às demais; `rearGuard: true`.
- Alvo preferencial (`isRearThreat`): caça com `target.kind === 'player'` OU
  bearing visto do SOLDIER dentro de ±60° do eixo-traseiro
  (`dot(dir, rearAxis) ≥ REAR_BATT_SECTOR_COS 0,5`). Prioridade vence distância
  no tie-break de seleção; sem alvo prioritário, engaja o mais próximo no
  alcance (nunca fica ociosa).
- Eficácia (vs. decorativa atual): `REAR_BATT_RANGE 900` (vs. 620),
  `REAR_BATT_HIT_P 0,55` (vs. 0,07), `REAR_BATT_MSL_S 3,5` (vs. 5,5),
  `REAR_BATT_RPS 3,0`, `REAR_BATT_SPREAD 0,03` (vs. 0,05). Acerto rolado no
  disparo (seedado); míssil com `willHit=false` faz curva de quase-acerto
  (offset +24/+30 m) e nunca acerta. HP igual (12 — destrutível).

### D.4 Cachoeira da Prata ×2,2 (T-D-04)

- Novas constantes (inhauma-scene.js — única fonte; INHAUMA_CITIES/landmarks de
  inhauma.js, guarnição e exclusões de campanha derivam delas):
  `CACHOEIRA_SHELF {minX:-1070, maxX:-830, minZ:1960, maxZ:2140}`,
  `CACHOEIRA_TOWN_CENTER {-950, 2050}`, `CACHOEIRA_CHURCH {-928, 2018}`,
  `CACHOEIRA_PRACA {-962, 2072}`, `CACHOEIRA_SHELF_H 71`,
  `CACHOEIRA_FEATHER_M 45`, keep-margin de floresta 20 m.
- Nivelamento (mesmo padrão do aeroporto): distância-retângulo `d`; interior
  plano em 71 m; penumbra smoothstep `s = t²(3-2t)`, `t = 1 - d/45`.
- Medidos: centro-a-centro com Inhaúma (LOOK_AT) **876 m → 1931 m (2,20×)**;
  shelf nivelado 64,6-73,3 m (média 70,8 m, 130 amostras em grade de 20 m);
  retângulo seco (DEM cru 53-85 m), sem estrada nem rio dentro, morros de
  85-145 m no anel leste (300-800 m) para os ninhos de AA da guarnição.
- Metadado `INHAUMA_FEATURES.vale-cachoeira-prata` → `cx -950, cz 2050`.
- Rotas migradas (config.js `CAMPAIGN`): `columnRoutes.north/farNorth/roadTail`,
  `artilleryRoutes` (3) — todas partem do novo vale (-950,1890); `roadWindow
  {roadId:'osm-mg-060', zMin:380, zMax:1560}` (a estrada inteira do fim SE ao
  fim NW, cruzando a ponte em (-1275,870); o roadTail sai por terreno contornando
  o morro pelo norte). A osm-mg-060 termina em (-688,1556), ~560 m a NE da
  cidade — trecho final vicinal (a cidade NÃO fica sobre a estrada).

### D.5 Fog / visibilidade (T-D-01)

- Modo defesa (inhauma-defense.js): `Fog(0xb6d0c4, 1100, 3400)` — mais longo
  que o do mapa de voo (900-2600). Do topo (~250 m) a horda (spawn a 2 km do
  LOOK_AT → até ~2830 m do soldado) e os caças (2,3 km) ficam dentro do far.

## Testes que espelham este contrato (portar junto)

- `test-aero-defense-mode.mjs` — cota do topo 230-270 m, proeminência ≥ 2,4×,
  anel de 400 m < topo-60 (média), flancos do vale caem >100 m, horizonte limpo
  nos 2 corredores, anel da horda observável < fog far.
- `test-aero-defense-director.mjs` — setor ∈ [0,4), dir dentro de
  `frontAxis + sector·90° ± 0,6`, eventos carregam dir+sector, determinismo.
- `test-aero-cachoeira.mjs` / `test-aero-campaign.mjs` — novo shelf e rotas.
- `test-aero-sim.js` (T-09) — curvas da nuke; `test-aero-firestorm.mjs` — fases
  fogo/fumaça/carbonização e raio 260.
