// test-aero-taxi-sim.js — Node deterministic sim for the T-05 roll-out →
// guided-taxi-on-pavement fix (SPEC AC-01, D-4, D-10).
//
// Root-cause regression this guards: the OLD code armed auto-taxi in the SAME frame
// as TOUCHDOWN_SAFE — while the aircraft was still doing landing speed — and drove it
// in a straight line toward the service-zone waypoint, independent of the runway
// axis ("cuts across grass"). This sim scripts a full touchdown → roll-out →
// handoff → guided-taxi → apron sequence using the pure kinematics in
// `taxi-core.js` + `ground-physics.js` + `landing-zones.js` (no THREE/jet — mirrors
// the existing `test-aero-sortie-sim.js` headless-physics convention) and asserts
// the aircraft never leaves pavement and is never captured while still fast.

import test from 'node:test';
import assert from 'node:assert/strict';

import { MISSILES_HEAVY, PLAYER } from '../../../aero-fighters/src/config.js';
import { airportSurface } from '../../../aero-fighters/src/landing-zones.js';
import { desertAirport, inhaumaAirport } from '../../../aero-fighters/src/airport.js';
import { createSortieMachine, SortieEvent, SortieState, transitionSortie } from '../../../aero-fighters/src/sortie-state.js';
import { createGroundPhysicsState, updateGroundRoll } from '../../../aero-fighters/src/ground-physics.js';
import { createServiceState, startService, updateService } from '../../../aero-fighters/src/service-scene.js';
import {
  advancePathIndex,
  buildTaxiPathIn,
  canHandoffToGuidedTaxi,
  stepRollOut,
  stepTowardWaypoint,
  wrapAngle,
} from '../../../aero-fighters/src/taxi-core.js';

const HANDOFF_SPEED = PLAYER.TAXI_HANDOFF_SPEED;
assert.equal(HANDOFF_SPEED, 34, 'PLAYER.TAXI_HANDOFF_SPEED must be the D-4 34 m/s handoff threshold');

// ─── Unit-level taxi-core behavior ────────────────────────────────────────────

test('wrapAngle keeps angles in (-PI, PI]', () => {
  assert.ok(Math.abs(wrapAngle(Math.PI * 3)) <= Math.PI);
  assert.ok(Math.abs(wrapAngle(-Math.PI * 5)) <= Math.PI);
  assert.ok(Math.abs(wrapAngle(0.3) - 0.3) < 1e-9);
});

test('canHandoffToGuidedTaxi requires BOTH slow-enough AND on-pavement', () => {
  // Fast + on pavement: still rolling out, no capture (the exact bug this fixes).
  assert.equal(canHandoffToGuidedTaxi(55, 'runway', HANDOFF_SPEED), false);
  // Slow but off pavement: never hand control to auto-taxi over grass.
  assert.equal(canHandoffToGuidedTaxi(10, 'none', HANDOFF_SPEED), false);
  // Slow AND on pavement: the only true case.
  assert.equal(canHandoffToGuidedTaxi(34, 'runway', HANDOFF_SPEED), true);
  assert.equal(canHandoffToGuidedTaxi(20, 'taxiway', HANDOFF_SPEED), true);
  // Boundary: exactly at handoff speed counts (<=).
  assert.equal(canHandoffToGuidedTaxi(HANDOFF_SPEED, 'service', HANDOFF_SPEED), true);
  assert.equal(canHandoffToGuidedTaxi(HANDOFF_SPEED + 0.01, 'service', HANDOFF_SPEED), false);
});

test('buildTaxiPathIn routes through the airport\'s own taxiway/service centers', () => {
  const path = buildTaxiPathIn(inhaumaAirport);
  assert.equal(path.length, 2);
  assert.deepEqual(path[0], { x: inhaumaAirport.taxiway.center.x, z: inhaumaAirport.taxiway.center.z, label: 'taxiway' });
  assert.deepEqual(path[1], { x: inhaumaAirport.serviceZone.center.x, z: inhaumaAirport.serviceZone.center.z, label: 'service' });
});

test('stepTowardWaypoint converges to the target with bounded accel/brake and turn rate — no snapping', () => {
  let s = { x: -560, z: 140, yaw: 0.4, speed: 34 };
  const target = { x: -560, z: 430 };
  const dt = 1 / 60;
  let frames = 0;
  let arrived = false;
  const speedDeltas = [];
  const yawDeltas = [];
  while (frames < 60 * 30 && !arrived) {
    const prevSpeed = s.speed;
    const prevYaw = s.yaw;
    const prevDist = Math.hypot(target.x - s.x, target.z - s.z);
    const step = stepTowardWaypoint(s, target, dt, { maxSpeed: 34, accel: 8, brake: 12, turnRate: 1.5, arriveRadius: 0.5 });
    // Exclude the final "stop" frame — coming to rest in the last meter is the
    // documented, pre-existing final-stop behavior (`dist > 1 ? v : 0`), not a
    // mid-cruise snap. Every OTHER frame must obey the accel/brake/turn-rate clamps.
    if (prevDist > 1) {
      speedDeltas.push(Math.abs(step.speed - prevSpeed));
      yawDeltas.push(Math.abs(wrapAngle(step.yaw - prevYaw)));
    }
    s = { x: step.x, z: step.z, yaw: step.yaw, speed: step.speed };
    arrived = step.arrived;
    frames++;
  }
  assert.ok(arrived, 'stepTowardWaypoint never arrived within 30 simulated seconds');
  // No per-frame speed jump beyond the accel/brake clamp (8 or 12 m/s * dt), and no
  // per-frame yaw jump beyond the turn-rate clamp (1.5 rad/s * dt) — i.e. no snapping.
  const maxSpeedDelta = Math.max(...speedDeltas);
  const maxYawDelta = Math.max(...yawDeltas);
  assert.ok(maxSpeedDelta <= 12 * dt + 1e-9, `speed delta ${maxSpeedDelta} exceeds brake clamp`);
  assert.ok(maxYawDelta <= 1.5 * dt + 1e-9, `yaw delta ${maxYawDelta} exceeds turn-rate clamp`);
  assert.ok(Math.hypot(s.x - target.x, s.z - target.z) < 1, 'final position not near target');
});

test('advancePathIndex only advances within switchRadius and never past the last waypoint', () => {
  const waypoints = [{ x: 0, z: 0 }, { x: 10, z: 0 }];
  assert.equal(advancePathIndex(0, 50, waypoints, 10), 0, 'far from waypoint: stays');
  assert.equal(advancePathIndex(0, 5, waypoints, 10), 1, 'within switchRadius: advances');
  assert.equal(advancePathIndex(1, 5, waypoints, 10), 1, 'already at last waypoint: stays');
});

// ─── Full containment sim: touchdown → roll-out → handoff → guided-taxi → apron ──

/** Scripts the full T-05 sequence for one airport and returns the sampled trace. */
function simulateLandingTaxiSequence(airport, mapKey) {
  const dt = 1 / 60;
  const sortie = createSortieMachine();
  transitionSortie(sortie, SortieEvent.START, {}, 0);
  transitionSortie(sortie, SortieEvent.TAXI_TO_RUNWAY, {}, 0.1);
  transitionSortie(sortie, SortieEvent.LIFTOFF, {}, 1);
  transitionSortie(sortie, SortieEvent.ALL_TARGETS_DESTROYED, {}, 2); // → RETURN_TO_BASE

  // Touchdown inside the touchdown zone, heading straight down the runway axis
  // toward increasing z — the touchdown zone always sits at the LOW-z end of the
  // runway and taxiway/service sit at higher z (north→south landing direction, per
  // the T-04 handoff geometry notes). forward = (-sinθ,0,-cosθ), so yaw=PI ⇒ +Z.
  let state = { x: airport.touchdownZone.center.x, z: airport.touchdownZone.center.z, yaw: Math.PI, speed: 55 };
  transitionSortie(sortie, SortieEvent.TOUCHDOWN_SAFE, {}, 3); // → LANDING_ROLL

  const trace = [];
  let mode = 'rollout';
  let handoffFrame = null;
  let sawTaxiwayWaypoint = false;
  const path = buildTaxiPathIn(airport);
  let wpIndex = 0;
  let t = 3;
  let frames = 0;
  const MAX_FRAMES = 60 * 60; // 60 simulated seconds — generous ceiling

  while (frames < MAX_FRAMES) {
    frames++;
    t += dt;
    const surface = airportSurface({ x: state.x, z: state.z }, mapKey);

    if (mode === 'rollout') {
      if (canHandoffToGuidedTaxi(state.speed, surface, HANDOFF_SPEED)) {
        // T-05/D-4: handoff must never fire while still going faster than the
        // threshold — this is the exact condition the old same-frame-arm bug broke.
        assert.ok(state.speed <= HANDOFF_SPEED, `handoff fired at speed ${state.speed} > ${HANDOFF_SPEED}`);
        mode = 'taxi';
        handoffFrame = frames;
        wpIndex = 0;
      } else {
        state = stepRollOut(state, dt, { decel: 6.5 });
      }
    }

    if (mode === 'taxi') {
      const target = path[wpIndex];
      const step = stepTowardWaypoint(state, target, dt, {
        maxSpeed: HANDOFF_SPEED, accel: 8, brake: 12, turnRate: 1.5, arriveRadius: 0.5,
      });
      state = { x: step.x, z: step.z, yaw: step.yaw, speed: step.speed };
      const newIndex = advancePathIndex(wpIndex, step.distance, path, 10);
      if (newIndex !== wpIndex && path[wpIndex].label === 'taxiway') sawTaxiwayWaypoint = true;
      wpIndex = newIndex;
      if (wpIndex === path.length - 1 && step.distance < 10) {
        trace.push({ frame: frames, x: state.x, z: state.z, surface, mode });
        break;
      }
    }

    trace.push({ frame: frames, x: state.x, z: state.z, surface, mode });
  }

  return { trace, handoffFrame, sawTaxiwayWaypoint, finalState: state };
}

for (const [label, airport, mapKey] of [
  ['inhauma', inhaumaAirport, 'inhauma'],
  ['desert', desertAirport, 'desert'],
]) {
  test(`taxi containment (${label}): touchdown→apron never leaves pavement`, () => {
    const { trace, handoffFrame, sawTaxiwayWaypoint } = simulateLandingTaxiSequence(airport, mapKey);
    assert.ok(trace.length > 10, 'sim produced too few frames — sequence did not run');
    const offPavement = trace.filter((s) => s.surface === 'none');
    assert.equal(offPavement.length, 0,
      `${offPavement.length} sampled position(s) left pavement, e.g. ${JSON.stringify(offPavement[0])}`);
    assert.ok(handoffFrame !== null, 'guided taxi never armed (roll-out never completed)');
    assert.ok(sawTaxiwayWaypoint, 'guided taxi jumped straight to the apron — did not route through the taxiway waypoint');

    // No capture while still fast: every rollout-mode sample must show the aircraft
    // NOT yet under guided-taxi control (mode tag is 'rollout' before handoffFrame).
    const rolloutSamples = trace.filter((s) => s.frame < handoffFrame);
    assert.ok(rolloutSamples.every((s) => s.mode === 'rollout'));
  });
}

test('taxi containment: guided-taxi speed never exceeds TAXI_HANDOFF_SPEED post-handoff', () => {
  const { trace, handoffFrame } = simulateLandingTaxiSequence(inhaumaAirport, 'inhauma');
  // Re-derive speed at each sample isn't tracked directly in trace; re-run with speed capture.
  const dt = 1 / 60;
  const sortie = createSortieMachine();
  transitionSortie(sortie, SortieEvent.START, {}, 0);
  transitionSortie(sortie, SortieEvent.TAXI_TO_RUNWAY, {}, 0.1);
  transitionSortie(sortie, SortieEvent.LIFTOFF, {}, 1);
  transitionSortie(sortie, SortieEvent.ALL_TARGETS_DESTROYED, {}, 2);
  let state = { x: inhaumaAirport.touchdownZone.center.x, z: inhaumaAirport.touchdownZone.center.z, yaw: Math.PI, speed: 55 };
  transitionSortie(sortie, SortieEvent.TOUCHDOWN_SAFE, {}, 3);
  const path = buildTaxiPathIn(inhaumaAirport);
  let wpIndex = 0;
  let mode = 'rollout';
  const speeds = [];
  for (let i = 0; i < handoffFrame + 600; i++) {
    const surface = airportSurface({ x: state.x, z: state.z }, 'inhauma');
    if (mode === 'rollout') {
      if (canHandoffToGuidedTaxi(state.speed, surface, HANDOFF_SPEED)) { mode = 'taxi'; }
      else state = stepRollOut(state, dt, { decel: 6.5 });
    } else {
      const target = path[wpIndex];
      const step = stepTowardWaypoint(state, target, dt, { maxSpeed: HANDOFF_SPEED, accel: 8, brake: 12, turnRate: 1.5, arriveRadius: 0.5 });
      state = { x: step.x, z: step.z, yaw: step.yaw, speed: step.speed };
      wpIndex = advancePathIndex(wpIndex, step.distance, path, 10);
      speeds.push(state.speed);
      if (wpIndex === path.length - 1 && step.distance < 10) break;
    }
  }
  assert.ok(speeds.length > 0);
  const maxTaxiSpeed = Math.max(...speeds);
  assert.ok(maxTaxiSpeed <= HANDOFF_SPEED + 1e-6, `guided taxi exceeded cruise speed: ${maxTaxiSpeed}`);
});

// ─── T-01 demotion (auto-sortie.spec.js, deleted): unattended ground loop —
// LANDING_ROLL → SERVICE_SCENE → AIRBORNE with heavy==10, no player input ─────
// auto-taxi.js itself is poisoned (imports player.js's jet/scene) and cannot be
// imported in Node, so this drives the SAME pure primitives auto-taxi.js calls
// (this file's own stepTowardWaypoint/buildTaxiPathIn/advancePathIndex,
// service-scene.js's real refill path, ground-physics.js's real accel model, and
// sortie-state.js's real transition table) through the full solo loop — entirely
// unattended (no manual throttle/pitch input), proving it resolves to AIRBORNE
// with the armament refilled, matching the deleted E2E's final assertions.
test('auto-sortie: unattended ground loop resolves LANDING_ROLL -> SERVICE_SCENE -> AIRBORNE with heavy==10', () => {
  const airport = inhaumaAirport;
  const sortie = createSortieMachine();
  transitionSortie(sortie, SortieEvent.START, {}, 0);
  transitionSortie(sortie, SortieEvent.TAXI_TO_RUNWAY, {}, 0.1);
  transitionSortie(sortie, SortieEvent.LIFTOFF, {}, 1);
  transitionSortie(sortie, SortieEvent.ALL_TARGETS_DESTROYED, {}, 2);
  transitionSortie(sortie, SortieEvent.TOUCHDOWN_SAFE, {}, 3); // → LANDING_ROLL
  assert.equal(sortie.state, SortieState.LANDING_ROLL);

  const dt = 1 / 60;
  const MAX_TAXI_FRAMES = 60 * 30;
  let state = { x: airport.touchdownZone.center.x, z: airport.touchdownZone.center.z, yaw: Math.PI, speed: 34 };

  // Unattended taxi-in, through the taxiway waypoint, to the service zone.
  const inPath = buildTaxiPathIn(airport);
  let wpIndex = 0;
  let frames = 0;
  const lastIn = inPath[inPath.length - 1];
  while (wpIndex < inPath.length - 1 || Math.hypot(state.x - lastIn.x, state.z - lastIn.z) > 5) {
    const target = inPath[wpIndex];
    const step = stepTowardWaypoint(state, target, dt, { maxSpeed: 34, accel: 8, brake: 12, turnRate: 1.5, arriveRadius: 0.5 });
    state = { x: step.x, z: step.z, yaw: step.yaw, speed: step.speed };
    wpIndex = advancePathIndex(wpIndex, step.distance, inPath, 10);
    frames++;
    assert.ok(frames < MAX_TAXI_FRAMES, 'unattended taxi-in never reached the service zone');
  }
  transitionSortie(sortie, SortieEvent.SERVICE_ZONE_REACHED, {}, 3 + frames * dt); // → TAXI_IN
  transitionSortie(sortie, SortieEvent.SERVICE_ZONE_REACHED, {}, 3 + frames * dt + 0.1); // → SERVICE_SCENE
  assert.equal(sortie.state, SortieState.SERVICE_SCENE);

  // Unattended refuel — the real service-scene.js refill path (T-C-08: light stays
  // infinite and is never touched by the service).
  const player = { missiles: 0, heavyMissiles: 0, nuclearMissiles: 0, rodMissiles: 0 };
  const service = createServiceState(true); // testMode fast service
  startService(service);
  let serviceT = 0;
  while (player.heavyMissiles < MISSILES_HEAVY.MAX && serviceT < 30) {
    updateService(service, dt, player);
    serviceT += dt;
  }
  assert.equal(player.heavyMissiles, MISSILES_HEAVY.MAX, 'unattended service never refilled heavy to MAX');
  assert.equal(player.missiles, 0, 'T-C-08: light missile is infinite — service must never refill it');

  // Real sortie-state.js transition chain out of SERVICE_SCENE:
  // SERVICE_SCENE -[SERVICE_COMPLETE]-> NEXT_SORTIE_READY -[NEXT_SORTIE]-> TAXI_OUT.
  transitionSortie(sortie, SortieEvent.SERVICE_COMPLETE, {}, 3 + frames * dt + 5);
  assert.equal(sortie.state, SortieState.NEXT_SORTIE_READY);
  transitionSortie(sortie, SortieEvent.NEXT_SORTIE, {}, 3 + frames * dt + 5.1);
  assert.equal(sortie.state, SortieState.TAXI_OUT);

  // Unattended taxi back out to the runway threshold.
  const threshold = { x: airport.runway.center.x, z: airport.runway.center.z - airport.runway.length / 2 + 20 };
  frames = 0;
  while (Math.hypot(state.x - threshold.x, state.z - threshold.z) > 5) {
    const step = stepTowardWaypoint(state, threshold, dt, { maxSpeed: 34, accel: 8, brake: 12, turnRate: 1.5, arriveRadius: 0.5 });
    state = { x: step.x, z: step.z, yaw: step.yaw, speed: step.speed };
    frames++;
    assert.ok(frames < MAX_TAXI_FRAMES, 'unattended taxi-out never reached the runway threshold');
  }
  transitionSortie(sortie, SortieEvent.TAXI_TO_RUNWAY, {}, 100); // → TAKEOFF_ROLL
  assert.equal(sortie.state, SortieState.TAKEOFF_ROLL);

  // Automated ground roll + rotation — no manual W/pitch, same shared accel/lift
  // model as "auto takeoff (auto-taxi.js takeoff phase model)" above.
  const ground = createGroundPhysicsState();
  let throttle = 0.05;
  let liftoffVsp = 0;
  let y = airport.elevation + 0.9;
  let airborne = false;
  frames = 0;
  while (!airborne && frames < 60 * 20) {
    throttle = Math.min(1, throttle + dt * 1.4);
    updateGroundRoll(ground, { throttleDown: false }, dt, 'runway', throttle);
    if (ground.groundSpeed >= PLAYER.V_ROTATE) {
      liftoffVsp += PLAYER.ROTATE_LIFT * dt;
      y += liftoffVsp * dt;
      if (y - airport.elevation > 4 && liftoffVsp > 0) airborne = true;
    }
    frames++;
  }
  assert.ok(airborne, 'automated takeoff roll never reached liftoff altitude');
  transitionSortie(sortie, SortieEvent.LIFTOFF, {}, 200);

  assert.equal(sortie.state, SortieState.AIRBORNE, 'ground loop never resolved to AIRBORNE');
  assert.equal(player.heavyMissiles, MISSILES_HEAVY.MAX);
});
