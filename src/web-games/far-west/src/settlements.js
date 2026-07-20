// settlements.js — Deterministic site selection for the 2 towns, 2 villages and
// the camp. Terrain is analytic (no flattening): we simply search for naturally
// flat, dry spots. Exports: pickSites. To change placement rules, edit SETTLEMENTS
// in config.js.

import { WORLD, SETTLEMENTS, BIOME } from './config.js';
import { game } from './state.js';
import { slopeAt, moistureAt } from './heightfield.js';
import { distToRiver, getLake } from './rivers.js';
import { mulberry32 } from './noise.js';

const S = SETTLEMENTS;

function lakeDist(x, z) {
  const lake = getLake();
  return Math.hypot(x - lake.x, z - lake.z);
}

/** Base site validity: flat-ish, dry, inside the valley, away from water. */
function validBase(x, z, maxSlope = S.MAX_SLOPE) {
  if (Math.hypot(x, z) > 480) return false;
  if (slopeAt(x, z) > maxSlope) return false;
  if (distToRiver(x, z) < S.WATER_EXCLUDE) return false;
  if (lakeDist(x, z) < S.LAKE_EXCLUDE) return false;
  return true;
}

/** First rng point satisfying `accept`, or null after `tries` attempts. */
function findSpot(rng, accept, tries = 500) {
  for (let i = 0; i < tries; i++) {
    const x = (rng() * 2 - 1) * 460;
    const z = (rng() * 2 - 1) * 460;
    if (accept(x, z)) return { x, z };
  }
  return null;
}

function farFromAll(x, z, list, minDist) {
  return list.every((s) => Math.hypot(x - s.x, z - s.z) >= minDist);
}

/**
 * Picks all settlement sites deterministically (seeded).
 * @returns {{towns: Array, villages: Array, camp: object}}
 */
export function pickSites() {
  const rng = mulberry32(WORLD.SEED + 777);
  const spawn = game.world.spawn;

  const towns = [];
  for (let n = 0; n < 2; n++) {
    const spot = findSpot(rng, (x, z) =>
      validBase(x, z) && farFromAll(x, z, towns, S.TOWN_MIN_DIST));
    towns.push({ x: spot.x, z: spot.z, radius: S.TOWN_RADIUS, yaw: rng() * Math.PI * 2 });
  }

  const villages = [];
  for (let n = 0; n < 2; n++) {
    const spot = findSpot(rng, (x, z) =>
      validBase(x, z, S.MAX_SLOPE + 0.1) &&
      moistureAt(x, z) > 0.42 && // forested edge
      farFromAll(x, z, towns, S.VILLAGE_TOWN_DIST) &&
      farFromAll(x, z, villages, S.VILLAGE_MIN_DIST));
    villages.push({ x: spot.x, z: spot.z, radius: S.VILLAGE_RADIUS, yaw: rng() * Math.PI * 2 });
  }

  // Camp: first dry flat-ish spot on a ring around spawn
  let camp = null;
  for (let r = 18; r < S.CAMP_SPAWN_DIST && !camp; r += 8) {
    for (let a = 0; a < Math.PI * 2 && !camp; a += 0.4) {
      const x = spawn.x + Math.cos(a) * r;
      const z = spawn.z + Math.sin(a) * r;
      if (slopeAt(x, z) < 0.3 && distToRiver(x, z) > 25 && lakeDist(x, z) > S.LAKE_EXCLUDE * 0.5) {
        camp = { x, z, radius: S.CAMP_RADIUS };
      }
    }
  }
  if (!camp) camp = { x: spawn.x + 20, z: spawn.z + 20, radius: S.CAMP_RADIUS };

  return { towns, villages, camp };
}
