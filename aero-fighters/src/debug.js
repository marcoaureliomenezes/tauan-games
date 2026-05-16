// debug.js — test-mode diagnostics and optional overlay.

import { game } from './state.js';
import { GROUND_TOLERANCE } from './map-validation.js';
import { getAirportDiagnostics } from './airport.js';
import { nuclearFxState } from './nuclear-fx.js';
import { MAP_KEYS } from './maps/index.js';

const metrics = {
  frames: 0,
  totalFrameTime: 0,
  worstFrameTime: 0,
  longFrames: 0,
};

let overlay = null;
let deps = null;

export function recordFrame(dt) {
  const ms = dt * 1000;
  metrics.frames += 1;
  metrics.totalFrameTime += ms;
  metrics.worstFrameTime = Math.max(metrics.worstFrameTime, ms);
  if (ms > 50) metrics.longFrames += 1;
  updateOverlay();
}

export function getFrameMetrics() {
  const avgMs = metrics.frames ? metrics.totalFrameTime / metrics.frames : 0;
  return {
    frames: metrics.frames,
    averageFrameMs: avgMs,
    averageFps: avgMs > 0 ? 1000 / avgMs : 0,
    worstFrameMs: metrics.worstFrameTime,
    longFrames: metrics.longFrames,
  };
}

function terrainHeightAt(x, z) {
  if (!deps?.heightFn) return 0;
  let best = null;
  for (const isl of game.islands) {
    const dx = x - isl.cx;
    const dz = z - isl.cz;
    const r2 = dx * dx + dz * dz;
    if (r2 <= isl.radius * isl.radius) {
      const h = deps.heightFn(isl, dx, dz);
      if (!best || h > best.height) best = { height: h, island: isl, dx, dz };
    }
  }
  return best?.height ?? 0;
}

function nearestGroundSample(x, z) {
  let nearest = null;
  for (const isl of game.islands) {
    const dx = x - isl.cx;
    const dz = z - isl.cz;
    const distance = Math.hypot(dx, dz);
    const height = distance <= isl.radius && deps?.heightFn ? deps.heightFn(isl, dx, dz) : 0;
    const sample = { mapId: game.activeMap, cx: isl.cx, cz: isl.cz, radius: isl.radius, distance, height };
    if (!nearest || distance < nearest.distance) nearest = sample;
  }
  return nearest ?? { mapId: game.activeMap, distance: Infinity, height: 0 };
}

function targetDiagnostics() {
  return game.targets.map((target, id) => {
    const p = target.mesh.position;
    const ground = nearestGroundSample(p.x, p.z);
    const terrainHeight = terrainHeightAt(p.x, p.z);
    const heightError = p.y - (target.type === 'warship' ? 0.6 : terrainHeight);
    return {
      id,
      type: target.type,
      hp: target.hp,
      dead: target.dead,
      x: p.x,
      y: p.y,
      z: p.z,
      spawnX: target.spawnX ?? p.x,
      spawnY: target.spawnY ?? p.y,
      spawnZ: target.spawnZ ?? p.z,
      terrainHeight,
      heightError,
      grounded: Math.abs(heightError) <= GROUND_TOLERANCE,
      nearestGround: ground,
    };
  });
}

function rendererStats() {
  const info = deps?.renderer?.info;
  return {
    calls: info?.render?.calls ?? 0,
    triangles: info?.render?.triangles ?? 0,
    points: info?.render?.points ?? 0,
    lines: info?.render?.lines ?? 0,
    geometries: info?.memory?.geometries ?? 0,
    textures: info?.memory?.textures ?? 0,
  };
}

function physicsDiagnostics() {
  const terrainHeight = terrainHeightAt(game.player.x, game.player.pz || 0);
  return {
    speed: game.player.speed,
    throttle: game.player.throttle,
    stalled: game.player.stalled,
    altitudeAboveTerrain: game.player.y - terrainHeight,
    terrainHeight,
    mayday: game.flags.mayday,
    dead: game.player.dead,
  };
}

function snapshot() {
  const mr = game.missionRealism || {};
  const airport = getAirportDiagnostics(game.activeMap);
  return {
    runtime: game.runtime,
    sortieState: mr.sortie?.state ?? 'UNKNOWN',
    selectedMap: game.activeMap,
    airport,
    runwayBounds: airport.runwayBounds,
    landingZoneStatus: mr.landingZoneStatus ?? null,
    groundContact: mr.groundContact ?? null,
    groundSpeed: mr.ground?.groundSpeed ?? game.player.speed,
    verticalSpeed: mr.ground?.verticalSpeed ?? 0,
    takeoffEnvelope: mr.ground?.takeoffEnvelope ?? null,
    landingEnvelope: mr.ground?.landingEnvelope ?? null,
    gearState: mr.ground?.gearState ?? 'UNKNOWN',
    serviceState: mr.service?.phase ?? 'idle',
    serviceProgress: mr.service?.progress ?? 0,
    ejectionState: mr.ejection?.active ? 'ACTIVE' : (mr.ejection?.pilotState ?? 'IN_AIRCRAFT'),
    pilotState: mr.ejection?.pilotState ?? 'IN_AIRCRAFT',
    cameraMode: mr.camera?.mode ?? 'Chase',
    cinematicCamera: mr.camera?.cinematic ?? null,
    nuclearFxState,
    missionProgress: { destroyed: game.targetsDestroyed, total: game.targetsTotal, cycle: game.cycle },
    missionScore: mr.missionScore ?? game.score,
    weaponInventory: {
      missiles: game.player.missiles,
      heavyMissiles: game.player.heavyMissiles,
      nuclearMissiles: game.player.nuclearMissiles,
    },
    airportText: airport.airportText,
    criticalVideoCapture: mr.criticalVideoCapture ?? false,
    aircraftVisual: mr.aircraftVisual ?? null,
    hudLayout: mr.hudLayout ?? null,
    desertLandmarks: mr.desertLandmarks ?? null,
    map: getMapDiagnostics(),
    player: {
      x: game.player.x,
      y: game.player.y,
      z: game.player.pz || 0,
      pitch: game.player.pitch,
      speed: game.player.speed,
      throttle: game.player.throttle,
      stalled: game.player.stalled,
      dead: game.player.dead,
      lives: game.player.lives,
    },
    camera: deps?.camera ? {
      x: deps.camera.position.x,
      y: deps.camera.position.y,
      z: deps.camera.position.z,
    } : null,
    targets: targetDiagnostics(),
    projectiles: game.projectiles.length,
    renderer: rendererStats(),
    frames: getFrameMetrics(),
    physics: physicsDiagnostics(),
  };
}

export function getMapDiagnostics() {
  const inhauma = game.missionRealism?.inhaumaMap ?? {};
  return {
    activeMap: game.activeMap,
    seed: game.runtime?.seed,
    mission: game.cycle,
    islandCount: game.islands.length,
    targetCount: game.targets.length,
    mapsCovered: MAP_KEYS.filter((key) => key !== 'islands'),
    cities: inhauma.cities ?? [],
    landmarks: inhauma.landmarks ?? [],
    roads: inhauma.roads ?? [],
    terrainRegions: inhauma.terrainRegions ?? [],
    airport: getAirportDiagnostics(game.activeMap),
  };
}

function ensureOverlay() {
  if (overlay || typeof document === 'undefined') return overlay;
  overlay = document.createElement('pre');
  overlay.id = 'aero-debug-overlay';
  overlay.style.cssText = [
    'position:fixed',
    'right:8px',
    'bottom:8px',
    'z-index:9999',
    'margin:0',
    'padding:8px',
    'max-width:360px',
    'font:12px monospace',
    'line-height:1.35',
    'color:#dff',
    'background:rgba(0,0,0,.72)',
    'border:1px solid rgba(120,220,255,.5)',
    'pointer-events:none',
    'display:none',
  ].join(';');
  document.body.appendChild(overlay);
  return overlay;
}

function updateOverlay() {
  if (!overlay || overlay.style.display === 'none') return;
  const s = snapshot();
  overlay.textContent = [
    `map=${s.map.activeMap} seed=${s.map.seed}`,
    `fps=${s.frames.averageFps.toFixed(1)} worst=${s.frames.worstFrameMs.toFixed(1)}ms`,
    `draw=${s.renderer.calls} tri=${s.renderer.triangles}`,
    `spd=${s.player.speed.toFixed(1)} thr=${Math.round(s.player.throttle * 100)} alt=${s.physics.altitudeAboveTerrain.toFixed(1)}`,
    `pitch=${s.player.pitch.toFixed(2)} targets=${s.targets.length}`,
  ].join('\n');
}

export function installDebugApi(options) {
  deps = options;
  if (!game.runtime?.testMode || typeof window === 'undefined') return;
  window.__aeroDebug = {
    version: 1,
    getSnapshot: snapshot,
    getRendererStats: rendererStats,
    getTerrainHeightAt: terrainHeightAt,
    getNearestGroundSample: nearestGroundSample,
    getTargetDiagnostics: targetDiagnostics,
    getMapDiagnostics,
    getPhysicsDiagnostics: physicsDiagnostics,
    runFixedStep(seconds, dt) {
      return { seconds, dt, note: 'runtime fixed-step is covered by Node simulation tools' };
    },
    setDebugOverlay(enabled) {
      const el = ensureOverlay();
      if (el) el.style.display = enabled ? 'block' : 'none';
      updateOverlay();
    },
  };
}
