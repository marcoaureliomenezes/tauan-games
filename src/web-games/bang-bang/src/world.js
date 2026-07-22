// world.js — buildWorld(game): orchestrates noise -> rivers -> heightfield ->
// terrain -> water -> sky -> vegetation and fills game.world with the shared
// contracts. Exports: buildWorld, updateWorld. To add a world system, build it
// here and register its refs in game.world.

import { WORLD, PLAYER } from './config.js';
import { game } from './state.js';
import { initNoise } from './noise.js';
import { buildHeightGrid, heightAt, normalAt, slopeAt } from './heightfield.js';
import { initRivers, rasterizeCarve, finalizeFords, getRivers, getLake, getFords, waterInfoAt } from './rivers.js';
import { buildTerrain, updateTerrainLOD, getChunks } from './terrain.js';
import { buildWater, updateWater, bridgeAt, getBridges } from './water.js';
import { initSky, updateSky } from './sky.js';
import { buildVegetation, updateVegetation, biomeAt } from './vegetation.js';

/** First candidate with gentle slope, dry feet and low altitude wins. */
function pickSpawn() {
  for (const c of PLAYER.SPAWN_CANDIDATES) {
    if (slopeAt(c.x, c.z) < 0.3 && !waterInfoAt(c.x, c.z) && heightAt(c.x, c.z) < 30) {
      return { x: c.x, z: c.z, y: heightAt(c.x, c.z) };
    }
  }
  return { x: 0, z: 400, y: heightAt(0, 400) };
}

/**
 * Builds the whole world deterministically (fixed seed) and registers every
 * shared contract on game.world.
 * @param {object} game live state (window.game)
 * @returns {Promise<{x: number, z: number, y: number}>} spawn point in the valley
 */
export async function buildWorld(game) {
  const noiseSource = await initNoise(WORLD.SEED);
  initRivers();                       // traces channels over the BASE heightfield
  buildHeightGrid(rasterizeCarve);    // grid + carve (before any mesh: stays exact)
  const chunks = buildTerrain(game.scene);
  buildWater(game.scene);
  initSky(game.scene);
  finalizeFords();                    // measured depths now that the grid is carved
  const vegetation = buildVegetation(game.scene);
  const spawn = pickSpawn();

  // CONTRACT: writer of game.world
  Object.assign(game.world, {
    chunks,
    heightAt,
    normalAt,
    slopeAt,
    bridgeAt,
    biomeAt,
    waterInfoAt,
    rivers: getRivers(),
    lake: getLake(),
    fords: getFords(),
    bridges: getBridges(),
    vegetation,
    noiseSource,
    spawn,
  });
  // CONTRACT: writer of game.player.position
  game.player.position.x = spawn.x;
  game.player.position.y = spawn.y;
  game.player.position.z = spawn.z;
  return spawn;
}

/** Per-frame world update: chunk LOD, water scroll, day/night cycle, grass tufts. */
export function updateWorld(dt, camPos) {
  updateTerrainLOD(camPos.x, camPos.z);
  updateWater(dt);
  updateSky(dt);
  updateVegetation(camPos);
}

/** Debug/test helper: visible terrain meshes (high LOD where built). */
export function getTerrainMeshes() {
  const out = [];
  for (const ch of getChunks()) {
    if (ch.high && ch.high.visible) out.push(ch.high);
    else if (ch.low.visible) out.push(ch.low);
  }
  return out;
}
