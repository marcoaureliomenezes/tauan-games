// combat.js — Revolver hitscan: hold [F] to aim (tighter spread, FOV zoom via
// camera.js), [Space] shoots, [R] reloads from reserve. Hitscan raycast from the
// camera against the target registry + terrain. Exports: initCombat, updateCombat,
// registerTarget. T-FW-06 plugs real entities into registerTarget().

import * as THREE from '../../vendor/three.module.min.js';
import { COMBAT } from './config.js';
import { game } from './state.js';
import { isDown, onPress } from './input.js';
import { spawnTracer, spawnMuzzleFlash, spawnImpact } from './fx.js';
import { playGunshot, playReload } from './audio.js';

let cooldown = 0;
let reloadT = 0;

const _dir = new THREE.Vector3();
const _muzzle = new THREE.Vector3();
const _end = new THREE.Vector3();
const _ray = new THREE.Raycaster();

/**
 * Registers a hittable object. cb(entry, hit) is called on every hit.
 * @param {THREE.Object3D} object3D @param {Function} cb
 */
export function registerTarget(object3D, cb) {
  game.entities.targets.push({ object3D, cb });
}

/** Removes an object from the hit registry (dead/despawned entities). */
export function unregisterTarget(object3D) {
  const i = game.entities.targets.findIndex((t) => t.object3D === object3D);
  if (i >= 0) game.entities.targets.splice(i, 1);
}

/** Finds the registered entry owning a hit object (hits land on children). */
function entryFor(obj) {
  for (const entry of game.entities.targets) {
    let o = obj;
    while (o) {
      if (o === entry.object3D) return entry;
      o = o.parent;
    }
  }
  return null;
}

/** Muzzle point: the rider's gun hand — at the rider's shoulder height,
 * extended along the shot direction (in 3rd person the camera sits ~6 m behind;
 * spawning the tracer at the camera made shots LOOK like they came from behind
 * the horse). Seat is at ~1.65 m, gun hand ~1.75 m above the horse root. */
function muzzlePos() {
  const p = game.player.position;
  _muzzle.set(p.x, p.y + 1.75, p.z).addScaledVector(_dir, 0.6);
  return _muzzle;
}

/** Walks the ray to find where it crosses the terrain (heightAt march, 1 m
 * steps + 0.25 m refine: coarse steps skip shallow dips and the impact then
 * lands meters past the crosshair point on undulating ground). */
function terrainHit(origin, dir) {
  const step = 1;
  for (let t = step; t <= COMBAT.RANGE; t += step) {
    const x = origin.x + dir.x * t;
    const y = origin.y + dir.y * t;
    const z = origin.z + dir.z * t;
    if (y < game.world.heightAt(x, z)) {
      // refine between t-step and t
      for (let s = t - step + 0.25; s < t; s += 0.25) {
        const rx = origin.x + dir.x * s;
        const ry = origin.y + dir.y * s;
        const rz = origin.z + dir.z * s;
        if (ry < game.world.heightAt(rx, rz)) return _end.set(rx, ry, rz);
      }
      return _end.set(x, y, z);
    }
  }
  return null;
}

function tryShoot() {
  const p = game.player;
  if (cooldown > 0 || game.flags.reloading || p.ammo <= 0) return;
  // CONTRACT: writer of game.player.ammo
  p.ammo -= 1;
  cooldown = COMBAT.COOLDOWN;

  const cam = game.camera;
  cam.getWorldDirection(_dir);
  const spread = game.ui.aiming ? COMBAT.SPREAD_AIM : COMBAT.SPREAD_HIP;
  _dir.x += (Math.random() - 0.5) * 2 * spread;
  _dir.y += (Math.random() - 0.5) * 2 * spread;
  _dir.z += (Math.random() - 0.5) * 2 * spread;
  _dir.normalize();

  _ray.set(cam.position, _dir);
  _ray.far = COMBAT.RANGE;
  const objects = game.entities.targets.map((t) => t.object3D);
  const hits = objects.length ? _ray.intersectObjects(objects, true) : [];
  const ground = terrainHit(cam.position, _dir);

  let end;
  if (hits.length && (!ground || hits[0].distance < cam.position.distanceTo(ground))) {
    end = hits[0].point;
    const entry = entryFor(hits[0].object);
    if (entry) entry.cb(entry, hits[0]);
    spawnImpact(hits[0].point);
  } else if (ground) {
    end = ground;
    spawnImpact(ground);
  } else {
    end = _end.copy(cam.position).addScaledVector(_dir, COMBAT.RANGE);
  }
  const muzzle = muzzlePos();
  spawnTracer(muzzle, end);
  spawnMuzzleFlash(muzzle);
  playGunshot();
  // CONTRACT: writer of game.flags.lastShot (test/debug aim-coherence record)
  game.flags.lastShot = {
    origin: { x: cam.position.x, y: cam.position.y, z: cam.position.z },
    dir: { x: _dir.x, y: _dir.y, z: _dir.z },
    end: { x: end.x, y: end.y, z: end.z },
  };
}

function startReload() {
  const p = game.player;
  if (game.flags.reloading || p.ammo >= COMBAT.CYLINDER || p.ammoReserve <= 0) return;
  // CONTRACT: writer of game.flags.reloading
  game.flags.reloading = true;
  reloadT = COMBAT.RELOAD_TIME;
  playReload();
}

/** Binds key actions. Call once from main.js. */
export function initCombat() {
  onPress('shoot', tryShoot);
  onPress('reload', startReload);
}

/** Per-frame combat update. @param {number} dt seconds since last frame */
export function updateCombat(dt) {
  // CONTRACT: writer of game.ui.aiming (hold-to-aim)
  game.ui.aiming = isDown('aim');
  cooldown = Math.max(0, cooldown - dt);
  if (game.flags.reloading) {
    reloadT -= dt;
    if (reloadT <= 0) {
      const p = game.player;
      const take = Math.min(COMBAT.CYLINDER - p.ammo, p.ammoReserve);
      // CONTRACT: writer of game.player.ammo / game.player.ammoReserve
      p.ammo += take;
      p.ammoReserve -= take;
      game.flags.reloading = false;
    }
  }
  const crosshair = document.getElementById('crosshair');
  if (crosshair) crosshair.classList.remove('hidden'); // always visible (CS-style)
}
