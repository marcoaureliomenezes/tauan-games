// test-aero-formations.mjs — Validador Node das formações da campanha Inhaúma
// (T-C-03, release aero-fighters-inhauma-campaign-v1 — ver SPEC.md §A e §F).
//
// Prova, com dados REAIS do mapa (polilinha MG-060 de inhauma-roads.js, altura de
// inhaumaVisualSurfaceHeight, TOWN_SHELF + airportExclusionZones, polilinha do rio):
//   (a) spawn de cada tipo de formação nos tamanhos 5 e 25 na MG-060 e numa rota de
//       terreno do vale de Cachoeira em direção a Inhaúma;
//   (b) 600 s de movimento a dt=1/30;
//   (c) nenhuma unidade dentro de retângulo de exclusão ou da faixa do rio
//       (halfWidth+10), alturas == heightAt ±0.5, sem NaN, coesão (gap < 3×spacing),
//       determinismo por seed;
//   (d) artilleryBattery alcança 'deployed';
//   (e) matar membros fecha as fileiras sem erros (wreck fica parado).
//
// Roda com: node --experimental-default-type=module tests/aero-fighters/tools/test-aero-formations.mjs
// Perf: inhaumaVisualSurfaceHeight custa ~76 µs/chamada (fbm multi-oitava) — o deps do
// sim usa uma grade bilinear pré-amostrada da função REAL (acelerador), e as asserts de
// altura comparam contra a função REAL amostrada (a prova vale ±0.5 ponta a ponta).

import test from 'node:test';
import assert from 'node:assert/strict';

import { loadInhaumaDem } from '../../../aero-fighters/src/maps/heightmap-sampler.js';
import { inhaumaVisualSurfaceHeight } from '../../../aero-fighters/src/maps/inhauma-scene.js';
import { getInhaumaRoads } from '../../../aero-fighters/src/maps/inhauma-roads.js';
import { getInhaumaRiverPolyline, distanceToRiver, RIVER_HALF_WIDTH_M } from '../../../aero-fighters/src/maps/inhauma-river.js';
import { INHAUMA_AIRPORT_EXCLUSION_ZONES } from '../../../aero-fighters/src/maps/inhauma-road-airport.js';
import { createRng } from '../../../aero-fighters/src/rng.js';
import { TARGET_STATS } from '../../../aero-fighters/src/config.js';
import { UNIT_TYPES, makeUnit, makeUnitInstanced, unitStats, unitTargetType } from '../../../aero-fighters/src/formations/units.js';
import { FORMATION_TYPES, createFormation, updateFormations, registerAsTargets } from '../../../aero-fighters/src/formations/formation.js';

await loadInhaumaDem();

// ─── Deps reais (o mesmo objeto que a campanha vai injetar — Onda 3) ─────────
const TOWN_SHELF = { minX: -650, maxX: 150, minZ: -60, maxZ: 560 }; // inhauma-scene.js#TOWN_SHELF
const EXCLUSIONS = [TOWN_SHELF, ...INHAUMA_AIRPORT_EXCLUSION_ZONES];
const RECTS = EXCLUSIONS.map((e) => (e.minX !== undefined ? e : { minX: e.cx - e.halfW, maxX: e.cx + e.halfW, minZ: e.cz - e.halfL, maxZ: e.cz + e.halfL }));
const RIVER = getInhaumaRiverPolyline();
const RIVER_BAND = RIVER_HALF_WIDTH_M + 10;

const MG060 = getInhaumaRoads().find((r) => r.id === 'mg-060').points;
// Rota de terreno: vale de Cachoeira da Prata (cx≈-940, cz≈520) → Inhaúma, contornando
// a north-approach do aeroporto pelo sul e a TOWN_SHELF pelo norte (validada offline).
const TERRAIN_ROUTE = [[-940, 520], [-800, 220], [-760, -80], [-740, -480], [-300, -520], [-40, -200]];
const STATIC_ANCHOR = { mg060: [-810, -300], terrain: [-940, 520] };

// Grade bilinear pré-amostrada da altura REAL — acelerador do deps (ver header).
function buildGridHeightAt(minX, maxX, minZ, maxZ, step) {
  const nx = Math.floor((maxX - minX) / step) + 1;
  const nz = Math.floor((maxZ - minZ) / step) + 1;
  const data = new Float32Array(nx * nz);
  for (let iz = 0; iz < nz; iz++) {
    for (let ix = 0; ix < nx; ix++) data[iz * nx + ix] = inhaumaVisualSurfaceHeight(minX + ix * step, minZ + iz * step);
  }
  return (x, z) => {
    const fx = Math.min(Math.max((x - minX) / step, 0), nx - 1.001);
    const fz = Math.min(Math.max((z - minZ) / step, 0), nz - 1.001);
    const ix = Math.floor(fx), iz = Math.floor(fz);
    const tx = fx - ix, tz = fz - iz;
    const h00 = data[iz * nx + ix], h10 = data[iz * nx + ix + 1];
    const h01 = data[(iz + 1) * nx + ix], h11 = data[(iz + 1) * nx + ix + 1];
    return (h00 + (h10 - h00) * tx) * (1 - tz) + (h01 + (h11 - h01) * tx) * tz;
  };
}
const gridHeightAt = buildGridHeightAt(-1080, 20, -620, 640, 4);

const makeDeps = (seed) => ({
  rng: createRng(seed),
  heightAt: gridHeightAt,
  exclusions: EXCLUSIONS,
  riverPolyline: RIVER,
  riverHalfWidth: RIVER_HALF_WIDTH_M,
});

const inExclusion = (x, z) => RECTS.some((r) => x >= r.minX && x <= r.maxX && z >= r.minZ && z <= r.maxZ);
const aliveMembers = (f) => f.members.filter((m) => m.alive);

/** Asserts por frame (chamado a cada 30 frames): exclusões, rio, NaN, coesão. */
function assertFrame(f, label) {
  const alive = aliveMembers(f);
  for (const m of alive) {
    const { x, y, z } = m.pos;
    assert.ok(Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(z), `${label}: NaN em ${m.unit}#${m.index}`);
    assert.ok(!inExclusion(x, z), `${label}: ${m.unit}#${m.index} dentro de exclusão em (${x.toFixed(1)},${z.toFixed(1)})`);
    assert.ok(distanceToRiver(x, z) >= RIVER_BAND, `${label}: ${m.unit}#${m.index} na faixa do rio em (${x.toFixed(1)},${z.toFixed(1)})`);
  }
  for (let i = 1; i < alive.length; i++) {
    const a = alive[i - 1].pos, b = alive[i].pos;
    const gap = Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
    assert.ok(gap < 3 * f.def.spacing, `${label}: gap ${gap.toFixed(1)} m >= 3×spacing entre membros ${i - 1}/${i}`);
  }
}

function simSeconds(f, seconds, label) {
  const dt = 1 / 30;
  const frames = Math.round(seconds / dt);
  for (let i = 0; i < frames; i++) {
    updateFormations(dt, [f], f.deps);
    if (i % 30 === 29) assertFrame(f, label);
    if (i % 60 === 59) {
      // Altura contra a função REAL (não a grade): prova o contrato heightAt ±0.5.
      for (const m of aliveMembers(f)) {
        const real = inhaumaVisualSurfaceHeight(m.pos.x, m.pos.z);
        assert.ok(Math.abs(m.pos.y - m.altitude - real) <= 0.5,
          `${label}: ${m.unit}#${m.index} y=${m.pos.y.toFixed(2)} vs heightAt=${real.toFixed(2)} em (${m.pos.x.toFixed(1)},${m.pos.z.toFixed(1)})`);
      }
    }
  }
}

// ─── T-C-01: builders de unidade ──────────────────────────────────────────────
test('T-C-01: cada tipo de unidade tem parts nomeadas, stats e ambos os caminhos de render', () => {
  for (const unit of UNIT_TYPES) {
    const group = makeUnit(unit);
    assert.ok(group.isGroup, `${unit}: makeUnit não retornou Group`);
    assert.ok(group.children.length >= 5, `${unit}: poucas partes (${group.children.length})`);
    for (const mesh of group.children) {
      assert.ok(mesh.name.startsWith(`${unit}.`), `${unit}: parte sem nome (${mesh.name})`);
      assert.ok(mesh.material && mesh.material.color, `${unit}: parte sem material nomeado`);
    }
    const batch = makeUnitInstanced(unit, 7);
    assert.ok(batch.mesh.isInstancedMesh && batch.count === 7, `${unit}: caminho instanciado quebrado`);
    assert.ok(batch.geometry.getAttribute('color'), `${unit}: geometria mesclada sem vertex colors`);
    assert.ok(batch.geometry.getAttribute('position').count > 0, `${unit}: geometria vazia`);
    const stats = unitStats(unit);
    for (const k of ['hp', 'score', 'range', 'speed', 'fire']) assert.ok(k in stats, `${unit}: stats sem '${k}'`);
    assert.equal(stats, TARGET_STATS[unitTargetType(unit)], `${unit}: stats fora de TARGET_STATS`);
  }
  // Ranges do SPEC: chão 200-220 m; AA 300 m.
  for (const u of ['tank', 'apc', 'troops', 'helicopter']) {
    assert.ok(unitStats(u).range >= 200 && unitStats(u).range <= 220, `${u}: range ${unitStats(u).range} fora de 200-220`);
  }
  for (const u of ['sam', 'aaGun']) assert.equal(unitStats(u).range, 300, `${u}: range AA != 300`);
});

// ─── T-C-02: validação de path (clamp e rejeição) com deps sintéticos ────────
const synthDeps = (seed) => ({
  rng: createRng(seed), heightAt: () => 10,
  exclusions: [], riverPolyline: [{ x: 0, z: -300 }, { x: 0, z: 300 }], riverHalfWidth: 10, // banda = 20
});

test('T-C-02: path que raspa a faixa do rio é CLAMPADO (não rejeitado) e membros ficam fora da banda', () => {
  const f = createFormation({ type: 'supplyConvoy', size: 5, path: [[-24, -100], [-24, 100]], deps: synthDeps('clamp') });
  assert.ok(f, 'path paralelo a 24 m do rio deveria ser clampado, não rejeitado');
  simSeconds(f, 5, 'clamp');
  for (const m of f.members) assert.ok(Math.abs(m.pos.x) >= 20, `membro dentro da banda do rio (x=${m.pos.x.toFixed(1)})`);
});

test('T-C-02: path que ATRAVESSA o rio é rejeitado (null), idem path dentro de exclusão', () => {
  assert.equal(createFormation({ type: 'supplyConvoy', size: 5, path: [[-60, 0], [60, 0]], deps: synthDeps('cross') }), null);
  const depsRect = { ...synthDeps('rect'), exclusions: [{ minX: -100, maxX: 100, minZ: -100, maxZ: 100 }] };
  assert.equal(createFormation({ type: 'tankPlatoon', size: 5, path: [[-50, -50], [50, 50]], deps: depsRect }), null);
});

// ─── T-C-03(a): spawn de todas as formações (5 e 25) nos dois contextos ──────
test('T-C-03(a): spawn de cada tipo (size 5 e 25) na MG-060 e na rota de terreno', () => {
  for (const type of FORMATION_TYPES) {
    for (const size of [5, 25]) {
      for (const [ctx, path] of [['mg060', MG060], ['terrain', TERRAIN_ROUTE]]) {
        const isStatic = ['encampment', 'samSite', 'aaNest'].includes(type);
        const p = isStatic ? [STATIC_ANCHOR[ctx]] : path;
        const f = createFormation({ type, size, path: p, deps: makeDeps(`spawn-${type}-${size}-${ctx}`) });
        assert.ok(f, `spawn falhou: ${type} size=${size} em ${ctx}`);
        assert.equal(f.members.length, size);
        for (const m of f.members) {
          assert.ok(!inExclusion(m.pos.x, m.pos.z), `${type}/${size}/${ctx}: ${m.unit}#${m.index} spawnou em exclusão`);
          assert.ok(distanceToRiver(m.pos.x, m.pos.z) >= RIVER_BAND, `${type}/${size}/${ctx}: ${m.unit}#${m.index} spawnou na faixa do rio`);
        }
      }
    }
  }
});

// ─── T-C-03(b/c/d): 600 s de movimento a dt=1/30 nos dois paths ──────────────
const MOVING_TYPES = ['supplyConvoy', 'tankPlatoon', 'armoredColumn', 'troopColumn', 'mixedBattlegroup', 'artilleryBattery'];

test('T-C-03(b/c/d): 600 s de sim — exclusões, rio, alturas, NaN, coesão, deploy', { timeout: 300000 }, () => {
  for (const type of MOVING_TYPES) {
    for (const size of [5, 25]) {
      for (const [ctx, path] of [['mg060', MG060], ['terrain', TERRAIN_ROUTE]]) {
        const f = createFormation({ type, size, path, deps: makeDeps(`sim-${type}-${size}-${ctx}`) });
        assert.ok(f, `spawn falhou: ${type}/${size}/${ctx}`);
        simSeconds(f, 600, `${type}/${size}/${ctx}`);
        if (type === 'artilleryBattery') {
          assert.equal(f.state, 'deployed', `artilleryBattery ${size}/${ctx} não chegou a 'deployed' em 600 s (state=${f.state})`);
        } else {
          assert.ok(f.state === 'arrived' || f.state === 'transit', `${type}: estado inesperado ${f.state}`);
        }
      }
    }
  }
});

// ─── T-C-03(c): determinismo — mesma seed, mesmas posições finais ─────────────
test('T-C-03(c): duas execuções com a mesma seed produzem posições finais idênticas', () => {
  const run = () => {
    const f = createFormation({ type: 'armoredColumn', size: 12, path: MG060, deps: makeDeps('determinism') });
    simSeconds(f, 60, 'determinism');
    return f.members.map((m) => [m.pos.x, m.pos.y, m.pos.z, m.pitch]);
  };
  assert.deepEqual(run(), run());
});

// ─── T-C-03(e) + contrato de dano: kill fecha fileiras; registerAsTargets ─────
test('T-C-03(e): matar membros fecha as fileiras; wreck fica parado; registerAsTargets no shape do dano', () => {
  const game = { targets: [], rng: createRng('kill-game') };
  const f = createFormation({ type: 'tankPlatoon', size: 8, path: MG060, deps: makeDeps('kill') });
  const registered = registerAsTargets(f, game);
  assert.equal(registered.length, 8);
  assert.equal(game.targets.length, 8);
  for (const t of registered) {
    for (const k of ['type', 'mesh', 'hp', 'maxHp', 'score', 'hr2', 'dropChance', 'dead', 'fireTimer', 'fireInterval', 'range', 'path', 'pathIdx', 'airborneAltitude', 'spawnX', 'spawnY', 'spawnZ', 'formationId', 'memberIndex']) {
      assert.ok(k in t, `target sem campo '${k}' (shape de damageTarget/killTarget)`);
    }
    assert.ok(t.type in TARGET_STATS, `type ${t.type} sem TARGET_STATS`);
    assert.equal(t.dead, false);
  }
  simSeconds(f, 5, 'pre-kill');
  // Simula o fluxo de killTarget: marca dead (o FX/score roda em targets.js, browser).
  const deadPos = [2, 5].map((i) => {
    f.members[i].target.dead = true;
    return { x: f.members[i].mesh.position.x, y: f.members[i].mesh.position.y, z: f.members[i].mesh.position.z };
  });
  simSeconds(f, 20, 'post-kill');
  assert.equal(aliveMembers(f).length, 6, 'fileiras não fecharam após 2 kills');
  assert.deepEqual(
    [f.members[2].mesh.position.x, f.members[2].mesh.position.y, f.members[2].mesh.position.z],
    [deadPos[0].x, deadPos[0].y, deadPos[0].z],
    'wreck do membro 2 se moveu depois de morto',
  );
  assert.deepEqual(
    [f.members[5].mesh.position.x, f.members[5].mesh.position.y, f.members[5].mesh.position.z],
    [deadPos[1].x, deadPos[1].y, deadPos[1].z],
    'wreck do membro 5 se moveu depois de morto',
  );
  // Formação estática também sobrevive a kills sem erro (wreck permanece no cluster).
  const camp = createFormation({ type: 'encampment', size: 10, path: [STATIC_ANCHOR.terrain], deps: makeDeps('camp-kill') });
  registerAsTargets(camp, game);
  camp.members[0].target.dead = true;
  camp.members[3].target.dead = true;
  simSeconds(camp, 5, 'camp-kill');
  assert.equal(aliveMembers(camp).length, 8);
});
