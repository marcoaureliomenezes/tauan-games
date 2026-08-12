// city-war.js — Guerra urbana de Inhaúma (T-C-09, release
// v0.3.4 — SPEC §D). As baterias de artilharia do
// Ato 1 (formações 'artilleryBattery' em estado 'deployed', campaign.js)
// bombardeiam os PRÉDIOS de Inhaúma: projétil visível → impacto → explosão +
// fogo persistente + coluna de fumaça + scorch. Enquanto a bateria viver, os
// focos são REARMADOS; bateria destruída (todos os obuseiros mortos) → os focos
// queimam até apagar e a fumaça é removida.
//
// DECISÃO DE TRAJETÓRIA: "fast flat shell" — balística real com gravidade
// ARCADE (G_ARC=25 m/s²) e tempo de voo curto seedado (2.2-3.4 s). A 700-1200 m
// de distância isso dá velocidade horizontal de ~250-450 m/s com uma curva
// visível de ~20-36 m de apex — lê bem do ar (rastro de fumaça + glow) sem o
// arco de morteiro irreal que um g=9.8 exigiria para o mesmo alcance/tempo.
//
// Orçamento: ≤3 projéteis em voo por bateria (SHELL_POOL=12 ≥ 3×3 baterias);
// pool fixo criado no init — ZERO alocação por disparo/frame no hot path
// (posições são números planos nos registros; os hooks recebem x,y,z e usam
// scratches do lado browser). Projéteis NÃO entram em game.targets e NÃO
// colidem com o jogador (vivem só no array local `shells`).
//
// Node-safe: nada de scene/fx/audio importados — tudo injetado. O mapa Inhaúma
// (maps/inhauma.js) faz o wiring real via setCityWarHooks + initCityWar;
// updateCityWar é ticado pelo relógio da CAMPANHA (campaign.js#updateCampaign —
// um relógio só, que só avança com game.running). rng derivado seed+':citywar'
// (mesmo padrão da guarnição/campanha — determinismo por seed).
// Exporta: setCityWarHooks, initCityWar, updateCityWar, resetCityWar, cityWarDebug.

import * as THREE from '../../vendor/three.module.min.js';
import { createRng } from './rng.js';
import { TOWN_SHELF, getInhaumaStructures } from './maps/inhauma-scene.js';

const G_ARC = 25;          // m/s² — gravidade arcade do arco (ver header)
const FLIGHT_T = [2.2, 3.4]; // s — tempo de voo seedado
const FIRE_INTERVAL = [6, 11]; // s — ciclo de tiro por obuseiro (staggered)
const MAX_IN_FLIGHT = 3;   // projéteis simultâneos por bateria
const SHELL_POOL = 12;
const REARM_S = 22;        // s — re-arm dos focos enquanto a bateria vive
const FIRE_DURATION = 26;  // s — duração de cada spawnPropFire (> REARM_S: sem gap)
const SHELL_GEOM = new THREE.BoxGeometry(0.5, 0.5, 2.4);
const SHELL_MAT = new THREE.MeshBasicMaterial({
  color: 0xffcc55, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false,
});

// Hooks de FX/áudio — injetados pelo browser (maps/inhauma.js); no-op em Node.
let _h = {
  explosion: () => {}, muzzle: () => {}, trail: () => {}, propFire: () => {},
  smoke: () => {}, removeSmoke: () => {}, scorch: () => {}, boom: () => {},
};
export function setCityWarHooks(hooks) { Object.assign(_h, hooks); }

let _cw = null; // { scene, rng, buildings, pool, shells, burning:Map }

/** Inicializa a guerra urbana (idempotente). deps = { scene }. Lê os prédios
 *  REAIS da cidade (getInhaumaStructures filtrado à TOWN_SHELF) — chamar DEPOIS
 *  de buildTown. */
export function initCityWar(game, deps = {}) {
  if (_cw) return _cw;
  const buildings = getInhaumaStructures().filter((s) => (
    s.id.startsWith('predio-inhauma')
    && s.x > TOWN_SHELF.minX && s.x < TOWN_SHELF.maxX
    && s.z > TOWN_SHELF.minZ && s.z < TOWN_SHELF.maxZ
  ));
  const pool = [];
  for (let i = 0; i < SHELL_POOL; i++) {
    const mesh = new THREE.Mesh(SHELL_GEOM, SHELL_MAT);
    mesh.visible = false;
    deps.scene?.add(mesh);
    pool.push(mesh);
  }
  _cw = {
    scene: deps.scene, rng: createRng(`${game.runtime?.seed ?? 'aero-default-seed'}:citywar`),
    buildings, pool, shells: [], burning: new Map(),
  };
  return _cw;
}

/** Introspecção para testes Node (sem expor mutação). */
export function cityWarDebug() {
  if (!_cw) return null;
  return { buildings: _cw.buildings, shells: _cw.shells, burning: _cw.burning, poolSize: _cw.pool.length };
}

const batteryAlive = (c, id) => c.formations.some((f) => f.id === id
  && f.members.some((m) => m.unit === 'artillery' && m.alive && m.target && !m.target.dead));

const inFlight = (cw, id) => cw.shells.reduce((n, s) => n + (s.batteryId === id ? 1 : 0), 0);

/** Escolhe um prédio-alvo seedado, preferindo os que ainda NÃO queimam. */
function pickBuilding(cw) {
  const n = cw.buildings.length;
  if (!n) return null;
  const start = cw.rng.int(0, n - 1);
  for (let k = 0; k < n; k++) {
    const b = cw.buildings[(start + k) % n];
    if (!cw.burning.has(b.id)) return b;
  }
  return cw.buildings[start]; // tudo queimando: re-bombardeia (caos de guerra)
}

/** Dispara um projétil de um obuseiro contra um prédio. Sem alocação de mesh —
 *  puxa um slot do pool; o registro usa números planos. */
function fireShell(cw, f, gun, b) {
  const mesh = cw.pool.find((m) => !m.visible);
  if (!mesh) return;
  const ox = gun.pos.x, oy = gun.pos.y + 2.5, oz = gun.pos.z;
  const tx = b.x + cw.rng.range(-b.halfX * 0.5, b.halfX * 0.5);
  const tz = b.z + cw.rng.range(-b.halfZ * 0.5, b.halfZ * 0.5);
  const ty = b.topY * 0.6; // impacto na face do prédio
  const T = cw.rng.range(FLIGHT_T[0], FLIGHT_T[1]);
  mesh.visible = true;
  mesh.position.set(ox, oy, oz);
  cw.shells.push({
    mesh, batteryId: f.id, building: b, t: 0, T, tx, ty, tz, trailCool: 0,
    x: ox, y: oy, z: oz,
    vx: (tx - ox) / T, vz: (tz - oz) / T,
    vy: (ty - oy + 0.5 * G_ARC * T * T) / T,
  });
  _h.muzzle(ox, oy, oz);
  _h.boom(ox, oy, oz); // trovão distante da bateria (audio.explosion posicional)
}

function impact(cw, s) {
  const b = s.building;
  _h.explosion(s.x, s.y, s.z, 1.6);
  _h.propFire(b.x, b.topY * 0.6, b.z, 1.8, FIRE_DURATION);
  if (!cw.burning.has(b.id)) {
    const owner = { cityWar: b.id };
    cw.burning.set(b.id, { building: b, batteryId: s.batteryId, rearm: REARM_S, owner });
    _h.smoke(b.x, b.topY + 2, b.z, owner);          // coluna de fumaça sobre o telhado
    _h.scorch(b.x, b.topY - 10, b.z, 7);            // cicatriz na base do prédio
  }
  s.mesh.visible = false;
}

/** 2026-08-11: ataque AÉREO à cidade (caças inimigos da ally-war). A cidade tem
 *  um só barramento de dano — o mesmo canal de FX/burning das baterias.
 *  Duas fases: o atacante ADQUIRE um ponto (prédio real) e, ao chegar, CRAVA o
 *  strike (mesma cadeia do impact(): fogo persistente + fumaça + scorch). */
export function pickCityTargetPoint() {
  const cw = _cw;
  if (!cw) return null;
  const b = pickBuilding(cw);
  if (!b) return null;
  return { id: b.id, x: b.x, y: b.topY * 0.6, z: b.z };
}

export function airStrikeCityBuilding(id) {
  const cw = _cw;
  if (!cw) return false;
  const b = cw.buildings.find((bb) => bb.id === id);
  if (!b) return false;
  impact(cw, { building: b, batteryId: 'air-raid', x: b.x, y: b.topY * 0.6, z: b.z, mesh: { visible: false } });
  return true;
}

/** Tick — chamado pelo relógio da campanha (updateCampaign), um relógio só. */
export function updateCityWar(dt, game) {
  const cw = _cw, c = game.campaign;
  if (!cw || !c || c.victory || c.failed) return;

  // 1) Baterias deployed com obuseiros vivos disparam (ciclo seedado por peça).
  for (const f of c.formations) {
    if (f.type !== 'artilleryBattery' || f.state !== 'deployed') continue;
    for (const m of f.members) {
      if (m.unit !== 'artillery' || !m.alive || !m.target || m.target.dead) continue;
      if (m.cwTimer === undefined) m.cwTimer = cw.rng.range(0, FIRE_INTERVAL[1]); // stagger inicial
      m.cwTimer -= dt;
      if (m.cwTimer > 0) continue;
      m.cwTimer = cw.rng.range(FIRE_INTERVAL[0], FIRE_INTERVAL[1]);
      if (inFlight(cw, f.id) >= MAX_IN_FLIGHT) continue;
      const b = pickBuilding(cw);
      if (b) fireShell(cw, f, m, b);
    }
  }

  // 2) Projéteis em voo — balística simples, sem alocação por frame.
  for (let i = cw.shells.length - 1; i >= 0; i--) {
    const s = cw.shells[i];
    s.t += dt;
    s.vy -= G_ARC * dt;
    s.x += s.vx * dt; s.y += s.vy * dt; s.z += s.vz * dt;
    s.mesh.position.set(s.x, s.y, s.z);
    s.mesh.lookAt(s.x + s.vx, s.y + s.vy, s.z + s.vz);
    s.trailCool -= dt;
    if (s.trailCool <= 0) { s.trailCool = 0.07; _h.trail(s.x, s.y, s.z); }
    // Chegada por TEMPO DE VOO (dt-proof): com dt grande o projétil pularia a
    // janela geométrica do prédio num só passo. Snap exato ao ponto visado.
    if (s.t >= s.T) {
      s.x = s.tx; s.y = s.ty; s.z = s.tz;
      s.mesh.position.set(s.x, s.y, s.z);
      impact(cw, s); cw.shells.splice(i, 1);
    }
  }

  // 3) Focos: rearmados enquanto a bateria dona vive; morta → queimam até apagar
  //    (sem novo spawnPropFire) e a coluna de fumaça é removida.
  for (const [id, e] of cw.burning) {
    e.rearm -= dt;
    if (e.rearm > 0) continue;
    if (batteryAlive(c, e.batteryId)) {
      e.rearm = REARM_S;
      _h.propFire(e.building.x, e.building.topY * 0.6, e.building.z, 1.8, FIRE_DURATION);
    } else {
      _h.removeSmoke(e.owner);
      cw.burning.delete(id);
    }
  }
}

/** Reset junto com o Ato 1 (restartGame → resetCampaign): apaga projéteis em
 *  voo e todos os focos/fumaças da guerra urbana. */
export function resetCityWar() {
  const cw = _cw;
  if (!cw) return;
  for (const s of cw.shells) s.mesh.visible = false;
  cw.shells.length = 0;
  for (const e of cw.burning.values()) _h.removeSmoke(e.owner);
  cw.burning.clear();
}
