import { getAirportForMap } from './airport.js';

function inRect(pos, rect) {
  return Math.abs(pos.x - rect.center.x) <= rect.width / 2 &&
    Math.abs(pos.z - rect.center.z) <= rect.length / 2;
}

export function airportSurface(pos, activeMap = 'desert') {
  const airport = getAirportForMap(activeMap);
  if (inRect(pos, airport.runway)) return 'runway';
  if (inRect(pos, airport.taxiway)) return 'taxiway';
  if (inRect(pos, airport.serviceZone)) return 'service';
  return 'none';
}

export function airportHeightAt(x, z, fallbackHeight = 0, activeMap = 'desert') {
  const airport = getAirportForMap(activeMap);
  const surface = airportSurface({ x, z }, activeMap);
  return surface !== 'none' ? airport.elevation : fallbackHeight;
}

/** Caixa envolvente (runway+taxiway+service) do aeroporto do mapa. */
function airportBounds(activeMap = 'desert') {
  const airport = getAirportForMap(activeMap);
  const parts = [airport.runway, airport.taxiway, airport.serviceZone].filter(Boolean);
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (const p of parts) {
    minX = Math.min(minX, p.center.x - p.width / 2);
    maxX = Math.max(maxX, p.center.x + p.width / 2);
    minZ = Math.min(minZ, p.center.z - p.length / 2);
    maxZ = Math.max(maxZ, p.center.z + p.length / 2);
  }
  return { minX, maxX, minZ, maxZ, elevation: airport.elevation };
}

/** Fator de clareira do aeroporto em [0,1].
 *  1 = terreno totalmente achatado para a elevação do aeroporto (sobre/junto da pista),
 *  0 = terreno natural intacto (longe do aeroporto), com rampa suave (smoothstep) entre os dois.
 *  Garante que NENHUMA montanha fique no meio/beira da pista — carve um "campo de pouso"
 *  plano ao redor de todo o complexo, não só na faixa exata do pavimento. */
export function airportClearingFactor(pos, activeMap = 'desert', inner = 55, outer = 140) {
  const b = airportBounds(activeMap);
  const dx = Math.max(b.minX - pos.x, 0, pos.x - b.maxX);
  const dz = Math.max(b.minZ - pos.z, 0, pos.z - b.maxZ);
  const d = Math.hypot(dx, dz);
  if (d <= inner) return 1;
  if (d >= outer) return 0;
  const t = (d - inner) / (outer - inner);
  return 1 - t * t * (3 - 2 * t); // smoothstep invertido
}

/** Mistura a altura natural do terreno com a elevação do aeroporto pela clareira. */
export function applyAirportClearing(naturalHeight, worldX, worldZ, activeMap = 'desert') {
  const f = airportClearingFactor({ x: worldX, z: worldZ }, activeMap);
  if (f <= 0) return naturalHeight;
  const elevation = getAirportForMap(activeMap).elevation;
  return naturalHeight * (1 - f) + elevation * f;
}

export function classifyGroundContact(pos, activeMap = 'desert', terrainHeight = 0, terrainKind = null) {
  // Todo mapa tem aeroporto (WS-2) — pavimento é sempre a 1ª classificação.
  const airport = getAirportForMap(activeMap);
  const surface = airportSurface(pos, activeMap);
  if (surface !== 'none') {
    return { type: surface, safe: true, height: airport.elevation, reason: 'airport-pavement' };
  }
  if (terrainKind === 'mountain') return { type: 'mountain', safe: false, height: terrainHeight, reason: 'mountain-contact' };
  if (pos.y <= 2 && activeMap === 'islands') return { type: 'water', safe: false, height: 0, reason: 'water-impact' };
  return { type: 'terrain', safe: false, height: terrainHeight, reason: 'rough-terrain' };
}

export function evaluateTakeoffEnvelope({ speed, throttle, pitch, surface }) {
  const minSpeed = 42;
  const rotationSpeed = 38;
  const minPitch = 0.10;
  return {
    minSpeed,
    rotationSpeed,
    minPitch,
    readyForRotation: surface === 'runway' && throttle >= 0.82 && speed >= rotationSpeed,
    canLiftoff: surface === 'runway' && throttle >= 0.82 && speed >= minSpeed && pitch >= minPitch,
  };
}

/** Evaluates the landing envelope and classifies landing phase.
 *  Phase 'flare': altitude in [FLARE_LO, FLARE_HI] and sink in [SINK_MAX, -1] m/s — assist only.
 *  Phase 'touchdown': altitude < FLARE_LO AND sink > -3 m/s — fires TOUCHDOWN_SAFE.
 *  Phase 'unsafe': roll > 0.5 OR pitch > 0.32 OR sink < SINK_MAX — fires TOUCHDOWN_UNSAFE. */
export function evaluateLandingEnvelope({ speed, verticalSpeed, pitch, roll, surface, altitudeAboveGround = null }) {
  // Envelope tolerante: pousar na pista é fácil. Só atitude absurda conta como inseguro.
  const FLARE_LO = 2.2;
  const SINK_MAX = -16;
  const unsafe = Math.abs(roll) > 0.7 || Math.abs(pitch) > 0.45 || verticalSpeed < SINK_MAX;
  const onPavement = surface === 'runway' || surface === 'taxiway' || surface === 'service';
  const inSpeedRange = speed >= 12 && speed <= 60;
  // touchdownReady: dentro da janela de toque, descendo (ou quase nivelado) — pavimento.
  const touchdownReady = onPavement && inSpeedRange && !unsafe &&
    altitudeAboveGround !== null && altitudeAboveGround < FLARE_LO && verticalSpeed > -14;
  const safe = onPavement && inSpeedRange && !unsafe;
  return {
    safe,
    touchdownReady,
    unsafe,
    maxSpeed: 60,
    minSpeed: 12,
    maxDescentRate: SINK_MAX,
    surface,
  };
}
