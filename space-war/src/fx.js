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
