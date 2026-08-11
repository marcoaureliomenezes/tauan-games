// entities.js — Living-entity orchestrator: picks settlement sites and spawns/
// updates towns, villages, train, fauna, bandits and the camp.
// Exports: initEntities, updateEntities. To add an entity system, wire it here.

import { pickSites } from './settlements.js';
import { spawnTowns, updateTowns } from './towns.js';
import { spawnVillages, updateVillages } from './villages.js';
import { spawnTrain, updateTrain } from './train.js';
import { spawnAnimals, updateAnimals } from './animals.js';
import { spawnBandits, updateBandits } from './bandits.js';
import { spawnCamp, updateCamp } from './camp.js';

/**
 * Spawns every living entity. Call once after buildWorld + loadModels.
 * Order matters: camp/bandits read camp position; train avoids towns.
 * @param {THREE.Scene} scene
 */
export function initEntities(scene) {
  const sites = pickSites();
  spawnCamp(scene, sites.camp);
  spawnTowns(scene, sites.towns);
  spawnVillages(scene, sites.villages);
  spawnTrain(scene);
  spawnAnimals(scene);
  spawnBandits(scene);
}

/** Per-frame update for every entity system. @param {number} dt seconds */
export function updateEntities(dt) {
  updateCamp(dt);
  updateTowns(dt);
  updateVillages(dt);
  updateTrain(dt);
  updateAnimals(dt);
  updateBandits(dt);
}
