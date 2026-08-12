// test-aero-campaign.mjs — Validador Node do diretor de campanha de Inhaúma
// (T-C-06, release v0.3.4 — SPEC §C/§F).
//
// Prova, com deps REAIS do mapa (heightmap chain, estradas, rio, zonas do
// aeroporto — mesmo padrão de test-aero-formations.mjs/test-aero-cachoeira.mjs)
// e a guarnição REAL de Cachoeira (buildCachoeiraGarrison, T-C-05):
//   (a) spawns do Ato 1 seedado-determinísticos (duas execuções, mesma lista);
//   (b) spawns escalonados no tempo (nada de tudo em t=0);
//   (c) matar todos os alvos do Ato 1 → transição para o Ato 2 + rebase dos
//       contadores para a guarnição;
//   (d) matar toda a guarnição → vitória;
//   (e) coluna que completa o path ('arrived') → caminho de falha (Inhaúma cai);
//   (f) targetsTotal/targetsDestroyed espelham os contadores do ato na transição;
//   (g) resetCampaign NUNCA remove alvo da guarnição (só os da campanha).
//
// Roda com: node --experimental-default-type=module tests/aero-fighters/tools/test-aero-campaign.mjs

import test from 'node:test';
import assert from 'node:assert/strict';

import { loadInhaumaDem } from '../../../aero-fighters/src/maps/heightmap-sampler.js';
import { CACHOEIRA_SHELF, TOWN_SHELF, inhaumaVisualSurfaceHeight } from '../../../aero-fighters/src/maps/inhauma-scene.js';
import { getInhaumaRiverPolyline, RIVER_HALF_WIDTH_M } from '../../../aero-fighters/src/maps/inhauma-river.js';
import { INHAUMA_AIRPORT_EXCLUSION_ZONES } from '../../../aero-fighters/src/maps/inhauma-road-airport.js';
import { createRng } from '../../../aero-fighters/src/rng.js';
import { buildCachoeiraGarrison } from '../../../aero-fighters/src/maps/inhauma-garrison.js';
import { initCampaign, updateCampaign, resetCampaign, setCampaignHooks } from '../../../aero-fighters/src/campaign.js';
import { CAMPAIGN } from '../../../aero-fighters/src/config.js';

await loadInhaumaDem();

const fakeScene = () => ({ add() {}, remove() {} });

/** Setup completo: game mock + guarnição REAL (44 alvos) + campanha inicializada.
 *  As seeds dos testes ('seed-N') foram escolhidas por probe offline: nelas o
 *  ÚLTIMO spawn do Ato 1 acontece ≥30 s ANTES da primeira chegada de coluna
 *  ('arrived' → falha) — os testes de transição/vitória precisam desse window;
 *  o teste de falha usa uma seed onde a chegada acontece cedo. */
function setup(seed = 'campaign-test') {
  const game = {
    targets: [], rng: createRng(seed), runtime: { seed },
    score: 0, kills: 0, targetsTotal: 0, targetsDestroyed: 0,
  };
  const garrison = buildCachoeiraGarrison(fakeScene(), {
    game,
    formationDeps: {
      rng: createRng(`${seed}:cachoeira-garrison`), // mesmo padrão derivado do browser
      heightAt: inhaumaVisualSurfaceHeight,
      exclusions: [TOWN_SHELF, CACHOEIRA_SHELF, ...INHAUMA_AIRPORT_EXCLUSION_ZONES],
      riverPolyline: getInhaumaRiverPolyline(),
      riverHalfWidth: RIVER_HALF_WIDTH_M,
    },
    shelf: CACHOEIRA_SHELF,
  });
  const overlays = [];
  const failures = [];
  setCampaignHooks({ showOverlay: (t, s) => overlays.push([t, s]), onFailure: () => failures.push(1) });
  const c = initCampaign(game, { scene: fakeScene(), garrisonFormations: garrison.formations });
  return { game, garrison, c, overlays, failures };
}

/** Avança a campanha até `cond` ou estourar maxT (retorna o t final). Guarda de
 *  relógio congelado: após failed/victory o updateCampaign early-returns SEM
 *  avançar c.t — sem o guard o laço giraria para sempre. */
function simUntil(ctx, cond, maxT = 1500, dt = 1) {
  let frozen = 0;
  while (ctx.c.t < maxT && !cond()) {
    const before = ctx.c.t;
    updateCampaign(dt, ctx.game);
    if (ctx.c.t === before && ++frozen > 5) break;
  }
  return ctx.c.t;
}

const killAll = (formations) => {
  for (const f of formations) for (const m of f.members) if (m.target) m.target.dead = true;
};

// ─── (a) determinismo por seed ────────────────────────────────────────────────
test('T-C-06(a): mesma seed → mesma agenda e mesma lista de spawns do Ato 1', { timeout: 300000 }, () => {
  const run = () => {
    const ctx = setup('seed-8');
    simUntil(ctx, () => ctx.c.pending.length === 0, 600);
    return ctx.c.formations.map((f) => [
      f.id, f.type, f.members.length,
      ...f.members.slice(0, 2).map((m) => [Math.round(m.pos.x), Math.round(m.pos.z)]),
    ]);
  };
  assert.deepEqual(run(), run());
});

// ─── (b) spawn escalonado ─────────────────────────────────────────────────────
test('T-C-06(b): formações nascem escalonadas — nunca todas em t=0', { timeout: 300000 }, () => {
  const ctx = setup('seed-6');
  assert.equal(ctx.c.formations.length, 0, 'formação spawnada antes do primeiro tick');
  updateCampaign(CAMPAIGN.FIRST_SPAWN_S - 1, ctx.game);
  assert.equal(ctx.c.formations.length, 0, 'spawn antes de FIRST_SPAWN_S');
  updateCampaign(2, ctx.game);
  const early = ctx.c.formations.length;
  assert.ok(early >= 1 && early <= 2, `esperado 1-2 spawns logo após FIRST_SPAWN_S, veio ${early}`);
  simUntil(ctx, () => ctx.c.pending.length === 0, 600);
  assert.equal(ctx.c.spawnedCount, ctx.c.quota);
  assert.ok(ctx.c.t > 120, `último spawn cedo demais (t=${ctx.c.t.toFixed(0)}s — queremos o ato em ~10-15 min)`);
  // Composição: 3 artilleryBattery (5-8) + 4 colunas (supplyConvoy 5, troopColumn 8,
  // armoredColumn 10, tankPlatoon 12).
  const byType = {};
  for (const f of ctx.c.formations) byType[f.type] = (byType[f.type] || 0) + 1;
  assert.equal(byType.artilleryBattery, CAMPAIGN.artilleryCount);
  for (const [type] of CAMPAIGN.columns) assert.equal(byType[type], 1, `coluna ${type} ausente`);
  for (const f of ctx.c.formations.filter((f) => f.type === 'artilleryBattery')) {
    assert.ok(f.members.length >= CAMPAIGN.artillerySize[0] && f.members.length <= CAMPAIGN.artillerySize[1]);
  }
});

// ─── (c)+(f) transição de ato + espelho de contadores ─────────────────────────
test('T-C-06(c/f): matar o Ato 1 → Ato 2 com rebase; targetsTotal/Destroyed espelham o ato', { timeout: 300000 }, () => {
  const ctx = setup('seed-8');
  const { game, c, garrison } = ctx;
  // (f) espelho no init
  assert.equal(game.targetsTotal, c.actTargetsTotal);
  assert.equal(game.targetsDestroyed, 0);
  simUntil(ctx, () => c.pending.length === 0, 600);
  // (f) espelho no meio do Ato 1: mata 3 membros e confere o contador global
  const some = c.formations[0].members.slice(0, 3);
  for (const m of some) m.target.dead = true;
  updateCampaign(0.1, game);
  assert.equal(game.targetsDestroyed, 3);
  assert.equal(game.targetsTotal, c.actTargetsTotal);
  // (c) mata TUDO do Ato 1 → transição
  const act1Total = c.actTargetsTotal;
  killAll(c.formations);
  updateCampaign(0.1, game);
  assert.equal(c.act, 2, 'sem transição para o Ato 2');
  const garrisonTotal = garrison.formations.reduce((s, f) => s + f.members.length, 0);
  assert.equal(c.actTargetsTotal, garrisonTotal, 'rebase do total para a guarnição falhou');
  assert.notEqual(c.actTargetsTotal, act1Total);
  assert.equal(game.targetsTotal, garrisonTotal, 'targetsTotal não espelhou o rebase');
  assert.equal(game.targetsDestroyed, 0, 'guarnição intacta → destroyed do ato deve ser 0');
  assert.ok(ctx.overlays.some(([t]) => t.includes('INHAÚMA DEFENDIDA')), 'overlay de transição ausente');
});

// ─── (d) vitória ──────────────────────────────────────────────────────────────
test('T-C-06(d): guarnição varrida → vitória (mundo segue vivo)', { timeout: 300000 }, () => {
  const ctx = setup('seed-8');
  simUntil(ctx, () => ctx.c.pending.length === 0, 600);
  killAll(ctx.c.formations);
  updateCampaign(0.1, ctx.game);
  assert.equal(ctx.c.act, 2);
  killAll(ctx.garrison.formations);
  updateCampaign(0.1, ctx.game);
  assert.equal(ctx.c.victory, true, 'sem flag de vitória');
  assert.ok(ctx.overlays.some(([t]) => t.includes('VITÓRIA')), 'overlay de vitória ausente');
  assert.equal(ctx.game.running, undefined, 'vitória não deve mexer em game.running (mundo vivo)');
});

// ─── (e) invasão bem-sucedida → falha ─────────────────────────────────────────
test('T-C-06(e): coluna que completa o path (arrived) derruba Inhaúma (mission-failed)', { timeout: 300000 }, () => {
  const ctx = setup('seed-1');
  simUntil(ctx, () => ctx.c.failed, 1500, 1);
  assert.equal(ctx.c.failed, true, 'nenhuma coluna chegou ao fim do path em 1500 s');
  assert.equal(ctx.failures.length, 1, 'onFailure não disparou (ou disparou 2x)');
  assert.ok(ctx.c.formations.some((f) => f.state === 'arrived'), 'falha sem formação arrived');
  // Depois da falha o diretor para (o restart reseta o ato via resetCampaign).
  const tFail = ctx.c.t;
  updateCampaign(5, ctx.game);
  assert.equal(ctx.c.t, tFail, 'relógio da campanha avançou após a falha');
});

// ─── (g) reset preserva a guarnição ───────────────────────────────────────────
test('T-C-06(g): resetCampaign remove SÓ alvos da campanha — guarnição intacta', { timeout: 300000 }, () => {
  const ctx = setup('seed-6');
  const { game, c, garrison } = ctx;
  const garrisonTargets = game.targets.filter((t) => String(t.formationId).startsWith('cachoeira-'));
  assert.equal(garrisonTargets.length, garrison.formations.reduce((s, f) => s + f.members.length, 0));
  simUntil(ctx, () => c.formations.length >= 2, 300);
  killAll([c.formations[0]]);
  const before = game.targets.length;
  resetCampaign(game);
  // Ato resetado
  assert.equal(c.act, 1);
  assert.equal(c.failed, false);
  assert.equal(c.t, 0);
  assert.equal(c.formations.length, 0);
  assert.equal(c.spawnedCount, 0);
  // Guarnição: nenhum alvo removido pela limpeza da campanha
  const garrisonAfter = game.targets.filter((t) => String(t.formationId).startsWith('cachoeira-'));
  assert.equal(garrisonAfter.length, garrisonTargets.length, 'reset removeu alvo da guarnição');
  for (const t of garrisonTargets) assert.ok(game.targets.includes(t), 'alvo da guarnição sumiu do barramento');
  // Nenhum formationId de campanha sobrou
  assert.ok(!game.targets.some((t) => String(t.formationId).startsWith('campaign-act1-')));
  assert.ok(game.targets.length < before, 'reset não removeu os alvos da campanha');
  // E a campanha re-spawna do zero (agenda íntegra de volta)
  simUntil(ctx, () => c.formations.length >= 1, 60);
  assert.ok(c.formations.length >= 1, 'campanha não re-spawnou após o reset');
});
