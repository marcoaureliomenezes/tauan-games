// main.js — Orquestrador principal. Zero logica de jogo; apenas wire-up dos modulos.
// Carregado pelo index.html como <script type="module">.

/* global BABYLON */

import { game } from './state.js';
import { CANNON } from './config.js';
import { audio } from './audio.js';
import { engine, scene, camera, dirLight, ambLight } from './scene.js';
import { initSky, updateSky, getSunData, getAmbientData, getSkyColor } from './sky.js';
import { createIslands, updateWorld } from './world.js';
import { MAPS } from './maps/index.js';
import { updateParticles, spawnMuzzleFlash } from './fx.js';
import { jet, updatePlayer, playerHit, barrelRoll, firePosition, respawnJet } from './player.js';
import { updateTargets } from './targets.js';
import {
  spawnBullet, updateBullets, spawnMissile, updateMissiles,
  updatePickups, spawnNuclearMissile, updateNuclears, recycleBullet,
} from './projectiles.js';
import { updateHUD, showOverlay, hideOverlay, tickOverlayTimer, setSoundIcon } from './hud.js';
import { startGame, restartGame, crashAndDie, checkMissionComplete, gameOver } from './missions.js';
import { createCrosshair, updateCrosshair, missileLockedTarget } from './crosshair.js';
import { initMinimap, updateMinimap } from './ui/minimap.js';

// ─── Boot do mundo ────────────────────────────────────────────────────────────
initSky();
createIslands();
createCrosshair();
initMinimap();

game.activeMap = 'islands';

// ─── Seleção de Mapa ──────────────────────────────────────────────────────────
let _activeMapUpdate = updateWorld;

window.selectMap = function(mapKey) {
  const el = document.getElementById('map-select');
  if (el) el.style.display = 'none';

  if (mapKey !== 'islands') {
    const mapDef = MAPS[mapKey];
    if (mapDef) {
      mapDef.create();
      _activeMapUpdate = mapDef.update;
    }
  }
  game.activeMap = mapKey;

  showOverlay(
    'AERO STRIKE — Babylon.js',
    'Missão: destrua todos os alvos militares (bases, fábricas, prédios, comboios).\n\n' +
    'CONTROLES:\n' +
    '↑ nariz para BAIXO   ↓ nariz para CIMA   (invertido)\n' +
    '← → rolar/virar     W acelerar    S frear\n' +
    'Q/E leme    Espaço/Z canhão    X míssil leve    B míssil pesado    N NUCLEAR    Shift roll    P pausa    M mudo\n\n' +
    '⚠ EVITE colisão com montanhas e o mar — destruição instantânea\n\n' +
    'pressione Espaço para iniciar',
    0,
  );
};

// ─── Input ────────────────────────────────────────────────────────────────────
const input = {
  pitchUp: false, pitchDown: false,
  rollLeft: false, rollRight: false,
  yawLeft: false, yawRight: false,
  throttleUp: false, throttleDown: false,
  fireHeld: false,
};

const KEY_MAP = {
  ArrowUp:    'pitchUp',
  ArrowDown:  'pitchDown',
  ArrowLeft:  'rollLeft',
  ArrowRight: 'rollRight',
  q: 'yawLeft', Q: 'yawLeft',
  e: 'yawRight', E: 'yawRight',
  w: 'throttleUp', W: 'throttleUp',
  s: 'throttleDown', S: 'throttleDown',
  ' ': 'fireHeld',
  z: 'fireHeld', Z: 'fireHeld',
};

document.addEventListener('keydown', (ev) => {
  if (KEY_MAP[ev.key]) { input[KEY_MAP[ev.key]] = true; ev.preventDefault(); }

  audio.init();

  if (ev.key === ' ' || ev.key === 'z' || ev.key === 'Z') {
    handleStartOrFire();
  }
  if (ev.key === 'x' || ev.key === 'X') { audio.init(); fireMissile(); }
  if (ev.key === 'b' || ev.key === 'B') { audio.init(); fireHeavyMissile(); }
  if (ev.key === 'n' || ev.key === 'N') { audio.init(); fireNuclearMissile(); }
  if (ev.key === 'Shift') { audio.init(); barrelRoll(); }
  if (ev.key === 'Enter') { audio.init(); handleStartOrFire(); }
  if (ev.key === 'p' || ev.key === 'P') {
    audio.init();
    if (game.running) {
      game.flags.paused = !game.flags.paused;
      if (game.flags.paused) showOverlay('PAUSADO', 'pressione P para continuar', 0);
      else hideOverlay();
    }
  }
  if (ev.key === 'm' || ev.key === 'M') {
    audio.init();
    const muted = audio.toggle();
    setSoundIcon(muted);
  }
});

document.addEventListener('keyup', (ev) => {
  if (KEY_MAP[ev.key]) input[KEY_MAP[ev.key]] = false;
});

// ─── Botao de som ─────────────────────────────────────────────────────────────
{
  const btn = document.getElementById('sound-toggle');
  if (btn) btn.addEventListener('click', () => {
    audio.init();
    const muted = audio.toggle();
    setSoundIcon(muted);
  });
}

// ─── Acoes de tiro ────────────────────────────────────────────────────────────
let cannonCooldown = 0;
const _fOrig = new BABYLON.Vector3();
const _fRight = new BABYLON.Vector3();

function fireCannon() {
  if (!game.running || game.flags.paused || cannonCooldown > 0) return;
  cannonCooldown = CANNON.RATE;
  const fwd = firePosition(_fOrig, CANNON.MUZZLE_OFFSET);
  // Right do jato
  const right = new BABYLON.Vector3(1, 0, 0).applyRotationQuaternion(jet.rotationQuaternion);
  const leftPos = _fOrig.clone().addInPlace(right.scale(-CANNON.WING_OFFSET));
  const rightPos = _fOrig.clone().addInPlace(right.scale(CANNON.WING_OFFSET));
  spawnBullet(leftPos, fwd, false);
  spawnMuzzleFlash(leftPos);
  spawnBullet(rightPos, fwd, false);
  spawnMuzzleFlash(rightPos);
  audio.cannon();
}

function fireMissile() {
  if (!game.running || game.flags.paused || game.player.missiles <= 0) return;
  const locked = missileLockedTarget();
  if (!locked) { audio.hit(); return; }
  game.player.missiles -= 1;
  firePosition(_fOrig, 1.5);
  spawnMissile(_fOrig.clone(), locked, jet.rotationQuaternion.clone(), 'light');
}

function fireHeavyMissile() {
  if (!game.running || game.flags.paused || game.player.heavyMissiles <= 0) return;
  const locked = missileLockedTarget();
  if (!locked) { audio.hit(); return; }
  game.player.heavyMissiles -= 1;
  firePosition(_fOrig, 1.5);
  spawnMissile(_fOrig.clone(), locked, jet.rotationQuaternion.clone(), 'heavy');
}

function fireNuclearMissile() {
  if (!game.running || game.flags.paused || game.player.nuclearMissiles <= 0) return;
  const locked = missileLockedTarget();
  firePosition(_fOrig, 1.5);
  spawnNuclearMissile(_fOrig.clone(), locked, jet.rotationQuaternion.clone());
}

function handleStartOrFire() {
  audio.init();
  if (!game.running) {
    if (!game.player.dead && game.player.lives > 0 && !game.flags.missionFailed && !game.flags.missionCompleteShown) {
      startGame();
      return;
    }
    if (game.flags.missionFailed || game.player.dead) {
      if (game.flags.crashFreezeTime <= 0) restartGame();
      return;
    }
  }
  fireCannon();
}

// ─── Camera ───────────────────────────────────────────────────────────────────
const _camDesired = new BABYLON.Vector3();
const _camTarget  = new BABYLON.Vector3();
const _camFwd     = new BABYLON.Vector3();
const _worldUp    = new BABYLON.Vector3(0, 1, 0);

// Configurar viewport da camera
camera.viewport = new BABYLON.Viewport(0, 0, 1, 1);

function updateCamera(dt) {
  // Offset local: 0, +5.5, +10 em espaco do jet
  const localOff = new BABYLON.Vector3(0, 5.5, 10).applyRotationQuaternion(jet.rotationQuaternion);
  _camDesired.copyFrom(jet.position).addInPlace(localOff);

  // Camera shake
  if (game.flags.cameraShake) {
    const s = game.flags.cameraShake;
    _camDesired.x += (Math.random() - 0.5) * s.intensity;
    _camDesired.y += (Math.random() - 0.5) * s.intensity;
    _camDesired.z += (Math.random() - 0.5) * s.intensity * 0.3;
    s.intensity *= (1 - 8 * dt);
    s.duration -= dt;
    if (s.duration <= 0 || s.intensity < 0.05) game.flags.cameraShake = null;
  }

  // Shake de hit
  if (game.flags.shakeTime > 0) {
    game.flags.shakeTime -= dt;
    _camDesired.x += (Math.random() - 0.5) * 1.5;
    _camDesired.y += (Math.random() - 0.5) * 1.5;
  }

  // Lerp suave da posicao da camera
  camera.position = BABYLON.Vector3.Lerp(camera.position, _camDesired, 0.09);

  // Look-at: aponta para frente do jet com offset de altura (identical ao Three.js)
  const _camFwdNew = new BABYLON.Vector3(0, 0, -1).applyRotationQuaternion(jet.rotationQuaternion);
  _camFwd.copyFrom(_camFwdNew);
  const jetUpForAim = new BABYLON.Vector3(0, 5.5, 0).applyRotationQuaternion(jet.rotationQuaternion);
  _camTarget.copyFrom(jet.position).addInPlace(jetUpForAim).addInPlace(_camFwd.scale(30));
  camera.setTarget(_camTarget);

  // Atualizar sol (shadow)
  const sun = getSunData();
  dirLight.direction = new BABYLON.Vector3(
    -sun.direction.x, -sun.direction.y, -sun.direction.z,
  );
  dirLight.position = new BABYLON.Vector3(
    jet.position.x + sun.direction.x * 300,
    jet.position.y + Math.max(50, sun.direction.y * 300),
    jet.position.z + sun.direction.z * 300,
  );

  // Audio listener
  audio.updateListener(
    camera.position.x, camera.position.y, camera.position.z,
    _camFwd.x, _camFwd.y, _camFwd.z,
    0, 1, 0,
  );
}

// ─── Game loop via Babylon Engine ─────────────────────────────────────────────
let _lastMs = performance.now();
let _cloudColorTimer = 0;

engine.runRenderLoop(() => {
  const now = performance.now();
  let dt = (now - _lastMs) / 1000;
  _lastMs = now;
  if (dt > 0.1) dt = 0.1;

  if (game.running && !game.flags.paused && !game.flags.missionFailed) {
    cannonCooldown -= dt;
    game.flags.rollTimer    -= dt;
    game.flags.rollCooldown -= dt;
    game.flags.invincibility -= dt;

    if (input.fireHeld) fireCannon();

    updatePlayer(dt, input, crashAndDie);
    updateBullets(dt, jet.position, playerHit);
    updateMissiles(dt);
    updateNuclears(dt);
    updateTargets(dt, jet.position);
    updatePickups(dt, jet.position);
    updateParticles(dt);
    _activeMapUpdate(dt, jet.position);

    checkMissionComplete();

    if (game.player.lives <= 0 && !game.flags.missionFailed) gameOver();
    if (game.player.dead && !game.flags.missionFailed) gameOver();

    // Ciclo dia/noite
    updateSky(dt);
    const sun = getSunData();
    dirLight.diffuse.set(sun.colorR, sun.colorG, sun.colorB);
    dirLight.intensity = sun.intensity;
    const amb = getAmbientData();
    ambLight.diffuse.set(amb.colorR, amb.colorG, amb.colorB);
    ambLight.intensity = amb.intensity;
    const skyC = getSkyColor();
    scene.fogColor.set(skyC.r, skyC.g, skyC.b);
    scene.clearColor.set(skyC.r, skyC.g, skyC.b, 1.0);

    // Piscar jet em invencibilidade
    jet.setEnabled(game.flags.invincibility > 0 ? Math.floor(game.flags.invincibility * 12) % 2 === 0 : true);

    // Atualizar cores das nuvens a cada ~2s
    _cloudColorTimer -= dt;
    if (_cloudColorTimer <= 0) {
      _cloudColorTimer = 2.0;
      // Importar inline para evitar circular
      import('./world.js').then(w => w.updateCloudColors(game.timeOfDay || 0.35));
    }
  } else {
    if (game.flags.crashFreezeTime > 0) game.flags.crashFreezeTime -= dt;
    updateParticles(dt);
    _activeMapUpdate(dt, jet.position);
  }

  updateCamera(dt);
  updateCrosshair(dt, camera, jet.position, jet.rotationQuaternion);
  tickOverlayTimer(dt);
  updateHUD();
  updateMinimap();

  scene.render();
});
