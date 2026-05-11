// fx.js — Efeitos visuais: partículas, debris, fumaça de explosão, shockwaves, flashes.
// Exporta: explosion, megaExplosion, spawnShockwave, spawnMuzzleFlash, spawnFlash,
//   spawnMissileSmoke, updateParticles, scheduleDelayed.
// Para adicionar efeito novo: crie pool + função spawnXxx + chame em updateParticles.
//
// Fumaça de chaminé de fábrica está em factory-fx.js (pool separado, 30 slots).
// explosionSmokePool (50 slots) — exclusivo deste módulo, nunca mistura com chaminés.

import * as THREE from '../../vendor/three.module.min.js';
import { scene } from './scene.js';
import { audio } from './audio.js';
import { COLORS } from './config.js';

const PART_GEOM   = new THREE.SphereGeometry(0.3, 6, 6);
const DEBRIS_GEOM = new THREE.BoxGeometry(0.4, 0.4, 0.4);
const SMOKE_GEOM  = new THREE.SphereGeometry(1.0, 6, 5);
const SHOCK_GEOM  = new THREE.RingGeometry(0.85, 1.0, 32);
SHOCK_GEOM.rotateX(-Math.PI / 2);

// Pools ativos + livres
const particles = [], particlePool = [];
const debrisItems = [], debrisPool = [];
const explosionSmoke = [], explosionSmokePool = [];   // fumaça de explosão — 50 slots, exclusivo de spawnExplosion
const smokeTrail = [], smokeTrailPool = [];   // trilha de míssil (small, fast fade)
const sparks = [], sparksPool = [];           // faíscas amarelas brilhantes (curtíssimas)
const shockwaves = [], flashes = [];

// Timers diferidos (substituem setTimeout — atualizados pelo loop)
const delayedCallbacks = [];

// Pools maiores para suportar megaExplosões 4x (até 3 explosões simultâneas + chained)
for (let i = 0; i < 250; i++) {
  const m = new THREE.Mesh(PART_GEOM, new THREE.MeshBasicMaterial({ color: COLORS.fireOrange, transparent: true, opacity: 1 }));
  m.visible = false; scene.add(m); particlePool.push(m);
}
for (let i = 0; i < 150; i++) {
  const m = new THREE.Mesh(DEBRIS_GEOM, new THREE.MeshBasicMaterial({ color: COLORS.debrisDark }));
  m.visible = false; scene.add(m); debrisPool.push(m);
}
for (let i = 0; i < 50; i++) {  // explosionSmokePool: 50 slots — exclusivo de spawnExplosion
  const m = new THREE.Mesh(SMOKE_GEOM, new THREE.MeshBasicMaterial({ color: COLORS.smokeGrey, transparent: true, opacity: 0.7 }));
  m.visible = false; scene.add(m); explosionSmokePool.push(m);
}
// Sparks: pequeninas esferas amarelo-branco brilhantes, vida muito curta, alta velocidade
const SPARK_GEOM = new THREE.SphereGeometry(0.12, 5, 4);
for (let i = 0; i < 100; i++) {
  const m = new THREE.Mesh(SPARK_GEOM, new THREE.MeshBasicMaterial({ color: 0xffffaa, transparent: true, opacity: 1 }));
  m.visible = false; scene.add(m); sparksPool.push(m);
}
// Trilha de míssil: pequena, vida curta, fade rápido — dimensionada para 100+ partículas
for (let i = 0; i < 120; i++) {
  const m = new THREE.Mesh(SMOKE_GEOM, new THREE.MeshBasicMaterial({ color: 0xeeeeee, transparent: true, opacity: 0.55 }));
  m.visible = false; scene.add(m); smokeTrailPool.push(m);
}

// ─── Nuclear FX pools (HEADLESS guard) ───────────────────────────────────────
const HEADLESS_FX = typeof navigator !== 'undefined' && navigator.webdriver === true;

const nucStemPool = [];
const mushroomPool = [];

if (!HEADLESS_FX) {
  const nucStemMat = new THREE.MeshBasicMaterial({ color: 0x886655, transparent: true, opacity: 0.8 });
  for (let i = 0; i < 80; i++) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(2.0, 6, 5), nucStemMat.clone());
    m.visible = false;
    scene.add(m);
    nucStemPool.push({ mesh: m, life: 0, vel: new THREE.Vector3() });
  }

  const mushroomMat = new THREE.MeshBasicMaterial({ color: 0x998877, transparent: true, opacity: 0.75 });
  for (let i = 0; i < 60; i++) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(4.0, 8, 6), mushroomMat.clone());
    m.visible = false;
    scene.add(m);
    mushroomPool.push({ mesh: m, life: 0, vel: new THREE.Vector3() });
  }
}

function spawnMushroomCap(pos) {
  for (let i = 0; i < mushroomPool.length; i++) {
    const p = mushroomPool[i];
    if (p.life > 0) continue;
    const angle = Math.random() * Math.PI * 2;
    const r = Math.random() * 70;
    p.mesh.position.set(pos.x + Math.cos(angle) * r, pos.y + (Math.random() - 0.5) * 20, pos.z + Math.sin(angle) * r);
    const s = 3 + Math.random() * 5;
    p.mesh.scale.setScalar(s);
    p.mesh.material.opacity = 0.75;
    p.vel.set((Math.cos(angle) * r * 0.05), 1 + Math.random() * 2, (Math.sin(angle) * r * 0.05));
    p.life = 5.0 + Math.random() * 2;
    p.mesh.visible = true;
  }
}

/** Explosão nuclear com efeitos multi-camada: flash, fireball, stem, mushroom cap, shockwaves. */
export function nuclearExplosion(pos) {
  if (HEADLESS_FX) {
    // Em headless: apenas efeitos leves
    explosion(pos, 5, COLORS.fireYellow);
    spawnShockwave(pos, 200, 0xffeeaa);
    return;
  }

  // t=0: flash + fireball
  spawnFlash(pos, 40);
  explosion(pos, 20);
  spawnShockwave(pos, 200, 0xffeeaa);

  // t=150ms: stem (partículas subindo)
  scheduleDelayed(0.15, () => {
    for (let i = 0; i < nucStemPool.length; i++) {
      const p = nucStemPool[i];
      if (p.life > 0) continue;
      const angle = Math.random() * Math.PI * 2;
      const r = Math.random() * 15;
      p.mesh.position.set(pos.x + Math.cos(angle) * r, pos.y + Math.random() * 30, pos.z + Math.sin(angle) * r);
      p.mesh.scale.setScalar(1 + Math.random() * 2.5);
      p.mesh.material.opacity = 0.75;
      p.vel.set((Math.random() - 0.5) * 3, 20 + Math.random() * 35, (Math.random() - 0.5) * 3);
      p.life = 3.0 + Math.random() * 2.5;
      p.mesh.visible = true;
    }
  });

  // t=400ms: mushroom cap
  scheduleDelayed(0.4, () => {
    const capPos = new THREE.Vector3(pos.x, pos.y + 200, pos.z);
    spawnMushroomCap(capPos);
  });

  // t=600ms: outer shockwave
  scheduleDelayed(0.6, () => {
    spawnShockwave(pos, 350, 0xddccaa);
  });

  // t=800ms–4s: secondary explosions chain
  for (let i = 0; i < 10; i++) {
    scheduleDelayed(0.8 + Math.random() * 3.2, () => {
      const ox = (Math.random() - 0.5) * 300;
      const oz = (Math.random() - 0.5) * 300;
      explosion(new THREE.Vector3(pos.x + ox, pos.y, pos.z + oz), 3 + Math.random() * 5);
    });
  }
}

/** Explosão pequena/média. @param {THREE.Vector3} pos @param {number} scale @param {number} color */
export function explosion(pos, scale = 1, color = COLORS.fireOrange) {
  const pn = Math.floor(22 * scale);
  for (let i = 0; i < pn; i++) {
    const m = particlePool.pop(); if (!m) break;
    m.material.color.setHex(color);
    m.material.opacity = 1;
    m.position.copy(pos);
    // Tamanho varia: maioria pequena, alguns grandes (fireball core)
    const initScale = 0.7 + Math.random() * 1.5;
    m.scale.setScalar(initScale);
    m.visible = true;
    particles.push({
      mesh: m,
      vx: (Math.random() - 0.5) * 16 * scale,
      vy: (Math.random() - 0.3) * 14 * scale + 1,
      vz: (Math.random() - 0.5) * 16 * scale,
      life: 0.9 + Math.random() * 0.4,
      max: 1.3,
      initScale,
      growth: 1.8 + Math.random() * 0.8,
    });
  }
  const dn = Math.floor(8 * scale);
  for (let i = 0; i < dn; i++) {
    const m = debrisPool.pop(); if (!m) break;
    m.position.copy(pos);
    m.rotation.set(Math.random() * Math.PI * 2, Math.random() * Math.PI * 2, Math.random() * Math.PI * 2);
    m.scale.setScalar(0.8 + Math.random() * 1.5);
    m.visible = true;
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
    const m = explosionSmokePool.pop(); if (!m) break;  // draws from explosionSmokePool only
    m.material.opacity = 0.75;
    m.material.color.setHex(COLORS.smokeGrey);
    m.position.copy(pos);
    m.position.x += (Math.random() - 0.5) * 3;
    m.position.z += (Math.random() - 0.5) * 3;
    m.scale.setScalar(1);
    m.visible = true;
    explosionSmoke.push({
      mesh: m,
      vx: (Math.random() - 0.5) * 2,
      vy: 1.6 + Math.random() * 2.0,
      vz: (Math.random() - 0.5) * 2,
      life: 2.6 + Math.random() * 0.8,
      max: 3.6,
      maxScale: 3.0 + Math.random() * 3.0,
    });
  }
  // Sparks brilhantes (apenas se scale>=1 — em mini explosões fica feio)
  if (scale >= 0.9) {
    const sparkN = Math.floor(14 * scale);
    for (let i = 0; i < sparkN; i++) {
      const m = sparksPool.pop(); if (!m) break;
      m.material.opacity = 1;
      m.position.copy(pos);
      m.scale.setScalar(1);
      m.visible = true;
      sparks.push({
        mesh: m,
        vx: (Math.random() - 0.5) * 38 * scale,
        vy: Math.random() * 28 * scale + 6,
        vz: (Math.random() - 0.5) * 38 * scale,
        life: 0.35 + Math.random() * 0.3,
        max: 0.65,
      });
    }
  }
}

export function spawnShockwave(pos, maxR, color = COLORS.shockwave) {
  const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.85, side: THREE.DoubleSide });
  const m = new THREE.Mesh(SHOCK_GEOM, mat);
  m.position.copy(pos); m.position.y = Math.max(pos.y, 0.5);
  scene.add(m);
  shockwaves.push({ mesh: m, mat, life: 0.6, max: 0.6, maxR });
}

/** Flash curto de cano do canhão (0.07s). */
export function spawnMuzzleFlash(pos) {
  const mat = new THREE.MeshBasicMaterial({ color: 0xffeebb, transparent: true, opacity: 1 });
  const m = new THREE.Mesh(new THREE.SphereGeometry(0.4, 8, 6), mat);
  m.position.copy(pos);
  scene.add(m);
  flashes.push({ mesh: m, mat, life: 0.07, max: 0.07 });
}

export function spawnFlash(pos, scale = 4) {
  const mat = new THREE.MeshBasicMaterial({ color: COLORS.flash, transparent: true, opacity: 1 });
  const m = new THREE.Mesh(new THREE.SphereGeometry(scale, 12, 10), mat);
  m.position.copy(pos);
  scene.add(m);
  flashes.push({ mesh: m, mat, life: 0.18, max: 0.18 });
}

/** Mega-explosão épica multi-camada. 4× maior que v2; 3 ondas coloridas + 3-5 sub-pops.
 *  @param {THREE.Vector3} pos @param {'target'|'crash'} kind */
export function megaExplosion(pos, kind = 'target') {
  const big = kind === 'crash';
  // Scale 4x maior do que v2: target 2.0 → 5.0, crash 3.2 → 7.0
  const sc = big ? 7.0 : 5.0;
  const p = pos.clone();
  const fireColors = [COLORS.flameYellow, COLORS.fireOrange, COLORS.fireRed];

  // t=0: flash branco enorme + fireball amarelo + shockwave gigante
  spawnFlash(p, big ? 18 : 12);
  explosion(p, sc, fireColors[0]);
  spawnShockwave(p, big ? 95 : 70);
  // t+0.10s: expansão laranja
  scheduleDelayed(0.10, () => explosion(p, sc * 0.85, fireColors[1]));
  // t+0.18s: segunda shockwave (anel duplo)
  scheduleDelayed(0.18, () => spawnShockwave(p, big ? 70 : 50, COLORS.shockwaveSecondary));
  // t+0.22s: onda vermelha (contraste, fim do fireball)
  scheduleDelayed(0.22, () => explosion(p, sc * 0.65, fireColors[2]));
  // 3-5 sub-pops nos arredores em 0.3-1.1s (chained explosions)
  const subPops = big ? 5 : 3;
  for (let i = 0; i < subPops; i++) {
    const dx = (Math.random() - 0.5) * 16;
    const dy = Math.random() * 8;
    const dz = (Math.random() - 0.5) * 16;
    const color = fireColors[Math.floor(Math.random() * fireColors.length)];
    scheduleDelayed(0.3 + Math.random() * 0.8, () => {
      const subPos = p.clone();
      subPos.x += dx; subPos.y += dy; subPos.z += dz;
      explosion(subPos, sc * 0.35, color);
    });
  }
  audio.megaExplosion(p);
}

/** Emite uma puff de trilha de míssil na posição dada. */
export function spawnMissileSmoke(pos) {
  const m = smokeTrailPool.pop(); if (!m) return;
  m.material.opacity = 0.55;
  m.material.color.setHex(0xdddddd);
  m.position.copy(pos);
  m.scale.setScalar(0.35);
  m.visible = true;
  smokeTrail.push({
    mesh: m,
    vx: (Math.random() - 0.5) * 0.4,
    vy: (Math.random() - 0.5) * 0.4,
    vz: (Math.random() - 0.5) * 0.4,
    life: 0.7, max: 0.7, maxScale: 2.5,
  });
}

/** Atualiza todas as partículas e efeitos. @param {number} dt segundos */
export function updateParticles(dt) {
  // Partículas — agora com initScale e growth variáveis
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i]; p.life -= dt;
    p.mesh.position.x += p.vx * dt;
    p.mesh.position.y += p.vy * dt;
    p.mesh.position.z += p.vz * dt;
    p.vy -= 6 * dt;
    const t = p.life / p.max;
    p.mesh.material.opacity = Math.max(0, t);
    const s = (p.initScale ?? 1) + (1 - t) * (p.growth ?? 1.5);
    p.mesh.scale.setScalar(s);
    if (p.life <= 0) { p.mesh.visible = false; particlePool.push(p.mesh); particles.splice(i, 1); }
  }
  // Sparks: vida curta, leve gravidade, fade rápido
  for (let i = sparks.length - 1; i >= 0; i--) {
    const s = sparks[i]; s.life -= dt;
    s.mesh.position.x += s.vx * dt;
    s.mesh.position.y += s.vy * dt;
    s.mesh.position.z += s.vz * dt;
    s.vy -= 18 * dt;
    const t = s.life / s.max;
    s.mesh.material.opacity = Math.max(0, t);
    if (s.life <= 0) { s.mesh.visible = false; sparksPool.push(s.mesh); sparks.splice(i, 1); }
  }
  // Debris
  for (let i = debrisItems.length - 1; i >= 0; i--) {
    const d = debrisItems[i]; d.life -= dt;
    d.mesh.position.x += d.vx * dt;
    d.mesh.position.y += d.vy * dt;
    d.mesh.position.z += d.vz * dt;
    d.vy -= 18 * dt;
    d.mesh.rotation.x += d.rx * dt;
    d.mesh.rotation.y += d.ry * dt;
    d.mesh.rotation.z += d.rz * dt;
    if (d.mesh.position.y < 0.4 || d.life <= 0) {
      d.mesh.visible = false; debrisPool.push(d.mesh); debrisItems.splice(i, 1);
    }
  }
  // Fumaça de explosão — retorna ao explosionSmokePool ao expirar
  for (let i = explosionSmoke.length - 1; i >= 0; i--) {
    const s = explosionSmoke[i]; s.life -= dt;
    s.mesh.position.x += s.vx * dt;
    s.mesh.position.y += s.vy * dt;
    s.mesh.position.z += s.vz * dt;
    s.vy *= 0.98;
    const t = s.life / s.max;
    s.mesh.material.opacity = Math.max(0, t * 0.7);
    const sc = 1 + (1 - t) * s.maxScale;
    s.mesh.scale.setScalar(sc);
    if (s.life <= 0) { s.mesh.visible = false; explosionSmokePool.push(s.mesh); explosionSmoke.splice(i, 1); }
  }
  // Trilha de míssil
  for (let i = smokeTrail.length - 1; i >= 0; i--) {
    const s = smokeTrail[i]; s.life -= dt;
    s.mesh.position.x += s.vx * dt;
    s.mesh.position.y += s.vy * dt;
    s.mesh.position.z += s.vz * dt;
    const t = s.life / s.max;
    s.mesh.material.opacity = Math.max(0, t * 0.55);
    const sc = 0.35 + (1 - t) * s.maxScale;
    s.mesh.scale.setScalar(sc);
    if (s.life <= 0) { s.mesh.visible = false; smokeTrailPool.push(s.mesh); smokeTrail.splice(i, 1); }
  }
  // Shockwaves
  for (let i = shockwaves.length - 1; i >= 0; i--) {
    const sw = shockwaves[i]; sw.life -= dt;
    const t = sw.life / sw.max;
    const r = (1 - t) * sw.maxR;
    sw.mesh.scale.set(r, 1, r);
    sw.mat.opacity = t * 0.85;
    if (sw.life <= 0) { scene.remove(sw.mesh); sw.mat.dispose(); shockwaves.splice(i, 1); }
  }
  // Flashes
  for (let i = flashes.length - 1; i >= 0; i--) {
    const f = flashes[i]; f.life -= dt;
    const t = f.life / f.max;
    f.mesh.scale.setScalar(1 + (1 - t) * 8);
    f.mat.opacity = Math.max(0, t);
    if (f.life <= 0) { scene.remove(f.mesh); f.mat.dispose(); flashes.splice(i, 1); }
  }
  // Nuclear stem update
  for (const p of nucStemPool) {
    if (p.life <= 0) continue;
    p.life -= dt;
    p.mesh.position.addScaledVector(p.vel, dt);
    p.vel.y *= 0.98; // decelerate upward
    if (p.life <= 0) { p.mesh.visible = false; } else {
      p.mesh.material.opacity = Math.min(0.8, p.life * 0.3);
    }
  }
  // Mushroom cap update
  for (const p of mushroomPool) {
    if (p.life <= 0) continue;
    p.life -= dt;
    p.mesh.position.addScaledVector(p.vel, dt);
    const s = p.mesh.scale.x + dt * 0.5;
    p.mesh.scale.setScalar(Math.min(s, 15));
    if (p.life <= 0) { p.mesh.visible = false; } else {
      p.mesh.material.opacity = Math.min(0.75, p.life * 0.15);
    }
  }
  // Callbacks diferidos (substitui setTimeout)
  for (let i = delayedCallbacks.length - 1; i >= 0; i--) {
    const c = delayedCallbacks[i]; c.t -= dt;
    if (c.t <= 0) { c.fn(); delayedCallbacks.splice(i, 1); }
  }
}

/** Agenda um callback para rodar após N segundos. Substitui setTimeout (controlado pelo loop). */
export function scheduleDelayed(seconds, fn) {
  delayedCallbacks.push({ t: seconds, fn });
}
