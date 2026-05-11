// projectiles.js — Balas, mísseis homing e pickups (drops de munição).
// Exporta: spawnBullet, recycleBullet, updateBullets, spawnMissile, updateMissiles,
//   spawnPickup, updatePickups.
// Para adicionar projétil novo (foguete, bomba): novo pool aqui ou módulo dedicado.
//
// Acoplamento intencional: importa damageTarget de targets.js (exceção α — ver CONVENTIONS).

import * as THREE from '../../vendor/three.module.min.js';
import { scene } from './scene.js';
import { audio } from './audio.js';
import { game } from './state.js';
import { CANNON, MISSILES_LIGHT, MISSILES_HEAVY, MISSILES_NUCLEAR, COLORS } from './config.js';
import { explosion, spawnMissileSmoke, nuclearExplosion } from './fx.js';
import { damageTarget } from './targets.js';
import { deformTerrainNuclear } from './world.js';

// ─── Balas ───────────────────────────────────────────────────────────────────
// Tracer estilo M61 Vulcan: cilindro alongado amarelo brilhante, trilhando atrás da bala
const BULLET_GEOM = new THREE.CylinderGeometry(0.06, 0.06, 2.0, 6);
BULLET_GEOM.rotateX(Math.PI / 2);
const BULLET_MAT  = new THREE.MeshBasicMaterial({ color: 0xfff080 });
const ENEMY_B_MAT = new THREE.MeshBasicMaterial({ color: COLORS.bulletEnemy });

const bulletPoolPlayer = [], bulletPoolEnemy = [];

/** Spawna uma bala. @param orig posição inicial @param dir direção normalizada */
export function spawnBullet(orig, dir, isEnemy = false) {
  const pool = isEnemy ? bulletPoolEnemy : bulletPoolPlayer;
  let mesh = pool.pop();
  if (!mesh) mesh = new THREE.Mesh(BULLET_GEOM, isEnemy ? ENEMY_B_MAT : BULLET_MAT);
  mesh.position.copy(orig);
  // Aponta o tracer ao longo da direção de voo (cilindro estende-se atrás da bala)
  mesh.lookAt(orig.x + dir.x * 10, orig.y + dir.y * 10, orig.z + dir.z * 10);
  mesh.visible = true; scene.add(mesh);
  const spd = isEnemy ? 56 : CANNON.BULLET_SPD;
  // CONTRATO: writer de game.projectiles
  game.projectiles.push({
    mesh,
    velocity: new THREE.Vector3(dir.x * spd, dir.y * spd, dir.z * spd),
    life: CANNON.BULLET_LIFE,
    isEnemy,
  });
}

export function recycleBullet(p) {
  scene.remove(p.mesh); p.mesh.visible = false;
  (p.isEnemy ? bulletPoolEnemy : bulletPoolPlayer).push(p.mesh);
}

/** Atualiza todas as balas: move, checa hit em alvos (player) ou no jato (inimigo). */
export function updateBullets(dt, jetPos, onPlayerHit, wingmen = []) {
  const jx = jetPos.x, jy = jetPos.y, jz = jetPos.z;
  for (let i = game.projectiles.length - 1; i >= 0; i--) {
    const p = game.projectiles[i];
    p.mesh.position.x += p.velocity.x * dt;
    p.mesh.position.y += p.velocity.y * dt;
    p.mesh.position.z += p.velocity.z * dt;
    p.life -= dt;
    let consumed = false;
    if (!p.isEnemy) {
      for (const e of game.targets) {
        if (e.dead) continue;
        if (p.mesh.position.distanceToSquared(e.mesh.position) < e.hr2) {
          damageTarget(e, 1); consumed = true; break;
        }
      }
    } else if (game.flags.invincibility <= 0 && game.flags.rollTimer <= 0) {
      const dx = p.mesh.position.x - jx, dy = p.mesh.position.y - jy, dz = p.mesh.position.z - jz;
      const d2 = dx * dx + dy * dy + dz * dz;
      if (d2 < 4) { onPlayerHit(); consumed = true; }
      else if (d2 < 64) { audio.closeMiss(); }
      else {
        for (const wm of wingmen) {
          if (wm.dead || wm.falling) continue;
          const wx = p.mesh.position.x - wm.mesh.position.x;
          const wy = p.mesh.position.y - wm.mesh.position.y;
          const wz = p.mesh.position.z - wm.mesh.position.z;
          if (wx * wx + wy * wy + wz * wz < 9) {
            wm.hp -= 1;
            if (wm.hp <= 0) { wm.falling = true; wm.fallTimer = 3.0; }
            audio.hit();
            consumed = true;
            break;
          }
        }
      }
    }
    if (consumed || p.life <= 0) { recycleBullet(p); game.projectiles.splice(i, 1); }
  }
}

// ─── Mísseis ─────────────────────────────────────────────────────────────────
const missiles = [];
const _msDir = new THREE.Vector3();

/** Constrói o mesh de um míssil (nose cone + body + 4 fins + flame trail). */
function buildMissileMesh(kind) {
  const g = new THREE.Group();
  const isHeavy = kind === 'heavy';
  const bodyColor = isHeavy ? 0x4a4a52 : 0x9aa0aa;
  const finColor = isHeavy ? 0x2a2a32 : 0x666c78;
  const flameColor = isHeavy ? 0xffaa20 : 0xffeebb;

  const bodyMat = new THREE.MeshLambertMaterial({ color: bodyColor });
  const finMat = new THREE.MeshLambertMaterial({ color: finColor });
  const flameMat = new THREE.MeshBasicMaterial({ color: flameColor, transparent: true, opacity: 0.95 });

  // Corpo cilíndrico
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.10, 0.10, 1.2, 8), bodyMat);
  body.rotation.x = Math.PI / 2;
  body.position.z = 0;
  g.add(body);
  // Nose cone
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.10, 0.35, 8), bodyMat);
  nose.rotation.x = -Math.PI / 2;
  nose.position.z = -0.78;
  g.add(nose);
  // 4 aletas estabilizadoras na traseira (cruz)
  for (let i = 0; i < 4; i++) {
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.35, 0.4), finMat);
    fin.rotation.z = (i * Math.PI) / 2;
    fin.position.z = 0.45;
    g.add(fin);
  }
  // Chama de propulsão atrás
  const flame = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.5, 8), flameMat);
  flame.rotation.x = -Math.PI / 2;
  flame.position.z = 0.95;
  g.add(flame);

  if (isHeavy) g.scale.set(1.5, 1.5, 1.5);
  return g;
}

/** Lança um míssil em direção a um alvo (homing). @param kind 'light'|'heavy' */
export function spawnMissile(orig, target, jetQuat, kind = 'light') {
  const cfg = kind === 'heavy' ? MISSILES_HEAVY : MISSILES_LIGHT;
  const mesh = buildMissileMesh(kind);
  mesh.position.copy(orig);
  // Orienta o míssil no momento do disparo para apontar para frente do jato
  mesh.quaternion.copy(jetQuat);
  scene.add(mesh);
  const vel = new THREE.Vector3(0, 0, -1).applyQuaternion(jetQuat).multiplyScalar(cfg.INITIAL_SPD);
  missiles.push({ mesh, target, velocity: vel, life: cfg.LIFE, smokeTimer: 0, cfg, kind });
  audio.missile();
}

/** Atualiza mísseis: re-targeting + homing + impacto. */
export function updateMissiles(dt) {
  for (let i = missiles.length - 1; i >= 0; i--) {
    const m = missiles[i]; m.life -= dt;
    if (!m.target || m.target.dead) {
      let near = null, nd = Infinity;
      for (const e of game.targets) {
        if (e.dead) continue;
        const d = m.mesh.position.distanceToSquared(e.mesh.position);
        if (d < nd) { nd = d; near = e; }
      }
      m.target = near;
    }
    if (m.target) {
      const dist = m.mesh.position.distanceTo(m.target.mesh.position);
      // Proximity boost: mais perto = turn mais agressivo (impede overshoot)
      const turn = dist < 40 ? m.cfg.CLOSE_TURN_RATE : m.cfg.TURN_RATE;
      _msDir.subVectors(m.target.mesh.position, m.mesh.position).normalize().multiplyScalar(m.cfg.TRACKING_SPD);
      m.velocity.lerp(_msDir, turn);
    }
    m.mesh.position.addScaledVector(m.velocity, dt);

    // Orienta o mesh ao longo da velocidade (visual realista)
    if (m.velocity.lengthSq() > 0.01) {
      _msDir.copy(m.velocity).normalize();
      m.mesh.lookAt(
        m.mesh.position.x + _msDir.x,
        m.mesh.position.y + _msDir.y,
        m.mesh.position.z + _msDir.z,
      );
    }

    // Trilha de fumaça atrás do míssil — heavy tem trilha mais densa
    m.smokeTimer -= dt;
    if (m.smokeTimer <= 0) {
      m.smokeTimer = m.kind === 'heavy' ? 0.04 : 0.06;
      spawnMissileSmoke(m.mesh.position);
    }

    let hit = false;
    if (m.target && !m.target.dead) {
      const hr2 = m.target.hr2 * 2.5;   // raio de impacto generoso (anti-miss)
      if (m.mesh.position.distanceToSquared(m.target.mesh.position) < hr2) {
        damageTarget(m.target, m.cfg.DAMAGE);
        hit = true;
      }
    }
    if (hit || m.life <= 0) {
      const scale = m.kind === 'heavy' ? 1.5 : 0.9;
      explosion(m.mesh.position, scale, COLORS.fireYellow);
      audio.explosion(m.kind === 'heavy' ? 1.2 : 0.5, m.mesh.position);
      scene.remove(m.mesh);
      missiles.splice(i, 1);
    }
  }
}

/** Limpa todos os mísseis (para restartGame). */
export function clearMissiles() {
  for (const m of missiles) if (m.mesh?.parent) scene.remove(m.mesh);
  missiles.length = 0;
}

// ─── Pickups (resupply de mísseis) ───────────────────────────────────────────
const pickups = [];

export function spawnPickup(pos) {
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(0.7, 8, 8),
    new THREE.MeshBasicMaterial({ color: COLORS.pickup }),
  );
  mesh.position.copy(pos); mesh.position.y += 4; scene.add(mesh);
  pickups.push({ mesh, life: 18.0 });
}

export function updatePickups(dt, jetPos) {
  for (let i = pickups.length - 1; i >= 0; i--) {
    const p = pickups[i]; p.life -= dt;
    p.mesh.position.y += Math.sin(performance.now() * 0.005) * dt * 0.5;
    if (p.mesh.position.distanceTo(jetPos) < 3) {
      // CONTRATO: writer de game.player.missiles
      game.player.missiles = Math.min(game.player.missiles + 10, MISSILES.MAX);
      scene.remove(p.mesh); pickups.splice(i, 1); continue;
    }
    if (p.life <= 0) { scene.remove(p.mesh); pickups.splice(i, 1); }
  }
}

export function clearPickups() {
  for (const p of pickups) if (p.mesh?.parent) scene.remove(p.mesh);
  pickups.length = 0;
}

// ─── Mísseis nucleares ───────────────────────────────────────────────────────
const nukes = [];

/** Constrói o mesh do míssil nuclear. */
function buildNuclearMesh() {
  const g = new THREE.Group();
  // Corpo principal
  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(0.18, 0.20, 2.0, 8),
    new THREE.MeshLambertMaterial({ color: 0x1a1a22 }),
  );
  body.rotation.x = Math.PI / 2;
  g.add(body);
  // Nose cone
  const nose = new THREE.Mesh(
    new THREE.ConeGeometry(0.18, 0.7, 8),
    new THREE.MeshLambertMaterial({ color: 0x2a1a1a }),
  );
  nose.rotation.x = -Math.PI / 2;
  nose.position.z = -1.2;
  g.add(nose);
  // Faixa verde de aviso
  const stripe = new THREE.Mesh(
    new THREE.CylinderGeometry(0.19, 0.19, 0.15, 8),
    new THREE.MeshBasicMaterial({ color: 0x00cc22 }),
  );
  stripe.rotation.x = Math.PI / 2;
  stripe.position.z = 0.3;
  g.add(stripe);
  return g;
}

/** Lança um míssil nuclear. */
export function spawnNuclearMissile(orig, target, jetQuat) {
  if (game.player.nuclearMissiles <= 0) return;
  game.player.nuclearMissiles--;
  const mesh = buildNuclearMesh();
  mesh.position.copy(orig);
  mesh.quaternion.copy(jetQuat);
  scene.add(mesh);
  const vel = new THREE.Vector3(0, 0, -MISSILES_NUCLEAR.INITIAL_SPD).applyQuaternion(jetQuat);
  nukes.push({ mesh, target, vel, life: MISSILES_NUCLEAR.LIFE });
  audio.missile();
}

function applyNuclearShockwave(epicenter) {
  for (const t of game.targets) {
    if (t.dead) continue;
    const dist = epicenter.distanceTo(t.mesh.position);
    if (dist < MISSILES_NUCLEAR.BLAST_RADIUS) {
      const dmg = MISSILES_NUCLEAR.DAMAGE * Math.max(0, 1 - dist / MISSILES_NUCLEAR.BLAST_RADIUS);
      damageTarget(t, dmg);
    }
  }
  // Player damage check
  const playerPos = new THREE.Vector3(game.player.x, game.player.y, game.player.pz || 0);
  const pd = epicenter.distanceTo(playerPos);
  if (pd < MISSILES_NUCLEAR.PLAYER_KILL_RADIUS) {
    game.player.lives = 0;
  } else if (pd < MISSILES_NUCLEAR.PLAYER_DAMAGE_RADIUS) {
    game.player.lives = Math.max(0, game.player.lives - 1);
  }
  // Shake forte em toda a área de dano (proporcional à distância)
  if (pd < MISSILES_NUCLEAR.PLAYER_DAMAGE_RADIUS) {
    const shakeFactor = Math.max(0.2, 1 - pd / MISSILES_NUCLEAR.PLAYER_DAMAGE_RADIUS);
    game.flags.cameraShake = { intensity: 14.0 * shakeFactor, duration: 5.0 };
  }

  // Deforma o terreno — cria cratera nas ilhas/montanhas dentro do raio
  deformTerrainNuclear(epicenter, MISSILES_NUCLEAR.BLAST_RADIUS);
}

/** Atualiza mísseis nucleares: homing + impacto + explosão. */
export function updateNuclears(dt) {
  for (let i = nukes.length - 1; i >= 0; i--) {
    const n = nukes[i];
    n.life -= dt;

    // Homing
    if (n.target && !n.target.dead) {
      const dist = n.mesh.position.distanceTo(n.target.mesh.position);
      const tr = dist < 40 ? MISSILES_NUCLEAR.CLOSE_TURN_RATE : MISSILES_NUCLEAR.TURN_RATE;
      const desired = n.target.mesh.position.clone().sub(n.mesh.position).normalize().multiplyScalar(MISSILES_NUCLEAR.TRACKING_SPD);
      n.vel.lerp(desired, tr);
    } else if (!n.target || n.target.dead) {
      // Re-target
      let near = null, nd = Infinity;
      for (const e of game.targets) {
        if (e.dead) continue;
        const d = n.mesh.position.distanceToSquared(e.mesh.position);
        if (d < nd) { nd = d; near = e; }
      }
      n.target = near;
    }

    n.mesh.position.addScaledVector(n.vel, dt);
    if (n.vel.lengthSq() > 0.01) {
      const lookDir = n.mesh.position.clone().add(n.vel);
      n.mesh.lookAt(lookDir);
    }

    // Trilha de fumaça
    if (!n._smokeTimer) n._smokeTimer = 0;
    n._smokeTimer -= dt;
    if (n._smokeTimer <= 0) { n._smokeTimer = 0.04; spawnMissileSmoke(n.mesh.position); }

    // Impacto
    const hitTarget = n.target && !n.target.dead &&
      n.mesh.position.distanceTo(n.target.mesh.position) < 10;
    const groundHit = n.mesh.position.y <= 1;
    const expired = n.life <= 0;

    if (hitTarget || groundHit || expired) {
      nuclearExplosion(n.mesh.position.clone());
      applyNuclearShockwave(n.mesh.position.clone());
      audio.explosion(1.5, n.mesh.position);
      scene.remove(n.mesh);
      nukes.splice(i, 1);
    }
  }
}

/** Limpa mísseis nucleares (para restartGame). */
export function clearNuclears() {
  for (const n of nukes) if (n.mesh?.parent) scene.remove(n.mesh);
  nukes.length = 0;
}
