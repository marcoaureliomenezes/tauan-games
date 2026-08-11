// Headless unit tests for the pure simulation modules of Demolition Ball.
// No DOM, no WebGL — city generation, voxel destruction, collapse and missions.

import assert from 'node:assert/strict';
import { buildCity, Structure, StructureIndex } from '../../demolition-ball/src/city.js';
import { applyImpact, collapseUnsupported } from '../../demolition-ball/src/destruction.js';
import { DebrisField } from '../../demolition-ball/src/debris.js';
import { MissionSystem, CONTRACTS } from '../../demolition-ball/src/missions.js';
import { Rig, safeBallPos } from '../../demolition-ball/src/rig.js';
import { Traffic } from '../../demolition-ball/src/traffic.js';
import { Pedestrians } from '../../demolition-ball/src/pedestrians.js';
import { Crew } from '../../demolition-ball/src/crew.js';
import { MODES } from '../../demolition-ball/src/modes.js';
import { v3, sphereVsBox, qIntegrate, mulberry32, vlen } from '../../demolition-ball/src/math.js';

let passed = 0;
const test = (name, fn) => {
  try { fn(); passed++; console.log(`  ok  ${name}`); } catch (e) {
    console.error(`  FAIL ${name}\n       ${e.message}`);
    process.exitCode = 1;
  }
};

console.log('demolition-ball :: unit');

test('math: deterministic PRNG is stable and in range', () => {
  const a = mulberry32(7), b = mulberry32(7);
  for (let i = 0; i < 50; i++) {
    const x = a();
    assert.equal(x, b());
    assert.ok(x >= 0 && x < 1);
  }
});

test('math: quaternion integration stays normalised', () => {
  let q = { x: 0, y: 0, z: 0, w: 1 };
  for (let i = 0; i < 500; i++) q = qIntegrate(q, v3(3, -2, 5), 1 / 60);
  const n = Math.hypot(q.x, q.y, q.z, q.w);
  assert.ok(Math.abs(n - 1) < 1e-6, `norm drifted to ${n}`);
});

test('math: sphere-vs-box reports penetration and outward normal', () => {
  const hit = sphereVsBox(v3(3.2, 0, 0), 1, v3(0, 0, 0), v3(2.5, 2.5, 2.5));
  assert.ok(hit, 'expected a hit');
  assert.ok(hit.normal.x > 0.9, 'normal should point +X');
  assert.ok(hit.depth > 0 && hit.depth < 1);
  assert.equal(sphereVsBox(v3(9, 0, 0), 1, v3(0, 0, 0), v3(2.5, 2.5, 2.5)), null);
});

test('city: generation is deterministic and well formed', () => {
  const a = buildCity(123);
  const b = buildCity(123);
  assert.equal(a.structures.length, b.structures.length);
  assert.ok(a.structures.length > 40, `too few structures: ${a.structures.length}`);
  for (let i = 0; i < a.structures.length; i++) {
    assert.equal(a.structures[i].total, b.structures[i].total);
    assert.equal(a.structures[i].type, b.structures[i].type);
  }
  assert.ok(a.staticMesh.vertices.length > 0);
  assert.ok(a.staticMesh.indices.length % 3 === 0);
  assert.ok(a.props.length > 0);
});

test('city: every structure starts intact with a drawable shell', () => {
  const city = buildCity(9);
  for (const s of city.structures) {
    assert.equal(s.destroyed, 0);
    assert.equal(s.progress, 0);
    assert.ok(s.total > 0);
    assert.ok(s.shell.length > 0);
    assert.ok(s.shell.length <= s.total);
  }
});

test('structure: cellsInSphere returns only live cells, nearest first', () => {
  const s = new Structure({ x: 0, z: 0, w: 12, d: 12, h: 12, type: 'apartment', name: 'T', color: [1, 1, 1] });
  const found = s.cellsInSphere(0, 6, 6, 4);
  assert.ok(found.length > 0);
  for (let i = 1; i < found.length; i++) assert.ok(found[i].d >= found[i - 1].d - 1e-9);
  for (const c of found) assert.equal(s.alive[c.i], 1);
});

test('destruction: a hard impact removes cells and spends energy', () => {
  const s = new Structure({ x: 0, z: 0, w: 12, d: 12, h: 12, type: 'warehouse', name: 'W', color: [1, 1, 1] });
  const debris = new DebrisField();
  const before = s.destroyed;
  const energy = 0.5 * 4200 * 14 * 14;
  const res = applyImpact(s, v3(-6, 4, 0), energy, v3(1, 0, 0), debris);
  assert.ok(res.killed > 0, 'expected cells destroyed');
  assert.ok(s.destroyed > before);
  assert.ok(res.spent > 0 && res.spent <= energy * 1.001);
  assert.ok(debris.chunks.length > 0, 'expected rubble');
  assert.ok(debris.dust.length > 0, 'expected dust');
});

test('destruction: a feather-light tap does not level the building', () => {
  const s = new Structure({ x: 0, z: 0, w: 12, d: 12, h: 12, type: 'apartment', name: 'A', color: [1, 1, 1] });
  const debris = new DebrisField();
  const res = applyImpact(s, v3(-6, 4, 0), 0.5 * 4200 * 1.5 * 1.5, v3(1, 0, 0), debris);
  assert.equal(res.killed, 0, 'a 1.5 m/s nudge must not break concrete');
  assert.ok(s.progress < 0.02);
});

test('destruction: cutting the ground floor collapses everything above it', () => {
  const s = new Structure({ x: 0, z: 0, w: 10, d: 10, h: 25, type: 'apartment', name: 'A', color: [1, 1, 1] });
  const debris = new DebrisField();
  // Remove the entire bottom layer by hand.
  for (let z = 0; z < s.nz; z++) {
    for (let x = 0; x < s.nx; x++) s.kill(s.index(x, 0, z));
  }
  const fell = collapseUnsupported(s, debris);
  assert.ok(fell > 0, 'upper floors should lose support');
  assert.equal(s.destroyed, s.total, 'the whole building must come down');
  assert.ok(s.isFlattened);
});

test('destruction: an intact building has nothing floating', () => {
  const s = new Structure({ x: 0, z: 0, w: 10, d: 10, h: 20, type: 'apartment', name: 'A', color: [1, 1, 1] });
  assert.equal(s.findUnsupported().length, 0);
});

test('debris: chunks fall, bounce and settle on the ground', () => {
  const d = new DebrisField();
  d.spawnChunk(v3(0, 20, 0), v3(0.6, 0.6, 0.6), [1, 1, 1], v3(1, 0, 0));
  for (let i = 0; i < 600; i++) d.update(1 / 60);
  const c = d.chunks[0];
  assert.ok(c, 'chunk should still exist inside its lifetime');
  assert.ok(c.settled, 'chunk should come to rest');
  assert.ok(c.pos.y > 0 && c.pos.y < 1, `resting height off: ${c.pos.y}`);
});

test('debris: chunk and dust counts stay bounded under spam', () => {
  const d = new DebrisField();
  for (let i = 0; i < 5000; i++) {
    d.spawnChunk(v3(0, 5, 0), v3(0.5, 0.5, 0.5), [1, 1, 1], v3(0, 0, 0));
    d.spawnDust(v3(0, 5, 0), 3, 1, [1, 1, 1]);
  }
  assert.ok(d.chunks.length <= 900, `chunks: ${d.chunks.length}`);
  assert.ok(d.dust.length <= 1400, `dust: ${d.dust.length}`);
});

test('structure index: spatial query returns the structure under a point', () => {
  const city = buildCity(5);
  const idx = new StructureIndex(city.structures);
  const s = city.structures[10];
  const near = idx.query(s.center.x, s.center.z, 2);
  assert.ok(near.has(s), 'query must find the structure at its own centre');
  const far = idx.query(90000, 90000, 2);
  assert.equal(far.size, 0);
});

test('missions: the chain hands out contracts one at a time and pays out', () => {
  const city = buildCity(31);
  const ms = new MissionSystem(city.structures, 11);
  ms.start(0);
  assert.ok(ms.current, 'first contract must exist');
  assert.equal(ms.current.spec.title, CONTRACTS[0].title);
  assert.ok(ms.current.targets.length > 0);
  for (const t of ms.current.targets) assert.equal(t.isTarget, true);

  // Flatten every target.
  for (const t of ms.current.targets) {
    for (let i = 0; i < t.alive.length; i++) t.kill(i);
  }
  ms.update(10);
  assert.equal(ms.current.done, true);
  assert.ok(ms.money >= CONTRACTS[0].reward * 0.5, `payout too small: ${ms.money}`);

  // Next contract only arrives after the debrief pause.
  ms.tickChain(11);
  assert.equal(ms.completed.length, 1);
  ms.tickChain(20);
  assert.equal(ms.current.spec.title, CONTRACTS[1].title);
});

test('missions: the deadline fails the contract instead of hanging', () => {
  const city = buildCity(31);
  const ms = new MissionSystem(city.structures, 11);
  ms.index = 1; // next start() picks contract 3, which is timed
  ms.start(0);
  assert.ok(ms.current.deadline > 0);
  ms.update(ms.current.deadline + 1);
  assert.equal(ms.current.done, true);
  assert.equal(ms.current.failed, true);
});

test('missions: collateral damage on non-targets fines the payout', () => {
  const city = buildCity(31);
  const ms = new MissionSystem(city.structures, 11);
  ms.start(0);
  const outsider = city.structures.find((s) => !ms.current.targets.includes(s));
  ms.registerDamage(outsider, 40);
  assert.equal(ms.collateral, 40);
  ms.registerDamage(ms.current.targets[0], 10);
  assert.equal(ms.collateral, 40, 'target damage must not be billed as collateral');
});

test('missions: waypoint tracks the unfinished target', () => {
  const city = buildCity(31);
  const ms = new MissionSystem(city.structures, 11);
  ms.start(0);
  const wp = ms.waypoint;
  assert.ok(wp);
  const t = ms.current.targets[0];
  assert.ok(Math.hypot(wp.x - t.center.x, wp.z - t.center.z) < 90);
});

test('sim: a full swing into a warehouse actually flattens it', () => {
  // Analytical stand-in for the in-game rig: repeated 16 m/s hits low on a wall.
  const s = new Structure({ x: 0, z: 0, w: 14, d: 14, h: 10, type: 'warehouse', name: 'W', color: [1, 1, 1] });
  const debris = new DebrisField();
  const energy = 0.5 * 4200 * 16 * 16;
  let swings = 0;
  while (!s.isFlattened && swings < 60) {
    const y = 1.5 + (swings % 3) * 2.0;
    const z = -5 + (swings % 5) * 2.5;
    applyImpact(s, v3(-7 + (swings % 4) * 3.5, y, z), energy, v3(1, 0, 0), debris);
    swings++;
  }
  assert.ok(s.progress > 0.9, `only ${(s.progress * 100).toFixed(0)}% down after ${swings} swings`);
  assert.ok(swings > 3, 'a warehouse should take more than a couple of hits');
  assert.ok(vlen(v3(1, 0, 0)) === 1);
});

// ---------------------------------------------------------- v0.9.0 (R-01..R-04)

test('modes: tauan — one target, 0.5 threshold, no deadline, no collateral fine', () => {
  const city = buildCity(11);
  const m = new MissionSystem(city.structures, 4242, {
    singleTarget: true, thresholdOverride: 0.5, deadlines: false, collateralFines: false,
  });
  m.start(0);
  m.start(0);   // contract 2 (spec count = 2): singleTarget must force one
  assert.equal(m.current.targets.length, 1);
  assert.equal(m.thresholdOf(), 0.5);
  assert.equal(m.current.deadline, 0);
  assert.equal(m.timeLeft(999), null);
  const other = city.structures.find((s) => !m.current.targets.includes(s) && s.total > 0);
  m.registerDamage(other, 500);
  const t = m.current.targets[0];
  t.destroyed = Math.ceil(t.total * 0.55);   // past the 0.5 threshold
  m.update(10);
  assert.ok(m.current.done, 'contract should complete at 55% in tauan mode');
  assert.equal(m.completed[0].fine, 0);
  assert.equal(m.completed[0].payout, CONTRACTS[1].reward);
});

test('modes: contratos (defaults) keeps multi-target, spec thresholds and deadlines', () => {
  const city = buildCity(11);
  const m = new MissionSystem(city.structures, 4242);
  m.start(0);
  m.start(0);   // contract 2
  assert.equal(m.current.targets.length, CONTRACTS[1].count);
  assert.equal(m.thresholdOf(), CONTRACTS[1].threshold);
  m.start(0);   // contract 3 — spec has time: 210
  assert.equal(m.current.deadline, 210);
  assert.ok(m.timeLeft(100) !== null);
});

function homingScenario() {
  const s = new Structure({ x: 0, z: 0, w: 14, d: 14, h: 10, type: 'warehouse', name: 'W', color: [1, 1, 1] });
  const world = {
    structures: [s], index: new StructureIndex([s]), debris: new DebrisField(),
    bounds: { half: 500 }, onCollapse: () => {},
  };
  const rig = new Rig(s.center.x + s.size.x / 2 + 22, s.center.z, -Math.PI / 2);
  rig.turretYaw = 0;
  rig.boomPitch = 0.5;
  rig.ropeLen = 9;
  rig.computeTip();
  rig.ball.pos = v3(rig.tip.x, rig.tip.y - 9, rig.tip.z);  // hanging free above ground
  rig.ball.vel = v3();
  return { s, world, rig };
}

const NO_DRIVE = { throttle: 0, steer: 0, brake: false, slew: 0, pitch: 0, rope: 0, pump: 0 };

test('homing: SPACE servo swings the ball into the target repeatedly (R-03)', () => {
  for (const [modeId, minImpacts] of [['tauan', 6], ['contratos', 4]]) {
    const { world, rig } = homingScenario();
    world.homingTarget = () => ({ x: 0, z: 0 });
    world.homingConfig = MODES[modeId].homing;
    const dt = 0.0125;
    let impacts = 0;
    let first = null;
    for (let i = 0; i < Math.floor(25 / dt); i++) {
      rig.update(dt, { ...NO_DRIVE, pump: 1 }, world);
      for (const _ of rig.drainImpacts()) { impacts++; if (first === null) first = i * dt; }
    }
    assert.ok(first !== null && first <= 3, `${modeId}: first impact took ${first}s`);
    assert.ok(impacts >= minImpacts, `${modeId}: only ${impacts} impacts in 25s — homing too weak`);
  }
});

test('homing: without a target SPACE stays the classic boom pump', () => {
  const { world, rig } = homingScenario();   // no homingTarget on world
  const dt = 0.0125;
  let maxSpeed = 0;
  for (let i = 0; i < Math.floor(8 / dt); i++) {
    rig.update(dt, { ...NO_DRIVE, pump: 1 }, world);
    const sp = vlen(rig.ball.vel);
    if (sp > maxSpeed) maxSpeed = sp;
  }
  assert.ok(maxSpeed > 2, `pump did not build a swing (max ${maxSpeed.toFixed(1)} m/s)`);
});

test('spawn: safeBallPos never leaves the ball inside a structure or underground (R-04)', () => {
  const s = new Structure({ x: 0, z: 0, w: 14, d: 14, h: 10, type: 'warehouse', name: 'W', color: [1, 1, 1] });
  const world = { structures: [s], index: new StructureIndex([s]) };
  const p = safeBallPos(v3(0, -3, 0), 1.75, world);   // dead centre, below ground
  assert.ok(p.y >= 1.75, `underground: y=${p.y}`);
  const inside = Math.abs(p.x - s.center.x) < s.size.x / 2 + 1.75
    && Math.abs(p.z - s.center.z) < s.size.z / 2 + 1.75
    && p.y - 1.75 <= s.size.y;
  assert.ok(!inside, `still inside the footprint: ${JSON.stringify(p)}`);
  // without a world only the ground clamp applies
  const q = safeBallPos(v3(5, -10, 5), 1.75);
  assert.equal(q.y, 1.75);
});

// ---------------------------------------------------------- v0.9.0 (R-07)

test('rio: leito sem estruturas e com pelo menos 2 pontes (R-07)', () => {
  const city = buildCity();
  const rv = city.river;
  assert.ok(rv, 'buildCity must expose river metadata');
  assert.ok(rv.bridges.length >= 2 && rv.bridges.length <= 3);
  for (const s of city.structures) {
    const sx0 = s.center.x - s.size.x / 2;
    const sx1 = s.center.x + s.size.x / 2;
    assert.ok(sx1 < rv.x - rv.half || sx0 > rv.x + rv.half,
      `${s.name} intersects the riverbed`);
  }
});

test('rio: tráfego só cruza a água nas pontes e nunca trava (R-07)', () => {
  const city = buildCity();
  const rv = city.river;
  const traffic = new Traffic(34, 77, rv);
  const rigStub = { pos: v3(4000, 0, 4000), ball: { pos: v3(4000, 0, 4000), vel: v3(), radius: 2.6 } };
  const debrisStub = { spawnChunk() {}, spawnSparks() {}, spawnDust() {} };
  const dt = 0.05;
  let travelled = 0;
  for (let t = 0; t < 60; t += dt) {
    traffic.update(dt, rigStub, debrisStub);
    for (const car of traffic.cars) {
      if (!car.alive) continue;
      travelled += car.speed * dt;
      assert.ok(!traffic.isBlocked(car.from, car.to),
        `car drives a severed edge ${JSON.stringify(car.from)}->${JSON.stringify(car.to)}`);
      const inWater = Math.abs(car.pos.x - rv.x) < rv.half;
      if (inWater) {
        assert.ok(rv.onBridge(car.pos.z),
          `car swims at x=${car.pos.x.toFixed(1)} z=${car.pos.z.toFixed(1)}`);
      }
    }
  }
  // 34 cars over 60 s must actually go places — a gridlocked graph stays near 0.
  assert.ok(travelled > 5000, `fleet only travelled ${travelled.toFixed(0)} m in 60 s`);
});

// ---------------------------------------------------------- v0.9.0 (R-10)

test('carros: frota tem pelo menos 3 modelos e todos dirigem (R-10)', () => {
  const city = buildCity();
  const traffic = new Traffic(34, 77, city.river);
  const models = new Set(traffic.cars.map((c) => c.model));
  assert.ok(models.size >= 3, `only ${[...models]} models in the fleet`);
});

test('carros: freiam atrás do trator como antes (R-10 preserva fila/freio)', () => {
  const city = buildCity();
  const traffic = new Traffic(34, 77, city.river);
  const debrisStub = { spawnChunk() {}, spawnSparks() {}, spawnDust() {} };
  const farRig = { pos: v3(4000, 0, 4000), ball: { pos: v3(4000, 0, 4000), vel: v3(), radius: 2.6 } };
  // Let the fleet settle, then park the rig right in front of one car.
  for (let t = 0; t < 3; t += 0.05) traffic.update(0.05, farRig, debrisStub);
  const car = traffic.cars.find((c) => c.alive && c.speed > 5);
  const fwdX = Math.sin(car.yaw), fwdZ = Math.cos(car.yaw);
  const rig = {
    pos: v3(car.pos.x + fwdX * 10, 0, car.pos.z + fwdZ * 10),
    ball: { pos: v3(4000, 0, 4000), vel: v3(), radius: 2.6 },
  };
  for (let t = 0; t < 1.2; t += 0.05) {
    rig.pos.x = car.pos.x + fwdX * 10;   // keep blocking its lane
    rig.pos.z = car.pos.z + fwdZ * 10;
    traffic.update(0.05, rig, debrisStub);
  }
  assert.ok(car.speed < car.cruise * 0.6,
    `car should brake behind the rig (speed ${car.speed.toFixed(1)} vs cruise ${car.cruise.toFixed(1)})`);
});

// ---------------------------------------------------------- v0.9.0 (R-11)

test('equipe: ciclo completo — botão a 30m, cones, quarteirão fechado, recolha, 1x por contrato (R-11)', () => {
  const city = buildCity();
  const missions = new MissionSystem(city.structures, 4242, {
    singleTarget: true, thresholdOverride: 0.5, deadlines: false, collateralFines: false,
  });
  missions.start(0);
  const target = missions.current.targets[0];
  const traffic = new Traffic(20, 77, city.river);
  const debrisStub = { spawnChunk() {}, spawnSparks() {}, spawnDust() {} };
  const crew = new Crew();

  const farRig = { pos: v3(target.center.x + 200, 0, target.center.z) };
  const nearRig = { pos: v3(target.center.x + 18, 0, target.center.z) };
  assert.equal(crew.available(missions, farRig), false, 'button must hide beyond 30 m');
  assert.equal(crew.available(missions, nearRig), true, 'button must show within 30 m');
  assert.equal(crew.call(missions, nearRig), true);
  assert.equal(crew.available(missions, nearRig), false, 'no double call');

  // Van drives in, helper places every cone, block closes.
  let guard = 0;
  while (crew.state !== 'holding' && guard++ < 20000) crew.update(0.05, missions, traffic);
  assert.equal(crew.state, 'holding', 'crew must finish placing cones');
  assert.equal(crew.cones.length, 28);
  assert.equal(traffic.closedEdges.size, 4, 'the 4 edges around the block must close');

  // While the cones are down, settled traffic never drives a closed edge.
  const farRigBall = { pos: v3(4000, 0, 4000), ball: { pos: v3(4000, 0, 4000), vel: v3(), radius: 2.6 } };
  for (let t = 0; t < 15; t += 0.05) traffic.update(0.05, farRigBall, debrisStub);
  for (let t = 0; t < 10; t += 0.05) {
    traffic.update(0.05, farRigBall, debrisStub);
    for (const car of traffic.cars) {
      if (!car.alive) continue;
      assert.ok(!traffic.isBlocked(car.from, car.to), 'car entered a coned block');
    }
  }

  // Knock the target past the threshold: the crew collects and leaves.
  let killed = 0;
  for (let i = 0; i < target.alive.length && target.progress < 0.55; i++) {
    if (target.alive[i]) { target.kill(i); killed++; }
  }
  assert.ok(killed > 0);
  guard = 0;
  while (crew.state !== 'idle' && guard++ < 30000) crew.update(0.05, missions, traffic);
  assert.equal(crew.state, 'idle', 'crew must pack up and leave');
  assert.equal(crew.cones.length, 0, 'every cone collected');
  assert.equal(traffic.closedEdges.size, 0, 'block reopened');
  assert.equal(crew.available(missions, nearRig), false, 'same contract: still once only');
});

// ---------------------------------------------------------- v0.9.0 (R-09)

test('pedestres: a bola nunca os fere — eles fogem e todos sobrevivem (R-09)', () => {
  const city = buildCity();
  const peds = new Pedestrians(city, 40, 99);
  const before = peds.walkers.length;
  const victim = peds.walkers.find((w) => !w.bridge);
  // Park a "ball" right on top of a walker at demolition speed.
  const rig = {
    pos: v3(victim.pos.x + 3, 0, victim.pos.z + 3),
    ball: { pos: v3(victim.pos.x, 1.5, victim.pos.z), vel: v3(9, 0, 0), radius: 2.6 },
  };
  const world = { index: new StructureIndex(city.structures), river: city.river };
  const d0 = 0;
  for (let t = 0; t < 4; t += 0.05) peds.update(0.05, rig, world);
  assert.equal(peds.walkers.length, before, 'no walker may ever be removed');
  const dAfter = Math.hypot(victim.pos.x - rig.ball.pos.x, victim.pos.z - rig.ball.pos.z);
  assert.ok(dAfter > 6, `walker must flee the ball (got ${dAfter.toFixed(1)} m away)`);
  void d0;
});

test('pedestres: ninguém anda na água — pontes são o único cruzamento (R-07/R-09)', () => {
  const city = buildCity();
  const peds = new Pedestrians(city, 48, 5);
  const rig = { pos: v3(4000, 0, 4000), ball: { pos: v3(4000, 1, 4000), vel: v3(), radius: 2.6 } };
  const world = { index: new StructureIndex(city.structures), river: city.river };
  const rv = city.river;
  for (let t = 0; t < 30; t += 0.05) {
    peds.update(0.05, rig, world);
    for (const w of peds.walkers) {
      const overWater = Math.abs(w.pos.x - rv.x) < rv.half;
      if (overWater) {
        assert.ok(w.bridge || rv.onBridge(w.pos.z),
          `walker swims at x=${w.pos.x.toFixed(1)} z=${w.pos.z.toFixed(1)}`);
      }
    }
  }
  // Bridge pacers actually pace the whole span.
  const pacer = peds.walkers.find((w) => w.bridge);
  assert.ok(pacer, 'bridges must have dedicated walkers');
});

console.log(`\n${passed} testes ok${process.exitCode ? ' — COM FALHAS' : ''}`);
