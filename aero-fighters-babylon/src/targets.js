// targets.js — Alvos militares: base, fabrica, predio, comboio, aaGun, warship.
// Exporta: spawnTarget, damageTarget, killTarget, updateTargets, clearTargets.

/* global BABYLON */

import { scene } from './scene.js';
import { audio } from './audio.js';
import { game } from './state.js';
import { TARGETS, AA, MISSION } from './config.js';
import { explosion, megaExplosion, spawnShockwave } from './fx.js';
import { spawnBullet, spawnPickup } from './projectiles.js';
import { islandHeightAt } from './world.js';

// ─── Mesh builders ────────────────────────────────────────────────────────────

function matOf(r, g, b) {
  const m = new BABYLON.StandardMaterial('tm_' + Math.random(), scene);
  m.diffuseColor = new BABYLON.Color3(r, g, b);
  m.specularColor = new BABYLON.Color3(0.1, 0.1, 0.1);
  return m;
}

export function makeBase() {
  const root = new BABYLON.TransformNode('base', scene);
  const wall = matOf(0.29, 0.29, 0.23);
  const roof = matOf(0.23, 0.23, 0.16);
  const metal = matOf(0.16, 0.16, 0.19);

  const main = BABYLON.MeshBuilder.CreateBox('bm', { width: 8, height: 3, depth: 5 }, scene);
  main.position.set(0, 1.5, 0); main.material = wall; main.parent = root;

  const r1 = BABYLON.MeshBuilder.CreateBox('br1', { width: 8.4, height: 0.4, depth: 5.4 }, scene);
  r1.position.set(0, 3.2, 0); r1.material = roof; r1.parent = root;

  const s1 = BABYLON.MeshBuilder.CreateBox('bs1', { width: 4, height: 2, depth: 4 }, scene);
  s1.position.set(-6, 1, -3); s1.material = wall; s1.parent = root;

  const tower = BABYLON.MeshBuilder.CreateCylinder('btw', { diameterTop: 0.8, diameterBottom: 1.2, height: 5, tessellation: 8 }, scene);
  tower.position.set(0, 2.5, 4); tower.material = metal; tower.parent = root;

  const fp = BABYLON.MeshBuilder.CreateCylinder('bfp', { diameter: 0.12, height: 3.5, tessellation: 5 }, scene);
  fp.position.set(6, 1.75, -4); fp.material = metal; fp.parent = root;

  const flagM = BABYLON.MeshBuilder.CreateBox('bfl', { width: 0.05, height: 0.6, depth: 1 }, scene);
  flagM.position.set(6, 3, -3.5);
  flagM.material = matOf(0.53, 0.0, 0.10);
  flagM.parent = root;

  return root;
}

export function makeFactory() {
  const root = new BABYLON.TransformNode('factory', scene);
  const wall = matOf(0.40, 0.35, 0.29);
  const roof = matOf(0.23, 0.21, 0.19);
  const metal = matOf(0.16, 0.16, 0.16);

  const main = BABYLON.MeshBuilder.CreateBox('fm', { width: 6, height: 4, depth: 10 }, scene);
  main.position.set(0, 2, 0); main.material = wall; main.parent = root;

  const r = BABYLON.MeshBuilder.CreateBox('fr', { width: 6.4, height: 0.4, depth: 10.4 }, scene);
  r.position.set(0, 4.2, 0); r.material = roof; r.parent = root;

  for (let i = -1; i <= 1; i++) {
    const sk = BABYLON.MeshBuilder.CreateCylinder('fsk' + i, { diameterTop: 1.0, diameterBottom: 1.2, height: 4, tessellation: 10 }, scene);
    sk.position.set(i * 1.5, 6, -3); sk.material = metal; sk.parent = root;
  }
  return root;
}

export function makeBuilding() {
  const root = new BABYLON.TransformNode('building', scene);
  const wall = matOf(0.33, 0.28, 0.25);
  const dark = matOf(0.16, 0.16, 0.16);
  const win  = matOf(1.0, 0.80, 0.40);

  const tower = BABYLON.MeshBuilder.CreateBox('bt', { width: 4, height: 9, depth: 4 }, scene);
  tower.position.set(0, 4.5, 0); tower.material = wall; tower.parent = root;

  for (let floor = 0; floor < 4; floor++) {
    for (let col = -1; col <= 1; col++) {
      const w = BABYLON.MeshBuilder.CreateBox('bw' + floor + col, { width: 0.5, height: 0.6, depth: 0.05 }, scene);
      const wm = new BABYLON.StandardMaterial('wm', scene);
      wm.diffuseColor = new BABYLON.Color3(1.0, 0.80, 0.40);
      wm.emissiveColor = new BABYLON.Color3(0.5, 0.4, 0.2);
      w.material = wm;
      w.position.set(col * 1.0, 2.0 + floor * 2, -2.05);
      w.parent = root;
    }
  }

  const roof = BABYLON.MeshBuilder.CreateBox('broof', { width: 4.4, height: 0.4, depth: 4.4 }, scene);
  roof.position.set(0, 9.2, 0); roof.material = dark; roof.parent = root;

  const ant = BABYLON.MeshBuilder.CreateCylinder('bant', { diameter: 0.1, height: 3.5, tessellation: 5 }, scene);
  ant.position.set(0, 11.2, 0); ant.material = dark; ant.parent = root;

  return root;
}

export function makeConvoy() {
  const root = new BABYLON.TransformNode('convoy', scene);
  const cab = matOf(0.29, 0.31, 0.25);
  const bed = matOf(0.23, 0.25, 0.19);
  const tire = matOf(0.10, 0.10, 0.10);

  for (let i = 0; i < 5; i++) {
    const truck = new BABYLON.TransformNode('truck' + i, scene);
    truck.parent = root;
    truck.position.z = i * 4 - 8;

    const c = BABYLON.MeshBuilder.CreateBox('tc' + i, { width: 1.4, height: 1.2, depth: 1.0 }, scene);
    c.position.set(0, 0.95, -0.6); c.material = cab; c.parent = truck;

    const b = BABYLON.MeshBuilder.CreateBox('tb' + i, { width: 1.4, height: 1.1, depth: 1.8 }, scene);
    b.position.set(0, 0.9, 0.9); b.material = bed; b.parent = truck;

    for (const [tx, tz] of [[-0.65, -0.5], [0.65, -0.5], [-0.65, 1.4], [0.65, 1.4]]) {
      const w = BABYLON.MeshBuilder.CreateCylinder('tw', { diameter: 0.64, height: 0.22, tessellation: 8 }, scene);
      w.rotation.z = Math.PI / 2;
      w.position.set(tx, 0.32, tz);
      w.material = tire; w.parent = truck;
    }
  }
  return root;
}

export function makeAAGun() {
  const root = new BABYLON.TransformNode('aaGun', scene);
  const base = matOf(0.33, 0.29, 0.23);
  const turret = matOf(0.23, 0.23, 0.16);
  const barrel = matOf(0.13, 0.13, 0.13);

  const b = BABYLON.MeshBuilder.CreateCylinder('ab', { diameterTop: 2.4, diameterBottom: 2.8, height: 0.8, tessellation: 8 }, scene);
  b.position.set(0, 0.4, 0); b.material = base; b.parent = root;

  const t = BABYLON.MeshBuilder.CreateBox('at', { width: 1.0, height: 0.7, depth: 1.2 }, scene);
  t.position.set(0, 1.1, 0); t.material = turret; t.parent = root;

  const barrels = new BABYLON.TransformNode('aBarrels', scene);
  barrels.parent = root;
  barrels.position.set(0, 1.1, 0);
  for (const off of [-0.25, 0.25]) {
    const bar = BABYLON.MeshBuilder.CreateCylinder('bar' + off, { diameter: 0.16, height: 2.2, tessellation: 6 }, scene);
    bar.rotation.x = -Math.PI / 4;
    bar.position.set(off, 0.6, -0.8);
    bar.material = barrel; bar.parent = barrels;
  }
  root._barrelNode = barrels;
  return root;
}

export function makeWarship() {
  const root = new BABYLON.TransformNode('warship', scene);
  const hull = matOf(0.23, 0.25, 0.29);
  const sup  = matOf(0.29, 0.31, 0.38);
  const gun  = matOf(0.16, 0.19, 0.22);

  const hullM = BABYLON.MeshBuilder.CreateBox('wh', { width: 3.2, height: 1.0, depth: 9.0 }, scene);
  hullM.position.y = 0.5; hullM.material = hull; hullM.parent = root;

  const bridge = BABYLON.MeshBuilder.CreateBox('wb', { width: 2.2, height: 1.8, depth: 3.5 }, scene);
  bridge.position.set(0, 1.9, 0.5); bridge.material = sup; bridge.parent = root;

  const mast = BABYLON.MeshBuilder.CreateCylinder('wm', { diameterTop: 0.12, diameterBottom: 0.16, height: 4.5, tessellation: 6 }, scene);
  mast.position.set(0, 4.8, 0.5); mast.material = sup; mast.parent = root;

  const turret = BABYLON.MeshBuilder.CreateCylinder('wt', { diameterTop: 1.1, diameterBottom: 1.3, height: 0.8, tessellation: 8 }, scene);
  turret.position.set(0, 1.4, -2.5); turret.material = gun; turret.parent = root;

  return root;
}

const MAKERS = { base: makeBase, factory: makeFactory, building: makeBuilding, convoy: makeConvoy, aaGun: makeAAGun, warship: makeWarship };

// ─── Lifecycle ────────────────────────────────────────────────────────────────

export function spawnTarget(islandIdx, dx, dz, type, heightFn) {
  const def = TARGETS[type];
  const maker = MAKERS[type];
  if (!def || !maker) return null;

  let worldX, worldZ, yGround;

  if (islandIdx === -1) {
    worldX = dx; worldZ = dz;
    yGround = type === 'warship' ? 0.6 : 0;
  } else {
    const isl = game.islands[islandIdx];
    if (!isl) return null;
    const hFn = heightFn || islandHeightAt;
    yGround = hFn(isl, dx, dz);
    worldX = isl.cx + dx;
    worldZ = isl.cz + dz;
  }

  const mesh = maker();
  // TransformNode position
  mesh.position.set(worldX, yGround, worldZ);
  mesh.rotation.y = Math.random() * Math.PI * 2;

  const hpBonus = Math.floor((game.cycle - 1) * MISSION.HP_BONUS_PER_CYCLE);
  const aaSpeedup = Math.min(AA.MAX_SPEEDUP, (game.cycle - 1) * AA.CYCLE_SPEEDUP);

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
    path, pathIdx: 0,
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
  if (Math.random() < t.dropChance) spawnPickup(t.mesh.position.clone());
  game.score += t.score;
  game.kills += 1;
  game.targetsDestroyed += 1;
  // Remover todos os meshes filhos
  t.mesh.getChildMeshes().forEach(m => m.dispose());
  t.mesh.dispose();
}

const _aaDir = new BABYLON.Vector3();
const _aaOrig = new BABYLON.Vector3();
const _wsDir = new BABYLON.Vector2();

export function updateTargets(dt, jetPos) {
  for (let i = game.targets.length - 1; i >= 0; i--) {
    const t = game.targets[i];
    if (!t.dead && t.hp <= 0) killTarget(t);
    if (t.dead) { game.targets.splice(i, 1); continue; }
    if (t.type === 'aaGun') updateAAGun(t, dt, jetPos);
    if (t.type === 'warship') updateWarship(t, dt, jetPos);
  }
}

function updateAAGun(t, dt, jetPos) {
  const dist2 = BABYLON.Vector3.DistanceSquared(t.mesh.position, jetPos);
  if (dist2 > t.range * t.range) return;
  const dx = jetPos.x - t.mesh.position.x;
  const dz = jetPos.z - t.mesh.position.z;
  t.mesh.rotation.y = Math.atan2(dx, dz);
  t.fireTimer -= dt;
  if (t.fireTimer <= 0) {
    t.fireTimer = t.fireInterval + Math.random() * 0.4;
    _aaDir.copyFrom(jetPos).subtractInPlace(t.mesh.position).normalize();
    _aaOrig.copyFrom(t.mesh.position);
    _aaOrig.y += 1.8;
    _aaOrig.addInPlace(_aaDir.scale(1.2));
    spawnBullet(_aaOrig.clone(), _aaDir, true);
    audio.aaFire(t.mesh.position);
  }
}

function updateWarship(t, dt, jetPos) {
  if (!t.path || t.path.length === 0) return;
  const wp = t.path[t.pathIdx];
  _wsDir.set(wp[0] - t.mesh.position.x, wp[1] - t.mesh.position.z);
  if (_wsDir.length() < 8) {
    t.pathIdx = (t.pathIdx + 1) % t.path.length;
  } else {
    _wsDir.normalize().scaleInPlace(4 * dt);
    t.mesh.position.x += _wsDir.x;
    t.mesh.position.z += _wsDir.y;
    t.mesh.position.y = 0.6;
    t.mesh.rotation.y = Math.atan2(_wsDir.x, _wsDir.y);
  }
  const dist2 = BABYLON.Vector3.DistanceSquared(t.mesh.position, jetPos);
  if (dist2 > t.range * t.range) return;
  t.fireTimer -= dt;
  if (t.fireTimer <= 0) {
    t.fireTimer = t.fireInterval + Math.random() * 0.6;
    _aaDir.copyFrom(jetPos).subtractInPlace(t.mesh.position).normalize();
    _aaOrig.copyFrom(t.mesh.position);
    _aaOrig.y += 2.2;
    _aaOrig.addInPlace(_aaDir.scale(2.0));
    spawnBullet(_aaOrig.clone(), _aaDir, true);
    audio.aaFire(t.mesh.position);
  }
}

export function clearTargets() {
  for (const t of game.targets) {
    if (t.mesh) {
      t.mesh.getChildMeshes().forEach(m => m.dispose());
      t.mesh.dispose();
    }
  }
  game.targets.length = 0;
}
