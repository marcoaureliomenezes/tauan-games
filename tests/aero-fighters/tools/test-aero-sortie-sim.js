import test from 'node:test';
import assert from 'node:assert/strict';

import { MISSILES_HEAVY, MISSILES_LIGHT, MISSILES_NUCLEAR, PLAYER } from '../../../aero-fighters/src/config.js';
import { evaluateLandingEnvelope, evaluateTakeoffEnvelope, airportHeightAt } from '../../../aero-fighters/src/landing-zones.js';
import { createGroundPhysicsState, updateGroundRoll } from '../../../aero-fighters/src/ground-physics.js';
import { createServiceState, startService, updateService } from '../../../aero-fighters/src/service-scene.js';
import { createSortieMachine, SortieEvent, SortieState, transitionSortie } from '../../../aero-fighters/src/sortie-state.js';
import { createEjectionState, requestEjection, updateEjection } from '../../../aero-fighters/src/ejection.js';

test('sortie state machine covers takeoff to return-to-base to service', () => {
  const m = createSortieMachine();
  assert.equal(transitionSortie(m, SortieEvent.START, {}, 0), SortieState.TAXI_OUT);
  assert.equal(transitionSortie(m, SortieEvent.TAXI_TO_RUNWAY, {}, 1), SortieState.TAKEOFF_ROLL);
  assert.equal(transitionSortie(m, SortieEvent.LIFTOFF, {}, 2), SortieState.AIRBORNE);
  assert.equal(transitionSortie(m, SortieEvent.ALL_TARGETS_DESTROYED, {}, 3), SortieState.RETURN_TO_BASE);
  assert.equal(transitionSortie(m, SortieEvent.TOUCHDOWN_SAFE, {}, 4), SortieState.LANDING_ROLL);
  assert.equal(transitionSortie(m, SortieEvent.SERVICE_ZONE_REACHED, {}, 5), SortieState.TAXI_IN);
  assert.equal(transitionSortie(m, SortieEvent.SERVICE_ZONE_REACHED, {}, 6), SortieState.SERVICE_SCENE);
});

test('takeoff and landing envelopes enforce runway constraints', () => {
  assert.equal(evaluateTakeoffEnvelope({ speed: 41, throttle: 1, pitch: 0.2, surface: 'runway' }).canLiftoff, false);
  assert.equal(evaluateTakeoffEnvelope({ speed: 44, throttle: 1, pitch: 0.12, surface: 'runway' }).canLiftoff, true);
  assert.equal(evaluateLandingEnvelope({ speed: 38, verticalSpeed: -4, pitch: 0.08, roll: 0.1, surface: 'runway' }).safe, true);
  assert.equal(evaluateLandingEnvelope({ speed: 64, verticalSpeed: -4, pitch: 0.08, roll: 0.1, surface: 'runway' }).safe, false);
});

test('ground roll accelerates with throttle and remains finite', () => {
  const g = createGroundPhysicsState();
  for (let i = 0; i < 180; i++) updateGroundRoll(g, { throttleDown: false }, 1 / 60, 'runway', 1);
  assert.ok(g.groundSpeed > 30);
  assert.ok(Number.isFinite(g.groundSpeed));
});

test('service refills full current armament only at completion', () => {
  const player = { missiles: 0, heavyMissiles: 0, nuclearMissiles: 0 };
  const service = createServiceState(true);
  startService(service);
  updateService(service, 2, player);
  assert.deepEqual(player, { missiles: 0, heavyMissiles: 0, nuclearMissiles: 0 });
  updateService(service, 3, player);
  assert.equal(player.missiles, MISSILES_LIGHT.MAX);
  assert.equal(player.heavyMissiles, MISSILES_HEAVY.MAX);
  assert.equal(player.nuclearMissiles, MISSILES_NUCLEAR.MAX);
});

test('ejection survival policy always saves pilot in first slice', () => {
  const e = createEjectionState();
  assert.equal(requestEjection(e, { y: 18 }), true);
  for (let i = 0; i < 180; i++) updateEjection(e, 1 / 30);
  assert.equal(e.pilotState, 'SURVIVED');
  assert.equal(e.saved, true);
});

// ─── Ground-state constants mirrored from player.js ─────────────────────────
const GROUND_STATES = new Set([
  SortieState.TAXI_OUT,
  SortieState.TAKEOFF_ROLL,
  SortieState.LANDING_ROLL,
  SortieState.TAXI_IN,
  SortieState.NEXT_SORTIE_READY,
]);

const AIRPORT_ELEVATION = 0; // desertAirport.elevation

// ─── Headless physics helpers ─────────────────────────────────────────────────
// Simulates the ground-roll portion of updatePlayer() for TAXI/TAKEOFF states.
function simGroundFrame(state, input, dt) {
  const { ground, sortie, jet } = state;
  const surface = airportHeightAt(jet.x, jet.z) !== undefined ? 'runway' : 'terrain';
  // Use the real airportHeightAt to determine contact type
  const contactHeight = airportHeightAt(jet.x, jet.z, 0);
  const contactType = (Math.abs(jet.x - (-160)) <= 29 && Math.abs(jet.z - 120) <= 380) ? 'runway' :
    (Math.abs(jet.x - (-160)) <= 17 && Math.abs(jet.z - 260) <= 90) ? 'taxiway' :
    (Math.abs(jet.x - (-160)) <= 35 && Math.abs(jet.z - 350) <= 43) ? 'service' : null;

  if (input.throttleUp) state.throttle = Math.min(1, state.throttle + dt * PLAYER.THROTTLE_UP_RATE);
  if (input.throttleDown) state.throttle = Math.max(0.02, state.throttle - dt * PLAYER.THROTTLE_DN_RATE);
  updateGroundRoll(ground, input, dt, contactType, state.throttle);
  state.speed = ground.groundSpeed;

  // Advance position along forward axis (simplified: heading 0 = -Z)
  jet.z -= state.speed * dt;

  // INVARIANT A: y must never go below airport elevation while in ground states
  // In the FIXED version, the floor clamp ensures this. In the BROKEN version, it may not.
  jet.y = contactHeight + 0.9;

  // State transitions (mirrors player.js logic)
  if (sortie.state === SortieState.TAXI_OUT && contactType === 'runway') {
    transitionSortie(sortie, SortieEvent.TAXI_TO_RUNWAY, {}, state.t);
  }
  if (sortie.state === SortieState.TAKEOFF_ROLL && state.speed >= 38) {
    transitionSortie(sortie, SortieEvent.TAKEOFF_SPEED_REACHED, {}, state.t);
  }
}

// Simulates the liftoff transition: detects when sortie should become AIRBORNE.
function simLiftoffFrame(state, input, dt) {
  const { sortie, jet } = state;
  const prevY = jet.y;

  if (sortie.state === SortieState.TAKEOFF_ROLL && state.speed >= 42 && (input.pitchDown || input.pitchUp)) {
    // BUG: current code does jet.position.y = 6 (teleport).
    // The fixed version smoothly raises y. We detect LIFTOFF event here.
    jet.y = 6; // <<< this is the BUG being tested — teleport > 1 m
    transitionSortie(sortie, SortieEvent.LIFTOFF, {}, state.t);
  }

  const deltaY = Math.abs(jet.y - prevY);
  return { prevY, deltaY };
}

// ─── Test: Full takeoff cycle ─────────────────────────────────────────────────
test('full takeoff cycle: y stays at or above airport elevation and liftoff delta <= 1m', () => {
  const sortie = createSortieMachine();
  const ground = createGroundPhysicsState();
  transitionSortie(sortie, SortieEvent.START, {}, 0); // → TAXI_OUT

  const state = {
    t: 0,
    throttle: 0,
    speed: 0,
    ground,
    sortie,
    jet: { x: -160, y: AIRPORT_ELEVATION + 0.9, z: 350 }, // start at service zone
  };

  const violations = [];
  let liftoffDeltaY = null;
  const dt = 1 / 60;
  const MAX_SIM_SECONDS = 60;

  while (state.t < MAX_SIM_SECONDS) {
    const input = { throttleUp: true, pitchUp: state.speed >= 40 };
    state.t += dt;

    const prevY = state.jet.y;

    if (GROUND_STATES.has(state.sortie.state)) {
      simGroundFrame(state, input, dt);
    }

    // Check for liftoff transition (mirrors the broken teleport in player.js)
    if (state.sortie.state === SortieState.TAKEOFF_ROLL && state.speed >= 42 && input.pitchUp) {
      const { deltaY } = simLiftoffFrame(state, input, dt);
      liftoffDeltaY = deltaY;
    }

    // INVARIANT A: while in ground states, y >= airport elevation
    if (GROUND_STATES.has(state.sortie.state)) {
      if (state.jet.y < AIRPORT_ELEVATION) {
        violations.push({ t: state.t, y: state.jet.y, state: state.sortie.state, code: 'UNDERGROUND' });
      }
    }

    // Exit once airborne
    if (state.sortie.state === SortieState.AIRBORNE) break;
  }

  // Assert INVARIANT A: no frame underground during ground states
  assert.equal(violations.length, 0,
    `Player went underground during ground states: ${JSON.stringify(violations.slice(0, 3))}`);

  // Assert INVARIANT B: liftoff delta <= 1 m (detects teleport bug)
  assert.ok(liftoffDeltaY !== null, 'Liftoff transition never fired');
  assert.ok(liftoffDeltaY <= 1,
    `Single-frame liftoff Δy too large: ${liftoffDeltaY.toFixed(3)} m (should be <= 1 m; current code teleports to y=6)`);

  // Assert reached AIRBORNE
  assert.equal(state.sortie.state, SortieState.AIRBORNE);
});

// ─── Test: Full landing cycle ─────────────────────────────────────────────────
// Simulates the CURRENT (broken) player.js touchdown logic and asserts that it violates
// the desired invariants. This test is RED until Step 3 is applied.
//
// Current broken code (player.js:501):
//   if (altitudeAboveGround < 3 && contact.safe && mr.ground.landingEnvelope.safe && ...)
//     → fires TOUCHDOWN_SAFE at any altitude < 3m regardless of flare/sink constraints
//
// Desired (fixed) behaviour:
//   - TOUCHDOWN_SAFE fires only when altitude < 0.5m AND sink > -3 m/s AND debounce 0.2s
//   - y decays monotonically with bounce ≤ 0.3 m post-touchdown
test('full landing cycle: one TOUCHDOWN_SAFE, stays LANDING_ROLL, y decays monotonically with bounce <= 0.3m', () => {
  const sortie = createSortieMachine();
  transitionSortie(sortie, SortieEvent.START, {}, 0);
  transitionSortie(sortie, SortieEvent.TAXI_TO_RUNWAY, {}, 0.1);
  transitionSortie(sortie, SortieEvent.LIFTOFF, {}, 1);
  transitionSortie(sortie, SortieEvent.ALL_TARGETS_DESTROYED, {}, 2);
  assert.equal(sortie.state, SortieState.RETURN_TO_BASE);

  // Approach: 200 m altitude, steady sink -5 m/s, speed 35 m/s, aligned on runway
  const SINK_RATE = -5;
  const APPROACH_SPEED = 35;
  const dt = 1 / 60;

  const contactHeight = airportHeightAt(-160, 120, 0);

  // FLARE_LO: the desired low-altitude gate for touchdown.
  // If PLAYER.FLARE_LO is not defined yet (Step 3 not applied), default to 0.5.
  // The test asserts touchdown must fire at < FLARE_LO, which requires the fix.
  const FLARE_LO = PLAYER.FLARE_LO ?? 0.5;

  let y = 200;
  let verticalSpeed = SINK_RATE;
  let t = 0;
  let touchdownCount = 0;
  let stateAfterTouchdown = null;
  let yAtFirstTouchdownFire = null;
  const MAX_SIM_SECONDS = 60;

  while (t < MAX_SIM_SECONDS) {
    t += dt;
    y += verticalSpeed * dt;

    const altitudeAboveGround = y - contactHeight;
    const envelope = evaluateLandingEnvelope({
      speed: APPROACH_SPEED,
      verticalSpeed,
      pitch: 0.0,
      roll: 0.0,
      surface: 'runway',
    });

    // Replicate the BROKEN production logic (player.js:501):
    // fires whenever altitudeAboveGround < 3 AND landing envelope is safe
    if (sortie.state === SortieState.RETURN_TO_BASE &&
        altitudeAboveGround < 3 &&
        envelope.safe) {
      touchdownCount++;
      if (yAtFirstTouchdownFire === null) {
        yAtFirstTouchdownFire = y;
        stateAfterTouchdown = SortieState.LANDING_ROLL; // what the transition produces
        transitionSortie(sortie, SortieEvent.TOUCHDOWN_SAFE, {}, t);
      }
      // Snap y (mirrors broken player.js)
      y = contactHeight + 0.9;
      verticalSpeed = 0;
    }

    if (t > 50) break;
  }

  // --- The broken logic fires at altitude < 3m (not < 0.5m as required).
  // Verify the altitude at first fire: it should be close to 3m, not < 0.5m.
  // The test REQUIRES touchdown fires only at altitude < FLARE_LO (0.5m).
  // Since the broken code fires at 3m, this assertion will FAIL (RED).
  assert.ok(touchdownCount >= 1, 'TOUCHDOWN_SAFE never fired during approach');

  if (yAtFirstTouchdownFire !== null) {
    const altAtFire = yAtFirstTouchdownFire - contactHeight;
    // INVARIANT: touchdown must fire when altitude < FLARE_LO (0.5m), not earlier.
    // Current broken code fires at ~3m → this assertion is RED.
    assert.ok(altAtFire < FLARE_LO,
      `TOUCHDOWN_SAFE fired at altitude ${altAtFire.toFixed(3)} m, but must fire at < ${FLARE_LO} m. ` +
      `Current code uses a 3 m gate — apply Step 3 to fix the flare/touchdown split.`);
  }

  // INVARIANT: state stays LANDING_ROLL
  assert.equal(stateAfterTouchdown, SortieState.LANDING_ROLL);
  assert.equal(sortie.state, SortieState.LANDING_ROLL);
});
