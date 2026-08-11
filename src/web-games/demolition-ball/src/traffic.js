// Street traffic on the road-grid graph. Cars drive node-to-node, keep to the
// right-hand lane, queue behind each other, brake for the demolition rig — and
// get launched into the air if the ball catches them.

import {
  v3, vlen, vsub, clamp, mulberry32, qFromEuler, qFromAxisAngle, qmul, wrapAngle,
} from './math.js';
import { GRID, SPAN, CITY_HALF } from './city.js';

const LANE = 4.0;
const CAR_COLORS = [
  [0.72, 0.14, 0.12], [0.10, 0.24, 0.55], [0.85, 0.84, 0.82],
  [0.12, 0.13, 0.15], [0.18, 0.45, 0.28], [0.82, 0.66, 0.12],
  [0.45, 0.46, 0.50], [0.60, 0.30, 0.55],
];

function roadCoord(i) { return -CITY_HALF + i * SPAN; }

export function edgeKey(a, b) {
  return a.i + a.j * 16 <= b.i + b.j * 16
    ? `${a.i},${a.j}-${b.i},${b.j}`
    : `${b.i},${b.j}-${a.i},${a.j}`;
}

export class Traffic {
  /** @param {object|null} river city.river — severs off-bridge crossings (R-07). */
  constructor(count = 34, seed = 77, river = null) {
    this.rand = mulberry32(seed);
    this.cars = [];
    this.nodes = [];
    for (let i = 0; i <= GRID; i++) {
      for (let j = 0; j <= GRID; j++) this.nodes.push({ i, j, x: roadCoord(i), z: roadCoord(j) });
    }
    // Permanently severed edges (the river without a bridge) plus temporarily
    // closed ones (the cone crew, R-11) — both consulted the same way.
    this.severedEdges = new Set();
    this.closedEdges = new Set();
    if (river) {
      for (let j = 0; j <= GRID; j++) {
        if (!river.bridges.includes(j)) {
          this.severedEdges.add(edgeKey({ i: river.leftRoad, j }, { i: river.rightRoad, j }));
        }
      }
    }
    for (let n = 0; n < count; n++) this.cars.push(this.spawnCar());
  }

  isBlocked(a, b) {
    const k = edgeKey(a, b);
    return this.severedEdges.has(k) || this.closedEdges.has(k);
  }

  spawnCar() {
    const r = this.rand;
    const i = Math.floor(r() * (GRID + 1));
    const j = Math.floor(r() * (GRID + 1));
    const horizontal = r() < 0.5;
    const dir = r() < 0.5 ? 1 : -1;
    const from = { i, j };
    let to = horizontal
      ? { i: clamp(i + dir, 0, GRID), j }
      : { i, j: clamp(j + dir, 0, GRID) };
    if (from.i === to.i && from.j === to.j) { to.i = clamp(i + 1, 0, GRID); }
    // Never spawn onto a severed/closed edge; north-south roads are always open.
    if (this.isBlocked(from, to)) {
      to = { i, j: clamp(j + (j < GRID ? 1 : -1), 0, GRID) };
    }
    // Vehicle variety (R-10): sedan / pickup / van-bus, same driving brain.
    const roll = r();
    const model = roll < 0.55 ? 'sedan' : roll < 0.8 ? 'pickup' : 'van';
    return {
      from, to,
      t: r(),
      speed: 8 + r() * 6,
      cruise: 8 + r() * 6,
      model,
      color: CAR_COLORS[Math.floor(r() * CAR_COLORS.length)],
      pos: v3(),
      yaw: 0,
      alive: true,
      respawn: 0,
    };
  }

  nodePos(n) { return v3(roadCoord(n.i), 0, roadCoord(n.j)); }

  update(dt, rig, debris) {
    const ball = rig.ball;
    for (const car of this.cars) {
      if (!car.alive) {
        car.respawn -= dt;
        if (car.respawn <= 0) Object.assign(car, this.spawnCar());
        continue;
      }

      const a = this.nodePos(car.from);
      const b = this.nodePos(car.to);
      const seg = vsub(b, a);
      const segLen = vlen(seg);
      const dirx = seg.x / segLen, dirz = seg.z / segLen;
      // Right-hand lane offset (right of travel = rotate dir by -90deg).
      const offx = -dirz * LANE, offz = dirx * LANE;

      car.pos.x = a.x + seg.x * car.t + offx;
      car.pos.z = a.z + seg.z * car.t + offz;
      car.yaw = Math.atan2(dirx, dirz);

      // Obstacle checks: the rig, and the ball itself.
      let target = car.cruise;
      const dRig = Math.hypot(car.pos.x - rig.pos.x, car.pos.z - rig.pos.z);
      if (dRig < 16) {
        const ahead = (rig.pos.x - car.pos.x) * dirx + (rig.pos.z - car.pos.z) * dirz;
        if (ahead > -2) target = Math.max(0, (dRig - 7) * 1.1);
      }
      for (const other of this.cars) {
        if (other === car || !other.alive) continue;
        if (other.from.i !== car.from.i || other.from.j !== car.from.j
          || other.to.i !== car.to.i || other.to.j !== car.to.j) continue;
        const gap = (other.t - car.t) * segLen;
        if (gap > 0 && gap < 13) target = Math.min(target, Math.max(0, (gap - 6) * 1.4));
      }
      car.speed += clamp(target - car.speed, -22 * dt, 9 * dt);
      car.speed = Math.max(0, car.speed);

      car.t += (car.speed * dt) / segLen;
      if (car.t >= 1) {
        car.t -= 1;
        const prev = car.from;
        car.from = car.to;
        car.to = this.pickNext(car.from, prev);
      }

      // Wrecking-ball impact: the car is written off and thrown.
      const dBall = Math.hypot(car.pos.x - ball.pos.x, car.pos.y + 0.9 - ball.pos.y, car.pos.z - ball.pos.z);
      const ballSpeed = vlen(ball.vel);
      if (dBall < ball.radius + 2.4 && ballSpeed > 3.5) {
        this.wreck(car, debris, ball);
      }
    }
  }

  pickNext(node, avoid) {
    const all = [];
    if (node.i > 0) all.push({ i: node.i - 1, j: node.j });
    if (node.i < GRID) all.push({ i: node.i + 1, j: node.j });
    if (node.j > 0) all.push({ i: node.i, j: node.j - 1 });
    if (node.j < GRID) all.push({ i: node.i, j: node.j + 1 });
    // A blocked edge is simply not a road; every node keeps at least one open
    // neighbour (north-south roads are never severed).
    const opts = all.filter((o) => !this.isBlocked(node, o));
    const forward = opts.filter((o) => !(o.i === avoid.i && o.j === avoid.j));
    const pool = forward.length ? forward : (opts.length ? opts : all);
    return pool[Math.floor(this.rand() * pool.length)];
  }

  wreck(car, debris, ball) {
    car.alive = false;
    car.respawn = 8 + this.rand() * 10;
    const push = v3(
      (car.pos.x - ball.pos.x) * 1.2 + ball.vel.x * 0.35,
      6 + Math.random() * 5,
      (car.pos.z - ball.pos.z) * 1.2 + ball.vel.z * 0.35,
    );
    debris.spawnChunk(v3(car.pos.x, 1.0, car.pos.z), v3(1.0, 0.55, 2.1), car.color, push, 0.6);
    debris.spawnChunk(v3(car.pos.x, 1.5, car.pos.z), v3(0.7, 0.4, 0.9), [0.2, 0.25, 0.3],
      v3(push.x * 0.6, push.y * 1.2, push.z * 0.6), 0.7);
    debris.spawnSparks(v3(car.pos.x, 1.2, car.pos.z), 14, v3(0, 1, 0));
    debris.spawnDust(v3(car.pos.x, 1.2, car.pos.z), 12, 2.5, [0.5, 0.5, 0.52], 1.6, 2.4);
  }

  render(renderer) {
    const GLASS = [0.15, 0.19, 0.24];
    const HEAD = [1.0, 0.96, 0.72];
    const TAIL = [0.72, 0.10, 0.08];
    for (const car of this.cars) {
      if (!car.alive) continue;
      const q = qFromEuler(0, car.yaw, 0);
      const cy = Math.cos(car.yaw), sy = Math.sin(car.yaw);
      // Local (lx=right, lz=forward) -> world.
      const at = (lx, ly, lz) => v3(car.pos.x + lx * cy + lz * sy, ly, car.pos.z - lx * sy + lz * cy);
      const wheelQ = qmul(q, qFromAxisAngle(v3(0, 0, 1), Math.PI / 2));
      const wheels = (positions, radius = 0.42) => {
        for (const [lx, lz] of positions) {
          renderer.pushCylinder(at(lx, radius, lz), radius, 0.16, wheelQ, [0.08, 0.08, 0.09], 0.85);
        }
      };
      const lights = (halfW, y, front, rear) => {
        for (const s of [-1, 1]) {
          renderer.pushBox(at(s * halfW, y, front), v3(0.14, 0.08, 0.05), q, HEAD, 0.15);
          renderer.pushBox(at(s * halfW, y, rear), v3(0.14, 0.08, 0.05), q, TAIL, 0.3);
        }
      };

      if (car.model === 'pickup') {
        renderer.pushBox(at(0, 0.85, 0), v3(0.98, 0.40, 2.45), q, car.color, 0.3);
        renderer.pushBox(at(0, 1.48, 0.95), v3(0.90, 0.38, 0.75), q, car.color, 0.3);
        renderer.pushBox(at(0, 1.52, 1.05), v3(0.78, 0.26, 0.55), q, GLASS, 0.12);
        renderer.pushBox(at(0, 1.28, -1.15), v3(0.82, 0.10, 1.05), q, [0.16, 0.16, 0.18], 0.7);
        wheels([[-0.98, 1.55], [0.98, 1.55], [-0.98, -1.55], [0.98, -1.55]], 0.46);
        lights(0.62, 0.92, 2.44, -2.44);
      } else if (car.model === 'van') {
        renderer.pushBox(at(0, 1.05, 0), v3(1.04, 0.72, 2.85), q, car.color, 0.35);
        renderer.pushBox(at(0, 1.62, 0.4), v3(1.06, 0.24, 2.1), q, GLASS, 0.12);
        wheels([[-1.02, 1.9], [1.02, 1.9], [-1.02, -1.9], [1.02, -1.9]], 0.44);
        lights(0.66, 0.78, 2.84, -2.84);
      } else {
        renderer.pushBox(at(0, 0.85, 0), v3(0.95, 0.42, 2.15), q, car.color, 0.25);
        renderer.pushBox(at(0, 1.45, 0), v3(0.82, 0.36, 1.15), q, GLASS, 0.12);
        wheels([[-0.95, 1.4], [0.95, 1.4], [-0.95, -1.4], [0.95, -1.4]]);
        lights(0.60, 0.85, 2.14, -2.14);
      }
    }
  }

  get aliveCars() { return this.cars.filter((c) => c.alive); }
}

export { wrapAngle };
