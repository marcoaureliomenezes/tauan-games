// weapons-core.js — pure helpers for Aero Fighters weapon decisions (Node-safe, no
// DOM/THREE). Mirrors physics-core.js's purity discipline (D-2): the hit-roll and rod
// target-selection/chain logic live here so the Node sim tests validate them directly.
// Consumed by projectiles.js (guided-missile hit rule) and rod-missiles.js (rod chain).

/** Deterministic probability a guided (light/heavy) missile launch resolves to HIT.
 * D-1: fixed at 0.80, independent of launch range — callers must never fold distance
 * into this roll. */
export const HIT_PROBABILITY = 0.80;

/** Rolls the deterministic hit/miss outcome for one missile launch.
 * @param {{ random: () => number }} rng - seeded RNG (game.rng), random() in [0,1)
 * @param {number} [p=HIT_PROBABILITY] - hit probability (defaults to the D-1 constant)
 * @returns {boolean} true = HIT, false = MISS
 */
export function rollMissileHit(rng, p = HIT_PROBABILITY) {
  return rng.random() < p;
}

/** Squared distance between a target-like object and an origin point. Accepts either
 * a raw {x,y,z} point or a target wrapper carrying `.mesh.position`. */
function distanceSquared(a, b) {
  const dx = a.x - b.x;
  const dy = (a.y ?? 0) - (b.y ?? 0);
  const dz = a.z - b.z;
  return dx * dx + dy * dy + dz * dz;
}

function positionOf(target) {
  return target.mesh ? target.mesh.position : target;
}

/** Selects up to `max` valid (non-dead) targets within `actionRadius` of `origin`,
 * ordered nearest-first. Pure — never mutates `targets`. D-3: used by the rod
 * kinetic weapon's pierce chain, radius = MISSILES_NUCLEAR.BLAST_RADIUS.
 * @param {Array<{dead?: boolean, mesh?: {position: {x:number,y:number,z:number}}, x?: number, y?: number, z?: number}>} targets
 * @param {{x:number,y:number,z:number}} origin
 * @param {number} actionRadius
 * @param {number} [max=3]
 * @returns {Array} ordered subset of `targets`, nearest-first, length <= max
 */
export function selectRodTargets(targets, origin, actionRadius, max = 3) {
  const r2 = actionRadius * actionRadius;
  const candidates = [];
  for (const t of targets) {
    if (!t || t.dead) continue;
    const pos = positionOf(t);
    const d2 = distanceSquared(pos, origin);
    if (d2 > r2) continue;
    candidates.push({ t, d2 });
  }
  candidates.sort((a, b) => a.d2 - b.d2);
  return candidates.slice(0, Math.max(0, max)).map((c) => c.t);
}
