import assert from 'node:assert/strict';
import { MISSIONS } from '../../src/web-games/james-bond/src/content/missions.js';
import { WEAPONS, freshAmmo } from '../../src/web-games/james-bond/src/content/weapons.js';
import { createRandom, hashSeed } from '../../src/web-games/james-bond/src/random.js';
import { createPhysics } from '../../src/web-games/james-bond/src/engine/physics.js';

assert.equal(MISSIONS.length, 6, 'campaign must have six missions');
for (const mission of MISSIONS) {
  assert.equal(mission.grid.length, 15, `${mission.code} height`);
  assert.equal(new Set(mission.grid.map((row) => row.length)).size, 1, `${mission.code} width`);
  for (const marker of ['S', 'A', 'B', 'C', 'E']) {
    assert.ok(mission.grid.join('').includes(marker), `${mission.code} missing ${marker}`);
  }
  const start = findMarker(mission.grid, 'S');
  const reachable = floodFill(mission.grid, start);
  for (const marker of ['A', 'B', 'C', 'E']) {
    assert.ok(reachable.has(findMarker(mission.grid, marker).join(',')), `${mission.code} cannot reach ${marker}`);
  }
  assert.equal(Object.keys(mission.objectives).length, 3, `${mission.code} objectives`);
}

assert.ok(Object.keys(WEAPONS).length >= 5, 'weapon roles');
const ammo = freshAmmo();
for (const [id, weapon] of Object.entries(WEAPONS)) {
  assert.equal(ammo[id].mag, weapon.mag);
  assert.ok(weapon.damage > 0 && weapon.cadence > 0 && weapon.noise > 0);
}

const first = createRandom(hashSeed('OP-01'));
const second = createRandom(hashSeed('OP-01'));
for (let i = 0; i < 20; i += 1) assert.equal(first(), second(), 'seeded random is deterministic');

const physics = await createPhysics();
physics.addBox(2, 1.5, 0, 0.5, 1.5, 2);
physics.createPlayer({ x: 0, y: 1, z: 0 });
physics.movePlayer({ x: 2, y: 0, z: 0 });
assert.equal(physics.position().x, 0, 'player must not cross a wall');
physics.movePlayer({ x: 0, y: 0, z: 1 });
assert.equal(physics.position().z, 1, 'player must move along a free axis');

console.log(`James Bond unit checks passed: ${MISSIONS.length} missions, ${Object.keys(WEAPONS).length} weapons`);

function findMarker(grid, marker) {
  const z = grid.findIndex((row) => row.includes(marker));
  return [grid[z].indexOf(marker), z];
}

function floodFill(grid, start) {
  const seen = new Set([start.join(',')]);
  const queue = [start];
  while (queue.length) {
    const [x, z] = queue.shift();
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const next = [x + dx, z + dz];
      const key = next.join(',');
      if (grid[next[1]]?.[next[0]] !== '#' && !seen.has(key)) { seen.add(key); queue.push(next); }
    }
  }
  return seen;
}
