// bandits.js — 5 fugitive bandits: wander home regions far from camp, flee the
// player, SURRENDER when shot, capturable with [E] at close range.
// Exports: spawnBandits, updateBandits. To tune, edit BANDITS in config.js.

import { WORLD, BANDITS } from './config.js';
import { game } from './state.js';
import { makeActor, moveToward, distToPlayer } from './actors.js';
import { registerTarget, unregisterTarget } from './combat.js';
import { onPress } from './input.js';
import { slopeAt } from './heightfield.js';
import { distToRiver } from './rivers.js';
import { mulberry32 } from './noise.js';

const B = BANDITS;

/** Dark-tinted cowboy (fugitive look): clones shared materials, darkens them. */
function tintDark(actor) {
  actor.group.traverse((n) => {
    if (n.isMesh && n.material) {
      n.material = n.material.clone();
      if (n.material.color) n.material.color.multiplyScalar(0.45);
    }
  });
}

function banditShot(bandit) {
  if (bandit.state !== 'wander' && bandit.state !== 'flee') return;
  bandit.state = 'surrendered';
  bandit.actor.play('Wave', 0.2); // hands up
  unregisterTarget(bandit.actor.group);
}

function pickRegions(rng) {
  const regions = [];
  for (let t = 0; t < 2000 && regions.length < B.COUNT; t++) {
    const x = (rng() * 2 - 1) * 700;
    const z = (rng() * 2 - 1) * 700;
    if (slopeAt(x, z) > 0.45 || distToRiver(x, z) < 25) continue;
    if (game.entities.camp && Math.hypot(x - game.entities.camp.position.x, z - game.entities.camp.position.z) < 250) continue;
    if (!regions.every((r) => Math.hypot(x - r.x, z - r.z) >= B.REGION_MIN_SPREAD)) continue;
    regions.push({ x, z });
  }
  return regions;
}

/**
 * Spawns the 5 bandits and registers them in game.entities.bandits.
 * @param {object} scene THREE.Scene
 */
export function spawnBandits(scene) {
  const rng = mulberry32(WORLD.SEED + 1876);
  for (const region of pickRegions(rng)) {
    const actor = makeActor('cowboy', 1.75);
    tintDark(actor);
    actor.group.position.set(region.x, game.world.heightAt(region.x, region.z), region.z);
    scene.add(actor.group);
    actor.play('Idle');
    const bandit = { actor, home: region, target: null, state: 'wander', wait: rng() * 4 };
    registerTarget(actor.group, () => banditShot(bandit));
    // CONTRACT: writer of game.entities.bandits
    game.entities.bandits.push({
      position: actor.group.position,
      state: bandit.state,
      mesh: actor.group,
      bandit, // internal handle (AI state machine)
    });
  }

  onPress('interact', () => {
    const p = game.player;
    for (const entry of game.entities.bandits) {
      if (entry.state !== 'surrendered') continue;
      if (Math.hypot(entry.position.x - p.position.x, entry.position.z - p.position.z) > B.CAPTURE_DIST) continue;
      entry.state = 'captured';
      entry.bandit.state = 'captured';
      game.scene.remove(entry.mesh);
      // CONTRACT: writer of game.player.banditsCaptured
      p.banditsCaptured += 1;
      return;
    }
  });
}

/** Per-frame bandit AI update. @param {number} dt seconds */
export function updateBandits(dt) {
  for (const entry of game.entities.bandits) {
    const b = entry.bandit;
    entry.state = b.state; // keep the public mirror in sync
    if (b.state === 'captured') continue;
    b.actor.tick(dt);
    if (b.state === 'surrendered') { b.actor.play('Wave', 0.4); continue; }

    const dist = distToPlayer(b.actor);
    if (b.state !== 'flee' && dist < B.FLEE_R) {
      b.state = 'flee';
      const p = game.player.position;
      const g = b.actor.group.position;
      const dx = g.x - p.x, dz = g.z - p.z;
      const d = Math.hypot(dx, dz) || 1;
      b.target = { x: g.x + (dx / d) * B.FLEE_DIST, z: g.z + (dz / d) * B.FLEE_DIST };
      b.actor.play('Run', 0.15);
    }
    if (b.state === 'flee') {
      if (moveToward(b.actor, b.target.x, b.target.z, B.FLEE_SPD, dt)) {
        b.state = 'wander';
        b.home = { x: b.actor.group.position.x, z: b.actor.group.position.z };
        b.target = null;
        b.wait = 1;
      }
      continue;
    }
    // wander around home
    b.wait -= dt;
    if (b.wait > 0) { b.actor.play('Idle', 0.4); continue; }
    if (!b.target) {
      b.target = {
        x: b.home.x + (Math.random() * 2 - 1) * B.REGION_R,
        z: b.home.z + (Math.random() * 2 - 1) * B.REGION_R,
      };
      b.actor.play('Walk', 0.3);
    }
    if (moveToward(b.actor, b.target.x, b.target.z, B.WANDER_SPD, dt)) {
      b.target = null;
      b.wait = 2 + Math.random() * 5;
    }
  }
}
