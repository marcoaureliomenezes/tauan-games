// Web game package: james-bond.
import { CONFIG, SENSITIVITY, clampSensitivity } from './config.js';

export const game = {
  phase: 'menu',
  missionIndex: 0,
  difficulty: 'agent',
  kidsMode: false,
  sensitivity: SENSITIVITY.default,
  unlocked: 1,
  health: CONFIG.maxHealth,
  armor: CONFIG.startingArmor,
  alertLevel: 0,
  time: 0,
  kills: 0,
  shots: 0,
  hits: 0,
  objectives: [],
  currentWeapon: 'deagle',
  ammo: {},
  grenades: Infinity,
  player: { position: { x: 0, y: 1, z: 0 }, yaw: 0, crouched: false },
  enemies: [],
  interactables: [],
  explosions: [],
  world: null,
  physics: null,
  renderer: null,
  camera: null,
  controls: null,
  api: {},
  // Contadores de telemetria nascem ZERADOS, não undefined — os specs de
  // polling (T-07) comparam "> valor anterior" e `n > undefined` é false para
  // sempre (bug latente encontrado na 1ª execução full da suíte pós-v0.10.0:
  // o contador de explosões nunca "subia" aos olhos do waitForFunction).
  telemetry: { fps: 60, drawCalls: 0, physicsReady: false, yukaReady: false, quality: 'high', worldBuilds: 0, staticColliders: 0, explosions: 0, spawns: 0, rockets: 0 },
};

// Gancho de console/E2E. Guardado para que o estado também seja importável
// fora do navegador (testes unitários em node).
if (typeof window !== 'undefined') window.game = game;

export function loadProgress() {
  try {
    const value = JSON.parse(localStorage.getItem(CONFIG.saveKey) || '{}');
    game.unlocked = Math.max(1, Math.min(6, Number(value.unlocked) || 1));
    game.kidsMode = Boolean(value.kidsMode);
    // Sensibilidade ausente no save antigo (versão 1) cai no padrão — nunca
    // Infinity/NaN vazando de um localStorage adulterado à mão.
    game.sensitivity = clampSensitivity(value.sensitivity ?? SENSITIVITY.default);
  } catch {
    localStorage.removeItem(CONFIG.saveKey);
  }
}

export function saveProgress() {
  localStorage.setItem(CONFIG.saveKey, JSON.stringify({
    version: 1, unlocked: game.unlocked, kidsMode: game.kidsMode, sensitivity: game.sensitivity,
  }));
}

/** Arma com que toda missão começa. Uma constante, não um literal solto. */
export const STARTING_WEAPON = 'deagle';

export function resetRun() {
  // BUG (relatado): trocar de fase carregando a AK deixava `currentWeapon` em
  // 'ak47' enquanto o view-model era reconstruído do zero na pistola. Resultado:
  // aparência de pistola com comportamento de metralhadora. O estado da partida
  // é quem manda — quem define a arma inicial é este reset, e o view-model a
  // lê de `game.currentWeapon` em vez de assumir um padrão próprio.
  game.currentWeapon = STARTING_WEAPON;
  game.health = CONFIG.maxHealth;
  game.armor = CONFIG.startingArmor;
  game.alertLevel = 0;
  game.time = 0;
  game.kills = 0;
  game.shots = 0;
  game.hits = 0;
  game.grenades = Infinity;
  game.enemies = [];
  game.interactables = [];
  game.explosions = [];
}
