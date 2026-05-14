import { desertAirport } from './airport.js';

function inRect(pos, rect) {
  return Math.abs(pos.x - rect.center.x) <= rect.width / 2 &&
    Math.abs(pos.z - rect.center.z) <= rect.length / 2;
}

export function airportSurface(pos) {
  if (inRect(pos, desertAirport.runway)) return 'runway';
  if (inRect(pos, desertAirport.taxiway)) return 'taxiway';
  if (inRect(pos, desertAirport.serviceZone)) return 'service';
  return 'none';
}

export function airportHeightAt(x, z, fallbackHeight = 0) {
  const surface = airportSurface({ x, z });
  return surface !== 'none' ? desertAirport.elevation : fallbackHeight;
}

export function classifyGroundContact(pos, activeMap = 'desert', terrainHeight = 0, terrainKind = null) {
  if (activeMap === 'desert') {
    const surface = airportSurface(pos);
    if (surface !== 'none') {
      return { type: surface, safe: true, height: desertAirport.elevation, reason: 'airport-pavement' };
    }
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
  const FLARE_HI = 3;
  const FLARE_LO = 0.5;
  const SINK_MAX = -9;
  const unsafe = Math.abs(roll) > 0.5 || Math.abs(pitch) > 0.32 || verticalSpeed < SINK_MAX;
  const onRunway = surface === 'runway';
  const inSpeedRange = speed >= 18 && speed <= 52;
  // 'safe' reflects that the aircraft CAN land (used for TOUCHDOWN_SAFE gate in player.js)
  // touchdownReady: only true in the touchdown phase (altitude < FLARE_LO, sink > -3)
  const touchdownReady = onRunway && inSpeedRange && !unsafe &&
    altitudeAboveGround !== null && altitudeAboveGround < FLARE_LO && verticalSpeed > -3;
  const safe = onRunway && inSpeedRange && !unsafe;
  return {
    safe,
    touchdownReady,
    unsafe,
    maxSpeed: 52,
    minSpeed: 18,
    maxDescentRate: SINK_MAX,
    surface,
  };
}
