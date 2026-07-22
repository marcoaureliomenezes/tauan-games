// sky.js — Vendored three.js Sky addon + sun/hemisphere lights + FogExp2 + slow
// day/night cycle with warm sunsets. Exports: initSky, updateSky, getSun.
// To change cycle length or fog, edit SKYCFG in config.js.

import * as THREE from '../../vendor/three.module.min.js';
import { Sky } from '../../vendor/jsm/objects/Sky.js';
import { SKYCFG, COLORS } from './config.js';
import { game } from './state.js';

let sky = null;
let sun = null;
let hemi = null;
let sceneRef = null;

const fogDay = new THREE.Color(COLORS.fogDay);
const fogNight = new THREE.Color(COLORS.fogNight);
const fogSunset = new THREE.Color(COLORS.fogSunset);
const sunWhite = new THREE.Color(0xfff4e0);
const sunWarm = new THREE.Color(0xff9040);
const _fog = new THREE.Color();
const _sunPos = new THREE.Vector3();

function smoothstep(a, b, x) {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

/**
 * Adds the sky dome, directional sun (with shadows) and hemisphere light.
 * @param {THREE.Scene} scene
 */
export function initSky(scene) {
  sceneRef = scene;
  sky = new Sky();
  sky.scale.setScalar(30000);
  const u = sky.material.uniforms;
  u.turbidity.value = SKYCFG.TURBIDITY;
  u.rayleigh.value = SKYCFG.RAYLEIGH;
  u.mieCoefficient.value = 0.004;
  u.mieDirectionalG.value = 0.85;
  scene.add(sky);

  sun = new THREE.DirectionalLight(0xffffff, 2.4);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  const range = SKYCFG.SHADOW_RANGE;
  sun.shadow.camera.left = -range;
  sun.shadow.camera.right = range;
  sun.shadow.camera.top = range;
  sun.shadow.camera.bottom = -range;
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 2500;
  sun.shadow.bias = -0.0006;
  scene.add(sun);
  scene.add(sun.target);

  hemi = new THREE.HemisphereLight(0xbfd9ff, 0x8a7a5a, 0.7);
  scene.add(hemi);

  scene.fog = new THREE.FogExp2(COLORS.fogDay, SKYCFG.FOG_DENSITY);
  game.time.dayTime = SKYCFG.START_DAYTIME; // CONTRACT: writer of game.time.dayTime
}

/**
 * Advances the day/night cycle and updates sun, sky shader, lights and fog.
 * @param {number} dt seconds since last frame
 */
export function updateSky(dt) {
  if (!sky) return;
  // CONTRACT: writer of game.time.dayTime
  game.time.dayTime = (game.time.dayTime + dt / SKYCFG.DAY_LENGTH) % 1;
  const t = game.time.dayTime; // 0=midnight, 0.25=sunrise, 0.5=noon, 0.75=sunset
  const azim = (t - 0.25) * Math.PI * 2;
  const elev = Math.sin(azim) * SKYCFG.MAX_ELEV; // rad
  _sunPos.set(Math.cos(elev) * Math.cos(azim + Math.PI / 2), Math.sin(elev), Math.cos(elev) * Math.sin(azim + Math.PI / 2));
  sky.material.uniforms.sunPosition.value.copy(_sunPos);

  const day = smoothstep(-0.06, 0.14, elev / SKYCFG.MAX_ELEV);
  const warm = Math.max(0, 1 - Math.abs(elev / SKYCFG.MAX_ELEV) * 3.5) * day; // near horizon
  sun.intensity = 2.6 * day * (1 - warm * 0.35);
  sun.color.copy(sunWhite).lerp(sunWarm, warm);
  hemi.intensity = 0.1 + 0.65 * day;

  _fog.copy(fogNight).lerp(fogDay, day).lerp(fogSunset, warm * 0.45);
  sceneRef.fog.color.copy(_fog);

  // Sun + shadow frustum + sky dome follow the camera
  const cam = game.camera;
  if (cam) {
    sun.position.set(
      cam.position.x + _sunPos.x * SKYCFG.SUN_DIST,
      Math.max(30, _sunPos.y * SKYCFG.SUN_DIST),
      cam.position.z + _sunPos.z * SKYCFG.SUN_DIST,
    );
    sun.target.position.set(cam.position.x, 0, cam.position.z);
    sun.target.updateMatrixWorld();
    sky.position.copy(cam.position);
  }
  // At night the sun light would shine from below the horizon — cut it
  if (elev < -0.05) sun.intensity = 0;
}

/** Directional sun light (shadow caster). */
export function getSun() {
  return sun;
}
