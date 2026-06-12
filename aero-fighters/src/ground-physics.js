import { evaluateLandingEnvelope, evaluateTakeoffEnvelope } from './landing-zones.js';

export const GroundConstants = Object.freeze({
  GROUND_ACCEL: 18,
  GROUND_FRICTION: 4,
  BRAKE_DECEL: 18,
  TAKEOFF_MIN_SPEED: 42,
  ROTATION_SPEED: 38,
  MIN_LIFTOFF_PITCH: 0.10,
});

export function createGroundPhysicsState() {
  return {
    wheelContact: true,
    groundSpeed: 0,
    verticalSpeed: 0,
    gearState: 'DEPLOYED',
    lastContact: null,
    takeoffEnvelope: evaluateTakeoffEnvelope({ speed: 0, throttle: 0, pitch: 0, surface: 'runway' }),
    landingEnvelope: evaluateLandingEnvelope({ speed: 0, verticalSpeed: 0, pitch: 0, roll: 0, surface: 'runway' }),
  };
}

export function updateGroundRoll(state, input, dt, surface, throttle) {
  const accel = throttle * GroundConstants.GROUND_ACCEL;
  const braking = input.throttleDown ? GroundConstants.BRAKE_DECEL : GroundConstants.GROUND_FRICTION;
  // Arrasto quadrático de rolagem — velocidade terminal ~62 m/s no solo
  // (18 = 4 + 0.0035·v² → v ≈ 63). Sem isso o roll acelerava sem limite.
  const drag = 0.0035 * state.groundSpeed * state.groundSpeed;
  state.groundSpeed = Math.max(0, state.groundSpeed + (accel - braking - drag) * dt);
  state.wheelContact = surface === 'runway' || surface === 'taxiway' || surface === 'service';
  state.gearState = state.wheelContact || state.groundSpeed < 54 ? 'DEPLOYED' : 'RETRACTED';
  return state;
}

export function syncFlightGroundDiagnostics(state, data) {
  const altitudeAboveGround = data.altitudeAboveGround ?? null;
  state.verticalSpeed = data.verticalSpeed ?? state.verticalSpeed;
  state.groundSpeed = data.groundSpeed ?? data.speed ?? state.groundSpeed;
  state.lastContact = data.contact ?? state.lastContact;
  state.wheelContact = altitudeAboveGround !== null &&
    altitudeAboveGround < 1.25 &&
    (data.surface === 'runway' || data.surface === 'taxiway' || data.surface === 'service');
  state.gearState = altitudeAboveGround !== null && altitudeAboveGround < 12 ? 'DEPLOYED' : 'RETRACTED';
  state.takeoffEnvelope = evaluateTakeoffEnvelope({
    speed: data.speed,
    throttle: data.throttle,
    pitch: data.pitch,
    surface: data.surface,
  });
  state.landingEnvelope = evaluateLandingEnvelope({
    speed: data.speed,
    verticalSpeed: data.verticalSpeed,
    pitch: data.pitch,
    roll: data.roll,
    surface: data.surface,
    altitudeAboveGround,
  });
  return state;
}
