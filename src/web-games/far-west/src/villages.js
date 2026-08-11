// villages.js — Native villages: teepees, totem, campfire, and guard archers
// with aggro (shoot ballistic arrows at the player inside 40 m). Archers are
// shootable via the combat target registry. Exports: spawnVillages, updateVillages.
// To tune aggro/damage, edit VILLAGE in config.js.

import * as THREE from '../../vendor/three.module.min.js';
import { VILLAGE, AUDIO, COLLISION } from './config.js';
import { game } from './state.js';
import { makeActor } from './actors.js';
import { makeTeepee, makeTotem, makeCampfire } from './buildings.js';
import { registerTarget, unregisterTarget } from './combat.js';
import { registerCollider } from './collision.js';
import { playWhoosh } from './audio.js';
import { mulberry32 } from './noise.js';

const arrows = []; // { mesh, vel, life }
let arrowGeo = null;
let arrowMat = null;

function spawnArrow(from, vel) {
  if (!arrowGeo) {
    arrowGeo = new THREE.BoxGeometry(0.04, 0.04, 0.7);
    arrowMat = new THREE.MeshBasicMaterial({ color: 0x8a6a3a });
  }
  const mesh = new THREE.Mesh(arrowGeo, arrowMat);
  mesh.position.copy(from);
  game.scene.add(mesh);
  arrows.push({ mesh, vel: vel.clone(), life: 4 });
}

function updateArrows(dt) {
  const p = game.player.position;
  for (let i = arrows.length - 1; i >= 0; i--) {
    const a = arrows[i];
    a.vel.y -= VILLAGE.ARROW_GRAVITY * dt;
    a.mesh.position.addScaledVector(a.vel, dt);
    a.mesh.lookAt(a.mesh.position.x + a.vel.x, a.mesh.position.y + a.vel.y, a.mesh.position.z + a.vel.z);
    a.life -= dt;
    const mp = a.mesh.position;
    const hitPlayer = Math.hypot(mp.x - p.x, mp.z - p.z) < 1.2 && mp.y > p.y && mp.y < p.y + 2.2;
    if (hitPlayer) {
      // CONTRACT: writer of game.player.health / game.flags.damageFlash
      game.player.health = Math.max(0, game.player.health - VILLAGE.ARROW_DAMAGE);
      game.flags.damageFlash = 0.45;
      a.life = 0;
    } else if (mp.y < game.world.heightAt(mp.x, mp.z)) {
      a.life = 0; // stuck in the ground
    }
    if (a.life <= 0) {
      game.scene.remove(a.mesh);
      arrows.splice(i, 1);
    }
  }
}

function onArcherShot(archer) {
  if (archer.state !== 'guard') return;
  archer.hp -= 1;
  if (archer.hp <= 0) {
    archer.state = 'dead';
    archer.deadT = 0;
    archer.actor.play('Death', 0.15);
    unregisterTarget(archer.actor.group);
  }
}

/** Aims a ballistic arrow from the archer at the player's chest. */
function fireArrow(archer) {
  const p = game.player.position;
  const from = archer.actor.group.position.clone();
  from.y += 1.4;
  const dx = p.x - from.x, dz = p.z - from.z;
  const dist = Math.hypot(dx, dz);
  const t = dist / VILLAGE.ARROW_SPEED;
  const dy = (p.y + 1.3) - from.y;
  const vel = new THREE.Vector3(
    dx / t,
    dy / t + 0.5 * VILLAGE.ARROW_GRAVITY * t,
    dz / t,
  );
  spawnArrow(from, vel);
  if (Math.hypot(from.x - p.x, from.z - p.z) < AUDIO.WHOOSH_R) playWhoosh();
}

/**
 * Builds both villages and registers them in game.entities.villages.
 * @param {THREE.Scene} scene @param {Array} sites from pickSites()
 */
export function spawnVillages(scene, sites) {
  const rng = mulberry32(4242); // independent deterministic stream
  for (const site of sites) {
    const village = { position: { x: site.x, z: site.z }, radius: site.radius, archers: [], aggro: false };
    for (let i = 0; i < VILLAGE.TEEPEES; i++) {
      const a = (i / VILLAGE.TEEPEES) * Math.PI * 2 + site.yaw;
      const tx = site.x + Math.cos(a) * 12;
      const tz = site.z + Math.sin(a) * 12;
      const teepee = makeTeepee();
      const ty = game.world.heightAt(tx, tz);
      teepee.position.set(tx, ty, tz);
      scene.add(teepee);
      registerCollider(tx, tz, COLLISION.TEEPEE_RADIUS, ty + 4);
    }
    const totem = makeTotem();
    const totemY = game.world.heightAt(site.x, site.z);
    totem.position.set(site.x, totemY, site.z);
    scene.add(totem);
    registerCollider(site.x, site.z, COLLISION.PROP_RADIUS, totemY + 3);
    const fire = makeCampfire();
    fire.position.set(site.x + 4, game.world.heightAt(site.x + 4, site.z + 4), site.z + 4);
    scene.add(fire);

    for (let i = 0; i < VILLAGE.ARCHERS; i++) {
      const a = (i / VILLAGE.ARCHERS) * Math.PI * 2 + rng();
      const r = 10 + rng() * 8;
      const ax = site.x + Math.cos(a) * r;
      const az = site.z + Math.sin(a) * r;
      const actor = makeActor('native', 1.7);
      actor.group.position.set(ax, game.world.heightAt(ax, az), az);
      scene.add(actor.group);
      const archer = { actor, hp: VILLAGE.ARCHER_HP, state: 'guard', cooldown: rng() * VILLAGE.ARROW_INTERVAL, deadT: 0 };
      registerTarget(actor.group, () => onArcherShot(archer));
      village.archers.push(archer);
    }
    // CONTRACT: writer of game.entities.villages
    game.entities.villages.push(village);
  }
}

/** Per-frame village update: aggro, arrow fire, death despawn. @param {number} dt */
export function updateVillages(dt) {
  const p = game.player.position;
  for (const village of game.entities.villages) {
    const dist = Math.hypot(p.x - village.position.x, p.z - village.position.z);
    if (dist < VILLAGE.AGGRO_R) village.aggro = true;
    else if (dist > VILLAGE.DEAGGRO_R) village.aggro = false;
    for (const archer of village.archers) {
      archer.actor.tick(dt);
      if (archer.state === 'dead') {
        archer.deadT += dt;
        if (archer.deadT > VILLAGE.DEATH_DESPAWN && archer.actor.group.parent) {
          game.scene.remove(archer.actor.group);
        }
        continue;
      }
      if (!village.aggro || dist > VILLAGE.ARROW_RANGE) continue;
      archer.cooldown -= dt;
      if (archer.cooldown <= 0) {
        archer.cooldown = VILLAGE.ARROW_INTERVAL;
        // Face the player and loose an arrow
        archer.actor.group.rotation.y = Math.atan2(p.x - archer.actor.group.position.x, p.z - archer.actor.group.position.z);
        fireArrow(archer);
      }
    }
  }
  updateArrows(dt);
}
