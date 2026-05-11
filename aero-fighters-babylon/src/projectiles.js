// projectiles.js — Balas (player e inimigo), misseis homing, pickups.
// Exporta: spawnBullet, recycleBullet, updateBullets, spawnMissile, updateMissiles,
//   spawnPickup, updatePickups, spawnNuclearMissile, updateNuclears, clearMissiles,
//   clearPickups, clearNuclears.

/* global BABYLON */

import { scene } from './scene.js';
import { audio } from './audio.js';
import { game } from './state.js';
import { CANNON, MISSILES_LIGHT, MISSILES_HEAVY, MISSILES_NUCLEAR, MISSILES } from './config.js';
import { explosion, spawnMissileSmoke, scheduleDelayed } from './fx.js';
import { damageTarget } from './targets.js';

// ─── Balas ────────────────────────────────────────────────────────────────────
const BULLET_MAT = new BABYLON.StandardMaterial('bulletMat', scene);
BULLET_MAT.diffuseColor = new BABYLON.Color3(1.0, 0.94, 0.50);
BULLET_MAT.emissiveColor = new BABYLON.Color3(1.0, 0.94, 0.50);
BULLET_MAT.disableLighting = true;

const ENEMY_MAT = new BABYLON.StandardMaterial('enemyBulletMat', scene);
ENEMY_MAT.diffuseColor = new BABYLON.Color3(1.0, 0.31, 0.31);
ENEMY_MAT.emissiveColor = new BABYLON.Color3(1.0, 0.31, 0.31);
ENEMY_MAT.disableLighting = true;

const bulletPoolPlayer = [], bulletPoolEnemy = [];

function getBulletMesh(isEnemy) {
  const pool = isEnemy ? bulletPoolEnemy : bulletPoolPlayer;
  let m = pool.pop();
  if (!m) {
    m = BABYLON.MeshBuilder.CreateCylinder('bullet', { diameter: 0.12, height: 2.0, tessellation: 6 }, scene);
    m.material = isEnemy ? ENEMY_MAT : BULLET_MAT;
  }
  return m;
}

export function spawnBullet(orig, dir, isEnemy) {
  isEnemy = isEnemy !== undefined ? isEnemy : false;
  const m = getBulletMesh(isEnemy);
  m.position.copyFrom(orig);
  // Orientar ao longo da direcao de voo (cilindro com eixo Y local -> alinhar com dir)
  if (dir.length() > 0.01) {
    const fwd = dir.normalizeToNew();
    // lookAt para Babylon: usamos TransformNode ou Quaternion manual
    const up = Math.abs(fwd.y) > 0.99 ? new BABYLON.Vector3(1, 0, 0) : new BABYLON.Vector3(0, 1, 0);
    const right = BABYLON.Vector3.Cross(up, fwd).normalize();
    const realUp = BABYLON.Vector3.Cross(fwd, right);
    const mat = BABYLON.Matrix.FromValues(
      right.x, right.y, right.z, 0,
      realUp.x, realUp.y, realUp.z, 0,
      fwd.x, fwd.y, fwd.z, 0,
      0, 0, 0, 1,
    );
    if (!m.rotationQuaternion) m.rotationQuaternion = new BABYLON.Quaternion();
    BABYLON.Quaternion.FromRotationMatrixToRef(mat, m.rotationQuaternion);
  }
  m.setEnabled(true);
  const spd = isEnemy ? 36 : CANNON.BULLET_SPD;
  game.projectiles.push({
    mesh: m,
    vx: dir.x * spd, vy: dir.y * spd, vz: dir.z * spd,
    life: CANNON.BULLET_LIFE,
    isEnemy,
  });
}

export function recycleBullet(p) {
  p.mesh.setEnabled(false);
  (p.isEnemy ? bulletPoolEnemy : bulletPoolPlayer).push(p.mesh);
}

export function updateBullets(dt, jetPos, onPlayerHit) {
  const jx = jetPos.x, jy = jetPos.y, jz = jetPos.z;
  for (let i = game.projectiles.length - 1; i >= 0; i--) {
    const p = game.projectiles[i];
    p.mesh.position.x += p.vx * dt;
    p.mesh.position.y += p.vy * dt;
    p.mesh.position.z += p.vz * dt;
    p.life -= dt;
    let consumed = false;
    if (!p.isEnemy) {
      for (const e of game.targets) {
        if (e.dead) continue;
        const dx = p.mesh.position.x - e.mesh.position.x;
        const dy = p.mesh.position.y - e.mesh.position.y;
        const dz = p.mesh.position.z - e.mesh.position.z;
        if (dx * dx + dy * dy + dz * dz < e.hr2) {
          damageTarget(e, 1); consumed = true; break;
        }
      }
    } else if (game.flags.invincibility <= 0 && game.flags.rollTimer <= 0) {
      const dx = p.mesh.position.x - jx;
      const dy = p.mesh.position.y - jy;
      const dz = p.mesh.position.z - jz;
      if (dx * dx + dy * dy + dz * dz < 4) { onPlayerHit(); consumed = true; }
    }
    if (consumed || p.life <= 0) { recycleBullet(p); game.projectiles.splice(i, 1); }
  }
}

// ─── Misseis ──────────────────────────────────────────────────────────────────
const missiles = [];
const _msDir = new BABYLON.Vector3();

function buildMissileMesh(kind) {
  const root = new BABYLON.TransformNode('missile_' + kind, scene);
  const isHeavy = kind === 'heavy';

  const bodyMat = new BABYLON.StandardMaterial('mBody', scene);
  bodyMat.diffuseColor = isHeavy ? new BABYLON.Color3(0.29, 0.29, 0.32) : new BABYLON.Color3(0.60, 0.63, 0.67);

  const flameMat = new BABYLON.StandardMaterial('mFlame', scene);
  flameMat.disableLighting = true;
  flameMat.diffuseColor = isHeavy ? new BABYLON.Color3(1.0, 0.67, 0.13) : new BABYLON.Color3(1.0, 0.93, 0.73);
  flameMat.emissiveColor = flameMat.diffuseColor;
  flameMat.alpha = 0.95;

  const body = BABYLON.MeshBuilder.CreateCylinder('mb', { diameter: 0.20, height: 1.2, tessellation: 8 }, scene);
  body.rotation.x = Math.PI / 2; body.material = bodyMat; body.parent = root;

  const nose = BABYLON.MeshBuilder.CreateCylinder('mn', { diameterTop: 0, diameterBottom: 0.20, height: 0.35, tessellation: 8 }, scene);
  nose.rotation.x = Math.PI / 2; nose.position.z = -0.78; nose.material = bodyMat; nose.parent = root;

  const flame = BABYLON.MeshBuilder.CreateCylinder('mf', { diameterTop: 0.18, diameterBottom: 0, height: 0.5, tessellation: 8 }, scene);
  flame.rotation.x = Math.PI / 2; flame.position.z = 0.95; flame.material = flameMat; flame.parent = root;

  if (isHeavy) root.scaling.setAll(1.5);
  return root;
}

export function spawnMissile(orig, target, jetQuat, kind) {
  kind = kind !== undefined ? kind : 'light';
  const cfg = kind === 'heavy' ? MISSILES_HEAVY : MISSILES_LIGHT;
  const mesh = buildMissileMesh(kind);
  mesh.position.copyFrom(orig);
  // Orientar ao quaternion do jato
  if (!mesh.rotationQuaternion) mesh.rotationQuaternion = jetQuat.clone();
  else mesh.rotationQuaternion.copyFrom(jetQuat);

  const fwd = new BABYLON.Vector3(0, 0, -1).applyRotationQuaternion(jetQuat);
  const vel = fwd.scale(cfg.INITIAL_SPD);
  missiles.push({ mesh, target, velocity: vel, life: cfg.LIFE, smokeTimer: 0, cfg, kind });
  audio.missile();
}

export function updateMissiles(dt) {
  for (let i = missiles.length - 1; i >= 0; i--) {
    const m = missiles[i]; m.life -= dt;
    if (!m.target || m.target.dead) {
      let near = null, nd = Infinity;
      for (const e of game.targets) {
        if (e.dead) continue;
        const d = BABYLON.Vector3.DistanceSquared(m.mesh.position, e.mesh.position);
        if (d < nd) { nd = d; near = e; }
      }
      m.target = near;
    }
    if (m.target) {
      const dist = BABYLON.Vector3.Distance(m.mesh.position, m.target.mesh.position);
      const turn = dist < 40 ? m.cfg.CLOSE_TURN_RATE : m.cfg.TURN_RATE;
      const desired = m.target.mesh.position.subtract(m.mesh.position).normalize().scale(m.cfg.TRACKING_SPD);
      m.velocity = BABYLON.Vector3.Lerp(m.velocity, desired, turn);
    }
    m.mesh.position.addInPlace(m.velocity.scale(dt));

    // Orientar mesh ao longo da velocidade
    if (m.velocity.lengthSquared() > 0.01) {
      const dir = m.velocity.normalizeToNew();
      const up = Math.abs(dir.y) > 0.99 ? new BABYLON.Vector3(1, 0, 0) : new BABYLON.Vector3(0, 1, 0);
      const right = BABYLON.Vector3.Cross(up, dir).normalize();
      const realUp = BABYLON.Vector3.Cross(dir, right);
      const mat = BABYLON.Matrix.FromValues(
        right.x, right.y, right.z, 0,
        realUp.x, realUp.y, realUp.z, 0,
        dir.x, dir.y, dir.z, 0,
        0, 0, 0, 1,
      );
      if (!m.mesh.rotationQuaternion) m.mesh.rotationQuaternion = new BABYLON.Quaternion();
      BABYLON.Quaternion.FromRotationMatrixToRef(mat, m.mesh.rotationQuaternion);
    }

    m.smokeTimer -= dt;
    if (m.smokeTimer <= 0) {
      m.smokeTimer = m.kind === 'heavy' ? 0.04 : 0.06;
      spawnMissileSmoke(m.mesh.position);
    }

    let hit = false;
    if (m.target && !m.target.dead) {
      const hr2 = m.target.hr2 * 2.5;
      if (BABYLON.Vector3.DistanceSquared(m.mesh.position, m.target.mesh.position) < hr2) {
        damageTarget(m.target, m.cfg.DAMAGE);
        hit = true;
      }
    }
    if (hit || m.life <= 0) {
      const scale = m.kind === 'heavy' ? 1.5 : 0.9;
      explosion(m.mesh.position, scale);
      audio.explosion(m.kind === 'heavy' ? 1.2 : 0.5, m.mesh.position);
      m.mesh.getChildMeshes().forEach(cm => cm.dispose());
      m.mesh.dispose();
      missiles.splice(i, 1);
    }
  }
}

export function clearMissiles() {
  for (const m of missiles) {
    m.mesh.getChildMeshes().forEach(cm => cm.dispose());
    m.mesh.dispose();
  }
  missiles.length = 0;
}

// ─── Pickups ─────────────────────────────────────────────────────────────────
const pickups = [];

export function spawnPickup(pos) {
  const m = BABYLON.MeshBuilder.CreateSphere('pickup', { diameter: 1.4, segments: 8 }, scene);
  const mat = new BABYLON.StandardMaterial('pickupMat', scene);
  mat.diffuseColor = new BABYLON.Color3(0.25, 1.0, 0.25);
  mat.emissiveColor = new BABYLON.Color3(0.13, 0.5, 0.13);
  mat.disableLighting = false;
  m.material = mat;
  m.position.copyFrom(pos);
  m.position.y += 4;
  pickups.push({ mesh: m, life: 18.0 });
}

export function updatePickups(dt, jetPos) {
  for (let i = pickups.length - 1; i >= 0; i--) {
    const p = pickups[i]; p.life -= dt;
    p.mesh.position.y += Math.sin(performance.now() * 0.005) * dt * 0.5;
    if (BABYLON.Vector3.Distance(p.mesh.position, jetPos) < 3) {
      game.player.missiles = Math.min(game.player.missiles + 10, MISSILES.MAX);
      p.mesh.dispose(); pickups.splice(i, 1); continue;
    }
    if (p.life <= 0) { p.mesh.dispose(); pickups.splice(i, 1); }
  }
}

export function clearPickups() {
  for (const p of pickups) p.mesh.dispose();
  pickups.length = 0;
}

// ─── Misseis nucleares ────────────────────────────────────────────────────────
const nukes = [];

function buildNuclearMesh() {
  const root = new BABYLON.TransformNode('nuke', scene);
  const darkMat = new BABYLON.StandardMaterial('nukeMat', scene);
  darkMat.diffuseColor = new BABYLON.Color3(0.1, 0.1, 0.13);

  const body = BABYLON.MeshBuilder.CreateCylinder('nb', { diameter: 0.40, height: 2.0, tessellation: 8 }, scene);
  body.rotation.x = Math.PI / 2; body.material = darkMat; body.parent = root;

  const stripe = BABYLON.MeshBuilder.CreateCylinder('ns', { diameter: 0.38, height: 0.15, tessellation: 8 }, scene);
  stripe.rotation.x = Math.PI / 2; stripe.position.z = 0.3;
  const sm = new BABYLON.StandardMaterial('nsm', scene);
  sm.diffuseColor = new BABYLON.Color3(0, 0.80, 0.13);
  sm.emissiveColor = new BABYLON.Color3(0, 0.4, 0.07);
  sm.disableLighting = false;
  stripe.material = sm; stripe.parent = root;

  return root;
}

export function spawnNuclearMissile(orig, target, jetQuat) {
  if (game.player.nuclearMissiles <= 0) return;
  game.player.nuclearMissiles--;
  const mesh = buildNuclearMesh();
  mesh.position.copyFrom(orig);
  if (!mesh.rotationQuaternion) mesh.rotationQuaternion = jetQuat.clone();
  else mesh.rotationQuaternion.copyFrom(jetQuat);
  const fwd = new BABYLON.Vector3(0, 0, -1).applyRotationQuaternion(jetQuat);
  const vel = fwd.scale(MISSILES_NUCLEAR.INITIAL_SPD);
  nukes.push({ mesh, target, vel, life: MISSILES_NUCLEAR.LIFE, _smokeTimer: 0 });
  audio.missile();
}

function applyNuclearShockwave(epicenter) {
  for (const t of game.targets) {
    if (t.dead) continue;
    const dist = BABYLON.Vector3.Distance(epicenter, t.mesh.position);
    if (dist < MISSILES_NUCLEAR.BLAST_RADIUS) {
      const dmg = MISSILES_NUCLEAR.DAMAGE * Math.max(0, 1 - dist / MISSILES_NUCLEAR.BLAST_RADIUS);
      damageTarget(t, dmg);
    }
  }
  const playerPos = new BABYLON.Vector3(game.player.x, game.player.y, game.player.pz || 0);
  const pd = BABYLON.Vector3.Distance(epicenter, playerPos);
  if (pd < MISSILES_NUCLEAR.PLAYER_KILL_RADIUS) {
    game.player.lives = 0;
  } else if (pd < MISSILES_NUCLEAR.PLAYER_DAMAGE_RADIUS) {
    game.player.lives = Math.max(0, game.player.lives - 1);
    game.flags.cameraShake = { intensity: 5.0, duration: 2.0 };
  }
}

export function updateNuclears(dt) {
  for (let i = nukes.length - 1; i >= 0; i--) {
    const n = nukes[i]; n.life -= dt;
    if (n.target && !n.target.dead) {
      const dist = BABYLON.Vector3.Distance(n.mesh.position, n.target.mesh.position);
      const tr = dist < 40 ? MISSILES_NUCLEAR.CLOSE_TURN_RATE : MISSILES_NUCLEAR.TURN_RATE;
      const desired = n.target.mesh.position.subtract(n.mesh.position).normalize().scale(MISSILES_NUCLEAR.TRACKING_SPD);
      n.vel = BABYLON.Vector3.Lerp(n.vel, desired, tr);
    } else if (!n.target || n.target.dead) {
      let near = null, nd = Infinity;
      for (const e of game.targets) {
        if (e.dead) continue;
        const d = BABYLON.Vector3.DistanceSquared(n.mesh.position, e.mesh.position);
        if (d < nd) { nd = d; near = e; }
      }
      n.target = near;
    }
    n.mesh.position.addInPlace(n.vel.scale(dt));

    // Orienta o mesh
    if (n.vel.lengthSquared() > 0.01) {
      const dir = n.vel.normalizeToNew();
      const up = Math.abs(dir.y) > 0.99 ? new BABYLON.Vector3(1, 0, 0) : new BABYLON.Vector3(0, 1, 0);
      const right = BABYLON.Vector3.Cross(up, dir).normalize();
      const realUp = BABYLON.Vector3.Cross(dir, right);
      const mat = BABYLON.Matrix.FromValues(right.x, right.y, right.z, 0, realUp.x, realUp.y, realUp.z, 0, dir.x, dir.y, dir.z, 0, 0, 0, 0, 1);
      if (!n.mesh.rotationQuaternion) n.mesh.rotationQuaternion = new BABYLON.Quaternion();
      BABYLON.Quaternion.FromRotationMatrixToRef(mat, n.mesh.rotationQuaternion);
    }

    n._smokeTimer -= dt;
    if (n._smokeTimer <= 0) { n._smokeTimer = 0.04; spawnMissileSmoke(n.mesh.position); }

    const hitTarget = n.target && !n.target.dead &&
      BABYLON.Vector3.Distance(n.mesh.position, n.target.mesh.position) < 10;
    const groundHit = n.mesh.position.y <= 1;
    const expired = n.life <= 0;

    if (hitTarget || groundHit || expired) {
      // Explosao nuclear simplificada
      explosion(n.mesh.position.clone(), 20);
      applyNuclearShockwave(n.mesh.position.clone());
      audio.explosion(1.5, n.mesh.position);
      n.mesh.getChildMeshes().forEach(cm => cm.dispose());
      n.mesh.dispose();
      nukes.splice(i, 1);
    }
  }
}

export function clearNuclears() {
  for (const n of nukes) {
    n.mesh.getChildMeshes().forEach(cm => cm.dispose());
    n.mesh.dispose();
  }
  nukes.length = 0;
}
