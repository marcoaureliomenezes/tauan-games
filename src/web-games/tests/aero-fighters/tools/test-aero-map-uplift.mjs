// test-aero-map-uplift.mjs — Validador Node do uplift de mapa 2026-08-11:
//   (a) REPRESA reconstruída sobre o canal REAL: sítio na polilinha do rio,
//       ≥260 m de qualquer ponte, ≥320 m da usina, dentro do foco jogável;
//       muro + torres registrados como estruturas (inhaumaStructureInfoAt);
//   (b) FÁBRICAS anelando a usina: ≥2 zonas novas a ≤260 m do marco da usina,
//       todas fora da faixa do rio e fora do leito de estradas;
//   (c) distância Cachoeira→Inhaúma ≥ 2.850 m (+50% sobre os 1.931 m antigos).
//
// Roda com: node --experimental-default-type=module tests/aero-fighters/tools/test-aero-map-uplift.mjs

import test from 'node:test';
import assert from 'node:assert/strict';

import { loadInhaumaDem } from '../../../aero-fighters/src/maps/heightmap-sampler.js';
import {
  buildDam, buildFactories, inhaumaStructureInfoAt,
  CACHOEIRA_TOWN_CENTER, TOWN_SHELF,
} from '../../../aero-fighters/src/maps/inhauma-scene.js';
import { getInhaumaRiverPolyline, distanceToRiver } from '../../../aero-fighters/src/maps/inhauma-river.js';
import { computeInhaumaBridgeCrossings } from '../../../aero-fighters/src/maps/inhauma-bridges.js';
import { nearAnyRoad } from '../../../aero-fighters/src/maps/inhauma-roads.js';

await loadInhaumaDem();

const fakeScene = () => ({ add() {}, remove() {} });
const NUKE_PLANT = { x: 620, z: 640 };

test('(a) represa: sítio no canal real, longe de pontes e da usina, estruturas registradas', () => {
  const dam = buildDam(fakeScene());
  assert.ok(dam && dam.site, 'buildDam não encontrou sítio no rio');
  const { x, z } = dam.site;
  assert.ok(Math.abs(x) <= 2400 && Math.abs(z) <= 2400, 'sítio fora do foco jogável');
  // O sítio é UM PONTO da polilinha do rio (escolhido, não interpolado).
  const onPoly = getInhaumaRiverPolyline().some((p) => Math.hypot(p.x - x, p.z - z) < 1);
  assert.ok(onPoly, 'sítio não pertence à polilinha do rio');
  for (const c of computeInhaumaBridgeCrossings()) {
    assert.ok(Math.hypot(x - c.midX, z - c.midZ) >= 260, `represa a <260 m da ponte (${c.midX},${c.midZ})`);
  }
  assert.ok(Math.hypot(x - NUKE_PLANT.x, z - NUKE_PLANT.z) >= 320, 'represa em cima da usina');
  assert.ok(dam.crestY > dam.waterY, 'crista abaixo da lâmina do reservatório');
  const hit = inhaumaStructureInfoAt(x, z);
  assert.ok(hit, 'muro da represa não registrado como estrutura');
});

test('(b) fábricas anelam a usina: ≥2 zonas novas perto, todas fora de rio/estrada', () => {
  const { smoke } = buildFactories(fakeScene());
  assert.ok(smoke.length >= 12, `esperado ≥12 chaminés (≥4 zonas × 3), veio ${smoke.length}`);
  // Chaminés agrupam por zona (3 por zona, mesmo z, x±14): reconta as zonas.
  const zones = new Set(smoke.map((s) => `${Math.round((s.x + 7) / 50)}:${Math.round(s.z / 50)}`));
  const nearPlant = [...smoke].filter((s) => Math.hypot(s.x - NUKE_PLANT.x, s.z - NUKE_PLANT.z) <= 300);
  assert.ok(nearPlant.length >= 6, `esperado ≥2 zonas novas (6 chaminés) a ≤300 m da usina, veio ${nearPlant.length}`);
  for (const s of smoke) {
    assert.ok(distanceToRiver(s.x, s.z) > 40, `chaminé (${s.x},${s.z}) na faixa do rio`);
    assert.ok(!nearAnyRoad(s.x, s.z, 8), `chaminé (${s.x},${s.z}) sobre o leito de estrada`);
  }
  assert.ok(zones.size >= 4, `esperado ≥4 zonas industriais, veio ${zones.size}`);
});

test('(c) Cachoeira→Inhaúma ≥ 2.850 m (distância +50%)', () => {
  const inhauma = {
    x: (TOWN_SHELF.minX + TOWN_SHELF.maxX) / 2,
    z: (TOWN_SHELF.minZ + TOWN_SHELF.maxZ) / 2,
  };
  const d = Math.hypot(CACHOEIRA_TOWN_CENTER.x - inhauma.x, CACHOEIRA_TOWN_CENTER.z - inhauma.z);
  assert.ok(d >= 2850, `distância ${d.toFixed(0)} m < 2850 m (contrato +50% sobre 1931 m)`);
});
