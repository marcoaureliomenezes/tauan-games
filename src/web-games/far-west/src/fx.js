// fx.js — Lightweight pooled combat effects: tracer lines, muzzle flashes,
// impact puffs. Exports: initFx, spawnTracer, spawnMuzzleFlash, spawnImpact,
// updateFx. To add an effect, add a pool here.

import * as THREE from '../../vendor/three.module.min.js';
import { COMBAT } from './config.js';

const tracers = [];  // { line, life }
const flashes = [];  // { sprite, life }
const puffs = [];    // { sprite, life }
let sceneRef = null;
let flashTex = null;

const MAX_TRACERS = 24;
const MAX_FLASHES = 8;
const MAX_PUFFS = 16;

function makeFlashTexture() {
  const cv = document.createElement('canvas');
  cv.width = 32; cv.height = 32;
  const ctx = cv.getContext('2d');
  const grad = ctx.createRadialGradient(16, 16, 1, 16, 16, 15);
  grad.addColorStop(0, 'rgba(255,240,180,1)');
  grad.addColorStop(0.5, 'rgba(255,160,60,0.7)');
  grad.addColorStop(1, 'rgba(255,120,20,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 32, 32);
  return new THREE.CanvasTexture(cv);
}

function getTracer() {
  for (const t of tracers) if (t.life <= 0) return t;
  if (tracers.length >= MAX_TRACERS) return tracers[0];
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
  const line = new THREE.Line(geo, new THREE.LineBasicMaterial({
    color: 0xffe0a0, transparent: true, opacity: 1,
  }));
  line.frustumCulled = false;
  sceneRef.add(line);
  const t = { line, life: 0 };
  tracers.push(t);
  return t;
}

function getSprite(pool, max, color, scale) {
  for (const s of pool) if (s.life <= 0) return s;
  if (pool.length >= max) return pool[0];
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
    map: flashTex, color, transparent: true, depthWrite: false,
  }));
  sprite.scale.setScalar(scale);
  sceneRef.add(sprite);
  const s = { sprite, life: 0 };
  pool.push(s);
  return s;
}

/** @param {THREE.Scene} scene */
export function initFx(scene) {
  sceneRef = scene;
  flashTex = makeFlashTexture();
}

/** Bright line from muzzle to hit point, fades fast. */
export function spawnTracer(from, to) {
  const t = getTracer();
  const pos = t.line.geometry.attributes.position;
  pos.setXYZ(0, from.x, from.y, from.z);
  pos.setXYZ(1, to.x, to.y, to.z);
  pos.needsUpdate = true;
  t.life = COMBAT.TRACER_LIFE;
  t.line.visible = true;
}

/** Small flash sprite at the muzzle. */
export function spawnMuzzleFlash(pos) {
  const f = getSprite(flashes, MAX_FLASHES, 0xffcc66, 0.7);
  f.sprite.position.copy(pos);
  f.life = COMBAT.MUZZLE_LIFE;
  f.sprite.visible = true;
}

/** Dust puff at an impact point, grows and fades. */
export function spawnImpact(pos) {
  const p = getSprite(puffs, MAX_PUFFS, 0xcbb79a, 0.4);
  p.sprite.position.copy(pos);
  p.life = COMBAT.IMPACT_LIFE;
  p.sprite.visible = true;
}

/** @param {number} dt seconds since last frame */
export function updateFx(dt) {
  for (const t of tracers) {
    if (t.life <= 0) continue;
    t.life -= dt;
    t.line.material.opacity = Math.max(0, t.life / COMBAT.TRACER_LIFE);
    if (t.life <= 0) t.line.visible = false;
  }
  for (const f of flashes) {
    if (f.life <= 0) continue;
    f.life -= dt;
    f.sprite.material.opacity = Math.max(0, f.life / COMBAT.MUZZLE_LIFE);
    if (f.life <= 0) f.sprite.visible = false;
  }
  for (const p of puffs) {
    if (p.life <= 0) continue;
    p.life -= dt;
    const k = 1 - p.life / COMBAT.IMPACT_LIFE;
    p.sprite.scale.setScalar(0.4 + k * 1.4);
    p.sprite.material.opacity = 0.8 * (1 - k);
    if (p.life <= 0) p.sprite.visible = false;
  }
}
