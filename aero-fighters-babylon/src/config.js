// config.js — Constantes do jogo (numeros, cores, layouts).
// Espelho do aero-fighters/src/config.js adaptado para Babylon.js.

/* global BABYLON */

/** Fisica e controles do aviao */
export const PLAYER = {
  MAX_SPD: 80,
  MIN_SPD: 8,
  STALL_SPD: 10,
  GRAVITY: 14,
  PITCH_RATE: 1.45,
  ROLL_RATE: 2.30,
  YAW_RATE: 0.80,
  RUDDER_FACTOR: 0.65,
  THROTTLE_UP_RATE: 1.3,
  THROTTLE_DN_RATE: 0.9,
  CONVERGE_RATE: 1.6,
  START_HEIGHT: 80,
  SEA_CRASH_Y: 3,
  MOUNTAIN_BUFFER: 2.5,
};

/** Canhao de tiro rapido */
export const CANNON = {
  RATE: 0.08,
  BULLET_SPD: 110,
  BULLET_LIFE: 2.0,
  WING_OFFSET: 0.91,
  MUZZLE_OFFSET: 3.08,
};

/** Missil leve (X) */
export const MISSILES_LIGHT = {
  MAX: 100,
  INITIAL_SPD: 80,
  TRACKING_SPD: 130,
  TURN_RATE: 0.30,
  CLOSE_TURN_RATE: 0.55,
  LIFE: 6.0,
  DAMAGE: 4,
  SEARCH_RANGE: 1200,
};

/** Missil pesado (B) */
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

/** Missil nuclear (N) */
export const MISSILES_NUCLEAR = {
  MAX: 3,
  INITIAL_SPD: 60,
  TRACKING_SPD: 85,
  TURN_RATE: 0.18,
  CLOSE_TURN_RATE: 0.38,
  LIFE: 12.0,
  DAMAGE: 4000,
  BLAST_RADIUS: 180,
  PLAYER_KILL_RADIUS: 80,
  PLAYER_DAMAGE_RADIUS: 200,
};

/** Alias mantido para compatibilidade */
export const MISSILES = MISSILES_LIGHT;

/** Barrel roll */
export const ROLL = {
  DUR: 0.5,
  COOLDOWN: 1.5,
};

/** Tipos de alvo estaticos */
export const TARGETS = {
  base:     { hp: 28, score: 800,  hr2: 36,  dropChance: 0.6 },
  factory:  { hp: 20, score: 600,  hr2: 28,  dropChance: 0.5 },
  building: { hp: 14, score: 450,  hr2: 18,  dropChance: 0.3 },
  convoy:   { hp: 12, score: 380,  hr2: 60,  dropChance: 0.4 },
  aaGun:    { hp:  6, score: 250,  hr2:  9,  dropChance: 0.1 },
  warship:  { hp: 35, score: 1200, hr2: 80,  dropChance: 0.5 },
};

/** Canhoes antiaereos */
export const AA = {
  RANGE: 220,
  BASE_INTERVAL: 1.7,
  CYCLE_SPEEDUP: 0.15,
  MAX_SPEEDUP: 0.7,
};

/** Estrutura de missoes */
export const MISSION = {
  WAVE_SIZES: [8, 12, 16],
  HP_BONUS_PER_CYCLE: 3,
  COMPLETE_DELAY_MS: 2400,
  NEXT_OVERLAY_MS: 2200,
};

/** Velocidade do ciclo dia/noite */
export const DAY_CYCLE_SPEED = 0.003;

/** Mundo */
export const WORLD = {
  OCEAN_SIZE: 10000,
  FOG_NEAR: 300,
  FOG_FAR: 700,
  SKY_COLOR: 0x87ceeb,
  CLOUD_COUNT: 60,
  AMBIENT_FLAK_GATE_CYCLE: 2,
};

/** Paleta visual */
export const COLORS = {
  jetGrey:          new BABYLON.Color3(0x2d / 255, 0x30 / 255, 0x37 / 255),
  jetDark:          new BABYLON.Color3(0x1c / 255, 0x1e / 255, 0x23 / 255),
  exhaustOrange:    new BABYLON.Color3(1.0, 0x70 / 255, 0x20 / 255),
  flameYellow:      new BABYLON.Color3(1.0, 0xdd / 255, 0x66 / 255),
  fireOrange:       new BABYLON.Color3(1.0, 0xaa / 255, 0x30 / 255),
  fireRed:          new BABYLON.Color3(1.0, 0x50 / 255, 0x20 / 255),
  fireYellow:       new BABYLON.Color3(1.0, 0xcc / 255, 0x40 / 255),
  smokeGrey:        new BABYLON.Color3(0x40 / 255, 0x40 / 255, 0x40 / 255),
  debrisDark:       new BABYLON.Color3(0x1f / 255, 0x1f / 255, 0x22 / 255),
  bulletWhite:      new BABYLON.Color3(1.0, 1.0, 1.0),
  bulletEnemy:      new BABYLON.Color3(1.0, 0x50 / 255, 0x50 / 255),
  pickup:           new BABYLON.Color3(0x40 / 255, 1.0, 0x40 / 255),
  playerHitOrange:  new BABYLON.Color3(1.0, 0x55 / 255, 0.0),
};

/** Definicao fixa das 18 ilhas: [centerX, centerZ, radius, peakHeight] */
export const ISLAND_DEFS = [
  [ 100, -320,  70, 55], [-360, -580,  95, 78], [ 520, -480,  58, 42],
  [-120, -920, 115, 94], [ 620, -830,  68, 52], [-540, -420,  50, 36],
  [ 240,-1180, 105, 88], [ -70,-1480,  62, 50], [ 820,-1080,  82, 66],
  [-700, -980,  78, 62], [ 350, -650,  55, 40], [-430,-1300,  90, 72],
  [-800,  400, 115, 95],
  [ 600,-1500, 120, 108],
  [ 950,  200,  65,  45],
  [-200,  800,  55,  38],
  [ 400,  650,  38,  22],
  [-700, -900,  42,  18],
];

/** Layout de alvos: [islandIndex, dx, dz, tipo] */
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
  [-1, -500, -700, 'warship'],
  [-1,  500, -900, 'warship'],
  [-1, -300,-1400, 'warship'],
];
