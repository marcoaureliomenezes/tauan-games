// maps/inhauma.js — Mapa 4: Inhauma-MG (REALISTA).
// Wiring fino sobre inhauma-scene.js: relevo contínuo + rio/represa/lago + usina
// nuclear + fábricas + florestas + estradas com carros + cidade.
// Exporta: createInhaumaWorld, updateInhaumaWorld, inhaumaHeightAt.

import * as THREE from '../../../vendor/three.module.min.js';
import { game } from '../state.js';
import { createRng } from '../rng.js';
import { inhaumaAirport } from '../airport.js';
import { addSmokeEmitter } from '../factory-fx.js';
import {
  INHAUMA_FEATURES, WATER_LEVEL, TOWN_SHELF, CACHOEIRA_SHELF,
  CACHOEIRA_TOWN_CENTER, CACHOEIRA_CHURCH, CACHOEIRA_PRACA,
  inhaumaContinuousHeight, inhaumaHeightAt, inhaumaVisualSurfaceHeight,
  buildInhaumaTerrain, buildInhaumaWater, buildDam, buildNuclearPlant,
  buildFactories, buildForests, buildTown, buildCachoeira, updateInhaumaScene,
} from './inhauma-scene.js';
import { getInhaumaRiverPolyline, RIVER_HALF_WIDTH_M } from './inhauma-river.js';
import { INHAUMA_AIRPORT_EXCLUSION_ZONES } from './inhauma-road-airport.js';
import { buildCachoeiraGarrison } from './inhauma-garrison.js';
import { initCampaign } from '../campaign.js';
import { initCityWar, setCityWarHooks } from '../city-war.js';
import { explosion, spawnMuzzleFlash, spawnScorchMark, spawnMissileSmoke } from '../fx.js';
import { spawnPropFire } from '../prop-fire.js';
import { removeSmokeEmittersOf } from '../factory-fx.js';
import { audio } from '../audio.js';
import { COLORS } from '../config.js';
import { INHAUMA_ROADS } from './inhauma-roads.js';
import { getRoadGraphDiagnostics } from './inhauma-road-diagnostics.js';
import { buildInhaumaRoadGraphAndTraffic } from './inhauma-road-render.js';

export { inhaumaHeightAt, inhaumaContinuousHeight };

// Diagnostics (fidelidade do mapa) — cidades, marcos, estradas, regiões nomeadas.
// T-C-04 (inhauma-campaign-v1): Cachoeira da Prata existe DE VERDADE agora — as
// coordenadas vêm das MESMAS constantes que constroem a cidade (inhauma-scene.js),
// eliminando a classe de drift metadata↔geometria (ver o comentário histórico abaixo).
export const INHAUMA_CITIES = [
  { id: 'inhauma', x: 0, z: 0, radius: 260, role: 'focus' },
  { id: 'cachoeira-da-prata', x: CACHOEIRA_TOWN_CENTER.x, z: CACHOEIRA_TOWN_CENTER.z, radius: 170, role: 'west-town' },
  { id: 'sete-lagoas', x: 1250, z: -420, radius: 360, role: 'regional-city' },
];

// Coordinates below MUST track the real geometry in inhauma-scene.js — this list is
// diagnostics-only metadata (read by inhauma-fidelity.spec.js / uplift.spec.js and
// game.missionRealism.inhaumaMap), decoupled from rendering, so nothing re-derives it
// automatically when a task relocates a structure.
//
// T-09 (v0.2.11) relocated buildTown's church/plaza/football
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
  // T-C-04: Cachoeira construída — centro/marcos sincronizados por constante
  // compartilhada com o builder (igrejinha + praça miúdas, equivalentes locais).
  { id: 'cachoeira-da-prata', kind: 'town', x: CACHOEIRA_TOWN_CENTER.x, z: CACHOEIRA_TOWN_CENTER.z, radius: 170, height: 0 },
  { id: 'igreja-cachoeira', kind: 'church', x: CACHOEIRA_CHURCH.x, z: CACHOEIRA_CHURCH.z, radius: 22, height: 18 },
  { id: 'praca-cachoeira', kind: 'square', x: CACHOEIRA_PRACA.x, z: CACHOEIRA_PRACA.z, radius: 24, height: 1 },
  { id: 'sete-lagoas', kind: 'city', x: 1250, z: -420, radius: 360, height: 0 },
];

let _refs = null;

export function createInhaumaWorld(scene) {
  scene.fog = new THREE.Fog(0xb6d0c4, 900, 2600);

  const terrain = buildInhaumaTerrain(scene); // relevo infinito visual + região virtual de colisão
  const water = buildInhaumaWater(scene);
  // 2026-08-11: represa RECONSTRUÍDA sobre o canal real (buildDam escolhe o
  // sítio em runtime na polilinha do rio) — o landmark é registrado dinâmico,
  // no sítio verdadeiro, revertendo a remoção da era T-09.
  const dam = buildDam(scene);
  if (dam?.site && !INHAUMA_LANDMARKS.some((l) => l.id === 'represa-inhauma')) {
    INHAUMA_LANDMARKS.push({ id: 'represa-inhauma', kind: 'dam', x: dam.site.x, z: dam.site.z, radius: 90, height: Math.round(dam.crestY - (dam.waterY - 6)) });
  }
  const nuclear = buildNuclearPlant(scene);
  const factories = buildFactories(scene);
  buildForests(scene);
  const cars = buildInhaumaRoadGraphAndTraffic(scene, inhaumaContinuousHeight);
  buildTown(scene);
  // T-C-04: a segunda cidade (vale oeste, colada na osm-mg-060).
  buildCachoeira(scene);
  // T-C-05: guarnição de ocupação — formações seedadas registradas em game.targets.
  // Exclusões duras: as duas cidades + as zonas do aeroporto + a faixa do rio.
  // rng DERIVADO da seed do jogo (não game.rng em si): o fluxo principal consome
  // game.rng por frame (flak/áudio ambientes) em quantidade que varia com o
  // wall-clock — um rng próprio mantém o spawn da guarnição bit-a-bit
  // determinístico por seed entre carregamentos (contrato SPEC §A/§F).
  const garrison = buildCachoeiraGarrison(scene, {
    game,
    formationDeps: {
      rng: createRng(`${game.runtime?.seed ?? 'aero-default-seed'}:cachoeira-garrison`),
      heightAt: inhaumaVisualSurfaceHeight, // mesma superfície RENDERIZADA do debug
      exclusions: [TOWN_SHELF, CACHOEIRA_SHELF, ...INHAUMA_AIRPORT_EXCLUSION_ZONES],
      riverPolyline: getInhaumaRiverPolyline(),
      riverHalfWidth: RIVER_HALF_WIDTH_M,
    },
    shelf: CACHOEIRA_SHELF,
  });

  // T-C-06: diretor de campanha (Ato 1 "Salvar Inhaúma" → Ato 2 "Libertar
  // Cachoeira"). Init aqui no create do mapa — idempotente; os spawns do Ato 1
  // são escalonados pelo relógio da campanha, que só avança com game.running
  // (updateCampaign roda no main tick). A guarnição vira o objetivo do Ato 2.
  initCampaign(game, { scene, garrisonFormations: garrison.formations });

  // T-C-09: guerra urbana — baterias deployed bombardeiam os prédios (SPEC §D).
  // Hooks REAIS de FX/áudio injetados aqui (city-war.js é Node-safe; os módulos
  // de cena/áudio não são). Os hooks recebem x,y,z planos e reusam um scratch —
  // zero alocação por chamada no hot path.
  const _cwv = new THREE.Vector3();
  setCityWarHooks({
    explosion: (x, y, z, s) => explosion(_cwv.set(x, y, z), s, COLORS.fireOrange),
    muzzle: (x, y, z) => spawnMuzzleFlash(_cwv.set(x, y, z)),
    trail: (x, y, z) => spawnMissileSmoke(_cwv.set(x, y, z)),
    propFire: (x, y, z, s, d) => spawnPropFire(x, y, z, s, d),
    smoke: (x, y, z, owner) => addSmokeEmitter(x, y, z, owner),
    removeSmoke: (owner) => removeSmokeEmittersOf(owner),
    scorch: (x, y, z, r) => spawnScorchMark(_cwv.set(x, y, z), r, 0.5),
    boom: (x, y, z) => audio.explosion(0.9, _cwv.set(x, y, z)),
  });
  initCityWar(game, { scene });

  // Vapor das torres de resfriamento + fumaça das chaminés (emissores contínuos).
  const steamOwner = { isInhaumaSteam: true };
  for (const e of nuclear.steamEmitters) addSmokeEmitter(e.x, e.y, e.z, steamOwner);
  for (const e of factories.smoke) addSmokeEmitter(e.x, e.y, e.z, steamOwner);

  _refs = { terrain, water, cars, garrison };

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
    garrison: garrison.diagnostics, // T-C-05 — contrato aditivo
  };
}

export function updateInhaumaWorld(dt, playerPos) {
  if (_refs) updateInhaumaScene(dt, _refs, playerPos);
}
