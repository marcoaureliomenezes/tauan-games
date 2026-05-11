// fx.js — Efeitos visuais com ParticleSystem nativo do Babylon.js.
// Exporta: explosion, megaExplosion, spawnShockwave, spawnMuzzleFlash, spawnMissileSmoke,
//   updateParticles, scheduleDelayed.

/* global BABYLON */

import { scene } from './scene.js';
import { audio } from './audio.js';
import { COLORS } from './config.js';

// ─── Pool de particulas simples (usando meshes, identico ao Three.js) ─────────
const particles = [], particlePool = [];
const debrisItems = [], debrisPool = [];
const explosionSmoke = [], explosionSmokePool = [];
const smokeTrail = [], smokeTrailPool = [];
const sparks = [], sparksPool = [];
const shockwaves = [], flashes = [];
const delayedCallbacks = [];

// Pre-alocar meshes
const PART_MAT = new BABYLON.StandardMaterial('partMat', scene);
PART_MAT.diffuseColor = COLORS.fireOrange.clone();
PART_MAT.emissiveColor = COLORS.fireOrange.clone();
PART_MAT.disableLighting = true;

const SMOKE_MAT = new BABYLON.StandardMaterial('smokeMat', scene);
SMOKE_MAT.diffuseColor = COLORS.smokeGrey.clone();
SMOKE_MAT.emissiveColor = COLORS.smokeGrey.clone();
SMOKE_MAT.disableLighting = true;
SMOKE_MAT.alpha = 0.7;

for (let i = 0; i < 250; i++) {
  const m = BABYLON.MeshBuilder.CreateSphere('p' + i, { diameter: 0.6, segments: 4 }, scene);
  const mat = new BABYLON.StandardMaterial('pm' + i, scene);
  mat.disableLighting = true;
  mat.diffuseColor = COLORS.fireOrange.clone();
  mat.emissiveColor = COLORS.fireOrange.clone();
  m.material = mat;
  m.setEnabled(false);
  particlePool.push(m);
}
for (let i = 0; i < 150; i++) {
  const m = BABYLON.MeshBuilder.CreateBox('d' + i, { size: 0.4 }, scene);
  const mat = new BABYLON.StandardMaterial('dm' + i, scene);
  mat.disableLighting = true;
  mat.diffuseColor = COLORS.debrisDark.clone();
  mat.emissiveColor = COLORS.debrisDark.clone();
  m.material = mat;
  m.setEnabled(false);
  debrisPool.push(m);
}
for (let i = 0; i < 50; i++) {
  const m = BABYLON.MeshBuilder.CreateSphere('s' + i, { diameter: 2.0, segments: 4 }, scene);
  const mat = new BABYLON.StandardMaterial('sm' + i, scene);
  mat.disableLighting = true;
  mat.diffuseColor = COLORS.smokeGrey.clone();
  mat.emissiveColor = COLORS.smokeGrey.clone();
  mat.alpha = 0.7;
  m.material = mat;
  m.setEnabled(false);
  explosionSmokePool.push(m);
}
for (let i = 0; i < 100; i++) {
  const m = BABYLON.MeshBuilder.CreateSphere('sp' + i, { diameter: 0.24, segments: 4 }, scene);
  const mat = new BABYLON.StandardMaterial('spm' + i, scene);
  mat.disableLighting = true;
  mat.diffuseColor = new BABYLON.Color3(1, 1, 0.67);
  mat.emissiveColor = new BABYLON.Color3(1, 1, 0.67);
  m.material = mat;
  m.setEnabled(false);
  sparksPool.push(m);
}
for (let i = 0; i < 120; i++) {
  const m = BABYLON.MeshBuilder.CreateSphere('st' + i, { diameter: 2.0, segments: 4 }, scene);
  const mat = new BABYLON.StandardMaterial('stm' + i, scene);
  mat.disableLighting = true;
  mat.diffuseColor = new BABYLON.Color3(0.93, 0.93, 0.93);
  mat.emissiveColor = new BABYLON.Color3(0.93, 0.93, 0.93);
  mat.alpha = 0.55;
  m.material = mat;
  m.setEnabled(false);
  smokeTrailPool.push(m);
}

// ─── Explosion ────────────────────────────────────────────────────────────────
export function explosion(pos, scale, color) {
  scale = scale !== undefined ? scale : 1;
  color = color !== undefined ? color : COLORS.fireOrange;
  const pn = Math.floor(22 * scale);
  for (let i = 0; i < pn; i++) {
    const m = particlePool.pop(); if (!m) break;
    m.material.diffuseColor.copyFrom(color);
    m.material.emissiveColor.copyFrom(color);
    m.material.alpha = 1;
    m.position.copyFrom(pos);
    const initScale = 0.7 + Math.random() * 1.5;
    m.scaling.setAll(initScale);
    m.setEnabled(true);
    particles.push({
      mesh: m, mat: m.material,
      vx: (Math.random() - 0.5) * 16 * scale,
      vy: (Math.random() - 0.3) * 14 * scale + 1,
      vz: (Math.random() - 0.5) * 16 * scale,
      life: 0.9 + Math.random() * 0.4, max: 1.3,
      initScale, growth: 1.8 + Math.random() * 0.8,
    });
  }
  const dn = Math.floor(8 * scale);
  for (let i = 0; i < dn; i++) {
    const m = debrisPool.pop(); if (!m) break;
    m.position.copyFrom(pos);
    m.rotation.set(Math.random() * Math.PI * 2, Math.random() * Math.PI * 2, Math.random() * Math.PI * 2);
    m.scaling.setAll(0.8 + Math.random() * 1.5);
    m.setEnabled(true);
    debrisItems.push({
      mesh: m,
      vx: (Math.random() - 0.5) * 22 * scale,
      vy: Math.random() * 14 * scale + 4,
      vz: (Math.random() - 0.5) * 22 * scale,
      rx: (Math.random() - 0.5) * 10,
      ry: (Math.random() - 0.5) * 10,
      rz: (Math.random() - 0.5) * 10,
      life: 1.8,
    });
  }
  const sn = Math.floor(6 * scale);
  for (let i = 0; i < sn; i++) {
    const m = explosionSmokePool.pop(); if (!m) break;
    m.material.alpha = 0.75;
    m.position.copyFrom(pos);
    m.position.x += (Math.random() - 0.5) * 3;
    m.position.z += (Math.random() - 0.5) * 3;
    m.scaling.setAll(1);
    m.setEnabled(true);
    explosionSmoke.push({
      mesh: m, mat: m.material,
      vx: (Math.random() - 0.5) * 2,
      vy: 1.6 + Math.random() * 2.0,
      vz: (Math.random() - 0.5) * 2,
      life: 2.6 + Math.random() * 0.8, max: 3.6,
      maxScale: 3.0 + Math.random() * 3.0,
    });
  }
  if (scale >= 0.9) {
    const sparkN = Math.floor(14 * scale);
    for (let i = 0; i < sparkN; i++) {
      const m = sparksPool.pop(); if (!m) break;
      m.material.alpha = 1;
      m.position.copyFrom(pos);
      m.scaling.setAll(1);
      m.setEnabled(true);
      sparks.push({
        mesh: m, mat: m.material,
        vx: (Math.random() - 0.5) * 38 * scale,
        vy: Math.random() * 28 * scale + 6,
        vz: (Math.random() - 0.5) * 38 * scale,
        life: 0.35 + Math.random() * 0.3, max: 0.65,
      });
    }
  }
}

export function spawnShockwave(pos, maxR, color) {
  maxR = maxR !== undefined ? maxR : 50;
  const disc = BABYLON.MeshBuilder.CreateDisc('sw', { radius: 1, tessellation: 32 }, scene);
  disc.rotation.x = Math.PI / 2;
  disc.position.copyFrom(pos);
  disc.position.y = Math.max(pos.y, 0.5);
  const mat = new BABYLON.StandardMaterial('swm', scene);
  mat.disableLighting = true;
  mat.diffuseColor = new BABYLON.Color3(1.0, 0.93, 0.67);
  mat.emissiveColor = new BABYLON.Color3(1.0, 0.93, 0.67);
  mat.alpha = 0.85;
  mat.backFaceCulling = false;
  disc.material = mat;
  shockwaves.push({ mesh: disc, mat, life: 0.6, max: 0.6, maxR });
}

export function spawnMuzzleFlash(pos) {
  const m = BABYLON.MeshBuilder.CreateSphere('mf', { diameter: 0.8, segments: 6 }, scene);
  m.position.copyFrom(pos);
  const mat = new BABYLON.StandardMaterial('mfm', scene);
  mat.disableLighting = true;
  mat.diffuseColor = new BABYLON.Color3(1.0, 0.93, 0.73);
  mat.emissiveColor = new BABYLON.Color3(1.0, 0.93, 0.73);
  mat.alpha = 1;
  m.material = mat;
  flashes.push({ mesh: m, mat, life: 0.07, max: 0.07 });
}

export function spawnFlash(pos, scale) {
  scale = scale !== undefined ? scale : 4;
  const m = BABYLON.MeshBuilder.CreateSphere('fl', { diameter: scale * 2, segments: 8 }, scene);
  m.position.copyFrom(pos);
  const mat = new BABYLON.StandardMaterial('flm', scene);
  mat.disableLighting = true;
  mat.diffuseColor = new BABYLON.Color3(1.0, 1.0, 1.0);
  mat.emissiveColor = new BABYLON.Color3(1.0, 1.0, 1.0);
  mat.alpha = 1;
  m.material = mat;
  flashes.push({ mesh: m, mat, life: 0.18, max: 0.18 });
}

export function megaExplosion(pos, kind) {
  kind = kind !== undefined ? kind : 'target';
  const big = kind === 'crash';
  const sc = big ? 7.0 : 5.0;
  const p = pos.clone();
  spawnFlash(p, big ? 18 : 12);
  explosion(p, sc, COLORS.flameYellow);
  spawnShockwave(p, big ? 95 : 70);
  scheduleDelayed(0.10, () => explosion(p, sc * 0.85, COLORS.fireOrange));
  scheduleDelayed(0.18, () => spawnShockwave(p, big ? 70 : 50));
  scheduleDelayed(0.22, () => explosion(p, sc * 0.65, COLORS.fireRed));
  const subPops = big ? 5 : 3;
  const fireColors = [COLORS.flameYellow, COLORS.fireOrange, COLORS.fireRed];
  for (let i = 0; i < subPops; i++) {
    const dx = (Math.random() - 0.5) * 16;
    const dy = Math.random() * 8;
    const dz = (Math.random() - 0.5) * 16;
    const col = fireColors[Math.floor(Math.random() * fireColors.length)];
    scheduleDelayed(0.3 + Math.random() * 0.8, () => {
      const sp = p.clone();
      sp.x += dx; sp.y += dy; sp.z += dz;
      explosion(sp, sc * 0.35, col);
    });
  }
  audio.megaExplosion(p);
}

export function spawnMissileSmoke(pos) {
  const m = smokeTrailPool.pop(); if (!m) return;
  m.material.alpha = 0.55;
  m.position.copyFrom(pos);
  m.scaling.setAll(0.35);
  m.setEnabled(true);
  smokeTrail.push({
    mesh: m, mat: m.material,
    vx: (Math.random() - 0.5) * 0.4,
    vy: (Math.random() - 0.5) * 0.4,
    vz: (Math.random() - 0.5) * 0.4,
    life: 0.7, max: 0.7, maxScale: 2.5,
  });
}

export function updateParticles(dt) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i]; p.life -= dt;
    p.mesh.position.x += p.vx * dt;
    p.mesh.position.y += p.vy * dt;
    p.mesh.position.z += p.vz * dt;
    p.vy -= 6 * dt;
    const t = p.life / p.max;
    p.mat.alpha = Math.max(0, t);
    const s = (p.initScale || 1) + (1 - t) * (p.growth || 1.5);
    p.mesh.scaling.setAll(s);
    if (p.life <= 0) { p.mesh.setEnabled(false); particlePool.push(p.mesh); particles.splice(i, 1); }
  }
  for (let i = sparks.length - 1; i >= 0; i--) {
    const s = sparks[i]; s.life -= dt;
    s.mesh.position.x += s.vx * dt;
    s.mesh.position.y += s.vy * dt;
    s.mesh.position.z += s.vz * dt;
    s.vy -= 18 * dt;
    const t = s.life / s.max;
    s.mat.alpha = Math.max(0, t);
    if (s.life <= 0) { s.mesh.setEnabled(false); sparksPool.push(s.mesh); sparks.splice(i, 1); }
  }
  for (let i = debrisItems.length - 1; i >= 0; i--) {
    const d = debrisItems[i]; d.life -= dt;
    d.mesh.position.x += d.vx * dt;
    d.mesh.position.y += d.vy * dt;
    d.mesh.position.z += d.vz * dt;
    d.vy -= 18 * dt;
    d.mesh.rotation.x += d.rx * dt;
    d.mesh.rotation.y += d.ry * dt;
    d.mesh.rotation.z += d.rz * dt;
    if (d.mesh.position.y < 0.4 || d.life <= 0) { d.mesh.setEnabled(false); debrisPool.push(d.mesh); debrisItems.splice(i, 1); }
  }
  for (let i = explosionSmoke.length - 1; i >= 0; i--) {
    const s = explosionSmoke[i]; s.life -= dt;
    s.mesh.position.x += s.vx * dt;
    s.mesh.position.y += s.vy * dt;
    s.mesh.position.z += s.vz * dt;
    s.vy *= 0.98;
    const t = s.life / s.max;
    s.mat.alpha = Math.max(0, t * 0.7);
    const sc = 1 + (1 - t) * s.maxScale;
    s.mesh.scaling.setAll(sc);
    if (s.life <= 0) { s.mesh.setEnabled(false); explosionSmokePool.push(s.mesh); explosionSmoke.splice(i, 1); }
  }
  for (let i = smokeTrail.length - 1; i >= 0; i--) {
    const s = smokeTrail[i]; s.life -= dt;
    s.mesh.position.x += s.vx * dt;
    s.mesh.position.y += s.vy * dt;
    s.mesh.position.z += s.vz * dt;
    const t = s.life / s.max;
    s.mat.alpha = Math.max(0, t * 0.55);
    const sc = 0.35 + (1 - t) * s.maxScale;
    s.mesh.scaling.setAll(sc);
    if (s.life <= 0) { s.mesh.setEnabled(false); smokeTrailPool.push(s.mesh); smokeTrail.splice(i, 1); }
  }
  for (let i = shockwaves.length - 1; i >= 0; i--) {
    const sw = shockwaves[i]; sw.life -= dt;
    const t = sw.life / sw.max;
    const r = (1 - t) * sw.maxR;
    sw.mesh.scaling.set(r, r, 1);
    sw.mat.alpha = t * 0.85;
    if (sw.life <= 0) { sw.mesh.dispose(); shockwaves.splice(i, 1); }
  }
  for (let i = flashes.length - 1; i >= 0; i--) {
    const f = flashes[i]; f.life -= dt;
    const t = f.life / f.max;
    f.mesh.scaling.setAll(1 + (1 - t) * 8);
    f.mat.alpha = Math.max(0, t);
    if (f.life <= 0) { f.mesh.dispose(); flashes.splice(i, 1); }
  }
  for (let i = delayedCallbacks.length - 1; i >= 0; i--) {
    const c = delayedCallbacks[i]; c.t -= dt;
    if (c.t <= 0) { c.fn(); delayedCallbacks.splice(i, 1); }
  }
}

export function scheduleDelayed(seconds, fn) {
  delayedCallbacks.push({ t: seconds, fn });
}
