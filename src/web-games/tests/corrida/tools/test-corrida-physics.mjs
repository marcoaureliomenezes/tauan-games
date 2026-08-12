// test-corrida-physics.mjs (T-03) — leis PURAS de physics.js#stepCar
// exercitadas por um laço Node de verdade (sem browser/DOM), amostrando a
// pista real via world.js#sampleTrack. Cobre 3 leis hoje só provadas por
// input real de teclado/E2E (map de rebaixamento 2026-08-12T160030Z, §4):
//
//   1. crista de lombada ⇒ decolagem (input.spec.js:112, DEMOVIDO — deletado
//      de input.spec.js: a mecânica em si já era testada por 90s de teclado
//      real guiando o carro; a lei (climbV < -9 && v>18 ⇒ airborne=true,
//      com pouso subsequente) é 100% de physics.js/world.js, sem UI);
//   2. spike strip / pneu furado (physics.js:57-61, punctureT) — parcial
//      substituição de sprint:120: a lei de decaimento de grip/velocidade é
//      pura e coberta aqui; sprint:120 permanece (SLIM) só com o dano fixo
//      de 12 e a mensagem "PNEU FURADO", que dependem do objeto G.chase
//      (main.js) — não importável em Node hoje;
//   3. nitro: dv de aceleração > 1,35× o dv sem nitro (nitro.spec.js:74,
//      DEMOVIDO — a lei mecânica é `stepCar` com `input.nitro`; a máquina de
//      carga/regen continua em main.js, fora de escopo desta suíte).
//
// Harness de mundo: world.js#buildWorld não é importável puro (buildSigns
// chama signTexture()→document.createElement — DOM só ATRÁS dessa chamada,
// nunca em sampleTrack). `surfaceAt` é um closure interno de buildWorld, não
// exportado separadamente — por isso este arquivo traz um harness LOCAL,
// mínimo, que reimplementa a MESMA projeção (mais próximo + interpolação
// linear no segmento vizinho) sem a rejeição de "perna errada" via maxDS
// (desnecessária aqui: as pistas usadas — city/serra — são percorridas em
// linha reta curta perto da crista/largada, sem ambiguidade de hairpin).
import test from 'node:test';
import assert from 'node:assert/strict';

import { TRACKS, SURFACES } from '../../../speed-run/src/tracks.js';
import { CARS } from '../../../speed-run/src/cars.js';
import { sampleTrack } from '../../../speed-run/src/world.js';
import { makeCarState, stepCar } from '../../../speed-run/src/physics.js';

const DT = 1 / 60;

function makeTestWorld(def) {
  const track = sampleTrack(def);
  const S = track.samples, N = S.length, M = track.M, open = track.open;
  let trackLen = 0;
  const lastI = open ? N - 1 : N;
  for (let i = 0; i < lastI; i++) trackLen += S[i].pos.distanceTo(S[(i + 1) % N].pos);
  const clampI = (i) => (open ? Math.max(0, Math.min(N - 1, i)) : ((i % N) + N) % N);
  function surfaceAt(x, z) {
    let best = 0, bd = Infinity;
    for (let i = 0; i < N; i++) {
      const dx = S[i].pos.x - x, dz = S[i].pos.z - z;
      const d = dx * dx + dz * dz;
      if (d < bd) { bd = d; best = i; }
    }
    const sm = S[best];
    const nxt = S[clampI(best + 1)], prv = S[clampI(best - 1)];
    let a = sm, b = nxt, i0 = best;
    let abx = b.pos.x - a.pos.x, abz = b.pos.z - a.pos.z;
    let t = ((x - a.pos.x) * abx + (z - a.pos.z) * abz) / Math.max(abx * abx + abz * abz, 1e-9);
    if (t < 0) {
      a = prv; b = sm; i0 = clampI(best - 1);
      const ax = b.pos.x - a.pos.x, az = b.pos.z - a.pos.z;
      t = ((x - a.pos.x) * ax + (z - a.pos.z) * az) / Math.max(ax * ax + az * az, 1e-9);
    }
    t = Math.max(0, Math.min(1, t));
    const cx = a.pos.x + (b.pos.x - a.pos.x) * t;
    const cz = a.pos.z + (b.pos.z - a.pos.z) * t;
    const roadY = a.pos.y + (b.pos.y - a.pos.y) * t;
    const dist = Math.hypot(x - cx, z - cz);
    const surfBase = t < 0.5 ? a.surface : b.surface;
    const w = t < 0.5 ? a.width : b.width;
    const surface = dist > w / 2 + 0.4 ? 'offroad' : surfBase;
    return {
      sm, dist, surface, phys: SURFACES[surface], s: (i0 + t) / M, roadY, cx, cz,
      rejected: false, w, fenceless: a.fenceless || b.fenceless,
    };
  }
  return { def, track, trackLen, surfaceAt };
}

function assertFiniteState(st, label) {
  assert.ok(Number.isFinite(st.pos.x) && Number.isFinite(st.pos.y) && Number.isFinite(st.pos.z),
    `${label}: posição não-finita`);
  assert.ok(Number.isFinite(st.v) && Number.isFinite(st.heading), `${label}: v/heading não-finito`);
}

test('crista de lombada (Serra do Tauan) ⇒ decolagem + pouso (substitui input.spec.js:112)', () => {
  const def = TRACKS.find((t) => t.key === 'serra');
  const track = sampleTrack(def);
  const world = makeTestWorld(def);
  const iBump = Math.round(def.bumps[0] * track.M);            // 1ª crista (s=0.34)
  const startI = Math.max(0, iBump - 60);                      // ~130 m antes, reta (bumps só em retas)
  const sm0 = track.samples[startI];
  const heading0 = Math.atan2(-sm0.tan.x, -sm0.tan.z);
  const car = CARS.find((c) => c.key === 'exotic');            // Velocità GT (topSpeed 76)
  const st = makeCarState(car, sm0.pos.clone(), heading0);
  st.v = 50;                                                    // > ~42 u/s exigido p/ decolar

  let wasAirborne = false, landedAfterFlight = false;
  for (let i = 0; i < 300; i++) {
    stepCar(st, { throttle: 1, brake: 0, steer: 0 }, world, DT);
    assertFiniteState(st, `passo ${i}`);
    if (st.airborne) wasAirborne = true;
    if (wasAirborne && !st.airborne) landedAfterFlight = true;
  }
  assert.equal(wasAirborne, true, 'a crista deveria ter lançado o carro (airborne=true)');
  assert.equal(landedAfterFlight, true, 'o carro deveria pousar de volta (airborne=false) após o voo');
});

test('spike strip: punctureT decai velocidade e reduz grip (parcial de sprint.spec.js:120)', () => {
  const def = TRACKS.find((t) => t.key === 'city');
  const track = sampleTrack(def);
  const world = makeTestWorld(def);
  const car = CARS.find((c) => c.key === 'exotic');
  const sm0 = track.samples[0];
  const heading0 = Math.atan2(-sm0.tan.x, -sm0.tan.z);

  const fresh = (punctureT) => {
    const st = makeCarState(car, sm0.pos.clone(), heading0);
    st.v = 30;
    st.punctureT = punctureT;
    return st;
  };
  const stHealthy = fresh(0);
  const stPunctured = fresh(2);                                 // WS-5: 2 s de pneu furado
  const input = { throttle: 0, brake: 0, steer: 1 };             // curva constante, sem acelerar
  for (let i = 0; i < 10; i++) {
    stepCar(stHealthy, input, world, DT);
    stepCar(stPunctured, input, world, DT);
  }
  assertFiniteState(stHealthy, 'saudável');
  assertFiniteState(stPunctured, 'furado');
  // decaimento de velocidade: physics.js:60 (`st.v *= max(0, 1-0.9*dt)`) só se
  // aplica com punctureT>0 — o carro furado freia mais rápido que o normal.
  assert.ok(stPunctured.v < stHealthy.v,
    `punctureT deveria reduzir v mais rápido: furado=${stPunctured.v} saudável=${stHealthy.v}`);
  // decaimento de grip: physics.js:59 (`grip *= 0.55`) — a deriva lateral
  // (st.lat, proporcional a 1-grip) fica MAIOR com o pneu furado, mesmo
  // esterço/velocidade de partida idênticos.
  assert.ok(Math.abs(stPunctured.lat) > Math.abs(stHealthy.lat),
    `punctureT deveria aumentar a deriva lateral: furado=${stPunctured.lat} saudável=${stHealthy.lat}`);
  // punctureT tica para baixo a cada passo em que está ativo.
  assert.ok(stPunctured.punctureT < 2 && stPunctured.punctureT > 2 - 10 * DT - 1e-6);
});

test('nitro: boost de aceleração dvNitro > 1,35×dvBase (demove nitro.spec.js:74)', () => {
  const def = TRACKS.find((t) => t.key === 'city');
  const track = sampleTrack(def);
  const world = makeTestWorld(def);
  const car = CARS.find((c) => c.key === 'idea');
  const sm0 = track.samples[0];
  const heading0 = Math.atan2(-sm0.tan.x, -sm0.tan.z);
  const v0 = 15;

  const run = (nitro) => {
    const st = makeCarState(car, sm0.pos.clone(), heading0);
    st.v = v0;
    for (let i = 0; i < 60; i++) {                                // 1,0 s de sim (dt fixo)
      stepCar(st, { throttle: 1, brake: 0, steer: 0, nitro: nitro ? 1 : 0 }, world, DT);
    }
    assertFiniteState(st, nitro ? 'nitro' : 'base');
    return st.v - v0;
  };
  const dvBase = run(false);
  const dvNitro = run(true);
  assert.ok(dvBase > 0, `dvBase deveria ser positivo (acelerando): ${dvBase}`);
  assert.ok(dvNitro > 1.35 * dvBase,
    `dvNitro (${dvNitro}) deveria ser > 1,35×dvBase (${1.35 * dvBase})`);
});
