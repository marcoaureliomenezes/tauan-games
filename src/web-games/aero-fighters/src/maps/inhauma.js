// maps/inhauma.js — Mapa 4: Inhauma-MG (REALISTA).
// Wiring fino sobre inhauma-scene.js: relevo contínuo + rio/represa/lago + usina
// nuclear + fábricas + florestas + estradas com carros + cidade.
// Exporta: createInhaumaWorld, updateInhaumaWorld, inhaumaHeightAt.

import * as THREE from '../../../../../vendor/three.module.min.js';
import { game } from '../state.js';
import { inhaumaAirport } from '../airport.js';
import { addSmokeEmitter } from '../factory-fx.js';
import {
  INHAUMA_FEATURES, WATER_LEVEL,
  inhaumaContinuousHeight, inhaumaHeightAt,
  buildInhaumaTerrain, buildInhaumaWater, buildDam, buildNuclearPlant,
  buildFactories, buildForests, buildTown, updateInhaumaScene,
} from './inhauma-scene.js';
import { INHAUMA_ROADS } from './inhauma-roads.js';
import { getRoadGraphDiagnostics } from './inhauma-road-diagnostics.js';
import { buildInhaumaRoadGraphAndTraffic } from './inhauma-road-render.js';

export { inhaumaHeightAt, inhaumaContinuousHeight };

// Diagnostics (fidelidade do mapa) — cidades, marcos, estradas, regiões nomeadas.
export const INHAUMA_CITIES = [
  { id: 'inhauma', x: 0, z: 0, radius: 260, role: 'focus' },
  { id: 'cachoeira-da-prata', x: -940, z: 520, radius: 170, role: 'west-town' },
  { id: 'sete-lagoas', x: 1250, z: -420, radius: 360, role: 'regional-city' },
];

// Coordinates below MUST track the real geometry in inhauma-scene.js — this list is
// diagnostics-only metadata (read by inhauma-fidelity.spec.js / uplift.spec.js and
// game.missionRealism.inhaumaMap), decoupled from rendering, so nothing re-derives it
// automatically when a task relocates a structure.
//
// T-09 (aero-fighters-inhauma-serra-v1) relocated buildTown's church/plaza/football
// fields from the flat origin grid onto the terraced valley shelf, and retired the
// DAM/RESERVOIR (see the DAM/RESERVOIR deviation note in inhauma-scene.js) — this
// array still held the PRE-T-09 positions plus the now-nonexistent dam. Fixed
// (2026-07-15, fix-forward on the T-10 QA blocker) against the live CHURCH/
// CHURCH_TOWER/FIELDS/PLAZA constants in inhauma-scene.js#buildTown, verified with a
// Node probe of inhaumaStructureInfoAt at each coordinate (church now correctly hits
// its registered 'igreja-inhauma' structure; the decorative field/plaza points land
// on dry, non-flooded terrain, matching how buildTown places them). 'represa-inhauma'
// is removed outright (not just repositioned): T-09 retired buildDam to a clean
// no-op with no geometry and no registered collision AABB, so a landmark describing a
// 46 m dam that no longer exists would be actively wrong metadata, not just stale
// coordinates.
export const INHAUMA_LANDMARKS = [
  { id: 'igreja-inhauma', kind: 'church', x: -330, z: -40, radius: 34, height: 30 },
  { id: 'campo-inhauma', kind: 'football-field', x: -410, z: -60, radius: 58, height: 1 },
  { id: 'area-lazer-manga', kind: 'park', x: -250, z: -40, radius: 64, height: 1 },
  { id: 'praca-central-inhauma', kind: 'square', x: -390, z: 0, radius: 42, height: 1 },
  { id: 'usina-nuclear-inhauma', kind: 'nuclear-plant', x: 620, z: 640, radius: 140, height: 70 },
  { id: 'aerodromo-inhauma', kind: 'airfield', x: inhaumaAirport.runway.center.x, z: inhaumaAirport.runway.center.z, radius: 340, height: 0 },
  { id: 'cachoeira-da-prata', kind: 'town', x: -940, z: 520, radius: 170, height: 0 },
  { id: 'sete-lagoas', kind: 'city', x: 1250, z: -420, radius: 360, height: 0 },
];

let _refs = null;

export function createInhaumaWorld(scene) {
  scene.fog = new THREE.Fog(0xb6d0c4, 900, 2600);

  const terrain = buildInhaumaTerrain(scene); // relevo infinito visual + região virtual de colisão
  const water = buildInhaumaWater(scene);
  buildDam(scene);
  const nuclear = buildNuclearPlant(scene);
  const factories = buildFactories(scene);
  buildForests(scene);
  const cars = buildInhaumaRoadGraphAndTraffic(scene, inhaumaContinuousHeight);
  buildTown(scene);

  // Vapor das torres de resfriamento + fumaça das chaminés (emissores contínuos).
  const steamOwner = { isInhaumaSteam: true };
  for (const e of nuclear.steamEmitters) addSmokeEmitter(e.x, e.y, e.z, steamOwner);
  for (const e of factories.smoke) addSmokeEmitter(e.x, e.y, e.z, steamOwner);

  _refs = { terrain, water, cars };

  game.missionRealism.inhaumaMap = {
    cities: INHAUMA_CITIES,
    roads: INHAUMA_ROADS,
    roadGraph: getRoadGraphDiagnostics(inhaumaContinuousHeight),
    traffic: {
      carCount: cars.cars.length,
      routeCount: cars.routes.length,
      graphRouteSegments: cars.routes.reduce((sum, route) => sum + (route.graphEdgeCount || 0), 0),
      routes: cars.routes.map((route) => ({
        id: route.id,
        length: Math.round(route.length),
        width: route.width,
        graphEdgeCount: route.graphEdgeCount || 0,
        classRank: route.classRank || 0,
      })),
    },
    landmarks: INHAUMA_LANDMARKS,
    terrainRegions: INHAUMA_FEATURES,
    waterLevel: WATER_LEVEL,
  };
}

export function updateInhaumaWorld(dt, playerPos) {
  if (_refs) updateInhaumaScene(dt, _refs, playerPos);
}
