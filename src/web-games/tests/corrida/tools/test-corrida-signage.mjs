// test-corrida-signage.mjs (T-03) — sinalização WS-6 (signage.js) é "dados
// puros — testável sem render" (comentário do próprio arquivo, linha 64).
// Cobre, para as 4 pistas, o que era o laço ws6-signs.spec.js:22-45 (DELETADO
// dali — map de rebaixamento 2026-08-12T160030Z, §4): contagem de placas por
// tipo (lombada/vado/tábuas de distância), presença de chevron, e clearance
// mínimo ≥ 0,5 m fora do corredor dirigível. `ws6-signs.spec.js` mantém só o
// teste de sol/flare (linha 47 — sprite THREE seguindo a câmera, browser-
// intrínseco).
//
// measureClearance foi EXTRAÍDO (T-03, refactor puro) de dentro do laço de
// buildSignsWS6 em signage.js — antes o cômputo só existia inline após a
// construção da malha (que exige `document` via textures.js#roadSignAtlas).
// Com a extração, a MESMA fórmula roda aqui direto sobre planSigns(), sem
// THREE.Mesh nem canvas.
import test from 'node:test';
import assert from 'node:assert/strict';

import { TRACKS } from '../../../speed-run/src/tracks.js';
import { sampleTrack } from '../../../speed-run/src/world.js';
import { planSigns, measureClearance } from '../../../speed-run/src/signage.js';

// [key, lombadas esperadas, vados esperados, tábuas de distância esperadas]
// (mesma tabela de ws6-signs.spec.js:22-27, pré-remoção)
const EXPECTED = [
  ['city', 3, 0, 3],
  ['forest', 3, 0, 3],
  ['arizona', 5, 0, 3],
  ['serra', 3, 2, 0],          // sprint: sem tábuas de distância (track.open)
];

for (const [key, nLom, nVado, nDist] of EXPECTED) {
  test(`${key}: placas por dados completas e fora do corredor (≥0,5 m)`, () => {
    const def = TRACKS.find((t) => t.key === key);
    assert.ok(def, `pista ${key} não encontrada`);
    const track = sampleTrack(def);
    const planned = planSigns(def, track);
    assert.ok(planned.length > 0, `${key}: planSigns não gerou nenhuma placa`);

    const by = {};
    for (const sg of planned) by[sg.kind] = (by[sg.kind] || 0) + 1;
    assert.equal(by.lombada ?? 0, nLom, `${key}: contagem de lombada`);
    assert.equal(by.vado ?? 0, nVado, `${key}: contagem de vado`);
    assert.equal(by.dist ?? 0, nDist, `${key}: contagem de tábuas de distância`);
    assert.ok((by.chevron ?? 0) > 0, `${key}: toda pista deveria ter ao menos 1 chevron`);

    let minClear = Infinity;
    for (const sg of planned) {
      const sm = track.samples[sg.i];
      const clear = measureClearance(track, sm, sg);
      assert.ok(Number.isFinite(clear), `${key}: clearance não-finito para ${sg.kind}@${sg.i}`);
      if (clear < minClear) minClear = clear;
    }
    assert.ok(minClear >= 0.5, `${key}: clearance mínimo ${minClear} abaixo do corredor exigido (0,5 m)`);
  });
}
