// camera.js — CS-style free look: pointer-lock mouse aims the camera (yaw+pitch)
// in BOTH modes. Not aiming: horse heading eases toward camera yaw. Aiming [F]:
// horse keeps its heading, aim is fully free (shoot sideways while galloping).
// 3rd person orbits the rider, terrain-clamped; 1st person at the rider's eye.
// Keyboard (A/D) works without pointer lock: camera yaw then follows the horse.
// Exports: initCamera, updateCamera, injectLook, getCamYaw. Tune in CAMERA (config.js).

import * as THREE from '../../vendor/three.module.min.js';
import { CAMERA } from './config.js';
import { game } from './state.js';

let camYaw = 0;
let camPitch = 0;

const _desired = new THREE.Vector3();
const _target = new THREE.Vector3();
const _eye = new THREE.Vector3();

/** Shortest signed angle from a to b. */
function angleDelta(a, b) {
  let d = b - a;
  while (d > Math.PI) d -= 2 * Math.PI;
  while (d < -Math.PI) d += 2 * Math.PI;
  return d;
}

/** Mouse-look input in radians (also the headless test API). */
export function injectLook(dxRad, dyRad) {
  camYaw += dxRad;
  camPitch = Math.max(CAMERA.PITCH_MIN, Math.min(CAMERA.PITCH_MAX, camPitch + dyRad));
}

/** Current camera yaw (tests). */
export function getCamYaw() {
  return camYaw;
}

/** Installs pointer-lock + mousemove listeners. Call once from main.js. */
export function initCamera() {
  camYaw = game.player.heading;
  const canvas = game.renderer.domElement;
  // Re-engage pointer lock on any canvas click (lost via Esc)
  canvas.addEventListener('click', () => {
    if (document.pointerLockElement === canvas) return;
    try {
      const req = canvas.requestPointerLock?.();
      if (req && req.catch) req.catch(() => { /* denied/headless — keyboard still works */ });
    } catch (e) { /* denied/headless — keyboard still works */ }
  });
  document.addEventListener('pointerlockchange', () => {
    // CONTRACT: writer of game.ui.pointerLocked
    game.ui.pointerLocked = document.pointerLockElement === canvas;
  });
  document.addEventListener('mousemove', (e) => {
    if (!game.ui.pointerLocked) return;
    injectLook(-e.movementX * CAMERA.MOUSE_SENS, -e.movementY * CAMERA.MOUSE_SENS);
  });
}

/** Horse heading eases toward the camera yaw when not aiming and moving. */
function easeHeading(dt) {
  const p = game.player;
  if (game.ui.aiming) return;
  if (p.speed < 0.5) return;
  // CONTRACT: writer of game.player.heading
  p.heading += angleDelta(p.heading, camYaw) * Math.min(1, CAMERA.HEADING_EASE * dt);
}

function updateThirdPerson(dt) {
  const p = game.player;
  const cam = game.camera;
  const pos = p.position;
  // Without pointer lock the camera trails the horse's heading (A/D steering)
  if (!game.ui.pointerLocked) camYaw += angleDelta(camYaw, p.heading) * Math.min(1, 3 * dt);
  const fx = Math.sin(camYaw), fz = Math.cos(camYaw);
  const dist = CAMERA.THIRD_BACK * Math.cos(camPitch);
  _desired.set(
    pos.x - fx * dist,
    pos.y + CAMERA.THIRD_UP + Math.sin(camPitch) * CAMERA.THIRD_BACK,
    pos.z - fz * dist,
  );
  const k = 1 - Math.exp(-CAMERA.LERP * dt);
  cam.position.lerp(_desired, k);
  // Gallop shake
  if (p.gait === 'gallop') {
    const s = CAMERA.GALLOP_SHAKE * (p.speed / 14);
    cam.position.x += (Math.random() - 0.5) * s;
    cam.position.y += (Math.random() - 0.5) * s;
    cam.position.z += (Math.random() - 0.5) * s;
  }
  // Never sink under the terrain
  const ground = game.world.heightAt(cam.position.x, cam.position.z) + CAMERA.MIN_ABOVE_TERRAIN;
  if (cam.position.y < ground) cam.position.y = ground;
  _target.set(pos.x + fx * CAMERA.LOOK_AHEAD, pos.y + 1.5, pos.z + fz * CAMERA.LOOK_AHEAD);
  cam.lookAt(_target);
}

function updateFirstPerson(dt) {
  const p = game.player;
  const cam = game.camera;
  const pos = p.position;
  if (!game.ui.pointerLocked) camYaw = p.heading;
  const fx = Math.sin(camYaw), fz = Math.cos(camYaw);
  _eye.set(pos.x + fx * CAMERA.FIRST_EYE_FWD, pos.y + CAMERA.FIRST_EYE_UP, pos.z + fz * CAMERA.FIRST_EYE_FWD);
  cam.position.copy(_eye);
  const cp = Math.cos(camPitch), sp = Math.sin(camPitch);
  _target.set(_eye.x + fx * cp, _eye.y + sp, _eye.z + fz * cp);
  cam.lookAt(_target);
}

/** Per-frame camera update. @param {number} dt seconds since last frame */
export function updateCamera(dt) {
  easeHeading(dt);
  const cam = game.camera;
  if (game.ui.cameraMode === 'first') updateFirstPerson(dt);
  else updateThirdPerson(dt);
  // FOV: aim zoom, gallop kick
  const p = game.player;
  const base = p.gait === 'gallop' ? CAMERA.FOV + CAMERA.GALLOP_FOV_KICK : CAMERA.FOV;
  const targetFov = game.ui.aiming ? CAMERA.AIM_FOV : base;
  if (Math.abs(cam.fov - targetFov) > 0.05) {
    cam.fov += (targetFov - cam.fov) * Math.min(1, CAMERA.FOV_LERP * dt);
    cam.updateProjectionMatrix();
  }
}
