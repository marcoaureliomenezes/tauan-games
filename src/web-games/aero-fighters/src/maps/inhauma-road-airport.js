import { INHAUMA_WEB_MAP_METADATA } from './inhauma-data/metadata.js';

const AIRPORT_RECTS = [
  { id: 'runway', cx: -560, cz: 320, halfW: 26, halfL: 310 },
  { id: 'taxiway', cx: -560, cz: 430, halfW: 15, halfL: 80 },
  { id: 'service', cx: -560, cz: 475, halfW: 42, halfL: 38 },
];

export const INHAUMA_AIRPORT_EXCLUSION_ZONES = INHAUMA_WEB_MAP_METADATA.airportExclusionZones;

export function isInhaumaAirportSurface(x, z) {
  return AIRPORT_RECTS.some((rect) =>
    Math.abs(x - rect.cx) <= rect.halfW && Math.abs(z - rect.cz) <= rect.halfL);
}

export function inhaumaAirportExclusionZoneAt(x, z) {
  return INHAUMA_AIRPORT_EXCLUSION_ZONES.find((zone) =>
    Math.abs(x - zone.cx) <= zone.halfW && Math.abs(z - zone.cz) <= zone.halfL) || null;
}
