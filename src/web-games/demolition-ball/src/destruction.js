// Impact -> material damage -> structural collapse.
// The wrecking ball carries kinetic energy; energy is spent breaking cells
// nearest the contact point first, and whatever is spent is taken away from
// the ball. Once cells are gone, anything that lost its load path falls.

import { v3, vnorm, clamp } from './math.js';

const JOULES_TO_DAMAGE = 0.0075;
const MAX_COLLAPSE_CHUNKS = 240;

/**
 * @returns {{killed:number, spent:number, radius:number}}
 */
export function applyImpact(structure, point, energy, dir, debris, opts = {}) {
  const power = energy * JOULES_TO_DAMAGE;
  if (power <= 1) return { killed: 0, spent: 0, radius: 0 };

  const radius = clamp(1.4 + Math.sqrt(power) * 0.16, 1.4, 8.5);
  const cells = structure.cellsInSphere(point.x, point.y, point.z, radius);
  let budget = power;
  let killed = 0;
  const chunkColor = structure.color;
  const half = structure.cell * 0.5;

  for (const c of cells) {
    if (budget <= 0) break;
    // Falloff: the ball punches a cone, it does not vaporise a perfect sphere.
    const falloff = Math.pow(1 - c.d / (radius + 0.001), 1.35);
    const applied = Math.min(budget, structure.health[c.i] / Math.max(falloff, 0.12));
    const effective = applied * falloff;
    structure.health[c.i] -= effective;
    structure.damage[c.i] = clamp(structure.damage[c.i] + effective / 120, 0, 1);
    budget -= applied;

    if (structure.health[c.i] <= 0) {
      if (structure.kill(c.i)) {
        killed++;
        const centre = structure.cellCenter(c.x, c.y, c.z);
        const outward = vnorm(v3(centre.x - point.x + dir.x * 2, centre.y - point.y + 1.2, centre.z - point.z + dir.z * 2));
        const speed = 3 + Math.random() * 9;
        debris.spawnChunk(
          centre,
          v3(half * (0.3 + Math.random() * 0.35), half * (0.3 + Math.random() * 0.35), half * (0.3 + Math.random() * 0.35)),
          chunkColor,
          v3(outward.x * speed, outward.y * speed * 0.8 + 3, outward.z * speed),
          0.35 + Math.random() * 0.4,
        );
      }
    }
  }

  const spent = power - Math.max(budget, 0);

  if (killed > 0) {
    debris.spawnDust(point, Math.min(26, 6 + killed * 2), radius * 1.3, [0.72, 0.69, 0.63], radius * 0.5, 2.6);
    debris.spawnSparks(point, 6, dir);
    collapseUnsupported(structure, debris, opts);
  } else {
    debris.spawnDust(point, 4, 1.4, [0.72, 0.69, 0.63], 0.9, 1.4);
  }

  return { killed, spent: spent / JOULES_TO_DAMAGE, radius };
}

/** Detach and drop everything that no longer reaches the ground. */
export function collapseUnsupported(structure, debris, opts = {}) {
  const floating = structure.findUnsupported();
  if (!floating.length) return 0;
  let spawned = 0;
  for (const i of floating) {
    const { x, y, z } = structure.cellCoords(i);
    structure.kill(i);
    if (spawned < MAX_COLLAPSE_CHUNKS) {
      const centre = structure.cellCenter(x, y, z);
      const half = structure.cell * 0.5;
      debris.spawnChunk(
        centre,
        v3(half * 0.5, half * 0.55, half * 0.5),
        structure.color,
        v3((Math.random() - 0.5) * 3.5, -1 - Math.random() * 2, (Math.random() - 0.5) * 3.5),
        0.5,
      );
      spawned++;
    }
  }
  // A collapse throws a big cloud from the base of the affected volume.
  debris.spawnDust(
    v3(structure.center.x, Math.min(6, structure.size.y * 0.3), structure.center.z),
    Math.min(60, 14 + floating.length * 0.4),
    Math.max(structure.size.x, structure.size.z) * 0.8,
    [0.74, 0.71, 0.66],
    3.4,
    2.0,
  );
  if (opts.onCollapse) opts.onCollapse(structure, floating.length);
  return floating.length;
}
