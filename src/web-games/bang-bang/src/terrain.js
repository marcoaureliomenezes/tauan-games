// terrain.js — 8x8 chunk meshes over the height grid: two LOD levels swapped by
// camera distance, splat-textured material (grass/dirt/rock/snow from splat.js),
// normals from the shared grid (no seams). Exports: buildTerrain, updateTerrainLOD,
// getChunks. To change texturing, edit splat.js; to change LOD, edit LOD in config.js.

import * as THREE from '../../vendor/three.module.min.js';
import { WORLD, LOD } from './config.js';
import { game } from './state.js';
import { heightAt, normalAt } from './heightfield.js';
import { makeTerrainMaterial } from './splat.js';

const chunks = [];
let sharedMaterial = null;
let terrainGroup = null;

/**
 * Builds one chunk geometry at the given vertex spacing. Vertices sample the SAME
 * grid nodes as heightAt, and cells use the SAME diagonal split (triangles
 * (a,b,d),(a,d,c)) — heightAt matches the high-LOD mesh exactly.
 */
function makeChunkGeometry(ix, iz, step) {
  const half = WORLD.HALF;
  const chunkSize = WORLD.CHUNK_SIZE;
  const x0 = -half + ix * chunkSize;
  const z0 = -half + iz * chunkSize;
  const cells = chunkSize / step;
  const side = cells + 1;
  const positions = new Float32Array(side * side * 3);
  const normals = new Float32Array(side * side * 3);
  for (let vz = 0; vz < side; vz++) {
    for (let vx = 0; vx < side; vx++) {
      const x = x0 + vx * step;
      const z = z0 + vz * step;
      const h = heightAt(x, z);
      const vi = (vz * side + vx) * 3;
      positions[vi] = x;
      positions[vi + 1] = h;
      positions[vi + 2] = z;
      const n = normalAt(x, z);
      normals[vi] = n.x; normals[vi + 1] = n.y; normals[vi + 2] = n.z;
    }
  }
  const indices = new Uint32Array(cells * cells * 6);
  let ii = 0;
  for (let cz = 0; cz < cells; cz++) {
    for (let cx = 0; cx < cells; cx++) {
      const a = cz * side + cx;
      const b = a + 1;
      const c = a + side;
      const d = c + 1;
      indices[ii++] = a; indices[ii++] = c; indices[ii++] = b;
      indices[ii++] = b; indices[ii++] = c; indices[ii++] = d;
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  geo.setIndex(new THREE.BufferAttribute(indices, 1));
  geo.computeBoundingSphere();
  return geo;
}

/** Winding note: heightAt splits cells as (a,b,d),(a,d,c); the index order above
 * uses (a,c,b),(b,c,d) — same triangles, CCW when viewed from +Y (up-facing). */

function makeChunkMesh(ix, iz, step) {
  const mesh = new THREE.Mesh(makeChunkGeometry(ix, iz, step), sharedMaterial);
  mesh.receiveShadow = true;
  mesh.matrixAutoUpdate = false;
  return mesh;
}

/**
 * Builds all 8x8 chunks (low LOD) and adds them to the scene.
 * @returns {Array} chunk records {ix, iz, cx, cz, low, high}
 */
export function buildTerrain(scene) {
  chunks.length = 0;
  sharedMaterial = makeTerrainMaterial();
  terrainGroup = new THREE.Group();
  terrainGroup.name = 'terrain';
  const count = WORLD.CHUNK_COUNT;
  for (let iz = 0; iz < count; iz++) {
    for (let ix = 0; ix < count; ix++) {
      const low = makeChunkMesh(ix, iz, LOD.LOW_STEP);
      terrainGroup.add(low);
      chunks.push({
        ix, iz,
        cx: -WORLD.HALF + (ix + 0.5) * WORLD.CHUNK_SIZE,
        cz: -WORLD.HALF + (iz + 0.5) * WORLD.CHUNK_SIZE,
        low, high: null,
      });
    }
  }
  scene.add(terrainGroup);
  return chunks;
}

/** Swaps chunk LOD by camera distance; high-LOD geometry is built lazily and cached.
 * In test mode (game.flags.testMode, headless software GL) high-LOD builds are
 * skipped entirely — they are multi-hundred-ms CPU spikes that stall input. */
export function updateTerrainLOD(camX, camZ) {
  if (game.flags.testMode) return;
  for (const ch of chunks) {
    const d = Math.hypot(camX - ch.cx, camZ - ch.cz);
    const wantHigh = d < LOD.HIGH_DIST;
    if (wantHigh && !ch.high) {
      ch.high = makeChunkMesh(ch.ix, ch.iz, WORLD.GRID_STEP);
      terrainGroup.add(ch.high);
    }
    if (ch.high) {
      ch.high.visible = wantHigh;
      ch.low.visible = !wantHigh;
    }
  }
}

export function getChunks() {
  return chunks;
}
