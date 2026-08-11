// Isolation crew (SPEC v0.9.0 R-11, ADR-3). Near the contract target the HUD
// offers "CHAMAR EQUIPE 🚧" (also the C key): a work van drives in, a helper in
// an orange vest walks the block perimeter placing cones, and traffic stops
// entering the block while the cones are down. Once per contract; when the
// target is finished the helper collects every cone and the van leaves.

import { v3, clamp, qFromEuler, qFromAxisAngle, qmul } from './math.js';
import { BLOCK, ROAD, SPAN, GRID, CITY_HALF } from './city.js';
import { edgeKey } from './traffic.js';

const VAN_SPEED = 13;
const WALK_SPEED = 2.3;
const PLACE_TIME = 0.55;          // seconds per cone
const CONE_RING = BLOCK / 2 + 4.2; // cones sit just past the sidewalk, on the road
const CALL_RADIUS = 30;

const roadCoord = (g) => -CITY_HALF + g * SPAN;
const blockCentre = (g) => -CITY_HALF + g * SPAN + ROAD / 2 + BLOCK / 2;

function edgeList(gx, gz) {
  // The four graph edges bordering block (gx, gz).
  return [
    [{ i: gx, j: gz }, { i: gx, j: gz + 1 }],
    [{ i: gx + 1, j: gz }, { i: gx + 1, j: gz + 1 }],
    [{ i: gx, j: gz }, { i: gx + 1, j: gz }],
    [{ i: gx, j: gz + 1 }, { i: gx + 1, j: gz + 1 }],
  ];
}

export class Crew {
  constructor() {
    this.state = 'idle';
    this.usedContract = null;     // missions.index the crew already served
    this.cones = [];              // {x, z}
    this.van = null;              // {pos, yaw, waypoints, wpIndex}
    this.helper = null;           // {pos, yaw, phase, goal}
    this.block = null;            // {gx, gz, x, z}
    this.conePlan = [];           // planned cone spots, in placement order
    this.planIndex = 0;
    this.placeClock = 0;
    this.closedKeys = [];
  }

  /** The nearest unfinished target of the current contract, or null. */
  targetOf(missions) {
    const m = missions && missions.current;
    if (!m || m.done) return null;
    const th = missions.thresholdOf();
    return m.targets.find((t) => t.progress < th) || null;
  }

  /** Button/key availability (AC-5): idle, unused this contract, rig <= 30 m. */
  available(missions, rig) {
    if (this.state !== 'idle') return false;
    if (!missions || missions.index === this.usedContract) return false;
    const t = this.targetOf(missions);
    if (!t) return false;
    const d = Math.hypot(t.center.x - rig.pos.x, t.center.z - rig.pos.z);
    return d <= CALL_RADIUS;
  }

  call(missions, rig) {
    if (!this.available(missions, rig)) return false;
    const t = this.targetOf(missions);
    const gx = clamp(Math.round((t.center.x - blockCentre(0)) / SPAN), 0, GRID - 1);
    const gz = clamp(Math.round((t.center.z - blockCentre(0)) / SPAN), 0, GRID - 1);
    const bx = blockCentre(gx);
    const bz = blockCentre(gz);
    this.block = { gx, gz, x: bx, z: bz };
    this.usedContract = missions.index;

    // Cone ring, starting at the SW corner, counter-clockwise, ~9 m apart.
    this.conePlan = [];
    const R = CONE_RING;
    const perSide = 7;
    const sides = [
      (k) => ({ x: bx - R + (2 * R * k) / perSide, z: bz - R }),
      (k) => ({ x: bx + R, z: bz - R + (2 * R * k) / perSide }),
      (k) => ({ x: bx + R - (2 * R * k) / perSide, z: bz + R }),
      (k) => ({ x: bx - R, z: bz + R - (2 * R * k) / perSide }),
    ];
    for (const side of sides) for (let k = 0; k < perSide; k++) this.conePlan.push(side(k));
    this.planIndex = 0;
    this.cones = [];

    // Van route: in from the south map edge along the west road, park at the
    // SW corner of the block.
    const vx = roadCoord(gx) + 4;
    const park = { x: bx - R - 2, z: bz - R - 2 };
    this.van = {
      pos: v3(vx, 0, -CITY_HALF - 90),
      yaw: 0,
      waypoints: [v3(vx, 0, park.z), v3(park.x, 0, park.z)],
      wpIndex: 0,
      park,
    };
    this.helper = null;
    this.state = 'driving';
    return true;
  }

  closeBlock(traffic) {
    this.closedKeys = [];
    for (const [a, b] of edgeList(this.block.gx, this.block.gz)) {
      const key = edgeKey(a, b);
      traffic.closedEdges.add(key);
      this.closedKeys.push(key);
    }
  }

  openBlock(traffic) {
    for (const key of this.closedKeys) traffic.closedEdges.delete(key);
    this.closedKeys = [];
  }

  moveToward(agent, goal, speed, dt) {
    const dx = goal.x - agent.pos.x;
    const dz = goal.z - agent.pos.z;
    const dl = Math.hypot(dx, dz);
    if (dl < 0.4) return true;
    const step = Math.min(speed * dt, dl);
    agent.pos.x += (dx / dl) * step;
    agent.pos.z += (dz / dl) * step;
    agent.yaw = Math.atan2(dx, dz);
    if (agent.phase !== undefined) agent.phase += step * 5.2;
    return false;
  }

  update(dt, missions, traffic) {
    if (this.state === 'idle') return;
    const t = this.targetOf(missions);
    const contractDone = !missions.current || missions.current.done
      || missions.index !== this.usedContract || !t;

    if (this.state === 'driving') {
      const wp = this.van.waypoints[this.van.wpIndex];
      if (this.moveToward(this.van, wp, VAN_SPEED, dt)) {
        this.van.wpIndex++;
        if (this.van.wpIndex >= this.van.waypoints.length) {
          this.helper = { pos: v3(this.van.pos.x + 1.5, 0, this.van.pos.z + 1.5), yaw: 0, phase: 0 };
          this.closeBlock(traffic);
          this.state = 'placing';
          this.placeClock = 0;
        }
      }
    } else if (this.state === 'placing') {
      if (this.planIndex >= this.conePlan.length) {
        this.state = 'holding';
      } else {
        const spot = this.conePlan[this.planIndex];
        if (this.moveToward(this.helper, spot, WALK_SPEED, dt)) {
          this.placeClock += dt;
          if (this.placeClock >= PLACE_TIME) {
            this.cones.push({ x: spot.x, z: spot.z });
            this.planIndex++;
            this.placeClock = 0;
          }
        }
      }
      if (contractDone) this.state = 'collecting';   // target fell mid-placement
    } else if (this.state === 'holding') {
      if (contractDone) this.state = 'collecting';
    } else if (this.state === 'collecting') {
      if (!this.cones.length) {
        if (this.moveToward(this.helper, this.van.park, WALK_SPEED, dt)) {
          this.openBlock(traffic);
          this.van.waypoints = [v3(this.van.pos.x, 0, -CITY_HALF - 110)];
          this.van.wpIndex = 0;
          this.helper = null;
          this.state = 'leaving';
        }
      } else {
        const last = this.cones[this.cones.length - 1];
        if (this.moveToward(this.helper, last, WALK_SPEED * 1.25, dt)) {
          this.cones.pop();
        }
      }
    } else if (this.state === 'leaving') {
      if (this.moveToward(this.van, this.van.waypoints[0], VAN_SPEED, dt)) {
        this.van = null;
        this.block = null;
        this.state = 'idle';
      }
    }
  }

  render(renderer, camTarget, drawMax) {
    const IQ = { x: 0, y: 0, z: 0, w: 1 };
    // Cones: orange cylinder + base plate + white band.
    for (const c of this.cones) {
      if (Math.hypot(c.x - camTarget.x, c.z - camTarget.z) > drawMax) continue;
      renderer.pushBox(v3(c.x, 0.05, c.z), v3(0.26, 0.05, 0.26), IQ, [0.85, 0.32, 0.05], 0.8);
      renderer.pushCylinder(v3(c.x, 0.34, c.z), 0.15, 0.28, IQ, [0.95, 0.38, 0.06], 0.6);
      renderer.pushCylinder(v3(c.x, 0.40, c.z), 0.125, 0.05, IQ, [0.95, 0.95, 0.92], 0.5);
    }
    if (this.van) {
      const q = qFromEuler(0, this.van.yaw, 0);
      const cy = Math.cos(this.van.yaw), sy = Math.sin(this.van.yaw);
      const at = (lx, ly, lz) => v3(this.van.pos.x + lx * cy + lz * sy, ly, this.van.pos.z - lx * sy + lz * cy);
      renderer.pushBox(at(0, 1.05, 0), v3(1.05, 0.72, 2.9), q, [0.95, 0.60, 0.10], 0.35);
      renderer.pushBox(at(0, 1.62, 0.5), v3(1.07, 0.22, 1.9), q, [0.15, 0.19, 0.24], 0.12);
      renderer.pushBox(at(0, 0.62, 0), v3(1.06, 0.14, 2.91), q, [0.92, 0.92, 0.90], 0.5);
      const wq = qmul(q, qFromAxisAngle(v3(0, 0, 1), Math.PI / 2));
      for (const [lx, lz] of [[-1.03, 1.9], [1.03, 1.9], [-1.03, -1.9], [1.03, -1.9]]) {
        renderer.pushCylinder(at(lx, 0.44, lz), 0.44, 0.16, wq, [0.08, 0.08, 0.09], 0.85);
      }
    }
    if (this.helper) {
      const h = this.helper;
      const q = qFromEuler(0, h.yaw, 0);
      const cy = Math.cos(h.yaw), sy = Math.sin(h.yaw);
      const right = { x: cy, z: -sy };
      const swing = Math.sin(h.phase) * 0.5;
      for (const side of [-1, 1]) {
        const a = swing * side;
        const lq = qFromAxisAngle(v3(right.x, 0, right.z), a);
        renderer.pushCylinder(
          v3(h.pos.x + right.x * 0.10 * side + Math.sin(h.yaw) * Math.sin(a) * 0.42,
            0.86 - Math.cos(a) * 0.44,
            h.pos.z + right.z * 0.10 * side + Math.cos(h.yaw) * Math.sin(a) * 0.42),
          0.075, 0.44, lq, [0.25, 0.28, 0.36], 0.85,
        );
      }
      renderer.pushBox(v3(h.pos.x, 1.25, h.pos.z), v3(0.17, 0.35, 0.11), q, [1.0, 0.45, 0.05], 0.7);
      renderer.pushSphere(v3(h.pos.x, 1.73, h.pos.z), 0.115, q, [0.85, 0.62, 0.45], 0.75);
      renderer.pushSphere(v3(h.pos.x, 1.86, h.pos.z), 0.135, q, [0.98, 0.85, 0.10], 0.5); // capacete
    }
  }
}
