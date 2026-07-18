// heightfield.js — Analytic height function + sampled height grid + the heightAt/
// normalAt/slopeAt contract shared by every entity. Exports: baseHeightAt,
// buildHeightGrid, heightAt, normalAt, slopeAt, moistureAt, getGrid, GRID_SIDE.
// To change terrain shape, edit baseHeightAt() or TERRAIN in config.js.

import { WORLD, TERRAIN, BIOME } from './config.js';
import { getNoise2D, fbm2 } from './noise.js';

/** Grid resolution: (SIZE/STEP + 1)^2 samples covering the whole world. */
export const GRID_SIDE = WORLD.SIZE / WORLD.GRID_STEP + 1;

let grid = null; // Float32Array(GRID_SIDE^2), row-major [iz * GRID_SIDE + ix]

function smoothstep(a, b, x) {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

/**
 * Analytic terrain height BEFORE river carving: fBm hills + ridged mountains
 * masked towards the edges/north + a gentle central valley.
 * @param {number} x world X (m) @param {number} z world Z (m)
 */
export function baseHeightAt(x, z) {
  const T = TERRAIN;
  const n = getNoise2D();
  let h = fbm2(x * T.FBM_FREQ, z * T.FBM_FREQ, T.FBM_OCTAVES, T.FBM_LACUNARITY, T.FBM_GAIN) * T.FBM_AMP;
  const radial = Math.hypot(x, z) / WORLD.HALF;
  const north = Math.max(0, -z / WORLD.HALF) * T.MASK_NORTH_BIAS;
  const mask = smoothstep(T.MASK_START, T.MASK_END, radial + north);
  if (mask > 0) {
    // Ridged fBm: sharp crests where the mask is active
    let r = 0, amp = 1, freq = T.MOUNTAIN_FREQ, norm = 0;
    for (let o = 0; o < T.MOUNTAIN_OCTAVES; o++) {
      const v = 1 - Math.abs(n(x * freq + 31.7, z * freq - 17.3));
      r += v * v * amp;
      norm += amp;
      amp *= 0.5;
      freq *= 2.1;
    }
    h += (r / norm) * T.MOUNTAIN_AMP * mask;
  }
  // Gentle valley around the world center (lake basin area)
  const dCenter = Math.hypot(x, z);
  h *= 1 - T.VALLEY_FLATTEN * (1 - smoothstep(0, T.VALLEY_RADIUS, dCenter));
  return h;
}

/**
 * Fills the height grid from baseHeightAt, then applies the river carve pass.
 * @param {function(Float32Array, number, number, number): void} [rasterizeCarve]
 *        carve callback from rivers.js — (grid, side, step, half)
 */
export function buildHeightGrid(rasterizeCarve) {
  grid = new Float32Array(GRID_SIDE * GRID_SIDE);
  const step = WORLD.GRID_STEP, half = WORLD.HALF;
  for (let iz = 0; iz < GRID_SIDE; iz++) {
    const z = -half + iz * step;
    for (let ix = 0; ix < GRID_SIDE; ix++) {
      grid[iz * GRID_SIDE + ix] = baseHeightAt(-half + ix * step, z);
    }
  }
  if (rasterizeCarve) rasterizeCarve(grid, GRID_SIDE, step, half);
}

/** Raw grid accessor (chunk mesh builders sample the exact same nodes). */
export function getGrid() {
  return grid;
}

/**
 * Terrain height at any world point. Interpolates the grid with the SAME
 * triangle split (diagonal a-d) used by the chunk geometry, so the result
 * matches the rendered high-LOD mesh to floating-point precision.
 * @param {number} x world X (m) @param {number} z world Z (m) @returns {number} height (m)
 */
export function heightAt(x, z) {
  const step = WORLD.GRID_STEP, half = WORLD.HALF;
  const gx = (x + half) / step, gz = (z + half) / step;
  const ix = Math.max(0, Math.min(GRID_SIDE - 2, Math.floor(gx)));
  const iz = Math.max(0, Math.min(GRID_SIDE - 2, Math.floor(gz)));
  const fx = Math.min(1, Math.max(0, gx - ix));
  const fz = Math.min(1, Math.max(0, gz - iz));
  const i = iz * GRID_SIDE + ix;
  const ha = grid[i], hb = grid[i + 1], hc = grid[i + GRID_SIDE], hd = grid[i + GRID_SIDE + 1];
  // Triangles (a,b,d) and (a,d,c) — identical to terrain.js makeChunkGeometry.
  if (fx >= fz) return (1 - fx) * ha + (fx - fz) * hb + fz * hd;
  return (1 - fz) * ha + (fz - fx) * hc + fx * hd;
}

/**
 * Terrain normal at a world point (central differences over the grid).
 * @returns {{x: number, y: number, z: number}} unit normal
 */
export function normalAt(x, z) {
  const e = WORLD.GRID_STEP;
  const nx = heightAt(x - e, z) - heightAt(x + e, z);
  const nz = heightAt(x, z - e) - heightAt(x, z + e);
  const ny = 2 * e;
  const len = Math.hypot(nx, ny, nz);
  return { x: nx / len, y: ny / len, z: nz / len };
}

/** Gradient magnitude (rise/run) at a world point — 0 flat, 1 = 45 degrees. */
export function slopeAt(x, z) {
  const e = WORLD.GRID_STEP;
  const dx = (heightAt(x + e, z) - heightAt(x - e, z)) / (2 * e);
  const dz = (heightAt(x, z + e) - heightAt(x, z - e)) / (2 * e);
  return Math.hypot(dx, dz);
}

/** Moisture channel in [0, 1] (noise only; biome.js adds the river bonus). */
export function moistureAt(x, z) {
  const f = BIOME.MOISTURE_FREQ;
  return 0.5 + 0.5 * fbm2(x * f + 7.3, z * f - 3.1, 3, 2.0, 0.5);
}
