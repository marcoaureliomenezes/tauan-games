// Web game package: james-bond.
import { CONFIG } from './config.js';

export const game = {
  phase: 'menu',
  missionIndex: 0,
  difficulty: 'agent',
  unlocked: 1,
  health: CONFIG.maxHealth,
  armor: CONFIG.startingArmor,
  alertLevel: 0,
  time: 0,
  kills: 0,
  shots: 0,
  hits: 0,
  objectives: [],
  currentWeapon: 'p7',
  ammo: {},
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
  telemetry: { fps: 60, drawCalls: 0, physicsReady: false, yukaReady: false, quality: 'high', worldBuilds: 0, staticColliders: 0 },
};

window.game = game;

export function loadProgress() {
  try {
    const value = JSON.parse(localStorage.getItem(CONFIG.saveKey) || '{}');
    game.unlocked = Math.max(1, Math.min(6, Number(value.unlocked) || 1));
  } catch {
    localStorage.removeItem(CONFIG.saveKey);
  }
}

export function saveProgress() {
  localStorage.setItem(CONFIG.saveKey, JSON.stringify({ version: 1, unlocked: game.unlocked }));
}

export function resetRun() {
  game.health = CONFIG.maxHealth;
  game.armor = CONFIG.startingArmor;
  game.alertLevel = 0;
  game.time = 0;
  game.kills = 0;
  game.shots = 0;
  game.hits = 0;
  game.enemies = [];
  game.interactables = [];
  game.explosions = [];
}
