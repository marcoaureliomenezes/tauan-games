// state.js — Estado global do jogo. Única fonte de verdade.
// Exporta: `game` (compartilhado com window.game), `resetState()` para reinício.
// Para adicionar campo novo: edite createInitialState() e documente em CONVENTIONS.md.

import { createRng, parseRuntimeConfig } from './rng.js';
import { createSortieMachine, SortieState } from './sortie-state.js';
import { createGroundPhysicsState } from './ground-physics.js';
import { createServiceState } from './service-scene.js';
import { createEjectionState } from './ejection.js';
import { createCameraRig } from './camera-modes.js';

const runtimeConfig = parseRuntimeConfig(typeof window !== 'undefined' ? window.location.search : '');
const runtimeRng = createRng(runtimeConfig.seed);

function initialPlayerPosition(mapKey) {
  if (mapKey === 'inhauma') return { x: -610, y: 0.9, pz: 475 };
  return { x: -160, y: 0.9, pz: 350 };
}

/** Constrói o objeto de estado padrão. */
function createInitialState() {
  const initialPlayer = initialPlayerPosition(runtimeConfig.map || 'desert');
  return {
    runtime: runtimeConfig,
    rng: runtimeRng,
    running: false,
    score: 0,
    projectiles: [],
    targets: [],
    enemies: [],        // alias mantido para compat com tests legados
    kills: 0,
    cycle: 1,
    targetsTotal: 0,
    targetsDestroyed: 0,
    islands: [],
    wingmen: [],           // aliados AI em formação
    timeOfDay: 0.35,    // ciclo dia/noite: 0.0 (meia-noite) → 1.0 (meia-noite)
    time: 0,            // tempo total de jogo em segundos (para animações)
    activeMap: runtimeConfig.map || 'desert', // mapa ativo: 'islands' | 'desert' | 'rio'
    missionRealism: {
      enabled: true,
      sortie: createSortieMachine(SortieState.MENU),
      ground: createGroundPhysicsState(),
      service: createServiceState(runtimeConfig.testMode),
      ejection: createEjectionState(),
      camera: createCameraRig(),
      groundContact: null,
      landingZoneStatus: null,
      missionScore: 0,
      criticalVideoCapture: false,
      hudLayout: { style: 'n64-green-combat', overlap: false },
      aircraftVisual: { model: 'procedural-f35-v2', gearVisible: true, loadoutVisible: true },
      desertLandmarks: { roads: 0, hangars: 0, lights: 0 },
    },
    player: {
      x: initialPlayer.x, y: initialPlayer.y, pitch: 0, pz: initialPlayer.pz,
      dead: false, lives: 3,
      hp: 3,                 // pontos de dano dentro da vida atual (3 hits → mayday)
      missiles: 100,         // mísseis leves (X)
      heavyMissiles: 10,     // mísseis pesados (B) — dano 5x, supply limitado
      nuclearMissiles: 3,    // mísseis nucleares (N) — devastadores, supply 3
      speed: 0, throttle: 0.05, stalled: false,
    },
    flags: {
      paused: false,
      missionFailed: false,
      missionCompleteShown: false,
      invincibility: 0,
      shakeTime: 0,
      crashFreezeTime: 0,
      cameraShake: null,
      mayday: false,         // avião perdeu controle, caindo
      maydayTimer: 0,        // segundos restantes antes de ejetar
      damageSmoke: 0,        // timer de emissão de fumaça de dano
    },
  };
}

/** Estado vivo — referência exposta em window.game para tests. */
export const game = createInitialState();
game.enemies = game.targets;        // alias compartilha referência
if (typeof window !== 'undefined') window.game = game;

/** Reseta `game` para um novo jogo sem trocar a referência (importadores mantêm). */
export function resetState() {
  const fresh = createInitialState();
  // copia campos primitivos
  game.running = fresh.running;
  game.score = fresh.score;
  game.timeOfDay = fresh.timeOfDay;
  game.time = fresh.time;
  game.runtime = fresh.runtime;
  game.rng = fresh.rng;
  game.kills = fresh.kills;
  game.cycle = fresh.cycle;
  // activeMap persiste entre resets (player escolhe uma vez por sessão)
  game.targetsTotal = fresh.targetsTotal;
  game.targetsDestroyed = fresh.targetsDestroyed;
  // limpa arrays in-place (mantém referência exportada)
  game.projectiles.length = 0;
  game.targets.length = 0;
  game.islands.length = 0;
  game.wingmen.length = 0;
  // player
  Object.assign(game.player, fresh.player);
  game.missionRealism = fresh.missionRealism;
  // flags
  Object.assign(game.flags, fresh.flags);
}
