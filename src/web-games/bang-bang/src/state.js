// state.js — Global game state. Single source of truth (window.game).
// Exports: `game`. To add a new field, edit createInitialState() below.
// Only main.js/world.js write structural refs (renderer/scene/camera/world);
// gameplay modules write their designated fields with a CONTRACT comment.

/** Builds the default state object. */
function createInitialState() {
  return {
    renderer: null,
    scene: null,
    camera: null,
    // Filled by buildWorld(): chunks, heightAt/normalAt/slopeAt/bridgeAt/biomeAt/
    // waterInfoAt refs, rivers, lake, fords, bridges, spawn, noiseSource.
    world: {
      chunks: [],
      heightAt: null,
      normalAt: null,
      slopeAt: null,
      bridgeAt: null,
      biomeAt: null,
      waterInfoAt: null,
      rivers: [],
      lake: null,
      fords: [],
      bridges: [],
      spawn: null,
      noiseSource: null,
      testRock: null,          // deterministic large rock for collision tests
      colliderCount: null,     // fn — static collider registry size (collision.js)
      nearestCollider: null,   // fn(x, z) — nearest collider (collision.js, tests)
    },
    player: {
      position: { x: 0, y: 0, z: 0 },
      heading: 0,              // rad — facing direction
      gait: 'stop',            // 'stop' | 'walk' | 'trot' | 'gallop'
      speed: 0,                // m/s
      health: 100,
      stamina: 100,
      food: 100,
      ammo: 6,                 // rounds in the cylinder
      ammoReserve: 36,
      banditsCaptured: 0,
      carrying: null,          // null | 'deer' — carcass being carried
      mounted: true,
      airborne: false,         // mid-jump (written by horse.js, read by player/camera)
    },
    entities: {
      deer: [],
      snakes: [],
      eagles: [],
      npcs: [],
      natives: [],
      bandits: [],
      wagons: [],
      train: [],
      towns: [],
      villages: [],
      camp: null,
      carcasses: [],   // deer carcasses awaiting pickup: { position, mesh }
      targets: [],       // combat hitbox registry: { object3D, cb } via registerTarget()
    },
    ui: {
      cameraMode: 'third',     // 'first' | 'third'
      mapOpen: false,
      aiming: false,
      pointerLocked: false,
      mapMarkers: { bandits: 0 }, // debug/test: markers drawn by map.js
    },
    // Written by audio.js: { muted, state } — AudioContext state for tests.
    audio: { muted: false, state: 'suspended' },
    flags: {
      started: false,          // start overlay dismissed
      paused: false,
      reloading: false,        // revolver reload in progress
      testMode: false,         // headless/automation degrade (written by main.js)
      damageFlash: 0,          // s remaining of red HUD flash (snake bite, arrows)
      lastShot: null,          // {origin, dir, end} of the last shot (aim tests)
    },
    time: {
      elapsed: 0,              // s since boot
      dayTime: 0.32,           // 0..1 — 0=midnight, 0.5=noon (written by sky.js)
    },
  };
}

/** Live state — reference exposed on window.game for external tests. */
export const game = createInitialState();
if (typeof window !== 'undefined') window.game = game;
