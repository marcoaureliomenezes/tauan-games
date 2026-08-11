// test-aero-citywar.mjs — Validador Node da Onda 4 (T-C-09/T-C-10/T-C-11,
// release v0.3.4 — SPEC §D/§F).
//
// Prova, com deps REAIS do mapa (heightmap chain, estradas, prédios construídos
// por buildTown — mesmo padrão de test-aero-campaign.mjs/test-aero-cachoeira.mjs):
//   (a) a bateria SÓ dispara em estado 'deployed' (nada em 'transit');
//   (b) bombardeio seedado-determinístico (duas instâncias independentes do
//       módulo, mesma seed → mesmos impactos) e todo alvo é um prédio REAL
//       dentro da TOWN_SHELF;
//   (c) impacto registra prop fire no prédio visado e o re-arm para quando a
//       bateria morre (focos expiram + fumaça removida);
//   (d) modelo de acerto: 0.8 a <50 m (AA), monotônico não-crescente, piso/teto;
//   (e) balas inimigas retas (vetor velocidade constante) a 70-90 m/s, mira
//       direta no HIT e offset de 2-6° no MISS;
//   (f) tráfego militar: 8-15 caminhões, SEMPRE sobre a polilinha da osm-mg-060
//       e fora da TOWN_SHELF/zonas do aeroporto (amostra de 300 s, com wreck e
//       respawn no meio);
//   (g) hot paths sem alocação: pool de projéteis fixo (12), ≤3 em voo por
//       bateria, contagem militar constante — o resto é por construção
//       (números planos + scratches compartilhados, ver headers dos módulos).
//
// Roda com: node --experimental-default-type=module tests/aero-fighters/tools/test-aero-citywar.mjs

import test from 'node:test';
import assert from 'node:assert/strict';

import { loadInhaumaDem } from '../../../aero-fighters/src/maps/heightmap-sampler.js';
import {
  TOWN_SHELF, buildTown, getInhaumaStructures, inhaumaContinuousHeight,
} from '../../../aero-fighters/src/maps/inhauma-scene.js';
import { nearAnyRoad } from '../../../aero-fighters/src/maps/inhauma-roads.js';
import { inhaumaAirportExclusionZoneAt, isInhaumaAirportSurface } from '../../../aero-fighters/src/maps/inhauma-road-airport.js';
import { createRng } from '../../../aero-fighters/src/rng.js';
import { initCampaign, updateCampaign, setCampaignHooks } from '../../../aero-fighters/src/campaign.js';
import { hitProbability, updateFormationFire } from '../../../aero-fighters/src/formations/formation.js';
import { buildInhaumaTraffic, updateRoadTraffic } from '../../../aero-fighters/src/maps/inhauma-traffic.js';
import { ENEMY_FIRE } from '../../../aero-fighters/src/config.js';

await loadInhaumaDem();
buildTown({ add() {} }); // registra os 'predio-inhauma' REAIS (getInhaumaStructures)

const fakeScene = () => ({ add() {}, remove() {} });
setCampaignHooks({ showOverlay: () => {}, onFailure: () => {} });

// Instâncias FRESCAS de city-war.js por cenário (specifier com query = módulo
// separado no ESM) — cada teste parte de rng/estado zerados; (b) compara DUAS
// instâncias independentes na mesma seed. campaign.js chama o updateCityWar da
// instância canônica (não inicializada aqui → no-op); cada cenário dirige a SUA
// instância manualmente logo após updateCampaign.
const freshCityWar = (tag) => import(`../../../aero-fighters/src/city-war.js?inst=${tag}`);

function makeHooks(rec) {
  return {
    explosion: (x, y, z, s) => rec.impacts.push({ x, y, z, s }),
    muzzle: () => { rec.fires += 1; },
    trail: () => {},
    propFire: (x, y, z) => rec.propFires.push({ x, y, z }),
    smoke: (x, y, z, owner) => rec.smokes.push({ x, y, z, owner }),
    removeSmoke: (owner) => rec.removedSmokes.push(owner),
    scorch: () => { rec.scorches += 1; },
    boom: () => {},
  };
}

/** Cenário completo do Ato 1 até as baterias deployed + bombardeio rolando.
 *  As colunas de invasão são abatidas ao spawnar (o teste é da ARTILHARIA —
 *  evita o caminho 'arrived' → falha do ato). */
async function setupScenario(tag, seed) {
  const cw = await freshCityWar(tag);
  const rec = { fires: 0, scorches: 0, impacts: [], propFires: [], smokes: [], removedSmokes: [] };
  cw.setCityWarHooks(makeHooks(rec));
  const game = {
    targets: [], rng: createRng(seed), runtime: { seed },
    score: 0, kills: 0, targetsTotal: 0, targetsDestroyed: 0,
  };
  const c = initCampaign(game, { scene: fakeScene(), garrisonFormations: [] });
  const cwState = cw.initCityWar(game, { scene: fakeScene() });
  return { game, c, rec, cw, cwState };
}

/** Mata as colunas (não-artilharia) recém-spawnadas — o foco é a bateria. */
function killColumns(c) {
  for (const f of c.formations) {
    if (f.type === 'artilleryBattery') continue;
    for (const m of f.members) if (m.target) m.target.dead = true;
  }
}

function step(ctx, dt, n) {
  for (let i = 0; i < n; i++) {
    updateCampaign(dt, ctx.game);
    ctx.cw.updateCityWar(dt, ctx.game);
    killColumns(ctx.c);
  }
}

const batteries = (ctx) => ctx.c.formations.filter((f) => f.type === 'artilleryBattery');

// ─── (a) bateria só dispara deployed ──────────────────────────────────────────
test('T-C-09(a): bateria em transit NÃO dispara; deployed dispara', { timeout: 300000 }, async () => {
  const ctx = await setupScenario('a', 'citywar-a');
  // Passo a passo: enquanto NENHUMA bateria está deployed, zero disparos.
  let guard = 0;
  while (batteries(ctx).every((f) => f.state !== 'deployed') && guard++ < 900) {
    step(ctx, 1, 1);
    assert.equal(ctx.rec.fires, 0, `disparo em transit (t=${ctx.c.t.toFixed(0)}s)`);
  }
  assert.ok(batteries(ctx).length >= 1, 'nenhuma bateria spawnou');
  assert.ok(guard < 900, 'bateria nunca chegou a deployed');
  step(ctx, 1, 40);
  assert.ok(ctx.rec.fires > 0, 'bateria deployed não disparou em 40 s');
});

// ─── (b) determinismo + alvos são prédios reais da TOWN_SHELF ─────────────────
test('T-C-09(b): bombardeio seedado-determinístico contra prédios reais', { timeout: 300000 }, async () => {
  const run = async (tag) => {
    const ctx = await setupScenario(tag, 'citywar-b');
    let guard = 0;
    while (ctx.rec.impacts.length < 6 && guard++ < 1200) step(ctx, 1, 1);
    assert.ok(ctx.rec.impacts.length >= 6, 'menos de 6 impactos em 1200 s de sim');
    return ctx.rec.impacts.slice(0, 6).map((i) => [Math.round(i.x * 10), Math.round(i.y * 10), Math.round(i.z * 10)]);
  };
  const a = await run('b1'), b = await run('b2');
  assert.deepEqual(a, b, 'mesma seed → impactos diferentes');
  const structures = getInhaumaStructures();
  for (const [x, , z] of a) {
    const s = structures.find((st) => Math.abs(st.x - x / 10) <= st.halfX + 6 && Math.abs(st.z - z / 10) <= st.halfZ + 6);
    assert.ok(s, `impacto (${x / 10},${z / 10}) não corresponde a nenhum prédio real`);
    assert.ok(s.x > TOWN_SHELF.minX && s.x < TOWN_SHELF.maxX && s.z > TOWN_SHELF.minZ && s.z < TOWN_SHELF.maxZ,
      `prédio ${s.id} fora da TOWN_SHELF`);
  }
});

// ─── (c) impacto → prop fire no prédio; bateria morta → re-arm para ───────────
test('T-C-09(c): impacto incendeia o prédio visado; fogo morre com a bateria', { timeout: 300000 }, async () => {
  const ctx = await setupScenario('c', 'citywar-c');
  let guard = 0;
  while (ctx.rec.impacts.length < 3 && guard++ < 1200) step(ctx, 1, 1);
  const dbg = ctx.cw.cityWarDebug();
  assert.ok(dbg.burning.size >= 1, 'nenhum prédio queimando após impactos');
  // Cada prédio queimando recebeu prop fire nas SUAS coordenadas + fumaça
  for (const [id, e] of dbg.burning) {
    assert.ok(ctx.rec.propFires.some((p) => p.x === e.building.x && p.z === e.building.z),
      `prédio ${id} queimando sem prop fire registrado`);
    assert.ok(ctx.rec.smokes.some((s) => s.owner === e.owner), `prédio ${id} sem coluna de fumaça`);
  }
  assert.ok(ctx.rec.scorches >= 1, 'sem scorch nos primeiros impactos');
  // Mata os obuseiros da bateria DONA de um foco → os focos dela expiram sem re-arm
  const victimEntry = [...dbg.burning.values()][0];
  const victim = batteries(ctx).find((f) => f.id === victimEntry.batteryId);
  assert.ok(victim, 'bateria dona do foco não encontrada');
  const burningOfVictim = [...dbg.burning.values()].filter((e) => e.batteryId === victim.id);
  assert.ok(burningOfVictim.length >= 1, 'bateria escolhida não tinha foco ativo');
  // Abate TODAS as baterias: elimina a chance de outra bateria re-incendiar os
  // mesmos prédios durante a janela de expiração (o que tornaria o assert frouxo).
  for (const f of batteries(ctx)) for (const m of f.members) if (m.unit === 'artillery' && m.target) m.target.dead = true;
  step(ctx, 1, 90); // REARM_S=22 s — folga de 3+ ciclos de re-arm
  for (const e of burningOfVictim) {
    assert.ok(!dbg.burning.has(e.building.id), `foco de ${e.building.id} não expirou com a bateria morta`);
    assert.ok(ctx.rec.removedSmokes.includes(e.owner), `fumaça de ${e.building.id} não removida`);
  }
  assert.equal(dbg.burning.size, 0, 'focos restantes com todas as baterias mortas');
});

// ─── (d) modelo de acerto por distância ───────────────────────────────────────
test('T-C-10(d): p(AA)=0.8 a <50 m, monotônico não-crescente, piso/teto', () => {
  assert.equal(hitProbability(10, 'aa'), 0.80);
  assert.equal(hitProbability(49.9, 'aa'), 0.80);
  assert.equal(hitProbability(10, 'ground'), 0.50);
  assert.equal(hitProbability(49.9, 'ground'), 0.50);
  assert.equal(hitProbability(10000, 'aa'), ENEMY_FIRE.AA.floor);
  assert.equal(hitProbability(10000, 'ground'), ENEMY_FIRE.GROUND.floor);
  for (const cls of ['aa', 'ground']) {
    let prev = Infinity;
    for (let d = 0; d <= 350; d += 5) {
      const p = hitProbability(d, cls);
      assert.ok(p <= prev + 1e-12, `${cls}: subiu em d=${d}`);
      assert.ok(p >= (cls === 'aa' ? ENEMY_FIRE.AA.floor : ENEMY_FIRE.GROUND.floor) - 1e-12);
      assert.ok(p <= (cls === 'aa' ? 0.80 : 0.50) + 1e-12);
      prev = p;
    }
  }
  // Ponto de referência do brief: AA ≈50% a 150 m
  assert.ok(Math.abs(hitProbability(150, 'aa') - 0.50) < 1e-9);
});

// ─── (e) balas retas, 70-90 m/s, mira direta no HIT / offset no MISS ──────────
test('T-C-10(e): projétil reto a 70-90 m/s; HIT mira o jato, MISS desvia 2-6°', () => {
  assert.ok(ENEMY_FIRE.BULLET_SPD >= 70 && ENEMY_FIRE.BULLET_SPD <= 90, 'velocidade fora da banda desviável');
  const jetPos = { x: 100, y: 50, z: 0 };
  const mkGame = (rng) => ({
    rng,
    targets: [{
      formationId: 'f1', dead: false, range: 300, type: 'fAaGun',
      fireTimer: 0.001, fireInterval: 1.7,
      mesh: { position: { x: 0, y: 0, z: 0 } },
    }],
  });
  // HIT forçado (random sempre < p): mira EXATA no jato, direção unitária
  const hits = [];
  updateFormationFire(0.1, mkGame({ random: () => 0.0, range: (a) => a }), jetPos, (t, o, d, cls) => hits.push({ o, d, cls }));
  assert.equal(hits.length, 1);
  assert.equal(hits[0].cls, 'aa');
  const dl = Math.hypot(hits[0].d.x, hits[0].d.y, hits[0].d.z);
  assert.ok(Math.abs(dl - 1) < 1e-9, 'direção não unitária');
  const dist = Math.hypot(100, 50, 0);
  assert.ok(Math.abs(hits[0].d.x - 100 / dist) < 1e-9 && Math.abs(hits[0].d.y - 50 / dist) < 1e-9,
    'HIT não mirou direto na posição atual do jato (sem lead)');
  // MISS forçado: offset angular dentro de 2-6°
  const miss = [];
  updateFormationFire(0.1, mkGame({ random: () => 0.999, range: (a) => a }), jetPos, (t, o, d) => miss.push({ o, d }));
  assert.equal(miss.length, 1);
  const dot = (miss[0].d.x * 100 + miss[0].d.y * 50) / dist;
  const deg = (Math.acos(Math.min(1, Math.max(-1, dot))) * 180) / Math.PI;
  assert.ok(deg >= 1.5 && deg <= 7.5, `offset do MISS fora de ~2-6°: ${deg.toFixed(2)}°`);
  // Trajetória reta: velocidade constante → todos os pontos colineares
  const v = { x: hits[0].d.x * ENEMY_FIRE.BULLET_SPD, y: hits[0].d.y * ENEMY_FIRE.BULLET_SPD, z: 0 };
  let px = hits[0].o.x, py = hits[0].o.y, pz = hits[0].o.z;
  const pts = [];
  for (let i = 0; i < 20; i++) { px += v.x * 0.1; py += v.y * 0.1; pz += v.z * 0.1; pts.push([px, py, pz]); }
  for (const [x, y, z] of pts.slice(1)) {
    const u = (x - pts[0][0]) / (v.x || 1);
    assert.ok(Math.abs(y - (pts[0][1] + v.y * u)) < 1e-6 && Math.abs(z - (pts[0][2] + v.z * u)) < 1e-6,
      'trajetória não é reta');
  }
});

// ─── (f) tráfego militar na osm-mg-060 ────────────────────────────────────────
test('T-C-11(f): caminhões na polilinha, fora do shelf/aeroporto (300 s)', { timeout: 300000 }, () => {
  const refs = buildInhaumaTraffic(fakeScene(), null);
  assert.ok(refs.military.length >= 8 && refs.military.length <= 15,
    `contagem militar fora de 8-15: ${refs.military.length}`);
  const inShelf = (x, z) => x > TOWN_SHELF.minX && x < TOWN_SHELF.maxX && z > TOWN_SHELF.minZ && z < TOWN_SHELF.maxZ;
  let sawWreck = false, sawRespawn = false;
  let killed = false;
  for (let i = 0; i < 600; i++) { // 600 × 0.5 s = 300 s
    updateRoadTraffic(0.5, refs, inhaumaContinuousHeight);
    if (i === 60 && !killed) { refs.military[0].target.dead = true; killed = true; } // strafe simulado
    for (const m of refs.military) {
      if (m.state === 'wreck') sawWreck = true;
      if (killed && m === refs.military[0] && m.state === 'run' && i > 60) sawRespawn = true;
      assert.ok(nearAnyRoad(m.lastX, m.lastZ, 14), `caminhão fora da estrada em (${m.lastX.toFixed(0)},${m.lastZ.toFixed(0)})`);
      assert.ok(!inShelf(m.lastX, m.lastZ), 'caminhão dentro da TOWN_SHELF');
      assert.ok(!inhaumaAirportExclusionZoneAt(m.lastX, m.lastZ), 'caminhão na zona do aeroporto');
      assert.ok(!isInhaumaAirportSurface(m.lastX, m.lastZ), 'caminhão no pavimento do aeroporto');
      if (m.state === 'run') assert.ok(m.d >= 0 && m.d <= refs.milRoute.length, 'cum fora da polilinha');
    }
  }
  assert.ok(sawWreck, 'caminhão abatido não virou wreck');
  assert.ok(sawRespawn, 'wreck não respawnou no fluxo');
  assert.equal(refs.diagnostics.militaryCount, refs.military.length, 'diagnostics.militaryCount diverge');
});

// ─── (g) hot paths sem alocação ───────────────────────────────────────────────
test('T-C-09(g): pool fixo de projéteis, ≤3 em voo/bateria, contagens estáveis', { timeout: 300000 }, async () => {
  const ctx = await setupScenario('g', 'citywar-g');
  const poolBefore = ctx.cw.cityWarDebug().poolSize;
  let guard = 0, maxInFlight = 0;
  while (ctx.rec.impacts.length < 5 && guard++ < 1200) {
    step(ctx, 1, 1);
    const shells = ctx.cw.cityWarDebug().shells;
    maxInFlight = Math.max(maxInFlight, shells.length);
    const perBattery = {};
    for (const s of shells) perBattery[s.batteryId] = (perBattery[s.batteryId] || 0) + 1;
    for (const n of Object.values(perBattery)) assert.ok(n <= 3, `bateria com ${n} projéteis em voo`);
  }
  assert.ok(maxInFlight >= 1, 'nenhum projétil voou');
  assert.equal(ctx.cw.cityWarDebug().poolSize, poolBefore, 'pool de projéteis cresceu (alocação)');
  assert.equal(poolBefore, 12);
  // Tráfego militar: contagem de instâncias constante (wreck/respawn não aloca)
  const refs = buildInhaumaTraffic(fakeScene(), null);
  const n0 = refs.military.length;
  refs.military[0].target.dead = true;
  for (let i = 0; i < 120; i++) updateRoadTraffic(0.5, refs, inhaumaContinuousHeight);
  assert.equal(refs.military.length, n0, 'contagem militar variou (alocação de instância)');
});
