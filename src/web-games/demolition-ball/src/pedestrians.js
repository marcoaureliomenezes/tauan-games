// Pedestrians (SPEC v0.9.0 R-09). Little articulated walkers on the sidewalks:
// they loop around their block, cut across plazas, pace over the bridges — and
// scatter when the wrecking ball comes close. They are NEVER harmed: the ball
// passes straight through them (this is a game for a 3-year-old), they just run.

import { v3, clamp, mulberry32, wrapAngle, qFromEuler, qFromAxisAngle, vlen } from './math.js';
import { BLOCK, ROAD, SPAN, GRID, CITY_HALF, RIVER_COL } from './city.js';

const SHIRT_COLORS = [
  [0.82, 0.30, 0.25], [0.24, 0.42, 0.72], [0.92, 0.78, 0.25], [0.30, 0.62, 0.38],
  [0.85, 0.85, 0.88], [0.60, 0.35, 0.68], [0.95, 0.55, 0.20], [0.35, 0.70, 0.72],
];
const PANTS_COLORS = [
  [0.20, 0.24, 0.35], [0.28, 0.28, 0.30], [0.42, 0.32, 0.24], [0.16, 0.30, 0.26],
];
const SKIN_TONES = [
  [0.98, 0.80, 0.66], [0.85, 0.62, 0.45], [0.62, 0.44, 0.31], [0.45, 0.31, 0.22],
];

const WALK_SPEED = 1.35;
const FLEE_SPEED = 4.2;
const FLEE_RADIUS = 11;
const FLEE_TIME = 2.6;

const blockOrigin = (g) => -CITY_HALF + g * SPAN + ROAD / 2;
const KERB = BLOCK / 2 + 1.6;

export class Pedestrians {
  /**
   * @param {object} city buildCity() result (uses parks, river, bounds)
   * @param {number} count sidewalk walkers (bridge pacers are added on top)
   */
  constructor(city, count = 56, seed = 1313) {
    this.rand = mulberry32(seed);
    this.city = city;
    this.walkers = [];
    const r = this.rand;

    const parkSet = new Set(city.parks.map((p) => `${Math.round(p.x)}|${Math.round(p.z)}`));

    for (let n = 0; n < count; n++) {
      // Any block except the river column hosts walkers.
      let gx = Math.floor(r() * GRID);
      if (gx === RIVER_COL) gx = (gx + 1 + Math.floor(r() * (GRID - 1))) % GRID || (RIVER_COL + 1);
      const gz = Math.floor(r() * GRID);
      const bx = blockOrigin(gx) + BLOCK / 2;
      const bz = blockOrigin(gz) + BLOCK / 2;
      const isPark = parkSet.has(`${Math.round(bx)}|${Math.round(bz)}`);
      this.walkers.push(this.spawnWalker(bx, bz, isPark));
    }

    // Bridge pacers (R-07): two per bridge, one on each sidewalk edge.
    const rv = city.river;
    if (rv) {
      for (const j of rv.bridges) {
        const zj = -CITY_HALF + j * SPAN;
        for (const side of [-1, 1]) {
          const w = this.spawnWalker(rv.x, zj, false);
          w.bridge = { x0: rv.x - rv.half - 8, x1: rv.x + rv.half + 8, z: zj + side * (ROAD / 2 - 0.8) };
          w.pos = v3(w.bridge.x0 + r() * (w.bridge.x1 - w.bridge.x0), 0, w.bridge.z);
          w.dir = r() < 0.5 ? 1 : -1;
          this.walkers.push(w);
        }
      }
    }
  }

  spawnWalker(bx, bz, isPark) {
    const r = this.rand;
    const corners = [
      v3(bx - KERB, 0, bz - KERB), v3(bx + KERB, 0, bz - KERB),
      v3(bx + KERB, 0, bz + KERB), v3(bx - KERB, 0, bz + KERB),
    ];
    const corner = Math.floor(r() * 4);
    return {
      block: { x: bx, z: bz },
      isPark,
      corners,
      corner,
      pos: { ...corners[corner] },
      goal: null,
      yaw: 0,
      phase: r() * Math.PI * 2,
      speedScale: 0.85 + r() * 0.35,
      height: 1.55 + r() * 0.35,
      shirt: SHIRT_COLORS[Math.floor(r() * SHIRT_COLORS.length)],
      pants: PANTS_COLORS[Math.floor(r() * PANTS_COLORS.length)],
      skin: SKIN_TONES[Math.floor(r() * SKIN_TONES.length)],
      flee: 0,
      fleeDir: v3(1, 0, 0),
      bridge: null,
      dir: 1,
    };
  }

  nextGoal(w) {
    const r = this.rand;
    if (w.isPark && r() < 0.45) {
      // Cut across the plaza (R-06/R-09): a random point inside the lawn.
      return v3(
        w.block.x + (r() - 0.5) * (BLOCK - 16),
        0,
        w.block.z + (r() - 0.5) * (BLOCK - 16),
      );
    }
    w.corner = (w.corner + (r() < 0.06 ? 3 : 1)) % 4;   // rarely turn back
    return w.corners[w.corner];
  }

  /** The ball never hurts a walker — proximity only makes them run (R-09). */
  update(dt, rig, world) {
    const ball = rig.ball;
    const ballSpeed = vlen(ball.vel);
    const rv = world ? world.river : this.city.river;

    for (const w of this.walkers) {
      // Fright check: close, fast ball (or the rig itself bearing down).
      const dBall = Math.hypot(w.pos.x - ball.pos.x, w.pos.z - ball.pos.z);
      const dRig = Math.hypot(w.pos.x - rig.pos.x, w.pos.z - rig.pos.z);
      if ((dBall < FLEE_RADIUS && ballSpeed > 4) || dRig < 6) {
        const sx = dBall < dRig ? ball.pos.x : rig.pos.x;
        const sz = dBall < dRig ? ball.pos.z : rig.pos.z;
        let fx = w.pos.x - sx;
        let fz = w.pos.z - sz;
        let dl = Math.hypot(fx, fz);
        if (dl < 0.3) {   // standing right under the threat: any direction works
          fx = Math.sin(w.yaw + 1.3);
          fz = Math.cos(w.yaw + 1.3);
          dl = 1;
        }
        w.flee = FLEE_TIME;
        w.fleeDir = v3(fx / dl, 0, fz / dl);
      }

      let vx = 0, vz = 0;
      if (w.flee > 0) {
        w.flee -= dt;
        vx = w.fleeDir.x * FLEE_SPEED;
        vz = w.fleeDir.z * FLEE_SPEED;
        if (w.bridge) vz = 0;               // stay on the deck
      } else if (w.bridge) {
        vx = w.dir * WALK_SPEED * w.speedScale;
        if (w.pos.x > w.bridge.x1) w.dir = -1;
        if (w.pos.x < w.bridge.x0) w.dir = 1;
        w.pos.z += (w.bridge.z - w.pos.z) * Math.min(1, 4 * dt);
      } else {
        if (!w.goal) w.goal = this.nextGoal(w);
        const dx = w.goal.x - w.pos.x;
        const dz = w.goal.z - w.pos.z;
        const dl = Math.hypot(dx, dz);
        if (dl < 0.8) { w.goal = this.nextGoal(w); continue; }
        vx = (dx / dl) * WALK_SPEED * w.speedScale;
        vz = (dz / dl) * WALK_SPEED * w.speedScale;
      }

      let nx = w.pos.x + vx * dt;
      let nz = w.pos.z + vz * dt;

      // Never into a building...
      if (world && world.index) {
        for (const s of world.index.query(nx, nz, 1)) {
          if (s.isFlattened) continue;
          const hx = s.size.x / 2 + 0.5;
          const hz = s.size.z / 2 + 0.5;
          if (Math.abs(nx - s.center.x) < hx && Math.abs(nz - s.center.z) < hz) {
            if (Math.abs(w.pos.x - s.center.x) >= hx) nx = w.pos.x;
            else nz = w.pos.z;
          }
        }
      }
      // ...and never into the water (bridge pacers excepted, they stay on deck).
      if (rv && !w.bridge && !rv.onBridge(nz)) {
        const hx = rv.half + 1.2;
        if (Math.abs(nx - rv.x) < hx) nx = rv.x + Math.sign(nx - rv.x || 1) * hx;
      }

      const moved = Math.hypot(nx - w.pos.x, nz - w.pos.z);
      if (moved > 0.0005) {
        w.yaw = Math.atan2(nx - w.pos.x, nz - w.pos.z);
        w.phase += moved * 5.2;
      }
      w.pos.x = clamp(nx, -CITY_HALF - 60, CITY_HALF + 60);
      w.pos.z = clamp(nz, -CITY_HALF - 60, CITY_HALF + 60);
    }
  }

  render(renderer, camTarget, drawMax) {
    for (const w of this.walkers) {
      const d = Math.hypot(w.pos.x - camTarget.x, w.pos.z - camTarget.z);
      if (d > drawMax) continue;
      const h = w.height;
      const q = qFromEuler(0, w.yaw, 0);
      const cy = Math.cos(w.yaw), sy = Math.sin(w.yaw);
      const right = { x: cy, z: -sy };
      const hipY = h * 0.5;
      const swing = Math.sin(w.phase) * (w.flee > 0 ? 0.8 : 0.5);

      // Legs: two cylinders scissoring around the hip.
      for (const side of [-1, 1]) {
        const a = swing * side;
        const lq = qFromAxisAngle(v3(right.x, 0, right.z), a);
        const ox = right.x * 0.10 * side + Math.sin(w.yaw) * Math.sin(a) * hipY * 0.5;
        const oz = right.z * 0.10 * side + Math.cos(w.yaw) * Math.sin(a) * hipY * 0.5;
        renderer.pushCylinder(
          v3(w.pos.x + ox, hipY - Math.cos(a) * hipY * 0.5, w.pos.z + oz),
          0.075, hipY * 0.5, lq, w.pants, 0.85,
        );
      }
      // Torso + arms + head.
      renderer.pushBox(v3(w.pos.x, h * 0.71, w.pos.z), v3(0.16, h * 0.21, 0.10), q, w.shirt, 0.8);
      for (const side of [-1, 1]) {
        const a = -swing * side * 0.8;
        const aq = qFromAxisAngle(v3(right.x, 0, right.z), a);
        const shY = h * 0.86;
        const ox = right.x * 0.21 * side + Math.sin(w.yaw) * Math.sin(a) * 0.26;
        const oz = right.z * 0.21 * side + Math.cos(w.yaw) * Math.sin(a) * 0.26;
        renderer.pushCylinder(
          v3(w.pos.x + ox, shY - Math.cos(a) * 0.26, w.pos.z + oz),
          0.05, 0.26, aq, w.shirt, 0.85,
        );
      }
      renderer.pushSphere(v3(w.pos.x, h * 0.985, w.pos.z), 0.115, q, w.skin, 0.75);
    }
  }
}

export { wrapAngle };
