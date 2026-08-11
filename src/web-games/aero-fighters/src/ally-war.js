// ally-war.js — Frente de batalha DOS ALIADOS, separada da do player.
// Nossos aviões amigos (wingmen.js) têm os PRÓPRIOS inimigos — caças hostis que
// NÃO atacam os alvos do player e que revidam contra os amigos. O player tem os
// inimigos dele (targets.js); os amigos têm os deles (este módulo).
// T-C-13 (Onda 5, campanha): os mísseis aliados ficaram GENÉRICOS — além dos
// caças da ally-war, eles também perseguem hostis AÉREOS de game.targets
// (helicópteros/zepelins, ex.: Inhaúma) que os wingmen engajam na defesa do
// jogador. O dano num target do player é aplicado via hp (killTarget roda no
// updateTargets de targets.js — barramento único de score/FX, sem acoplamento
// novo); o dano num caça da ally-war segue o fluxo próprio (falling/shockwave).
//
// Exporta: spawnAllyEnemies, updateAllyWar, clearAllyEnemies, spawnAllyMissile.

import * as THREE from '../../vendor/three.module.min.js';
import { game } from './state.js';
import { explosion, spawnShockwave, spawnFallTrail, spawnShedDebris, spawnSmokeColumn } from './fx.js';
import { audio } from './audio.js';
import { AA_DEFENSE } from './config.js';
import { startDying, stepDying } from './defense/enemy-fighters.js';
import { getActiveHeightFn } from './world.js';
import { pickCityTargetPoint, airStrikeCityBuilding } from './city-war.js';

const _tmpA = new THREE.Vector3();
const _tmpB = new THREE.Vector3();
const _tmpC = new THREE.Vector3();

// Onda de inimigos dos aliados (caças hostis).
// 2026-08-11: 4 → 6 caças; além do dogfight com os wingmen, eles fazem RAIDS
// contra a cidade de Inhaúma (canal de dano do city-war). NUNCA atacam o
// jogador diretamente — mas o jogador PODE derrubá-los (damageAllyEnemy).
const WAVE_SIZE = 6;
const RESPAWN_DELAY = 7.0;
const RAID_COOLDOWN = [12, 22];   // s entre raids de um mesmo caça
const DOGFIGHT_RANGE = 700;       // m — wingman mais perto que isso vence o raid
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
  // Canopy (T-C-13: silhueta de caça tripulado, padrão do defense enemy-fighter)
  const canopy = new THREE.Mesh(new THREE.SphereGeometry(0.3, 6, 5), new THREE.MeshLambertMaterial({ color: 0x181c26 }));
  canopy.scale.set(0.8, 0.6, 1.6); canopy.position.set(0, 0.34, -0.85); g.add(canopy);
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
  // Nasce num flanco distante e alto (T-C-13: anel ~40% mais próximo — o front
  // dos aliados fica visível do jogador e os wingmen o alcançam na patrulha).
  const ang = (idx / WAVE_SIZE) * Math.PI * 2;
  const cx = game.player.x + Math.cos(ang) * (520 + idx * 50);
  const cz = (game.player.pz || 0) + Math.sin(ang) * (520 + idx * 50) - 300;
  mesh.position.set(cx, 120 + idx * 22, cz);
  scene.add(mesh);
  const e = {
    mesh, hp: 4, maxHp: 4,
    dead: false, falling: false, fall: null, trailT: 0,
    fireTimer: 1.5 + Math.random() * 2.0,
    goalTimer: 0,
    goal: new THREE.Vector3(),
    vel: new THREE.Vector3(),
    raid: null,                                  // {id,x,y,z,phase,t} durante um raid
    raidCooldown: 4 + idx * 3 + Math.random() * 6, // stagger inicial dos raids
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

/** Lançado pelos amigos (wingmen) contra um hostil engajado — caça da ally-war
 *  ou hostil aéreo de game.targets (T-C-13). Homing simples. */
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

/** Hostil aéreo de game.targets (helicóptero/zepelim legado ou de formação). */
const isAirborneHostile = (t) => !t.dead && (t.airborneAltitude || 0) > 0;

/** Re-alvo genérico do míssil aliado (T-C-13): caça da ally-war OU hostil aéreo
 *  de game.targets mais próximo do míssil. */
function _nearestHostile(pos) {
  let near = null, nd = Infinity;
  for (const e of game.allyEnemies) {
    if (e.dead || e.falling) continue;
    const d = pos.distanceToSquared(e.mesh.position);
    if (d < nd) { nd = d; near = e; }
  }
  for (const t of game.targets) {
    if (!isAirborneHostile(t)) continue;
    const d = pos.distanceToSquared(t.mesh.position);
    if (d < nd) { nd = d; near = t; }
  }
  return near;
}

/** Dano genérico do míssil aliado (T-C-13): em target do player (tem hr2) aplica
 *  hp — updateTargets de targets.js conclui o kill (FX/score) no próximo frame;
 *  em caça da ally-war segue a queda cinematográfica própria. */
function _damageHostile(target, amt) {
  if (target.hr2 !== undefined) {
    if (!target.dead) target.hp -= amt;
    return;
  }
  _damageEnemy(target, amt);
}

function _updateAllyMissiles(dt) {
  for (let i = _allyMissiles.length - 1; i >= 0; i--) {
    const m = _allyMissiles[i];
    m.life -= dt;
    if (!m.target || m.target.dead) {
      m.target = _nearestHostile(m.mesh.position);
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
      _damageHostile(m.target, 2);
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
    // 2026-08-11: queda REAL (parafuso/planeio/pique) — mesma física do modo
    // defesa (startDying/stepDying), com trilha de fogo, debris e impacto.
    e.falling = true;
    const p = e.mesh.position;
    const f = {
      x: p.x, y: p.y, z: p.z,
      // convenção do stepDying: vx = -sin(yaw)·speed — deriva o yaw da
      // velocidade corrente para a queda continuar o rumo do voo.
      yaw: Math.atan2(-e.vel.x, -e.vel.z),
      pitch: 0, roll: 0,
      speed: Math.max(24, e.vel.length()),
      vx: 0, vy: 0, vz: 0,
    };
    startDying(f, () => game.rng.random(), AA_DEFENSE);
    e.fall = f;
    e.trailT = 0;
    spawnShockwave(e.mesh.position.clone(), 16);
  }
}

/** 2026-08-11: o JOGADOR pode derrubar os caças inimigos (canhão — ver
 *  updateBullets em projectiles.js). Mesmo fluxo de dano/queda dos aliados. */
export function damageAllyEnemy(e, amt) {
  _damageEnemy(e, amt);
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

    if (e.falling && e.fall) {
      const f = e.fall;
      const heightAt = getActiveHeightFn();
      const events = stepDying(f, dt, { heightAt: (x, z) => heightAt(x, z), rng: () => game.rng.random() }, AA_DEFENSE);
      e.mesh.position.set(f.x, f.y, f.z);
      e.mesh.rotation.set(f.pitch, f.yaw, f.roll);
      e.trailT -= dt;
      if (e.trailT <= 0) {
        e.trailT = AA_DEFENSE.FALL_TRAIL_S;
        spawnFallTrail(e.mesh.position);
      }
      for (const ev of events) {
        if (ev.type === 'shed') {
          spawnShedDebris({ x: ev.x, y: ev.y, z: ev.z }, { x: ev.vx, y: ev.vy, z: ev.vz });
        } else if (ev.type === 'impact') {
          explosion(e.mesh.position.clone(), 1.8);
          spawnShockwave(e.mesh.position.clone(), 20);
          spawnSmokeColumn(e.mesh.position, AA_DEFENSE.FALL_COLUMN_S);
          audio.explosion(0.7, e.mesh.position);
          if (e.mesh.parent) e.mesh.parent.remove(e.mesh);
          e.dead = true;
        }
      }
      continue;
    }

    // 2026-08-11: doutrina de alvos dos caças inimigos — cidade, instalações e
    // caças aliados; NUNCA o jogador. Dogfight vence quando há wingman perto
    // (< DOGFIGHT_RANGE); senão o caça entra em RAID: mergulha num prédio real
    // de Inhaúma e crava o strike no canal do city-war (fogo + fumaça + scorch).
    const target = _nearestWingman(e.mesh.position);
    const targetD2 = target ? e.mesh.position.distanceToSquared(target.mesh.position) : Infinity;
    e.raidCooldown -= dt;
    if (!e.raid && e.raidCooldown <= 0 && targetD2 > DOGFIGHT_RANGE * DOGFIGHT_RANGE) {
      const pt = pickCityTargetPoint();
      if (pt) e.raid = { ...pt, phase: 'dive', t: 0 };
      e.raidCooldown = RAID_COOLDOWN[0] + Math.random() * (RAID_COOLDOWN[1] - RAID_COOLDOWN[0]);
    }
    if (e.raid && target && targetD2 < DOGFIGHT_RANGE * DOGFIGHT_RANGE * 0.25) {
      e.raid = null; // wingman colou — abandona o raid e briga
    }
    if (e.raid) {
      const r = e.raid;
      r.t += dt;
      if (r.phase === 'dive') {
        e.goal.set(r.x, r.y + 6, r.z);
        const d2 = e.mesh.position.distanceToSquared(e.goal);
        if (d2 < 45 * 45 || r.t > 25) {
          if (d2 < 45 * 45) {
            airStrikeCityBuilding(r.id);
            audio.explosion(0.8, e.mesh.position);
          }
          r.phase = 'egress'; r.t = 0;
        }
      } else { // egress: cabra sobe e sai antes do próximo raid/dogfight
        e.goal.set(r.x + Math.sin(i) * 260, Math.max(150, r.y + 170), r.z - 260);
        if (r.t > 3.0) e.raid = null;
      }
      e.goalTimer = 0.4; // re-avalia rápido durante o raid
    }
    e.goalTimer -= dt;
    if (e.goalTimer <= 0 && !e.raid) {
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

    // Fogo: strafe no prédio durante o mergulho do raid; senão revida no amigo
    // mais próximo dentro do alcance.
    e.fireTimer -= dt;
    if (e.fireTimer <= 0) {
      if (e.raid && e.raid.phase === 'dive') {
        e.fireTimer = 0.35; // rajada de strafe — tracers cravando no prédio
        _eDir.subVectors(e.goal, e.mesh.position).normalize();
        _tmpA.copy(e.mesh.position).addScaledVector(_eDir, 3);
        _spawnTracer(_tmpA, _eDir);
      } else if (target) {
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
  }

  _updateAllyMissiles(dt);
  _updateAllyTracers(dt);
}
