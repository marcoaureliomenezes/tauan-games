// test-aero-cachoeira.mjs — Validador Node de Cachoeira da Prata + guarnição de
// ocupação (T-C-04/T-C-05, release v0.3.4 — SPEC §B/§F).
//
// Prova, com dados REAIS do mapa (heightmap chain de inhauma-scene.js, polilinhas
// de inhauma-roads.js, rio de inhauma-river.js, zonas de inhauma-road-airport.js):
//   (a) o shelf existe e é plano (desvio-padrão < 3 m nas amostras do shelf);
//   (b) a cidade tem 60-120 prédios (registerStructure 'predio-cachoeira');
//   (c) ZERO prédios dentro dos keep-outs de estrada/rio/aeroporto (a MESMA
//       matemática de exclusão dos builders) e ZERO árvores dentro do shelf;
//   (d) guarnição: todo aaNest fora do shelf e acima da cota média do shelf,
//       pontos do path dos blindados a ≤25 m de uma polilinha de estrada,
//       QG/patrulhas presentes e registrados em game.targets;
//   (e) metadata: centro de CACHOEIRA_TOWN_CENTER (fonte única que alimenta
//       INHAUMA_CITIES/LANDMARKS em inhauma.js) a ≤150 m do centroide construído;
//   (f) determinismo: duas execuções da guarnição com a mesma seed são idênticas.
//
// Roda com: node --experimental-default-type=module tests/aero-fighters/tools/test-aero-cachoeira.mjs

import test from 'node:test';
import assert from 'node:assert/strict';

import { loadInhaumaDem } from '../../../aero-fighters/src/maps/heightmap-sampler.js';
import {
  CACHOEIRA_SHELF, CACHOEIRA_TOWN_CENTER, TOWN_SHELF,
  inhaumaVisualSurfaceHeight, buildCachoeira, buildForests, getInhaumaStructures, inhaumaTrees,
} from '../../../aero-fighters/src/maps/inhauma-scene.js';
import { getInhaumaRoads, nearAnyRoad } from '../../../aero-fighters/src/maps/inhauma-roads.js';
import { getInhaumaRiverPolyline, distanceToRiver, RIVER_HALF_WIDTH_M } from '../../../aero-fighters/src/maps/inhauma-river.js';
import { INHAUMA_AIRPORT_EXCLUSION_ZONES, inhaumaAirportExclusionZoneAt } from '../../../aero-fighters/src/maps/inhauma-road-airport.js';
import { createRng } from '../../../aero-fighters/src/rng.js';
import { nearestOnPolyline, updateFormations } from '../../../aero-fighters/src/formations/formation.js';
import { buildCachoeiraGarrison } from '../../../aero-fighters/src/maps/inhauma-garrison.js';

await loadInhaumaDem();

const RIVER = getInhaumaRiverPolyline();
const ROADS = getInhaumaRoads();
const ROAD_POLYLINES = [ROADS.find((r) => r.id === 'mg-060'), ROADS.find((r) => r.id === 'osm-mg-060')]
  .filter(Boolean).map((r) => r.points);
const fakeScene = () => ({ add() {} });

const insideShelf = (x, z, m = 0) =>
  x >= CACHOEIRA_SHELF.minX - m && x <= CACHOEIRA_SHELF.maxX + m &&
  z >= CACHOEIRA_SHELF.minZ - m && z <= CACHOEIRA_SHELF.maxZ + m;

// ─── (a) Shelf plano ──────────────────────────────────────────────────────────
test('T-C-04(a): o shelf de Cachoeira existe e é plano (stddev < 3 m)', () => {
  const hs = [];
  for (let x = CACHOEIRA_SHELF.minX; x <= CACHOEIRA_SHELF.maxX; x += 20) {
    for (let z = CACHOEIRA_SHELF.minZ; z <= CACHOEIRA_SHELF.maxZ; z += 20) {
      hs.push(inhaumaVisualSurfaceHeight(x, z));
    }
  }
  const mean = hs.reduce((a, b) => a + b, 0) / hs.length;
  const sd = Math.sqrt(hs.reduce((a, b) => a + (b - mean) ** 2, 0) / hs.length);
  assert.ok(sd < 3, `shelf não é plano: stddev=${sd.toFixed(2)} m`);
  // 2026-08-11: novo vale de várzea a (-2400,2200) — aterro CACHOEIRA_SHELF_H=12 m
  assert.ok(mean > 8 && mean < 16, `cota do shelf fora do esperado: ${mean.toFixed(1)} m`);
});

// ─── (a2) T-D-04: Cachoeira × Inhaúma a ~2 km (release nuke-firestorm-defense-v1)
test('T-D-04(a2)/2026-08-11: Cachoeira a 2,85-3,25 km do centro de Inhaúma (+50%), no quadrante SW', () => {
  const d = Math.hypot(CACHOEIRA_TOWN_CENTER.x - (-250), CACHOEIRA_TOWN_CENTER.z - 250);
  assert.ok(d >= 2850 && d <= 3250, `distância centro-a-centro fora de 2,85-3,25 km: ${d.toFixed(0)} m`);
  // Fidelidade regional (inhauma-fidelity.spec.js): a oeste e ao sul de Inhaúma
  assert.ok(CACHOEIRA_TOWN_CENTER.x < -250 - 350, 'não está a oeste de Inhaúma');
  assert.ok(CACHOEIRA_TOWN_CENTER.z > 250 + 150, 'não está ao sul de Inhaúma');
  // O shelf envolve o centro da metadata
  assert.ok(
    CACHOEIRA_TOWN_CENTER.x >= CACHOEIRA_SHELF.minX && CACHOEIRA_TOWN_CENTER.x <= CACHOEIRA_SHELF.maxX &&
    CACHOEIRA_TOWN_CENTER.z >= CACHOEIRA_SHELF.minZ && CACHOEIRA_TOWN_CENTER.z <= CACHOEIRA_SHELF.maxZ,
    'centro da cidade fora do shelf',
  );
});

// ─── (b/c) Cidade construída + keep-outs ──────────────────────────────────────
// buildCachoeira usa game.rng do state.js (seed default em Node — determinístico).
const town = buildCachoeira(fakeScene());
const buildings = getInhaumaStructures().filter((s) => s.id === 'predio-cachoeira');

test('T-C-04(b): contagem de prédios na faixa 60-120', () => {
  assert.ok(
    buildings.length >= 60 && buildings.length <= 120,
    `prédios fora da faixa: ${buildings.length}`,
  );
  assert.ok(town.blocks.length === buildings.length, 'blocks != structures registradas');
});

test('T-C-04(c): zero prédios dentro dos keep-outs (estrada/rio/aeroporto) — mesma matemática do builder', () => {
  for (const b of buildings) {
    assert.ok(!nearAnyRoad(b.x, b.z, 12), `prédio sobre estrada em (${b.x},${b.z})`);
    assert.ok(distanceToRiver(b.x, b.z) >= RIVER_HALF_WIDTH_M + 15, `prédio na faixa do rio em (${b.x},${b.z})`);
    assert.equal(inhaumaAirportExclusionZoneAt(b.x, b.z), null, `prédio em zona do aeroporto em (${b.x},${b.z})`);
    assert.ok(insideShelf(b.x, b.z), `prédio fora do shelf em (${b.x},${b.z})`);
  }
});

test('T-C-04(c): zero árvores dentro do shelf (keep-out de buildForests)', () => {
  buildForests(fakeScene());
  assert.ok(inhaumaTrees.length > 500, `floresta suspeitamente vazia (${inhaumaTrees.length})`);
  const inside = inhaumaTrees.filter((t) => insideShelf(t.x, t.z));
  assert.equal(inside.length, 0, `${inside.length} árvores dentro do shelf`);
});

// ─── (e) Metadata ↔ geometria ─────────────────────────────────────────────────
test('T-C-04(e): centro da metadata a ≤150 m do centroide construído', () => {
  // INHAUMA_CITIES/LANDMARKS 'cachoeira-da-prata' derivam de CACHOEIRA_TOWN_CENTER
  // (import compartilhado em inhauma.js — inhauma.js não é importável em Node por
  // factory-fx→scene.js, então a prova é contra a constante-fonte).
  const cx = buildings.reduce((s, b) => s + b.x, 0) / buildings.length;
  const cz = buildings.reduce((s, b) => s + b.z, 0) / buildings.length;
  const d = Math.hypot(cx - CACHOEIRA_TOWN_CENTER.x, cz - CACHOEIRA_TOWN_CENTER.z);
  assert.ok(d <= 150, `centroide construído (${cx.toFixed(0)},${cz.toFixed(0)}) a ${d.toFixed(0)} m da metadata`);
});

// ─── (d/f) Guarnição ──────────────────────────────────────────────────────────
const makeGarrisonDeps = (seed) => ({
  rng: createRng(seed),
  heightAt: inhaumaVisualSurfaceHeight,
  exclusions: [TOWN_SHELF, CACHOEIRA_SHELF, ...INHAUMA_AIRPORT_EXCLUSION_ZONES],
  riverPolyline: RIVER,
  riverHalfWidth: RIVER_HALF_WIDTH_M,
});

function runGarrison(seed) {
  const rng = createRng(seed);
  const game = { targets: [], rng };
  const formationDeps = makeGarrisonDeps(seed);
  const g = buildCachoeiraGarrison(fakeScene(), { game, formationDeps, shelf: CACHOEIRA_SHELF });
  return { g, game };
}

test('T-C-05(d): guarnição completa spawna e registra alvos no barramento de dano', () => {
  const { g, game } = runGarrison('c2-garrison');
  const types = g.formations.map((f) => f.type);
  // 2026-08-11 (doutrina 300/200): 3 ninhos nos morros + 2 baterias URBANAS
  // (praça + largo da igreja) — ver CACHOEIRA_GARRISON.townAaBatteries.
  assert.equal(types.filter((t) => t === 'aaNest').length, 5, 'aaNests != 3 morros + 2 urbanas');
  assert.equal(types.filter((t) => t === 'armoredColumn').length, 2, 'colunas != 2');
  assert.equal(types.filter((t) => t === 'airPatrol').length, 5, 'patrulhas aéreas != 5 (1 zep + 4 heli — 2026-08-11)');
  assert.ok(types.includes('encampment') && types.includes('samSite'), 'QG incompleto');
  const members = g.formations.reduce((s, f) => s + f.members.length, 0);
  assert.equal(game.targets.length, members, 'nem todo membro virou target');
  assert.ok(game.targets.every((t) => t.formationId), 'target sem formationId');
});

test('T-C-05(d): ninhos de morro fora do shelf/anel alto; baterias urbanas DENTRO da cidade', () => {
  const { g } = runGarrison('c2-garrison');
  const shelfMean = inhaumaVisualSurfaceHeight(CACHOEIRA_TOWN_CENTER.x, CACHOEIRA_TOWN_CENTER.z);
  const nests = g.formations.filter((f) => f.type === 'aaNest');
  const hills = nests.filter((f) => !f.id.includes('town-aa'));
  const town = nests.filter((f) => f.id.includes('town-aa'));
  assert.equal(hills.length, 3, 'ninhos de morro != 3');
  assert.equal(town.length, 2, 'baterias urbanas != 2 (doutrina 300/200)');
  for (const f of hills) {
    assert.ok(!insideShelf(f.anchor.x, f.anchor.z), `aaNest ${f.id} dentro do shelf`);
    const h = inhaumaVisualSurfaceHeight(f.anchor.x, f.anchor.z);
    assert.ok(h > shelfMean, `aaNest ${f.id} em ${h.toFixed(1)} m <= cota do shelf ${shelfMean.toFixed(1)} m`);
    const d = Math.hypot(f.anchor.x - CACHOEIRA_TOWN_CENTER.x, f.anchor.z - CACHOEIRA_TOWN_CENTER.z);
    assert.ok(d >= 250 && d <= 850, `aaNest ${f.id} fora do anel 300-800 (${d.toFixed(0)} m)`);
  }
  for (const f of town) {
    assert.ok(insideShelf(f.anchor.x, f.anchor.z), `bateria urbana ${f.id} FORA do shelf`);
  }
});

test('T-C-05(d): pontos do path dos blindados ficam a ≤25 m de uma polilinha de estrada', () => {
  const { g } = runGarrison('c2-garrison');
  for (const f of g.formations.filter((f) => f.type === 'armoredColumn')) {
    assert.ok(f.loop, `${f.id} sem loop`);
    for (const p of f.points) {
      const best = Math.min(...ROAD_POLYLINES.map((poly) => nearestOnPolyline(poly, p.x, p.z).d));
      assert.ok(best <= 25, `${f.id}: ponto (${p.x.toFixed(1)},${p.z.toFixed(1)}) a ${best.toFixed(1)} m da estrada`);
    }
  }
});

test('T-C-05(d): blindados circulam (loop) e patrulhas se movem sem NaN', () => {
  const { g } = runGarrison('c2-garrison');
  const armor = g.formations.find((f) => f.type === 'armoredColumn');
  const air = g.formations.find((f) => f.type === 'airPatrol');
  const before = armor.members[0].pos.x;
  const dt = 1 / 30;
  // Força uma volta inteira + wrap: progress além de pathLength.
  for (let i = 0; i < 30 * 400; i++) updateFormations(dt, [armor, air], armor.deps);
  assert.equal(armor.state, 'transit', 'coluna em loop não deveria estacionar');
  assert.notEqual(armor.members[0].pos.x, before, 'coluna não se moveu');
  for (const f of [armor, air]) {
    for (const m of f.members) {
      assert.ok(Number.isFinite(m.pos.x) && Number.isFinite(m.pos.y) && Number.isFinite(m.pos.z),
        `${f.id}: NaN em ${m.unit}#${m.index}`);
    }
  }
});

test('T-C-05(f): guarnição determinística — duas execuções da mesma seed são idênticas', () => {
  const snap = ({ g, game }) => JSON.stringify({
    positions: g.formations.map((f) => f.members.map((m) => [m.pos.x, m.pos.y, m.pos.z])),
    targets: game.targets.length,
    diagnostics: g.diagnostics,
  });
  assert.equal(snap(runGarrison('c2-garrison')), snap(runGarrison('c2-garrison')));
});
