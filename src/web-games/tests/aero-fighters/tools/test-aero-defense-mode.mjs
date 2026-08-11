// test-aero-defense-mode.mjs — Validador Node da Onda D1 (T-D-01..T-D-03,
// release v0.3.5).
//
// Prova, sem browser (registry/camera-modes/main não são importáveis em Node —
// scene.js cria WebGLRenderer no load; por isso registry e HTML são assertados
// no nível de FONTE, e os módulos puros novos por IMPORT real):
//   (a) registry contém 'inhauma-defense' com label e map def fino delegando ao
//       módulo maps/inhauma-defense.js;
//   (b) o map def expõe create/update/heightAt e criar o mundo NÃO toca
//       game.targets nem inicia campanha (sem waves, sem garrison);
//   (c) SOLDIER_POS é o TOPO do morro 2.5× (cota ~250 m, proeminência ~242 m ≈
//       2,5× a anterior, 150-450 m da borda da TOWN_SHELF) com horizonte limpo
//       em 2 direções e anel de spawn da horda observável (T-D-01, release
//       v0.3.10);
//   (d) gimbal: yaw wrap em (-π,π], pitch clamp -10°..+85°;
//   (e) input.js expõe flags semânticas de mouse e NÃO importa Three.js;
//   (f) turret-camera: pitch clamp na matemática da câmera + zoom RMB no FOV;
//   (g) index.html tem os spans do HUD de defesa + botão do modo.
//
// Roda com: node --experimental-default-type=module tests/aero-fighters/tools/test-aero-defense-mode.mjs

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { game } from '../../../aero-fighters/src/state.js';
import { AA_DEFENSE } from '../../../aero-fighters/src/config.js';
import {
  createInhaumaDefenseWorld, updateInhaumaDefenseWorld, inhaumaHeightAt,
} from '../../../aero-fighters/src/maps/inhauma-defense.js';
import { TOWN_SHELF, inhaumaVisualSurfaceHeight } from '../../../aero-fighters/src/maps/inhauma-scene.js';
import {
  createTurretPlayer, wrapYaw, clampPitch, yawTowards, applyMouseLook, selectWeapon,
} from '../../../aero-fighters/src/defense/turret-player.js';
import { createTurretCameraState, updateTurretCamera, gimbalForward } from '../../../aero-fighters/src/defense/turret-camera.js';
import { input, consumeMouseDeltas, requestPointerLock, exitPointerLock } from '../../../aero-fighters/src/input.js';

const SRC = fileURLToPath(new URL('../../../aero-fighters/', import.meta.url));
const read = (rel) => readFileSync(SRC + rel, 'utf8');

// ─── (a) Registry ────────────────────────────────────────────────────────────

test('T-D-01: registry contém inhauma-defense com label e map def fino', () => {
  const src = read('src/maps/index.js');
  assert.match(src, /MAP_KEYS\s*=\s*\[[^\]]*'inhauma-defense'[^\]]*\]/, 'MAP_KEYS sem a chave');
  assert.match(src, /'inhauma-defense':\s*'Inhaúma — Bateria Antiaérea \(Defesa\)'/, 'MAP_LABELS sem o label');
  assert.match(src, /create:\s+createInhaumaDefenseWorld/, 'MAPS sem create');
  assert.match(src, /update:\s+updateInhaumaDefenseWorld/, 'MAPS sem update');
  assert.match(src, /heightAt:\s+inhaumaHeightAt/, 'MAPS sem heightAt');
  // layout vazio — o modo não usa o loop de waves legado
  assert.match(src, /layout:\s+\[\]/, 'layout do modo deveria ser vazio');
});

// ─── (b) Map def: create/update/heightAt + boot sem campanha/waves ──────────

test('T-D-01: map def expõe create/update/heightAt', () => {
  assert.equal(typeof createInhaumaDefenseWorld, 'function');
  assert.equal(typeof updateInhaumaDefenseWorld, 'function');
  assert.equal(typeof inhaumaHeightAt, 'function');
});

test('T-D-01: create do modo não toca game.targets nem inicia campanha', () => {
  game.activeMap = 'inhauma-defense';
  game.targets.length = 0;
  game.campaign = null;
  // Stub DOM mínimo: os builders de água/texturas procedurais usam
  // document.createElement(NS) para Image/canvas — em Node eles nunca completam
  // o load, o que é suficiente para provar o boot lógico do modo.
  const absorb = new Proxy(function () {}, {
    get: (t, p) => (p === Symbol.toPrimitive ? () => 0 : absorb),
    apply: () => absorb,
    set: () => true,
  });
  globalThis.document = {
    createElement: () => absorb,
    createElementNS: () => absorb,
  };
  try {
    const fakeScene = { add() {}, remove() {}, fog: null };
    createInhaumaDefenseWorld(fakeScene);
  } finally {
    delete globalThis.document;
  }
  assert.equal(game.targets.length, 0, 'modo defesa não pode spawnar alvos no boot');
  assert.equal(game.campaign, null, 'modo defesa não pode iniciar a campanha');
  // heightAt funciona sobre a região virtual registrada em game.islands
  assert.ok(game.islands.length > 0, 'região de colisão não registrada');
  const h = inhaumaHeightAt(game.islands[0], AA_DEFENSE.SOLDIER_POS.x - game.islands[0].cx, AA_DEFENSE.SOLDIER_POS.z - game.islands[0].cz);
  assert.ok(Number.isFinite(h) && h > 50, `heightAt no morro deveria ser alto, veio ${h}`);
});

// ─── (c) Posição do soldado: TOPO do morro 2.5× com horizonte em 2 direções ──
// T-D-01 (release v0.3.10): o morro da bateria
// passou de ~101 m para ~250 m (probe 2026-07-20: 250,3 m medidos sobre
// inhaumaVisualSurfaceHeight — proeminência 242 m ≈ 2,51× a anterior de 96,6 m).

/** Maior ângulo de elevação do terreno (graus) visto do olho do artilheiro ao
 *  longo de um raio de `rMax` m na direção `azDeg` (0°=+x, 90°=+z). */
function maxTerrainElevationDeg(eye, azDeg, rMax = 3000) {
  const a = (azDeg * Math.PI) / 180;
  let best = -90;
  for (let r = 120; r <= rMax; r += 50) {
    const h = inhaumaVisualSurfaceHeight(eye.x + Math.cos(a) * r, eye.z + Math.sin(a) * r);
    best = Math.max(best, (Math.atan2(h - eye.y, r) * 180) / Math.PI);
  }
  return best;
}

test('T-D-01: SOLDIER_POS está no topo do morro 2.5× (HILL_POS) com visada para a TOWN_SHELF', () => {
  const { x, z } = AA_DEFENSE.SOLDIER_POS;
  assert.deepEqual(AA_DEFENSE.SOLDIER_POS, AA_DEFENSE.HILL_POS, 'bateria fora do topo (SOLDIER_POS != HILL_POS)');
  const h = inhaumaVisualSurfaceHeight(x, z);
  const townFloor = inhaumaVisualSurfaceHeight(
    (TOWN_SHELF.minX + TOWN_SHELF.maxX) / 2,
    (TOWN_SHELF.minZ + TOWN_SHELF.maxZ) / 2,
  );
  const dx = Math.max(TOWN_SHELF.minX - x, 0, x - TOWN_SHELF.maxX);
  const dz = Math.max(TOWN_SHELF.minZ - z, 0, z - TOWN_SHELF.maxZ);
  const dist = Math.hypot(dx, dz);
  const elev = h - townFloor;
  assert.ok(dist >= 150 && dist <= 450, `distância ao shelf fora de 150-450 m: ${dist.toFixed(0)}`);
  // Morro 2.5×: cota 230-270 m, proeminência ≥ 2,4× a anterior (96,6 m)
  assert.ok(h >= 230 && h <= 270, `cota do topo fora de 230-270 m: ${h.toFixed(1)}`);
  assert.ok(elev >= 2.4 * 96.6, `proeminência ${elev.toFixed(1)} m < 2,4× a anterior (96,6 m)`);
  // O morro se destaca do entorno: a média do anel de 400 m fica bem abaixo do
  // topo (a encosta SW sobe naturalmente para as montanhas — ~232 m — então a
  // prova é pela MÉDIA do anel, não ponto a ponto) e o flanco da cidade cai
  // >100 m em qualquer direção do quadrante do vale.
  const ring = [];
  for (let az = 0; az < 360; az += 15) {
    const a = (az * Math.PI) / 180;
    ring.push(inhaumaVisualSurfaceHeight(x + Math.cos(a) * 400, z + Math.sin(a) * 400));
  }
  const ringMean = ring.reduce((s, v) => s + v, 0) / ring.length;
  assert.ok(ringMean < h - 60, `anel de 400 m alto demais (média ${ringMean.toFixed(1)} vs topo ${h.toFixed(1)})`);
  for (const az of [30, 60, 90, 120]) {
    const a = (az * Math.PI) / 180;
    const hn = inhaumaVisualSurfaceHeight(x + Math.cos(a) * 400, z + Math.sin(a) * 400);
    assert.ok(hn < h - 100, `flanco do vale deveria cair >100 m (az ${az}°: ${hn.toFixed(1)} vs ${h.toFixed(1)})`);
  }
});

test('T-D-01: horizonte LIMPO em 2 direções a partir do topo (sul + norte)', () => {
  const eye = {
    x: AA_DEFENSE.SOLDIER_POS.x,
    y: inhaumaVisualSurfaceHeight(AA_DEFENSE.SOLDIER_POS.x, AA_DEFENSE.SOLDIER_POS.z) + AA_DEFENSE.EYE_HEIGHT,
    z: AA_DEFENSE.SOLDIER_POS.z,
  };
  // Corredor SUL (az 90-135°) e corredor NORTE (az 300-345°): todo o terreno em
  // 3 km fica ABAIXO da linha do horizonte — céu/horizonte desobstruído.
  // (probe 2026-07-20: az 300° mede -0,31° — limite frouxo; os demais < -1,9°.)
  for (const az of [90, 105, 120, 135, 315, 330, 345]) {
    const e = maxTerrainElevationDeg(eye, az);
    assert.ok(e < -0.3, `horizonte obstruído no az ${az}° (elevação máx ${e.toFixed(2)}°)`);
  }
  assert.ok(maxTerrainElevationDeg(eye, 300) < 0, 'az 300° (borda do corredor norte) obstruído');
  // A cidade e o vale à frente ficam abaixo do olhar (o artilheiro olha para baixo)
  const townFloor = inhaumaVisualSurfaceHeight(AA_DEFENSE.LOOK_AT.x, AA_DEFENSE.LOOK_AT.z);
  assert.ok(townFloor < eye.y - 150, 'cidade deveria estar muito abaixo do topo');
});

test('T-D-01: horda observável — anel de spawn (2 km do LOOK_AT) abaixo do horizonte nos corredores limpos', () => {
  const eye = {
    x: AA_DEFENSE.SOLDIER_POS.x,
    y: inhaumaVisualSurfaceHeight(AA_DEFENSE.SOLDIER_POS.x, AA_DEFENSE.SOLDIER_POS.z) + AA_DEFENSE.EYE_HEIGHT,
    z: AA_DEFENSE.SOLDIER_POS.z,
  };
  // Nos 2 corredores limpos, o terreno do anel de spawn da horda (HORDE_DIST do
  // LOOK_AT) fica abaixo da linha do horizonte — tropas se formando são visíveis.
  for (const az of [100, 120, 310, 330]) {
    const a = (az * Math.PI) / 180;
    const hx = AA_DEFENSE.LOOK_AT.x + Math.cos(a) * AA_DEFENSE.HORDE_DIST;
    const hz = AA_DEFENSE.LOOK_AT.z + Math.sin(a) * AA_DEFENSE.HORDE_DIST;
    const hh = inhaumaVisualSurfaceHeight(hx, hz);
    const r = Math.hypot(hx - eye.x, hz - eye.z);
    const elevDeg = (Math.atan2(hh - eye.y, r) * 180) / Math.PI;
    assert.ok(elevDeg < -0.3, `anel da horda no az ${az}° não é observável (elev ${elevDeg.toFixed(2)}° a ${r.toFixed(0)} m)`);
    assert.ok(r < 3400, `horda no az ${az}° fora do fog far (${r.toFixed(0)} m)`);
  }
});

// ─── (d) Gimbal: yaw wrap + pitch clamp ──────────────────────────────────────

test('T-D-02: wrapYaw normaliza para (-π, π]', () => {
  assert.ok(Math.abs(wrapYaw(0)) <= Math.PI);
  assert.ok(Math.abs(wrapYaw(4 * Math.PI)) <= Math.PI);
  assert.ok(Math.abs(wrapYaw(-7 * Math.PI)) <= Math.PI);
  assert.ok(Math.abs(wrapYaw(3.5)) <= Math.PI);
  assert.equal(wrapYaw(Math.PI / 2), Math.PI / 2);
});

test('T-D-02: clampPitch respeita -20°..+85°', () => {
  assert.equal(clampPitch(10), AA_DEFENSE.PITCH_MAX);
  assert.equal(clampPitch(-10), AA_DEFENSE.PITCH_MIN);
  assert.equal(clampPitch(0.3), 0.3);
  // T-D-01 (nuke-firestorm-defense-v1): depressão relaxada para -20° — do topo
  // do morro 2.5× o artilheiro olha para baixo (horda/tropas na cidade).
  assert.ok(Math.abs(AA_DEFENSE.PITCH_MIN - (-20 * Math.PI / 180)) < 1e-3, 'PITCH_MIN deveria ser -20°');
  assert.ok(Math.abs(AA_DEFENSE.PITCH_MAX - (85 * Math.PI / 180)) < 1e-3, 'PITCH_MAX deveria ser +85°');
});

test('T-D-02: applyMouseLook clampa pitch e wrapa yaw no artilheiro', () => {
  const t = createTurretPlayer({ x: 0, y: 100, z: 0, lookAt: { x: 10, y: 4, z: 10 } });
  applyMouseLook(t, 0, -1e6); // mouse muito pra cima
  assert.equal(t.pitch, AA_DEFENSE.PITCH_MAX);
  applyMouseLook(t, 0, 1e6);  // muito pra baixo
  assert.equal(t.pitch, AA_DEFENSE.PITCH_MIN);
  applyMouseLook(t, 1e7, 0);  // yaw gigante
  assert.ok(Math.abs(t.yaw) <= Math.PI, 'yaw fora de (-π, π]');
  // armas
  assert.equal(t.weapon, 'mg');
  selectWeapon(t, 'aa');
  assert.equal(t.weapon, 'aa');
  selectWeapon(t, 'laser'); // inválido: ignorado
  assert.equal(t.weapon, 'aa');
  assert.equal(t.ammo.aa, AA_DEFENSE.AA_MISSILES);
  // yawTowards: forward (0,0,-1) com yaw=0 — mirar pra -Z deve dar yaw≈0
  assert.ok(Math.abs(yawTowards(0, 0, 0, -100)) < 1e-9);
});

// ─── (e) Input: flags semânticas de mouse, sem Three.js ──────────────────────

test('T-D-02: input expõe flags de mouse + pointer lock, sem import de three', () => {
  assert.ok(input.mouse && typeof input.mouse === 'object');
  for (const k of ['dx', 'dy', 'left', 'right', 'wheel']) {
    assert.ok(k in input.mouse, `input.mouse.${k} ausente`);
  }
  assert.equal(typeof input.pointerLocked, 'boolean');
  assert.equal(typeof requestPointerLock, 'function');
  assert.equal(typeof exitPointerLock, 'function');
  const deltas = consumeMouseDeltas();
  assert.deepEqual(deltas, { dx: 0, dy: 0, wheel: 0 });
  const src = read('src/input.js');
  assert.ok(!/from\s+['"][^'"]*three/i.test(src), 'input.js não pode importar Three.js');
  assert.ok(!/import\s*\*\s*as\s*THREE/.test(src), 'input.js não pode importar THREE');
});

// ─── (f) Turret camera: pitch clamp + zoom RMB ───────────────────────────────

function makeFakeCamera() {
  const calls = { rotSet: [], fovs: [] };
  return {
    calls,
    position: { set(x, y, z) { this.x = x; this.y = y; this.z = z; } },
    up: { set(x, y, z) { this.x = x; this.y = y; this.z = z; } },
    rotation: { order: '', set(x, y, z) { calls.rotSet.push([x, y, z]); } },
    fov: 62,
    updateProjectionMatrix() { calls.fovs.push(this.fov); },
  };
}

test('T-D-03: câmera clampa pitch via mouse e faz zoom com RMB', () => {
  const t = createTurretPlayer({ x: -760, y: 100, z: -400, lookAt: { x: -250, y: 8, z: 250 } });
  const cam = makeFakeCamera();
  const cs = createTurretCameraState();
  const mouse = { dx: 0, dy: -1e6, left: false, right: false };
  updateTurretCamera(1 / 60, cam, t, cs, mouse);
  assert.equal(t.pitch, AA_DEFENSE.PITCH_MAX, 'pitch não clampou no máximo');
  const lastRot = cam.calls.rotSet.at(-1);
  assert.equal(lastRot[0], AA_DEFENSE.PITCH_MAX, 'rotação da câmera não recebeu o pitch clampado');
  assert.equal(lastRot[1], t.yaw);
  assert.equal(cam.rotation.order, 'YXZ');
  // RMB: FOV converge para ZOOM_FOV
  const zoomMouse = { dx: 0, dy: 0, left: false, right: true };
  for (let i = 0; i < 120; i++) updateTurretCamera(1 / 60, cam, t, cs, zoomMouse);
  assert.ok(Math.abs(cam.fov - AA_DEFENSE.ZOOM_FOV) < 1, `zoom não convergiu: ${cam.fov}`);
  // soltou RMB: volta para FOV normal
  const normalMouse = { dx: 0, dy: 0, left: false, right: false };
  for (let i = 0; i < 120; i++) updateTurretCamera(1 / 60, cam, t, cs, normalMouse);
  assert.ok(Math.abs(cam.fov - AA_DEFENSE.FOV) < 1, `fov não voltou: ${cam.fov}`);
  // over-shoulder: câmera recuada atrás do soldado
  const f = gimbalForward(t.yaw, t.pitch);
  const back = (t.x - cam.position.x) * f.x + (t.z - cam.position.z) * f.z;
  assert.ok(back > 0, 'câmera deveria estar atrás do soldado ao longo do forward');
});

// ─── (g) HUD: spans do modo defesa no index.html ─────────────────────────────

test('T-D-03: index.html tem o bloco de HUD da defesa + botão do modo', () => {
  const html = read('index.html');
  for (const id of ['defense-hud', 'def-reticle', 'def-score', 'def-city', 'def-heat', 'def-missiles', 'def-weapon', 'def-alert']) {
    assert.ok(html.includes(`id="${id}"`), `span/div #${id} ausente no index.html`);
  }
  assert.ok(html.includes("selectMap('inhauma-defense')"), 'botão do modo ausente no map-select');
  assert.ok(html.includes('id="flight-hud"'), 'wrapper do HUD de voo ausente');
  // defense-hud nasce escondido (display:none fora do modo)
  assert.match(html, /id="defense-hud" style="display:none/, 'defense-hud deveria nascer com display:none');
});

// Módulos em src/defense/ e src/maps/ estão a 2 níveis de aero-fighters/ — o
// vendor fica em '../../../vendor'. Um '../../vendor' aqui 404a no browser
// (bug pego no smoke da Onda D1 — node --check não resolve imports).
test('Onda D1: imports de vendor nos módulos novos usam a profundidade certa', () => {
  for (const f of ['src/defense/defense-mode.js', 'src/defense/turret-camera.js', 'src/defense/turret-player.js', 'src/maps/inhauma-defense.js']) {
    const src = read(f);
    assert.ok(!/from\s+['"]\.\.\/\.\.\/vendor\//.test(src), `${f} tem import ../../vendor (404 no browser)`);
  }
});
