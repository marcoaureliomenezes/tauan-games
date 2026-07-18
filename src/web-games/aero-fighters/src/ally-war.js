// ally-war.js — Frente de batalha DOS ALIADOS, separada da do player.
// Nossos aviões amigos (wingmen.js) têm os PRÓPRIOS inimigos — caças hostis que
// NÃO atacam os alvos do player e que revidam contra os amigos. O player tem os
// inimigos dele (targets.js); os amigos têm os deles (este módulo). As duas guerras
// não se cruzam: balas/mísseis daqui só ferem aliados↔inimigos-dos-aliados.
//
// Exporta: spawnAllyEnemies, updateAllyWar, clearAllyEnemies, spawnAllyMissile.

import * as THREE from '../../../../vendor/three.module.min.js';
import { game } from './state.js';
import { explosion, spawnShockwave } from './fx.js';
import { audio } from './audio.js';

const _tmpA = new THREE.Vector3();
const _tmpB = new THREE.Vector3();
const _tmpC = new THREE.Vector3();

// Onda de inimigos dos aliados (caças hostis).
const WAVE_SIZE = 4;
const RESPAWN_DELAY = 7.0;
let _respawnTimer = 0;
let _sceneRef = null;

// ─── Mesh do caça inimigo (vermelho — distinto dos amigos azuis) ──────────────
function _buildEnemyFighter() {
  const g = new THREE.Group();
  const body = new THREE.MeshLambertMaterial({ color: 0x6a1f1f });
  const dark = new THREE.MeshLambertMaterial({ color: 0x431414 });
  const glow = new THREE.MeshBasicMaterial({ color: 0xff5530 });

  const fuse = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.55, 3.8), body);
  g.add(fuse);
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.4, 1.3, 6), dark);
  nose.rotation.x = -Math.PI / 2; nose.position.set(0, 0, -2.4); g.add(nose);
  // Asas em delta
  const wingL = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.08, 1.5), dark);
  wingL.position.set(-2.3, -0.05, 0.5); wingL.rotation.y = 0.18; g.add(wingL);
  const wingR = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.08, 1.5), dark);
  wingR.position.set(2.3, -0.05, 0.5); wingR.rotation.y = -0.18; g.add(wingR);
  // Deriva dupla
  for (const sx of [-0.4, 0.4]) {
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.7, 0.6), dark);
    tail.position.set(sx, 0.35, 1.7); tail.rotation.z = sx * 0.6; g.add(tail);
  }
  const exh = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.24, 0.4, 8), glow);
  exh.rotation.x = Math.PI / 2; exh.position.set(0, 0, 2.1); g.add(exh);

  g.scale.setScalar(1.5);
  return g;
}

function _spawnOne(scene, idx) {
  const mesh = _buildEnemyFighter();
  // Nasce num flanco distante e alto, longe dos alvos terrestres do player.
  const ang = (idx / WAVE_SIZE) * Math.PI * 2;
  const cx = game.player.x + Math.cos(ang) * (700 + idx * 60);
  const cz = (game.player.pz || 0) + Math.sin(ang) * (700 + idx * 60) - 400;
  mesh.position.set(cx, 120 + idx * 22, cz);
  scene.add(mesh);
  const e = {
    mesh, hp: 4, maxHp: 4,
    dead: false, falling: false, fallTimer: 0,
    fireTimer: 1.5 + Math.random() * 2.0,
    goalTimer: 0,
    goal: new THREE.Vector3(),
    vel: new THREE.Vector3(),
  };
  game.allyEnemies.push(e);
  return e;
}

export function spawnAllyEnemies(scene) {
  _sceneRef = scene;
  clearAllyEnemies(scene);
  for (let i = 0; i < WAVE_SIZE; i++) _spawnOne(scene, i);
  _respawnTimer = 0;
}

export function clearAllyEnemies(scene) {
  for (const e of game.allyEnemies) if (e.mesh?.parent) scene.remove(e.mesh);
  game.allyEnemies.length = 0;
  for (const m of _allyMissiles) if (m.mesh?.parent) scene.remove(m.mesh);
  _allyMissiles.length = 0;
  for (const t of _allyTracers) if (t.mesh?.parent) scene.remove(t.mesh);
  _allyTracers.length = 0;
}

// ─── Mísseis dos aliados (amigo → inimigo-do-aliado) ──────────────────────────
const _allyMissiles = [];
const ALLY_MSL_GEOM = new THREE.CylinderGeometry(0.12, 0.12, 1.2, 6);
ALLY_MSL_GEOM.rotateX(Math.PI / 2);
const ALLY_MSL_MAT = new THREE.MeshBasicMaterial({ color: 0x9fe0ff });

/** Lançado pelos amigos (wingmen) contra um inimigo dos aliados. Homing simples. */
export function spawnAllyMissile(from, target, quat) {
  if (!_sceneRef) return;
  const mesh = new THREE.Mesh(ALLY_MSL_GEOM, ALLY_MSL_MAT);
  mesh.position.copy(from);
  if (quat) mesh.quaternion.copy(quat);
  _sceneRef.add(mesh);
  const vel = _tmpA.subVectors(target ? target.mesh.position : from, from).normalize().multiplyScalar(110);
  _allyMissiles.push({ mesh, target, vel: vel.clone(), life: 6.0, smoke: 0 });
  game.flags.supportMissilesFired = (game.flags.supportMissilesFired || 0) + 1;
  audio.missile();
}

function _updateAllyMissiles(dt) {
  for (let i = _allyMissiles.length - 1; i >= 0; i--) {
    const m = _allyMissiles[i];
    m.life -= dt;
    if (!m.target || m.target.dead) {
      // re-alvo: inimigo dos aliados mais próximo
      let near = null, nd = Infinity;
      for (const e of game.allyEnemies) {
        if (e.dead || e.falling) continue;
        const d = m.mesh.position.distanceToSquared(e.mesh.position);
        if (d < nd) { nd = d; near = e; }
      }
      m.target = near;
    }
    if (m.target) {
      _tmpB.subVectors(m.target.mesh.position, m.mesh.position).normalize().multiplyScalar(130);
      m.vel.lerp(_tmpB, 0.32);
    }
    m.mesh.position.addScaledVector(m.vel, dt);
    if (m.vel.lengthSq() > 0.01) {
      _tmpC.copy(m.mesh.position).add(m.vel);
      m.mesh.lookAt(_tmpC);
    }
    let hit = false;
    if (m.target && !m.target.dead &&
        m.mesh.position.distanceToSquared(m.target.mesh.position) < 64) {
      _damageEnemy(m.target, 2);
      hit = true;
    }
    if (hit || m.life <= 0) {
      explosion(m.mesh.position.clone(), 1.4, 0xffdd88);
      if (_sceneRef) _sceneRef.remove(m.mesh);
      _allyMissiles.splice(i, 1);
    }
  }
}

// ─── Tracers dos inimigos dos aliados (inimigo → amigo) — revidam! ────────────
const _allyTracers = [];
const TRACER_GEOM = new THREE.CylinderGeometry(0.08, 0.08, 2.2, 5);
TRACER_GEOM.rotateX(Math.PI / 2);
const TRACER_MAT = new THREE.MeshBasicMaterial({ color: 0xff6040 });

function _spawnTracer(from, dir) {
  if (!_sceneRef) return;
  const mesh = new THREE.Mesh(TRACER_GEOM, TRACER_MAT);
  mesh.position.copy(from);
  mesh.lookAt(from.x + dir.x * 10, from.y + dir.y * 10, from.z + dir.z * 10);
  _sceneRef.add(mesh);
  _allyTracers.push({ mesh, vel: dir.clone().multiplyScalar(150), life: 2.2 });
}

function _updateAllyTracers(dt) {
  for (let i = _allyTracers.length - 1; i >= 0; i--) {
    const t = _allyTracers[i];
    t.mesh.position.addScaledVector(t.vel, dt);
    t.life -= dt;
    let consumed = false;
    for (const wm of game.wingmen) {
      if (wm.dead || wm.falling) continue;
      if (t.mesh.position.distanceToSquared(wm.mesh.position) < 16) {
        wm.hp -= 1;
        if (wm.hp <= 0) { wm.falling = true; wm.fallTimer = 3.0; }
        audio.hit();
        consumed = true;
        break;
      }
    }
    if (consumed || t.life <= 0) {
      if (_sceneRef) _sceneRef.remove(t.mesh);
      _allyTracers.splice(i, 1);
    }
  }
}

function _damageEnemy(e, amt) {
  if (e.dead || e.falling) return;
  e.hp -= amt;
  if (e.hp <= 0) {
    e.falling = true;
    e.fallTimer = 2.2;
    spawnShockwave(e.mesh.position.clone(), 16);
  }
}

function _nearestWingman(pos) {
  let best = null, bd = Infinity;
  for (const wm of game.wingmen) {
    if (wm.dead || wm.falling) continue;
    const d = pos.distanceToSquared(wm.mesh.position);
    if (d < bd) { bd = d; best = wm; }
  }
  return best;
}

const _eDir = new THREE.Vector3();
const _eLook = new THREE.Vector3();

export function updateAllyWar(dt) {
  // Respawn de onda: se todos morreram, nasce uma nova frente depois de um tempo
  // (a guerra dos amigos é contínua e não "acaba" como antes).
  const alive = game.allyEnemies.some((e) => !e.dead);
  if (!alive && _sceneRef) {
    _respawnTimer -= dt;
    if (_respawnTimer <= 0) {
      _respawnTimer = 0;
      for (let i = 0; i < WAVE_SIZE; i++) _spawnOne(_sceneRef, i);
    }
  } else if (alive) {
    _respawnTimer = RESPAWN_DELAY;
  }

  for (let i = game.allyEnemies.length - 1; i >= 0; i--) {
    const e = game.allyEnemies[i];
    if (e.dead) { game.allyEnemies.splice(i, 1); continue; }

    if (e.falling) {
      e.fallTimer -= dt;
      e.mesh.rotation.z += (Math.random() - 0.5) * 3.2 * dt;
      e.mesh.rotation.x += 0.9 * dt;
      e.mesh.position.y -= 34 * dt;
      if (e.fallTimer <= 0 || e.mesh.position.y < 2) {
        explosion(e.mesh.position.clone(), 1.6);
        audio.explosion(0.6, e.mesh.position);
        if (e.mesh.parent) e.mesh.parent.remove(e.mesh);
        e.dead = true;
      }
      continue;
    }

    // Persegue o amigo mais próximo; sem amigos vivos, paira.
    const target = _nearestWingman(e.mesh.position);
    e.goalTimer -= dt;
    if (e.goalTimer <= 0) {
      e.goalTimer = 1.6 + Math.random() * 1.4;
      if (target) {
        const side = (i % 2 === 0) ? 1 : -1;
        const phase = (game.time || 0) * 0.4 + i;
        e.goal.set(
          target.mesh.position.x + Math.cos(phase) * 140 * side,
          Math.max(70, target.mesh.position.y + 16),
          target.mesh.position.z + Math.sin(phase) * 150,
        );
      } else {
        e.goal.set(e.mesh.position.x, Math.max(90, e.mesh.position.y), e.mesh.position.z);
      }
    }

    _eDir.subVectors(e.goal, e.mesh.position);
    const dist = Math.max(1, _eDir.length());
    _eDir.normalize();
    const spd = Math.min(90, Math.max(40, dist * 0.5));
    e.vel.lerp(_eDir.multiplyScalar(spd), Math.min(1, dt * 1.6));
    e.mesh.position.addScaledVector(e.vel, dt);
    e.mesh.position.y = Math.max(40, e.mesh.position.y);
    if (e.vel.lengthSq() > 1) {
      _eLook.copy(e.mesh.position).add(e.vel);
      e.mesh.lookAt(_eLook);
    }

    // Revida: dispara tracer contra o amigo mais próximo no alcance.
    e.fireTimer -= dt;
    if (e.fireTimer <= 0 && target) {
      const d2 = e.mesh.position.distanceToSquared(target.mesh.position);
      if (d2 < 900 * 900) {
        e.fireTimer = 1.6 + Math.random() * 1.4;
        _eDir.subVectors(target.mesh.position, e.mesh.position).normalize();
        _tmpA.copy(e.mesh.position).addScaledVector(_eDir, 3);
        _spawnTracer(_tmpA, _eDir);
      } else {
        e.fireTimer = 0.6;
      }
    }
  }

  _updateAllyMissiles(dt);
  _updateAllyTracers(dt);
}
