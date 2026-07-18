// animals.js — Fauna: deer herds (graze/flee, shootable -> carcass -> [E] pickup),
// snakes (strike when stepped near, poison), eagles (circling flight).
// Exports: spawnAnimals, updateAnimals. To tune, edit ANIMALS in config.js.

import { WORLD, ANIMALS } from './config.js';
import { game } from './state.js';
import { makeActor, moveToward, distToPlayer } from './actors.js';
import { registerTarget, unregisterTarget } from './combat.js';
import { onPress } from './input.js';
import { slopeAt, moistureAt } from './heightfield.js';
import { distToRiver } from './rivers.js';
import { mulberry32 } from './noise.js';

const A = ANIMALS;
let rng = null;

// ─── Deer ────────────────────────────────────────────────────────────────────

function deerShot(deer) {
  if (deer.state === 'dead') return;
  deer.state = 'dead';
  deer.actor.play('Death', 0.15);
  unregisterTarget(deer.actor.group);
  // CONTRACT: writer of game.entities.carcasses
  game.entities.carcasses.push({ position: deer.actor.group.position, mesh: deer.actor.group });
}

function updateDeer(deer, dt) {
  deer.actor.tick(dt);
  if (deer.state === 'dead') return;
  const dist = distToPlayer(deer.actor);
  if (deer.state !== 'flee' && dist < A.DEER_FLEE_R) {
    deer.state = 'flee';
    const p = game.player.position;
    const g = deer.actor.group.position;
    const dx = g.x - p.x, dz = g.z - p.z;
    const d = Math.hypot(dx, dz) || 1;
    deer.target = { x: g.x + (dx / d) * A.DEER_FLEE_DIST, z: g.z + (dz / d) * A.DEER_FLEE_DIST };
    deer.actor.play('Gallop', 0.15);
  }
  if (deer.state === 'flee') {
    if (moveToward(deer.actor, deer.target.x, deer.target.z, A.DEER_FLEE_SPD, dt)) {
      deer.state = 'graze';
      deer.home = { x: deer.actor.group.position.x, z: deer.actor.group.position.z };
      deer.wait = 0;
    }
    return;
  }
  // graze: wander slowly around home, pause to eat
  deer.wait -= dt;
  if (deer.wait > 0) { deer.actor.play('Eating', 0.4); return; }
  if (!deer.target) {
    deer.target = {
      x: deer.home.x + (rng() * 2 - 1) * 20,
      z: deer.home.z + (rng() * 2 - 1) * 20,
    };
    deer.actor.play('Walk', 0.3);
  }
  if (moveToward(deer.actor, deer.target.x, deer.target.z, A.DEER_WALK_SPD, dt)) {
    deer.target = null;
    deer.wait = 2 + rng() * 5;
  }
}

function spawnDeerHerds(scene) {
  const herds = [];
  for (let h = 0; h < A.HERDS; h++) {
    let cx = 0, cz = 0;
    for (let t = 0; t < 300; t++) {
      const x = (rng() * 2 - 1) * 420;
      const z = (rng() * 2 - 1) * 420;
      if (slopeAt(x, z) < 0.35 && moistureAt(x, z) > 0.4 && distToRiver(x, z) > 30) { cx = x; cz = z; break; }
    }
    herds.push({ x: cx, z: cz });
  }
  for (const herd of herds) {
    const count = A.HERD_MIN + Math.floor(rng() * (A.HERD_MAX - A.HERD_MIN + 1));
    for (let i = 0; i < count; i++) {
      const actor = makeActor('deer', 1.4);
      const x = herd.x + (rng() * 2 - 1) * 15;
      const z = herd.z + (rng() * 2 - 1) * 15;
      actor.group.position.set(x, game.world.heightAt(x, z), z);
      scene.add(actor.group);
      actor.play('Idle');
      const deer = { actor, home: { x, z }, target: null, wait: rng() * 4, state: 'graze' };
      registerTarget(actor.group, () => deerShot(deer));
      // CONTRACT: writer of game.entities.deer
      game.entities.deer.push(deer);
    }
  }
}

// ─── Snakes ──────────────────────────────────────────────────────────────────

function snakeShot(snake) {
  unregisterTarget(snake.actor.group);
  game.scene.remove(snake.actor.group);
  snake.state = 'dead';
}

function spawnSnakes(scene) {
  let placed = 0;
  for (let t = 0; t < 2000 && placed < A.SNAKES; t++) {
    const x = (rng() * 2 - 1) * 500;
    const z = (rng() * 2 - 1) * 500;
    // rocky/dry spots
    if (!(slopeAt(x, z) > 0.4 || moistureAt(x, z) < 0.35)) continue;
    if (distToRiver(x, z) < 15) continue;
    const actor = makeActor('snake', 0.35);
    actor.group.position.set(x, game.world.heightAt(x, z), z);
    scene.add(actor.group);
    const snake = { actor, state: 'idle', cooldown: 0 };
    registerTarget(actor.group, () => snakeShot(snake));
    // CONTRACT: writer of game.entities.snakes
    game.entities.snakes.push(snake);
    placed++;
  }
}

function updateSnakes(dt) {
  for (const snake of game.entities.snakes) {
    if (snake.state === 'dead') continue;
    snake.actor.tick(dt);
    snake.cooldown -= dt;
    if (snake.cooldown <= 0 && distToPlayer(snake.actor) < A.SNAKE_STRIKE_R) {
      snake.cooldown = A.SNAKE_COOLDOWN;
      snake.actor.play('Attack', 0.1);
      // CONTRACT: writer of game.player.health / game.flags.damageFlash
      game.player.health = Math.max(0, game.player.health - A.SNAKE_POISON);
      game.flags.damageFlash = 0.45;
    }
  }
}

// ─── Eagles ──────────────────────────────────────────────────────────────────

function spawnEagles(scene) {
  for (let i = 0; i < A.EAGLES; i++) {
    const actor = makeActor('eagle', 0.6);
    const cx = (rng() * 2 - 1) * 350;
    const cz = (rng() * 2 - 1) * 350;
    scene.add(actor.group);
    // CONTRACT: writer of game.entities.eagles
    game.entities.eagles.push({
      actor, cx, cz, angle: rng() * Math.PI * 2,
      alt: game.world.heightAt(cx, cz) + A.EAGLE_ALT + rng() * 20,
    });
  }
}

function updateEagles(dt) {
  for (const eagle of game.entities.eagles) {
    eagle.angle += A.EAGLE_SPEED * dt;
    const g = eagle.actor.group;
    g.position.set(
      eagle.cx + Math.cos(eagle.angle) * A.EAGLE_R,
      eagle.alt + Math.sin(eagle.angle * 2.3) * 4,
      eagle.cz + Math.sin(eagle.angle) * A.EAGLE_R,
    );
    g.rotation.set(0, -eagle.angle, 0.3); // banked into the circle
    eagle.actor.tick(dt);
  }
}

// ─── Carcass pickup ([E]) ────────────────────────────────────────────────────

function tryPickup() {
  const p = game.player;
  if (p.carrying) return;
  const carcasses = game.entities.carcasses;
  for (let i = 0; i < carcasses.length; i++) {
    const c = carcasses[i];
    if (Math.hypot(c.position.x - p.position.x, c.position.z - p.position.z) < A.PICKUP_DIST) {
      // CONTRACT: writer of game.player.carrying
      p.carrying = 'deer';
      game.scene.remove(c.mesh);
      carcasses.splice(i, 1);
      return;
    }
  }
}

/**
 * Spawns all fauna and registers the arrays in game.entities.
 * @param {object} scene THREE.Scene
 */
export function spawnAnimals(scene) {
  rng = mulberry32(WORLD.SEED + 2024);
  spawnDeerHerds(scene);
  spawnSnakes(scene);
  spawnEagles(scene);
  onPress('interact', tryPickup);
}

/** Per-frame fauna update. @param {number} dt seconds */
export function updateAnimals(dt) {
  for (const deer of game.entities.deer) updateDeer(deer, dt);
  updateSnakes(dt);
  updateEagles(dt);
}
