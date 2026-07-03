// fx.js — Partículas: trilha do motor, explosões e o espetáculo da nuke.

import * as THREE from '../../vendor/three.module.min.js';
import { scene } from './scene.js';
import { game } from './state.js';

let glowTex;
function tex() {
  if (glowTex) return glowTex;
  const cv = document.createElement('canvas'); cv.width = 64; cv.height = 64;
  const c = cv.getContext('2d');
  const g = c.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.4, 'rgba(255,255,255,0.6)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  c.fillStyle = g; c.fillRect(0, 0, 64, 64);
  glowTex = new THREE.CanvasTexture(cv);
  return glowTex;
}

function particle(pos, vel, color, size, life, fade = true) {
  if (game.particles.length > 650) return;            // teto de performance
  const mat = new THREE.SpriteMaterial({ map: tex(), color, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true });
  const sp = new THREE.Sprite(mat);
  sp.position.copy(pos); sp.scale.setScalar(size);
  scene.add(sp);
  game.particles.push({ sp, vel: vel.clone(), life, max: life, size, fade });
}

export function thruster(pos, back, throttle) {
  if (throttle < 0.05 || Math.random() > throttle) return;
  const v = back.clone().multiplyScalar(40 + Math.random() * 60);
  v.x += (Math.random() - 0.5) * 14; v.y += (Math.random() - 0.5) * 14; v.z += (Math.random() - 0.5) * 14;
  particle(pos, v, 0x66ccff, 5 + Math.random() * 4, 0.5);
}

const FXS = 26;   // escala global dos efeitos (mundo grande)

export function explosion(pos, scale = 1, color = 0xffaa44) {
  const n = 26 + (scale * 10 | 0);
  const s = scale * FXS;
  for (let i = 0; i < n; i++) {
    const dir = new THREE.Vector3((Math.random() - 0.5), (Math.random() - 0.5), (Math.random() - 0.5)).normalize();
    const spd = (8 + Math.random() * 26) * s;
    const col = i % 3 === 0 ? 0xffffff : i % 3 === 1 ? color : 0xff5522;
    particle(pos, dir.multiplyScalar(spd), col, (1.5 + Math.random() * 2) * s, 0.6 + Math.random() * 0.5);
  }
  // flash
  particle(pos, new THREE.Vector3(), 0xffffff, 6 * s, 0.25);
}

export function nukeBlast(pos) {
  // Núcleo branco enorme
  particle(pos, new THREE.Vector3(), 0xffffff, 40 * FXS, 0.6);
  particle(pos, new THREE.Vector3(), 0xaaffaa, 70 * FXS, 1.0);
  // casca em expansão
  for (let i = 0; i < 120; i++) {
    const dir = new THREE.Vector3((Math.random() - 0.5), (Math.random() - 0.5), (Math.random() - 0.5)).normalize();
    const spd = (30 + Math.random() * 90) * FXS;
    const col = Math.random() < 0.4 ? 0x66ff66 : Math.random() < 0.5 ? 0xffffff : 0xffaa33;
    particle(pos, dir.multiplyScalar(spd), col, (3 + Math.random() * 5) * FXS, 1.0 + Math.random() * 1.2);
  }
  // anel de choque
  for (let i = 0; i < 60; i++) {
    const a = (i / 60) * Math.PI * 2;
    const dir = new THREE.Vector3(Math.cos(a), 0, Math.sin(a));
    particle(pos, dir.multiplyScalar(70 * FXS), 0xccffcc, 4 * FXS, 1.4);
  }
  // flash de tela
  const flash = document.getElementById('flash');
  if (flash) { flash.style.transition = 'none'; flash.style.opacity = '0.9'; requestAnimationFrame(() => { flash.style.transition = 'opacity 1.2s'; flash.style.opacity = '0'; }); }
}

// ── COGUMELO NUCLEAR (operador 2026-07-03: "explosão realista, como nuke") ──
// Em impactos de SUPERFÍCIE: bola de fogo → coluna subindo pela normal do corpo →
// copa que se abre no topo → anel de choque rasteiro no plano da superfície.
// Referência: aero-fighters nuclear-fx (cogumelo de 60 s); aqui ~18 s, escala
// espacial. `up` = normal da superfície no ponto do impacto.
const _mt = new THREE.Vector3();
const _mu = new THREE.Vector3();
const _mv = new THREE.Vector3();
export function nukeMushroom(pos, up, scale = 1) {
  const H = 950 * scale;                        // altura da coluna
  // base ortonormal do plano da superfície
  _mu.set(1, 0, 0);
  if (Math.abs(up.x) > 0.9) _mu.set(0, 1, 0);
  _mu.crossVectors(up, _mu).normalize();
  _mv.crossVectors(up, _mu).normalize();
  // bola de fogo + flash central
  particle(pos, new THREE.Vector3(), 0xffffff, 60 * scale, 0.5);
  particle(pos, new THREE.Vector3(), 0xffd27a, 110 * scale, 1.4);
  // COLUNA: fumaça quente subindo devagar (haste do cogumelo)
  for (let i = 0; i < 34; i++) {
    const h = Math.random();
    const col = h < 0.25 ? 0xff8833 : h < 0.55 ? 0xb06a3a : 0x6a5f58;
    _mt.copy(up).multiplyScalar(30 + h * 55)
      .addScaledVector(_mu, (Math.random() - 0.5) * 24)
      .addScaledVector(_mv, (Math.random() - 0.5) * 24);
    particle(pos, _mt.clone(), col, (26 + Math.random() * 30) * scale, 7 + h * 9, true);
  }
  // COPA: abre no topo da coluna, expandindo lateralmente
  for (let i = 0; i < 44; i++) {
    const a = Math.random() * Math.PI * 2;
    const start = new THREE.Vector3().copy(pos).addScaledVector(up, H * (0.8 + Math.random() * 0.25));
    _mt.copy(_mu).multiplyScalar(Math.cos(a)).addScaledVector(_mv, Math.sin(a))
      .multiplyScalar(26 + Math.random() * 42).addScaledVector(up, 8 + Math.random() * 14);
    const col = i % 4 === 0 ? 0xffaa55 : i % 3 === 0 ? 0x8a7a6a : 0x5c544e;
    particle(start, _mt.clone(), col, (34 + Math.random() * 40) * scale, 8 + Math.random() * 8, true);
  }
  // ANEL DE CHOQUE rasteiro no plano da superfície
  for (let i = 0; i < 40; i++) {
    const a = (i / 40) * Math.PI * 2;
    _mt.copy(_mu).multiplyScalar(Math.cos(a)).addScaledVector(_mv, Math.sin(a)).multiplyScalar(160 + Math.random() * 60);
    particle(pos, _mt.clone(), 0xd9c9a8, (10 + Math.random() * 10) * scale, 2.6);
  }
  // flash de tela
  const flash = document.getElementById('flash');
  if (flash) { flash.style.transition = 'none'; flash.style.opacity = '0.95'; requestAnimationFrame(() => { flash.style.transition = 'opacity 1.6s'; flash.style.opacity = '0'; }); }
}

// Duplo flash no VÁCUO (assinatura real de detonação nuclear no espaço: dois
// pulsos de luz, sem cogumelo — não há atmosfera para formar a nuvem).
export function vacuumDoubleFlash() {
  const flash = document.getElementById('flash');
  if (!flash) return;
  flash.style.transition = 'none'; flash.style.opacity = '0.9';
  requestAnimationFrame(() => { flash.style.transition = 'opacity 0.35s'; flash.style.opacity = '0'; });
  setTimeout(() => {
    flash.style.transition = 'none'; flash.style.opacity = '0.7';
    requestAnimationFrame(() => { flash.style.transition = 'opacity 1.1s'; flash.style.opacity = '0'; });
  }, 380);
}

export function updateParticles(dt) {
  const arr = game.particles;
  for (let i = arr.length - 1; i >= 0; i--) {
    const p = arr[i];
    p.life -= dt;
    if (p.life <= 0) { scene.remove(p.sp); p.sp.material.dispose(); arr.splice(i, 1); continue; }
    p.sp.position.addScaledVector(p.vel, dt);
    p.vel.multiplyScalar(1 - 0.6 * dt);
    const t = p.life / p.max;
    if (p.fade) p.sp.material.opacity = t;
    p.sp.scale.setScalar(p.size * (0.6 + (1 - t) * 0.8));
  }
}
