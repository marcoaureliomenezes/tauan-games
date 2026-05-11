// sky.js — Sky dome com Rayleigh + Mie scattering simulado via ShaderMaterial GLSL.
// Substitui o CubeTexture estático do scene.js.
// Exporta: initSky, updateSky, getSunData, getAmbientData, getSkyColor.

import * as THREE from '../../vendor/three.module.min.js';
import { game } from './state.js';
import { DAY_CYCLE_SPEED } from './config.js';

// ─── Referências internas ────────────────────────────────────────────────────
const sunDir = new THREE.Vector3(0, 1, 0);
let _sunColorHex = 0xfffaaa;
let _sunIntensity = 1.15;
let _ambColorHex = 0xffffff;
let _ambIntensity = 0.55;
let _horizColorHex = 0x90c8f0;

// Objetos de céu noturno — preenchidos em initSky
let starMat = null;
let moonMesh = null;
let moonLight = null;
let mwMat = null;
let neb1Mat = null;
let neb2Mat = null;
let skyUniforms = null;

// ─── ShaderMaterial ──────────────────────────────────────────────────────────
const vertexShader = /* glsl */`
varying vec3 vWorldPos;
void main() {
  vec4 worldPos = modelMatrix * vec4(position, 1.0);
  vWorldPos = worldPos.xyz;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const fragmentShader = /* glsl */`
uniform vec3 sunDirection;
uniform vec3 topColor;
uniform vec3 horizonColor;
uniform vec3 sunColor;
uniform float sunVisible;

varying vec3 vWorldPos;

void main() {
  vec3 dir = normalize(vWorldPos);
  float altitude = dir.y; // -1 to +1

  // Mistura horizonte → zênite
  float t = smoothstep(-0.1, 0.4, altitude);
  vec3 skyColor = mix(horizonColor, topColor, t);

  // Halo do sol
  float sunDot = dot(dir, normalize(sunDirection));
  float sunGlow = pow(max(0.0, sunDot), 64.0);
  skyColor += sunColor * sunGlow * sunVisible * 0.5;

  // Disco solar
  float sunDisc = smoothstep(0.9975, 0.9995, sunDot);
  skyColor = mix(skyColor, vec3(1.0, 0.98, 0.92), sunDisc * sunVisible);

  gl_FragColor = vec4(skyColor, 1.0);
}
`;

// ─── Paletas por fase do dia ──────────────────────────────────────────────────
function getSkyPalette(tod) {
  // Fases: noite(0-0.15, 0.85-1.0), amanhecer(0.15-0.3), dia(0.3-0.7), entardecer(0.7-0.85)
  const night   = { top: new THREE.Color(0x060e1e), horiz: new THREE.Color(0x0a1628), sun: new THREE.Color(0x000000), sunVis: 0.0 };
  const dawn    = { top: new THREE.Color(0x1a2a5e), horiz: new THREE.Color(0xff6030), sun: new THREE.Color(0xffd080), sunVis: 1.0 };
  const day     = { top: new THREE.Color(0x1a70e0), horiz: new THREE.Color(0x90c8f0), sun: new THREE.Color(0xfffaaa), sunVis: 1.0 };
  const dusk    = { top: new THREE.Color(0x1a2060), horiz: new THREE.Color(0xe04010), sun: new THREE.Color(0xff9040), sunVis: 1.0 };

  let a, b, k;

  if (tod < 0.15) {
    // Noite pura
    return { ...night };
  } else if (tod < 0.25) {
    // Noite → Amanhecer
    k = smoothstepJS((tod - 0.15) / 0.10);
    return lerpPalette(night, dawn, k);
  } else if (tod < 0.32) {
    // Amanhecer → Dia
    k = smoothstepJS((tod - 0.25) / 0.07);
    return lerpPalette(dawn, day, k);
  } else if (tod < 0.68) {
    // Dia puro
    return { ...day };
  } else if (tod < 0.75) {
    // Dia → Entardecer
    k = smoothstepJS((tod - 0.68) / 0.07);
    return lerpPalette(day, dusk, k);
  } else if (tod < 0.85) {
    // Entardecer
    return { ...dusk };
  } else if (tod < 0.92) {
    // Entardecer → Noite
    k = smoothstepJS((tod - 0.85) / 0.07);
    return lerpPalette(dusk, night, k);
  } else {
    return { ...night };
  }
}

function smoothstepJS(t) {
  t = Math.max(0, Math.min(1, t));
  return t * t * (3 - 2 * t);
}

function lerpPalette(a, b, k) {
  const top   = new THREE.Color().lerpColors(a.top, b.top, k);
  const horiz = new THREE.Color().lerpColors(a.horiz, b.horiz, k);
  const sun   = new THREE.Color().lerpColors(a.sun, b.sun, k);
  const sunVis = a.sunVis + (b.sunVis - a.sunVis) * k;
  return { top, horiz, sun, sunVis };
}

// ─── Luz ambiente / sol dinâmicos ────────────────────────────────────────────
function computeLighting(tod, palette) {
  // Intensidade direcional: 0 à noite, pico 1.15 ao meio-dia
  const isNight = tod < 0.15 || tod > 0.92;
  const isDawn  = tod >= 0.15 && tod < 0.32;
  const isDusk  = tod >= 0.68 && tod < 0.92;
  const isDay   = tod >= 0.32 && tod < 0.68;

  let dirInt  = 0;
  let ambInt  = 0.18;
  if (isDay)   { dirInt = 1.15; ambInt = 0.55; }
  else if (isDawn) {
    const k = (tod - 0.15) / 0.17;
    dirInt = k * 0.8;
    ambInt = 0.18 + k * 0.37;
  } else if (isDusk) {
    const k = 1.0 - (tod - 0.68) / 0.24;
    dirInt = k * 0.8;
    ambInt = 0.18 + k * 0.37;
  } else {
    dirInt = 0;
    ambInt = 0.18;
  }

  _sunIntensity = dirInt;
  _ambIntensity = ambInt;

  // Cor do sol da direcional = cor do sol da paleta
  const sc = palette.sun;
  if (dirInt > 0) {
    _sunColorHex = sc.getHex();
  } else {
    _sunColorHex = 0x111122;
  }

  // Cor ambiente: azulada à noite, branca de dia
  const ac = palette.horiz.clone().multiplyScalar(0.6);
  if (isNight) {
    _ambColorHex = 0x0a0e1a;
  } else {
    _ambColorHex = ac.getHex();
  }

  // Cor do horizonte para fog
  _horizColorHex = palette.horiz.getHex();
}

// ─── Estrelas ────────────────────────────────────────────────────────────────
function buildStars(scene) {
  const starCount = 3000;
  const positions = new Float32Array(starCount * 3);
  const colors    = new Float32Array(starCount * 3);

  for (let i = 0; i < starCount; i++) {
    const theta = Math.random() * Math.PI * 2;
    const phi   = Math.acos(2 * Math.random() - 1);
    const r = 3700;
    positions[i*3]   = r * Math.sin(phi) * Math.cos(theta);
    positions[i*3+1] = r * Math.cos(phi);
    positions[i*3+2] = r * Math.sin(phi) * Math.sin(theta);

    const type = Math.random();
    if      (type < 0.15) { colors[i*3]=0.7; colors[i*3+1]=0.8; colors[i*3+2]=1.0; }
    else if (type < 0.25) { colors[i*3]=1.0; colors[i*3+1]=0.95; colors[i*3+2]=0.7; }
    else                  { colors[i*3]=1.0; colors[i*3+1]=1.0; colors[i*3+2]=1.0; }
  }

  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  starGeo.setAttribute('color',    new THREE.BufferAttribute(colors, 3));

  starMat = new THREE.PointsMaterial({
    size: 1.2, sizeAttenuation: false,
    vertexColors: true, transparent: true, opacity: 0,
  });
  const stars = new THREE.Points(starGeo, starMat);
  scene.add(stars);
}

// ─── Lua ─────────────────────────────────────────────────────────────────────
function buildMoon(scene) {
  const moonCanvas = (typeof document !== 'undefined') ? document.createElement('canvas') : null;
  if (!moonCanvas) return;
  moonCanvas.width = moonCanvas.height = 128;
  const mctx = moonCanvas.getContext('2d');
  mctx.fillStyle = '#d0ccc0';
  mctx.beginPath(); mctx.arc(64, 64, 60, 0, Math.PI*2); mctx.fill();
  [[30,35,14],[80,50,10],[55,85,8],[20,70,6],[85,80,12],[45,20,9]].forEach(([cx,cy,cr]) => {
    const g = mctx.createRadialGradient(cx,cy,0,cx,cy,cr);
    g.addColorStop(0,'rgba(160,155,140,0.8)');
    g.addColorStop(1,'rgba(208,204,192,0)');
    mctx.fillStyle = g;
    mctx.beginPath(); mctx.arc(cx,cy,cr,0,Math.PI*2); mctx.fill();
  });
  const moonTex = new THREE.CanvasTexture(moonCanvas);
  moonMesh = new THREE.Mesh(
    new THREE.SphereGeometry(55, 16, 16),
    new THREE.MeshBasicMaterial({ map: moonTex }),
  );
  scene.add(moonMesh);
}

// ─── Via Láctea ──────────────────────────────────────────────────────────────
function buildMilkyWay(scene) {
  const mwCount = 1200;
  const mwPositions = new Float32Array(mwCount * 3);
  const mwColors    = new Float32Array(mwCount * 3);
  for (let i = 0; i < mwCount; i++) {
    const t = i / mwCount;
    const spread = (Math.random() - 0.5) * 0.4;
    const phi   = Math.PI * (0.3 + spread * 0.3);
    const theta = t * Math.PI * 2;
    const r = 3600;
    mwPositions[i*3]   = r * Math.sin(phi) * Math.cos(theta);
    mwPositions[i*3+1] = r * Math.cos(phi) + spread * r * 0.15;
    mwPositions[i*3+2] = r * Math.sin(phi) * Math.sin(theta);
    const mix = Math.random();
    mwColors[i*3]   = 0.7 + mix * 0.3;
    mwColors[i*3+1] = 0.6 + mix * 0.2;
    mwColors[i*3+2] = 0.9 + mix * 0.1;
  }
  const mwGeo = new THREE.BufferGeometry();
  mwGeo.setAttribute('position', new THREE.BufferAttribute(mwPositions, 3));
  mwGeo.setAttribute('color',    new THREE.BufferAttribute(mwColors, 3));
  mwMat = new THREE.PointsMaterial({
    size: 0.9, sizeAttenuation: false, vertexColors: true, transparent: true, opacity: 0,
  });
  scene.add(new THREE.Points(mwGeo, mwMat));
}

// ─── Nebulosas ───────────────────────────────────────────────────────────────
function makeNebulaCanvas(color1, color2, w, h) {
  if (typeof document === 'undefined') return null;
  const nc = document.createElement('canvas');
  nc.width = w; nc.height = h;
  const nctx = nc.getContext('2d');
  const g = nctx.createRadialGradient(w/2, h/2, 0, w/2, h/2, w/2);
  g.addColorStop(0, color1);
  g.addColorStop(0.5, color2);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  nctx.fillStyle = g;
  nctx.fillRect(0, 0, w, h);
  return new THREE.CanvasTexture(nc);
}

function buildNebulae(scene) {
  const tex1 = makeNebulaCanvas('rgba(180,80,180,0.3)','rgba(80,40,120,0.15)',256,128);
  if (!tex1) return;
  neb1Mat = new THREE.MeshBasicMaterial({ map: tex1, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false });
  const neb1 = new THREE.Mesh(new THREE.PlaneGeometry(500, 280), neb1Mat);
  neb1.position.set(2000, 800, -3000);
  neb1.lookAt(0,0,0);
  scene.add(neb1);

  const tex2 = makeNebulaCanvas('rgba(60,120,200,0.25)','rgba(40,160,120,0.1)',256,128);
  neb2Mat = new THREE.MeshBasicMaterial({ map: tex2, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false });
  const neb2 = new THREE.Mesh(new THREE.PlaneGeometry(400, 200), neb2Mat);
  neb2.position.set(-2500, 600, -2800);
  neb2.lookAt(0,0,0);
  scene.add(neb2);
}

// ─── API pública ─────────────────────────────────────────────────────────────

/** Inicializa sky dome + objetos noturnos. Deve ser chamado uma vez em scene.js / main.js. */
export function initSky(scene) {
  // Sky dome
  skyUniforms = {
    sunDirection: { value: sunDir.clone() },
    topColor:     { value: new THREE.Color(0x1a70e0) },
    horizonColor: { value: new THREE.Color(0x90c8f0) },
    sunColor:     { value: new THREE.Color(0xfffaaa) },
    sunVisible:   { value: 1.0 },
  };

  const skyMat = new THREE.ShaderMaterial({
    uniforms:       skyUniforms,
    vertexShader,
    fragmentShader,
    side:           THREE.BackSide,
    depthWrite:     false,
  });

  const skyDome = new THREE.Mesh(new THREE.SphereGeometry(3800, 32, 32), skyMat);
  skyDome.renderOrder = -1;
  scene.add(skyDome);

  // Objetos noturnos
  buildStars(scene);
  buildMoon(scene);
  buildMilkyWay(scene);
  buildNebulae(scene);

  // Luz lunar — começa desligada, intensidade aumenta com nightFactor
  moonLight = new THREE.DirectionalLight(0x8899cc, 0.0);
  scene.add(moonLight);

  // Sincroniza estado inicial com timeOfDay = 0.35 (dia)
  _applyTimeOfDay(game.timeOfDay || 0.35);
}

/** Avança o ciclo dia/noite e atualiza uniforms do shader. */
export function updateSky(dt) {
  // Avança timeOfDay
  if (typeof game.timeOfDay === 'undefined') game.timeOfDay = 0.35;
  const speed = (typeof DAY_CYCLE_SPEED !== 'undefined') ? DAY_CYCLE_SPEED : 0.003;
  game.timeOfDay = (game.timeOfDay + dt * speed) % 1.0;

  _applyTimeOfDay(game.timeOfDay);
}

function _applyTimeOfDay(tod) {
  const palette = getSkyPalette(tod);
  computeLighting(tod, palette);

  // Posição do sol
  const angle = tod * Math.PI * 2 - Math.PI * 0.5;
  sunDir.set(Math.cos(angle), Math.sin(angle), 0.3).normalize();

  // Uniforms shader
  if (skyUniforms) {
    skyUniforms.sunDirection.value.copy(sunDir);
    skyUniforms.topColor.value.copy(palette.top);
    skyUniforms.horizonColor.value.copy(palette.horiz);
    skyUniforms.sunColor.value.copy(palette.sun);
    skyUniforms.sunVisible.value = palette.sunVis;
  }

  // Objetos noturnos — nightFactor = 1 na escuridão total, 0 de dia
  const nightFactor = _nightFactor(tod);

  if (starMat) starMat.opacity = Math.min(1.0, nightFactor) * 0.9;

  if (moonMesh) {
    moonMesh.position.copy(sunDir).multiplyScalar(-3500);
    moonMesh.visible = nightFactor > 0.05;
    if (moonLight) {
      moonLight.position.copy(moonMesh.position);
      moonLight.intensity = nightFactor * 0.25;
    }
  }

  if (mwMat)  mwMat.opacity  = nightFactor * 0.5;
  if (neb1Mat) neb1Mat.opacity = nightFactor * 0.8;
  if (neb2Mat) neb2Mat.opacity = nightFactor * 0.6;
}

function _nightFactor(tod) {
  // 1 quando completamente noite (tod < 0.1 ou > 0.9), 0 de dia (0.35-0.65)
  if (tod < 0.1) return 1.0;
  if (tod < 0.20) return 1.0 - smoothstepJS((tod - 0.1) / 0.10);
  if (tod < 0.80) return 0.0;
  if (tod < 0.90) return smoothstepJS((tod - 0.80) / 0.10);
  return 1.0;
}

/** Retorna dados do sol para iluminação direcional. */
export function getSunData() {
  return {
    direction: sunDir,
    color: _sunColorHex,
    intensity: _sunIntensity,
  };
}

/** Retorna dados da luz ambiente. */
export function getAmbientData() {
  return {
    color: _ambColorHex,
    intensity: _ambIntensity,
  };
}

/** Retorna a cor do horizonte para o fog. */
export function getSkyColor() {
  return _horizColorHex;
}
