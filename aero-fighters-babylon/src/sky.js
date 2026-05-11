// sky.js — Sky dome com shader GLSL, ciclo dia/noite, estrelas, lua.
// Exporta: initSky, updateSky, getSunData, getAmbientData, getSkyColor.

/* global BABYLON */

import { game } from './state.js';
import { DAY_CYCLE_SPEED } from './config.js';
import { scene, camera } from './scene.js';

// Vetor direcao do sol (world space)
const sunDir = new BABYLON.Vector3(0, 1, 0);
let _sunColorR = 1.0, _sunColorG = 0.98, _sunColorB = 0.67;
let _sunIntensity = 1.15;
let _ambColorR = 1.0, _ambColorG = 1.0, _ambColorB = 1.0;
let _ambIntensity = 0.55;
let _horizR = 0.56, _horizG = 0.78, _horizB = 0.94;

// Grupo que segue a camera (evita oval preto ao voar longe da origem)
let _skyRoot = null;
let _skyMat = null;
let _starMat = null;
let _moonMesh = null;
let _moonLight = null;
let _mwMat = null;

// ─── Vertex shader (identico ao Three.js) ────────────────────────────────────
const vertexShader = `
precision highp float;
attribute vec3 position;
uniform mat4 worldViewProjection;
varying vec3 vLocalPos;
void main() {
  vLocalPos = position;
  gl_Position = worldViewProjection * vec4(position, 1.0);
}
`;

// ─── Fragment shader (identico ao Three.js) ───────────────────────────────────
const fragmentShader = `
precision highp float;
uniform vec3 sunDirection;
uniform vec3 topColor;
uniform vec3 horizonColor;
uniform vec3 sunColor;
uniform float sunVisible;
varying vec3 vLocalPos;
void main() {
  vec3 dir = normalize(vLocalPos);
  float altitude = dir.y;
  float t = smoothstep(-0.1, 0.4, altitude);
  vec3 skyColor = mix(horizonColor, topColor, t);
  float sunDot = dot(dir, normalize(sunDirection));
  float sunGlow = pow(max(0.0, sunDot), 64.0);
  skyColor += sunColor * sunGlow * sunVisible * 0.5;
  float sunDisc = smoothstep(0.9975, 0.9995, sunDot);
  skyColor = mix(skyColor, vec3(1.0, 0.98, 0.92), sunDisc * sunVisible);
  gl_FragColor = vec4(skyColor, 1.0);
}
`;

// ─── Paletas ─────────────────────────────────────────────────────────────────
function smoothstepJS(t) {
  t = Math.max(0, Math.min(1, t));
  return t * t * (3 - 2 * t);
}

function lerpC(a, b, k) {
  return a + (b - a) * k;
}

function getSkyPalette(tod) {
  const night = {
    topR: 0.024, topG: 0.055, topB: 0.118,
    horR: 0.039, horG: 0.086, horB: 0.157,
    sunR: 0.0, sunG: 0.0, sunB: 0.0, sunVis: 0.0,
  };
  const dawn = {
    topR: 0.102, topG: 0.165, topB: 0.369,
    horR: 1.0, horG: 0.376, horB: 0.188,
    sunR: 1.0, sunG: 0.816, sunB: 0.502, sunVis: 1.0,
  };
  const day = {
    topR: 0.102, topG: 0.439, topB: 0.878,
    horR: 0.565, horG: 0.784, horB: 0.941,
    sunR: 1.0, sunG: 0.980, sunB: 0.667, sunVis: 1.0,
  };
  const dusk = {
    topR: 0.102, topG: 0.125, topB: 0.376,
    horR: 0.878, horG: 0.251, horB: 0.063,
    sunR: 1.0, sunG: 0.565, sunB: 0.251, sunVis: 1.0,
  };

  function lerp(a, b, k) {
    return {
      topR: lerpC(a.topR, b.topR, k), topG: lerpC(a.topG, b.topG, k), topB: lerpC(a.topB, b.topB, k),
      horR: lerpC(a.horR, b.horR, k), horG: lerpC(a.horG, b.horG, k), horB: lerpC(a.horB, b.horB, k),
      sunR: lerpC(a.sunR, b.sunR, k), sunG: lerpC(a.sunG, b.sunG, k), sunB: lerpC(a.sunB, b.sunB, k),
      sunVis: lerpC(a.sunVis, b.sunVis, k),
    };
  }

  let k;
  if (tod < 0.15) return { ...night };
  if (tod < 0.25) { k = smoothstepJS((tod - 0.15) / 0.10); return lerp(night, dawn, k); }
  if (tod < 0.32) { k = smoothstepJS((tod - 0.25) / 0.07); return lerp(dawn, day, k); }
  if (tod < 0.68) return { ...day };
  if (tod < 0.75) { k = smoothstepJS((tod - 0.68) / 0.07); return lerp(day, dusk, k); }
  if (tod < 0.85) return { ...dusk };
  if (tod < 0.92) { k = smoothstepJS((tod - 0.85) / 0.07); return lerp(dusk, night, k); }
  return { ...night };
}

function _nightFactor(tod) {
  if (tod < 0.1) return 1.0;
  if (tod < 0.20) return 1.0 - smoothstepJS((tod - 0.1) / 0.10);
  if (tod < 0.80) return 0.0;
  if (tod < 0.90) return smoothstepJS((tod - 0.80) / 0.10);
  return 1.0;
}

// ─── Estrelas ────────────────────────────────────────────────────────────────
// Usamos SpriteManager para estrelas (compativel com UMD build do Babylon)
let _starSprites = null;

function buildStars(parent) {
  // Criamos estrelas como pequenos meshes de esfera agrupados num SPS
  const starCount = 1500;
  // updatable:true garante que SPS.particles[] e populado apos buildMesh()
  const SPS = new BABYLON.SolidParticleSystem('stars', scene, { updatable: true });
  const starMesh = BABYLON.MeshBuilder.CreateSphere('starTemplate', { diameter: 1, segments: 2 }, scene);
  SPS.addShape(starMesh, starCount);
  starMesh.dispose();

  const starsMesh = SPS.buildMesh();
  starsMesh.parent = parent;
  const mat = new BABYLON.StandardMaterial('starsMat', scene);
  mat.emissiveColor = new BABYLON.Color3(1, 1, 1);
  mat.disableLighting = true;
  mat.alpha = 0;
  starsMesh.material = mat;
  _starMat = mat;

  for (let i = 0; i < SPS.nbParticles; i++) {
    const p = SPS.particles[i];
    if (!p) continue;
    const theta = Math.random() * Math.PI * 2;
    const phi   = Math.acos(2 * Math.random() - 1);
    const r     = 3700;
    p.position.x = r * Math.sin(phi) * Math.cos(theta);
    p.position.y = r * Math.cos(phi);
    p.position.z = r * Math.sin(phi) * Math.sin(theta);
    const size = 1.5 + Math.random() * 4.5;
    p.scaling.setAll(size);
    const type = Math.random();
    if (type < 0.15)       p.color = new BABYLON.Color4(0.7, 0.8, 1.0, 1.0);
    else if (type < 0.25)  p.color = new BABYLON.Color4(1.0, 0.95, 0.7, 1.0);
    else                   p.color = new BABYLON.Color4(1.0, 1.0, 1.0, 1.0);
  }
  SPS.setParticles();
  SPS.refreshVisibleSize();
}

// ─── Lua ─────────────────────────────────────────────────────────────────────
function buildMoon(parent) {
  _moonMesh = BABYLON.MeshBuilder.CreateSphere('moon', { diameter: 110, segments: 16 }, scene);
  const moonMat = new BABYLON.StandardMaterial('moonMat', scene);
  moonMat.diffuseColor = new BABYLON.Color3(0.82, 0.80, 0.75);
  moonMat.emissiveColor = new BABYLON.Color3(0.65, 0.63, 0.58);
  moonMat.specularColor = new BABYLON.Color3(0, 0, 0);
  _moonMesh.material = moonMat;
  _moonMesh.parent = parent;
  _moonMesh.isVisible = false;

  _moonLight = new BABYLON.DirectionalLight('moonLight', new BABYLON.Vector3(0, -1, 0), scene);
  _moonLight.diffuse = new BABYLON.Color3(0.53, 0.60, 0.80);
  _moonLight.intensity = 0.0;
}

// ─── API publica ──────────────────────────────────────────────────────────────

export function initSky() {
  // TransformNode que segue a camera (evita oval preto)
  _skyRoot = new BABYLON.TransformNode('skyRoot', scene);

  // Sky dome — BackSide equivalent: sideOrientation = BABYLON.Mesh.BACKSIDE
  const skyDome = BABYLON.MeshBuilder.CreateSphere('skyDome', {
    diameter: 7600,
    segments: 32,
    sideOrientation: BABYLON.Mesh.BACKSIDE,
  }, scene);
  skyDome.parent = _skyRoot;
  skyDome.isPickable = false;
  skyDome.infiniteDistance = false;

  // ShaderMaterial com os mesmos shaders do Three.js
  _skyMat = new BABYLON.ShaderMaterial('skyMat', scene, {
    vertexSource: vertexShader,
    fragmentSource: fragmentShader,
  }, {
    attributes: ['position'],
    uniforms: ['worldViewProjection', 'sunDirection', 'topColor', 'horizonColor', 'sunColor', 'sunVisible'],
  });
  _skyMat.backFaceCulling = false;
  _skyMat.disableDepthWrite = true;
  skyDome.material = _skyMat;
  skyDome.renderingGroupId = 0;

  // Objetos noturnos
  buildStars(_skyRoot);
  buildMoon(_skyRoot);

  // Posicao inicial do grupo
  _skyRoot.position.copyFrom(camera.position);

  _applyTimeOfDay(game.timeOfDay || 0.35);
}

function _applyTimeOfDay(tod) {
  const p = getSkyPalette(tod);

  // Posicao do sol
  const angle = tod * Math.PI * 2 - Math.PI * 0.5;
  sunDir.copyFromFloats(Math.cos(angle), Math.sin(angle), 0.3).normalize();

  // Uniforms do shader
  if (_skyMat) {
    _skyMat.setVector3('sunDirection', sunDir);
    _skyMat.setColor3('topColor', new BABYLON.Color3(p.topR, p.topG, p.topB));
    _skyMat.setColor3('horizonColor', new BABYLON.Color3(p.horR, p.horG, p.horB));
    _skyMat.setColor3('sunColor', new BABYLON.Color3(p.sunR, p.sunG, p.sunB));
    _skyMat.setFloat('sunVisible', p.sunVis);
  }

  // Calcular iluminacao dinamica
  const isNight = tod < 0.15 || tod > 0.92;
  const isDawn = tod >= 0.15 && tod < 0.32;
  const isDusk = tod >= 0.68 && tod < 0.92;
  const isDay = tod >= 0.32 && tod < 0.68;

  if (isDay) { _sunIntensity = 1.15; _ambIntensity = 0.55; }
  else if (isDawn) { const k = (tod - 0.15) / 0.17; _sunIntensity = k * 0.8; _ambIntensity = 0.18 + k * 0.37; }
  else if (isDusk) { const k = 1.0 - (tod - 0.68) / 0.24; _sunIntensity = k * 0.8; _ambIntensity = 0.18 + k * 0.37; }
  else { _sunIntensity = 0; _ambIntensity = 0.18; }

  _sunColorR = p.sunR; _sunColorG = p.sunG; _sunColorB = p.sunB;
  _horizR = p.horR; _horizG = p.horG; _horizB = p.horB;
  if (isNight) { _ambColorR = 0.039; _ambColorG = 0.055; _ambColorB = 0.102; }
  else { _ambColorR = p.horR * 0.6; _ambColorG = p.horG * 0.6; _ambColorB = p.horB * 0.6; }

  // Objetos noturnos
  const nightFactor = _nightFactor(tod);

  if (_starMat) _starMat.alpha = Math.min(1.0, nightFactor) * 0.9;

  if (_moonMesh) {
    const moonPos = new BABYLON.Vector3(-sunDir.x * 3500, -sunDir.y * 3500, -sunDir.z * 3500);
    _moonMesh.position.copyFrom(moonPos);
    _moonMesh.isVisible = nightFactor > 0.05;
    if (_moonLight) _moonLight.intensity = nightFactor * 0.25;
  }
}

export function updateSky(dt) {
  // Dome segue a camera
  if (_skyRoot) _skyRoot.position.copyFrom(camera.position);

  if (typeof game.timeOfDay === 'undefined') game.timeOfDay = 0.35;
  game.timeOfDay = (game.timeOfDay + dt * DAY_CYCLE_SPEED) % 1.0;
  _applyTimeOfDay(game.timeOfDay);
}

export function getSunData() {
  return {
    direction: sunDir,
    colorR: _sunColorR, colorG: _sunColorG, colorB: _sunColorB,
    intensity: _sunIntensity,
  };
}

export function getAmbientData() {
  return {
    colorR: _ambColorR, colorG: _ambColorG, colorB: _ambColorB,
    intensity: _ambIntensity,
  };
}

export function getSkyColor() {
  return { r: _horizR, g: _horizG, b: _horizB };
}
