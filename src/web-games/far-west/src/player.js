// player.js — Cowboy rider: sits as ONE figure with the horse. The Adventurer
// rig is FLAT (bones carry no usable rest offsets; baked clips drive positions),
// so each leg joint is placed NUMERICALLY at rider-local targets (RIDE in
// config.js) every frame after the mixer runs, with bone orientation aligned to
// the child joint. The rider hangs from a seat pivot at HORSE.SADDLE (the hip
// point), so the speed/jump lean rotates around the seat — the rider never
// slides on the saddle. Upper body plays Idle / Idle_Gun_Pointing.
// Exports: spawnPlayer, updatePlayer, getRider. Pose numbers live in config.js.

import * as THREE from '../../vendor/three.module.min.js';
import { HORSE, RIDE } from './config.js';
import { game } from './state.js';
import { spawn, getModel, fitHeight } from './assets.js';

let rider = null;   // cowboy model, origin HIP_DROP below the seat
let seat = null;    // pivot group at the hip point (lean rotates this)
let mixer = null;
let currentAction = null;
let rootBone = null;
const actions = {};

// Per-side bind capture: bones + bind world quats + bind world joint dirs
const legs = { L: null, R: null };

const _kneeW = new THREE.Vector3();
const _footW = new THREE.Vector3();
const _hipW = new THREE.Vector3();
const _dir = new THREE.Vector3();
const _align = new THREE.Quaternion();
const _parentQ = new THREE.Quaternion();
const _riderQ = new THREE.Quaternion();
const _footQ = new THREE.Quaternion();

function clipAction(entry, fragment) {
  if (!mixer || !entry) return null;
  const f = fragment.toLowerCase();
  const norm = (c) => c.name.split('|').pop().toLowerCase();
  const clip = entry.animations.find((c) => norm(c) === f) ||
               entry.animations.find((c) => norm(c).includes(f));
  return clip ? mixer.clipAction(clip) : null;
}

function crossfade(next, fade = 0.2) {
  if (!next || next === currentAction) return;
  next.reset().fadeIn(fade).play();
  if (currentAction) currentAction.fadeOut(fade);
  currentAction = next;
}

/** Captures leg bones + bind world-space orientation/direction references. */
function captureLegs() {
  const bones = {};
  rider.traverse((n) => { if (n.isBone) bones[n.name] = n; });
  rootBone = bones.Root || null;
  rider.updateMatrixWorld(true);
  const riderQw = rider.getWorldQuaternion(new THREE.Quaternion());
  const pU = new THREE.Vector3(), pL = new THREE.Vector3(), pF = new THREE.Vector3();
  for (const side of ['L', 'R']) {
    const bU = bones[`UpperLeg${side}`];
    const bL = bones[`LowerLeg${side}`];
    const bF = bones[`Foot${side}`];
    if (!bU || !bL || !bF) continue;
    bU.getWorldPosition(pU);
    bL.getWorldPosition(pL);
    bF.getWorldPosition(pF);
    const qFw = bF.getWorldQuaternion(new THREE.Quaternion());
    legs[side] = {
      bU, bL, bF,
      qUw: bU.getWorldQuaternion(new THREE.Quaternion()),
      qLw: bL.getWorldQuaternion(new THREE.Quaternion()),
      // Foot kept flat relative to the rider body (stirrup tread), not the shin
      qFrel: riderQw.clone().invert().multiply(qFw),
      dUw: pL.clone().sub(pU).normalize(), // bind thigh dir (world)
      dLw: pF.clone().sub(pL).normalize(), // bind shin dir (world)
    };
  }
}

/** Sets a bone's world orientation via its (possibly animated) parent. */
function setWorldQuat(bone, worldQuat) {
  bone.parent.getWorldQuaternion(_parentQ).invert();
  bone.quaternion.copy(_parentQ).multiply(worldQuat);
}

/**
 * Re-poses the legs every frame AFTER the mixer: numeric joint targets
 * (thigh from the animated hip joint to the knee target, shin to the stirrup).
 * Handles the rig's mixed hierarchy (LowerLeg under UpperLeg, Foot under Root).
 */
function applyRidePose() {
  rider.updateMatrixWorld(true);
  rider.getWorldQuaternion(_riderQ);
  for (const side of ['L', 'R']) {
    const leg = legs[side];
    if (!leg) continue;
    const s = side === 'L' ? 1 : -1;
    _kneeW.set(s * RIDE.KNEE.x, RIDE.KNEE.y, RIDE.KNEE.z);
    rider.localToWorld(_kneeW);
    _footW.set(s * RIDE.FOOT.x, RIDE.FOOT.y, RIDE.FOOT.z);
    rider.localToWorld(_footW);
    // Thigh: keep the animated hip joint, aim it at the knee target
    leg.bU.getWorldPosition(_hipW);
    _dir.copy(_kneeW).sub(_hipW).normalize();
    _align.setFromUnitVectors(leg.dUw, _dir);
    setWorldQuat(leg.bU, _align.multiply(leg.qUw));
    leg.bU.updateMatrixWorld(true); // refresh before placing the shin on it
    // Shin: joint exactly at the knee target, aimed at the stirrup
    leg.bL.position.copy(leg.bU.worldToLocal(_kneeW));
    _dir.copy(_footW).sub(_kneeW).normalize();
    _align.setFromUnitVectors(leg.dLw, _dir);
    setWorldQuat(leg.bL, _align.multiply(leg.qLw));
    // Foot at the stirrup, flat relative to the rider (not the shin)
    leg.bF.position.copy(leg.bF.parent.worldToLocal(_footW));
    setWorldQuat(leg.bF, _footQ.copy(_riderQ).multiply(leg.qFrel));
  }
}

/**
 * Attaches the cowboy to the horse's tilt group (so rider follows body pitch)
 * through a seat pivot at the hip point: the lean rotates around the seat.
 * @param {THREE.Group} horseTilt the tilt group inside the horse root
 */
export function spawnPlayer(horseTilt) {
  const entry = getModel('cowboy');
  rider = fitHeight(spawn('cowboy'), HORSE.RIDER_HEIGHT);
  seat = new THREE.Group();
  seat.name = 'riderSeat';
  seat.position.set(HORSE.SADDLE.x, HORSE.SADDLE.y, HORSE.SADDLE.z);
  rider.position.set(0, -RIDE.HIP_DROP, 0);
  horseTilt.add(seat);
  seat.add(rider);
  captureLegs();

  if (entry && entry.animations.length) {
    mixer = new THREE.AnimationMixer(rider);
    actions.idle = clipAction(entry, 'Idle');
    actions.idleGun = clipAction(entry, 'Idle_Gun_Pointing') || clipAction(entry, 'Idle_Gun');
    crossfade(actions.idle, 0);
  }
  return rider;
}

/** Per-frame rider update: aim pose, clip, riding pose, speed lean. @param {number} dt */
export function updatePlayer(dt) {
  if (!mixer) return;
  crossfade(game.ui.aiming && actions.idleGun ? actions.idleGun : actions.idle);
  mixer.update(dt);
  applyRidePose(); // must run AFTER the mixer so the pose wins
  // Forward lean proportional to speed (+ extra over a jump); pivots at the
  // seat so the rider never slides on the saddle (lean is rotational only)
  const p = game.player;
  const speedRatio = Math.min(1, p.speed / 14);
  const target = RIDE.LEAN_MAX * speedRatio + (p.airborne ? RIDE.LEAN_JUMP : 0);
  seat.rotation.x += (target - seat.rotation.x) * Math.min(1, 8 * dt);
}

/** Rider object (debug/tests). */
export function getRider() {
  return rider;
}
