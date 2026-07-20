// collision.js — Static cylinder colliders (rocks, tree trunks, buildings,
// teepees, props) in a 64 m spatial hash, with push-out + slide resolution for
// the horse. Exports: registerCollider, resolveCollision, colliderCount.
// To tune radii, edit COLLISION in config.js.

import { COLLISION, WORLD } from './config.js';
import { game } from './state.js';

const CELL = COLLISION.CELL_SIZE;
const hash = new Map(); // cellKey -> collider[]
let count = 0;

// Test/debug surface on the single source of truth (window.game.world)
game.world.colliderCount = () => count;
game.world.nearestCollider = (x, z) => nearestCollider(x, z);

function cellKey(x, z) {
  return Math.floor((x + WORLD.HALF) / CELL) * 4096 + Math.floor((z + WORLD.HALF) / CELL);
}

/**
 * Registers a static vertical cylinder.
 * @param {number} x world X @param {number} z world Z
 * @param {number} radius m @param {number} topY absolute top of the cylinder
 *        (Infinity for trees/buildings — jumping never clears them)
 */
export function registerCollider(x, z, radius, topY = Infinity) {
  const c = { x, z, r: radius, topY };
  const k = cellKey(x, z);
  if (!hash.has(k)) hash.set(k, []);
  hash.get(k).push(c);
  count++;
  return c;
}

export function colliderCount() {
  return count;
}

/**
 * Resolves a mover circle against nearby colliders: pushes out along the
 * penetration normal (repeated per collider — the tangential component of the
 * correction produces a natural slide, never a hard stop, never penetration).
 * @param {{x: number, y: number, z: number}} pos mover position (feet)
 * @param {number} radius mover radius
 * @param {boolean} airborne true while jumping — colliders whose top is below
 *        the mover are skipped (jumping over rocks); grounded movers always
 *        resolve (an uphill approach must never skip a rock)
 * @returns {boolean} true if any correction was applied
 */
export function resolveCollision(pos, radius, airborne = false) {
  const cx = Math.floor((pos.x + WORLD.HALF) / CELL);
  const cz = Math.floor((pos.z + WORLD.HALF) / CELL);
  let hit = false;
  for (let pass = 0; pass < 2; pass++) { // 2nd pass: multi-collider ordering
    for (let dz = -1; dz <= 1; dz++) {
      for (let dx = -1; dx <= 1; dx++) {
        const bucket = hash.get((cx + dx) * 4096 + (cz + dz));
        if (!bucket) continue;
        for (const c of bucket) {
          // Airborne above the collider top (jumping over rocks): skip
          if (airborne && pos.y > c.topY - 0.2) continue;
          const ddx = pos.x - c.x;
          const ddz = pos.z - c.z;
          const d = Math.hypot(ddx, ddz);
          const pen = c.r + radius - d;
          if (pen <= 0) continue;
          hit = true;
          if (d > 1e-4) {
            pos.x += (ddx / d) * pen;
            pos.z += (ddz / d) * pen;
          } else {
            pos.x += pen; // dead center: push along +X
          }
        }
      }
    }
  }
  return hit;
}

/** Debug/test accessor: nearest collider to a point (or null). */
export function nearestCollider(x, z) {
  const cx = Math.floor((x + WORLD.HALF) / CELL);
  const cz = Math.floor((z + WORLD.HALF) / CELL);
  let best = null, bestD = Infinity;
  for (let dz = -1; dz <= 1; dz++) {
    for (let dx = -1; dx <= 1; dx++) {
      const bucket = hash.get((cx + dx) * 4096 + (cz + dz));
      if (!bucket) continue;
      for (const c of bucket) {
        const d = Math.hypot(x - c.x, z - c.z);
        if (d < bestD) { bestD = d; best = c; }
      }
    }
  }
  return best;
}
