// weapons.js — Laser do jogador, nukes e projéteis inimigos.

import * as THREE from '../../vendor/three.module.min.js';
import { scene } from './scene.js';
import { game } from './state.js';
import { COLORS } from './config.js';
import { shipForward } from './ship.js';
import { explosion, nukeBlast } from './fx.js';

const _f = new THREE.Vector3();
const _p = new THREE.Vector3();
let cooldown = 0;

function boltMesh(color, len = 48) {
  const m = new THREE.Mesh(
    new THREE.CylinderGeometry(1.6, 1.6, len, 6),
    new THREE.MeshBasicMaterial({ color }),
  );
  m.rotation.x = Math.PI / 2;
  return m;
}

export function fireLaser(dt) {
  cooldown -= dt;
  if (cooldown > 0) return;
  cooldown = 0.12;
  const s = game.ship;
  shipForward(_f);
  const m = boltMesh(COLORS.playerLaser);
  m.position.copy(s.pos).addScaledVector(_f, 40);
  m.quaternion.copy(s.quat);
  scene.add(m);
  game.projectiles.push({ mesh: m, vel: _f.clone().multiplyScalar(2400).add(s.vel), life: 2.5, friendly: true, dmg: 34, isNuke: false });
}

export function launchNuke() {
  const s = game.ship;
  if (s.nukes <= 0 || s.landed) return false;
  s.nukes--;
  shipForward(_f);
  const m = new THREE.Mesh(new THREE.SphereGeometry(12, 12, 12),
    new THREE.MeshBasicMaterial({ color: COLORS.nuke }));
  m.position.copy(s.pos).addScaledVector(_f, 40);
  scene.add(m);
  game.projectiles.push({ mesh: m, vel: _f.clone().multiplyScalar(1600).add(s.vel), life: 14, friendly: true, dmg: 0, isNuke: true, armed: 0.4 });
  return true;
}

export function enemyFire(pos, dir) {
  const m = boltMesh(COLORS.enemyLaser);
  m.position.copy(pos);
  scene.add(m);
  game.projectiles.push({ mesh: m, vel: dir.clone().multiplyScalar(1500), life: 3, friendly: false, dmg: 6, isNuke: false });
}

export function updateProjectiles(dt) {
  const arr = game.projectiles;
  for (let i = arr.length - 1; i >= 0; i--) {
    const p = arr[i];
    p.life -= dt;
    p.mesh.position.addScaledVector(p.vel, dt);
    if (p.isNuke && p.armed > 0) p.armed -= dt;

    let detonate = false, hitPos = p.mesh.position;

    if (p.friendly) {
      // vs inimigos
      for (const e of game.enemies) {
        if (e.dead) continue;
        const d = e.group.position.distanceTo(p.mesh.position);
        if (d < (p.isNuke ? 2200 : e.radius + 40)) {
          if (p.isNuke) { detonate = true; }
          else { e.hp -= p.dmg; explosion(p.mesh.position, 0.5, 0xffcc44); detonate = true; }
          if (e.hp <= 0 && !e.dead) killEnemy(e);
          break;
        }
      }
      // nuke vs alvos de missão (bases) + proximidade de superfície
      if (p.isNuke && p.armed <= 0 && !detonate) {
        if (game.mission) for (const t of game.mission.targets) {
          if (t.destroyed) continue;
          if (t.obj.position.distanceTo(p.mesh.position) < 1800) { detonate = true; break; }
        }
      }
    } else {
      // inimigo vs jogador (sem dano enquanto pousado ou na proteção inicial)
      if (p.mesh.position.distanceTo(game.ship.pos) < 40) {
        const protectedNow = game.ship.landed || game.ship.spawnGrace > 0;
        if (!protectedNow) game.ship.hp -= p.dmg;
        explosion(p.mesh.position, 0.3, protectedNow ? 0x66ccff : 0xff5544);
        detonate = true;
      }
    }

    if (p.isNuke && detonate) {
      nukeBlast(p.mesh.position);
      // dano em área: inimigos
      for (const e of game.enemies) {
        if (!e.dead && e.group.position.distanceTo(hitPos) < 2500) killEnemy(e);
      }
      // destrói bases de missão
      if (game.mission) for (const t of game.mission.targets) {
        if (!t.destroyed && t.obj.position.distanceTo(hitPos) < 2500) destroyTarget(t);
      }
    }

    if (detonate || p.life <= 0) { scene.remove(p.mesh); p.mesh.material.dispose(); arr.splice(i, 1); }
  }
}

function killEnemy(e) {
  e.dead = true; e.hp = 0;
  explosion(e.group.position, 1.4, 0xff8833);
  scene.remove(e.group);
  game.kills++; game.score += 150;
}

function destroyTarget(t) {
  t.destroyed = true;
  explosion(t.obj.position, 2.2, 0x66ff66);
  if (t.obj.parent) t.obj.parent.remove(t.obj);
  game.score += 500;
}
