// taxi-core.js — pure ground-taxi kinematics + pavement-path helpers (T-05, D-4/D-10).
// No DOM/THREE — Node-safe, so the deterministic sim (test-aero-taxi-sim.js) drives it
// directly. Consumed by auto-taxi.js (waypoint-follow) and player.js (roll-out→guided-
// taxi handoff decision).
//
// Root cause this module fixes (SPEC D-4): the OLD code armed auto-taxi in the SAME
// frame as touchdown — while the aircraft was still doing landing speed — and drove it
// in a straight line toward the service-zone waypoint, independent of the runway axis.
// The FIX is two-part: (1) a roll-out phase (owned by player.js's existing ground-state
// block — plain deceleration along the current heading, no waypoint-seeking) runs until
// `canHandoffToGuidedTaxi` is true; (2) guided taxi, once armed, follows an ordered
// waypoint PATH along the airport's own pavement centerlines (runway → taxiway →
// service) instead of a single direct point, so it can never cut a corner off pavement.

/** Wraps an angle (radians) to (-PI, PI]. */
export function wrapAngle(a) {
  return ((a + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
}

/**
 * True only when guided taxi may take over from the player-controlled roll-out
 * (D-4): ground speed has decayed to the handoff threshold AND the aircraft sits on
 * ANY paved surface (never 'none'). Both conditions are required — a wheels-down
 * aircraft still rolling fast MUST stay under player control.
 */
export function canHandoffToGuidedTaxi(groundSpeed, surface, handoffSpeed) {
  return groundSpeed <= handoffSpeed && surface !== 'none';
}

/**
 * Ordered waypoint path along the airport's own pavement centerlines, from wherever
 * guided taxi arms (the roll-out endpoint, still somewhere on the runway) to the
 * apron. Every airport in this game (desert/inhauma/islands/rio) shares one x/z
 * centerline across runway → taxiway → serviceZone (a straight, single-axis layout —
 * see `specs/memory/product/aero-strike-world.md`), so routing through each rect's
 * own center keeps every leg of the path inside the union of paved rectangles.
 */
export function buildTaxiPathIn(airport) {
  return [
    { x: airport.taxiway.center.x, z: airport.taxiway.center.z, label: 'taxiway' },
    { x: airport.serviceZone.center.x, z: airport.serviceZone.center.z, label: 'service' },
  ];
}

/** Reverse path: apron/taxiway back out to the runway hold-short point, used by the
 *  post-service taxi-out-to-runway leg. `direction` selects which threshold end (+1 =
 *  the far end from the touchdown zone, matching the existing taxi_runway target). */
export function buildTaxiPathOut(airport, direction = 1) {
  const r = airport.runway;
  return [
    { x: airport.taxiway.center.x, z: airport.taxiway.center.z, label: 'taxiway' },
    { x: r.center.x, z: r.center.z + direction * (r.length / 2 - 40), label: 'runway-hold' },
  ];
}

/**
 * One integration step of accel/brake-clamped, turn-rate-limited "drive along the
 * nose toward a waypoint" kinematics (extracted from the former auto-taxi.js
 * `_driveTo`, now pure/testable). Pure numeric state in/out — no THREE, no jet mesh.
 *
 * @param {{x:number,z:number,yaw:number,speed:number}} state - current ground state
 * @param {{x:number,z:number}} target - waypoint to steer toward
 * @param {number} dt - seconds
 * @param {{maxSpeed?:number,accel?:number,brake?:number,turnRate?:number,arriveRadius?:number}} opts
 * @returns {{x:number,z:number,yaw:number,speed:number,distance:number,arrived:boolean}}
 */
export function stepTowardWaypoint(state, target, dt, opts = {}) {
  const {
    maxSpeed = 34,
    accel = 8,
    brake = 12,
    turnRate = 1.5,
    arriveRadius = 0.5,
  } = opts;
  const { x, z, yaw, speed } = state;
  const dx = target.x - x;
  const dz = target.z - z;
  const dist = Math.hypot(dx, dz);
  if (dist <= arriveRadius) {
    return { x, z, yaw, speed: 0, distance: dist, arrived: true };
  }
  // Slows near the target for a smooth stop; delta-speed clamped so there is no
  // step-change in velocity frame to frame (no snapping, no teleports).
  const vTarget = Math.min(maxSpeed, Math.max(6, dist * 1.2));
  const delta = vTarget - speed;
  const maxDelta = (delta > 0 ? accel : brake) * dt;
  const v = speed + Math.max(-maxDelta, Math.min(maxDelta, delta));
  const ux = dx / dist;
  const uz = dz / dist;
  // The jet's nose is local -Z: forward = (-sinθ, 0, -cosθ) ⇒ θ = atan2(-ux, -uz).
  const targetYaw = Math.atan2(-ux, -uz);
  const yawErr = wrapAngle(targetYaw - yaw);
  const maxTurn = turnRate * dt;
  const nyaw = yaw + Math.max(-maxTurn, Math.min(maxTurn, yawErr));
  const step = Math.min(dist, v * dt);
  const nx = x + -Math.sin(nyaw) * step;
  const nz = z + -Math.cos(nyaw) * step;
  const nspeed = dist > 1 ? v : 0;
  return { x: nx, z: nz, yaw: nyaw, speed: nspeed, distance: dist, arrived: false };
}

/**
 * Advances a waypoint-path index once the current target has been reached (distance
 * inside `switchRadius`). Pure — caller owns/persists the index across frames.
 */
export function advancePathIndex(index, distance, waypoints, switchRadius = 10) {
  if (index < waypoints.length - 1 && distance < switchRadius) return index + 1;
  return index;
}

/**
 * Plain roll-out deceleration along the CURRENT heading (no steering toward any
 * waypoint) — models the player-controlled roll-out leg for the Node sim, mirroring
 * the natural drag/brake deceleration `ground-physics.js#updateGroundRoll` already
 * applies in the real game (this helper exists so the taxi-containment sim can drive
 * a heading-only rollout without importing THREE/jet).
 */
export function stepRollOut(state, dt, opts = {}) {
  const { decel = 6, minSpeed = 0 } = opts;
  const { x, z, yaw, speed } = state;
  const nspeed = Math.max(minSpeed, speed - decel * dt);
  const nx = x + -Math.sin(yaw) * nspeed * dt;
  const nz = z + -Math.cos(yaw) * nspeed * dt;
  return { x: nx, z: nz, yaw, speed: nspeed };
}
