// test-corrida-unit.mjs (T-03) — primeira suíte Node do Cruis'n Tauan. Dados
// PUROS (catálogo de pistas/carros, superfícies, geometria de spline) —
// zero DOM/WebGL. Corrida hoje tem 0 suítes Node no CI (map de rebaixamento
// 2026-08-12T160030Z, §4): este arquivo cobre os testes classificados DN de
// smoke:16 (catálogo) e parte de smoke:26 (2 dos 3 boots de pista viram
// sampleTrack finito aqui — o boot restante fica no smoke.spec.js) e a
// sprint:44 (metadados A→B, mantida como sentinela E2E, mas a fórmula do
// finishS/trackLen também é travada aqui em Node).
//
// Importabilidade (map §4, "corrida: physics, tracks, cars, ai, idea-model,
// signage — zero refs a document/window, importáveis HOJE"): tracks.js e
// world.js#sampleTrack são 100% puros (world.js só toca `document` DENTRO de
// signTexture(), nunca em buildSigns/sampleTrack); cars.js importa THREE +
// GLTFLoader no topo mas não executa nada DOM-dependente até loadModel() ser
// chamado — o array CARS é dado estático, seguro de ler aqui.
import test from 'node:test';
import assert from 'node:assert/strict';

import { TRACKS, SURFACES } from '../../../speed-run/src/tracks.js';
import { CARS } from '../../../speed-run/src/cars.js';
import { sampleTrack } from '../../../speed-run/src/world.js';

test('TRACKS: 4 pistas, incluindo a sprint "Serra do Tauan" (open) como índice 3', () => {
  assert.equal(TRACKS.length, 4);
  assert.equal(TRACKS[3].key, 'serra');
  assert.equal(TRACKS[3].open, true);
});

test('CARS: 5 carros no catálogo, incluindo o Idea Adventure', () => {
  assert.equal(CARS.length, 5);
  assert.ok(
    CARS.some((c) => c.name.includes('Idea Adventure')),
    'esperava um carro com "Idea Adventure" no nome',
  );
});

test('SURFACES: ordenação de grip asfalto > terra > fora-da-pista', () => {
  assert.ok(SURFACES.asphalt.grip > SURFACES.dirt.grip);
  assert.ok(SURFACES.dirt.grip > SURFACES.offroad.grip);
  assert.ok(SURFACES.dirt.rumble > 0);
});

// smoke:26 rebaixava 2 dos 3 boots de circuito (Floresta Temperada, Deserto
// do Arizona) — a pista sobrevive à construção real (Centro Urbano fica como
// o único boot de browser restante em smoke.spec.js). "constrói sem erro" em
// Node = sampleTrack não lança e produz amostras finitas com comprimento > 0.
for (const key of ['forest', 'arizona']) {
  test(`sampleTrack(${key}): amostras finitas e comprimento > 0 (demovido de smoke:26)`, () => {
    const def = TRACKS.find((t) => t.key === key);
    assert.ok(def, `pista ${key} não encontrada em TRACKS`);
    const track = sampleTrack(def);
    assert.equal(track.samples.length, 900);
    assert.ok(track.len > 0);
    for (const s of track.samples) {
      assert.ok(Number.isFinite(s.pos.x) && Number.isFinite(s.pos.y) && Number.isFinite(s.pos.z),
        `amostra não-finita em ${key}`);
      assert.ok(['asphalt', 'dirt', 'offroad', 'water'].includes(s.surface));
    }
  });
}

// sprint:44 metadados (trackLen/finishS) — mantidos como asserção E2E
// sentinela, mas a FÓRMULA em si (mesma conta de world.js#buildWorld,
// linhas do cômputo de trackLen por soma de distâncias consecutivas) é pura
// e travada aqui: nenhuma dependência de DOM para calcular.
test('sprint (serra): trackLen > 1750 e finishS = (trackLen-30)/trackLen', () => {
  const def = TRACKS[3];
  const track = sampleTrack(def);
  // mesma soma de distâncias consecutivas que world.js#buildWorld usa p/
  // expor `trackLen` (abertura: last índice = N-1, sem wrap).
  let trackLen = 0;
  const N = track.samples.length;
  const lastI = track.open ? N - 1 : N;
  for (let i = 0; i < lastI; i++) {
    trackLen += track.samples[i].pos.distanceTo(track.samples[(i + 1) % N].pos);
  }
  assert.ok(trackLen > 1750, `trackLen=${trackLen} esperado > 1750`);
  const finishS = def.sprint ? (trackLen - 30) / trackLen : null;
  assert.ok(finishS !== null);
  assert.equal(finishS, (trackLen - 30) / trackLen);
  assert.ok(finishS > 0.9 && finishS < 1, `finishS=${finishS} fora da faixa plausível`);
});
