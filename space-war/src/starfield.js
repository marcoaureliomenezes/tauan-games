// starfield.js — O CORREDOR GALÁCTICO (T-IJ-02/03, AC-03/AC-04).
//
// A galáxia EXISTE entre os sistemas: duas camadas de estrelas 3D em "wrap
// infinito" (posição ≡ mod L ao redor da câmera — recycling determinístico sem
// alocação), com PARALAXE real (posições 3D: as próximas varrem rápido, as
// distantes deslizam) e RELATIVIDADE REALISTA no shader (brief 2026-07-04):
//   aberração   cos θ_ap = (cos θ + β)/(1 + β cos θ) (céu agrupa à frente)
//   Doppler     δ = 1/(γ(1 − β cos θ'))               (T' = δ·T: recolor térmico)
//   beaming     I ∝ δ⁴ (clamp)                        (frente brilha, trás apaga)
// Sem "starbow" (mito — McKinley & Doherty 1979) e sem achatar malhas
// (Terrell–Penrose): TODA a relatividade vive aqui e no tint do postfx.
// Nebulosas: billboards esparsos (Hα vermelho / O III teal / reflexão azul).

import * as THREE from '../../vendor/three.module.min.js';
import { scene, camera } from './scene.js';
import { game } from './state.js';
import { SYSTEMS } from './config.js';
import { HEADLESS, makeRadialSprite } from './celestial/atoms.js';

// Paleta espectral com pesos ~reais (76% M, raras O/B — mas os pesos visuais
// levemente enviesados p/ legibilidade).
const STAR_COLORS = [
  [0xff6a3a, 0.36], [0xff9a52, 0.22], [0xffd27a, 0.16], [0xfff2bf, 0.12],
  [0xf8f4e8, 0.07], [0xe4ecff, 0.04], [0xbcd2ff, 0.02], [0x9db4ff, 0.01],
];

function pickColor(r) {
  let acc = 0;
  for (const [c, w] of STAR_COLORS) { acc += w; if (r < acc) return c; }
  return 0xfff2bf;
}

// xorshift determinístico (sem Math.random no layout — recycling estável)
function rng(seed) {
  let x = seed | 0 || 88675123;
  return () => {
    x ^= x << 13; x ^= x >>> 17; x ^= x << 5;
    return ((x >>> 0) % 100000) / 100000;
  };
}

const LAYERS = [
  { count: HEADLESS ? 1400 : 3600, span: 900_000, size: 900, seed: 1234567 },   // NEAR: paralaxe forte
  { count: HEADLESS ? 700 : 1800, span: 3_200_000, size: 2600, seed: 7654321 }, // FAR: deriva lenta
];

const VERT = `
uniform vec3 uCam;
uniform float uSpan;
uniform float uBeta;
uniform vec3 uDir;
uniform float uFade;
uniform float uBase;
attribute vec3 aColor;
varying vec3 vColor;
varying float vBoost;
void main() {
  // wrap infinito: posição ≡ mod(span) centrada na câmera (recycling puro-GPU)
  vec3 p = mod(position - uCam + 0.5 * uSpan, uSpan) - 0.5 * uSpan;
  float dist = max(length(p), 1.0);
  vec3 dir = p / dist;
  float ct = dot(dir, uDir);
  // ABERRAÇÃO relativística — forma APARENTE (+β): o céu agrupa À FRENTE
  // (headlight effect); a 90° do rumo a estrela aparece em arccos β.
  float ctA = (ct + uBeta) / max(1.0 + uBeta * ct, 1e-4);
  vec3 perp = dir - uDir * ct;
  float pl = length(perp);
  vec3 dirA = (pl > 1e-5)
    ? normalize(uDir * ctA + (perp / pl) * sqrt(max(0.0, 1.0 - ctA * ctA)))
    : dir;
  vec3 pA = uCam + dirA * dist;
  // DOPPLER: δ = 1/(γ(1−β·cosθ')) — recolor térmico + beaming δ⁴ (clamp 5)
  float gamma = 1.0 / sqrt(max(1.0 - uBeta * uBeta, 1e-4));
  float delta = 1.0 / max(gamma * (1.0 - uBeta * ctA), 1e-3);
  vBoost = clamp(pow(delta, 4.0), 0.06, 5.0) * uFade;
  // corpo negro fica corpo negro com T' = δT: desloca a cor ao longo do locus
  // (aprox. jogável: δ>1 puxa p/ azul-branco, δ<1 p/ vermelho-escuro)
  vec3 c = aColor;
  float shift = clamp(delta - 1.0, -0.6, 1.2);
  vColor = mix(c, (shift > 0.0) ? vec3(0.75, 0.85, 1.0) : vec3(1.0, 0.45, 0.25), abs(shift) * 0.75);
  vec4 mv = modelViewMatrix * vec4(pA, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = clamp(uBase * 3000.0 / max(-mv.z, 1.0), 0.7, 7.0);
}
`;

const FRAG = `
varying vec3 vColor;
varying float vBoost;
void main() {
  vec2 uv = gl_PointCoord - 0.5;
  float d = length(uv);
  if (d > 0.5) discard;
  float glow = smoothstep(0.5, 0.0, d);
  gl_FragColor = vec4(vColor * vBoost, glow * min(vBoost, 1.0));
}
`;

const layers = [];
const nebulae = [];
const _c = new THREE.Vector3();
const _dirFlight = new THREE.Vector3(0, 0, -1);

export function buildStarfield() {
  for (const L of LAYERS) {
    const rand = rng(L.seed);
    const pos = new Float32Array(L.count * 3);
    const col = new Float32Array(L.count * 3);
    const c = new THREE.Color();
    for (let i = 0; i < L.count; i++) {
      pos[i * 3] = rand() * L.span;
      pos[i * 3 + 1] = rand() * L.span;
      pos[i * 3 + 2] = rand() * L.span;
      c.set(pickColor(rand()));
      const lum = 0.5 + rand() * 0.5;
      col[i * 3] = c.r * lum; col[i * 3 + 1] = c.g * lum; col[i * 3 + 2] = c.b * lum;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('aColor', new THREE.BufferAttribute(col, 3));
    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uCam: { value: new THREE.Vector3() },
        uSpan: { value: L.span },
        uBeta: { value: 0 },
        uDir: { value: new THREE.Vector3(0, 0, -1) },
        uFade: { value: 0 },
        uBase: { value: L.size },
      },
      vertexShader: VERT,
      fragmentShader: FRAG,
      transparent: true,
      depthWrite: false,
      blending: THREE.NormalBlending,     // gotcha: aditivo + log-depth + bloom = NaN
    });
    const points = new THREE.Points(geo, mat);
    points.frustumCulled = false;
    points.renderOrder = -8;              // atrás dos corpos, na frente do skybox
    scene.add(points);
    layers.push({ points, mat });
  }

  // Nebulosas esparsas (grade grande, reposicionadas por wrap na CPU — poucas)
  const NEB = [
    ['rgba(255,90,74,0.20)', 'rgba(160,40,30,0.08)'],    // Hα (emissão)
    ['rgba(74,216,200,0.16)', 'rgba(30,110,100,0.07)'],  // O III
    ['rgba(140,170,255,0.16)', 'rgba(60,80,160,0.07)'],  // reflexão
  ];
  const rand = rng(24681357);
  const NEB_SPAN = 2_800_000;
  for (let i = 0; i < (HEADLESS ? 3 : 9); i++) {
    const pal = NEB[i % NEB.length];
    const sp = makeRadialSprite([pal[0], pal[1], 'rgba(0,0,0,0)']);
    sp.material.blending = THREE.NormalBlending;
    sp.material.opacity = 0.0;
    sp.scale.setScalar(160_000 + rand() * 240_000);
    sp.userData.base = new THREE.Vector3(rand() * NEB_SPAN, rand() * NEB_SPAN, rand() * NEB_SPAN);
    sp.userData.span = NEB_SPAN;
    sp.renderOrder = -9;
    scene.add(sp);
    nebulae.push(sp);
  }
  game.starfield = { layers: layers.length, stars: LAYERS.reduce((a, l) => a + l.count, 0) };
}

// Fade fora dos sistemas: dentro do raio do sistema → 0; no vazio → 1.
function systemFade(pos) {
  let f = 1;
  for (const sys of SYSTEMS) {
    _c.set(...sys.center);
    const d = pos.distanceTo(_c) / Math.max(1, sys.radius);
    f = Math.min(f, THREE.MathUtils.smoothstep(d, 0.85, 1.5));
  }
  return f;
}

export function updateStarfield() {
  if (!layers.length) return;
  const s = game.ship;
  const j = game.journey;
  const beta = j && j.active ? Math.min(0.985, j.beta) : 0;
  if (s.vel && s.vel.lengthSq() > 1) _dirFlight.copy(s.vel).normalize();
  const fade = Math.max(systemFade(camera.position), j && j.active ? 0.85 : 0);

  for (const L of layers) {
    L.mat.uniforms.uCam.value.copy(camera.position);
    L.mat.uniforms.uBeta.value = beta;
    L.mat.uniforms.uDir.value.copy(_dirFlight);
    L.mat.uniforms.uFade.value = fade;
  }
  game.starfieldFade = fade;                 // diagnóstico p/ e2e
  game.starfieldBeta = beta;

  for (const sp of nebulae) {
    const span = sp.userData.span, b = sp.userData.base;
    sp.position.set(
      ((b.x - camera.position.x) % span + span * 1.5) % span - span * 0.5 + camera.position.x,
      ((b.y - camera.position.y) % span + span * 1.5) % span - span * 0.5 + camera.position.y,
      ((b.z - camera.position.z) % span + span * 1.5) % span - span * 0.5 + camera.position.z,
    );
    sp.material.opacity = 0.30 * fade;
  }
}
