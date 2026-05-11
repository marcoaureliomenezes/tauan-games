// player.js — F-35 Lightning II: mesh + fisica de voo 6DOF com quaternions.
// Exporta: jet (TransformNode), updatePlayer, playerHit, barrelRoll, respawnJet, firePosition.

/* global BABYLON */

import { scene } from './scene.js';
import { audio } from './audio.js';
import { game } from './state.js';
import { PLAYER, ROLL } from './config.js';
import { checkTerrainCollision } from './world.js';

// ─── Mesh do F-35 ─────────────────────────────────────────────────────────────
function buildJet() {
  const root = new BABYLON.TransformNode('jet', scene);

  const greyMat = new BABYLON.StandardMaterial('jetGrey', scene);
  greyMat.diffuseColor = new BABYLON.Color3(0x2d / 255, 0x30 / 255, 0x37 / 255);
  greyMat.specularColor = new BABYLON.Color3(0.4, 0.4, 0.4);

  const darkMat = new BABYLON.StandardMaterial('jetDark', scene);
  darkMat.diffuseColor = new BABYLON.Color3(0x1c / 255, 0x1e / 255, 0x23 / 255);
  darkMat.specularColor = new BABYLON.Color3(0.3, 0.3, 0.3);

  const exhaustMat = new BABYLON.StandardMaterial('exhaust', scene);
  exhaustMat.diffuseColor = new BABYLON.Color3(1.0, 0x70 / 255, 0x20 / 255);
  exhaustMat.emissiveColor = new BABYLON.Color3(1.0, 0.4, 0.1);

  const flameMat = new BABYLON.StandardMaterial('flame', scene);
  flameMat.diffuseColor = new BABYLON.Color3(1.0, 0.87, 0.4);
  flameMat.emissiveColor = new BABYLON.Color3(1.0, 0.87, 0.4);
  flameMat.alpha = 0.95;

  const canopyMat = new BABYLON.StandardMaterial('canopy', scene);
  canopyMat.diffuseColor = new BABYLON.Color3(0.04, 0.04, 0.09);
  canopyMat.alpha = 0.85;

  // Fuselagem principal (nariz)
  const fwd = BABYLON.MeshBuilder.CreateBox('jetFwd', { width: 0.7 * 1.4, height: 0.45 * 1.4, depth: 1.2 * 1.4 }, scene);
  fwd.position.set(0, 0, -0.55 * 1.4);
  fwd.material = new BABYLON.StandardMaterial('jP', scene);
  fwd.material.diffuseColor = new BABYLON.Color3(0x3a / 255, 0x3d / 255, 0x44 / 255);
  fwd.parent = root;

  // Canopy
  const canopy = BABYLON.MeshBuilder.CreateBox('canopy', { width: 0.4 * 1.4, height: 0.22 * 1.4, depth: 0.68 * 1.4 }, scene);
  canopy.position.set(0, 0.30 * 1.4, -0.65 * 1.4);
  canopy.material = canopyMat;
  canopy.parent = root;

  // Centro
  const mid = BABYLON.MeshBuilder.CreateBox('jetMid', { width: 0.95 * 1.4, height: 0.52 * 1.4, depth: 1.4 * 1.4 }, scene);
  mid.position.set(0, 0, 0.45 * 1.4);
  mid.material = greyMat;
  mid.parent = root;

  // Cauda
  const aft = BABYLON.MeshBuilder.CreateBox('jetAft', { width: 0.62 * 1.4, height: 0.45 * 1.4, depth: 0.85 * 1.4 }, scene);
  aft.position.set(0, 0, 1.5 * 1.4);
  aft.material = darkMat;
  aft.parent = root;

  // Asa esquerda
  const wingL = BABYLON.MeshBuilder.CreateBox('wingL', { width: 4 * 1.4, height: 0.1 * 1.4, depth: 1.8 * 1.4 }, scene);
  wingL.position.set(-2 * 1.4, -0.04 * 1.4, 0.35 * 1.4);
  wingL.material = greyMat;
  wingL.parent = root;

  // Asa direita
  const wingR = BABYLON.MeshBuilder.CreateBox('wingR', { width: 4 * 1.4, height: 0.1 * 1.4, depth: 1.8 * 1.4 }, scene);
  wingR.position.set(2 * 1.4, -0.04 * 1.4, 0.35 * 1.4);
  wingR.material = greyMat;
  wingR.parent = root;

  // V-tails
  const tailL = BABYLON.MeshBuilder.CreateBox('tailL', { width: 0.06 * 1.4, height: 0.7 * 1.4, depth: 0.65 * 1.4 }, scene);
  tailL.position.set(-0.30 * 1.4, 0.32 * 1.4, 1.45 * 1.4);
  tailL.rotation.z = 0.35;
  tailL.material = greyMat;
  tailL.parent = root;

  const tailR = BABYLON.MeshBuilder.CreateBox('tailR', { width: 0.06 * 1.4, height: 0.7 * 1.4, depth: 0.65 * 1.4 }, scene);
  tailR.position.set(0.30 * 1.4, 0.32 * 1.4, 1.45 * 1.4);
  tailR.rotation.z = -0.35;
  tailR.material = greyMat;
  tailR.parent = root;

  // Exhaust nozzle
  const exhRing = BABYLON.MeshBuilder.CreateCylinder('exhRing', {
    diameterTop: 0.60 * 1.4, diameterBottom: 0.56 * 1.4, height: 0.45 * 1.4, tessellation: 16,
  }, scene);
  exhRing.position.set(0, 0, 2.05 * 1.4);
  exhRing.rotation.x = Math.PI / 2;
  exhRing.material = darkMat;
  exhRing.parent = root;

  const exhGlow = BABYLON.MeshBuilder.CreateCylinder('exhGlow', {
    diameterTop: 0.50 * 1.4, diameterBottom: 0.44 * 1.4, height: 0.35 * 1.4, tessellation: 12,
  }, scene);
  exhGlow.position.set(0, 0, 2.1 * 1.4);
  exhGlow.rotation.x = Math.PI / 2;
  exhGlow.material = exhaustMat;
  exhGlow.parent = root;

  const exhFlame = BABYLON.MeshBuilder.CreateCylinder('exhFlame', {
    diameterTop: 0.36 * 1.4, diameterBottom: 0.24 * 1.4, height: 0.25 * 1.4, tessellation: 8,
  }, scene);
  exhFlame.position.set(0, 0, 2.15 * 1.4);
  exhFlame.rotation.x = Math.PI / 2;
  exhFlame.material = flameMat;
  exhFlame.parent = root;

  root.userData = { exhGlow, exhFlame };

  return root;
}

export const jet = buildJet();
jet.position.set(0, PLAYER.START_HEIGHT, 0);
// Quaternion inicial — identidade
jet.rotationQuaternion = new BABYLON.Quaternion(0, 0, 0, 1);

// ─── Fisica ───────────────────────────────────────────────────────────────────
game.flags.rollTimer = 0;
game.flags.rollCooldown = 0;
game.flags.rollDir = 1;

const _pitchAxis = new BABYLON.Vector3(1, 0, 0);
const _rollAxis  = new BABYLON.Vector3(0, 0, 1);
const _worldUp   = new BABYLON.Vector3(0, 1, 0);
const _pitchQ    = new BABYLON.Quaternion();
const _rollQ     = new BABYLON.Quaternion();
const _yawQ      = new BABYLON.Quaternion();
const _fwd       = new BABYLON.Vector3();
const _up        = new BABYLON.Vector3();
const _lPitch    = new BABYLON.Vector3(1, 0, 0);
const _lRoll     = new BABYLON.Vector3(0, 0, 1);

export function barrelRoll() {
  if (game.flags.rollTimer > 0 || game.flags.rollCooldown > 0) return;
  game.flags.rollTimer = ROLL.DUR;
  game.flags.rollCooldown = ROLL.COOLDOWN;
  game.flags.rollDir *= -1;
}

/** Retorna eixo local do jet em world space. */
function localAxis(x, y, z) {
  return new BABYLON.Vector3(x, y, z).applyRotationQuaternion(jet.rotationQuaternion);
}

export function updatePlayer(dt, input, onCrash) {
  if (!game.running || game.flags.paused) return;

  // Throttle
  if (input.throttleUp)   game.player.throttle = Math.min(1.0, game.player.throttle + dt * PLAYER.THROTTLE_UP_RATE);
  if (input.throttleDown) game.player.throttle = Math.max(0.05, game.player.throttle - dt * PLAYER.THROTTLE_DN_RATE);

  // Speed converge
  const tgtSpd = PLAYER.MIN_SPD + game.player.throttle * (PLAYER.MAX_SPD - PLAYER.MIN_SPD);
  game.player.speed += (tgtSpd - game.player.speed) * Math.min(1, dt * PLAYER.CONVERGE_RATE);
  game.player.speed = Math.max(2, game.player.speed);
  game.player.stalled = game.player.speed < PLAYER.STALL_SPD;

  // Rotacoes locais via quaternion (identico ao Three.js)
  const lPitch = localAxis(1, 0, 0);
  const lRoll  = localAxis(0, 0, 1);

  if (input.pitchUp) {
    BABYLON.Quaternion.RotationAxisToRef(lPitch, -PLAYER.PITCH_RATE * dt, _pitchQ);
    jet.rotationQuaternion.multiplyInPlace(_pitchQ);
  }
  if (input.pitchDown) {
    BABYLON.Quaternion.RotationAxisToRef(lPitch, PLAYER.PITCH_RATE * dt, _pitchQ);
    jet.rotationQuaternion.multiplyInPlace(_pitchQ);
  }
  if (input.rollLeft) {
    BABYLON.Quaternion.RotationAxisToRef(lRoll, PLAYER.ROLL_RATE * dt, _rollQ);
    jet.rotationQuaternion.multiplyInPlace(_rollQ);
    BABYLON.Quaternion.RotationAxisToRef(_worldUp, PLAYER.YAW_RATE * dt, _yawQ);
    _yawQ.multiplyToRef(jet.rotationQuaternion, jet.rotationQuaternion);
  }
  if (input.rollRight) {
    BABYLON.Quaternion.RotationAxisToRef(lRoll, -PLAYER.ROLL_RATE * dt, _rollQ);
    jet.rotationQuaternion.multiplyInPlace(_rollQ);
    BABYLON.Quaternion.RotationAxisToRef(_worldUp, -PLAYER.YAW_RATE * dt, _yawQ);
    _yawQ.multiplyToRef(jet.rotationQuaternion, jet.rotationQuaternion);
  }
  if (input.yawLeft) {
    BABYLON.Quaternion.RotationAxisToRef(_worldUp, PLAYER.YAW_RATE * PLAYER.RUDDER_FACTOR * dt, _yawQ);
    _yawQ.multiplyToRef(jet.rotationQuaternion, jet.rotationQuaternion);
  }
  if (input.yawRight) {
    BABYLON.Quaternion.RotationAxisToRef(_worldUp, -PLAYER.YAW_RATE * PLAYER.RUDDER_FACTOR * dt, _yawQ);
    _yawQ.multiplyToRef(jet.rotationQuaternion, jet.rotationQuaternion);
  }
  // Barrel roll
  if (game.flags.rollTimer > 0) {
    BABYLON.Quaternion.RotationAxisToRef(lRoll, (Math.PI * 2 / ROLL.DUR) * dt * game.flags.rollDir, _rollQ);
    jet.rotationQuaternion.multiplyInPlace(_rollQ);
  }

  // Normaliza quaternion para evitar drift
  jet.rotationQuaternion.normalize();

  // Movimento — forward local e-z
  const fwd = new BABYLON.Vector3(0, 0, -1).applyRotationQuaternion(jet.rotationQuaternion);
  jet.position.addInPlace(fwd.scale(game.player.speed * dt));
  jet.position.y -= PLAYER.GRAVITY * dt;

  // Sustentacao
  if (!game.player.stalled) {
    const liftFactor = Math.min(game.player.speed / (PLAYER.MIN_SPD * 2.5), 1.0);
    const up = new BABYLON.Vector3(0, 1, 0).applyRotationQuaternion(jet.rotationQuaternion);
    jet.position.addInPlace(up.scale(PLAYER.GRAVITY * liftFactor * dt));
  }

  // Crash check
  const crash = checkTerrainCollision(jet.position);
  if (crash) { onCrash(crash); return; }

  audio.setEngineRPM(game.player.speed, game.player.throttle);

  // Afterburner visual
  if (jet.userData) {
    const burn = 0.55 + game.player.throttle * 1.05;
    if (jet.userData.exhGlow) jet.userData.exhGlow.scaling.setAll(burn);
    if (jet.userData.exhFlame) {
      const flameZ = burn * (0.9 + Math.random() * 0.2);
      jet.userData.exhFlame.scaling.set(burn, burn, flameZ);
    }
  }

  // Atualizar posicao no game state
  game.player.x = jet.position.x;
  game.player.y = jet.position.y;
  game.player.pz = jet.position.z;
}

export function playerHit() {
  if (game.flags.invincibility > 0 || game.flags.rollTimer > 0) return;
  game.player.lives -= 1;
  game.flags.invincibility = 1.8;
  game.flags.shakeTime = 0.35;
}

export function respawnJet() {
  jet.position.set(0, PLAYER.START_HEIGHT, 0);
  jet.rotationQuaternion.copyFromFloats(0, 0, 0, 1);
  jet.setEnabled(true);
  game.player.speed = 25;
  game.player.throttle = 0.5;
  game.player.stalled = false;
}

/** Retorna o vetor forward do jato e popula 'out' com a posicao do bico. */
export function firePosition(out, offset) {
  offset = offset !== undefined ? offset : 2.0;
  const fwd = new BABYLON.Vector3(0, 0, -1).applyRotationQuaternion(jet.rotationQuaternion);
  out.copyFrom(jet.position).addInPlace(fwd.scale(offset));
  return fwd;
}
