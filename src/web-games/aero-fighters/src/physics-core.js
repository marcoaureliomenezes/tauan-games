// physics-core.js — pure helpers for Aero Fighters tests and runtime.

export function clampDt(dt, max = 0.1) {
  if (!Number.isFinite(dt) || dt < 0) return 0;
  return Math.min(dt, max);
}

export function converge(current, target, rate, dt) {
  const k = Math.min(1, Math.max(0, rate * dt));
  return current + (target - current) * k;
}

export function throttleStep(throttle, input, cfg, dt) {
  let next = throttle;
  if (input.throttleUp) next += dt * cfg.THROTTLE_UP_RATE;
  if (input.throttleDown) next -= dt * cfg.THROTTLE_DN_RATE;
  return Math.max(0.05, Math.min(1.0, next));
}

export function speedFromThrottle(throttle, cfg) {
  return cfg.MIN_SPD + throttle * (cfg.MAX_SPD - cfg.MIN_SPD);
}

export function updateSpeed(speed, throttle, cfg, dt) {
  return Math.max(2, converge(speed, speedFromThrottle(throttle, cfg), cfg.CONVERGE_RATE, dt));
}

export function isStalled(speed, cfg) {
  return speed < cfg.STALL_SPD;
}

export function boundedAxisDelta(active, rate, dt, direction = 1) {
  return active ? direction * rate * dt : 0;
}

export function altitudeAboveTerrain(y, terrainHeight) {
  return y - terrainHeight;
}

export function terrainCollision(y, terrainHeight, cfg) {
  if (y < cfg.SEA_CRASH_Y) return 'SEA';
  if (y < terrainHeight + cfg.MOUNTAIN_BUFFER) return 'MOUNTAIN';
  return null;
}

export function homingVelocity(current, desired, turnRate) {
  const k = Math.max(0, Math.min(1, turnRate));
  return {
    x: current.x + (desired.x - current.x) * k,
    y: current.y + (desired.y - current.y) * k,
    z: current.z + (desired.z - current.z) * k,
  };
}

export function vectorLength(v) {
  return Math.hypot(v.x, v.y, v.z);
}

export function normalize(v, scale = 1) {
  const len = vectorLength(v) || 1;
  return { x: (v.x / len) * scale, y: (v.y / len) * scale, z: (v.z / len) * scale };
}

export function validateFiniteState(label, state) {
  const bad = [];
  function walk(prefix, value) {
    if (typeof value === 'number' && !Number.isFinite(value)) bad.push(prefix);
    else if (value && typeof value === 'object') {
      for (const [k, v] of Object.entries(value)) walk(`${prefix}.${k}`, v);
    }
  }
  walk(label, state);
  return bad;
}
