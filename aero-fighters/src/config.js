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
  CEILING: 650,       // m — acima disso o empuxo cai (teto prático ~1.000 m)
  TRIM_RATE: 0.35,    // 1/s — auto-trim do pitch para 0 sem input (WS-3)
  STALL_NOSE_DROP: 0.45, // rad/s — queda de nariz em stall
  STALL_CTL: 0.45,    // autoridade de comando durante stall
  PITCH_RATE: 1.45,   // rad/s — quão rápido o nariz sobe/desce
  PITCH_UP_LIMIT: 0.58,   // rad — impede subida vertical/descontrole após decolagem
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
  // Landing flare / touchdown parameters
  FLARE_HI: 3,        // m — altitude de entrada na fase de flare
  FLARE_LO: 0.5,      // m — altitude de toque (touchdown só ocorre abaixo disso)
  TOUCHDOWN_DEBOUNCE: 0.2, // s — janela de debounce para evento TOUCHDOWN_SAFE
  SINK_MAX: -9,       // m/s — taxa de descida insegura (TOUCHDOWN_UNSAFE)
};

/** Canhão de tiro rápido */
export const CANNON = {
  RATE: 0.08,         // segundos entre tiros (= 12.5 tiros/s)
  BULLET_SPD: 110,    // m/s — tracers rápidos como M61 Vulcan (escala arcade)
  BULLET_LIFE: 2.0,   // segundos antes do despawn
  WING_OFFSET: 0.91,  // distância de cada cano até centerline (asas do F-35) — 0.65 × 1.4 (scale)
  MUZZLE_OFFSET: 3.08, // distância para frente do nariz onde a bala spawn — 2.2 × 1.4 (scale)
};

/** Míssil leve (X) — dispara rápido, dano modesto, supply grande */
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
  BLAST_RADIUS:         400,   // raio de destruição de alvos e terreno
  PLAYER_KILL_RADIUS:   200,   // morte instantânea dentro deste raio
  PLAYER_DAMAGE_RADIUS: 450,   // perde 1 vida + shake forte até aqui
};

/** Alias mantido para compatibilidade — aponta para light */
export const MISSILES = MISSILES_LIGHT;

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
  aaGun:    { hp:  6, score: 250, hr2:  9, dropChance: 0.1 },
  warship:  { hp: 35, score: 1200, hr2: 80, dropChance: 0.5 },
};

/** Canhões antiaéreos (única defesa hostil) */
export const AA = {
  RANGE: 220,         // m
  BASE_INTERVAL: 1.7, // s entre tiros (mission 1)
  CYCLE_SPEEDUP: 0.15,// s a menos por missão
  MAX_SPEEDUP: 0.7,   // limite de aceleração
};

/** Navios de guerra */
export const WARSHIP = {
  RANGE: 1200,        // m — engaja bem antes que o player chegue perto
  INTERVAL: 1.0,      // s entre rajadas (burst de 2 balas)
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
  FOG_NEAR: 300,
  FOG_FAR: 700,
  SKY_COLOR: 0x87ceeb,
  CLOUD_COUNT: 60,
  AMBIENT_FLAK_GATE_CYCLE: 2, // flak ambiente só após esta missão
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
export const TARGET_LAYOUT_INHAUMA = [
  [3,    0,    0, 'aaGun'],    // serra no eixo de Sete Lagoas
  [1,    0,    0, 'aaGun'],    // morros oeste de Inhauma
  [-1, -760,  430, 'convoy'],  // MG-238 perto de Cachoeira da Prata
  [-1, -220,  210, 'convoy'],  // MG-238 sul de Inhauma
  [-1,  840, -250, 'convoy'],  // MG-238 rumo Sete Lagoas
  [-1, 1120, -330, 'factory'],
  [-1, 1310, -520, 'base'],
  [-1, 1020, -120, 'building'],
  [-1, -980,  620, 'base'],
  [-1, -850,  360, 'building'],
  [5,    0,    0, 'aaGun'],
  [-1, -520, -310, 'factory'],
  [-1,  320,  360, 'base'],
  [-1,  480,  140, 'building'],
  [2,    0,    0, 'aaGun'],
  [-1, -330,  560, 'convoy'],
  [-1,  680, -540, 'factory'],
  [-1, 1450, -260, 'building'],
  [-1, 1200, -760, 'aaGun'],
  [-1, -1180, 460, 'factory'],
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
