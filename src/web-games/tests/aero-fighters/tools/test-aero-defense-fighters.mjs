// test-aero-defense-fighters.mjs — Validador Node da Onda D3 (T-D-06/T-D-07/
// T-D-08, release v0.3.5).
//
// Prova, sem browser (a lógica é PURA em src/defense/enemy-fighters.js,
// enemy-ordnance.js e allied-batteries.js):
//   (a) seleção de alvo respeita os pesos 45/30/15/10 (cidade/base/bateria/
//       jogador) em N escolhas seedadas — determinístico;
//   (b) máquina de estados ingress→attack-run→egress→re-ingress sem saltos
//       inválidos, com despawn após FIGHTER_RUNS_MAX corridas;
//   (c) release de ordenança só na janela de release e respeitando o cap
//       por corrida (1-2 mísseis);
//   (d) mísseis anti-jogador ≤ a fatia do peso (10%) numa corrida longa seedada;
//   (e) trajetória AG: nunca tunela abaixo do terreno (amostrado) e impacta
//       perto do ponto alvo;
//   (f) interceptação: proximidade da .50 mata o míssil anti-jogador (bônus);
//   (g) bateria aliada morre → para de atirar, vira wreck (emissor no modo);
//   (h) caças nunca abaixo de terreno+15 fora da janela de mergulho.
//
// Roda com: node --experimental-default-type=module tests/aero-fighters/tools/test-aero-defense-fighters.mjs

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { createRng } from '../../../aero-fighters/src/rng.js';
import { AA_DEFENSE } from '../../../aero-fighters/src/config.js';
import {
  FIGHTER_STATES, pickTargetKind, spawnFighter, stepFighter,
} from '../../../aero-fighters/src/defense/enemy-fighters.js';
import {
  spawnAgMissile, stepAgMissile, tryIntercept,
} from '../../../aero-fighters/src/defense/enemy-ordnance.js';
import {
  placeAlliedBatteries, stepBattery, stepAllyMissile, damageBattery, rearAxis, isRearThreat,
} from '../../../aero-fighters/src/defense/allied-batteries.js';

const SRC = fileURLToPath(new URL('../../../aero-fighters/', import.meta.url));
const read = (rel) => readFileSync(SRC + rel, 'utf8');
const C = AA_DEFENSE;

// Terreno ondulado (10..70 m) — torna o teste de clearance significativo.
const heightAt = (x, z) => 40 + 30 * Math.sin(x * 0.01) * Math.cos(z * 0.012);

function makeSets() {
  return {
    city: [
      { x: 0, z: 0, topY: heightAt(0, 0) + 8, ref: null },
      { x: 140, z: -90, topY: heightAt(140, -90) + 8, ref: null },
    ],
    base: [{ x: -320, z: 310, y: heightAt(-320, 310) + 2 }],
    battery: [
      { x: -700, z: -360, y: heightAt(-700, -360), dead: false },
      { x: -810, z: -440, y: heightAt(-810, -440), dead: false },
    ],
    player: { x: -760, y: heightAt(-760, -480) + 1.7, z: -480 }, // = SOLDIER_POS (T-D-01)
  };
}

function makeCtx(rng) {
  return { heightAt, rng, targetSets: makeSets(), center: { x: -250, z: 250 } };
}

/** Simula um caça até o despawn; registra transições, releases e violações. */
function simFighter(f, ctx, maxS = 500, dt = 0.1) {
  const log = {
    transitions: [f.state], releases: [], guns: 0, chaff: 0,
    despawn: false, violations: [], releasesThisRun: 0, maxRunReleases: 0,
  };
  let t = 0;
  while (t < maxS && !log.despawn) {
    const events = stepFighter(f, dt, ctx);
    t += dt;
    for (const e of events) {
      if (e.type === 'release') {
        log.releases.push({
          state: f.state,
          dist: Math.hypot(f.target.x - f.x, f.target.z - f.z),
          kind: f.target.kind,
        });
        log.releasesThisRun += 1;
        log.maxRunReleases = Math.max(log.maxRunReleases, log.releasesThisRun);
      } else if (e.type === 'gun') log.guns += 1;
      else if (e.type === 'chaff') log.chaff += 1;
      else if (e.type === 'despawn') log.despawn = true;
    }
    if (f.state !== log.transitions[log.transitions.length - 1]) {
      if (f.state === 'attack-run') log.releasesThisRun = 0;
      log.transitions.push(f.state);
    }
    const g = heightAt(f.x, f.z);
    const clr = f.state === 'attack-run' ? C.FIGHTER_DIVE_CLR : C.FIGHTER_TERRAIN_CLR;
    if (f.y < g + clr - 1e-6) log.violations.push({ t, y: f.y, g, state: f.state });
  }
  return log;
}

// ─── (a) Pesos de seleção de alvo ────────────────────────────────────────────

test('T-D-06(a): pesos 45/30/15/10 respeitados em 20000 escolhas seedadas', () => {
  const rng = createRng('d3:weights').random;
  const N = 20000;
  const counts = { city: 0, base: 0, battery: 0, player: 0 };
  for (let i = 0; i < N; i++) counts[pickTargetKind(rng)] += 1;
  const share = (k) => (counts[k] / N) * 100;
  assert.ok(Math.abs(share('city') - 45) < 2, `city ${share('city').toFixed(1)}%`);
  assert.ok(Math.abs(share('base') - 30) < 2, `base ${share('base').toFixed(1)}%`);
  assert.ok(Math.abs(share('battery') - 15) < 1.5, `battery ${share('battery').toFixed(1)}%`);
  assert.ok(Math.abs(share('player') - 10) < 1.5, `player ${share('player').toFixed(1)}%`);
  // determinismo: mesma seed → mesma contagem
  const rng2 = createRng('d3:weights').random;
  let city2 = 0;
  for (let i = 0; i < N; i++) if (pickTargetKind(rng2) === 'city') city2 += 1;
  assert.equal(city2, counts.city);
});

// ─── (b) Máquina de estados ──────────────────────────────────────────────────

test('T-D-06(b): ciclo ingress→attack-run→egress→re-ingress sem saltos inválidos', () => {
  const NEXT = {
    'ingress': ['attack-run'],
    'attack-run': ['egress'],
    'egress': ['re-ingress'],
    're-ingress': ['ingress'],
  };
  const rng = createRng('d3:sm-b');
  const f = spawnFighter(rng.random, makeCtx(rng.random));
  const log = simFighter(f, makeCtx(rng.random));
  assert.deepEqual([...new Set(FIGHTER_STATES)], ['ingress', 'attack-run', 'egress', 're-ingress']);
  // sequência completa do ciclo aparece e todo salto é válido
  assert.deepEqual(log.transitions.slice(0, 4), ['ingress', 'attack-run', 'egress', 're-ingress']);
  for (let i = 1; i < log.transitions.length; i++) {
    const from = log.transitions[i - 1], to = log.transitions[i];
    assert.ok(NEXT[from].includes(to), `salto inválido ${from} → ${to}`);
  }
  assert.ok(log.transitions.filter((s) => s === 'attack-run').length >= 2, 'menos de 2 corridas');
  assert.ok(log.despawn, 'caça não despawnou após FIGHTER_RUNS_MAX corridas');
});

// ─── (c) Janela e cap de release ─────────────────────────────────────────────

test('T-D-06(c): ordenança só na janela de release, cap 1-2 por corrida', () => {
  const rng = createRng('d3:release');
  let releases = 0, guns = 0;
  for (let i = 0; i < 40; i++) {
    const f = spawnFighter(rng.random, makeCtx(rng.random));
    const log = simFighter(f, makeCtx(rng.random));
    releases += log.releases.length;
    guns += log.guns;
    assert.ok(log.maxRunReleases <= 2, `cap por corrida violado (${log.maxRunReleases})`);
    for (const r of log.releases) {
      assert.equal(r.state, 'attack-run', 'release fora do attack-run');
      assert.ok(r.dist <= C.FIGHTER_RELEASE_DIST + 1,
        `release longe demais (${r.dist.toFixed(0)} m)`);
      assert.ok(r.dist >= C.FIGHTER_ABORT_DIST - 20,
        `release perto demais (${r.dist.toFixed(0)} m)`);
    }
  }
  assert.ok(releases > 30, `poucos releases no agregado (${releases})`);
  assert.ok(guns > 0, 'nenhuma rajada anti-jogador no agregado');
});

// ─── (d) Fatia de mísseis anti-jogador ───────────────────────────────────────

test('T-D-07(d): mísseis anti-jogador ≤ 10% do total numa corrida longa seedada', () => {
  const rng = createRng('d3:share');
  let total = 0, atPlayer = 0;
  for (let i = 0; i < 120; i++) {
    const f = spawnFighter(rng.random, makeCtx(rng.random));
    const log = simFighter(f, makeCtx(rng.random));
    total += log.releases.length;
    atPlayer += log.releases.filter((r) => r.kind === 'player').length;
  }
  assert.ok(total > 80, `amostra pequena demais (${total})`);
  const share = atPlayer / total;
  assert.ok(share <= 0.10, `fatia anti-jogador ${(share * 100).toFixed(1)}% > 10%`);
});

// ─── (e) Trajetória do míssil AG ─────────────────────────────────────────────

test('T-D-07(e): arco→terminal dive não tunela o terreno e impacta perto do alvo', () => {
  const rng = createRng('d3:ag').random;
  for (let k = 0; k < 12; k++) {
    const from = { x: rng() * 600 - 300, y: 300 + rng() * 60, z: rng() * 600 - 300 };
    const target = { kind: 'city', x: 500, y: heightAt(500, 0) + 8, z: 0, ref: null };
    const d = Math.hypot(target.x - from.x, target.z - from.z);
    const dir = { x: (target.x - from.x) / d, y: 0, z: (target.z - from.z) / d };
    const m = spawnAgMissile(from, dir, target, rng);
    assert.ok(m.vy > 0, 'arco deveria começar subindo');
    let ev = null, steps = 0;
    while (!ev && steps++ < 2000) {
      ev = stepAgMissile(m, 0.05, { heightAt });
      if (!ev) {
        assert.ok(m.y > heightAt(m.x, m.z) - 1e-6,
          `tunelou o terreno em (${m.x.toFixed(0)},${m.z.toFixed(0)})`);
      }
    }
    assert.ok(ev?.impact, 'míssil expirou sem impacto');
    assert.ok(ev.impact.dist < 30, `impacto longe do alvo (${ev.impact.dist.toFixed(1)} m)`);
  }
});

// ─── (f) Interceptação pela .50 ──────────────────────────────────────────────

test('T-D-07(f): bala .50 a <4 m intercepta o míssil anti-jogador (bônus)', () => {
  const rng = createRng('d3:intercept').random;
  const target = { kind: 'player', x: 0, y: 50, z: 0, ref: null };
  const m = spawnAgMissile({ x: -300, y: 280, z: 0 }, { x: 1, y: 0, z: 0 }, target, rng);
  assert.equal(m.atPlayer, true);
  assert.equal(m.hr2, C.INTERCEPT_R * C.INTERCEPT_R, 'hr2 deve casar com INTERCEPT_R');
  // bala longe: não intercepta
  assert.equal(tryIntercept({ x: m.x + 20, y: m.y, z: m.z }, m), false);
  assert.equal(m.dead, false);
  // bala a 3 m: intercepta e marca o míssil
  assert.equal(tryIntercept({ x: m.x + 3, y: m.y, z: m.z }, m), true);
  assert.equal(m.dead, true);
  assert.equal(tryIntercept({ x: m.x, y: m.y, z: m.z }, m), false, 'míssil morto não reintercepta');
  assert.ok(C.INTERCEPT_BONUS >= 100, 'bônus de interceptação configurado');
});

// ─── (g) Bateria aliada: morte → para de atirar, wreck registrado ────────────

test('T-D-08(g): bateria destruída para de atirar e vira carcaça (wreck)', () => {
  const rng = createRng('d3:batt');
  const batteries = placeAlliedBatteries(rng.random, {
    heightAt, soldier: { x: -760, z: -400 }, base: { x: -560, z: 320 },
  });
  // T-D-03: 3-5 seedadas + 1 FIXA da retaguarda
  assert.ok(batteries.length >= 4 && batteries.length <= 6, `contagem ${batteries.length}`);
  assert.equal(batteries.filter((b) => b.rearGuard).length, 1, 'sem a bateria da retaguarda');
  const regular = batteries.filter((b) => !b.rearGuard);
  assert.ok(regular.length >= 3 && regular.length <= 5, `contagem regular ${regular.length}`);
  const nearHill = regular.filter((b) => Math.hypot(b.x + 760, b.z + 400) < 75);
  assert.ok(nearHill.length >= 1, 'nenhuma bateria no morro perto do jogador');
  for (const b of batteries) assert.equal(b.y, heightAt(b.x, b.z), 'não ancorada no terreno');

  const b = regular[0];
  const fighter = { x: b.x + 300, y: b.y + 200, z: b.z, vx: -90, vy: 0, vz: 0, dead: false };
  // viva: atira tracers e eventualmente míssil ocasional
  let tracers = 0, missiles = 0;
  for (let i = 0; i < 600; i++) {
    for (const e of stepBattery(b, 1 / 60, { rng: rng.random, fighters: [fighter] })) {
      if (e.type === 'tracer') tracers += 1;
      else missiles += 1;
    }
  }
  assert.ok(tracers > 15, `poucos tracers (${tracers})`);
  assert.ok(missiles >= 1, 'nenhum míssil ocasional em 10 s');
  // morta: wreck + silêncio de fogo
  assert.equal(damageBattery(b, 1), false, 'HP 12 não morre com 1 de dano');
  assert.equal(damageBattery(b, 999), true);
  assert.ok(b.dead && b.wreck, 'sem flags dead/wreck');
  assert.equal(stepBattery(b, 1, { rng: rng.random, fighters: [fighter] }).length, 0,
    'bateria morta ainda atira');
  assert.equal(damageBattery(b, 999), false, 'morte não é idempotente');
  // o modo registra o emissor de fumaça do wreck (guard de fonte)
  assert.match(read('src/defense/defense-mode.js'), /addSmokeEmitter\(/);
});

test('T-D-08(g2): míssil aliado só acerta com willHit rolado no disparo', () => {
  const heightFlat = () => 0;
  const fighter = { x: 400, y: 250, z: 0, vx: 0, vy: 0, vz: 0, dead: false };
  const mk = (willHit) => ({
    x: 0, y: 2, z: 0, vx: 0, vy: 60, vz: 0,
    target: fighter, willHit, life: 8, smokeT: 0,
  });
  const hit = mk(true);
  let ev = null, steps = 0;
  while (!ev && steps++ < 3000) ev = stepAllyMissile(hit, 1 / 60, { heightAt: heightFlat });
  assert.ok(ev?.hit, 'willHit=true não convergiu no caça');
  const miss = mk(false);
  ev = null; steps = 0;
  while (!ev && steps++ < 3000) ev = stepAllyMissile(miss, 1 / 60, { heightAt: heightFlat });
  assert.ok(ev && !ev.hit, 'willHit=false acertou');
  assert.ok(C.ALLY_BATT_HIT_P >= 0.05 && C.ALLY_BATT_HIT_P <= 0.10,
    'chance de acerto fora da faixa 5-10%');
});

// ─── (g3) T-D-03: bateria da RETAGUARDA (release nuke-firestorm-defense-v1) ──

test('T-D-03(g3): bateria fixa no eixo-traseiro, prioridade no setor traseiro, eficácia alta', () => {
  const rng = createRng('d3:rear');
  const soldier = { x: C.SOLDIER_POS.x, z: C.SOLDIER_POS.z };
  const batteries = placeAlliedBatteries(rng.random, {
    heightAt, soldier, base: { x: -560, z: 320 },
  });
  const rear = batteries.find((b) => b.rearGuard);
  assert.ok(rear, 'bateria da retaguarda ausente');
  // Posição: exatamente REAR_BATT_DIST ao longo do eixo-traseiro (LOOK_AT→SOLDIER)
  const ax = rearAxis();
  const alen = Math.hypot(ax.x, ax.z);
  assert.ok(Math.abs(alen - 1) < 1e-9, 'eixo-traseiro não unitário');
  const wantX = soldier.x + ax.x * C.REAR_BATT_DIST;
  const wantZ = soldier.z + ax.z * C.REAR_BATT_DIST;
  assert.ok(Math.hypot(rear.x - wantX, rear.z - wantZ) < 1e-9,
    `posição (${rear.x.toFixed(1)},${rear.z.toFixed(1)}) != eixo-traseiro (${wantX.toFixed(1)},${wantZ.toFixed(1)})`);
  // O eixo-traseiro aponta para o lado OPOSTO da cidade
  const toCity = { x: C.LOOK_AT.x - soldier.x, z: C.LOOK_AT.z - soldier.z };
  assert.ok(ax.x * toCity.x + ax.z * toCity.z < 0, 'eixo-traseiro aponta para a cidade');

  // isRearThreat: setor traseiro (±60° do eixo) ou alvo = jogador
  const fRear = { x: soldier.x + ax.x * 500, y: 300, z: soldier.z + ax.z * 500, dead: false, target: { kind: 'city' } };
  const fFront = { x: soldier.x - ax.x * 500, y: 300, z: soldier.z - ax.z * 500, dead: false, target: { kind: 'city' } };
  const fPlayer = { x: soldier.x - ax.x * 500, y: 300, z: soldier.z - ax.z * 500, dead: false, target: { kind: 'player' } };
  assert.equal(isRearThreat(fRear), true, 'caça no setor traseiro não é ameaça');
  assert.equal(isRearThreat(fFront), false, 'caça frontal marcado como ameaça traseira');
  assert.equal(isRearThreat(fPlayer), true, 'caça anti-jogador deveria ser prioridade');

  // Prioridade: o caça traseiro (770 m) vence o frontal NÃO-ameaça mais perto (548 m)
  const fx = { x: C.LOOK_AT.x - soldier.x, z: C.LOOK_AT.z - soldier.z };
  const fl = Math.hypot(fx.x, fx.z);
  const nearFront = {
    x: soldier.x + (fx.x / fl) * 200, y: 320, z: soldier.z + (fx.z / fl) * 200,
    vx: 0, vy: 0, vz: 0, dead: false, target: { kind: 'city' },
  };
  const farRear = {
    x: soldier.x + ax.x * 1100, y: 320, z: soldier.z + ax.z * 1100,
    vx: 0, vy: 0, vz: 0, dead: false, target: { kind: 'city' },
  };
  assert.ok(isRearThreat(farRear) && !isRearThreat(nearFront), 'cenário de prioridade mal montado');
  const dFront = Math.hypot(nearFront.x - rear.x, nearFront.y - rear.y, nearFront.z - rear.z);
  const dRear = Math.hypot(farRear.x - rear.x, farRear.y - rear.y, farRear.z - rear.z);
  assert.ok(dFront < dRear && dRear < C.REAR_BATT_RANGE, 'cenário: distâncias não exercitam a prioridade');
  let missile = null;
  for (let i = 0; i < 600 && !missile; i++) {
    for (const e of stepBattery(rear, 1 / 60, { rng: rng.random, fighters: [nearFront, farRear] })) {
      if (e.type === 'missile') missile = e;
    }
  }
  assert.ok(missile, 'bateria da retaguarda não disparou míssil');
  assert.equal(missile.target, farRear, 'não priorizou o caça do setor traseiro');

  // Alcance longo: engaja caça traseiro a 850 m (bateria comum pararia em 620)
  const far850 = { x: rear.x + ax.x * 850, y: rear.y + 150, z: rear.z + ax.z * 850, vx: 0, vy: 0, vz: 0, dead: false, target: { kind: 'city' } };
  let engaged = false;
  for (let i = 0; i < 120 && !engaged; i++) {
    engaged = stepBattery(rear, 1 / 60, { rng: rng.random, fighters: [far850] }).length > 0;
  }
  assert.ok(engaged, 'retaguarda não engajou caça traseiro a 850 m');
  assert.ok(C.REAR_BATT_RANGE >= 900, 'alcance da retaguarda < 900 m');

  // Eficácia: hit chance ≥ 0.5, medida estatisticamente num lote seedado
  assert.ok(C.REAR_BATT_HIT_P >= 0.5, 'hit chance da retaguarda < 0.5');
  const rear2 = { ...rear, cool: 0, mslT: 0, dead: false };
  let hits = 0, shots = 0;
  for (let i = 0; i < 60000 && shots < 250; i++) {
    for (const e of stepBattery(rear2, 1 / 60, { rng: rng.random, fighters: [fRear] })) {
      if (e.type === 'missile') { shots += 1; if (e.willHit) hits += 1; }
    }
  }
  assert.ok(shots >= 150, `amostra de mísseis pequena demais (${shots})`);
  const share = hits / shots;
  assert.ok(share > 0.42 && share < 0.68, `taxa de acerto fora do esperado (${(share * 100).toFixed(1)}% em ${shots})`);
  // Bateria comum NÃO usa os parâmetros da retaguarda
  const plain = batteries.find((b) => !b.rearGuard);
  const outOfAllyRange = { x: plain.x + 700, y: plain.y + 150, z: plain.z, vx: 0, vy: 0, vz: 0, dead: false, target: { kind: 'city' } };
  assert.equal(stepBattery(plain, 1, { rng: rng.random, fighters: [outOfAllyRange] }).length, 0,
    'bateria comum engajou além de ALLY_BATT_RANGE');
});

// ─── (h) Clearance de terreno ────────────────────────────────────────────────

test('T-D-06(h): nunca abaixo de terreno+15 fora do mergulho (+6 no mergulho)', () => {
  const rng = createRng('d3:clearance');
  for (let i = 0; i < 15; i++) {
    const f = spawnFighter(rng.random, makeCtx(rng.random));
    const log = simFighter(f, makeCtx(rng.random));
    assert.deepEqual(log.violations, [],
      `violação de clearance: ${JSON.stringify(log.violations[0])}`);
  }
});

// ─── Guards de fonte: pureza, tamanho, modo sem drones ───────────────────────

test('T-D-06/07/08: módulos novos ≤250 linhas e lógica pura (sem DOM)', () => {
  for (const rel of ['src/defense/enemy-fighters.js', 'src/defense/enemy-ordnance.js',
    'src/defense/allied-batteries.js']) {
    const src = read(rel);
    assert.ok(src.split('\n').length <= 250, `${rel} com ${src.split('\n').length} linhas`);
    assert.ok(!src.includes('document.'), `${rel} tocou o DOM`);
  }
  assert.ok(!read('src/defense/enemy-ordnance.js').includes('three.module'),
    'enemy-ordnance.js deveria ser livre de Three.js');
  assert.ok(!read('src/defense/allied-batteries.js').includes('three.module'),
    'allied-batteries.js deveria ser livre de Three.js');
  // O modo substituiu os drones de debug pelos caças reais
  const mode = read('src/defense/defense-mode.js');
  assert.ok(!mode.includes('createDebugDrones'), 'defense-mode ainda spawna drones');
  assert.match(mode, /spawnFighter/);
  assert.match(mode, /spawnPropFire\(/, 'impacto na cidade não incendeia o prédio');
});
