// Headless unit tests for the pure simulation modules of Demolition Ball.
// No DOM, no WebGL — city generation, voxel destruction, collapse and missions.

import assert from 'node:assert/strict';
import { buildCity, Structure, StructureIndex } from '../../demolition-ball-opus-5/src/city.js';
import { applyImpact, collapseUnsupported } from '../../demolition-ball-opus-5/src/destruction.js';
import { DebrisField } from '../../demolition-ball-opus-5/src/debris.js';
import { MissionSystem, CONTRACTS } from '../../demolition-ball-opus-5/src/missions.js';
import { v3, sphereVsBox, qIntegrate, mulberry32, vlen } from '../../demolition-ball-opus-5/src/math.js';

let passed = 0;
const test = (name, fn) => {
  try { fn(); passed++; console.log(`  ok  ${name}`); } catch (e) {
    console.error(`  FAIL ${name}\n       ${e.message}`);
    process.exitCode = 1;
  }
};

console.log('demolition-ball-opus-5 :: unit');

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

console.log(`\n${passed} testes ok${process.exitCode ? ' — COM FALHAS' : ''}`);
