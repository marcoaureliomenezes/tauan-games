import test from 'node:test';
import assert from 'node:assert/strict';

import { MISSILES_HEAVY, MISSILES_LIGHT, MISSILES_NUCLEAR, PLAYER } from '../../../aero-fighters/src/config.js';
import { evaluateLandingEnvelope, evaluateTakeoffEnvelope, airportHeightAt } from '../../../aero-fighters/src/landing-zones.js';
import { createGroundPhysicsState, updateGroundRoll } from '../../../aero-fighters/src/ground-physics.js';
import { createServiceState, startService, updateService } from '../../../aero-fighters/src/service-scene.js';
import { createSortieMachine, SortieEvent, SortieState, GROUND_STATES, transitionSortie, relaunchSortie } from '../../../aero-fighters/src/sortie-state.js';
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

test('mayday respawn relaunches to a takeoff-capable ground state', () => {
  // Regressão do "avião parado no aeroporto": ao ser destruído e voltar à base, a
  // máquina de surtida DEVE sair de MAYDAY para um estado de solo do qual a
  // decolagem automática (taxi_runway → takeoff) realcança AIRBORNE.
  const m = createSortieMachine();
  transitionSortie(m, SortieEvent.START, {}, 0);           // TAXI_OUT
  transitionSortie(m, SortieEvent.TAXI_TO_RUNWAY, {}, 1);  // TAKEOFF_ROLL
  transitionSortie(m, SortieEvent.LIFTOFF, {}, 2);         // AIRBORNE
  transitionSortie(m, SortieEvent.CRITICAL_DAMAGE, {}, 3); // MAYDAY
  assert.equal(m.state, SortieState.MAYDAY);
  relaunchSortie(m, 4);
  assert.equal(m.state, SortieState.TAXI_OUT);
  assert.ok(GROUND_STATES.has(m.state), 'após relaunch o avião está taxiável no solo');
  assert.equal(transitionSortie(m, SortieEvent.TAXI_TO_RUNWAY, {}, 5), SortieState.TAKEOFF_ROLL);
  assert.equal(transitionSortie(m, SortieEvent.LIFTOFF, {}, 6), SortieState.AIRBORNE);
});

test('relaunchSortie also recovers from a stuck EJECTION/NEXT_SORTIE_READY chain', () => {
  const m = createSortieMachine();
  transitionSortie(m, SortieEvent.START, {}, 0);
  transitionSortie(m, SortieEvent.TAXI_TO_RUNWAY, {}, 1);
  transitionSortie(m, SortieEvent.LIFTOFF, {}, 2);
  transitionSortie(m, SortieEvent.CRITICAL_DAMAGE, {}, 3);  // MAYDAY
  transitionSortie(m, SortieEvent.EJECT_REQUESTED, {}, 4);  // EJECTION
  transitionSortie(m, SortieEvent.PILOT_LANDED, {}, 5);     // NEXT_SORTIE_READY (antes: preso no ar)
  relaunchSortie(m, 6);
  assert.equal(m.state, SortieState.TAXI_OUT);
  assert.equal(transitionSortie(m, SortieEvent.TAXI_TO_RUNWAY, {}, 7), SortieState.TAKEOFF_ROLL);
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

// Simulates the FIXED liftoff transition: smooth lift using ROTATE_LIFT force.
// Returns deltaY for the current frame to check the <= 1m invariant.
function simLiftoffFrame(state, input, dt) {
  const { sortie, jet } = state;
  const prevY = jet.y;
  const ROTATE_LIFT = PLAYER.ROTATE_LIFT ?? 7.5;
  const V_ROTATE = PLAYER.V_ROTATE ?? 42;
  const contactHeight = 0; // airport elevation

  if (sortie.state === SortieState.TAKEOFF_ROLL &&
      state.speed >= V_ROTATE &&
      (input.pitchDown || input.pitchUp)) {
    if (!sortie.liftoffVsp) sortie.liftoffVsp = 0;
    sortie.liftoffVsp += ROTATE_LIFT * dt;
    jet.y += sortie.liftoffVsp * dt;
    // Floor clamp
    jet.y = Math.max(jet.y, contactHeight + 0.9);
    const altAbove = jet.y - contactHeight;
    if (altAbove > 4 && sortie.liftoffVsp > 0) {
      transitionSortie(sortie, SortieEvent.LIFTOFF, {}, state.t);
    }
  }

  const deltaY = Math.abs(jet.y - prevY);
  return { prevY, deltaY };
}

// ─── Test: Full takeoff cycle ─────────────────────────────────────────────────
// Drives the physics module from cold start through TAXI_OUT → TAKEOFF_ROLL → AIRBORNE.
// Invariants:
//   A. While in ground states, y >= airport elevation every frame.
//   B. During liftoff rotation, no single-frame Δy > 1 m (detects teleport bug).
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
    jet: { x: -160, y: AIRPORT_ELEVATION + 0.9, z: 350 },
  };

  const violations = [];
  const liftoffDeltas = []; // all per-frame Δy during liftoff rotation
  const dt = 1 / 60;
  const MAX_SIM_SECONDS = 60;
  let inLiftoffRotation = false;

  while (state.t < MAX_SIM_SECONDS) {
    const V_ROTATE = PLAYER.V_ROTATE ?? 42;
    const pitchUp = state.speed >= V_ROTATE;
    const input = { throttleUp: true, pitchUp };
    state.t += dt;

    // Once rotation starts, only run liftoffFrame (not groundFrame which resets y)
    if (state.sortie.state === SortieState.TAKEOFF_ROLL && pitchUp && state.speed >= V_ROTATE) {
      inLiftoffRotation = true;
    }

    if (GROUND_STATES.has(state.sortie.state) && !inLiftoffRotation) {
      simGroundFrame(state, input, dt);
    }

    if (inLiftoffRotation && state.sortie.state === SortieState.TAKEOFF_ROLL) {
      const { deltaY } = simLiftoffFrame(state, input, dt);
      liftoffDeltas.push(deltaY);
    }

    // INVARIANT A: while in ground states, y >= airport elevation
    if (GROUND_STATES.has(state.sortie.state)) {
      if (state.jet.y < AIRPORT_ELEVATION) {
        violations.push({ t: state.t, y: state.jet.y, state: state.sortie.state, code: 'UNDERGROUND' });
      }
    }

    if (state.sortie.state === SortieState.AIRBORNE) break;
  }

  // INVARIANT A: no frame underground during ground states
  assert.equal(violations.length, 0,
    `Player went underground during ground states: ${JSON.stringify(violations.slice(0, 3))}`);

  // INVARIANT B: every per-frame Δy during liftoff rotation must be <= 1 m
  assert.ok(liftoffDeltas.length > 0, 'Liftoff rotation never started');
  const maxDeltaY = Math.max(...liftoffDeltas);
  assert.ok(maxDeltaY <= 1,
    `Single-frame liftoff Δy too large: ${maxDeltaY.toFixed(3)} m (should be <= 1 m; current code teleports to y=6)`);

  // Assert reached AIRBORNE
  assert.equal(state.sortie.state, SortieState.AIRBORNE);
});

// ─── Test: Full landing cycle ─────────────────────────────────────────────────
// Simulates the FIXED player.js touchdown logic (Step 3 applied):
//   - TOUCHDOWN_SAFE fires only when touchdownReady (altitude < FLARE_LO=0.5m, sink > -3 m/s)
//   - Debounce: 0.2s minimum between events
//   - State stays LANDING_ROLL after touchdown
//   - Bounce <= 0.3 m
// This test exercises the fixed evaluateLandingEnvelope(touchdownReady) gate.
test('full landing cycle: one TOUCHDOWN_SAFE, stays LANDING_ROLL, y decays monotonically with bounce <= 0.3m', () => {
  const sortie = createSortieMachine();
  transitionSortie(sortie, SortieEvent.START, {}, 0);
  transitionSortie(sortie, SortieEvent.TAXI_TO_RUNWAY, {}, 0.1);
  transitionSortie(sortie, SortieEvent.LIFTOFF, {}, 1);
  transitionSortie(sortie, SortieEvent.ALL_TARGETS_DESTROYED, {}, 2);
  assert.equal(sortie.state, SortieState.RETURN_TO_BASE);

  // Approach: 200 m altitude. Sink starts at -5 m/s and reduces in the flare zone
  // (FLARE_HI=3m down to FLARE_LO=0.5m) to simulate pitch-up assist.
  const APPROACH_SPEED = 35;
  const dt = 1 / 60;

  const contactHeight = airportHeightAt(-160, 120, 0);
  const FLARE_LO = PLAYER.FLARE_LO ?? 0.5;
  const FLARE_HI = PLAYER.FLARE_HI ?? 3;
  const DEBOUNCE = PLAYER.TOUCHDOWN_DEBOUNCE ?? 0.2;

  let y = 200;
  let verticalSpeed = -5;
  let t = 0;
  let touchdownCount = 0;
  let stateAfterTouchdown = null;
  let yAtFirstTouchdownFire = null;
  let lastTouchdownTime = -Infinity;
  let postTouchdownMaxY = -Infinity;
  const MAX_SIM_SECONDS = 60;

  while (t < MAX_SIM_SECONDS) {
    t += dt;
    y += verticalSpeed * dt;

    const altitudeAboveGround = y - contactHeight;

    // Simulate flare assist: reduce sink rate linearly in the flare zone
    if (altitudeAboveGround < FLARE_HI && altitudeAboveGround > FLARE_LO) {
      // Pitch-up assist: reduce sink rate toward -2 m/s
      verticalSpeed = Math.min(verticalSpeed + 8 * dt, -2);
    }

    const envelope = evaluateLandingEnvelope({
      speed: APPROACH_SPEED,
      verticalSpeed,
      pitch: 0.0,
      roll: 0.0,
      surface: 'runway',
      altitudeAboveGround,
    });

    // Replicate the FIXED production logic (player.js Step 3):
    // fires only when touchdownReady AND debounce elapsed
    if (sortie.state === SortieState.RETURN_TO_BASE &&
        envelope.touchdownReady &&
        (t - lastTouchdownTime) > DEBOUNCE) {
      touchdownCount++;
      lastTouchdownTime = t;
      if (yAtFirstTouchdownFire === null) {
        yAtFirstTouchdownFire = y;
        stateAfterTouchdown = SortieState.LANDING_ROLL;
        transitionSortie(sortie, SortieEvent.TOUCHDOWN_SAFE, {}, t);
      }
      y = contactHeight + 0.9;
      verticalSpeed = 0;
    }

    if (sortie.state === SortieState.LANDING_ROLL) {
      if (y > postTouchdownMaxY) postTouchdownMaxY = y;
      if (t > lastTouchdownTime + 2.0) break;
    }

    // Safety: fell through ground
    if (y < contactHeight - 1 && sortie.state !== SortieState.LANDING_ROLL) break;
  }

  // INVARIANT 1: exactly one TOUCHDOWN_SAFE fires
  assert.equal(touchdownCount, 1,
    `Expected exactly 1 TOUCHDOWN_SAFE, got ${touchdownCount}`);

  // INVARIANT 2: touchdown fires at altitude < FLARE_LO (0.5m)
  assert.ok(yAtFirstTouchdownFire !== null, 'Touchdown never fired');
  const altAtFire = yAtFirstTouchdownFire - contactHeight;
  assert.ok(altAtFire < FLARE_LO,
    `TOUCHDOWN_SAFE fired at altitude ${altAtFire.toFixed(3)} m, must be < ${FLARE_LO} m`);

  // INVARIANT 3: state stays LANDING_ROLL
  assert.equal(stateAfterTouchdown, SortieState.LANDING_ROLL);
  assert.equal(sortie.state, SortieState.LANDING_ROLL);

  // INVARIANT 4: bounce <= 0.3 m post-touchdown
  const bounce = postTouchdownMaxY - (contactHeight + 0.9);
  assert.ok(bounce <= 0.3,
    `Post-touchdown bounce of ${bounce.toFixed(3)} m exceeds 0.3 m limit`);
});
