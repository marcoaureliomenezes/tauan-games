// test-aero-defense-director.mjs — Validador Node da Onda D4 (T-D-09/T-D-10,
// release v0.3.5).
//
// Prova, sem browser (a lógica é PURA em src/defense/defense-director.js e no
// bloco 'dying' de src/defense/enemy-fighters.js):
//   (a) intervalo de spawn segue a curva 6s ×0.93^floor(kills/5) com piso 1.5s;
//   (b) esquadrilha cresce 1→4 nos degraus de kills;
//   (c) cap de vivos: excesso espera na fila e drena respeitando o cap;
//   (c2) T-D-02 (release nuke-firestorm-defense-v1): direções quantizadas em 4
//       setores de 90° relativos ao eixo SOLDIER→LOOK_AT + jitter, eventos
//       carregam dir+sector, sequência determinística por seed;
//   (d) derrota na cidade 0% E sem vidas (os dois caminhos) + restart reseta;
//   (e) queda: estilo por RNG, sempre termina no terreno (sem NaN/queda
//       eterna), sheds 2-4, ejeção só nos 20% seedados; impacto no modo dispara
//       megaExplosion+scorch (guard de fonte);
//   (f) determinismo: duas corridas seedadas produzem timelines idênticas de
//       spawn/abate/queda;
//   (g) caças caindo ficam fora do lock e da lista de alvos da .50.
//
// Roda com: node --experimental-default-type=module tests/aero-fighters/tools/test-aero-defense-director.mjs

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { createRng } from '../../../aero-fighters/src/rng.js';
import { AA_DEFENSE } from '../../../aero-fighters/src/config.js';
import {
  createDefenseDirector, spawnInterval, squadSize, stepDirector,
  registerKill, registerInterception, registerCityImpact, registerPlayerDown,
  resetDirector, directorTelemetry, frontAxis, pickSquadDirection,
} from '../../../aero-fighters/src/defense/defense-director.js';
import {
  FALL_STYLES, spawnFighter, startDying, stepDying,
} from '../../../aero-fighters/src/defense/enemy-fighters.js';
import { pickLockTarget } from '../../../aero-fighters/src/defense/turret-weapons.js';

const SRC = fileURLToPath(new URL('../../../aero-fighters/', import.meta.url));
const read = (rel) => readFileSync(SRC + rel, 'utf8');
const C = AA_DEFENSE;

// Terreno ondulado (10..70 m) — torna o teste de impacto significativo.
const heightAt = (x, z) => 40 + 30 * Math.sin(x * 0.01) * Math.cos(z * 0.012);

// ─── (a) Curva do intervalo de spawn ─────────────────────────────────────────

test('T-D-09(a): intervalo 6s ×0.93^floor(kills/5), piso 1.5s', () => {
  const d = createDefenseDirector('d4:interval');
  for (const kills of [0, 4, 5, 9, 10, 25, 60, 117]) {
    d.kills = kills;
    const want = Math.max(C.DIR_MIN_INTERVAL,
      C.DIR_BASE_INTERVAL * Math.pow(C.DIR_RATE, Math.floor(kills / C.DIR_KILLS_STEP)));
    assert.ok(Math.abs(spawnInterval(d) - want) < 1e-9,
      `kills=${kills}: ${spawnInterval(d)} != ${want}`);
  }
  d.kills = 0;
  assert.equal(spawnInterval(d), 6, 'base 6 s');
  d.kills = 5;
  assert.ok(Math.abs(spawnInterval(d) - 6 * 0.93) < 1e-9, 'primeiro degrau');
  d.kills = 10000;
  assert.equal(spawnInterval(d), C.DIR_MIN_INTERVAL, 'piso de 1.5 s');
});

// ─── (b) Degraus da esquadrilha 1→4 ──────────────────────────────────────────

test('T-D-09(b): esquadrilha 1→4 nos degraus DIR_SQUAD_KILLS', () => {
  const d = createDefenseDirector('d4:squad');
  const cases = [[0, 1], [11, 1], [12, 2], [29, 2], [30, 3], [59, 3], [60, 4], [500, 4]];
  for (const [kills, want] of cases) {
    d.kills = kills;
    assert.equal(squadSize(d), want, `kills=${kills}`);
  }
  assert.deepEqual(C.DIR_SQUAD_KILLS[0], 0, 'degrau inicial em 0 kills');
});

// ─── (c) Cap de vivos com fila ───────────────────────────────────────────────

test('T-D-09(c): cap de vivos — excesso espera na fila e drena no cap', () => {
  const d = createDefenseDirector('d4:cap');
  // No cap: nenhum spawn sai, a fila cresce a cada intervalo
  let queued = 0;
  for (let t = 0; t < 30; t += 0.1) {
    for (const e of stepDirector(d, 0.1, C.DIR_MAX_ALIVE)) queued += e.count;
    assert.equal(queued, 0, 'spawnou estando no cap');
  }
  assert.ok(d.pending.length >= 3, `fila deveria acumular (${d.pending.length})`);
  const totalQueued = d.pending.reduce((s, b) => s + b.count, 0);
  // Drena com 3 vagas: respeita o cap exatamente
  let spawned = 0;
  for (const e of stepDirector(d, 0.1, C.DIR_MAX_ALIVE - 3)) spawned += e.count;
  assert.equal(spawned, 3, 'drenou além das vagas');
  // Drena o resto com o céu vazio
  spawned = 0;
  for (const e of stepDirector(d, 0.1, 0)) spawned += e.count;
  assert.ok(spawned <= C.DIR_MAX_ALIVE, 'drenou além do cap');
  assert.ok(spawned + 3 <= totalQueued + 1, 'spawnou mais do que a fila tinha');
  // Direção de bússola seedada por esquadrilha
  const d2 = createDefenseDirector('d4:cap2');
  let ev = null;
  for (let t = 0; t < 10 && !ev; t += 0.1) {
    const evs = stepDirector(d2, 0.1, 0);
    if (evs.length) ev = evs[0];
  }
  assert.ok(ev && ev.type === 'spawn' && Number.isFinite(ev.dir), 'direção de bússola inválida');
});

// ─── (c2) T-D-02: 4 frentes quantizadas (release nuke-firestorm-defense-v1) ──

test('T-D-02(c2): direções quantizadas em 4 setores de 90° relativos ao eixo SOLDIER→LOOK_AT', () => {
  // Eixo-frente deriva das constantes (não é hardcoded)
  const want = Math.atan2(C.LOOK_AT.z - C.SOLDIER_POS.z, C.LOOK_AT.x - C.SOLDIER_POS.x);
  assert.ok(Math.abs(frontAxis() - want) < 1e-12, 'frontAxis != eixo SOLDIER→LOOK_AT');
  assert.equal(C.DIR_SECTORS, 4, 'setores != 4');
  assert.ok(C.DIR_SECTOR_JITTER < Math.PI / 4, 'jitter invadiria o setor vizinho');
  // Amostra direta: setor ∈ [0,3] e dir dentro de centro ± jitter
  const rng = createRng('d4:sectors');
  const seen = new Set();
  for (let i = 0; i < 200; i++) {
    const { dir, sector } = pickSquadDirection(rng.random);
    assert.ok(Number.isInteger(sector) && sector >= 0 && sector < 4, `setor inválido ${sector}`);
    const center = frontAxis() + sector * (Math.PI / 2);
    assert.ok(Math.abs(dir - center) <= C.DIR_SECTOR_JITTER + 1e-9,
      `dir fora do setor ${sector}: |${dir} - ${center}| > jitter`);
    seen.add(sector);
  }
  assert.equal(seen.size, 4, `nem todos os 4 setores apareceram: ${[...seen]}`);
  // Eventos do diretor carregam dir + sector coerentes
  const d = createDefenseDirector('d4:sectors2');
  const seenEv = new Set();
  for (let t = 0; t < 60; t += 0.1) {
    for (const e of stepDirector(d, 0.1, 0)) {
      assert.ok(Number.isInteger(e.sector) && e.sector >= 0 && e.sector < 4, 'evento sem setor válido');
      const center = frontAxis() + e.sector * (Math.PI / 2);
      assert.ok(Math.abs(e.dir - center) <= C.DIR_SECTOR_JITTER + 1e-9, 'evento com dir fora do setor');
      seenEv.add(e.sector);
    }
  }
  assert.ok(seenEv.size >= 3, `poucos setores em 60 s de diretor: ${[...seenEv]}`);
  // Determinismo: mesma seed → mesma sequência de setores
  const seq = (seed) => {
    const dd = createDefenseDirector(seed);
    const out = [];
    for (let t = 0; t < 30 && out.length < 5; t += 0.1) {
      for (const e of stepDirector(dd, 0.1, 0)) out.push([e.sector, Number(e.dir.toFixed(6))]);
    }
    return out;
  };
  assert.deepEqual(seq('d4:sectors3'), seq('d4:sectors3'), 'sequência de setores não determinística');
});

// ─── (d) Derrotas + restart ──────────────────────────────────────────────────

test('T-D-09(d1): cidade a 0% = derrota city (~20 impactos); restart reseta', () => {
  const d = createDefenseDirector('d4:defeat-city');
  const impacts = Math.ceil(100 / C.CITY_DAMAGE);
  assert.ok(impacts >= 18 && impacts <= 22, `~20 impactos (${impacts})`);
  let last = null;
  for (let i = 0; i < impacts - 1; i++) {
    last = registerCityImpact(d);
    assert.equal(last.defeated, null, `derrotou cedo demais (${i + 1} impactos)`);
  }
  last = registerCityImpact(d);
  assert.equal(last.integrity, 0);
  assert.equal(last.defeated, 'city');
  assert.equal(d.defeated, 'city');
  // Spawn congela após a derrota
  assert.deepEqual(stepDirector(d, 60, 0), [], 'diretor spawnou após a derrota');
  resetDirector(d);
  assert.equal(d.cityIntegrity, 100);
  assert.equal(d.defeated, null);
  assert.equal(d.kills, 0);
  assert.equal(d.score, 0);
  assert.equal(d.pending.length, 0);
  assert.ok(stepDirector(d, C.DIR_FIRST_DELAY + 0.1, 0).length > 0, 'não voltou a spawnar');
});

test('T-D-09(d2): sem vidas = derrota battery; restart reseta', () => {
  const d = createDefenseDirector('d4:defeat-battery');
  assert.equal(registerPlayerDown(d), 'battery');
  assert.equal(d.defeated, 'battery');
  // Cidade não zera por acidente e a primeira derrota vence
  registerCityImpact(d);
  assert.equal(d.defeated, 'battery');
  resetDirector(d);
  assert.equal(d.defeated, null);
  assert.equal(d.cityIntegrity, 100);
});

// ─── Score/kills consolidados ────────────────────────────────────────────────

test('T-D-09: kill = KILL_SCORE qualquer fonte; streak a cada STREAK_EVERY; interceptação = bônus', () => {
  const d = createDefenseDirector('d4:score');
  for (const src of ['mg', 'aa', 'ally']) {
    assert.equal(registerKill(d, src), null, 'streak antes da hora');
  }
  assert.equal(d.kills, 3);
  assert.equal(d.score, 3 * C.KILL_SCORE);
  registerInterception(d);
  assert.equal(d.score, 3 * C.KILL_SCORE + C.INTERCEPT_BONUS, 'bônus de interceptação');
  let st = null;
  while (d.kills < C.STREAK_EVERY) st = registerKill(d, 'mg') || st;
  assert.ok(st && st.streak === C.STREAK_EVERY, `streak errado: ${JSON.stringify(st)}`);
  const tm = directorTelemetry(d, 4);
  assert.equal(tm.alive, 4);
  assert.equal(tm.kills, d.kills);
  assert.equal(tm.score, d.score);
  assert.equal(tm.cityIntegrity, 100);
  assert.ok(tm.spawnInterval > 0 && tm.squadSize >= 1);
});

// ─── (e) Queda cinematográfica ───────────────────────────────────────────────

function makeFighter(rng) {
  return spawnFighter(rng, {
    center: { x: -250, z: 250 },
    heightAt,
    targetSets: {
      city: [{ x: 0, z: 0, topY: 50 }],
      base: [{ x: -320, z: 310, y: 42 }],
      battery: [{ x: -700, z: -360, y: 45, dead: false }],
      player: { x: -760, y: 100, z: -400 },
    },
  });
}

test('T-D-10(e): queda — estilo por RNG, termina no terreno, sheds 2-4, sem NaN', () => {
  const rng = createRng('d4:fall');
  const seen = new Set();
  for (let i = 0; i < 30; i++) {
    const f = makeFighter(rng.random);
    const style = startDying(f, rng.random);
    assert.ok(FALL_STYLES.includes(style), `estilo inválido ${style}`);
    seen.add(style);
    assert.equal(f.state, 'dying');
    assert.equal(f.dead, true);
    const sheds = [];
    let impact = null;
    let t = 0;
    while (!impact && t < 60) {
      for (const e of stepDying(f, 0.05, { heightAt, rng: rng.random })) {
        if (e.type === 'shed') sheds.push(e);
        else if (e.type === 'impact') impact = e;
      }
      assert.ok(Number.isFinite(f.x) && Number.isFinite(f.y) && Number.isFinite(f.z),
        `NaN na queda (${style}, t=${t.toFixed(1)})`);
      t += 0.05;
    }
    assert.ok(impact, `queda eterna (${style})`);
    assert.ok(t >= 1.0 && t <= 25, `duração fora da faixa (${style}: ${t.toFixed(1)} s)`);
    assert.ok(Math.abs(impact.y - heightAt(impact.x, impact.z)) < 1e-6,
      'impacto fora da superfície');
    assert.ok(sheds.length >= C.FALL_DEBRIS[0] - 1 && sheds.length <= C.FALL_DEBRIS[1],
      `sheds fora de 2-4 (${sheds.length})`);
  }
  assert.equal(seen.size, 3, `estilos não variaram: ${[...seen]}`);
});

test('T-D-10(e2): ejeção só nos ~20% seedados', () => {
  const rng = createRng('d4:eject');
  let ejects = 0;
  const N = 600;
  for (let i = 0; i < N; i++) {
    const f = makeFighter(rng.random);
    startDying(f, rng.random);
    if (f.eject) ejects += 1;
  }
  const share = ejects / N;
  assert.ok(share > 0.13 && share < 0.27, `ejeção fora dos 20% (${(share * 100).toFixed(1)}%)`);
  assert.equal(C.FALL_EJECT_P, 0.2);
});

test('T-D-10(e3): impacto no modo dispara megaExplosion + shockwave + scorch + coluna', () => {
  const mode = read('src/defense/defense-mode.js');
  assert.match(mode, /megaExplosion\(/, 'sem megaExplosion no impacto');
  assert.match(mode, /spawnShockwave\(/, 'sem shockwave no impacto');
  assert.match(mode, /spawnScorchMark\(/, 'sem scorch no impacto');
  assert.match(mode, /spawnSmokeColumn\(/, 'sem coluna de fumaça no impacto');
  assert.match(mode, /spawnFallTrail\(/, 'sem trilha densa durante a queda');
  assert.match(mode, /spawnShedDebris\(/, 'sem sheds de debris');
  // Pool PRÓPRIO da queda em fx.js (não rouba o das explosões)
  const fx = read('src/fx.js');
  assert.match(fx, /fallSmokePool/, 'sem pool próprio de fumaça da queda');
  assert.ok(mode.includes('INHAÚMA CAIU'), 'sem overlay de derrota da cidade');
  assert.ok(mode.includes('BATERIA DESTRUÍDA'), 'sem overlay de derrota da bateria');
});

// ─── (f) Determinismo ────────────────────────────────────────────────────────

test('T-D-09/10(f): duas corridas seedadas = timelines idênticas de spawn/kill/queda', () => {
  function runTimeline() {
    const d = createDefenseDirector('d4:determ');
    const rng = createRng('d4:determ:fighters');
    const log = [];
    let alive = 0;
    for (let t = 0; t < 40; t += 0.1) {
      for (const e of stepDirector(d, 0.1, alive)) {
        alive += e.count;
        log.push([Math.round(t * 10), e.count, Number(e.dir.toFixed(6))]);
      }
      if (alive > 0 && log.length % 3 === 0) { // abate periódico determinístico
        registerKill(d, 'mg');
        alive -= 1;
      }
    }
    const f = makeFighter(rng.random);
    startDying(f, rng.random);
    const fall = [];
    let impact = null, t = 0;
    while (!impact && t < 60) {
      for (const e of stepDying(f, 0.1, { heightAt, rng: rng.random })) {
        if (e.type === 'impact') impact = e;
      }
      fall.push([Number(f.x.toFixed(4)), Number(f.y.toFixed(4)), Number(f.z.toFixed(4))]);
      t += 0.1;
    }
    return { log, fall, style: f.fallStyle, eject: f.eject, kills: d.kills };
  }
  const a = runTimeline();
  const b = runTimeline();
  assert.deepEqual(a, b, 'timelines divergiram');
  assert.ok(a.log.length >= 5, 'timeline de spawn curta demais');
  assert.ok(a.fall.length > 10, 'queda curta demais');
});

// ─── (g) Caindo = fora do lock e dos alvos da .50 ────────────────────────────

test('T-D-10(g): caça em queda não é travável nem alvo da .50', () => {
  const rng = createRng('d4:lockout');
  const alive = makeFighter(rng.random);
  const dying = makeFighter(rng.random);
  startDying(dying, rng.random);
  const eye = { x: alive.x, y: alive.y, z: alive.z + 500 };
  const fwd = { x: 0, y: 0, z: -1 };
  // O caça morto está EXATAMENTE na mira; o vivo atrás — o lock pula o morto
  alive.x = eye.x; alive.y = eye.y; alive.z = eye.z - 300;
  dying.x = eye.x; dying.y = eye.y; dying.z = eye.z - 100;
  const targets = [dying, alive];
  assert.equal(pickLockTarget(eye, fwd, targets, 0.5), 1, 'lock travou no caça caindo');
  // Padrão da lista de alvos da .50 no modo: filtra !dead
  const mgTargets = targets.filter((t) => !t.dead);
  assert.deepEqual(mgTargets, [alive]);
  // Guard de fonte: o modo filtra mortos da lista da .50 e do cone de lock
  const mode = read('src/defense/defense-mode.js');
  assert.match(mode, /if \(!ft\.dead\) mgTargets\.push/, '.50 inclui caça caindo');
});
