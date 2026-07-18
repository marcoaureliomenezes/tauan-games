// sky.js — Céu Preetham (vendor/jsm/objects/Sky.js) dirigido pelo sunDir do ciclo
// dia/noite + objetos noturnos (estrelas, lua, via láctea, nebulosas).
// Exporta: initSky, updateSky, getSunData, getAmbientData, getSkyColor.
// Para ajustar a atmosfera (cor do dusk, neblina), edite SKY em config.js.
//
// T-V-05 (inhauma-visual-uplift-v1): substitui o gradiente de 2 paradas (flat,
// banding, dusk quase PRETO) pelo dome analítico de Preetham. getSkyColor()
// devolve a cor REAL do horizonte do dome via um espelho JS do shader — é ela
// que alimenta o fog (T-V-04), matando a emenda fog↔céu que a auditoria flagrou.
//
// FIX (legado): _skyGroup segue a câmera a cada frame para que o dome e os
// objetos noturnos nunca saiam do frustum ao voar longe da origem.

import * as THREE from '../../vendor/three.module.min.js';
import { Sky } from '../../vendor/jsm/objects/Sky.js';
import { game } from './state.js';
import { DAY_CYCLE_SPEED, SKY } from './config.js';
import { camera } from './scene.js';

// ─── Referências internas ────────────────────────────────────────────────────
const sunDir = new THREE.Vector3(0, 1, 0);
let _sunColorHex = 0xfffaaa;
let _sunIntensity = 1.15;
let _ambColorHex = 0xffffff;
let _ambGroundHex = 0x4a4438;
let _ambIntensity = 0.55;

// Cor REAL do horizonte do dome em linear space (espelho JS do shader Preetham).
// É o que main.js aplica no fog — NÃO converta de/para sRGB ao consumir.
const _horizColor = new THREE.Color(0x90c8f0);

// Grupo que encapsula dome + objetos noturnos — segue a câmera em updateSky()
let _skyGroup = null;
let _skyUniforms = null;

// Objetos de céu noturno — preenchidos em initSky
let starMat = null;
let moonMesh = null;
let moonLight = null;
let mwMat = null;
let neb1Mat = null;
let neb2Mat = null;

// Vetores/cores reutilizáveis — sem alocação por frame
const _moonWorldPos = new THREE.Vector3();
const _c1 = new THREE.Color();
const _c2 = new THREE.Color();
const _sampleDir = new THREE.Vector3();

// Tinta noturna do dome (T-V-05): o "nightsky hack" do shader Preetham (L0=0.1*Fex)
// deixa o céu noturno CINZA-claro demais; este uniform escurece/azula à noite.
// A MESMA tinta é aplicada no espelho JS (getSkyColor) para o fog não descolar.
const _nightTint = { value: new THREE.Vector3(1, 1, 1) };

// ─── Espelho JS do shader Preetham (T-V-05) ──────────────────────────────────
// Replica a matemática de vendor/jsm/objects/Sky.js para amostrar a cor do
// horizonte em CPU. Se o shader vendored mudar, esta seção precisa acompanhar.
const P_TOTAL_RAYLEIGH = [5.804542996261093e-6, 1.3562911419845635e-5, 3.0265902468824876e-5];
const P_MIE_CONST = [1.8399918514433978e14, 2.7798023919660528e14, 4.0790479543861094e14];
const P_CUTOFF = 1.6110731556870734; // earth shadow hack do shader
const P_STEEPNESS = 1.5;
const P_EE = 1000.0;

function _pSunIntensity(zenithCos) {
  const z = Math.max(-1, Math.min(1, zenithCos));
  return P_EE * Math.max(0, 1 - Math.exp(-((P_CUTOFF - Math.acos(z)) / P_STEEPNESS)));
}

// Avalia o shader para uma direção; devolve o retColor linear em `out`.
function _preethamSample(dir, sun, p, out) {
  const vSunE = _pSunIntensity(sun.y);
  const betaR = P_TOTAL_RAYLEIGH.map((c) => c * p.rayleigh);
  const mieK = 0.434 * (0.2 * p.turbidity) * 10e-18 * p.mieCoefficient;
  const betaM = P_MIE_CONST.map((c) => c * mieK);

  const zenith = Math.acos(Math.max(0, dir.y));
  const inv = 1 / (Math.cos(zenith) + 0.15 * Math.pow(93.885 - (zenith * 180) / Math.PI, -1.253));
  const sR = 8400 * inv;
  const sM = 1250 * inv;

  const cosTheta = dir.dot(sun);
  const rc = cosTheta * 0.5 + 0.5;
  const rPhase = 0.05968310365946075 * (1 + rc * rc); // 3/(16π) * (1 + cos²)
  const g = p.mieDirectionalG;
  const mPhase = 0.07957747154594767 * ((1 - g * g) / Math.pow(1 - 2 * g * cosTheta + g * g, 1.5)); // 1/(4π)·HG
  const mixK = Math.min(1, Math.max(0, Math.pow(1 - sun.y, 5)));

  const rgb = [0, 1, 2].map((i) => {
    const fex = Math.exp(-(betaR[i] * sR + betaM[i] * sM));
    const theta = betaR[i] * rPhase + betaM[i] * mPhase;
    const base = betaR[i] + betaM[i];
    let lin = Math.pow(vSunE * (theta / base) * (1 - fex), 1.5);
    lin *= 1 + (Math.pow(vSunE * (theta / base) * fex, 0.5) - 1) * mixK;
    const tex = (lin + 0.1 * fex) * 0.04 + [0, 0.0003, 0.00075][i];
    return Math.pow(tex, 1 / 2.4); // vSunfade = 1 com sun unitário → expoente 1/(1.2+1.2)
  });
  out.setRGB(rgb[0], rgb[1], rgb[2]); // linear working space — ver _horizColor
}

// Mistura DAY/DUSK/NIGHT pela elevação do sol (contínuo — sem saltos por fase).
function _skyParams(elev, out) {
  const wDay = smoothstepJS((elev - 0.10) / 0.20);
  const wNight = 1 - smoothstepJS((elev + 0.12) / 0.09);
  const wDusk = Math.max(0, 1 - wDay - wNight);
  for (const k of ['turbidity', 'rayleigh', 'mieCoefficient', 'mieDirectionalG']) {
    out[k] = SKY.DAY[k] * wDay + SKY.DUSK[k] * wDusk + SKY.NIGHT[k] * wNight;
  }
  return out;
}

function smoothstepJS(t) {
  t = Math.max(0, Math.min(1, t));
  return t * t * (3 - 2 * t);
}

// ─── Luz ambiente / sol dinâmicos ────────────────────────────────────────────
function computeLighting(tod, elev) {
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
  }

  _sunIntensity = dirInt;
  _ambIntensity = ambInt;

  // Cor do sol: branco-quente no zênite, laranja perto do horizonte (T-V-05)
  if (dirInt > 0) {
    const lowK = 1 - smoothstepJS(elev / 0.3);
    _c1.setHex(0xfffaaa).lerp(_c2.setHex(0xff9038), lowK);
    _sunColorHex = _c1.getHex();
  } else {
    _sunColorHex = 0x111122;
  }

  // Hemisfério (T-V-07): cor do céu segue o horizonte real; ground é versão escura
  if (isNight) {
    _ambColorHex = 0x0a0e1a;
    _ambGroundHex = 0x05070c;
  } else {
    _ambColorHex = _c1.copy(_horizColor).multiplyScalar(0.6).getHex();
    _ambGroundHex = _c1.copy(_horizColor).multiplyScalar(0.22).getHex();
  }
}

// ─── Estrelas (T-V-05: size 2.0–2.5 com variação por estrela) ────────────────
// ShaderMaterial próprio porque PointsMaterial tem `size` único para todos os pontos.
const STAR_VS = /* glsl */`
attribute float aSize;
varying vec3 vColor;
void main() {
  vColor = color;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = aSize;
}
`;
const STAR_FS = /* glsl */`
uniform float uOpacity;
varying vec3 vColor;
void main() {
  float d = length(gl_PointCoord - 0.5);
  float a = smoothstep(0.5, 0.12, d) * uOpacity;
  if (a < 0.003) discard;
  gl_FragColor = vec4(vColor, a);
}
`;

function buildStars(parent) {
  const starCount = 3000;
  const positions = new Float32Array(starCount * 3);
  const colors    = new Float32Array(starCount * 3);
  const sizes     = new Float32Array(starCount);

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

    sizes[i] = 2.0 + Math.random() * 0.5; // T-V-05: era 1.2 fixo — invisível
  }

  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  starGeo.setAttribute('color',    new THREE.BufferAttribute(colors, 3));
  starGeo.setAttribute('aSize',    new THREE.BufferAttribute(sizes, 1));

  starMat = new THREE.ShaderMaterial({
    uniforms: { uOpacity: { value: 0 } },
    vertexShader: STAR_VS,
    fragmentShader: STAR_FS,
    vertexColors: true,
    transparent: true,
  });
  parent.add(new THREE.Points(starGeo, starMat));
}

// ─── Lua ─────────────────────────────────────────────────────────────────────
function buildMoon(parent) {
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
  // T-V-05: fade contínuo por opacity (era toggle duro de visible no anoitecer)
  moonMesh = new THREE.Mesh(
    new THREE.SphereGeometry(55, 16, 16),
    new THREE.MeshBasicMaterial({ map: moonTex, transparent: true, opacity: 0 }),
  );
  parent.add(moonMesh);
}

// ─── Via Láctea ──────────────────────────────────────────────────────────────
function buildMilkyWay(parent) {
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
  parent.add(new THREE.Points(mwGeo, mwMat));
}

// ─── Nebulosas (T-V-05: Sprite = auto-billboard; eram planos com rotação fixa) ─
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

function buildNebulae(parent) {
  const tex1 = makeNebulaCanvas('rgba(180,80,180,0.3)','rgba(80,40,120,0.15)',256,128);
  if (!tex1) return;
  neb1Mat = new THREE.SpriteMaterial({ map: tex1, transparent: true, opacity: 0, depthWrite: false });
  const neb1 = new THREE.Sprite(neb1Mat);
  neb1.position.set(2000, 800, -3000);
  neb1.scale.set(500, 280, 1); // mesmo tamanho angular dos planos antigos
  parent.add(neb1);

  const tex2 = makeNebulaCanvas('rgba(60,120,200,0.25)','rgba(40,160,120,0.1)',256,128);
  neb2Mat = new THREE.SpriteMaterial({ map: tex2, transparent: true, opacity: 0, depthWrite: false });
  const neb2 = new THREE.Sprite(neb2Mat);
  neb2.position.set(-2500, 600, -2800);
  neb2.scale.set(400, 200, 1);
  parent.add(neb2);
}

// ─── API pública ─────────────────────────────────────────────────────────────

/** Inicializa o dome Preetham + objetos noturnos. Deve ser chamado uma vez no boot. */
export function initSky(scene) {
  // Grupo que seguirá a câmera — evita que o dome saia do frustum ao voar longe da origem
  _skyGroup = new THREE.Group();
  scene.add(_skyGroup);

  // Dome Preetham (T-V-05). gl_Position.z = gl_Position.w no shader vendored faz o
  // dome renderizar sempre no far plane; a escala só precisa conter a câmera.
  const skyMesh = new Sky();
  skyMesh.scale.setScalar(SKY.SCALE);
  skyMesh.frustumCulled = false;
  skyMesh.renderOrder = -1;
  // Dither anti-banding (T-V-05): o gradiente atmosférico é suave demais para 8 bits.
  // Aproveita o patch para injetar a tinta noturna (uNightTint) no shader vendored.
  skyMesh.material.onBeforeCompile = (shader) => {
    shader.uniforms.uNightTint = _nightTint;
    shader.fragmentShader = ('uniform vec3 uNightTint;\n' + shader.fragmentShader).replace(
      'gl_FragColor = vec4( retColor, 1.0 );',
      'retColor *= uNightTint;\n\t\t\tretColor += ( fract( sin( dot( gl_FragCoord.xy, vec2( 12.9898, 78.233 ) ) ) * 43758.5453 ) - 0.5 ) * ( 1.0 / 255.0 );\n\t\t\tgl_FragColor = vec4( retColor, 1.0 );',
    );
  };
  _skyUniforms = skyMesh.material.uniforms;
  _skyGroup.add(skyMesh);

  // Objetos noturnos — adicionados ao grupo para seguirem a câmera
  buildStars(_skyGroup);
  buildMoon(_skyGroup);
  buildMilkyWay(_skyGroup);
  buildNebulae(_skyGroup);

  // Luz lunar — adicionada à scene (é uma luz direcional mundial)
  moonLight = new THREE.DirectionalLight(0x8899cc, 0.0);
  scene.add(moonLight);

  // Posição inicial do grupo = posição inicial da câmera
  _skyGroup.position.copy(camera.position);

  _applyTimeOfDay(game.timeOfDay || 0.35);
}

/** Avança o ciclo dia/noite e mantém o sky group centrado na câmera. */
export function updateSky(dt) {
  // Mantém dome + estrelas + lua centrados na câmera (elimina o oval preto)
  if (_skyGroup) _skyGroup.position.copy(camera.position);

  if (typeof game.timeOfDay === 'undefined') game.timeOfDay = 0.35;
  const speed = (typeof DAY_CYCLE_SPEED !== 'undefined') ? DAY_CYCLE_SPEED : 0.003;
  game.timeOfDay = (game.timeOfDay + dt * speed) % 1.0;

  _applyTimeOfDay(game.timeOfDay);
}

const _params = { turbidity: 0, rayleigh: 0, mieCoefficient: 0, mieDirectionalG: 0 };

function _applyTimeOfDay(tod) {
  // Posição do sol
  const angle = tod * Math.PI * 2 - Math.PI * 0.5;
  sunDir.set(Math.cos(angle), Math.sin(angle), 0.3).normalize();

  // Uniforms do dome Preetham — DUSK (turbidity/mie altos) faz o entardecer laranja
  _skyParams(sunDir.y, _params);
  if (_skyUniforms) {
    _skyUniforms.sunPosition.value.copy(sunDir);
    _skyUniforms.turbidity.value = _params.turbidity;
    _skyUniforms.rayleigh.value = _params.rayleigh;
    _skyUniforms.mieCoefficient.value = _params.mieCoefficient;
    _skyUniforms.mieDirectionalG.value = _params.mieDirectionalG;
  }

  // Cor real do horizonte (média de 8 azimutes ao redor do anel — captura o glow
  // alaranjado do lado do sol no dusk sem deixar o fog inteiro cor de pôr-do-sol) —
  // alimenta fog (T-V-04) e nuvens (T-V-08)
  const nightFactor = _nightFactor(tod);
  _nightTint.value.set(
    1 - nightFactor * 0.82,
    1 - nightFactor * 0.78,
    1 - nightFactor * 0.65,
  ); // noite cheia → (0.18, 0.22, 0.35): azul escuro, não cinza
  _horizColor.setRGB(0, 0, 0);
  const az0 = Math.atan2(sunDir.z, sunDir.x);
  for (let i = 0; i < 8; i++) {
    const az = az0 + (i * Math.PI) / 4;
    _sampleDir.set(Math.cos(az), 0.02, Math.sin(az)).normalize();
    _preethamSample(_sampleDir, sunDir, _params, _c1);
    _horizColor.add(_c1.multiplyScalar(1 / 8));
  }
  // Mesma tinta do dome — fog (T-V-04) e nuvens (T-V-08) não descolam do céu
  _horizColor.multiply(_c2.setRGB(_nightTint.value.x, _nightTint.value.y, _nightTint.value.z));

  computeLighting(tod, sunDir.y);

  // Objetos noturnos — nightFactor = 1 na escuridão total, 0 de dia

  if (starMat) starMat.uniforms.uOpacity.value = Math.min(1.0, nightFactor) * 0.9;

  if (moonMesh) {
    // Posição LOCAL ao grupo (a lua fica 3500 u do player, na direção anti-sol)
    moonMesh.position.copy(sunDir).multiplyScalar(-3500);
    moonMesh.material.opacity = nightFactor; // T-V-05: fade contínuo
    if (moonLight) {
      // moonLight é world-space; posição = posição do grupo + posição local da lua
      _moonWorldPos.addVectors(_skyGroup ? _skyGroup.position : moonMesh.position, moonMesh.position);
      moonLight.position.copy(_moonWorldPos);
      moonLight.intensity = nightFactor * 0.25;
    }
  }

  if (mwMat)  mwMat.opacity  = nightFactor * 0.5;
  if (neb1Mat) neb1Mat.opacity = nightFactor * 0.8;
  if (neb2Mat) neb2Mat.opacity = nightFactor * 0.6;
}

function _nightFactor(tod) {
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

/** Retorna dados da luz ambiente (hemisfério: céu + solo). */
export function getAmbientData() {
  return {
    color: _ambColorHex,
    ground: _ambGroundHex,
    intensity: _ambIntensity,
  };
}

/** Cor REAL do horizonte do dome (THREE.Color em linear space) — para fog/clear color. */
export function getSkyColor() {
  return _horizColor;
}
