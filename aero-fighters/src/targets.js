// targets.js — Alvos militares estáticos (bases, fábricas, prédios, comboios, AA).
// Exporta: spawnTarget, damageTarget, killTarget, updateTargets, clearTargets,
//   makeBase/makeFactory/makeBuilding/makeConvoy/makeAAGun.
// Para adicionar tipo novo: makeXxx + entrada em TARGETS (config.js) + slot em TARGET_LAYOUT.

import * as THREE from '../../vendor/three.module.min.js';
import { scene } from './scene.js';
import { audio } from './audio.js';
import { game } from './state.js';
import { TARGETS, AA, MISSION, TARGET_LAYOUT } from './config.js';
import { explosion, megaExplosion, spawnShockwave } from './fx.js';
import { addSmokeEmitter, removeSmokeEmittersOf } from './factory-fx.js';
import { spawnBullet, spawnPickup } from './projectiles.js';
import { islandHeightAt } from './world.js';

// ─── Mesh builders ───────────────────────────────────────────────────────────

/** Base militar: barracas + radar + bandeira + sandbags. */
export function makeBase() {
  const g = new THREE.Group();
  const wall = new THREE.MeshLambertMaterial({ color: 0x4a4a3a });
  const roof = new THREE.MeshLambertMaterial({ color: 0x3a3a2a });
  const metal = new THREE.MeshLambertMaterial({ color: 0x2a2a30 });
  const flag = new THREE.MeshBasicMaterial({ color: 0x88001a });
  const main = new THREE.Mesh(new THREE.BoxGeometry(8, 3, 5), wall);
  main.position.set(0, 1.5, 0); g.add(main);
  const r1 = new THREE.Mesh(new THREE.BoxGeometry(8.4, 0.4, 5.4), roof);
  r1.position.set(0, 3.2, 0); g.add(r1);
  const s1 = new THREE.Mesh(new THREE.BoxGeometry(4, 2, 4), wall);
  s1.position.set(-6, 1, -3); g.add(s1);
  const r2 = new THREE.Mesh(new THREE.BoxGeometry(4.3, 0.3, 4.3), roof);
  r2.position.set(-6, 2.15, -3); g.add(r2);
  const s2 = new THREE.Mesh(new THREE.BoxGeometry(3, 2.5, 3), wall);
  s2.position.set(5, 1.25, 4); g.add(s2);
  const tower = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.6, 5, 8), metal);
  tower.position.set(0, 2.5, 4); g.add(tower);
  const dish = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 0.2, 0.3, 12), metal);
  dish.position.set(0, 5.2, 4); dish.rotation.z = Math.PI / 5; g.add(dish);
  const fp = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 3.5, 5), metal);
  fp.position.set(6, 1.75, -4); g.add(fp);
  const flagM = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.6, 1), flag);
  flagM.position.set(6, 3, -3.5); g.add(flagM);
  for (let i = -2; i <= 2; i++) {
    const sb = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.4, 0.6), roof);
    sb.position.set(i * 1.5, 0.2, -3); g.add(sb);
  }
  return g;
}

/** Fábrica: armazém + 3 chaminés (emitem fumaça contínua). */
export function makeFactory() {
  const g = new THREE.Group();
  const wall = new THREE.MeshLambertMaterial({ color: 0x665a4a });
  const roof = new THREE.MeshLambertMaterial({ color: 0x3a3530 });
  const metal = new THREE.MeshLambertMaterial({ color: 0x2a2a2a });
  const main = new THREE.Mesh(new THREE.BoxGeometry(6, 4, 10), wall);
  main.position.set(0, 2, 0); g.add(main);
  const r = new THREE.Mesh(new THREE.BoxGeometry(6.4, 0.4, 10.4), roof);
  r.position.set(0, 4.2, 0); g.add(r);
  const stacks = [];
  for (let i = -1; i <= 1; i++) {
    const sk = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.6, 4, 10), metal);
    sk.position.set(i * 1.5, 6, -3); g.add(sk);
    stacks.push({ dx: i * 1.5, dy: 8.2, dz: -3 });
  }
  const a = new THREE.Mesh(new THREE.BoxGeometry(3, 2.5, 4), wall);
  a.position.set(-4.5, 1.25, 3); g.add(a);
  const ra = new THREE.Mesh(new THREE.BoxGeometry(3.3, 0.3, 4.3), roof);
  ra.position.set(-4.5, 2.65, 3); g.add(ra);
  g.userData.stacks = stacks;
  return g;
}

/** Prédio terrorista: torre multi-andar + janelas + antena. */
export function makeBuilding() {
  const g = new THREE.Group();
  const wall = new THREE.MeshLambertMaterial({ color: 0x554840 });
  const win  = new THREE.MeshBasicMaterial({ color: 0xffcc66 });
  const dark = new THREE.MeshLambertMaterial({ color: 0x2a2a2a });
  const tower = new THREE.Mesh(new THREE.BoxGeometry(4, 9, 4), wall);
  tower.position.set(0, 4.5, 0); g.add(tower);
  for (let floor = 0; floor < 4; floor++) {
    for (let col = -1; col <= 1; col++) {
      const w = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.6, 0.05), win);
      w.position.set(col * 1.0, 2.0 + floor * 2, -2.05); g.add(w);
    }
  }
  const roof = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.4, 4.4), dark);
  roof.position.set(0, 9.2, 0); g.add(roof);
  const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 3.5, 5), dark);
  ant.position.set(0, 11.2, 0); g.add(ant);
  const low = new THREE.Mesh(new THREE.BoxGeometry(3, 2, 3), wall);
  low.position.set(-3, 1, -2); g.add(low);
  return g;
}

/** Comboio: 5 caminhões militares enfileirados. */
export function makeConvoy() {
  const g = new THREE.Group();
  const cab = new THREE.MeshLambertMaterial({ color: 0x4a5040 });
  const bed = new THREE.MeshLambertMaterial({ color: 0x3a4030 });
  const tire = new THREE.MeshLambertMaterial({ color: 0x1a1a1a });
  for (let i = 0; i < 5; i++) {
    const truck = new THREE.Group();
    const c = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.2, 1.0), cab);
    c.position.set(0, 0.95, -0.6); truck.add(c);
    const b = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.1, 1.8), bed);
    b.position.set(0, 0.9, 0.9); truck.add(b);
    for (const [tx, tz] of [[-0.65, -0.5], [0.65, -0.5], [-0.65, 1.4], [0.65, 1.4]]) {
      const w = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.22, 8), tire);
      w.rotation.z = Math.PI / 2;
      w.position.set(tx, 0.32, tz); truck.add(w);
    }
    truck.position.set(0, 0, i * 4 - 8);
    g.add(truck);
  }
  return g;
}

/** Canhão antiaéreo: base octagonal + torre + 2 canos. ÚNICO que atira no player. */
export function makeAAGun() {
  const g = new THREE.Group();
  const base = new THREE.MeshLambertMaterial({ color: 0x554a3a });
  const turret = new THREE.MeshLambertMaterial({ color: 0x3a3a2a });
  const barrel = new THREE.MeshLambertMaterial({ color: 0x202020 });
  const b = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.4, 0.8, 8), base);
  b.position.set(0, 0.4, 0); g.add(b);
  const t = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.7, 1.2), turret);
  t.position.set(0, 1.1, 0); g.add(t);
  const barrels = new THREE.Group();
  for (const off of [-0.25, 0.25]) {
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 2.2, 6), barrel);
    bar.rotation.x = -Math.PI / 4;
    bar.position.set(off, 0.6, -0.8); barrels.add(bar);
  }
  barrels.position.set(0, 1.1, 0);
  g.add(barrels);
  g.userData.barrels = barrels;
  return g;
}

/** Navio de guerra: casco + superestrutura + torre de canhão + mastro. */
export function makeWarship() {
  const g = new THREE.Group();
  const hullMat  = new THREE.MeshLambertMaterial({ color: 0x3a3f4a });
  const superMat = new THREE.MeshLambertMaterial({ color: 0x4a5060 });
  const gunMat   = new THREE.MeshLambertMaterial({ color: 0x2a2f38 });

  // Hull
  const hull = new THREE.Mesh(new THREE.BoxGeometry(3.2, 1.0, 9.0), hullMat);
  hull.position.y = 0.5;
  g.add(hull);

  // Proa (bow)
  const bow = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.8, 2.5), hullMat);
  bow.position.set(0, 0.4, -5.0);
  bow.rotation.x = 0.15;
  g.add(bow);

  // Superestrutura (ponte)
  const bridge = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.8, 3.5), superMat);
  bridge.position.set(0, 1.9, 0.5);
  g.add(bridge);

  // Mastro
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 4.5, 6), superMat);
  mast.position.set(0, 4.8, 0.5);
  g.add(mast);

  // Torrreta frontal
  const turret = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.65, 0.8, 8), gunMat);
  turret.position.set(0, 1.4, -2.5);
  g.add(turret);
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.10, 2.5, 6), gunMat);
  barrel.rotation.z = Math.PI / 2;
  barrel.position.set(0, 1.8, -2.5);
  g.add(barrel);

  // Canhão AA traseiro
  const aaBase = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.45, 0.6, 8), gunMat);
  aaBase.position.set(0, 1.4, 2.0);
  g.add(aaBase);

  g.castShadow = true;
  g.receiveShadow = true;
  return g;
}

const MAKERS = { base: makeBase, factory: makeFactory, building: makeBuilding, convoy: makeConvoy, aaGun: makeAAGun, warship: makeWarship };

// ─── Lifecycle ───────────────────────────────────────────────────────────────

/** Cria um alvo no terreno de uma ilha ou em coordenada absoluta (islandIdx=-1). */
export function spawnTarget(islandIdx, dx, dz, type, heightFn) {
  const def = TARGETS[type];
  const maker = MAKERS[type];
  if (!def || !maker) return null;

  let worldX, worldZ, yGround;

  if (islandIdx === -1) {
    // Coordenada absoluta no oceano / chão do mapa
    worldX = dx;
    worldZ = dz;
    yGround = type === 'warship' ? 0.6 : 0;
  } else {
    const isl = game.islands[islandIdx];
    if (!isl) return null;
    const hFn = (heightFn) ? heightFn : islandHeightAt;
    yGround = hFn(isl, dx, dz);
    worldX = isl.cx + dx;
    worldZ = isl.cz + dz;
  }

  const mesh = maker();
  mesh.position.set(worldX, yGround, worldZ);
  mesh.rotation.y = Math.random() * Math.PI * 2;
  // Alvos projetam e recebem sombra
  mesh.traverse((obj) => { if (obj.isMesh) { obj.castShadow = true; obj.receiveShadow = true; } });
  scene.add(mesh);
  // Registra emissores de fumaça de chaminé em coords de mundo
  if (type === 'factory' && mesh.userData.stacks) {
    for (const st of mesh.userData.stacks) {
      const cy = Math.cos(mesh.rotation.y), sy = Math.sin(mesh.rotation.y);
      const wx = mesh.position.x + (st.dx * cy + st.dz * sy);
      const wz = mesh.position.z + (-st.dx * sy + st.dz * cy);
      addSmokeEmitter(wx, mesh.position.y + st.dy, wz, mesh);
    }
  }
  const hpBonus = Math.floor((game.cycle - 1) * MISSION.HP_BONUS_PER_CYCLE);
  const aaSpeedup = Math.min(AA.MAX_SPEEDUP, (game.cycle - 1) * AA.CYCLE_SPEEDUP);

  // Warships têm waypoints de patrulha circulares
  let path = null;
  if (type === 'warship') {
    const px = worldX, pz = worldZ;
    const r = 200 + Math.random() * 150;
    path = [];
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + Math.random() * 0.5;
      path.push([px + Math.cos(a) * r, pz + Math.sin(a) * r]);
    }
  }

  const t = {
    type, mesh,
    hp: def.hp + hpBonus, maxHp: def.hp + hpBonus,
    score: def.score, hr2: def.hr2,
    dropChance: def.dropChance,
    dead: false,
    fireTimer: 1.0 + Math.random() * 2.0,
    fireInterval: (type === 'aaGun' || type === 'warship') ? AA.BASE_INTERVAL - aaSpeedup : Infinity,
    range: type === 'warship' ? 800 : AA.RANGE,
    path,
    pathIdx: 0,
  };
  game.targets.push(t);
  return t;
}

export function damageTarget(t, amt) {
  if (t.dead) return;
  t.hp -= amt;
  audio.hit();
  if (t.hp <= 0) killTarget(t);
}

export function killTarget(t) {
  if (t.dead) return;
  t.dead = true;
  if (t.type === 'base' || t.type === 'factory') {
    megaExplosion(t.mesh.position, 'target');
  } else if (t.type === 'building' || t.type === 'convoy') {
    explosion(t.mesh.position, 2.0);
    spawnShockwave(t.mesh.position, 22);
    audio.explosion(1.0, t.mesh.position);
  } else {
    explosion(t.mesh.position, 1.0);
    audio.explosion(0.5, t.mesh.position);
  }
  if (t.type === 'factory') removeSmokeEmittersOf(t.mesh);
  if (Math.random() < t.dropChance) spawnPickup(t.mesh.position.clone());
  // CONTRATO: writer de game.score / game.kills / game.targetsDestroyed
  game.score += t.score;
  game.kills += 1;
  game.targetsDestroyed += 1;
  // Award 1 nuclear missile every 5 targets destroyed
  if (game.targetsDestroyed % 5 === 0) {
    game.player.nuclearMissiles = (game.player.nuclearMissiles || 0) + 1;
  }
  scene.remove(t.mesh);
}

const _aaDir = new THREE.Vector3();
const _aaOrig = new THREE.Vector3();

/** Atualiza alvos. AA guns miram e atiram; warships patrulham e atiram. */
export function updateTargets(dt, jetPos) {
  for (let i = game.targets.length - 1; i >= 0; i--) {
    const t = game.targets[i];
    // permite que tests externos forcem kill setando t.hp = 0
    if (!t.dead && t.hp <= 0) killTarget(t);
    if (t.dead) { game.targets.splice(i, 1); continue; }
    if (t.type === 'aaGun') updateAAGun(t, dt, jetPos);
    if (t.type === 'warship') updateWarship(t, dt, jetPos);
  }
}

function updateAAGun(t, dt, jetPos) {
  const dist2 = t.mesh.position.distanceToSquared(jetPos);
  if (dist2 > t.range * t.range) return;
  const dx = jetPos.x - t.mesh.position.x;
  const dz = jetPos.z - t.mesh.position.z;
  t.mesh.rotation.y = Math.atan2(dx, dz);
  t.fireTimer -= dt;
  if (t.fireTimer <= 0) {
    t.fireTimer = t.fireInterval + Math.random() * 0.4;
    _aaDir.subVectors(jetPos, t.mesh.position).normalize();
    _aaOrig.copy(t.mesh.position); _aaOrig.y += 1.8;
    _aaOrig.addScaledVector(_aaDir, 1.2);
    spawnBullet(_aaOrig.clone(), _aaDir, true);
    audio.aaFire(t.mesh.position);
  }
}

const _wsDir = new THREE.Vector2();
function updateWarship(t, dt, jetPos) {
  if (!t.path || t.path.length === 0) return;
  // Movimento ao longo de waypoints
  const wp = t.path[t.pathIdx];
  _wsDir.set(wp[0] - t.mesh.position.x, wp[1] - t.mesh.position.z);
  if (_wsDir.length() < 8) {
    t.pathIdx = (t.pathIdx + 1) % t.path.length;
  } else {
    _wsDir.normalize().multiplyScalar(4 * dt);
    t.mesh.position.x += _wsDir.x;
    t.mesh.position.z += _wsDir.y;
    t.mesh.position.y = 0.6;
    t.mesh.rotation.y = Math.atan2(_wsDir.x, _wsDir.y);
  }
  // Disparo contra o player
  const dist2 = t.mesh.position.distanceToSquared(jetPos);
  if (dist2 > t.range * t.range) return;
  t.fireTimer -= dt;
  if (t.fireTimer <= 0) {
    t.fireTimer = t.fireInterval + Math.random() * 0.6;
    _aaDir.subVectors(jetPos, t.mesh.position).normalize();
    _aaOrig.copy(t.mesh.position); _aaOrig.y += 2.2;
    _aaOrig.addScaledVector(_aaDir, 2.0);
    spawnBullet(_aaOrig.clone(), _aaDir, true);
    audio.aaFire(t.mesh.position);
  }
}

/** Limpa todos os alvos da cena (para restartGame). */
export function clearTargets() {
  for (const t of game.targets) if (t.mesh?.parent) scene.remove(t.mesh);
  game.targets.length = 0;
}
