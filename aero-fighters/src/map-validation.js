// map-validation.js — pure map/target validation helpers for QA.

import { TARGET_LAYOUT_DESERT, TARGET_LAYOUT_RIO, TARGET_LAYOUT_INHAUMA } from './config.js';

// ─── Airport geometry constants (no-THREE dependency) ─────────────────────────
const _AIRPORT = {
  elevation: 0,
  runway:      { cx: -160, cz: 120,  hw: 29,  hl: 380 },
  taxiway:     { cx: -160, cz: 260,  hw: 17,  hl: 90  },
  serviceZone: { cx: -160, cz: 350,  hw: 35,  hl: 43  },
};

const _INHAUMA_AIRPORT = {
  elevation: 0,
  runway:      { cx: -560, cz: 320, hw: 26, hl: 310 },
  taxiway:     { cx: -560, cz: 430, hw: 15, hl: 80  },
  serviceZone: { cx: -560, cz: 475, hw: 42, hl: 38  },
};

function _onAirport(x, z, mapId = 'desert') {
  const airport = mapId === 'inhauma' ? _INHAUMA_AIRPORT : _AIRPORT;
  const { runway, taxiway, serviceZone } = airport;
  return (Math.abs(x - runway.cx) <= runway.hw && Math.abs(z - runway.cz) <= runway.hl) ||
    (Math.abs(x - taxiway.cx) <= taxiway.hw && Math.abs(z - taxiway.cz) <= taxiway.hl) ||
    (Math.abs(x - serviceZone.cx) <= serviceZone.hw && Math.abs(z - serviceZone.cz) <= serviceZone.hl);
}

export const GROUND_TOLERANCE = 1.0;

export const MAP_VALIDATION_DEFS = {
  desert: {
    bounds: { minX: -1400, maxX: 1400, minZ: -1400, maxZ: 1400 },
    layout: TARGET_LAYOUT_DESERT,
    regions: [
      [0, 0, 200, 45, 'mesa'],
      [400, -300, 120, 38, 'mesa'],
      [-350, 200, 150, 52, 'mesa'],
      [200, 500, 90, 30, 'mesa'],
      [-500, -400, 100, 42, 'mesa'],
      [0, -600, 180, 35, 'mesa'],
      [600, 100, 80, 25, 'mesa'],
      [-200, 700, 110, 48, 'mesa'],
      [150, 200, 80, 35, 'canyon'],
      [-250, -150, 60, 28, 'canyon'],
    ].map(([cx, cz, radius, peakHeight, type], id) => ({ id, cx, cz, radius, peakHeight, type })),
  },
  rio: {
    bounds: { minX: -900, maxX: 900, minZ: -900, maxZ: 900 },
    layout: TARGET_LAYOUT_RIO,
    regions: [
      [80, -120, 45, 120, 'rock', 'paodeacucar'],
      [-200, 100, 70, 150, 'forest', 'corcovado'],
      [300, 250, 55, 90, 'twin', 'doisirmaos'],
      [-300, 300, 60, 80, 'mesa', 'pedradagavea'],
      [-100, 500, 120, 110, 'forest', 'tijuca'],
      [450, -200, 35, 55, 'urban', 'morro1'],
      [-400, -300, 40, 50, 'urban', 'morro2'],
      [200, 600, 30, 45, 'urban', 'morro3'],
    ].map(([cx, cz, radius, peakHeight, type, name], id) => ({ id, cx, cz, radius, peakHeight, type, name })),
  },
  inhauma: {
    bounds: { minX: -1600, maxX: 1700, minZ: -1100, maxZ: 1000 },
    layout: TARGET_LAYOUT_INHAUMA,
    regions: [
      ['urban-rise-inhauma', 0, 0, 360, 10, 'urbanRise'],
      ['morros-oeste-inhauma', -380, 40, 270, 52, 'roundedHill'],
      ['morro-norte-inhauma', -40, -330, 230, 44, 'roundedHill'],
      ['serra-sete-lagoas', 760, -300, 430, 76, 'ridge'],
      ['vale-cachoeira-prata', -940, 520, 260, 16, 'valley'],
      ['morros-sudeste-inhauma', 330, 330, 240, 40, 'roundedHill'],
    ].map(([name, cx, cz, radius, peakHeight, type], id) => ({ id, name, cx, cz, radius, peakHeight, type })),
  },
};

export function desertHeightAt(region, dx, dz) {
  const worldX = region.cx + dx;
  const worldZ = region.cz + dz;
  if (_onAirport(worldX, worldZ)) return _AIRPORT.elevation;
  const noise = Math.sin(dx * 0.15) * 1.5 + Math.cos(dz * 0.12) * 1.5;
  const t = Math.sqrt(dx * dx + dz * dz) / region.radius;
  if (region.type === 'mesa') {
    let h = 0;
    if (t < 0.7) h = region.peakHeight;
    else if (t < 1.0) h = region.peakHeight * (1 - (t - 0.7) / 0.3);
    return Math.max(0, h + noise);
  }
  if (t < 0.7) return Math.max(-10, -region.peakHeight * 0.6 + noise);
  if (t < 1.0) return Math.max(-10, -region.peakHeight * 0.6 * (1 - (t - 0.7) / 0.3) + noise);
  return 0;
}

export function rioHeightAt(region, dx, dz) {
  const worldX = region.cx + dx;
  const worldZ = region.cz + dz;
  if (_onAirport(worldX, worldZ)) return _AIRPORT.elevation;
  const t = Math.sqrt(dx * dx + dz * dz) / region.radius;
  if (t >= 1.0) return 0;
  const noise = Math.sin(dx * 0.2) * 2 + Math.cos(dz * 0.18) * 2;
  let h = 0;
  if (region.type === 'rock') {
    h = region.peakHeight * Math.max(0, 1 - t * t * 2.0);
  } else if (region.type === 'mesa') {
    h = t < 0.65 ? region.peakHeight : region.peakHeight * Math.max(0, 1 - (t - 0.65) / 0.25);
  } else if (region.type === 'twin') {
    const d1 = Math.sqrt((dx - 0.3 * region.radius) ** 2 + dz * dz);
    const d2 = Math.sqrt((dx + 0.3 * region.radius) ** 2 + dz * dz);
    h = region.peakHeight * Math.max(
      Math.max(0, 1 - (d1 / region.radius * 1.8) ** 2),
      Math.max(0, 1 - (d2 / region.radius * 1.8) ** 2),
    );
  } else {
    h = region.peakHeight * Math.max(0, 1 - t * t * 1.6);
  }
  return Math.max(0, h + noise);
}

export function inhaumaHeightAt(region, dx, dz) {
  const worldX = region.cx + dx;
  const worldZ = region.cz + dz;
  if (_onAirport(worldX, worldZ, 'inhauma')) return _INHAUMA_AIRPORT.elevation;
  const distance = Math.hypot(dx, dz);
  const t = distance / region.radius;
  if (t >= 1) return 0;
  const noise = Math.sin(dx * 0.036) * 1.8 + Math.cos(dz * 0.031) * 1.5;
  if (region.type === 'urbanRise') return Math.max(0, region.peakHeight * (1 - t * t * 1.4) + noise * 0.35);
  if (region.type === 'ridge') {
    const ridgeBand = Math.max(0, 1 - Math.abs(dz) / (region.radius * 0.55));
    const falloff = Math.max(0, 1 - Math.abs(dx) / region.radius);
    return Math.max(0, region.peakHeight * ridgeBand * falloff + noise);
  }
  if (region.type === 'valley') return Math.max(0, region.peakHeight * 0.35 * (1 - t) + noise * 0.25);
  return Math.max(0, region.peakHeight * Math.max(0, 1 - t * t * 1.35) + noise);
}

export function heightForMap(mapId, region, dx, dz) {
  if (mapId === 'desert') return desertHeightAt(region, dx, dz);
  if (mapId === 'rio') return rioHeightAt(region, dx, dz);
  if (mapId === 'inhauma') return inhaumaHeightAt(region, dx, dz);
  return 0;
}

export function materializeLayout(mapId, mapDef = MAP_VALIDATION_DEFS[mapId]) {
  if (!mapDef) return [];
  return mapDef.layout.map(([regionIdx, dx, dz, type], id) => {
    const region = regionIdx >= 0 ? mapDef.regions[regionIdx] : null;
    const worldX = region ? region.cx + dx : dx;
    const worldZ = region ? region.cz + dz : dz;
    let y = 0;
    if (region) {
      y = heightForMap(mapId, region, dx, dz);
    } else if (type === 'warship') {
      y = 0.6;
    } else {
      for (const candidate of mapDef.regions) {
        const cdx = worldX - candidate.cx;
        const cdz = worldZ - candidate.cz;
        if (cdx * cdx + cdz * cdz <= candidate.radius * candidate.radius) {
          y = Math.max(y, heightForMap(mapId, candidate, cdx, cdz));
        }
      }
    }
    return { id, mapId, regionIdx, region, dx, dz, type, x: worldX, y, z: worldZ };
  });
}

function pushError(errors, code, message, details = {}) {
  errors.push({ code, message, ...details });
}

export function validateTargets(mapId, targets, options = {}) {
  const tolerance = options.tolerance ?? GROUND_TOLERANCE;
  const mapDef = options.mapDef ?? MAP_VALIDATION_DEFS[mapId];
  const errors = [];
  if (!mapDef) {
    pushError(errors, 'MAP_UNKNOWN', `Unknown map '${mapId}'`, { mapId });
    return errors;
  }
  const minSpacing = options.minSpacing ?? 4;
  const bounds = mapDef.bounds;

  for (const target of targets) {
    for (const [axis, value] of [['x', target.x], ['y', target.y], ['z', target.z]]) {
      if (!Number.isFinite(value)) {
        pushError(errors, 'TARGET_COORDINATE_INVALID', `Target ${target.id} ${axis} is not finite`, { target });
      }
    }
    if (target.x < bounds.minX || target.x > bounds.maxX || target.z < bounds.minZ || target.z > bounds.maxZ) {
      pushError(errors, 'TARGET_OUT_OF_BOUNDS', `Target ${target.id} is outside ${mapId} bounds`, { target, bounds });
    }
    if (target.regionIdx >= 0 && !mapDef.regions[target.regionIdx]) {
      pushError(errors, 'TARGET_REGION_INVALID', `Target ${target.id} references missing region ${target.regionIdx}`, { target });
      continue;
    }
    let expectedY = 0;
    if (target.region) {
      expectedY = heightForMap(mapId, target.region, target.dx, target.dz);
    } else if (target.type === 'warship') {
      expectedY = 0.6;
    } else {
      for (const candidate of mapDef.regions) {
        const dx = target.x - candidate.cx;
        const dz = target.z - candidate.cz;
        if (dx * dx + dz * dz <= candidate.radius * candidate.radius) {
          expectedY = Math.max(expectedY, heightForMap(mapId, candidate, dx, dz));
        }
      }
    }
    if (!Number.isFinite(expectedY)) {
      pushError(errors, 'TERRAIN_HEIGHT_INVALID', `Terrain height for target ${target.id} is invalid`, { target, expectedY });
      continue;
    }
    const delta = target.y - expectedY;
    if (Math.abs(delta) > tolerance) {
      pushError(errors, 'TARGET_NOT_GROUNDED', `Target ${target.id} (${target.type}) height delta ${delta.toFixed(3)} exceeds ${tolerance}`, {
        target,
        expectedY,
        actualY: target.y,
        delta,
      });
    }
  }

  for (let i = 0; i < targets.length; i++) {
    for (let j = i + 1; j < targets.length; j++) {
      const a = targets[i], b = targets[j];
      const d = Math.hypot(a.x - b.x, a.z - b.z);
      if (d < minSpacing) {
        pushError(errors, 'TARGET_OVERLAP', `Targets ${a.id} and ${b.id} are too close (${d.toFixed(2)})`, { a, b, distance: d });
      }
    }
  }

  return errors;
}

export function validateMap(mapId, options = {}) {
  const targets = options.targets ?? materializeLayout(mapId, options.mapDef);
  return validateTargets(mapId, targets, options);
}
