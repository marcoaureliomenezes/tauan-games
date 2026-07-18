// prop-fire.js — Fogo em loop em props (árvores/casas) incendiados pela nuke (WS-5).
// Exporta: spawnPropFire, updatePropFires, clearPropFires.
// Pool LIMITADO por FPS: no máximo MAX_EMITTERS focos ativos, puxando puffs de fogo
// aditivos de um pool compartilhado. Guarda headless (não roda sob webdriver/testMode) —
// consistente com fx.js/HEADLESS_FX. Ticado por main.js: updatePropFires(dt) a cada frame.

import * as THREE from '../../../../vendor/three.module.min.js';
import { scene } from './scene.js';

const HEADLESS = typeof navigator !== 'undefined' && navigator.webdriver === true;
const MAX_EMITTERS = 48;   // cap rígido de focos simultâneos (protege FPS — U-AC-8 é frágil)
const POOL = 90;           // puffs de fogo reaproveitados
const FIRE_GEOM = new THREE.SphereGeometry(1.0, 6, 5);
const FIRE_COLORS = [0xffdd66, 0xffaa30, 0xff5020];

const pool = [];
const flames = [];
const emitters = [];
let built = false;

function build() {
  if (built) return;
  for (let i = 0; i < POOL; i++) {
    const m = new THREE.Mesh(FIRE_GEOM, new THREE.MeshBasicMaterial({ color: 0xffaa30, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending }));
    m.visible = false; scene.add(m); pool.push(m);
  }
  built = true;
}

/** Acende um foco de fogo em (x,y,z) que queima ~duration s. Respeita o cap. */
export function spawnPropFire(x, y, z, scale = 1, duration = 26) {
  if (HEADLESS) return;
  build();
  if (emitters.length >= MAX_EMITTERS) return;
  emitters.push({ x, y, z, scale, life: duration + Math.random() * 8, cool: Math.random() * 0.2 });
}

export function updatePropFires(dt) {
  if (HEADLESS) return;
  for (let e = emitters.length - 1; e >= 0; e--) {
    const em = emitters[e];
    em.life -= dt;
    if (em.life <= 0) { emitters.splice(e, 1); continue; }
    em.cool -= dt;
    if (em.cool > 0) continue;
    em.cool = 0.06 + Math.random() * 0.08;
    const m = pool.pop(); if (!m) continue;
    m.material.color.setHex(FIRE_COLORS[Math.floor(Math.random() * FIRE_COLORS.length)]);
    m.material.opacity = 0.9;
    m.position.set(
      em.x + (Math.random() - 0.5) * 2.4 * em.scale,
      em.y + Math.random() * 1.6 * em.scale,
      em.z + (Math.random() - 0.5) * 2.4 * em.scale,
    );
    const s0 = (0.8 + Math.random() * 1.2) * em.scale;
    m.scale.setScalar(s0);
    m.visible = true;
    flames.push({ mesh: m, vy: 4 + Math.random() * 5, life: 0.5 + Math.random() * 0.4, max: 0.9, sc: s0 });
  }
  for (let i = flames.length - 1; i >= 0; i--) {
    const f = flames[i]; f.life -= dt;
    f.mesh.position.y += f.vy * dt;
    f.vy *= 0.96;
    const u = Math.max(0, f.life / f.max);
    f.mesh.material.opacity = u * 0.9;
    f.mesh.scale.setScalar(f.sc * (0.6 + (1 - u) * 1.4));
    if (f.life <= 0) { f.mesh.visible = false; pool.push(f.mesh); flames.splice(i, 1); }
  }
}

export function clearPropFires() {
  for (const f of flames) { f.mesh.visible = false; pool.push(f.mesh); }
  flames.length = 0;
  emitters.length = 0;
}
