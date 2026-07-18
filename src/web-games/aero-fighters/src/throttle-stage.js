// throttle-stage.js — pure D-6 throttle-stage mapping (Node-safe, no DOM/THREE).
// Mirrors physics-core.js/weapons-core.js's purity discipline: a deterministic
// function of the continuous throttle value, unit-tested directly. Drives UX/FX
// only (afterburner plume gating, HUD readout) — flight/ground physics keep reading
// the continuous `game.player.throttle` value unchanged (SPEC AC-02, D-6).

import { PLAYER } from './config.js';

export const ThrottleStage = Object.freeze({
  IDLE: 'idle',
  TAXI: 'taxi',
  MILITARY: 'military',
  AFTERBURNER: 'afterburner',
});

/** Default detent thresholds — config.js#PLAYER is the single source of truth
 *  (D-6: idle <= 0.10 / taxi <= 0.35 / military <= 0.80 / afterburner > 0.80). */
const DEFAULT_THRESHOLDS = Object.freeze({
  idleMax: PLAYER.THROTTLE_IDLE_MAX,
  taxiMax: PLAYER.THROTTLE_TAXI_MAX,
  militaryMax: PLAYER.THROTTLE_MILITARY_MAX,
});

/**
 * Maps a continuous throttle value in [0,1] to one of the 4 named D-6 detents.
 * Pure, deterministic, boundary-inclusive on the LOW side of each band (`<=`) so
 * every value in [0,1] maps to exactly one stage with no gaps.
 * @param {number} t - continuous throttle, expected [0,1]
 * @param {{idleMax:number,taxiMax:number,militaryMax:number}} [thresholds]
 * @returns {'idle'|'taxi'|'military'|'afterburner'}
 */
export function throttleStage(t, thresholds = DEFAULT_THRESHOLDS) {
  if (t <= thresholds.idleMax) return ThrottleStage.IDLE;
  if (t <= thresholds.taxiMax) return ThrottleStage.TAXI;
  if (t <= thresholds.militaryMax) return ThrottleStage.MILITARY;
  return ThrottleStage.AFTERBURNER;
}

/** True at military power or above — the afterburner plume gate threshold (SPEC
 *  AC-02: "visible afterburner exhaust plume appears at military+"). */
export function isMilitaryOrAbove(t, thresholds = DEFAULT_THRESHOLDS) {
  const stage = throttleStage(t, thresholds);
  return stage === ThrottleStage.MILITARY || stage === ThrottleStage.AFTERBURNER;
}

/** True only at the afterburner detent — the plume's largest-scale gate. */
export function isAfterburnerStage(t, thresholds = DEFAULT_THRESHOLDS) {
  return throttleStage(t, thresholds) === ThrottleStage.AFTERBURNER;
}

/**
 * Normalized afterburner plume intensity in [0,1]: 0 below military power (idle/
 * taxi — no plume), ramping continuously from the moment military power is entered
 * up to full throttle — so the plume already "appears at military+" (SPEC AC-02) and
 * keeps growing to its largest at afterburner (throttle near/at 1). Pure — used by
 * player.js to scale the afterburner plume mesh (no per-frame allocation, just a
 * scalar the caller applies to an already-pooled mesh).
 */
export function afterburnerIntensity(t, thresholds = DEFAULT_THRESHOLDS) {
  if (t <= thresholds.taxiMax) return 0;
  const span = 1 - thresholds.taxiMax;
  if (span <= 0) return 1;
  return Math.min(1, Math.max(0, (t - thresholds.taxiMax) / span));
}
