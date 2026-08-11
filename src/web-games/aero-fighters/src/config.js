// config.js — Constantes do jogo (números, cores, layouts).
// Exporta: PLAYER, CANNON, MISSILES, TARGETS, AA, MISSION, WORLD, COLORS.
// Para ajustar a "sensação" do jogo, mude um número aqui e recarregue.

/** Física e controles do avião */
export const PLAYER = {
  MAX_SPD: 80,        // m/s — velocidade máxima com throttle 100%
  MIN_SPD: 8,         // m/s — abaixo disso o avião perde sustentação
  STALL_SPD: 14,      // m/s — abaixo disso o nariz cai e os comandos amolecem (WS-3)
  GRAVITY: 14,        // m/s² — puxa o avião para baixo todo frame
  CLIMB_TRADE: 35,    // m/s de velocidade trocados por atitude (subir drena, mergulhar devolve)
  DIVE_OVERSPEED: 1.3,// multiplicador de MAX_SPD permitido em mergulho
  CEILING: 9500,      // m — empuxo só começa a cair perto deste teto (teto prático ~11.500 m)
  TRIM_RATE: 0.22,    // 1/s — auto-trim suave; não briga contra a subida intencional
  STALL_NOSE_DROP: 0.45, // rad/s — queda de nariz em stall
  STALL_CTL: 0.45,    // autoridade de comando durante stall
  PITCH_RATE: 1.45,   // rad/s — quão rápido o nariz sobe/desce
  PITCH_UP_LIMIT: 0.82,   // rad — permite subida forte sem travar o nariz cedo demais
  PITCH_DOWN_LIMIT: -0.70, // rad — impede mergulho invertido por input sustentado
  ROLL_RATE: 2.30,    // rad/s — rolagem (banking)
  YAW_RATE: 0.80,     // rad/s — coordenado com roll em viradas
  RUDDER_FACTOR: 0.65,// multiplicador do yaw puro (Q/E)
  THROTTLE_UP_RATE: 1.3,
  THROTTLE_DN_RATE: 0.9,
  CONVERGE_RATE: 1.6, // velocidade da convergência para o alvo de throttle
  START_HEIGHT: 80,   // altura inicial em unidades 3D
  SEA_CRASH_Y: 3,     // abaixo disso = crash no mar
  MOUNTAIN_BUFFER: 5,   // margem acima do terreno amostrado antes de crashar — alinha colisão com superfície visual
  // Takeoff rotation parameters
  V_ROTATE: 32,       // m/s — velocidade mínima para iniciar rotação de decolagem (mais próximo do canLiftoff=42)
  ROTATE_LIFT: 15,    // m/s² — sustentação extra durante rotação (era 7.5; atinge 4m em ~0.5s)
  // T-06: tempo (s) para a TAXA de arfagem (pitch rate) da rotação alcançar 100% —
  // antes a taxa saltava de 0 para PITCH_RATE*0.35 no MESMO frame em que a rotação
  // começava (posição já era suave via ROTATE_LIFT/liftoffVsp; a taxa angular não
  // era — essa era a transição "step-like" que lia como teleporte).
  ROTATE_EASE_TIME: 0.4, // s
  // Landing flare / touchdown parameters (tolerantes — jogo para criança)
  FLARE_HI: 4.5,      // m — altitude de entrada na fase de flare
  FLARE_LO: 2.2,      // m — altitude de toque (touchdown ocorre abaixo disso)
  TOUCHDOWN_DEBOUNCE: 0.4, // s — janela de debounce para evento TOUCHDOWN_SAFE
  SINK_MAX: -16,      // m/s — taxa de descida insegura
  SINK_HARD: -26,     // m/s — só uma queda catastrófica (espatifar de propósito) não é pouso
  LAND_MAX_SPD: 62,   // m/s — acima disso (mergulho a toda) o avião não pousa, passa reto
  // Roll-out → guided-taxi handoff (T-05, D-4): TOUCHDOWN_SAFE no longer arms
  // auto-taxi in the same frame. The player keeps yaw/rudder + brake control through
  // a roll-out decel along the runway axis; guided taxi only engages once ground
  // speed decays to this threshold AND the aircraft is on pavement — matches the
  // auto-taxi cruise speed (TAXI_SPEED in auto-taxi.js) so there is no speed-snap at
  // handoff.
  TAXI_HANDOFF_SPEED: 34, // m/s
  // T-07/D-6: named throttle detents on the existing continuous 0..1 throttle input.
  // Boundary-inclusive on the low side (t <= max) — see throttle-stage.js#throttleStage.
  // Physics/ground-roll keep reading the continuous value unchanged; these drive
  // UX/FX only (afterburner plume gating + HUD stage readout).
  THROTTLE_IDLE_MAX: 0.10,     // t <= this → 'idle'
  THROTTLE_TAXI_MAX: 0.35,     // t <= this → 'taxi'
  THROTTLE_MILITARY_MAX: 0.80, // t <= this → 'military'; above → 'afterburner'
};

/** Canhão de tiro rápido */
export const CANNON = {
  RATE: 0.08,         // segundos entre tiros (= 12.5 tiros/s)
  BULLET_SPD: 110,    // m/s — tracers rápidos como M61 Vulcan (escala arcade)
  BULLET_LIFE: 2.0,   // segundos antes do despawn
  WING_OFFSET: 0.91,  // distância de cada cano até centerline (asas do F-35) — 0.65 × 1.4 (scale)
  MUZZLE_OFFSET: 3.08, // distância para frente do nariz onde a bala spawn — 2.2 × 1.4 (scale)
};

/** Míssil leve (X) — dispara rápido, dano modesto.
 * 2026-08-11: TODO míssil é infinito; a limitação é CADÊNCIA (cooldown por
 * arma) — valores canônicos em weapon-cooldowns.js (WEAPON_COOLDOWN_S).
 * Os campos MAX abaixo restaram para visuais de asa/debug, nunca como guard. */
export const MISSILES_LIGHT = {
  MAX: 100,
  INITIAL_SPD: 80,
  TRACKING_SPD: 130,
  TURN_RATE: 0.30,
  CLOSE_TURN_RATE: 0.55,  // próxima ao alvo (<40m) — turn mais agressivo
  LIFE: 6.0,
  DAMAGE: 4,
  SEARCH_RANGE: 1200,
};

/** Míssil pesado (B) — dano 5x, supply limitado, leve mais lento */
export const MISSILES_HEAVY = {
  MAX: 10,
  INITIAL_SPD: 65,
  TRACKING_SPD: 100,
  TURN_RATE: 0.22,
  CLOSE_TURN_RATE: 0.45,
  LIFE: 8.0,
  DAMAGE: 20,
  SEARCH_RANGE: 1500,
};

/** Míssil nuclear (N) — devastador, supply 3, raio de dano massivo */
export const MISSILES_NUCLEAR = {
  MAX: 3,
  INITIAL_SPD: 60,
  TRACKING_SPD: 85,
  TURN_RATE: 0.18,
  CLOSE_TURN_RATE: 0.38,
  LIFE: 12.0,
  DAMAGE: 4000,
  // D-8 (2026-07-15): 400 -> 760 (~1.9x) to match the ~750 m visual ground shockwave
  // (nuclear-fx.js's shockwaveRadiusAt) — the ground kill radius was far smaller than
  // the spectacle. Player kill/damage radii are re-tuned proportionally so the bigger
  // radius stays fair (was 200/450, now 300/680 — the kill/damage band ratio is
  // preserved: 680/300 = 2.27 vs the old 450/200 = 2.25).
  BLAST_RADIUS:         760,   // raio de destruição de alvos e terreno
  PLAYER_KILL_RADIUS:   300,   // morte instantânea dentro deste raio
  PLAYER_DAMAGE_RADIUS: 680,   // perde 1 vida + shake forte até aqui
};

/** Firestorm pós-nuke (release nuke-firestorm-defense-v1, T-N-02) — incêndio
 * generalizado no mapa Inhaúma após a detonação: todo inflamável (árvores,
 * construções, alvos) dentro de RADIUS pega fogo por FIRE_S, depois só fumaça
 * por SMOKE_S, e fica carbonizado (preto) permanentemente.
 * RADIUS = 2 × FIREBALL_R_MAX (130 m) da bola de fogo em nuclear-fx.js — se o
 * raio máximo do fireball mudar lá, atualizar aqui (260 = 2 × 130). */
export const NUKE_FIRESTORM = {
  RADIUS: 260,        // m — 2 × FIREBALL_R_MAX (130) de nuclear-fx.js
  FIRE_S: 60,         // s — chamas após a explosão
  SMOKE_S: 120,       // s — só fumaça após as chamas
  MAX_EMITTERS: 64,   // cap de focos (prioridade: mais perto do epicentro)
  FLAME_POOL: 160,    // puffs de chama reaproveitados (aditivos)
  SMOKE_POOL: 120,    // puffs de fumaça reaproveitados
};

/** Alias mantido para compatibilidade — aponta para light */
export const MISSILES = MISSILES_LIGHT;

/** Míssil "rod" (R) — cinético, 2x mais rápido que o leve (D-3), perfura até 3 alvos
 * em cadeia dentro do raio de ação da nuke (MISSILES_NUCLEAR.BLAST_RADIUS, reusado —
 * ver rod-missiles.js). Sem warhead: DAMAGE é um overkill garantido de 1 hit por alvo
 * válido, não uma explosão de área. Supply limitado como HVY/NUK. */
export const MISSILES_ROD = {
  MAX: 4,
  INITIAL_SPD: 160,   // D-3: 2x MISSILES_LIGHT.INITIAL_SPD (80)
  TRACKING_SPD: 260,  // D-3: 2x MISSILES_LIGHT.TRACKING_SPD (130)
  TURN_RATE: 0.65,    // homing sempre agressivo — perfurador, não há distinção MISS
  DAMAGE: 9999,       // cinético: garante kill em 1 impacto em qualquer alvo válido
};

/** Barrel roll */
export const ROLL = {
  DUR: 0.5,
  COOLDOWN: 1.5,
};

/** Tipos de alvo estáticos */
export const TARGETS = {
  base:     { hp: 28, score: 800, hr2: 36, dropChance: 0.6 },
  factory:  { hp: 20, score: 600, hr2: 28, dropChance: 0.5 },
  building: { hp: 14, score: 450, hr2: 18, dropChance: 0.3 },
  convoy:   { hp: 12, score: 380, hr2: 60, dropChance: 0.4 },
  armedConvoy: { hp: 18, score: 700, hr2: 95, dropChance: 0.45 },
  helicopter: { hp: 10, score: 650, hr2: 120, dropChance: 0.35 },
  tank:     { hp: 22, score: 550, hr2: 44, dropChance: 0.4 },   // solo lento, torre mira
  patrolAir: { hp: 14, score: 720, hr2: 150, dropChance: 0.4 }, // dirigível de patrulha lento (ar)
  aaGun:    { hp:  6, score: 250, hr2:  9, dropChance: 0.1 },
  warship:  { hp: 35, score: 1200, hr2: 80, dropChance: 0.5 },
};

/** Stats das unidades de formação da campanha Inhaúma (T-C-01,
 *  release v0.3.4). Tipos `f*` — os meshes são os
 *  builders de `src/formations/units.js`; o fluxo de dano é o de `targets.js`.
 *  range = engajamento contra o player (m; doutrina 2026-08-11: AA/SAM 300, resto 200);
 *  speed = deslocamento (m/s); fire = tipo de fogo ('none' = desarmada);
 *  altitude = altura de voo acima do terreno (unidades aéreas). */
export const TARGET_STATS = {
  fTank:       { hp: 22, score: 550, hr2: 44,  dropChance: 0.4,  range: 200, speed: 6,   fire: 'cannon',   fireInterval: 2.6 },
  fApc:        { hp: 16, score: 480, hr2: 40,  dropChance: 0.35, range: 200, speed: 9,   fire: 'mg',       fireInterval: 1.9 },
  fTruck:      { hp: 10, score: 320, hr2: 36,  dropChance: 0.45, range: 0,   speed: 10,  fire: 'none',     fireInterval: Infinity },
  fTroops:     { hp: 8,  score: 260, hr2: 30,  dropChance: 0.3,  range: 200, speed: 3.5, fire: 'mg',       fireInterval: 2.2 },
  fArtillery:  { hp: 14, score: 600, hr2: 42,  dropChance: 0.4,  range: 0,   speed: 7,   fire: 'howitzer', fireInterval: 6.0 },
  fSam:        { hp: 18, score: 900, hr2: 55,  dropChance: 0.4,  range: 300, speed: 0,   fire: 'missile',  fireInterval: 4.0 },
  fAaGun:      { hp: 6,  score: 250, hr2: 9,   dropChance: 0.1,  range: 300, speed: 0,   fire: 'aa',       fireInterval: 1.7 },
  fHelicopter: { hp: 10, score: 650, hr2: 120, dropChance: 0.35, range: 200, speed: 14,  fire: 'mg',       fireInterval: 2.3, altitude: 46 },
  fZeppelin:   { hp: 16, score: 720, hr2: 150, dropChance: 0.4,  range: 0,   speed: 5,   fire: 'none',     fireInterval: Infinity, altitude: 95 },
};

/** T-C-10 (release v0.3.4): modelo de fogo inimigo das
 *  unidades de FORMAÇÃO contra o jato do jogador (formation.js#updateFormationFire —
 *  só Inhaúma/campanha; os inimigos legados dos outros mapas seguem com 56 m/s).
 *  Projéteis SEMPRE em linha reta, sem lead (lead factor 0), velocidade desviável.
 *  Acerto por distância: p = clamp(pNear - max(0, dist/NEAR_M - 1) * decay, floor, pNear).
 *    AA:    80% a <50 m, ~50% a 150 m, piso 5% (range 300 m)
 *    GROUND: 50% a <50 m, ~36% a 150 m, piso 3% (range 200 m)
 *  No roll de MISS a mira recebe um offset angular seedado de 2-6° (tracers passam
 *  raspando — o jogador vê o fogo e consegue desviar). */
export const ENEMY_FIRE = {
  BULLET_SPD: 80,          // m/s — banda desviável 70-90 (SPEC §D)
  BULLET_LIFE: 4.5,        // s — cobre o range AA (300 m) com folga (80*4.5=360 m)
  NEAR_M: 50,              // m — distância de referência do platô de acerto
  MISS_DEG: [2, 6],        // offset angular do tiro errado (graus)
  AA:     { pNear: 0.80, decay: 0.15, floor: 0.05, muzzleY: 1.8 },
  GROUND: { pNear: 0.50, decay: 0.14, floor: 0.03, muzzleY: 2.0 },
};

/** T-C-13 (release v0.3.4): wingmen — voo em FORMAÇÃO
 *  com o jogador + engajamento genérico de hostis aéreos próximos (wingmen.js).
 *  Slots de ala em espaço local do jato: [x lateral, y acima, z atrás] (escalon
 *  esquerdo/direito, ~25-40 m). O slot é rotacionado só pelo YAW do jato (nariz),
 *  não por pitch/roll — a formação não "dança" quando o jogador banqueia. */
export const WINGMEN = {
  FORMATION_OFFSETS: [[-32, 7, 26], [32, 7, 26]], // escalon esq/dir atrás do líder
  ENGAGE_RADIUS: 420,   // m — hostil aéreo a menos disto do PLAYER dispara o engajamento
  RETURN_RADIUS: 560,   // m — histerese: sem hostil até aqui, o wingman volta à formação
  CATCHUP_GAIN: 1.8,    // 1/s — ganho de perseguição do slot (converge em ~2-3 s)
  MAX_SPD: 165,         // m/s — teto do wingman na perseguição (cruzeiro do player: 80)
  VEL_LAG: 3.0,         // 1/s — suavização da velocidade (lag suave, sem rubber-band)
  FIRE_RANGE: 1200,     // m — alcance do míssil aliado (como antes)
  FIRE_INTERVAL: [2.6, 4.2], // s — intervalo seedado entre disparos (min, min+spread)
};

/** T-C-05 (release v0.3.4): composição da guarnição de
 *  ocupação de Cachoeira da Prata (src/maps/inhauma-garrison.js). */
export const CACHOEIRA_GARRISON = {
  armorColumns: 2,         // colunas blindadas circulando nos segmentos de estrada da cidade
  armorSize: 6,            // unidades por coluna
  heliPatrols: 4,          // 2026-08-11: 2 → 4 helicópteros em patrulha baixa ("mais helicópteros")
  zeppelinPatrols: 1,      // zepelim em patrulha alta
  aaNests: 3,              // ninhos de AA nos morros ao redor (mín. 2 garantido)
  aaAnnulus: [300, 800],   // anel de busca dos morros (m do centro do shelf)
  aaMinSeparation: 250,    // separação mínima entre ninhos (m)
  // 2026-08-11 (doutrina 300/200): baterias AA DENTRO da cidade — nas clareiras
  // reais (praça e largo da igreja). Alcance 300 m via TARGET_STATS.fAaGun.
  townAaBatteries: 2,      // baterias urbanas (praça + largo da igreja)
  townAaSize: 3,           // canhões por bateria urbana
  hqTroops: 8,             // tamanho do encampment do QG (objetivo final do Ato 2)
  samSize: 6,              // tamanho do samSite do QG
};

/** T-C-06 (release v0.3.4): diretor de campanha do
 *  mapa Inhaúma (src/campaign.js) — substitui o loop de waves SOMENTE em Inhaúma.
 *  Ato 1 "SALVAR INHAÚMA": baterias de artilharia + colunas de invasão partem do
 *  vale de Cachoeira em horários seedados (spawn-over-time, nunca tudo junto).
 *  Ato 2 "LIBERTAR CACHOEIRA": destruir a guarnição de ocupação (T-C-05). */
export const CAMPAIGN = {
  FIRST_SPAWN_S: 5,          // s — primeira formação do Ato 1 após o início
  SPAWN_GAP_S: [40, 75],     // s — intervalo seedado entre spawns (ato dura 10-15 min)
  artilleryCount: 3,         // baterias de artilharia (2-3 pela SPEC; 3 cobre os pontos)
  artillerySize: [5, 8],     // tamanho seedado por bateria
  // Colunas de invasão (tipo, tamanho) — partem do vale de Cachoeira rumo a Inhaúma.
  columns: [
    ['supplyConvoy', 5],
    ['troopColumn', 8],
    ['armoredColumn', 10],
    ['tankPlatoon', 12],
  ],
  // Templates de rota validados offline contra as exclusões REAIS (probe da Onda 3;
  // o validador de formation.js re-clampa/rejeita no spawn — defesa em profundidade).
  // T-D-04 (nuke-firestorm-defense-v1): Cachoeira mudou de (-1080,530) para
  // (-950,2050) — rotas RE-TRAÇADAS a partir do novo vale (2026-07-20) e re-
  // validadas com createFormation + exclusões reais. Elas descem o vale sudoeste,
  // contornam a TOWN_SHELF pela borda leste/norte (longe do morro da bateria a NW)
  // e terminam a ~140 m da borda do shelf: chegar ao fim do path ('arrived') =
  // invasão bem-sucedida = Inhaúma cai.
  // 2026-08-11: Cachoeira foi para (-1300,2950) (+50% de distância) — todas as
  // rotas ganharam o PREFIXO de descida do novo vale até o antigo ponto de
  // partida (-950,1890), preservando os corredores validados dali em diante.
  // valleyPrefix é também usado por roadRoute() em campaign.js para as colunas
  // de estrada PARTIREM de Cachoeira antes de pegar a osm-mg-060.
  valleyPrefix: [[-1300, 2790], [-1150, 2350], [-950, 1890]],
  columnRoutes: {
    north: [[-1300, 2790], [-1150, 2350], [-950, 1890], [-800, 1600], [-350, 1150], [-150, 650], [150, 600], [290, 420], [290, 300]],
    farNorth: [[-1300, 2790], [-1150, 2350], [-950, 1890], [-600, 1500], [-100, 1100], [350, 800], [550, 550], [500, 300], [350, 100], [290, -50]],
    // 'road' é montada em runtime: trecho da osm-mg-060 (do fim SE da estrada,
    // atravessando a ponte sobre o rio em (-1275,870)) + saída de terreno a
    // noroeste, contornando o MORRO DA BATERIA pelo norte e fechando na borda
    // norte da TOWN_SHELF.
    roadTail: [[-1250, 250], [-1150, -100], [-1050, -500], [-900, -750], [-600, -820], [-350, -700], [-100, -450], [0, -200]],
  },
  // Rotas das baterias: partem do vale e terminam no ponto de deploy (600-1200 m
  // da TOWN_SHELF) — deploys=true → estado 'deployed' no fim (Onda 4 as faz atirar).
  artilleryRoutes: [
    [[-1300, 2790], [-1150, 2350], [-950, 1890], [-850, 1600], [-750, 1250]],              // deploy 697 m sudoeste
    [[-1300, 2790], [-1150, 2350], [-950, 1890], [-600, 1500], [-200, 1150], [100, 1200]], // deploy 640 m sul
    [[-1300, 2790], [-1150, 2350], [-950, 1890], [-500, 1500], [0, 1150], [600, 1000]],    // deploy 629 m sudeste
  ],
  // Trecho da osm-mg-060 usado como prefixo da rota 'road': a estrada INTEIRA do
  // fim SE (perto do novo vale) ao fim NW (de onde o roadTail sai por terreno).
  roadWindow: { roadId: 'osm-mg-060', zMin: 380, zMax: 1560 },
};

/** T-D-01 (release v0.3.5): bateria antiaérea de Inhaúma —
 *  modo 'inhauma-defense', jogado DO CHÃO (sem jato, sem física de voo).
 *  SOLDIER_POS sondado no DEM real (probe da Onda D1, 2026-07-18): ombro de morro a
 *  noroeste da TOWN_SHELF (434 m da borda), com linha de visada limpa para a
 *  cidade inteira E para o aeroporto (a base militar).
 *  T-D-01 (release v0.3.10, operador 2026-07-20):
 *  "a colina do meio da cidade deve ter elevação 2.5x maior" — o MESMO ombro virou o
 *  morro da bateria: contribuição autoral de +150 m (HILL_*) eleva o topo de ~101 m
 *  para ~251 m (proeminência ~243 m sobre o piso da cidade ≈ 2,5×). Novo probe
 *  (2026-07-20): horizonte LIMPO em 2 direções a partir do topo — corredor sul
 *  (az 90-135°) e corredor norte (az 300-345°, elevação máxima do terreno < -0,3°
 *  em 3 km) — e visada por cima da cidade para a borda do vale (horda a 2 km e
 *  caças a 2,3 km ficam dentro do fog far 3400 do modo defesa).
 *  Armas balanceadas na Onda D2 (T-D-04 .50 / T-D-05 míssil AA) — blocos abaixo. */
export const AA_DEFENSE = {
  // ── T-D-01 (release v0.3.10): MORRO 2.5× ──
  // A "colina da cidade" é o ombro de DEM a NW da TOWN_SHELF onde a bateria já
  // estava: HILL_POS alimenta a contribuição de relevo em inhaumaBaseHeight.
  // Perfil COSENO alongado no eixo do vale (RX 340 × RZ 540 m) — DESVIO da curva
  // 1−t²·1.3 das portal mounds: a curva quadrática tem gradiente máximo ~0,9 na
  // borda, o que cravava a MG-060 (que margeia a encosta) num degrau de 13 m por
  // amostra e reprovava o guard ROAD_BED_P99 ≤ 8 do validate:aero-map; o cosseno
  // tem topo largo e bordas suaves (p99 medido 6,6, máx 7,2 — probe 2026-07-20).
  // Cota medida no topo: ~101 m → ~250 m (piso da cidade ~8 m → proeminência
  // ~242 m ≈ 2,5× os ~96 m anteriores). SOLDIER_POS = HILL_POS: bateria NO TOPO.
  HILL_POS: { x: -760, z: -480 }, // centro do morro (ombro DEM, cota base ~115 m)
  HILL_RADIUS_X_M: 340,           // m — semi-eixo E-W da contribuição (base ~300-400, SPEC)
  HILL_RADIUS_Z_M: 540,           // m — semi-eixo N-S (alongado no eixo do vale)
  HILL_PEAK_M: 136,               // m — pico da contribuição (115 + 136 ≈ 251 m)
  HILL_TOWN_KEEPOUT_M: 280,       // m — keep-out de quarteirões no topo/encosta
  HILL_FOREST_KEEPOUT_M: 120,     // m — keep-out de árvores no topo (visada limpa)
  SOLDIER_POS: { x: -760, z: -480 }, // = HILL_POS — bateria no topo do morro 2.5×
  LOOK_AT: { x: -250, z: 250 },      // centro da TOWN_SHELF (inhauma-scene.js)
  EYE_HEIGHT: 1.7,                   // m — altura dos olhos do artilheiro
  CAM_BACK: 3.2,                     // m — recuo da câmera over-shoulder
  CAM_UP: 1.2,                       // m — elevação extra da câmera sobre os olhos
  // T-D-01: depressão relaxada -10° → -20° — do topo a 250 m o artilheiro precisa
  // olhar para BAIXO para ver a horda se formando e as tropas na cidade.
  PITCH_MIN: -0.3491,                // rad (-20°) — depressão máxima do gimbal
  PITCH_MAX: 1.4835,                 // rad (+85°) — quase vertical
  MOUSE_SENS: 0.0023,                // rad por pixel de movimento do mouse
  FOV: 62,                           // campo de visão normal
  ZOOM_FOV: 32,                      // zoom com botão direito segurado
  ZOOM_SPEED: 10,                    // 1/s — velocidade do lerp de zoom
  HP: 3,                             // hits por vida (placeholder — D3)
  LIVES: 3,                          // vidas do artilheiro (placeholder — D4)
  AA_MISSILES: Infinity,              // estoque inicial de mísseis AA (= AA_STOCK)
  // ── T-D-04: metralhadora .50 (LMB segurado) ──
  // Upgrade de poder de fogo (operador 2026-07-19): 15 tiros/s retos, calibre
  // +70% (geometria em projectiles.js), overheat só após ~1 min CONTÍNUO
  // (15 rps × 60 s × 0.0011 ≈ 100%), resfrio total em ~30 s parada.
  MG_RPS: 15,                         // tiros/s com LMB segurado
  MG_SPEED: 450,                      // m/s — projétil REAL (não hitscan)
  MG_GRAVITY: 0,                      // m/s² — tracers em LINHA RETA (pedido do operador)
  MG_SPREAD: 0.0045,                  // rad — dispersão máxima no cano
  MG_RANGE: 1200,                     // m — cap de alcance (a bala morre além)
  MG_DAMAGE: 1,                       // dano por bala (HP dos caças: Onda D3)
  MG_HEAT_PER_SHOT: 0.0011,           // fração de calor por tiro (~909 tiros = 100%)
  MG_COOL_RATE: 0.0333,               // fração/s de dissipação (~30 s para zerar)
  MG_RESUME: 0.55,                    // rearma após superaquecer (histerese)
  // ── T-D-05: míssil AA homing (tecla X — RMB é o zoom do turret-camera) ──
  // Upgrade (operador 2026-07-19): estoque INFINITO + cadência de até 2/s;
  // lock persiste AA_LOCK_HOLD s após quebra de feixe ("identificação dura mais").
  AA_STOCK: Infinity,                 // estoque máximo — INFINITO
  AA_RECHARGE_S: 12,                  // s para recarregar 1 míssil (inerte com estoque ∞)
  AA_FIRE_INTERVAL: 0.5,              // s entre lançamentos (máx 2 mísseis/s)
  AA_LOCK_CONE: 0.2094,               // rad (±12°) — cone de aquisição no retículo
  AA_LOCK_TIME: 1.2,                  // s de tracking contínuo até travar
  AA_LOCK_HOLD: 2.5,                  // s de carência do lock após perder o feixe
  AA_SPEED: 220,                     // m/s — velocidade de cruzeiro (> drone/caça)
  AA_LAT_ACCEL: 55,                  // m/s² — cap de aceleração lateral da PN
  AA_NAV_N: 3,                       // ganho da navegação proporcional
  AA_LIFE: 8,                        // s — autodestruição (miss documentado)
  AA_PROX_FUSE: 6,                   // m — espoleta de proximidade
  AA_INITIAL_SPD: 60,                // m/s na saída do tubo
  // ── T-D-05: drones de DEBUG (Onda D3 tirou do modo; utilitários puros de
  // teste seguem em turret-weapons.js — cobertos por test-aero-defense-weapons) ──
  DEBUG_DRONES: 3,
  DRONE_SPEED: 55,                   // m/s — círculo lento
  DRONE_ALT: [150, 210, 260],        // m — altitude por drone
  DRONE_RADIUS: [320, 430, 540],     // m — raio do círculo por drone
  DRONE_HP: 8,                       // 8-12 balas .50 derrubam (spec)
  DRONE_RESPAWN_S: 8,                // s para respawnar após cair
  // ── T-D-06: caças inimigos (Onda D3 — defense/enemy-fighters.js) ──
  FIGHTER_COUNT: 3,                  // mínimo de caças vivos no céu (diretor infinito: D4)
  FIGHTER_HP: [8, 12],               // faixa de HP (8-12 balas .50 ou 1 míssil AA)
  FIGHTER_SPEED: [90, 140],          // m/s — cruzeiro seedado por caça
  FIGHTER_SPAWN_DIST: 2300,          // m — spawn numa direção de bússola seedada
  FIGHTER_SPAWN_ALT: [230, 330],     // m — altitude de ingresso
  FIGHTER_TERRAIN_CLR: 15,           // m — clearance mínima fora do mergulho
  FIGHTER_DIVE_CLR: 6,               // m — clearance mínima DURANTE o attack-run
  FIGHTER_TURN_RATE: 1.4,            // rad/s — giro suave de heading
  FIGHTER_PITCH_RATE: 1.1,           // rad/s
  FIGHTER_ATTACK_DIST: 640,          // m — distância horizontal que abre o attack-run
  FIGHTER_RELEASE_DIST: 330,         // m — entrada da janela de release
  FIGHTER_ABORT_DIST: 120,           // m — perto demais: vira egress sem soltar mais
  FIGHTER_RUNS_MAX: 2,               // corridas de ataque antes do despawn
  FIGHTER_EGRESS_S: 5.5,             // s de egress com jinks antes do re-ingress
  FIGHTER_JINK: 0.9,                 // rad — amplitude dos jinks seedados no egress
  FIGHTER_EVADE_S: 2.4,              // s de manobra evasiva dura pós-lock (chaff/flare)
  FIGHTER_EVADE_TURN: 2.6,           // rad/s — quebra de evasão (v·ω >> AA_LAT_ACCEL = miss da PN)
  FIGHTER_HIT_R: 8,                  // m — raio de acerto (.50 / espoleta AA)
  TARGET_WEIGHTS: [['city', 45], ['base', 30], ['battery', 15], ['player', 10]],
  // ── T-D-07: ordenança inimiga (defense/enemy-ordnance.js) ──
  AG_MISSILE_SPEED: 135,             // m/s — arco balístico + terminal dive
  AG_ARC_GRAVITY: 12,                // m/s² — gravidade só na fase de arco
  AG_TERMINAL_DIST: 260,             // m — início do mergulho terminal guiado
  AG_TERMINAL_TURN: 3.2,             // rad/s — esterço terminal sobre o ponto alvo
  AG_HIT_R: 9,                       // m — raio de impacto sobre o ponto alvo
  AG_LIFE: 14,                       // s — cap de vida do míssil ar-solo
  AG_BATT_DAMAGE: 8,                 // dano do impacto numa bateria aliada (HP 12)
  CITY_DAMAGE: 5,                    // % de integridade de Inhaúma por impacto na cidade
  PLAYER_HIT_R: 26,                  // m — raio de dano do míssil anti-jogador
  INTERCEPT_R: 4,                    // m — proximidade da .50 que intercepta o míssil
  INTERCEPT_BONUS: 250,              // score por interceptação no ar
  FIGHTER_GUN_RPS: 11,               // tiros/s na rajada anti-jogador
  FIGHTER_GUN_S: 1.2,                // s de rajada dentro da janela de release
  FIGHTER_GUN_SPEED: 210,            // m/s — tracers inimigos
  FIGHTER_GUN_SPREAD: 0.02,          // rad — dispersão da rajada
  // ── T-D-08: baterias AA aliadas (defense/allied-batteries.js) ──
  ALLY_BATTERIES: [3, 5],            // faixa seedada de baterias (morro + base)
  ALLY_BATT_HP: 12,                  // HP por bateria (2 impactos AG derrubam)
  ALLY_BATT_RANGE: 620,              // m — engajamento
  ALLY_BATT_RPS: 2.4,                // tracers/s por bateria (rico visualmente)
  ALLY_BATT_SPREAD: 0.05,            // rad — dispersão alta (eficácia baixa)
  ALLY_BATT_HIT_P: 0.07,             // chance de acerto do míssil ocasional (5-10%)
  ALLY_BATT_MSL_S: 5.5,              // s médios entre mísseis ocasionais
  ALLY_BATT_MSL_DMG: 5,              // dano do míssil aliado que acerta
  ALLY_BATT_MSL_SPEED: 170,          // m/s
  // ── T-D-03 (nuke-firestorm-defense-v1): bateria da RETAGUARDA ──
  // Bateria aliada DEDICADA no setor traseiro (lado oposto do morro em relação a
  // LOOK_AT, a REAR_BATT_DIST m do soldado ao longo do eixo-traseiro). O operador:
  // "minha retaguarda é protegida por outra bateria antiaérea" — hoje as aliadas
  // são decorativas (7% de acerto) e o caça sempre entra pelas costas. Esta é
  // EFETIVA: prioriza caças no setor traseiro (±60° do eixo reverso, medido a
  // partir do SOLDIER_POS) ou mirando o jogador, com alcance longo, ciclo de
  // míssil rápido e chance de acerto alta. Sem alvo prioritário, engaja o mais
  // próximo no alcance (nunca fica ociosa). Mesma mesh das demais baterias.
  REAR_BATT_DIST: 340,               // m atrás do soldado — ombro NW reverso (sondado:
                                     //   (-955,-759), cota ~220 m, declive 0,25 — a
                                     //   crista de 250 m a cobre da cidade)
  REAR_BATT_RANGE: 900,              // m — cobre as aproximações traseiras longas
  REAR_BATT_HIT_P: 0.55,             // chance de acerto do míssil (EFETIVA, ≥0.5)
  REAR_BATT_MSL_S: 3.5,              // s médios entre mísseis (ciclo rápido)
  REAR_BATT_RPS: 3.0,                // tracers/s
  REAR_BATT_SPREAD: 0.03,            // rad — dispersão menor (bateria elite)
  REAR_BATT_SECTOR_COS: 0.5,         // cos(60°) — meio-ângulo do setor traseiro
  // ── T-D-09: diretor de spawn infinito (defense/defense-director.js) ──
  DIR_BASE_INTERVAL: 6,              // s — intervalo base entre esquadrilhas
  DIR_RATE: 0.93,                    // fator de aceleração por degrau de kills
  DIR_KILLS_STEP: 5,                 // kills por degrau (intervalo ×0.93 a cada 5)
  DIR_MIN_INTERVAL: 1.5,             // s — piso do intervalo
  DIR_SQUAD_KILLS: [0, 12, 30, 60],  // degraus de kills p/ esquadrilha 1→4
  DIR_MAX_ALIVE: 10,                 // cap de caças vivos (excesso espera na fila)
  DIR_FIRST_DELAY: 2.0,              // s até a primeira esquadrilha
  // ── T-D-02 (nuke-firestorm-defense-v1): 4 FRENTES quantizadas ──
  // A direção de ingresso de cada esquadrilha é sorteada em 4 SETORES de 90°
  // relativos ao eixo SOLDIER→LOOK_AT: 0=frente (sobre a cidade), 1, 2, 3
  // (retaguarda — coberta pela bateria REAR_BATT_*). Dentro do setor há um
  // jitter seedado de ±DIR_SECTOR_JITTER rad (< 45° — nunca invade o vizinho).
  DIR_SECTORS: 4,                    // setores de 360/4 = 90°
  DIR_SECTOR_JITTER: 0.6,            // rad (~±34°) — espalhamento dentro do setor
  KILL_SCORE: 100,                   // score por caça abatido (.50, AA ou aliado)
  STREAK_EVERY: 10,                  // overlay de streak a cada N abates
  // ── T-D-10: queda cinematográfica (enemy-fighters.js#startDying/stepDying) ──
  FALL_GRAVITY: 22,                  // m/s² — aceleração do sink da queda
  FALL_SINK: { spiral: [34, 62], glide: [26, 40], dive: [78, 115] }, // m/s (ini→terminal)
  FALL_EJECT_P: 0.2,                 // chance de ejeção com paraquedas
  FALL_DEBRIS: [2, 4],               // sheds de debris por queda
  FALL_TRAIL_S: 0.045,               // s entre puffs de fumaça+fogo da trilha
  FALL_COLUMN_S: 20,                 // s da coluna de fumaça pós-impacto
  FALL_MAX_TRAILS: 8,                // quedas simultâneas com trilha densa (pool próprio)
  PARA_SINK: 9,                      // m/s — descida do paraquedas (ref ejection.js)
  PARA_DRIFT: 5,                     // m/s — deriva horizontal seedada do paraquedas
  // ── WEAPONS-V1 (release v0.3.9) ──
  // T-W-01: lock vermelho dura 3 s OU 3 disparos no alvo (o que vier primeiro)
  // — não é mais gasto no 1º tiro (AA_LOCK_HOLD, 2.5 s, segue sendo a carência
  // de quebra de FEIXE no tracking; isto aqui é a persistência do lado do tiro).
  // SUBSTITUÍDO pelo T-W-08 (ADENDO playtest-2): o modelo 3 s/3 tiros virou o
  // ciclo de fases abaixo — LOCK_HOLD_S/LOCK_HOLD_SHOTS ficam só de referência.
  LOCK_HOLD_S: 3.0,                  // (legado T-W-01 — ver T-W-08)
  LOCK_HOLD_SHOTS: 3,                // (legado T-W-01 — ver T-W-08)
  // ── T-W-08 (ADENDO 2026-07-19): mira por FASES + acerto estatístico ──
  // Ao travar: amarelo 1,5 s (50%) → vermelho 1,5 s (80%) → amarelo 1,5 s (50%)
  // — ciclo de 4,5 s e a mira solta (re-travar). Some antes: 5 mísseis no alvo.
  // Quebra de feixe: o timer da fase CONGELA por até AA_LOCK_HOLD s de carência.
  LOCK_PHASE_S: 1.5,                 // s por fase (3 fases = 4,5 s de ciclo)
  LOCK_HIT_P: [0.5, 0.8, 0.5],       // chance de acerto por fase (amarela/vermelha/amarela)
  LOCK_MAX_SHOTS: 5,                 // mísseis no mesmo alvo antes da mira soltar
  LOCK_MISS_OFFSET: [4, 9],          // m — offset terminal seedado do míssil "miss"
  AA_QUEUE_CAP: 4,                   // fila de disparos X pressionados na cadência
  // T-W-02: dois tiers de míssil AA — X fraco (3 hits em FIGHTER_HP 8-12, 2/s,
  // ∞) e B forte (1 hit kill, 1 a cada 2 s, ∞). Cadência do X = AA_FIRE_INTERVAL.
  AA_X_DAMAGE: 4,                    // dano do X — 8 HP: 2 hits; 12 HP: 3 hits
  AA_B_DAMAGE: 999,                  // dano do B — overkill garantido (1 hit kill)
  AA_B_INTERVAL: 2.0,                // s entre lançamentos B (1 a cada 2 s)
  // T-W-03: retargeting — míssil órfão busca o vivo mais próximo num cone
  // generoso à frente do vetor velocidade (em vez de seguir balístico/morrer).
  RETARGET_CONE: 1.05,               // rad (~60°) — semi-ângulo do cone de retarget
  // T-W-04: rod cinético (R) — 1/5 s, 3× a velocidade do míssil fraco, perfura
  // e encadeia até 3 kills (retarget ao vivo mais próximo após cada perfuração).
  ROD_INTERVAL: 5.0,                 // s entre lançamentos do rod
  ROD_SPEED_MULT: 3,                 // × AA_SPEED
  ROD_LAT_MULT: 20,                  // × AA_LAT_ACCEL — esterço p/ encadear a 660 m/s
  ROD_HIT_R: 10,                     // m — raio de perfuração (teste swept anti-túnel)
  ROD_PIERCE: 3,                     // kills máximos por rod
  ROD_LIFE: 8,                       // s de vida do rod
  // T-W-05: boss — horda (formação de tropas reusando src/formations/) monta no
  // horizonte (borda do vale, ~2 km) e marcha para Inhaúma; janela de tempo com
  // contagem no HUD; chegada = −30% de integridade da cidade; ciclo seedado.
  HORDE_FIRST_S: 40,                 // s até a primeira horda
  HORDE_CYCLE_S: 110,                // s entre hordas (seedado)
  HORDE_TYPE: 'mixedBattlegroup',    // composição (catálogo de formation.js)
  HORDE_SIZE: 18,                    // unidades (15-20)
  HORDE_DIST: 2000,                  // m — spawn na borda do vale (~2 km)
  HORDE_SPEED: 24,                   // m/s de marcha — janela ≈ DIST/SPEED (~83 s)
  HORDE_CITY_DAMAGE: 30,             // % de integridade perdida na chegada
  HORDE_KILL_SCORE: 60,              // score por unidade da horda destruída
  // T-W-05: nuke tática (T) — estoque 3, sem recarga; projétil pesado em arco
  // alto; wipe por raio (a assassina de hordas).
  NUKE_STOCK: 3,                     // nukes táticas por run
  NUKE_RADIUS: 150,                  // m — raio do wipe
  NUKE_SPEED: 190,                   // m/s de cruzeiro (alcança o horizonte ~2 km)
  NUKE_ARC_LIFT: 0.55,               // componente vertical extra na saída
  NUKE_ARC_S: 1.4,                   // s de arco balístico antes do glide guiado
  NUKE_LAT_ACCEL: 90,                // m/s² — esterço do glide sobre o ponto de mira
  NUKE_GRAVITY: 16,                  // m/s² — gravidade da fase de arco
  NUKE_CRUISE_ALT: 130,              // m — altura de cruzeiro do glide sobre a mira
  NUKE_TERMINAL_DIST: 260,           // m — distância que abre o mergulho terminal
  NUKE_LIFE: 25,                     // s de vida (cap de segurança)
  NUKE_COOLDOWN: 1.0,                // s entre lançamentos (anti key-repeat)
};

/** Canhões antiaéreos — baterias AA.
 * Doutrina de alcance (operador, 2026-08-11): baterias antiaéreas (AA/SAM)
 * acertam até 300 m; TODOS os demais atiradores até 200 m. Tiros em linha
 * reta visíveis — o jogador desvia. */
export const AA = {
  RANGE: 300,         // m — bateria antiaérea (doutrina 300/200)
  BASE_INTERVAL: 1.7, // s entre tiros (mission 1)
  CYCLE_SPEEDUP: 0.15,// s a menos por missão
  MAX_SPEEDUP: 0.7,   // limite de aceleração
};

/** Navios de guerra */
export const WARSHIP = {
  RANGE: 200,         // m — doutrina 300/200: atirador comum engaja a 200 m
  INTERVAL: 1.0,      // s entre rajadas (burst de 2 balas)
};

/** Alvos lentos móveis (helicópteros e comboios armados). */
export const SLOW_TARGETS = {
  HELI_ALTITUDE: 46,
  HELI_SPEED: 14,
  HELI_RANGE: 200,   // doutrina 300/200
  HELI_INTERVAL: 2.3,
  CONVOY_SPEED: 9,
  CONVOY_RANGE: 200, // doutrina 300/200
  CONVOY_INTERVAL: 1.9,
  // Tanque de solo lento (WS-4)
  TANK_SPEED: 6,
  TANK_RANGE: 200,   // doutrina 300/200
  TANK_INTERVAL: 2.6,
  // Dirigível de patrulha lento no ar (WS-4)
  PATROLAIR_SPEED: 7,
  PATROLAIR_ALTITUDE: 95,
  PATROLAIR_RANGE: 200, // doutrina 300/200
  PATROLAIR_INTERVAL: 3.0,
};

/** Estrutura de missões */
export const MISSION = {
  WAVE_SIZES: [10, 14, 20],  // missão 1, 2, 3+ (era [8,12,16])
  HP_BONUS_PER_CYCLE: 3,
  COMPLETE_DELAY_MS: 2400,
  NEXT_OVERLAY_MS: 2200,
};

/** Velocidade do ciclo dia/noite */
export const DAY_CYCLE_SPEED = 0.003; // ciclo completo em ~5 min de jogo

/** Mundo (oceano, fog, ilhas) */
export const WORLD = {
  OCEAN_SIZE: 10000,
  // T-V-07 (inhauma-visual-uplift-v1): fog 300/700 era uma "parede" de 700 m —
  // empurrado para 400/3000 para o terreno distante ler através de uma bruma
  // natural (fog_far segue bem abaixo do camera.far=6000).
  FOG_NEAR: 400,
  FOG_FAR: 3000,
  SKY_COLOR: 0x87ceeb,
  CLOUD_COUNT: 60,
  AMBIENT_FLAK_GATE_CYCLE: 2, // flak ambiente só após esta missão
};

/** Céu Preetham (T-V-05) — parâmetros por fase, misturados pela elevação do sol.
 *  DAY/DUSK/NIGHT alimentam os uniforms do Sky vendored (vendor/jsm/objects/Sky.js);
 *  DUSK com turbidity/mie altos é o que torna o entardecer alaranjado (antes o
 *  gradiente de 2 paradas renderizava quase PRETO em tod 0.7-0.85 — bug da auditoria). */
export const SKY = {
  DAY:   { turbidity: 4.0,  rayleigh: 1.8, mieCoefficient: 0.005, mieDirectionalG: 0.80 },
  DUSK:  { turbidity: 10.0, rayleigh: 3.0, mieCoefficient: 0.030, mieDirectionalG: 0.92 },
  NIGHT: { turbidity: 2.0,  rayleigh: 0.5, mieCoefficient: 0.002, mieDirectionalG: 0.80 },
  SCALE: 5000, // escala do dome (dentro do camera.far=6000; grupo segue a câmera)
};

/** Paleta visual */
export const COLORS = {
  jetGrey: 0x2d3037,
  jetDark: 0x1c1e23,
  jetPanel: 0x3a3d44,
  jetCanopy: 0x0a0a18,
  jetCanopyGlass: 0x1a2440,
  exhaustOrange: 0xff7020,
  flameYellow: 0xffdd66,
  fireOrange: 0xffaa30,
  fireRed: 0xff5020,
  fireYellow: 0xffcc40,
  smokeGrey: 0x404040,
  chimneySmoke: 0x383838,
  debrisDark: 0x1f1f22,
  flash: 0xffffff,
  shockwave: 0xffeeaa,
  shockwaveSecondary: 0xffaa66,
  flakAmbient: 0x999999,
  playerHitOrange: 0xff5500,
  bulletWhite: 0xffffff,
  bulletEnemy: 0xff5050,
  pickup: 0x40ff40,
};

/** Layout fixo de alvos por missão (mapa ilhas).
 * Formato: [islandIndex, dx_relativo_à_ilha, dz_relativo_à_ilha, tipo]
 * islandIndex = -1 significa coordenada absoluta (X, Z) no oceano.
 * Missão 1 usa os primeiros 8, missão 2 usa 12, missão 3+ usa todos. */
export const TARGET_LAYOUT = [
  [3,   0,   0, 'base'],
  [3,  30,  15, 'aaGun'],
  [3, -30,  20, 'aaGun'],
  [1,   0,   0, 'factory'],
  [6,   0,   0, 'base'],
  [11,  0,   0, 'building'],
  [2,   0,   0, 'convoy'],
  [7,   0,   0, 'convoy'],
  [0,   0,   0, 'base'],
  [0,  22,  18, 'aaGun'],
  [8,   0,   0, 'factory'],
  [10,  0,   0, 'building'],
  [4,   0,   0, 'factory'],
  [9,   0,   0, 'building'],
  [6,  30,  10, 'aaGun'],
  [11, 22,  10, 'aaGun'],
  // Fleet — closer ships first (appear in mission 1-2), deeper fleet beyond
  [-1,  200,  -420, 'warship'],
  [-1, -320,  -480, 'warship'],
  [-1,  580,  -540, 'warship'],
  [-1,  -80,  -600, 'warship'],
  [-1, -500,  -700, 'warship'],
  [-1,  500,  -900, 'warship'],
  [-1,  380, -1100, 'warship'],
  [-1, -300, -1400, 'warship'],
];

/** Layout de alvos para o mapa deserto.
 * Formato: [mesaIdx, dx, dz, tipo] — mesaIdx=-1 significa coordenada absoluta no piso. */
export const TARGET_LAYOUT_DESERT = [
  [0,   0,  0, 'base'],
  [0,  30, -20, 'aaGun'],
  [1,   0,  0, 'factory'],
  [2,   0,  0, 'factory'],
  [2,  25, 10, 'aaGun'],
  [3,   0,  0, 'aaGun'],
  [4,   0,  0, 'base'],
  [4,  20, 20, 'aaGun'],
  [-1, 200, -100, 'convoy'],
  [-1,-300,  200, 'convoy'],
  [5,   0,  0, 'building'],
  [6,   0,  0, 'aaGun'],
];

/** Layout de alvos para o mapa Rio de Janeiro.
 * Formato: [morroIdx, dx, dz, tipo] — morroIdx=-1 significa coordenada absoluta ao nível do chão.
 * Navios de guerra ficam no oceano (z < -200), AA guns no topo dos morros,
 * alvos terrestres (fábricas, bases) na malha urbana ao nível do chão. */
export const TARGET_LAYOUT_RIO = [
  // Navios de guerra no Atlântico (sul da praia) — 6 navios formando frota
  [-1,   80, -280, 'warship'],
  [-1, -200, -340, 'warship'],
  [-1,  320, -250, 'warship'],
  [-1, -380, -290, 'warship'],
  [-1,  140, -420, 'warship'],
  [-1, -100, -500, 'warship'],
  // AA guns nos topos dos morros famosos
  [ 0,    0,    0, 'aaGun'],   // Pão de Açúcar
  [ 1,    0,    0, 'aaGun'],   // Corcovado
  [ 3,    0,    0, 'aaGun'],   // Pedra da Gávea
  // Alvos terrestres na malha urbana (islandIdx=-1, y=0)
  [-1,   60,  180, 'base'],
  [-1, -100,  260, 'factory'],
  [-1,  200,  330, 'factory'],
  [-1,  -40,  140, 'building'],
  [-1,  150,  240, 'building'],
  [-1,   30,  390, 'base'],
];

/** Layout de alvos para o mapa Inhauma.
 * Formato: [regionIdx, dx, dz, tipo] — regionIdx=-1 significa coordenada absoluta.
 * Alvos civis principais ficam preservados; targets militares usam periferia,
 * morros/serras, MG-238 e zonas industriais/rurais. */
// Coords absolutas (regionIdx -1) — o mapa Inhauma usa malha de terreno contínua
// (uma única região), então alvos de morro são posicionados por coordenada de mundo.
export const TARGET_LAYOUT_INHAUMA = [
  [-1,  760, -300, 'aaGun'],   // topo da serra de Sete Lagoas
  [-1, -560, -120, 'aaGun'],   // encosta dos morros oeste (fora do calçamento da praça pós-T-09)
  [-1, -780, 1460, 'armedConvoy'],  // osm-mg-060 rumo a Cachoeira da Prata
  [-1, -220,  210, 'helicopter'],   // patrulha baixa sobre a MG-238
  [-1,  840, -250, 'armedConvoy'],  // MG-238 rumo Sete Lagoas
  [-1, 1120, -330, 'factory'],
  [-1, 1310, -520, 'helicopter'],   // escolta de Sete Lagoas
  [-1,  480, -160, 'tank'],         // tanque lento na periferia leste (WS-4)
  [-1, -300,  120, 'tank'],         // tanque lento a oeste
  [-1,  820, -360, 'patrolAir'],    // dirigível de patrulha sobre a serra de Sete Lagoas
  [-1, -120,  420, 'patrolAir'],    // dirigível de patrulha sobre o reservatório
  [-1, 1020, -120, 'building'],
  [-1, -700, 1900, 'base'],      // franja leste do novo vale de Cachoeira (T-D-04)
  [-1, -1120, 1980, 'building'], // franja oeste do novo vale de Cachoeira (T-D-04)
  [-1,  330,  330, 'aaGun'],   // morros sudeste
  [-1, -520, -310, 'factory'],
  [-1,  320,  360, 'base'],
  [-1,  480,  140, 'building'],
  [-1,  -40, -330, 'aaGun'],   // morro norte
  [-1, -330,  560, 'armedConvoy'],
  [-1,  680, -540, 'factory'],
  [-1, 1450, -260, 'building'],
  [-1, 1200, -760, 'aaGun'],
  [-1, -1160, 2120, 'factory'],  // franja sudoeste do novo vale de Cachoeira (T-D-04)
];

/** Definição fixa das 18 ilhas: [centerX, centerZ, radius, peakHeight] */
export const ISLAND_DEFS = [
  [ 100, -320,  70, 55], [-360, -580,  95, 78], [ 520, -480,  58, 42],
  [-120, -920, 115, 94], [ 620, -830,  68, 52], [-540, -420,  50, 36],
  [ 240,-1180, 105, 88], [ -70,-1480,  62, 50], [ 820,-1080,  82, 66],
  [-700, -980,  78, 62], [ 350, -650,  55, 40], [-430,-1300,  90, 72],
  // 6 novas ilhas (área expandida para ±1800)
  [-800,  400, 115, 95],   // ilha grande noroeste
  [ 600,-1500, 120, 108],  // ilha grande sudeste
  [ 950,  200,  65,  45],  // média leste
  [-200,  800,  55,  38],  // média norte
  [ 400,  650,  38,  22],  // pequena / recife nordeste
  [-700, -900,  42,  18],  // pequena / recife oeste
];
