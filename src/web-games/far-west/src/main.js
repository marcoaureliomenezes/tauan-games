// main.js — Boot + game loop orchestrator. No game logic, only module wire-up.
// Loaded by index.html as <script type="module">.

import * as THREE from '../../vendor/three.module.min.js';

import { game } from './state.js';
import { SKYCFG } from './config.js';
import { initInput, onPress } from './input.js';
import { loadModels } from './assets.js';
import { buildWorld, updateWorld } from './world.js';
import { spawnHorse, updateHorse, getHorse } from './horse.js';
import { spawnPlayer, updatePlayer } from './player.js';
import { initCamera, updateCamera } from './camera.js';
import { initCombat, updateCombat } from './combat.js';
import { initFx, updateFx } from './fx.js';
import { initHud, updateHud } from './hud.js';
import { initEntities, updateEntities } from './entities.js';
import { initMap, updateMap } from './map.js';
import { initMinimap, updateMinimap } from './minimap.js';
import { initAudio, updateAudio, toggleMute } from './audio.js';
import { initPostfx } from './postfx.js';

async function boot() {
  // Headless/automation degrade: software rasterizers (swiftshader) can't push
  // shadows + AA + full resolution — keep the scene identical, cut pixel cost.
  // ?fx=1 forces full effects even in automation (screenshot/dev runs).
  const TEST_MODE = navigator.webdriver &&
    !new URLSearchParams(window.location.search).has('fx');
  const renderer = new THREE.WebGLRenderer({ antialias: !TEST_MODE, preserveDrawingBuffer: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(TEST_MODE ? 0.4 : Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = !TEST_MODE;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = SKYCFG.EXPOSURE;
  document.body.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 40000);

  // CONTRACT: writer of game.renderer / game.scene / game.camera / game.flags.testMode
  game.renderer = renderer;
  game.scene = scene;
  game.camera = camera;
  game.flags.testMode = TEST_MODE;
  window.THREE = THREE; // debug/test helper (Playwright raycasts)

  initInput();
  await loadModels(renderer);
  const spawn = await buildWorld(game);

  spawnHorse(scene);
  spawnPlayer(getHorse().children[0]); // rider parents to the tilt group
  initEntities(scene);
  initCamera();
  initCombat();
  initFx(scene);
  initHud();
  initMap();
  initMinimap();

  camera.position.set(spawn.x - 6, spawn.y + 3, spawn.z - 6);

  // Start overlay: hides on click; pointer lock is best-effort (never gates input)
  const startOverlay = document.getElementById('start-overlay');
  startOverlay.addEventListener('click', () => {
    startOverlay.classList.add('hidden');
    // CONTRACT: writer of game.flags.started
    game.flags.started = true;
    initAudio(); // AudioContext requires a user gesture
    // CS-style: engage pointer lock on start (camera.js re-engages on canvas click)
    try {
      const req = renderer.domElement.requestPointerLock?.();
      if (req && req.catch) req.catch(() => { /* denied/headless */ });
    } catch (e) { /* denied/headless */ }
  });
  // Headless / keyboard-first sessions: also init audio on the first key press
  document.addEventListener('keydown', () => initAudio(), { once: true });

  const soundBtn = document.getElementById('sound-toggle');
  if (soundBtn) {
    soundBtn.addEventListener('click', () => {
      initAudio();
      const muted = toggleMute();
      soundBtn.innerHTML = muted ? '&#128263; MUDO' : '&#128266; SOM';
    });
  }

  onPress('camera', () => {
    // CONTRACT: writer of game.ui.cameraMode
    game.ui.cameraMode = game.ui.cameraMode === 'third' ? 'first' : 'third';
  });
  onPress('map', () => {
    // CONTRACT: writer of game.ui.mapOpen
    game.ui.mapOpen = !game.ui.mapOpen;
    document.getElementById('map-overlay').classList.toggle('hidden', !game.ui.mapOpen);
  });

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    if (postfx) postfx.setSize(window.innerWidth, window.innerHeight);
  });

  // Post-processing (bloom) only outside test mode — software GL can't afford it
  const postfx = TEST_MODE ? null : initPostfx(renderer, scene, camera);

  const clock = new THREE.Clock();
  let frame = 0;
  // Warm-up: force shader compilation now so the first loop frames don't stall
  // (software GL compiles programs synchronously on first render).
  if (postfx) postfx.render();
  else renderer.render(scene, camera);
  renderer.setAnimationLoop(() => {
    // Clamp at ~1/3 s: on very slow renderers (software GL) game time must still
    // track real time closely enough for input-driven tests and fair gameplay.
    const dt = Math.min(clock.getDelta(), 0.34);
    // CONTRACT: writer of game.time.elapsed
    game.time.elapsed += dt;
    updateHorse(dt);
    updatePlayer(dt);
    updateEntities(dt);
    updateCamera(dt);
    updateCombat(dt);
    updateFx(dt);
    updateWorld(dt, camera.position);
    updateHud();
    updateMap();
    updateMinimap();
    updateAudio(dt);
    // CONTRACT: writer of game.flags.damageFlash
    if (game.flags.damageFlash > 0) game.flags.damageFlash -= dt;
    // TEST_MODE: rendering dominates in software GL — render 1 frame in 30 so
    // the sim and input handling stay at full rAF rate (preserveDrawingBuffer
    // keeps the last rendered frame available for screenshots/pixel checks).
    frame++;
    if (!TEST_MODE || frame % 30 === 1) {
      if (postfx) postfx.render();
      else renderer.render(scene, camera);
    }
  });
}

boot().catch((err) => {
  // Surface boot failures on the start overlay instead of a silent black screen
  const el = document.getElementById('start-overlay');
  if (el) el.textContent = `BOOT ERROR: ${err.message}`;
  throw err;
});
