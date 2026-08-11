// horse.js — Horse locomotion: gaits (stop/walk/trot/gallop) with smooth accel,
// per-gait turn limits, stamina, slope/water/bridge terrain rules, body alignment
// to the terrain normal, GLB clip crossfade by gait (procedural fallback: bob).
// Exports: spawnHorse, updateHorse, teleportHorse, getHorse.
// To tune movement feel, edit HORSE in config.js.

import * as THREE from '../../vendor/three.module.min.js';
import { HORSE, RIVER, PLAYER, COLLISION } from './config.js';
import { game } from './state.js';
import { isDown, onPress } from './input.js';
import { spawn, getModel, fitHeight } from './assets.js';
import { resolveCollision } from './collision.js';
import { spawnImpact } from './fx.js';

let root = null;      // world-positioned group (heading on rotation.y)
let tilt = null;      // inner group aligned to the terrain normal
let mixer = null;
let currentAction = null;
const actions = {};
let bobPhase = 0;     // procedural fallback animation

let speed = 0;
let exhausted = false; // stamina lockout until GALLOP_RESUME
let vy = 0;           // vertical velocity (jump)
let airborne = false;
let hoofDustT = 0;

const _up = new THREE.Vector3(0, 1, 0);
const _n = new THREE.Vector3();
const _qTarget = new THREE.Quaternion();
const _dustPos = new THREE.Vector3();
const _colPos = new THREE.Vector3(); // swept-collision substep point

/** Picks a clip: exact (armature-prefix-stripped) name first, fragment fallback. */
function clipAction(entry, fragment) {
  if (!mixer || !entry) return null;
  const f = fragment.toLowerCase();
  const norm = (c) => c.name.split('|').pop().toLowerCase();
  const clip = entry.animations.find((c) => norm(c) === f) ||
               entry.animations.find((c) => norm(c).includes(f));
  return clip ? mixer.clipAction(clip) : null;
}

function crossfade(next, fade = 0.25) {
  if (!next || next === currentAction) return;
  next.reset().fadeIn(fade).play();
  if (currentAction) currentAction.fadeOut(fade);
  currentAction = next;
}

/**
 * Creates the horse at game.player.position (set by buildWorld spawn).
 * @param {THREE.Scene} scene @returns {THREE.Group} the horse root
 */
export function spawnHorse(scene) {
  const entry = getModel('horse');
  root = new THREE.Group();
  root.name = 'horse';
  tilt = new THREE.Group();
  root.add(tilt);
  const model = fitHeight(spawn('horse'), HORSE.MODEL_HEIGHT);
  if (!entry) model.rotation.y = -Math.PI / 2; // procedural fallback faces +X -> +Z
  tilt.add(model);
  const p = game.player.position;
  root.position.set(p.x, p.y, p.z);
  scene.add(root);

  if (entry && entry.animations.length) {
    mixer = new THREE.AnimationMixer(model);
    actions.idle = clipAction(entry, 'Idle');
    actions.walk = clipAction(entry, 'Walk');
    actions.gallop = clipAction(entry, 'Gallop');
    actions.jump = clipAction(entry, 'Gallop_Jump');
    crossfade(actions.idle, 0);
  }
  onPress('jump', tryJump);
  return root;
}

/** Space: ballistic jump from the ground (keeps horizontal velocity). */
function tryJump() {
  if (airborne) return;
  airborne = true;
  game.player.airborne = true; // CONTRACT: writer of game.player.airborne
  vy = Math.sqrt(2 * HORSE.GRAVITY * HORSE.JUMP_HEIGHT);
  // CONTRACT: writer of game.player.stamina
  game.player.stamina = Math.max(0, game.player.stamina - HORSE.JUMP_STAMINA);
  if (actions.jump) crossfade(actions.jump, 0.08);
}

/** Gait label from current speed. */
function gaitOf(spd) {
  if (spd < 0.05) return 'stop';
  if (spd < HORSE.GAIT_WALK_MAX) return 'walk';
  if (spd < HORSE.GAIT_TROT_MAX) return 'trot';
  return 'gallop';
}

/** Turn rate (rad/s) for the current gait. */
function turnRateOf(gait) {
  if (gait === 'gallop') return HORSE.TURN_GALLOP;
  if (gait === 'trot') return HORSE.TURN_TROT;
  if (gait === 'walk') return HORSE.TURN_WALK;
  return HORSE.TURN_STOP;
}

/** Debug/test helper: place the horse anywhere, facing `heading`, full stop. */
export function teleportHorse(x, z, heading = 0) {
  const p = game.player.position;
  p.x = x; p.z = z;
  p.y = game.world.bridgeAt(x, z) ?? game.world.heightAt(x, z);
  game.player.heading = heading;
  speed = 0;
  root.position.set(p.x, p.y, p.z);
}

/** Horse root group (rider parents to it; camera reads it). */
export function getHorse() {
  return root;
}

/**
 * Per-frame locomotion update. Reads input, applies terrain rules, writes
 * game.player.position/heading/gait/speed/stamina.
 * @param {number} dt seconds since last frame
 */
export function updateHorse(dt) {
  const p = game.player;
  const world = game.world;

  // ─── Target speed from input ─────────────────────────────────────────────
  const fwdHeld = isDown('forward');
  const wantsGallop = fwdHeld && isDown('gallop') && !exhausted;
  let target = 0;
  if (fwdHeld) target = wantsGallop ? HORSE.GALLOP_SPD : HORSE.TROT_SPD;
  const rate = isDown('back') ? HORSE.BRAKE : (target > speed ? HORSE.ACCEL : HORSE.DECEL);
  speed += Math.sign(target - speed) * Math.min(Math.abs(target - speed), rate * dt);

  // ─── Stamina ─────────────────────────────────────────────────────────────
  const galloping = speed > HORSE.GAIT_TROT_MAX && wantsGallop;
  // CONTRACT: writer of game.player.stamina
  if (galloping) p.stamina = Math.max(0, p.stamina - HORSE.STAMINA_DRAIN * dt);
  else p.stamina = Math.min(PLAYER.STAMINA, p.stamina + HORSE.STAMINA_REGEN * dt);
  if (p.stamina <= 0) exhausted = true;
  if (exhausted && p.stamina >= HORSE.GALLOP_RESUME) exhausted = false;

  // ─── Steering ────────────────────────────────────────────────────────────
  const gait = gaitOf(Math.abs(speed));
  const steer = (isDown('left') ? 1 : 0) - (isDown('right') ? 1 : 0);
  // CONTRACT: writer of game.player.heading
  p.heading += steer * turnRateOf(gait) * dt;

  // ─── Terrain modifiers along the heading ─────────────────────────────────
  const fx = Math.sin(p.heading), fz = Math.cos(p.heading);
  const pos = p.position;
  const grade = (world.heightAt(pos.x + fx * 2, pos.z + fz * 2) -
                 world.heightAt(pos.x - fx * 2, pos.z - fz * 2)) / 4;
  let spdMul = 1;
  if (grade > 0) spdMul = Math.max(HORSE.MIN_SLOPE_SPD, 1 - grade * HORSE.SLOPE_FACTOR);
  else spdMul = 1 + Math.min(HORSE.DOWNHILL_BONUS, -grade * HORSE.SLOPE_FACTOR);

  // ─── Move (deep water blocks, bridges override, shallow slows) ───────────
  const prevX = pos.x, prevZ = pos.z; // for swept (substep) collision
  let nx = pos.x + fx * speed * spdMul * dt;
  let nz = pos.z + fz * speed * spdMul * dt;
  nx = Math.max(-1020, Math.min(1020, nx));
  nz = Math.max(-1020, Math.min(1020, nz));
  const deck = world.bridgeAt(nx, nz);
  const water = world.waterInfoAt(nx, nz);
  if (deck === null && water && water.depth > RIVER.FORD_MAX && !airborne) {
    // Deep water: refuse the step and bleed off momentum
    speed *= 0.4;
  } else {
    // CONTRACT: writer of game.player.position
    pos.x = nx;
    pos.z = nz;
    if (deck === null && water && water.depth > 0.2) speed *= (1 - (1 - HORSE.WATER_SPD) * 4 * dt);
    if (!airborne) pos.y = deck !== null ? deck : world.heightAt(nx, nz);
  }

  // ─── Solid-world collision (rocks, trunks, buildings): push-out + slide ──
  // Swept in ≤0.4 m substeps: at dt clamp 0.34 s a gallop frame covers ~4.8 m,
  // so a single endpoint check would tunnel through rocks.
  {
    const segLen = Math.hypot(pos.x - prevX, pos.z - prevZ);
    const steps = Math.min(12, Math.max(1, Math.ceil(segLen / 0.4)));
    let cx = prevX, cz = prevZ;
    for (let i = 1; i <= steps; i++) {
      _colPos.x = prevX + (pos.x - prevX) * (i / steps);
      _colPos.z = prevZ + (pos.z - prevZ) * (i / steps);
      _colPos.y = pos.y;
      resolveCollision(_colPos, COLLISION.HORSE_RADIUS, airborne);
      cx = _colPos.x; cz = _colPos.z;
    }
    pos.x = cx; pos.z = cz;
  }

  // ─── Jump ballistics (keeps horizontal velocity, no gait change) ─────────
  if (airborne) {
    vy -= HORSE.GRAVITY * dt;
    pos.y += vy * dt; // CONTRACT: writer of game.player.position
    const ground = world.bridgeAt(pos.x, pos.z) ?? world.heightAt(pos.x, pos.z);
    if (pos.y <= ground && vy < 0) {
      pos.y = ground;
      airborne = false;
      game.player.airborne = false; // CONTRACT: writer of game.player.airborne
      _dustPos.copy(pos);
      spawnImpact(_dustPos); // landing dust
    }
  }

  // ─── Hoof dust at gallop on dry ground ───────────────────────────────────
  if (gait === 'gallop' && !airborne && deck === null && !water) {
    hoofDustT -= dt;
    if (hoofDustT <= 0) {
      hoofDustT = HORSE.HOOF_DUST_EVERY;
      _dustPos.set(pos.x - fx * 1.2, pos.y + 0.15, pos.z - fz * 1.2);
      spawnImpact(_dustPos);
    }
  }

  // CONTRACT: writer of game.player.gait / game.player.speed
  p.gait = gaitOf(Math.abs(speed));
  p.speed = speed * spdMul;

  // ─── Visual: position, heading, terrain-normal alignment ─────────────────
  root.position.set(pos.x, pos.y, pos.z);
  root.rotation.y = p.heading;
  const n = world.normalAt(pos.x, pos.z);
  _n.set(n.x, n.y, n.z);
  _qTarget.setFromUnitVectors(_up, _n);
  tilt.quaternion.slerp(_qTarget, Math.min(1, 6 * dt));

  // ─── Animation by gait (jump clip wins while airborne) ───────────────────
  if (mixer) {
    if (airborne && actions.jump) { /* keep jump clip */ }
    else if (p.gait === 'gallop' && actions.gallop) crossfade(actions.gallop);
    else if ((p.gait === 'walk' || p.gait === 'trot') && actions.walk) {
      crossfade(actions.walk);
      actions.walk.timeScale = p.gait === 'trot' ? 1.8 : 1.0;
    } else if (p.gait === 'stop' && actions.idle) crossfade(actions.idle);
    mixer.update(dt);
  } else if (p.gait !== 'stop') {
    // Procedural fallback: simple bob while moving
    bobPhase += dt * (p.gait === 'gallop' ? 14 : 8);
    tilt.position.y = Math.abs(Math.sin(bobPhase)) * 0.06;
    if (airborne) tilt.rotation.x = -vy * 0.04; // procedural hop pitch
    else tilt.rotation.x = 0;
  }
}
