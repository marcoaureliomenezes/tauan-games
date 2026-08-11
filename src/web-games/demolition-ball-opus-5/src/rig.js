// The demolition rig: tracked carrier + slewing turret + lattice boom +
// a 4.2-tonne wrecking ball hanging on an inextensible rope.
//
// The ball is a point mass under gravity, constrained to the rope length from
// the boom tip. Because the tip moves with the machine, driving and slewing
// pump the pendulum exactly like the real thing: you build the swing, then
// you land it. Rope tension feeds back into the carrier, so a heavy swing
// visibly tugs the tractor around.

import {
  v3, vadd, vsub, vscale, vaddScaled, vdot, vlen, vnorm, vcross, clamp, lerp,
  qFromAxisAngle, qFromEuler, qmul, qidentity, wrapAngle,
} from './math.js';
import { applyImpact } from './destruction.js';

export const BALL_MASS = 4200;      // kg
export const BALL_RADIUS = 1.75;    // m
const GRAVITY = -19.6;              // slightly punchy gravity for game feel
const BOOM_LENGTH = 15.5;
const ROPE_MIN = 4;
const ROPE_MAX = 26;
const MAX_SPEED = 15.5;
const REVERSE_SPEED = 7;

/** Homing servo defaults (SPEC v0.9.0 R-03); modes may override via world.homingConfig. */
export const HOMING_DEFAULT = { gain: 2.0, maxA: 26, cruise: 14 };

/**
 * Clamp a candidate ball position (SPEC v0.9.0 R-04): never below the ground,
 * never inside a structure footprint. Without a world only the ground clamp
 * applies (the constructor runs before the world exists).
 */
export function safeBallPos(pos, radius, world = null) {
  const p = v3(pos.x, Math.max(pos.y, radius), pos.z);
  if (world && world.index) {
    for (const s of world.index.query(p.x, p.z, radius + 2)) {
      if (s.destroyed >= s.total) continue;
      if (p.y - radius > s.size.y) continue;
      const hx = s.size.x / 2 + radius;
      const hz = s.size.z / 2 + radius;
      const dx = p.x - s.center.x;
      const dz = p.z - s.center.z;
      if (Math.abs(dx) < hx && Math.abs(dz) < hz) {
        const px = hx - Math.abs(dx);
        const pz = hz - Math.abs(dz);
        if (px < pz) p.x = s.center.x + Math.sign(dx || 1) * hx;
        else p.z = s.center.z + Math.sign(dz || 1) * hz;
      }
    }
  }
  return p;
}

/** Shortest-arc quaternion rotating +Y onto `dir`. Used to aim cylinders. */
export function quatFromY(dir) {
  const d = vnorm(dir);
  const dot = clamp(d.y, -1, 1);
  if (dot > 0.99999) return qidentity();
  if (dot < -0.99999) return qFromAxisAngle(v3(1, 0, 0), Math.PI);
  const axis = vnorm(vcross(v3(0, 1, 0), d));
  return qFromAxisAngle(axis, Math.acos(dot));
}

export class Rig {
  constructor(x = 0, z = 0, yaw = 0) {
    this.pos = v3(x, 0, z);
    this.yaw = yaw;
    this.speed = 0;
    this.turretYaw = 0;      // relative to the carrier
    this.boomPitch = 0.62;   // radians above horizon
    this.ropeLen = 13;
    this.bodyRoll = 0;
    this.bodyPitch = 0;

    this.tip = v3();
    this.prevTip = v3();
    this.ball = {
      pos: v3(x, 6, z + 8),
      vel: v3(),
      radius: BALL_RADIUS,
      mass: BALL_MASS,
      spin: qidentity(),
    };
    this.ropeTension = v3();
    this.lastImpact = 0;
    this.impactEvents = [];
    this.computeTip();
    this.ball.pos = safeBallPos(vadd(this.tip, v3(0, -this.ropeLen, 0)), BALL_RADIUS);
    this.prevTip = { ...this.tip };
  }

  get worldTurretYaw() { return this.yaw + this.turretYaw; }

  get forward() { return v3(Math.sin(this.yaw), 0, Math.cos(this.yaw)); }

  get boomDir() {
    const a = this.worldTurretYaw;
    const cp = Math.cos(this.boomPitch);
    return v3(Math.sin(a) * cp, Math.sin(this.boomPitch), Math.cos(a) * cp);
  }

  computeTip() {
    const base = vadd(this.pos, v3(0, 3.5, 0));
    this.tip = vaddScaled(base, this.boomDir, BOOM_LENGTH);
    this.boomBase = base;
  }

  /**
   * @param {object} input {throttle, steer, brake, slew, pitch, rope, pump}
   */
  update(dt, input, world) {
    this.driveCarrier(dt, input, world);
    this.driveBoom(dt, input);
    this.prevTip = { ...this.tip };
    this.computeTip();
    this.stepBall(dt, input, world);
  }

  driveCarrier(dt, input, world) {
    const accel = 13.5;
    const drag = 0.55;
    const target = input.throttle;
    if (target > 0) this.speed += accel * target * dt;
    else if (target < 0) this.speed += accel * 0.75 * target * dt;
    if (input.brake) this.speed *= 1 - Math.min(1, 3.4 * dt);
    this.speed -= this.speed * drag * dt;
    if (Math.abs(target) < 0.01 && !input.brake) this.speed *= 1 - Math.min(1, 1.1 * dt);
    this.speed = clamp(this.speed, -REVERSE_SPEED, MAX_SPEED);

    // Steering authority falls off at crawl speed, like a tracked machine.
    const steerRate = 1.15 * clamp(Math.abs(this.speed) / 4.5, 0, 1);
    this.yaw += input.steer * steerRate * dt * Math.sign(this.speed || 1);
    this.yaw = wrapAngle(this.yaw);

    const fwd = this.forward;
    let nx = this.pos.x + fwd.x * this.speed * dt;
    let nz = this.pos.z + fwd.z * this.speed * dt;

    // Rope tension drags the carrier: a big swing really pulls you sideways.
    const tugScale = dt / 26000;
    nx += this.ropeTension.x * tugScale;
    nz += this.ropeTension.z * tugScale;

    // Collide the carrier against building footprints.
    if (world && world.index) {
      const near = world.index.query(nx, nz, 6);
      for (const s of near) {
        if (s.isFlattened) continue;
        const hx = s.size.x / 2 + 3.2;
        const hz = s.size.z / 2 + 3.2;
        const dx = nx - s.center.x;
        const dz = nz - s.center.z;
        if (Math.abs(dx) < hx && Math.abs(dz) < hz) {
          const px = hx - Math.abs(dx);
          const pz = hz - Math.abs(dz);
          if (px < pz) nx = s.center.x + Math.sign(dx || 1) * hx;
          else nz = s.center.z + Math.sign(dz || 1) * hz;
          this.speed *= 0.35;
        }
      }
    }

    const limit = world && world.bounds ? world.bounds.half + 120 : 1e9;
    this.pos.x = clamp(nx, -limit, limit);
    this.pos.z = clamp(nz, -limit, limit);

    // Suspension-ish body attitude from acceleration and rope pull.
    const lateral = vdot(v3(this.ropeTension.x, 0, this.ropeTension.z), vcross(v3(0, 1, 0), fwd)) / 90000;
    this.bodyRoll = lerp(this.bodyRoll, clamp(-lateral - input.steer * this.speed * 0.012, -0.13, 0.13), 5 * dt);
    this.bodyPitch = lerp(this.bodyPitch, clamp(-target * 0.05, -0.06, 0.06), 4 * dt);
  }

  driveBoom(dt, input) {
    this.turretYaw = wrapAngle(this.turretYaw + input.slew * 1.05 * dt);
    this.boomPitch = clamp(this.boomPitch + input.pitch * 0.75 * dt, 0.12, 1.15);
    this.ropeLen = clamp(this.ropeLen + input.rope * 7.5 * dt, ROPE_MIN, ROPE_MAX);
  }

  stepBall(dt, input, world) {
    const b = this.ball;
    const tipVel = vscale(vsub(this.tip, this.prevTip), 1 / Math.max(dt, 1e-4));

    // --- forces
    b.vel.y += GRAVITY * dt;
    // Aerodynamic drag on a 3.5 m wide steel sphere: light but present.
    const sp = vlen(b.vel);
    if (sp > 0.001) {
      const dragA = 0.0016 * sp;
      b.vel = vaddScaled(b.vel, b.vel, -dragA * dt);
    }
    // Operator "pump". With SPACE held and a homing target available (SPEC
    // v0.9.0 R-03, ADR-2), a velocity servo steers the swing toward the target:
    // capped horizontal acceleration makes the pendulum sweep through the
    // target pass after pass. SHIFT (pump < 0) stays the reverse boom push, and
    // without any target SPACE remains the classic boom-heading pump.
    if (input.pump !== 0) {
      const target = input.pump > 0 && world.homingTarget ? world.homingTarget() : null;
      if (target) {
        const cfg = world.homingConfig || HOMING_DEFAULT;
        const dx = target.x - b.pos.x;
        const dz = target.z - b.pos.z;
        const dl = Math.hypot(dx, dz);
        if (dl > 0.5) {
          const nx = dx / dl;
          const nz = dz / dl;
          const ax = clamp(cfg.gain * (nx * cfg.cruise - b.vel.x), -cfg.maxA, cfg.maxA);
          const az = clamp(cfg.gain * (nz * cfg.cruise - b.vel.z), -cfg.maxA, cfg.maxA);
          b.vel.x += ax * dt;
          b.vel.z += az * dt;
        }
      } else {
        const a = this.worldTurretYaw;
        const push = v3(Math.sin(a), 0, Math.cos(a));
        b.vel = vaddScaled(b.vel, push, input.pump * 15.5 * dt);
      }
    }

    b.pos = vaddScaled(b.pos, b.vel, dt);

    // --- rope constraint (inextensible, pull-only)
    let rel = vsub(b.pos, this.tip);
    let dist = vlen(rel);
    this.ropeSlack = Math.max(0, this.ropeLen - dist);
    if (dist > this.ropeLen) {
      const n = vscale(rel, 1 / dist);
      const correction = dist - this.ropeLen;
      b.pos = vaddScaled(b.pos, n, -correction);
      // Kill only the outward radial velocity relative to the moving tip.
      const vrel = vsub(b.vel, tipVel);
      const radial = vdot(vrel, n);
      if (radial > 0) b.vel = vaddScaled(b.vel, n, -radial * 1.0);
      // Tension magnitude ~ centripetal + gravity component (for feedback + audio).
      const vt = vsub(vrel, vscale(n, radial));
      const tension = b.mass * (vdot(vt, vt) / Math.max(this.ropeLen, 0.5) + Math.abs(GRAVITY) * Math.max(-n.y, 0));
      this.ropeTension = vscale(n, tension);
    } else {
      this.ropeTension = v3(0, 0, 0);
    }

    // --- ground
    if (b.pos.y < b.radius) {
      b.pos.y = b.radius;
      if (b.vel.y < 0) {
        if (b.vel.y < -3) {
          world.debris.spawnDust(v3(b.pos.x, 0.3, b.pos.z), 8, 2.2, [0.6, 0.58, 0.54], 1.4, 1.6);
        }
        b.vel.y *= -0.22;
      }
      b.vel.x *= 1 - Math.min(1, 2.2 * dt);
      b.vel.z *= 1 - Math.min(1, 2.2 * dt);
    }

    // --- structures
    this.collideBallWithStructures(dt, world);

    // Visual spin follows travel direction.
    const travel = vlen(b.vel);
    if (travel > 0.05) {
      const axis = vnorm(vcross(v3(0, 1, 0), b.vel));
      b.spin = qmul(qFromAxisAngle(axis, (travel / b.radius) * dt * 0.6), b.spin);
    }
  }

  collideBallWithStructures(dt, world) {
    const b = this.ball;
    const near = world.index.query(b.pos.x, b.pos.z, b.radius + 4);
    for (const s of near) {
      if (s.destroyed >= s.total) continue;
      // Broad phase against the structure volume.
      if (Math.abs(b.pos.x - s.center.x) > s.size.x / 2 + b.radius + 1) continue;
      if (Math.abs(b.pos.z - s.center.z) > s.size.z / 2 + b.radius + 1) continue;
      if (b.pos.y - b.radius > s.size.y + 1) continue;

      const hits = s.cellsInSphere(b.pos.x, b.pos.y, b.pos.z, b.radius + s.cell * 0.45);
      if (!hits.length) continue;

      // Contact normal = averaged direction from struck cells to the ball.
      let nx = 0, ny = 0, nz = 0;
      const tmp = {};
      const limit = Math.min(hits.length, 12);
      for (let i = 0; i < limit; i++) {
        s.cellCenter(hits[i].x, hits[i].y, hits[i].z, tmp);
        nx += b.pos.x - tmp.x; ny += b.pos.y - tmp.y; nz += b.pos.z - tmp.z;
      }
      let normal = vnorm(v3(nx, ny, nz));
      if (vlen(normal) < 0.5) normal = vnorm(vsub(b.pos, s.center));

      const closing = -vdot(b.vel, normal);
      const contact = vaddScaled(b.pos, normal, -b.radius);

      if (closing > 1.2) {
        // Modo Tauan multiplies impact energy (SPEC v0.9.0 R-02) so a couple of
        // good swings bring a small building down.
        const energy = 0.5 * b.mass * closing * closing * (world.damageMultiplier || 1);
        const dir = vscale(normal, -1);
        const res = applyImpact(s, contact, energy, dir, world.debris, {
          onCollapse: world.onCollapse,
        });
        // Energy spent breaking concrete leaves the ball.
        const ratio = clamp(res.spent / Math.max(energy, 1), 0, 0.92);
        const remaining = Math.sqrt(Math.max(0, 1 - ratio));
        const restitution = res.killed > 0 ? 0.12 : 0.34;
        const vn = vdot(b.vel, normal);
        b.vel = vaddScaled(b.vel, normal, -vn * (1 + restitution));
        b.vel = vscale(b.vel, lerp(remaining, 1, 0.35));
        this.impactEvents.push({
          pos: contact,
          energy,
          killed: res.killed,
          structure: s,
          speed: closing,
        });
        this.lastImpact = performance.now();
      } else {
        // Resting/sliding contact: just resolve penetration.
        const vn = vdot(b.vel, normal);
        if (vn < 0) b.vel = vaddScaled(b.vel, normal, -vn);
      }

      // Push the ball out of the remaining geometry.
      const still = s.cellsInSphere(b.pos.x, b.pos.y, b.pos.z, b.radius);
      if (still.length) {
        const c = s.cellCenter(still[0].x, still[0].y, still[0].z);
        const out = vnorm(vsub(b.pos, c));
        const push = b.radius + s.cell * 0.5 - vlen(vsub(b.pos, c));
        if (push > 0) b.pos = vaddScaled(b.pos, out, push);
      }
    }
  }

  drainImpacts() {
    const e = this.impactEvents;
    this.impactEvents = [];
    return e;
  }

  /** Push the whole machine into the renderer. */
  render(renderer, palette) {
    const bodyQuat = qFromEuler(this.bodyPitch, this.yaw, this.bodyRoll);
    const yellow = [0.86, 0.62, 0.09];
    const dark = [0.13, 0.13, 0.14];
    const steel = [0.34, 0.35, 0.38];

    const local = (lx, ly, lz) => {
      const cy = Math.cos(this.yaw), sy = Math.sin(this.yaw);
      return v3(
        this.pos.x + lx * cy + lz * sy,
        this.pos.y + ly,
        this.pos.z - lx * sy + lz * cy,
      );
    };

    // Tracks
    renderer.pushBox(local(-1.85, 0.85, 0), v3(0.65, 0.85, 3.9), bodyQuat, dark, 0.95);
    renderer.pushBox(local(1.85, 0.85, 0), v3(0.65, 0.85, 3.9), bodyQuat, dark, 0.95);
    for (let i = -3; i <= 3; i++) {
      const q = qmul(bodyQuat, qFromAxisAngle(v3(0, 0, 1), Math.PI / 2));
      renderer.pushCylinder(local(-1.85, 0.85, i * 1.05), 0.72, 0.68, q, [0.09, 0.09, 0.1], 0.9);
      renderer.pushCylinder(local(1.85, 0.85, i * 1.05), 0.72, 0.68, q, [0.09, 0.09, 0.1], 0.9);
    }
    // Hull
    renderer.pushBox(local(0, 1.75, 0), v3(1.9, 0.5, 3.4), bodyQuat, yellow, 0.45);
    // Slewing house
    const houseQuat = qFromEuler(this.bodyPitch, this.worldTurretYaw, this.bodyRoll);
    const hp = local(0, 2.6, 0);
    renderer.pushCylinder(v3(hp.x, 2.25, hp.z), 1.5, 0.28, bodyQuat, steel, 0.5);
    const hx = Math.sin(this.worldTurretYaw), hz = Math.cos(this.worldTurretYaw);
    const housePos = v3(hp.x - hx * 0.9, 3.0, hp.z - hz * 0.9);
    renderer.pushBox(housePos, v3(1.65, 1.05, 2.3), houseQuat, yellow, 0.45);
    // Cab glass
    const cabPos = v3(hp.x + hx * 0.9 + hz * 1.0, 3.15, hp.z + hz * 0.9 - hx * 1.0);
    renderer.pushBox(cabPos, v3(0.85, 0.95, 1.05), houseQuat, [0.18, 0.28, 0.34], 0.15);
    // Counterweight
    const cwPos = v3(hp.x - hx * 3.0, 2.6, hp.z - hz * 3.0);
    renderer.pushBox(cwPos, v3(1.5, 0.9, 0.75), houseQuat, [0.2, 0.2, 0.22], 0.7);

    // Boom (lattice look: main tube + two chords)
    const dir = this.boomDir;
    const mid = vaddScaled(this.boomBase, dir, BOOM_LENGTH / 2);
    const boomQuat = quatFromY(dir);
    renderer.pushCylinder(mid, 0.34, BOOM_LENGTH / 2, boomQuat, yellow, 0.5);
    const side = vnorm(vcross(dir, v3(0, 1, 0)));
    for (const s of [-1, 1]) {
      const o = vaddScaled(mid, side, s * 0.55);
      renderer.pushCylinder(o, 0.11, BOOM_LENGTH / 2, boomQuat, [0.75, 0.55, 0.08], 0.55);
    }
    for (let i = 1; i < 9; i++) {
      const p = vaddScaled(this.boomBase, dir, (BOOM_LENGTH * i) / 9);
      renderer.pushCylinder(p, 0.09, 0.6, quatFromY(side), [0.75, 0.55, 0.08], 0.55);
    }
    // Head sheave
    renderer.pushCylinder(this.tip, 0.42, 0.16, quatFromY(side), steel, 0.35);

    // Rope: sags when slack, straightens under tension.
    const b = this.ball;
    const chord = vsub(b.pos, this.tip);
    const chordLen = vlen(chord);
    const slack = Math.max(0, this.ropeLen - chordLen);
    const SEG = 10;
    let prev = this.tip;
    for (let i = 1; i <= SEG; i++) {
      const t = i / SEG;
      const p = vaddScaled(this.tip, chord, t);
      p.y -= slack * 0.85 * Math.sin(Math.PI * t);
      const seg = vsub(p, prev);
      const len = vlen(seg);
      if (len > 1e-4) {
        renderer.pushCylinder(vaddScaled(prev, seg, 0.5), 0.075, len / 2, quatFromY(seg), [0.16, 0.16, 0.18], 0.55);
      }
      prev = p;
    }

    // Ball + hook shackle
    renderer.pushSphere(b.pos, b.radius, b.spin, [0.26, 0.27, 0.30], 0.32);
    renderer.pushCylinder(v3(b.pos.x, b.pos.y + b.radius + 0.28, b.pos.z), 0.14, 0.32, qidentity(), [0.2, 0.2, 0.22], 0.4);
    void palette;
  }
}
