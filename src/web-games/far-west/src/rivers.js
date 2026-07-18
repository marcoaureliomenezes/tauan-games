// rivers.js — Two deterministic rivers carved as descending channels from the
// mountains to one lake: polyline tracing, monotonic bed profile, ford/deep
// classification, carve rasterization into the height grid, proximity queries.
// Exports: initRivers, rasterizeCarve, getRivers, getLake, getFords, distToRiver,
// waterInfoAt. To change river layout, edit RIVER in config.js.

import { RIVER, WORLD } from './config.js';
import { getNoise2D } from './noise.js';
import { baseHeightAt, heightAt } from './heightfield.js';

const HASH_CELL = 32; // m — spatial hash cell for proximity queries

let rivers = [];  // [{ points:[{x,z}], bed:[], water:[], ford:[], width }]
let lake = null;  // { x, z, radius, level, bed }
let fords = [];   // [{ x, z, radius, depth }]
let pointHash = null; // Map<int, Array<{x, z, river, seg}>>

function clamp01(v) { return Math.min(1, Math.max(0, v)); }

function smoothstep(a, b, x) {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
}

/** Traces one river downhill from its spring to the lake, with noise meander. */
function traceRiver(start, seedOffset) {
  const n = getNoise2D();
  const pts = [];
  let x = start.x, z = start.z;
  for (let i = 0; i < RIVER.MAX_STEPS; i++) {
    pts.push({ x, z });
    const dx = RIVER.LAKE.x - x, dz = RIVER.LAKE.z - z;
    if (Math.hypot(dx, dz) < RIVER.LAKE_RADIUS * 0.6) break;
    const baseAng = Math.atan2(dz, dx);
    const ang = baseAng + n(x * 0.004 + seedOffset, z * 0.004 - seedOffset) * RIVER.MEANDER;
    const bound = WORLD.HALF - RIVER.BANK_WIDTH - 4;
    x = Math.max(-bound, Math.min(bound, x + Math.cos(ang) * RIVER.STEP));
    z = Math.max(-bound, Math.min(bound, z + Math.sin(ang) * RIVER.STEP));
  }
  // Monotonic descending bed, always below the (uncarved) terrain surface.
  const bed = [], water = [], ford = [];
  let prev = Infinity;
  for (let i = 0; i < pts.length; i++) {
    const isFord = ((i * RIVER.STEP) % RIVER.FORD_EVERY) < RIVER.FORD_LEN;
    const depth = isFord ? RIVER.FORD_DEPTH : RIVER.DEEP_DEPTH;
    const b = Math.min(prev - RIVER.MIN_DOWNGRADE, baseHeightAt(pts[i].x, pts[i].z) - depth - 0.6);
    prev = b;
    bed.push(b);
    water.push(b + depth * RIVER.WATER_FILL);
    ford.push(isFord);
    if (isFord) fords.push({ x: pts[i].x, z: pts[i].z, radius: RIVER.HALF_WIDTH + 4, depth });
  }
  return { points: pts, bed, water, ford, width: RIVER.HALF_WIDTH * 2 };
}

function hashKey(x, z) {
  return (Math.floor((x + WORLD.HALF) / HASH_CELL) * 4096 +
          Math.floor((z + WORLD.HALF) / HASH_CELL));
}

/** Generates both rivers, the lake, fords and the spatial hash. Idempotent. */
export function initRivers() {
  rivers = [];
  fords = [];
  pointHash = new Map();
  for (let r = 0; r < RIVER.COUNT; r++) {
    rivers.push(traceRiver(RIVER.STARTS[r], r * 53.7));
  }
  // Lake level = lowest river-mouth water level; bed sunk below it
  const level = Math.min(...rivers.map((rv) => rv.water[rv.water.length - 1]));
  lake = { x: RIVER.LAKE.x, z: RIVER.LAKE.z, radius: RIVER.LAKE_RADIUS, level, bed: level - RIVER.LAKE_DEPTH };
  for (let r = 0; r < rivers.length; r++) {
    rivers[r].points.forEach((p, seg) => {
      const k = hashKey(p.x, p.z);
      if (!pointHash.has(k)) pointHash.set(k, []);
      pointHash.get(k).push({ x: p.x, z: p.z, river: r, seg });
    });
  }
}

/**
 * Carves the river channels and the lake bowl into the height grid, BEFORE the
 * chunk meshes are built — heightAt() therefore stays exact over carved terrain.
 * @param {Float32Array} grid @param {number} side @param {number} step @param {number} half
 */
export function rasterizeCarve(grid, side, step, half) {
  const R = RIVER.BANK_WIDTH;
  for (const rv of rivers) {
    const pts = rv.points;
    for (let s = 0; s < pts.length - 1; s++) {
      const p0 = pts[s], p1 = pts[s + 1];
      const dx = p1.x - p0.x, dz = p1.z - p0.z;
      const L2 = dx * dx + dz * dz;
      const ix0 = Math.max(0, Math.floor((Math.min(p0.x, p1.x) - R + half) / step));
      const ix1 = Math.min(side - 1, Math.ceil((Math.max(p0.x, p1.x) + R + half) / step));
      const iz0 = Math.max(0, Math.floor((Math.min(p0.z, p1.z) - R + half) / step));
      const iz1 = Math.min(side - 1, Math.ceil((Math.max(p0.z, p1.z) + R + half) / step));
      for (let iz = iz0; iz <= iz1; iz++) {
        const z = -half + iz * step;
        for (let ix = ix0; ix <= ix1; ix++) {
          const x = -half + ix * step;
          let t = L2 > 0 ? ((x - p0.x) * dx + (z - p0.z) * dz) / L2 : 0;
          t = clamp01(t);
          const d = Math.hypot(x - (p0.x + dx * t), z - (p0.z + dz * t));
          if (d >= R) continue;
          const bed = rv.bed[s] + (rv.bed[s + 1] - rv.bed[s]) * t;
          const v = d / RIVER.HALF_WIDTH;
          const carved = bed + Math.min(2.0, v * v * 1.6); // V-shaped channel bottom
          const blend = smoothstep(RIVER.HALF_WIDTH, R, d);
          const idx = iz * side + ix;
          const nv = carved * (1 - blend) + grid[idx] * blend;
          if (nv < grid[idx]) grid[idx] = nv;
        }
      }
    }
  }
  // Lake bowl
  const lr = lake.radius + RIVER.BANK_WIDTH;
  const ix0 = Math.max(0, Math.floor((lake.x - lr + half) / step));
  const ix1 = Math.min(side - 1, Math.ceil((lake.x + lr + half) / step));
  const iz0 = Math.max(0, Math.floor((lake.z - lr + half) / step));
  const iz1 = Math.min(side - 1, Math.ceil((lake.z + lr + half) / step));
  for (let iz = iz0; iz <= iz1; iz++) {
    const z = -half + iz * step;
    for (let ix = ix0; ix <= ix1; ix++) {
      const x = -half + ix * step;
      const d = Math.hypot(x - lake.x, z - lake.z);
      if (d >= lr) continue;
      const blend = smoothstep(lake.radius * 0.55, lr, d);
      const idx = iz * side + ix;
      const nv = lake.bed * (1 - blend) + grid[idx] * blend;
      if (nv < grid[idx]) grid[idx] = nv;
    }
  }
}

/** Nearest river-polyline point within the 3x3 hash neighborhood, or null. */
function nearestRiverPoint(x, z) {
  const cx = Math.floor((x + WORLD.HALF) / HASH_CELL);
  const cz = Math.floor((z + WORLD.HALF) / HASH_CELL);
  let best = null, bestD = Infinity;
  for (let dz = -1; dz <= 1; dz++) {
    for (let dx = -1; dx <= 1; dx++) {
      const bucket = pointHash.get((cx + dx) * 4096 + (cz + dz));
      if (!bucket) continue;
      for (const p of bucket) {
        const d = Math.hypot(x - p.x, z - p.z);
        if (d < bestD) { bestD = d; best = p; }
      }
    }
  }
  return best ? { ...best, dist: bestD } : null;
}

/** Approximate distance (m) to the nearest river centerline. Infinity if far. */
export function distToRiver(x, z) {
  const p = nearestRiverPoint(x, z);
  return p ? p.dist : Infinity;
}

/**
 * Water query for gameplay: null on dry land, otherwise the local water state.
 * `ford` is derived from the MEASURED depth (authoritative), not the stretch
 * designation — meander overlaps can locally deepen a designated ford stretch.
 * @returns {{depth: number, ford: boolean, waterLevel: number, river: number} | null}
 */
export function waterInfoAt(x, z) {
  const p = nearestRiverPoint(x, z);
  if (p && p.dist < RIVER.HALF_WIDTH) {
    const rv = rivers[p.river];
    const waterLevel = rv.water[p.seg];
    const depth = waterLevel - heightAt(x, z);
    if (depth > 0) return { depth, ford: depth <= RIVER.FORD_MAX, waterLevel, river: p.river };
  }
  const dl = Math.hypot(x - lake.x, z - lake.z);
  if (dl < lake.radius) {
    const depth = lake.level - heightAt(x, z);
    if (depth > 0) return { depth, ford: false, waterLevel: lake.level, river: -1 };
  }
  return null;
}

/**
 * Recomputes ford depths against the carved grid (call AFTER buildHeightGrid)
 * and drops "fords" that ended up too deep to cross.
 */
export function finalizeFords() {
  for (const f of fords) {
    const info = waterInfoAt(f.x, f.z);
    f.depth = info ? info.depth : 0;
  }
  fords = fords.filter((f) => f.depth > 0 && f.depth <= RIVER.FORD_MAX);
}

export function getRivers() { return rivers; }
export function getLake() { return lake; }
export function getFords() { return fords; }
