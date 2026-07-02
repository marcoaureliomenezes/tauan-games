import test from 'node:test';
import assert from 'node:assert/strict';

import { PLAYER, MISSILES_LIGHT } from '../../../aero-fighters/src/config.js';
import {
  altitudeAboveTerrain,
  boundedAxisDelta,
  clampDt,
  homingVelocity,
  isStalled,
  normalize,
  terrainCollision,
  throttleStep,
  updateSpeed,
  validateFiniteState,
} from '../../../aero-fighters/src/physics-core.js';

test('clampDt caps large and invalid values', () => {
  assert.equal(clampDt(0.2), 0.1);
  assert.equal(clampDt(-1), 0);
  assert.equal(clampDt(Number.NaN), 0);
});

test('throttle and speed converge deterministically', () => {
  const throttle = throttleStep(0.5, { throttleUp: true }, PLAYER, 1);
  assert.equal(throttle, 1);
  const speed = updateSpeed(25, throttle, PLAYER, 0.5);
  assert.ok(speed > 25);
});

test('stall flag follows configured speed threshold', () => {
  assert.equal(isStalled(PLAYER.STALL_SPD - 0.1, PLAYER), true);
  assert.equal(isStalled(PLAYER.STALL_SPD + 0.1, PLAYER), false);
});

test('axis deltas are bounded by rate and dt', () => {
  assert.equal(boundedAxisDelta(true, PLAYER.PITCH_RATE, 0.5), PLAYER.PITCH_RATE * 0.5);
  assert.equal(boundedAxisDelta(false, PLAYER.PITCH_RATE, 0.5), 0);
});

test('altitude and terrain collision use the same terrain height', () => {
  assert.equal(altitudeAboveTerrain(30, 12), 18);
  assert.equal(terrainCollision(2.9, 0, PLAYER), 'SEA');
  assert.equal(terrainCollision(14, 10, PLAYER), 'MOUNTAIN');   // 14 < 10+5 (MOUNTAIN_BUFFER=5)
  assert.equal(terrainCollision(16, 10, PLAYER), null);          // 16 >= 10+5 → clear
});

test('homing velocity respects turn-rate interpolation', () => {
  const desired = normalize({ x: 10, y: 0, z: 0 }, MISSILES_LIGHT.TRACKING_SPD);
  const next = homingVelocity({ x: 0, y: 0, z: -80 }, desired, MISSILES_LIGHT.TURN_RATE);
  assert.ok(next.x > 0);
  assert.ok(next.z > -80);
});

test('finite-state validator catches invalid numeric state', () => {
  assert.deepEqual(validateFiniteState('state', { player: { x: 1, y: 2 } }), []);
  assert.deepEqual(validateFiniteState('state', { player: { x: Number.NaN } }), ['state.player.x']);
});
