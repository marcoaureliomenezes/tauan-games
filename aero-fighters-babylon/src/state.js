// state.js — Estado mutavel do jogo. Unica fonte de verdade.
// Modulos escrevem game.player.X, game.flags.X etc.

export const game = {
  running: false,
  score: 0,
  kills: 0,
  cycle: 1,
  time: 0,
  timeOfDay: 0.35,
  activeMap: 'islands',

  // Estado do jogador
  player: {
    x: 0,
    y: 80,
    pz: 0,
    pitch: 0,
    speed: 25,
    throttle: 0.5,
    stalled: false,
    lives: 3,
    missiles: 100,
    heavyMissiles: 10,
    nuclearMissiles: 3,
    dead: false,
  },

  // Flags de controle de fluxo
  flags: {
    paused: false,
    invincibility: 0,
    rollTimer: 0,
    rollCooldown: 0,
    rollDir: 1,
    missionFailed: false,
    missionCompleteShown: false,
    crashFreezeTime: 0,
    shakeTime: 0,
    cameraShake: null,
  },

  // Entidades do mundo
  targets: [],
  projectiles: [],
  islands: [],

  // Contadores de missao
  targetsDestroyed: 0,
  targetsTotal: 0,
};
