// actors.js — Shared helpers for walking NPC/creature actors: GLB/procedural
// model with a clip-crossfade helper, and terrain-following movement.
// Exports: makeActor, moveToward, distToPlayer. Used by towns/villages/animals/bandits.

import * as THREE from '../../vendor/three.module.min.js';
import { game } from './state.js';
import { spawn, getModel, fitHeight } from './assets.js';

/**
 * Creates a positioned actor: { group, model, mixer, play(fragment), tick(dt) }.
 * `play` crossfades to the first clip whose name contains `fragment`.
 * @param {string} key asset key @param {number} height m
 */
export function makeActor(key, height) {
  const entry = getModel(key);
  const group = new THREE.Group();
  const model = fitHeight(spawn(key), height);
  if (!entry) model.rotation.y = -Math.PI / 2; // procedural fallbacks face +X -> +Z
  group.add(model);
  let mixer = null;
  if (entry && entry.animations.length) mixer = new THREE.AnimationMixer(model);
  const actor = { group, model, mixer, entry, current: null };
  actor.play = (fragment, fade = 0.25, timeScale = 1) => {
    if (!mixer) return;
    const f = fragment.toLowerCase();
    const norm = (c) => c.name.split('|').pop().toLowerCase();
    const clip = entry.animations.find((c) => norm(c) === f) ||
                 entry.animations.find((c) => norm(c).includes(f));
    if (!clip) return;
    const next = mixer.clipAction(clip);
    if (actor.current === next) { next.timeScale = timeScale; return; }
    next.reset().fadeIn(fade).play();
    next.timeScale = timeScale;
    if (actor.current) actor.current.fadeOut(fade);
    actor.current = next;
  };
  actor.tick = (dt) => { if (mixer) mixer.update(dt); };
  return actor;
}

/**
 * Moves an actor toward (tx, tz) at `speed`, terrain-clamped, smoothly turning.
 * @returns {boolean} true when arrived (within 0.5 m)
 */
export function moveToward(actor, tx, tz, speed, dt, turnRate = 6) {
  const g = actor.group;
  const dx = tx - g.position.x, dz = tz - g.position.z;
  const d = Math.hypot(dx, dz);
  if (d < 0.5) return true;
  const targetYaw = Math.atan2(dx, dz);
  let dy = targetYaw - g.rotation.y;
  while (dy > Math.PI) dy -= 2 * Math.PI;
  while (dy < -Math.PI) dy += 2 * Math.PI;
  g.rotation.y += dy * Math.min(1, turnRate * dt);
  const step = Math.min(d, speed * dt);
  g.position.x += Math.sin(g.rotation.y) * step;
  g.position.z += Math.cos(g.rotation.y) * step;
  const deck = game.world.bridgeAt(g.position.x, g.position.z);
  g.position.y = deck !== null ? deck : game.world.heightAt(g.position.x, g.position.z);
  return false;
}

/** Horizontal distance from the actor to the player. */
export function distToPlayer(actor) {
  const p = game.player.position;
  return Math.hypot(actor.group.position.x - p.x, actor.group.position.z - p.z);
}
