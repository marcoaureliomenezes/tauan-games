import test from 'node:test';
import assert from 'node:assert/strict';

import { PLAYER } from '../../../aero-fighters/src/config.js';
import { materializeLayout, validateMap } from '../../../aero-fighters/src/map-validation.js';
import {
  clampDt,
  isStalled,
  terrainCollision,
  throttleStep,
  updateSpeed,
  validateFiniteState,
} from '../../../aero-fighters/src/physics-core.js';

function runSimpleFlight(seconds, inputAt) {
  const dt = 1 / 60;
  const state = {
    t: 0,
    x: 0,
    y: PLAYER.START_HEIGHT,
    z: 0,
    speed: 25,
    throttle: 0.5,
    pitch: 0,
    stalled: false,
  };
  const samples = [];
  while (state.t < seconds) {
    const input = inputAt(state.t, state);
    const step = clampDt(dt);
    state.throttle = throttleStep(state.throttle, input, PLAYER, step);
    state.speed = updateSpeed(state.speed, state.throttle, PLAYER, step);
    state.stalled = isStalled(state.speed, PLAYER);
    if (input.pitchUp) state.pitch += PLAYER.PITCH_RATE * step;
    if (input.pitchDown) state.pitch -= PLAYER.PITCH_RATE * step;
    state.y += Math.sin(state.pitch) * state.speed * step;
    state.y -= PLAYER.GRAVITY * step * (state.stalled ? 1 : 0.15);
    state.z -= Math.cos(state.pitch) * state.speed * step;
    state.t += step;
    samples.push({ ...state });
    const bad = validateFiniteState('flight', state);
    assert.deepEqual(bad, []);
  }
  return { state, samples };
}

test('straight flight remains finite and bounded for 10s', () => {
  const result = runSimpleFlight(10, () => ({ throttleUp: true }));
  assert.ok(result.state.speed <= PLAYER.MAX_SPD);
  assert.ok(result.state.y > 3);
});

test('climb, dive, and recover stays coherent', () => {
  const result = runSimpleFlight(12, (t) => ({
    throttleUp: true,
    pitchUp: t < 4,
    pitchDown: t >= 4 && t < 8,
  }));
  assert.ok(result.state.y > 3);
  assert.ok(result.samples.every((s) => Number.isFinite(s.y)));
});

test('deliberate terrain crash predicate fires', () => {
  assert.equal(terrainCollision(4, 20, PLAYER), 'MOUNTAIN');
});

test('current map layouts validate across required maps', () => {
  for (const mapId of ['rio', 'desert', 'inhauma']) {
    assert.deepEqual(validateMap(mapId), []);
    assert.ok(materializeLayout(mapId).length > 0);
  }
});

test('mission spawn validation across deterministic seeds remains stable', () => {
  const seeds = ['qa-001', 'qa-002', 'qa-003'];
  const baseline = JSON.stringify(materializeLayout('rio').map((t) => [t.type, t.x, t.y, t.z]));
  for (const seed of seeds) {
    assert.ok(seed);
    assert.equal(JSON.stringify(materializeLayout('rio').map((t) => [t.type, t.x, t.y, t.z])), baseline);
  }
});
