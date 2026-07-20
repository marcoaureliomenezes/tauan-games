// train.js — Closed-loop rail line around the valley (CatmullRom spline, gentle
// grades, avoids towns/lake) with a locomotive + wagons looping at constant
// speed. Exports: spawnTrain, updateTrain. To change the route, edit TRAIN in config.js.

import * as THREE from '../../vendor/three.module.min.js';
import { WORLD, TRAIN } from './config.js';
import { game } from './state.js';
import { spawn, getModel, fitHeight } from './assets.js';
import { makeCrossingSign } from './buildings.js';
import { mulberry32 } from './noise.js';

/** Builds the loop waypoints, pushed away from the lake and towns. */
function railWaypoints() {
  const rng = mulberry32(WORLD.SEED + 3131);
  const pts = [];
  for (let i = 0; i < TRAIN.WAYPOINTS; i++) {
    const a = (i / TRAIN.WAYPOINTS) * Math.PI * 2;
    const r = TRAIN.RADIUS + (rng() * 2 - 1) * TRAIN.RADIUS_JITTER;
    pts.push({ x: Math.cos(a) * r, z: Math.sin(a) * r });
  }
  const avoid = (px, pz, cx, cz, minDist) => {
    const d = Math.hypot(px - cx, pz - cz);
    if (d < minDist && d > 0.01) {
      const push = (minDist - d) / d;
      return [px + (px - cx) * push, pz + (pz - cz) * push];
    }
    return [px, pz];
  };
  const lake = game.world.lake;
  for (const p of pts) {
    [p.x, p.z] = avoid(p.x, p.z, lake.x, lake.z, TRAIN.AVOID_LAKE);
    for (const town of game.entities.towns) {
      [p.x, p.z] = avoid(p.x, p.z, town.position.x, town.position.z, TRAIN.AVOID_TOWN);
    }
  }
  // Smoothed terrain-following heights (gentle grades)
  const ys = pts.map((p) => game.world.heightAt(p.x, p.z) + 0.35);
  for (let pass = 0; pass < 3; pass++) {
    for (let i = 0; i < pts.length; i++) {
      const prev = ys[(i + pts.length - 1) % pts.length];
      const next = ys[(i + 1) % pts.length];
      ys[i] = (prev + ys[i] * 2 + next) / 4;
    }
  }
  return pts.map((p, i) => new THREE.Vector3(p.x, ys[i], p.z));
}

/** Lays sleepers + two rails as instanced boxes along the curve. */
function layTrack(scene, curve, length) {
  const sleepers = Math.floor(length / TRAIN.SLEEPER_EVERY);
  const sleeperMesh = new THREE.InstancedMesh(
    new THREE.BoxGeometry(1.9, 0.09, 0.26),
    new THREE.MeshLambertMaterial({ color: 0x4a3620 }),
    sleepers,
  );
  const railSegs = Math.floor(length / TRAIN.RAIL_EVERY);
  const railMesh = new THREE.InstancedMesh(
    new THREE.BoxGeometry(0.09, 0.12, TRAIN.RAIL_EVERY * 1.05),
    new THREE.MeshLambertMaterial({ color: 0x6a6a6a }),
    railSegs * 2,
  );
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  const pos = new THREE.Vector3();
  const tan = new THREE.Vector3();
  const scl = new THREE.Vector3(1, 1, 1);
  for (let i = 0; i < sleepers; i++) {
    const t = i / sleepers;
    curve.getPointAt(t, pos);
    curve.getTangentAt(t, tan);
    q.setFromAxisAngle(up, Math.atan2(tan.x, tan.z));
    m4.compose(pos, q, scl);
    sleeperMesh.setMatrixAt(i, m4);
  }
  const off = new THREE.Vector3();
  for (let i = 0; i < railSegs; i++) {
    const t = (i + 0.5) / railSegs;
    curve.getPointAt(t, pos);
    curve.getTangentAt(t, tan);
    q.setFromAxisAngle(up, Math.atan2(tan.x, tan.z));
    off.set(Math.cos(Math.atan2(tan.x, tan.z)), 0, -Math.sin(Math.atan2(tan.x, tan.z)));
    for (const side of [0, 1]) {
      const s = side === 0 ? 1 : -1;
      m4.compose(
        pos.clone().addScaledVector(off, s * TRAIN.RAIL_GAUGE / 2).setY(pos.y + 0.1),
        q, scl,
      );
      railMesh.setMatrixAt(i * 2 + side, m4);
    }
  }
  scene.add(sleeperMesh);
  scene.add(railMesh);
}

/**
 * Builds the rail loop, the train and registers game.entities.train.
 * @param {THREE.Scene} scene
 */
export function spawnTrain(scene) {
  const curve = new THREE.CatmullRomCurve3(railWaypoints(), true, 'catmullrom', 0.5);
  const length = curve.getLength();
  layTrack(scene, curve, length);

  const engine = fitHeight(spawn('trainEngine'), 4.2);
  if (!getModel('trainEngine')) engine.rotation.y = -Math.PI / 2; // procedural fallback faces +X
  scene.add(engine);
  const cars = [engine];
  for (let i = 0; i < TRAIN.WAGONS; i++) {
    const wagon = fitHeight(spawn('trainWagon'), 3.2);
    if (!getModel('trainWagon')) wagon.rotation.y = -Math.PI / 2;
    scene.add(wagon);
    cars.push(wagon);
  }

  // Crossing sign at a curve point far from towns
  const signPos = curve.getPointAt(0.3);
  const sign = makeCrossingSign();
  sign.position.set(signPos.x + 3, game.world.heightAt(signPos.x + 3, signPos.z + 3), signPos.z + 3);
  scene.add(sign);

  // CONTRACT: writer of game.entities.train
  game.entities.train = {
    curve, length, cars, t: 0,
    position: new THREE.Vector3(), // engine position, updated per frame
  };
}

/** Per-frame train update: constant speed along the spline. @param {number} dt */
export function updateTrain(dt) {
  const train = game.entities.train;
  if (!train) return;
  train.t = (train.t + (TRAIN.SPEED * dt) / train.length) % 1;
  const pos = new THREE.Vector3();
  const tan = new THREE.Vector3();
  train.cars.forEach((car, i) => {
    const t = ((train.t - (i * TRAIN.WAGON_GAP) / train.length) + 1) % 1;
    train.curve.getPointAt(t, pos);
    train.curve.getTangentAt(t, tan);
    car.position.copy(pos);
    car.rotation.set(-Math.asin(THREE.MathUtils.clamp(tan.y, -1, 1)) * 0.7, Math.atan2(tan.x, tan.z), 0);
    if (i === 0) train.position.copy(pos);
  });
}
