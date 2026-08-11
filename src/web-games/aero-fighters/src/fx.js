// fx.js — Efeitos visuais: partículas, debris, fumaça, shockwaves, flashes, nuclear.
// Exporta: explosion, megaExplosion, spawnShockwave, spawnMuzzleFlash, spawnFlash,
//   spawnMissileSmoke, spawnDustPuff, nuclearExplosion, updateParticles, scheduleDelayed,
//   spawnFallTrail, spawnSmokeColumn, spawnShedDebris, clearFallFx (T-D-10).

import * as THREE from '../../vendor/three.module.min.js';
import { scene } from './scene.js';
import { audio } from './audio.js';
import { COLORS } from './config.js';

// ─── Geometrias compartilhadas ────────────────────────────────────────────────
const PART_GEOM      = new THREE.SphereGeometry(0.3, 6, 6);
const DEBRIS_GEOM    = new THREE.BoxGeometry(0.6, 0.6, 0.6);   // ligeiramente maior
const SMOKE_GEOM     = new THREE.SphereGeometry(1.0, 6, 5);
const FIRE_GLOW_GEOM = new THREE.SphereGeometry(1.5, 6, 5);    // coluna de fogo duradoura
const SPARK_GEOM     = new THREE.SphereGeometry(0.12, 5, 4);
const SHOCK_GEOM     = new THREE.RingGeometry(0.7, 1.0, 48);   // anel mais espesso
SHOCK_GEOM.rotateX(-Math.PI / 2);

// ─── Arrays de partículas ativas + pools livres ───────────────────────────────
const particles     = [], particlePool     = [];
const debrisItems   = [], debrisPool       = [];
const explosionSmoke= [], explosionSmokePool = [];
const smokeTrail    = [], smokeTrailPool   = [];
const sparks        = [], sparksPool       = [];
const fireGlowItems = [], fireGlowPool     = [];   // coluna de fogo sustentada
const shockwaves    = [], flashes          = [];
const scorchMarks   = [];   // cicatrizes de impacto/cratera (WS-5/WS-6)

// Timers diferidos (substitui setTimeout — sincronizados com o game loop)
const delayedCallbacks = [];

// ─── Inicialização dos pools ──────────────────────────────────────────────────
// Fire balls — AdditiveBlending: partículas somam luz, criando fireball brilhante
for (let i = 0; i < 300; i++) {
  const m = new THREE.Mesh(PART_GEOM, new THREE.MeshBasicMaterial({
    color: COLORS.fireOrange, transparent: true, opacity: 1,
    blending: THREE.AdditiveBlending, depthWrite: false,
  }));
  m.visible = false; scene.add(m); particlePool.push(m);
}

// Debris / estilhaços
for (let i = 0; i < 150; i++) {
  const m = new THREE.Mesh(DEBRIS_GEOM, new THREE.MeshBasicMaterial({ color: COLORS.debrisDark }));
  m.visible = false; scene.add(m); debrisPool.push(m);
}

// Fumaça de explosão — pool exclusivo, não mistura com fábricas
for (let i = 0; i < 80; i++) {
  const m = new THREE.Mesh(SMOKE_GEOM, new THREE.MeshBasicMaterial({
    color: 0x1a1a1a, transparent: true, opacity: 0.85,
  }));
  m.visible = false; scene.add(m); explosionSmokePool.push(m);
}

// Sparks brilhantes — AdditiveBlending para efeito elétrico/faísca
for (let i = 0; i < 100; i++) {
  const m = new THREE.Mesh(SPARK_GEOM, new THREE.MeshBasicMaterial({
    color: 0xffffaa, transparent: true, opacity: 1,
    blending: THREE.AdditiveBlending, depthWrite: false,
  }));
  m.visible = false; scene.add(m); sparksPool.push(m);
}

// Trilha de míssil
for (let i = 0; i < 120; i++) {
  const m = new THREE.Mesh(SMOKE_GEOM, new THREE.MeshBasicMaterial({
    color: 0xeeeeee, transparent: true, opacity: 0.55,
  }));
  m.visible = false; scene.add(m); smokeTrailPool.push(m);
}

// Colunas de fogo sustentadas — AdditiveBlending, vida longa (2.5–4s)
for (let i = 0; i < 100; i++) {
  const m = new THREE.Mesh(FIRE_GLOW_GEOM, new THREE.MeshBasicMaterial({
    color: 0xff5500, transparent: true, opacity: 0.9,
    blending: THREE.AdditiveBlending, depthWrite: false,
  }));
  m.visible = false; scene.add(m); fireGlowPool.push(m);
}

// ─── T-D-10 (inhauma-defense-v1): pool PRÓPRIO da queda cinematográfica ─────
// Fumaça preta densa + fogo da trilha do caça caindo e a coluna persistente
// pós-impacto. Pool separado do explosionSmokePool (SPEC: não roubar o das
// explosões) — bounded: 150 puffs de fumaça + 70 de fogo.
const fallSmoke = [], fallSmokePool = [];
const fallFire = [], fallFirePool = [];
for (let i = 0; i < 150; i++) {
  const m = new THREE.Mesh(SMOKE_GEOM, new THREE.MeshBasicMaterial({
    color: 0x0d0d0d, transparent: true, opacity: 0.9,
  }));
  m.visible = false; scene.add(m); fallSmokePool.push(m);
}
for (let i = 0; i < 70; i++) {
  const m = new THREE.Mesh(PART_GEOM, new THREE.MeshBasicMaterial({
    color: 0xff7722, transparent: true, opacity: 0.95,
    blending: THREE.AdditiveBlending, depthWrite: false,
  }));
  m.visible = false; scene.add(m); fallFirePool.push(m);
}

// ─── Nuclear FX pools (HEADLESS guard) ───────────────────────────────────────
const HEADLESS_FX = typeof navigator !== 'undefined' && navigator.webdriver === true;

const nucStemPool   = [];
const mushroomPool  = [];

if (!HEADLESS_FX) {
  // Stem do cogumelo: 120 partículas marrom-acinzentadas subindo
  const nucStemMat = new THREE.MeshBasicMaterial({ color: 0x886655, transparent: true, opacity: 0.85 });
  for (let i = 0; i < 120; i++) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(2.5, 6, 5), nucStemMat.clone());
    m.visible = false; scene.add(m);
    nucStemPool.push({ mesh: m, life: 0, vel: new THREE.Vector3() });
  }

  // Cap do cogumelo: 100 partículas grandes, espalham para fora
  const mushroomMat = new THREE.MeshBasicMaterial({ color: 0xaa9977, transparent: true, opacity: 0.85 });
  for (let i = 0; i < 100; i++) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(6.0, 8, 6), mushroomMat.clone());
    m.visible = false; scene.add(m);
    mushroomPool.push({ mesh: m, life: 0, vel: new THREE.Vector3() });
  }
}

// ─── Funções internas ─────────────────────────────────────────────────────────

// Spawns one band of the mushroom cap using a dedicated pool slice.
// band 0 = inner core (idx 0-19), band 1 = main ring (idx 20-69), band 2 = outer anvil (idx 70-99)
function spawnMushroomCap(pos, band) {
  // [startIdx, endIdx, rMin, rMax, yMin, yMax, vrMin, vrMax, vyMin, vyMax, scMin, scMax, lifeMin, lifeRange]
  const cfg = [
    [  0,  20,   0,  35, -15, 15,  0.5,  2.0,  1.0,  3.0,  5, 12,  7,  4],
    [ 20,  70,  35, 110, -25, 25,  3.0,  8.0,  0.5,  2.0,  6, 15,  8,  4],
    [ 70, 100, 110, 180, -10, 10,  8.0, 14.0, -1.0,  0.5,  7, 18,  9,  4],
  ][band];
  const [si, ei, rMin, rMax, yMin, yMax, vrMin, vrMax, vyMin, vyMax, scMin, scMax, lifeMin, lifeRange] = cfg;
  for (let i = si; i < ei; i++) {
    const p = mushroomPool[i];
    if (p.life > 0) continue;
    const angle = Math.random() * Math.PI * 2;
    const r = rMin + Math.random() * (rMax - rMin);
    p.mesh.position.set(
      pos.x + Math.cos(angle) * r,
      pos.y + yMin + Math.random() * (yMax - yMin),
      pos.z + Math.sin(angle) * r,
    );
    p.mesh.scale.setScalar(scMin + Math.random() * (scMax - scMin));
    p.mesh.material.opacity = 0.88;
    const vr = vrMin + Math.random() * (vrMax - vrMin);
    const vy = vyMin + Math.random() * (vyMax - vyMin);
    p.vel.set(Math.cos(angle) * vr, vy, Math.sin(angle) * vr);
    p.life = lifeMin + Math.random() * lifeRange;
    p.mesh.visible = true;
  }
}

/** Flash DOM branco de detonação nuclear (usa CSS transition). */
function triggerNukeFlash() {
  if (typeof document === 'undefined') return;
  const el = document.getElementById('nuke-flash');
  if (!el) return;
  el.style.transition = 'none';
  el.style.opacity = '1';
  scheduleDelayed(0.08, () => {
    el.style.transition = 'opacity 2.5s ease-out';
    el.style.opacity = '0';
  });
}

// ─── API pública ──────────────────────────────────────────────────────────────

/** Explosão nuclear com efeitos multi-camada: flash de tela, fireball, stem, mushroom cap, shockwaves. */
export function nuclearExplosion(pos) {
  if (HEADLESS_FX) {
    explosion(pos, 5, COLORS.fireYellow);
    spawnShockwave(pos, 200, 0xffeeaa);
    return;
  }

  // t=0: PRIMEIRO flash branco de tela + core branco-quente na origem + fireball enorme
  triggerNukeFlash();
  spawnFlash(pos, 50);
  explosion(pos, 28, COLORS.fireYellow);  // era scale 20
  spawnShockwave(pos, 280, 0xffffff);      // anel branco de pressão
  const groundPos = pos.clone(); groundPos.y = 0.5;
  spawnShockwave(groundPos, 320, 0xffdd88); // anel ras do chão

  // D-9: SEGUNDO flash ~0.12-0.18s depois — a assinatura de dupla detonação térmica
  // de uma nuke real (um pulso brevíssimo, um breve vale, e um segundo pulso mais
  // largo). Retrigger de #nuke-flash (triggerNukeFlash) + um segundo core branco.
  scheduleDelayed(0.15, () => {
    triggerNukeFlash();
    spawnFlash(pos, 38);
  });

  // t=80ms: bola de fogo laranja
  scheduleDelayed(0.08, () => {
    explosion(pos, 18, COLORS.fireOrange);
  });

  // t=150–600ms: stem (coluna subindo) — 4 lotes escalonados de 30 partículas cada
  // WS-5: o talo (stem) e o cogumelo PERSISTENTES são desenhados pela pluma MESH em
  // nuclear-fx.js (dura ~60 s), não mais por partículas aqui — evita cogumelo duplicado.

  // t=300ms: anel de shockwave médio + explosão laranja secundária
  scheduleDelayed(0.3, () => {
    explosion(pos, 15, COLORS.fireOrange);
    spawnShockwave(pos, 480, 0xffeeaa);
  });

  // WS-5: o mushroom cap persistente é a pluma MESH (nuclear-fx.js), não partículas.

  // t=700ms: anel externo final
  scheduleDelayed(0.7, () => {
    spawnShockwave(pos, 700, 0xddccaa);  // era 350
  });

  // t=800ms–3s: poucas explosões secundárias PERTO do epicentro — o espetáculo
  // é o cogumelo subindo, não pipoco aleatório espalhado (aceite do operador).
  for (let i = 0; i < 7; i++) {
    const delay = 0.8 + (i / 7) * 2.0 + Math.random() * 0.3;
    scheduleDelayed(delay, () => {
      const ox = (Math.random() - 0.5) * 220;
      const oz = (Math.random() - 0.5) * 220;
      const sc = 3 + Math.random() * 6;
      explosion(new THREE.Vector3(pos.x + ox, Math.max(pos.y, 0), pos.z + oz), sc, COLORS.fireOrange);
    });
  }
}

/** Explosão pequena/média com fogo glowing, fumaça animada e coluna duradoura.
 *  @param {THREE.Vector3} pos @param {number} scale @param {number} color */
export function explosion(pos, scale = 1, color = COLORS.fireOrange) {
  // Fire balls (additive — brilham juntas)
  const pn = Math.floor(22 * scale);
  for (let i = 0; i < pn; i++) {
    const m = particlePool.pop(); if (!m) break;
    m.material.color.setHex(color);
    m.material.opacity = 1;
    m.position.copy(pos);
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

  // Colunas de fogo sustentadas (fireGlow) — sobem devagar, duram 2.5–4s
  const gn = Math.floor(8 * scale);
  for (let i = 0; i < gn; i++) {
    const m = fireGlowPool.pop(); if (!m) break;
    m.material.opacity = 0.9;
    m.position.set(
      pos.x + (Math.random() - 0.5) * 4 * scale,
      pos.y + Math.random() * 2,
      pos.z + (Math.random() - 0.5) * 4 * scale,
    );
    const initS = 0.5 + Math.random() * 1.0;
    m.scale.setScalar(initS);
    m.visible = true;
    const maxLife = 2.5 + Math.random() * 1.5;
    fireGlowItems.push({
      mesh: m,
      vx: (Math.random() - 0.5) * 3 * scale,
      vy: 3 + Math.random() * 5,
      vz: (Math.random() - 0.5) * 3 * scale,
      life: maxLife,
      max: maxLife,
      initScale: initS,
      maxScale: 2.5 + Math.random() * 2.0,
    });
  }

  // Debris / estilhaços
  const dn = Math.floor(8 * scale);
  for (let i = 0; i < dn; i++) {
    const m = debrisPool.pop(); if (!m) break;
    m.position.copy(pos);
    m.rotation.set(Math.random() * Math.PI * 2, Math.random() * Math.PI * 2, Math.random() * Math.PI * 2);
    m.scale.setScalar(0.8 + Math.random() * 1.5);
    m.visible = true;
    debrisItems.push({
      mesh: m,
      vx: (Math.random() - 0.5) * 24 * scale,
      vy: Math.random() * 16 * scale + 4,
      vz: (Math.random() - 0.5) * 24 * scale,
      rx: (Math.random() - 0.5) * 10,
      ry: (Math.random() - 0.5) * 10,
      rz: (Math.random() - 0.5) * 10,
      life: 1.8,
    });
  }

  // Fumaça — começa escura (fuligem), clareia com o tempo
  const sn = Math.floor(10 * scale);  // era 6
  for (let i = 0; i < sn; i++) {
    const m = explosionSmokePool.pop(); if (!m) break;
    m.material.color.setHex(0x111111);   // inicia quase preta
    m.material.opacity = 0.9;
    m.position.copy(pos);
    m.position.x += (Math.random() - 0.5) * 4;
    m.position.z += (Math.random() - 0.5) * 4;
    m.scale.setScalar(1);
    m.visible = true;
    const maxLife = 3.0 + Math.random() * 1.5;
    explosionSmoke.push({
      mesh: m,
      vx: (Math.random() - 0.5) * 2,
      vy: 1.6 + Math.random() * 2.0,
      vz: (Math.random() - 0.5) * 2,
      life: maxLife,
      max: maxLife,
      maxScale: 4.0 + Math.random() * 4.0,
    });
  }

  // Sparks (additive — brilho elétrico)
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

  // Anel no chão (apenas quando a explosão ocorre perto do solo)
  if (pos.y < 20) {
    const gndPos = pos.clone(); gndPos.y = 0.2;
    spawnShockwave(gndPos, scale * 18, 0xffcc44);
  }
}

/** Cicatriz queimada no chão (crash de terra, cratera nuclear). Persiste ~90 s. */
export function spawnScorchMark(pos, radius = 12, opacity = 0.55) {
  const geo = new THREE.CircleGeometry(radius, 24);
  geo.rotateX(-Math.PI / 2);
  const mat = new THREE.MeshBasicMaterial({
    color: 0x0c0a08, transparent: true, opacity,
    depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
  });
  const m = new THREE.Mesh(geo, mat);
  m.position.set(pos.x, Math.max(pos.y, 0) + 0.18, pos.z);
  scene.add(m);
  scorchMarks.push({ mesh: m, mat, life: 90, max: 90, baseOpacity: opacity });
}

/** Splash de impacto na água (WS-5): coluna de spray + anel de espuma — sem fireball. */
export function spawnWaterSplash(pos) {
  const p0 = pos.clone(); p0.y = 0.6;
  spawnShockwave(p0, 46, 0xe8f6ff);
  spawnShockwave(p0, 24, 0xffffff);
  const sprayN = 46;
  for (let i = 0; i < sprayN; i++) {
    const m = particlePool.pop(); if (!m) break;
    m.material.color.setHex(0xd8eeff);
    m.material.opacity = 0.95;
    m.position.set(pos.x + (Math.random() - 0.5) * 5, 0.6, pos.z + (Math.random() - 0.5) * 5);
    const initScale = 0.5 + Math.random() * 1.2;
    m.scale.setScalar(initScale);
    m.visible = true;
    particles.push({
      mesh: m,
      vx: (Math.random() - 0.5) * 10,
      vy: 9 + Math.random() * 16,
      vz: (Math.random() - 0.5) * 10,
      life: 0.8 + Math.random() * 0.5,
      max: 1.3,
      initScale,
      growth: 1.2 + Math.random() * 0.6,
    });
  }
}

export function spawnShockwave(pos, maxR, color = COLORS.shockwave) {
  const mat = new THREE.MeshBasicMaterial({
    color, transparent: true, opacity: 0.9,
    side: THREE.DoubleSide, depthWrite: false,   // evita z-fighting com oceano
  });
  const m = new THREE.Mesh(SHOCK_GEOM, mat);
  m.position.copy(pos);
  m.position.y = Math.max(pos.y, 0.5);
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
  flashes.push({ mesh: m, mat, life: 0.22, max: 0.22 });
}

/** Mega-explosão épica multi-camada para alvos grandes e crash do jato. */
export function megaExplosion(pos, kind = 'target') {
  const big = kind === 'crash';
  const sc = big ? 7.0 : 5.0;
  const p = pos.clone();
  const fireColors = [COLORS.flameYellow, COLORS.fireOrange, COLORS.fireRed];

  spawnFlash(p, big ? 18 : 12);
  explosion(p, sc, fireColors[0]);
  spawnShockwave(p, big ? 95 : 70);
  scheduleDelayed(0.10, () => explosion(p, sc * 0.85, fireColors[1]));
  scheduleDelayed(0.18, () => spawnShockwave(p, big ? 70 : 50, COLORS.shockwaveSecondary));
  scheduleDelayed(0.22, () => explosion(p, sc * 0.65, fireColors[2]));
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

/** T-D-04 (inhauma-defense-v1): puff de poeira do impacto da .50 no terreno.
 *  Reusa o smokeTrailPool (mesmo update), só com cor de poeira e vida curta. */
export function spawnDustPuff(pos) {
  const m = smokeTrailPool.pop(); if (!m) return;
  m.material.opacity = 0.5;
  m.material.color.setHex(0x9a8a68);
  m.position.copy(pos);
  m.scale.setScalar(0.35);
  m.visible = true;
  smokeTrail.push({
    mesh: m,
    vx: (Math.random() - 0.5) * 1.4,
    vy: 1.2 + Math.random() * 1.2,
    vz: (Math.random() - 0.5) * 1.4,
    life: 0.5, max: 0.5, maxScale: 2.2,
  });
}

/** Emite uma puff de trilha de míssil na posição dada.
 *  T-W-07 (weapons-v1): opts {life, opacity, scale, maxScale} — default =
 *  contrato anterior (0,7 s). A bateria da defesa usa ~1 s discreto. */
export function spawnMissileSmoke(pos, opts = {}) {
  const m = smokeTrailPool.pop(); if (!m) return;
  const life = opts.life ?? 0.7;
  m.material.opacity = opts.opacity ?? 0.55;
  m.material.color.setHex(0xdddddd);
  m.position.copy(pos);
  m.scale.setScalar(opts.scale ?? 0.35);
  m.visible = true;
  smokeTrail.push({
    mesh: m,
    vx: (Math.random() - 0.5) * 0.4,
    vy: (Math.random() - 0.5) * 0.4,
    vz: (Math.random() - 0.5) * 0.4,
    life, max: life, maxScale: opts.maxScale ?? 2.5,
  });
}

/** T-D-10: um passo da trilha densa do caça caindo — fumaça preta + fogo.
 *  Pool PRÓPRIO (não toca explosionSmoke/smokeTrail). */
export function spawnFallTrail(pos) {
  const s = fallSmokePool.pop();
  if (s) {
    s.material.opacity = 0.9;
    s.position.set(
      pos.x + (Math.random() - 0.5) * 1.8,
      pos.y + (Math.random() - 0.5) * 1.8,
      pos.z + (Math.random() - 0.5) * 1.8,
    );
    s.scale.setScalar(1.2 + Math.random() * 0.9);
    s.visible = true;
    fallSmoke.push({
      mesh: s,
      vx: (Math.random() - 0.5) * 1.2, vy: 1.0 + Math.random() * 1.0, vz: (Math.random() - 0.5) * 1.2,
      life: 2.6, max: 2.6,
    });
  }
  const f = fallFirePool.pop();
  if (f) {
    f.material.opacity = 0.95;
    f.position.copy(pos);
    f.scale.setScalar(0.8 + Math.random() * 0.7);
    f.visible = true;
    fallFire.push({
      mesh: f,
      vx: (Math.random() - 0.5) * 2.0, vy: 0.6, vz: (Math.random() - 0.5) * 2.0,
      life: 0.45, max: 0.45,
    });
  }
}

/** T-D-10: coluna de fumaça persistente no ponto de impacto (~20 s). */
export function spawnSmokeColumn(pos, seconds = 20) {
  for (let i = 0; i < 9; i++) {
    const s = fallSmokePool.pop(); if (!s) break;
    const life = seconds * (0.7 + Math.random() * 0.45);
    s.material.opacity = 0.8;
    s.position.set(
      pos.x + (Math.random() - 0.5) * 6,
      pos.y + 1 + i * 2.2 + Math.random() * 2,
      pos.z + (Math.random() - 0.5) * 6,
    );
    s.scale.setScalar(1.6 + Math.random() * 1.2);
    s.visible = true;
    fallSmoke.push({
      mesh: s,
      vx: (Math.random() - 0.5) * 0.8, vy: 2.2 + Math.random() * 1.4, vz: (Math.random() - 0.5) * 0.8,
      life, max: life,
    });
  }
}

/** T-D-10: debris se soltando do caça em queda — reusa o debrisPool das
 *  explosões (caixas com gravidade), herdando parte da velocidade do caça. */
export function spawnShedDebris(pos, vel) {
  const n = 2 + Math.floor(Math.random() * 2);
  for (let i = 0; i < n; i++) {
    const m = debrisPool.pop(); if (!m) break;
    m.position.set(
      pos.x + (Math.random() - 0.5) * 2.5,
      pos.y + (Math.random() - 0.5) * 2.5,
      pos.z + (Math.random() - 0.5) * 2.5,
    );
    m.rotation.set(Math.random() * 6.28, Math.random() * 6.28, Math.random() * 6.28);
    m.scale.setScalar(0.7 + Math.random() * 1.2);
    m.visible = true;
    debrisItems.push({
      mesh: m,
      vx: vel.x * 0.55 + (Math.random() - 0.5) * 18,
      vy: vel.y * 0.4 + Math.random() * 8,
      vz: vel.z * 0.55 + (Math.random() - 0.5) * 18,
      rx: (Math.random() - 0.5) * 12, ry: (Math.random() - 0.5) * 12, rz: (Math.random() - 0.5) * 12,
      life: 2.6,
    });
  }
}

/** T-D-10: recolhe as partículas ativas da queda (dispose/restart do modo). */
export function clearFallFx() {
  for (const s of fallSmoke) { s.mesh.visible = false; fallSmokePool.push(s.mesh); }
  fallSmoke.length = 0;
  for (const f of fallFire) { f.mesh.visible = false; fallFirePool.push(f.mesh); }
  fallFire.length = 0;
}

/** Atualiza todas as partículas e efeitos.
 * @param {number} dt segundos
 * @param {THREE.Vector3|null} playerPos posição do jogador para fade de distância */
export function updateParticles(dt, playerPos = null) {
  // Fire balls (additive) — fade por distância para evitar ghost de fog+additive
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i]; p.life -= dt;
    p.mesh.position.x += p.vx * dt;
    p.mesh.position.y += p.vy * dt;
    p.mesh.position.z += p.vz * dt;
    p.vy -= 6 * dt;
    const t = p.life / p.max;
    const dfade = playerPos
      ? Math.max(0, 1.0 - Math.max(0, p.mesh.position.distanceTo(playerPos) - 400) / 250)
      : 1.0;
    p.mesh.material.opacity = Math.max(0, t) * dfade;
    const s = (p.initScale ?? 1) + (1 - t) * (p.growth ?? 1.5);
    p.mesh.scale.setScalar(s);
    if (p.life <= 0) { p.mesh.visible = false; particlePool.push(p.mesh); particles.splice(i, 1); }
  }

  // Colunas de fogo sustentadas (fireGlow) — crescem e depois murcham; fade por distância
  for (let i = fireGlowItems.length - 1; i >= 0; i--) {
    const g = fireGlowItems[i]; g.life -= dt;
    g.mesh.position.x += g.vx * dt;
    g.mesh.position.y += g.vy * dt;
    g.mesh.position.z += g.vz * dt;
    g.vy *= 0.985;
    const t = g.life / g.max;
    // cresce até metade da vida depois reduz
    const growPhase = t > 0.5 ? (1 - t) * 2 : 1.0;
    const s = g.initScale + growPhase * g.maxScale;
    g.mesh.scale.setScalar(s);
    const dfade = playerPos
      ? Math.max(0, 1.0 - Math.max(0, g.mesh.position.distanceTo(playerPos) - 400) / 250)
      : 1.0;
    g.mesh.material.opacity = Math.max(0, t * 0.9) * dfade;
    if (g.life <= 0) { g.mesh.visible = false; fireGlowPool.push(g.mesh); fireGlowItems.splice(i, 1); }
  }

  // Sparks (additive) — fade por distância
  for (let i = sparks.length - 1; i >= 0; i--) {
    const s = sparks[i]; s.life -= dt;
    s.mesh.position.x += s.vx * dt;
    s.mesh.position.y += s.vy * dt;
    s.mesh.position.z += s.vz * dt;
    s.vy -= 18 * dt;
    const t = s.life / s.max;
    const dfade = playerPos
      ? Math.max(0, 1.0 - Math.max(0, s.mesh.position.distanceTo(playerPos) - 400) / 250)
      : 1.0;
    s.mesh.material.opacity = Math.max(0, t) * dfade;
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

  // Fumaça — começa preta (fuligem), clareia para cinza claro conforme dissipa
  for (let i = explosionSmoke.length - 1; i >= 0; i--) {
    const s = explosionSmoke[i]; s.life -= dt;
    s.mesh.position.x += s.vx * dt;
    s.mesh.position.y += s.vy * dt;
    s.mesh.position.z += s.vz * dt;
    s.vy *= 0.98;
    const t = s.life / s.max;
    s.mesh.material.opacity = Math.max(0, t * 0.75);
    // Transição de cor: preto → cinza escuro → cinza claro
    if (t > 0.65)      s.mesh.material.color.setHex(0x111111);
    else if (t > 0.35) s.mesh.material.color.setHex(0x555555);
    else               s.mesh.material.color.setHex(0x999999);
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
    s.mesh.scale.setScalar(0.35 + (1 - t) * s.maxScale);
    if (s.life <= 0) { s.mesh.visible = false; smokeTrailPool.push(s.mesh); smokeTrail.splice(i, 1); }
  }

  // T-D-10: fumaça preta da queda/coluna — sobe devagar e expande
  for (let i = fallSmoke.length - 1; i >= 0; i--) {
    const s = fallSmoke[i]; s.life -= dt;
    s.mesh.position.x += s.vx * dt;
    s.mesh.position.y += s.vy * dt;
    s.mesh.position.z += s.vz * dt;
    const t = s.life / s.max;
    s.mesh.material.opacity = Math.max(0, t * 0.85);
    s.mesh.scale.setScalar(s.mesh.scale.x + dt * 1.6);
    if (s.life <= 0) { s.mesh.visible = false; fallSmokePool.push(s.mesh); fallSmoke.splice(i, 1); }
  }

  // T-D-10: fogo da trilha da queda — vida curta, encolhe e apaga
  for (let i = fallFire.length - 1; i >= 0; i--) {
    const f = fallFire[i]; f.life -= dt;
    f.mesh.position.x += f.vx * dt;
    f.mesh.position.y += f.vy * dt;
    f.mesh.position.z += f.vz * dt;
    const t = f.life / f.max;
    f.mesh.material.opacity = Math.max(0, t * 0.95);
    f.mesh.scale.setScalar(0.4 + t * 0.9);
    if (f.life <= 0) { f.mesh.visible = false; fallFirePool.push(f.mesh); fallFire.splice(i, 1); }
  }

  // Shockwaves — expande e desvane
  for (let i = shockwaves.length - 1; i >= 0; i--) {
    const sw = shockwaves[i]; sw.life -= dt;
    const t = sw.life / sw.max;
    const r = (1 - t) * sw.maxR;
    sw.mesh.scale.set(r, 1, r);
    sw.mat.opacity = t * 0.9;
    if (sw.life <= 0) { scene.remove(sw.mesh); sw.mat.dispose(); shockwaves.splice(i, 1); }
  }

  // Cicatrizes — opacidade constante, fade nos últimos 20 s
  for (let i = scorchMarks.length - 1; i >= 0; i--) {
    const sm = scorchMarks[i]; sm.life -= dt;
    if (sm.life < 20) sm.mat.opacity = sm.baseOpacity * (sm.life / 20);
    if (sm.life <= 0) { scene.remove(sm.mesh); sm.mat.dispose(); scorchMarks.splice(i, 1); }
  }

  // Flashes
  for (let i = flashes.length - 1; i >= 0; i--) {
    const f = flashes[i]; f.life -= dt;
    const t = f.life / f.max;
    f.mesh.scale.setScalar(1 + (1 - t) * 8);
    f.mat.opacity = Math.max(0, t);
    if (f.life <= 0) { scene.remove(f.mesh); f.mat.dispose(); flashes.splice(i, 1); }
  }

  // Nuclear stem — sobe e desacelera
  for (const p of nucStemPool) {
    if (p.life <= 0) continue;
    p.life -= dt;
    p.mesh.position.addScaledVector(p.vel, dt);
    p.vel.y *= 0.975;  // era 0.98 — decai mais suave
    p.vel.x *= 0.995;
    p.vel.z *= 0.995;
    p.mesh.material.opacity = p.life <= 0 ? 0 : Math.min(0.85, p.life * 0.25);
    if (p.life <= 0) p.mesh.visible = false;
  }

  // Mushroom cap — expande e sobe lentamente
  for (const p of mushroomPool) {
    if (p.life <= 0) continue;
    p.life -= dt;
    p.mesh.position.addScaledVector(p.vel, dt);
    p.vel.y *= 0.99;
    const s = p.mesh.scale.x + dt * 0.8;  // era 0.5 — cresce mais rápido
    p.mesh.scale.setScalar(Math.min(s, 22));  // era 15
    p.mesh.material.opacity = p.life <= 0 ? 0 : Math.min(0.85, p.life * 0.12);  // era 0.15
    if (p.life <= 0) p.mesh.visible = false;
  }

  // Callbacks diferidos
  for (let i = delayedCallbacks.length - 1; i >= 0; i--) {
    const c = delayedCallbacks[i]; c.t -= dt;
    if (c.t <= 0) { c.fn(); delayedCallbacks.splice(i, 1); }
  }
}

/** Agenda um callback para rodar após N segundos. Substitui setTimeout (controlado pelo loop). */
export function scheduleDelayed(seconds, fn) {
  delayedCallbacks.push({ t: seconds, fn });
}

// ─── T-D-09/10 (inhauma-defense-v1): builders de mesh do modo defesa ────────
// Movidos de defense-mode.js na Onda D4 — o orquestrador do modo precisava
// encolher (SPEC: módulos novos em src/defense/ ≤250 linhas; a lógica pura
// ficou em defense-director.js/enemy-fighters.js e estes builders de
// primitivas, 100% visuais, vivem com os demais FX). defense-mode só consome.

/** Bateria AA (base + pedestal + armas intercambiáveis + sacos de areia) — jogador
 *  e baterias aliadas. userData.barrel = pivô de pitch do gimbal (e "cano caído").
 *  userData.barrelMg = cano longo da .50; userData.barrelAa = tubo do lançador.
 *  Upgrade (operador 2026-07-19): escudo de proteção REDUZIDO e deslocado (antes
 *  um quadrado tapando a visão); cano longo para ver os tracers saírem; na troca
 *  de arma o cano ativo gira 90° para o lado e o outro entra (animado no modo). */
export function makeDefenseBatteryMesh() {
  const g = new THREE.Group();
  const metal = new THREE.MeshLambertMaterial({ color: 0x3a4034 });
  const dark = new THREE.MeshLambertMaterial({ color: 0x242822 });
  const base = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.6, 0.6, 10), dark);
  base.position.y = 0.3;
  g.add(base);
  const pedestal = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.75, 1.0, 8), metal);
  pedestal.position.y = 1.1;
  g.add(pedestal);

  // SEM chapa de proteção (operador 2026-07-19: "tire o quadrado metálico, deixe
  // só o cano da arma") — a visão do horizonte fica 100% livre.

  const barrel = new THREE.Group(); // pivô de pitch (userData.barrel)
  barrel.position.y = 1.7;

  // ── Cano longo da .50 (atira de verdade da boca — muzzle em z ≈ -6.1) ──
  const mg = new THREE.Group();
  const breech = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.45, 1.0), dark);
  breech.position.set(0, 0, 0.5);
  mg.add(breech);
  const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, 6.0, 8), metal);
  tube.rotation.x = Math.PI / 2; // aponta -Z (forward do gimbal)
  tube.position.z = -2.6;
  mg.add(tube);
  const brake = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.5, 8), dark);
  brake.rotation.x = Math.PI / 2;
  brake.position.z = -5.55;
  mg.add(brake);
  barrel.add(mg);

  // ── Tubo do lançador AA (grosso, com trilhos — muzzle em z ≈ -3.6) ──
  const aa = new THREE.Group();
  const aaTube = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.34, 3.6, 10), dark);
  aaTube.rotation.x = Math.PI / 2;
  aaTube.position.z = -1.6;
  aa.add(aaTube);
  for (const sx of [-0.42, 0.42]) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 3.2), metal);
    rail.position.set(sx, 0.3, -1.5);
    aa.add(rail);
  }
  const aaRear = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.7, 0.9), metal);
  aaRear.position.set(0, 0, 0.6);
  aa.add(aaRear);
  barrel.add(aa);

  g.add(barrel);
  g.userData.barrel = barrel;
  g.userData.barrelMg = mg;
  g.userData.barrelAa = aa;
  const sand = new THREE.MeshLambertMaterial({ color: 0x8a7a58 });
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const bag = new THREE.Mesh(new THREE.SphereGeometry(0.55, 6, 5), sand);
    bag.scale.y = 0.55;
    bag.position.set(Math.cos(a) * 3.1, 0.28, Math.sin(a) * 3.1);
    g.add(bag);
  }
  return g;
}

/** Caça inimigo (vermelho-escuro): fuselagem, nariz, asas em flecha, canopy,
 *  deriva dupla, exaustão quente e beacon. Nariz em -Z (convenção forward).
 *  Adaptado de ally-war.js#_buildEnemyFighter. */
export function makeEnemyFighterMesh() {
  const g = new THREE.Group();
  const body = new THREE.MeshLambertMaterial({ color: 0x6a1f1f });
  const dark = new THREE.MeshLambertMaterial({ color: 0x431414 });
  const glow = new THREE.MeshBasicMaterial({ color: 0xff5530 });
  const glass = new THREE.MeshLambertMaterial({ color: 0x181c26 });
  const fuse = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.55, 4.4), body);
  g.add(fuse);
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.4, 1.4, 6), dark);
  nose.rotation.x = -Math.PI / 2; nose.position.set(0, 0, -2.8); g.add(nose);
  const canopy = new THREE.Mesh(new THREE.SphereGeometry(0.34, 6, 5), glass);
  canopy.scale.set(0.8, 0.6, 1.6); canopy.position.set(0, 0.36, -0.9); g.add(canopy);
  for (const sx of [-1, 1]) { // asas em flecha — lê como caça a 400+ m
    const wing = new THREE.Mesh(new THREE.BoxGeometry(3.8, 0.08, 1.5), dark);
    wing.position.set(sx * 2.4, -0.05, 0.55);
    wing.rotation.y = -sx * 0.42; g.add(wing);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.75, 0.65), dark);
    tail.position.set(sx * 0.42, 0.38, 1.9); tail.rotation.z = sx * 0.55; g.add(tail);
  }
  const exh = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.26, 0.45, 8), glow);
  exh.rotation.x = Math.PI / 2; exh.position.set(0, 0, 2.35); g.add(exh);
  const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.16, 6, 5), glow);
  beacon.position.set(0, 0.62, 1.9); g.add(beacon);
  g.scale.setScalar(2.0); // ~15 m de envergadura — visível do chão
  return g;
}

const AG_BODY_MAT = new THREE.MeshLambertMaterial({ color: 0x5a2020 });
const AG_FLAME_MAT = new THREE.MeshBasicMaterial({ color: 0xffcc66 });
// T-W-07: glow aditivo da chama de propulsão noturna (compartilhado)
const AG_NIGHT_GLOW_GEOM = new THREE.SphereGeometry(0.6, 6, 6);
const AG_NIGHT_GLOW_MAT = new THREE.MeshBasicMaterial({
  color: 0xffaa33, transparent: true, opacity: 0.85,
  blending: THREE.AdditiveBlending, depthWrite: false,
});
const ENEMY_TRACER_MAT = new THREE.MeshBasicMaterial({ color: 0xff6040 });
const ALLY_TRACER_MAT = new THREE.MeshBasicMaterial({ color: 0x9fe0ff });
const TRACER_GEOM = new THREE.CylinderGeometry(0.09, 0.09, 2.6, 5);
TRACER_GEOM.rotateX(Math.PI / 2);
// Tracers aliados mais longos/grossos — "tracers cruzando o céu" legíveis do
// morro a 300-600 m (regime visual da SPEC).
const ALLY_TRACER_GEOM = new THREE.CylinderGeometry(0.14, 0.14, 9.0, 5);
ALLY_TRACER_GEOM.rotateX(Math.PI / 2);

/** Mesh do míssil ar-solo (corpo + nariz + chama) — inimigo e aliado. */
export function makeAgMissileMesh() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 1.4, 6), AG_BODY_MAT);
  body.rotation.x = Math.PI / 2;
  g.add(body);
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.4, 6), AG_BODY_MAT);
  nose.rotation.x = -Math.PI / 2; nose.position.z = -0.9;
  g.add(nose);
  const flame = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.55, 6), AG_FLAME_MAT);
  flame.rotation.x = -Math.PI / 2; flame.position.z = 1.0;
  g.add(flame);
  // T-W-07: brilho de propulsão noturno — nasce INVISÍVEL; o defense-mode liga
  // por frame quando nightFactor > 0 (sem efeito nos demais usos do mesh).
  const glow = new THREE.Mesh(AG_NIGHT_GLOW_GEOM, AG_NIGHT_GLOW_MAT);
  glow.position.z = 1.0; glow.visible = false;
  g.add(glow);
  g.userData.nightGlow = glow;
  return g;
}

/** Tracer da rajada anti-jogador (vermelho, curto). */
export function spawnEnemyTracerMesh(list, from, vel, life) {
  spawnDefenseTracer(list, from, vel, ENEMY_TRACER_MAT, life, TRACER_GEOM);
}

/** Tracer das baterias aliadas (ciano, longo). */
export function spawnAllyTracerMesh(list, from, vel, life) {
  spawnDefenseTracer(list, from, vel, ALLY_TRACER_MAT, life, ALLY_TRACER_GEOM);
}

function spawnDefenseTracer(list, from, vel, mat, life, geom) {
  const mesh = new THREE.Mesh(geom, mat);
  mesh.position.set(from.x, from.y, from.z);
  mesh.lookAt(from.x + vel.x * 0.05, from.y + vel.y * 0.05, from.z + vel.z * 0.05);
  scene.add(mesh);
  list.push({ mesh, x: from.x, y: from.y, z: from.z, vx: vel.x, vy: vel.y, vz: vel.z, life });
}
