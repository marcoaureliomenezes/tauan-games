// camp.js — Player camp: campfire (flickering light), tent, crates. Rules:
// near the fire -> faster health/stamina regen + ammo refill; deliver a carried
// deer with [E] -> food; hunger drains food always, starvation drains health.
// Exports: spawnCamp, updateCamp. To tune, edit CAMP in config.js.

import * as THREE from '../../vendor/three.module.min.js';
import { CAMP, PLAYER, COLLISION } from './config.js';
import { game } from './state.js';
import { makeCampfire, makeTent, makeCrates } from './buildings.js';
import { registerCollider } from './collision.js';
import { onPress } from './input.js';

let fireLight = null;
let flame = null;
let ammoTimer = 0;
let flickerT = 0;

/**
 * Builds the camp and registers game.entities.camp.
 * @param {THREE.Scene} scene @param {{x: number, z: number, radius: number}} site
 */
export function spawnCamp(scene, site) {
  const y = game.world.heightAt(site.x, site.z);
  const fire = makeCampfire();
  fire.position.set(site.x, y, site.z);
  scene.add(fire);
  flame = fire.getObjectByName('flame');
  fireLight = new THREE.PointLight(0xff8030, 12, 18, 1.6);
  fireLight.position.set(site.x, y + 1.2, site.z);
  scene.add(fireLight);

  const tent = makeTent();
  const tentY = game.world.heightAt(site.x + 5, site.z - 2);
  tent.position.set(site.x + 5, tentY, site.z - 2);
  tent.rotation.y = 0.6;
  scene.add(tent);
  registerCollider(site.x + 5, site.z - 2, COLLISION.TENT_RADIUS, tentY + 2);
  const crates = makeCrates();
  const cratesY = game.world.heightAt(site.x - 4, site.z + 3);
  crates.position.set(site.x - 4, cratesY, site.z + 3);
  scene.add(crates);
  registerCollider(site.x - 4, site.z + 3, COLLISION.PROP_RADIUS, cratesY + 1.4);

  // CONTRACT: writer of game.entities.camp
  game.entities.camp = { position: { x: site.x, z: site.z }, radius: site.radius, fire };

  onPress('interact', () => {
    const p = game.player;
    if (p.carrying !== 'deer') return;
    const d = Math.hypot(site.x - p.position.x, site.z - p.position.z);
    if (d > CAMP.DELIVER_R) return;
    // CONTRACT: writer of game.player.food / game.player.carrying
    p.food = Math.min(PLAYER.FOOD, p.food + CAMP.FOOD_PER_DEER);
    p.carrying = null;
  });
}

/** Per-frame camp update: hunger/starvation, camp regen, fire flicker. @param {number} dt */
export function updateCamp(dt) {
  const p = game.player;
  // CONTRACT: writer of game.player.food / game.player.health
  p.food = Math.max(0, p.food - CAMP.HUNGER_RATE * dt);
  if (p.food <= 0) p.health = Math.max(0, p.health - CAMP.STARVE_RATE * dt);

  const camp = game.entities.camp;
  if (camp) {
    const d = Math.hypot(camp.position.x - p.position.x, camp.position.z - p.position.z);
    if (d < CAMP.REGEN_R) {
      p.health = Math.min(PLAYER.HEALTH, p.health + CAMP.HEALTH_REGEN * dt);
      p.stamina = Math.min(PLAYER.STAMINA, p.stamina + CAMP.STAMINA_REGEN * dt);
      ammoTimer += dt;
      if (ammoTimer >= CAMP.AMMO_REFILL_EVERY) {
        ammoTimer = 0;
        if (p.ammoReserve < PLAYER.AMMO_RESERVE) p.ammoReserve += 1; // CONTRACT: writer of game.player.ammoReserve
      }
    }
  }

  if (fireLight) {
    flickerT += dt * 9;
    fireLight.intensity = 10 + Math.sin(flickerT) * 1.6 + Math.sin(flickerT * 2.7) * 1.1;
    if (flame) flame.scale.setScalar(0.9 + Math.sin(flickerT * 1.7) * 0.15);
  }
}
