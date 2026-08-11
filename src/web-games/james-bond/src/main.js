import * as THREE from '../../vendor/three.module.min.js';
import { CONFIG } from './config.js';
import { MISSIONS } from './content/missions.js';
import { WEAPONS } from './content/weapons.js';
import { game, loadProgress, resetRun, saveProgress } from './state.js';
import { createPhysics } from './engine/physics.js';
import { createInput } from './engine/input.js';
import { createAudio } from './engine/audio.js';
import { createWorld, disposeWorld } from './world.js';
import { createPlayer } from './player.js';
import { createGuards } from './ai/guards.js';
import { createCombat } from './combat.js';
import { createFx } from './fx.js';
import { createMissionRules } from './gameplay/mission-rules.js';
import { createUi } from './ui.js';
import { createPerformanceController } from './performance.js';

const viewport = document.querySelector('#viewport');
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(CONFIG.baseFov, innerWidth / innerHeight, 0.04, 220);

// AA is a context-creation flag: probe the GPU first so software renderers skip MSAA.
function detectWeakGpu() {
  try {
    const probe = document.createElement('canvas').getContext('webgl2') || document.createElement('canvas').getContext('webgl');
    if (!probe) return true;
    const extension = probe.getExtension('WEBGL_debug_renderer_info');
    const name = extension ? probe.getParameter(extension.UNMASKED_RENDERER_WEBGL) : probe.getParameter(probe.RENDERER);
    return /swiftshader|llvmpipe|software|microsoft basic/i.test(name || '');
  } catch {
    return true;
  }
}
const renderer = new THREE.WebGLRenderer({ antialias: !detectWeakGpu(), powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;
renderer.outputColorSpace = THREE.SRGBColorSpace;
viewport.append(renderer.domElement);
scene.add(camera);

game.renderer = renderer;
game.camera = camera;
const performanceMode = createPerformanceController(renderer, scene, game);
const physics = await createPhysics();
const audio = createAudio();
const fx = createFx(scene);
const ui = createUi(game);
const input = createInput(camera, renderer.domElement, pauseFromUnlock);
const player = createPlayer(game, physics, camera, input, audio);
game.physics = physics;
game.controls = input.controls;
game.telemetry.physicsReady = true;
game.telemetry.howlerReady = Boolean(window.Howler);

let world, guards, combat, rules;
let selectedMission = 0, accumulator = 0, lastTime = performance.now();
let frames = 0, telemetryTime = performance.now();
let lights = [];

loadProgress();
ui.refresh();
ui.setCallbacks({
  preview: (index) => loadPreview(index),
  deploy: (index) => deploy(index),
  resume: resume,
  abort: returnToMenu,
  menu: returnToMenu,
  next: nextMission,
  toggleMap: toggleMap,
});

function applyAtmosphere(mission) {
  scene.background = new THREE.Color(mission.palette.sky);
  scene.fog = new THREE.FogExp2(mission.palette.fog, mission.code === 'OP-03' ? 0.018 : 0.011);
  lights.forEach((light) => scene.remove(light));
  const hemi = new THREE.HemisphereLight(mission.palette.sky, mission.palette.floor, 1.6);
  const ambient = new THREE.AmbientLight(0xb9c7be, mission.code === 'OP-02' ? 1.35 : 0.72);
  const sun = new THREE.DirectionalLight(0xfff3d6, 2.2);
  sun.position.set(18, 28, 12);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.left = -45;
  sun.shadow.camera.right = 45;
  sun.shadow.camera.top = 45;
  sun.shadow.camera.bottom = -45;
  lights = [hemi, ambient, sun];
  scene.add(...lights);
}

function disposeMission() {
  combat?.dispose();
  guards?.dispose();
  disposeWorld(scene, world);
  combat = null;
  guards = null;
  rules = null;
  world = null;
}

function buildMission(index) {
  disposeMission();
  game.telemetry.worldBuilds += 1;
  selectedMission = index;
  const mission = MISSIONS[index];
  applyAtmosphere(mission);
  world = createWorld(scene, physics, mission);
  performanceMode.apply(world.group);
  game.world = world;
  return mission;
}

function loadPreview(index, force = false) {
  if (game.phase !== 'menu') return;
  if (force || !world || selectedMission !== index) buildMission(index);
  camera.fov = CONFIG.baseFov;
  camera.updateProjectionMatrix();
  camera.position.copy(world.start).add(new THREE.Vector3(7, 8, 10));
  camera.lookAt(world.start);
}

function deploy(index) {
  audio.unlock();
  resetRun();
  game.missionIndex = index;
  const mission = world && selectedMission === index ? MISSIONS[index] : buildMission(index);
  game.telemetry.staticColliders = physics.staticColliderCount;
  player.spawn(world.start, world.spawnLook);
  guards = createGuards(scene, game, world, audio, damagePlayer, fx);
  combat = createCombat(scene, camera, game, input, audio, fx, world, guards, damagePlayer, ui);
  performanceMode.apply(scene);
  rules = createMissionRules(game, mission, world, input, audio, {
    objective: () => ui.updateHud(),
    prompt: ui.prompt,
    complete: completeMission,
  });
  game.phase = 'playing';
  hudTimer = 0;
  camera.fov = CONFIG.baseFov;
  camera.updateProjectionMatrix();
  ui.screen(null);
  ui.updateHud();
  input.lock();
}

let hudTimer = 0;
function fixedUpdate(dt) {
  game.time += dt;
  player.update(dt);
  combat.update(dt);
  guards.update(dt, game.time, camera.position);
  rules.update(dt);
  fx.update(dt);
  updateFov(dt);
  hudTimer -= dt;
  if (hudTimer <= 0) {
    hudTimer = CONFIG.hudRefresh;
    ui.updateHud();
    ui.drawRadar(world, camera);
  }
  camera.getWorldDirection(tempDirection);
  audio.setListener(camera.position, tempDirection);
}

// ADS zoom + sprint FOV kick, smoothly interpolated
function updateFov(dt) {
  const adsT = game.view?.adsT || 0;
  const sprint = game.player.sprinting && !adsT ? CONFIG.sprintFovBoost : 0;
  const target = (CONFIG.baseFov + sprint) * (1 - adsT) + (WEAPONS[game.currentWeapon]?.adsFov || 60) * adsT;
  if (Math.abs(camera.fov - target) > 0.05) {
    camera.fov += (target - camera.fov) * Math.min(1, dt * CONFIG.adsSpeed);
    camera.updateProjectionMatrix();
  }
}

const tempDirection = new THREE.Vector3();
function damagePlayer(amount) {
  if (game.phase !== 'playing') return;
  const absorbed = Math.min(game.armor, amount * 0.55);
  game.armor -= absorbed;
  game.health -= amount - absorbed;
  audio.hurt();
  const vignette = document.querySelector('#damage-vignette');
  vignette.style.opacity = '1';
  setTimeout(() => { vignette.style.opacity = '0'; }, 130);
  if (game.health <= 0) failMission();
}

function completeMission() {
  if (game.phase !== 'playing') return;
  game.phase = 'result';
  game.unlocked = Math.max(game.unlocked, Math.min(MISSIONS.length, game.missionIndex + 2));
  saveProgress();
  input.controls.unlock();
  ui.refresh();
  ui.showResult(true);
}

function failMission() {
  game.phase = 'result';
  input.controls.unlock();
  ui.showResult(false);
}

function pauseFromUnlock() {
  if (game.phase !== 'playing') return;
  game.phase = 'paused';
  ui.screen('pause');
}

function resume() {
  if (game.phase !== 'paused') return;
  game.phase = 'playing';
  ui.screen(null);
  input.lock();
}

function returnToMenu() {
  game.phase = 'menu';
  if (input.controls.isLocked) input.controls.unlock();
  ui.screen('menu');
  loadPreview(ui.selected, true);
}

function nextMission() {
  const index = Math.min(MISSIONS.length - 1, game.missionIndex + 1);
  game.phase = 'menu';
  ui.selectMission(index);
  ui.showBriefing();
}

function toggleMap() {
  if (game.phase !== 'playing' || !world) return;
  ui.toggleMap(world, camera);
}

function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(CONFIG.maxFrameDelta, (now - lastTime) / 1000 || 0);
  lastTime = now;
  if (now - telemetryTime >= 1000) {
    game.telemetry.fps = Math.round(frames / ((now - telemetryTime) / 1000));
    game.telemetry.drawCalls = renderer.info.render.calls;
    performanceMode.sample(game.telemetry.fps);
    frames = 0;
    telemetryTime = now;
  }
  if (game.phase === 'playing') {
    if (input.consume('KeyM')) toggleMap();
    if (!ui.mapOpen) {
      accumulator += dt;
      while (accumulator >= CONFIG.fixedStep) { fixedUpdate(CONFIG.fixedStep); accumulator -= CONFIG.fixedStep; }
    }
  } else if (game.phase === 'menu' && world) {
    const angle = now * 0.00008;
    camera.position.set(world.start.x + Math.cos(angle) * 13, 8, world.start.z + Math.sin(angle) * 13);
    camera.lookAt(world.start.x, 1, world.start.z);
    fx.update(dt);
  }
  if (!performanceMode.shouldRender(now)) return;
  frames += 1;
  const shake = fx.shake;
  if (shake) camera.position.add(tempDirection.set((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake, 0));
  renderer.render(scene, camera);
  if (shake) camera.position.sub(tempDirection);
}

game.api = {
  deploy,
  completeObjective: (key) => rules?.complete(key),
  completeMission,
  damagePlayer,
  unlockAll() { game.unlocked = MISSIONS.length; saveProgress(); ui.refresh(); },
  snapshot: () => ({ phase: game.phase, mission: game.missionIndex, health: game.health, objectives: game.objectives.map((item) => ({ ...item })), enemies: game.enemies.filter((enemy) => enemy.alive).length, fps: game.telemetry.fps }),
};

addEventListener('resize', () => performanceMode.resize(camera));

loadPreview(0);
requestAnimationFrame(frame);
