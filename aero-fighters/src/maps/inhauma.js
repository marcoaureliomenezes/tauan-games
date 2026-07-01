// maps/inhauma.js — Mapa 4: Inhauma-MG (REALISTA).
// Wiring fino sobre inhauma-scene.js: relevo contínuo + rio/represa/lago + usina
// nuclear + fábricas + florestas + estradas com carros + cidade.
// Exporta: createInhaumaWorld, updateInhaumaWorld, inhaumaHeightAt.

import * as THREE from '../../../vendor/three.module.min.js';
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

export const INHAUMA_LANDMARKS = [
  { id: 'igreja-inhauma', kind: 'church', x: 20, z: -40, radius: 34, height: 30 },
  { id: 'campo-inhauma', kind: 'football-field', x: -170, z: -90, radius: 58, height: 1 },
  { id: 'area-lazer-manga', kind: 'park', x: 200, z: 140, radius: 64, height: 1 },
  { id: 'praca-central-inhauma', kind: 'square', x: 45, z: 40, radius: 42, height: 1 },
  { id: 'usina-nuclear-inhauma', kind: 'nuclear-plant', x: 620, z: 640, radius: 140, height: 70 },
  { id: 'represa-inhauma', kind: 'dam', x: 320, z: 470, radius: 200, height: 46 },
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
