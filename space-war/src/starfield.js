// starfield.js — O CORREDOR GALÁCTICO (T-IJ-02/03; rewrite fotométrico T-PS-03).
//
// A galáxia EXISTE entre os sistemas: duas camadas de estrelas 3D em "wrap
// infinito" (posição ≡ mod L ao redor da câmera — recycling determinístico sem
// alocação), com PARALAXE real e RELATIVIDADE REALISTA no shader:
//   aberração   cos θ_ap = (cos θ + β)/(1 + β cos θ) (céu agrupa à frente)
//   Doppler     δ = 1/(γ(1 − β cos θ'))               (T' = δ·T: recolor térmico)
//   beaming     I ∝ δ⁴ (clamp)                        (frente brilha, trás apaga)
//
// FOTOMETRIA (bug space-war-starfield-fixed-size-points): estrela é fonte
// NÃO-RESOLVIDA — QUADS INSTANCIADOS (não GL_POINTS: spec WebGL só garante 1px
// de teto; WebGPU nem tem gl_PointSize) com núcleo de tamanho FIXO em pixels e
// BRILHO pelo fluxo I = L·(D0/d)² (espelho GLSL de celestial/physics.js —
// pointIntensity/pointPx/pointAlpha, unit-provadas). Nascem APAGADAS na borda
// da célula do wrap e ACENDEM ao aproximar; só CRESCEM na passagem rasante
// (glare ∝ √(I−1), Spencer 1995 — conserva energia).
// Nebulosas: billboards esparsos (Hα vermelho / O III teal / reflexão azul).

import * as THREE from '../../vendor/three.module.min.js';
import { scene, camera } from './scene.js';
import { game } from './state.js';
import { SYSTEMS } from './config.js';
import { HEADLESS, makeRadialSprite } from './celestial/atoms.js';
import { SYSTEM_FADE_INNER, SYSTEM_FADE_OUTER, boundaryFade } from './celestial/physics.js';

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

// d0: gauge de CAMPO (I=1 p/ L=1 a d0) — típico I 0.05–1 ("poeira que acende");
// rasante satura e o glare cresce. corePx/glareK/maxPx: PSF do campo.
const LAYERS = [
  { count: HEADLESS ? 1400 : 3600, span: 900_000, d0: 120_000, corePx: 1.9, glareK: 2.2, maxPx: 12, radMax: 3200, seed: 1234567 },   // NEAR: paralaxe forte
  { count: HEADLESS ? 700 : 1800, span: 3_200_000, d0: 260_000, corePx: 1.6, glareK: 1.8, maxPx: 9, radMax: 1400, seed: 7654321 },  // FAR: deriva lenta
];
// Passagem rasante (AC-02, operador): teto do crescimento angular (2·R/d) e
// ganho dos RISCOS tangenciais (AC-04: comprimento ∝ ω = v·senθ/d).
const CLOSE_MAX_PX = 48;
const STREAK_K = 12;

const VERT = `
uniform vec3 uCam;        // câmera GALÁCTICA (wrap invariante ao rebase da origem)
uniform vec3 uCamScene;   // câmera no frame da CENA (posicionamento do quad)
uniform float uSpan;
uniform float uBeta;
uniform vec3 uDir;
uniform float uFade;
uniform float uD0;
uniform float uCorePx;
uniform float uGlareK;
uniform float uMaxPx;
uniform float uPxAngle;
uniform float uSpeed;
uniform float uCloseMax;
uniform float uStreakK;
uniform vec3 uCamRight;
uniform vec3 uCamUp;
attribute vec3 iPos;
attribute vec3 iColor;
attribute float iLum;
attribute float iRad;
varying vec3 vColor;
varying float vAlpha;
varying vec2 vQuad;
void main() {
  // wrap infinito: posição ≡ mod(span) centrada na câmera (recycling puro-GPU)
  vec3 c = mod(iPos - uCam + 0.5 * uSpan, uSpan) - 0.5 * uSpan;
  float dist = max(length(c), 1.0);
  vec3 dir = c / dist;
  float ct = dot(dir, uDir);
  // ABERRAÇÃO relativística — forma APARENTE (+β): o céu agrupa À FRENTE
  // (headlight effect); a 90° do rumo a estrela aparece em arccos β.
  float ctA = (ct + uBeta) / max(1.0 + uBeta * ct, 1e-4);
  vec3 perp = dir - uDir * ct;
  float pl = length(perp);
  vec3 dirA = (pl > 1e-5)
    ? normalize(uDir * ctA + (perp / pl) * sqrt(max(0.0, 1.0 - ctA * ctA)))
    : dir;
  // FOTOMETRIA (espelho de physics.pointIntensity/pointPx/pointAlpha):
  // I = L·(D0/d)²; núcleo FIXO + glare √(I−1) com teto; α = clamp(I,0,1).
  float I = iLum * (uD0 * uD0) / (dist * dist);
  float px = min(uCorePx + ((I > 1.0) ? uGlareK * sqrt(I - 1.0) : 0.0), uMaxPx);
  // PASSAGEM RASANTE (AC-02): tamanho ANGULAR honesto 2·R/d — estrela com
  // parâmetro de impacto pequeno (perto do centro da tela) CRESCE antes de
  // cruzarmos; as que se afastam do rumo continuam pontos.
  px = min(px + (2.0 * iRad / dist) / uPxAngle, uCloseMax);
  // fade na borda da célula do wrap: nasce APAGADA, acende ao entrar (20% finais)
  vec3 an = abs(c) / (0.5 * uSpan);
  float edge = 1.0 - smoothstep(0.80, 1.0, max(an.x, max(an.y, an.z)));
  // DOPPLER: δ = 1/(γ(1−β·cosθ')) — recolor térmico + beaming δ⁴ (clamp 5)
  float gamma = 1.0 / sqrt(max(1.0 - uBeta * uBeta, 1e-4));
  float delta = 1.0 / max(gamma * (1.0 - uBeta * ctA), 1e-3);
  float boost = clamp(pow(delta, 4.0), 0.02, 9.0);   // headlight FORTE (AC-03)
  // corpo negro fica corpo negro com T' = δT: desloca a cor ao longo do locus
  float shift = clamp(delta - 1.0, -0.6, 1.2);
  vColor = mix(iColor, (shift > 0.0) ? vec3(0.75, 0.85, 1.0) : vec3(1.0, 0.45, 0.25), abs(shift) * 0.75) * boost;
  // RISCOS TANGENCIAIS (AC-04): a taxa angular aparente ω = v·senθ'/d explode
  // na passagem — o ponto vira um risco RADIAL de tela (persistência de visão,
  // como nos sims de referência). streak em múltiplos da largura do quad.
  float sinA = sqrt(max(0.0, 1.0 - ctA * ctA));
  float streak = clamp(uStreakK * uSpeed * sinA / max(dist, 1.0), 0.0, 10.0);
  // eixos do quad: A = direção radial-de-tela do fluxo (⊥ dirA), B = ⊥ ambos —
  // o plano continua de frente p/ a câmera; streak 0 → PSF circular idêntica.
  vec3 radial = dirA - uDir * dot(dirA, uDir);
  vec3 aR = radial - dirA * dot(radial, dirA);
  float al = length(aR);
  vec3 axisA = (al > 1e-4) ? aR / al : uCamRight;
  vec3 axisB = normalize(cross(dirA, axisA));
  // energia se espalha pelo risco: α cai com o alongamento (conservação)
  vAlpha = clamp(I, 0.0, 1.0) * edge * uFade * min(boost, 1.0) / (1.0 + 0.5 * streak);
  vQuad = position.xy * 2.0;                       // −1..1 no quad
  // quad subtendendo px PIXELS (eixo A alongado pelo risco)
  float world = px * dist * uPxAngle;
  vec3 pA = uCamScene + dirA * dist
    + axisA * position.x * world * (1.0 + streak)
    + axisB * position.y * world;
  gl_Position = projectionMatrix * viewMatrix * vec4(pA, 1.0);
}
`;

const FRAG = `
varying vec3 vColor;
varying float vAlpha;
varying vec2 vQuad;
void main() {
  float r2 = dot(vQuad, vQuad);
  if (r2 > 1.0) discard;
  float psf = exp(-3.2 * r2);                      // PSF gaussiana
  gl_FragColor = vec4(vColor, psf * vAlpha);
}
`;

const layers = [];
const nebulae = [];
const _c = new THREE.Vector3();
const _dirFlight = new THREE.Vector3(0, 0, -1);
const _right = new THREE.Vector3();
const _up = new THREE.Vector3();

// Ângulo de 1 pixel: θ_px = 2·tan(fov/2)/altura — base do "px na tela".
export function pixelAngle() {
  const h = (typeof window !== 'undefined' && window.innerHeight) || 1080;
  return 2 * Math.tan((camera.fov * Math.PI / 180) / 2) / h;
}

export function buildStarfield() {
  for (const L of LAYERS) {
    const rand = rng(L.seed);
    const pos = new Float32Array(L.count * 3);
    const col = new Float32Array(L.count * 3);
    const lum = new Float32Array(L.count);
    const rad = new Float32Array(L.count);
    const c = new THREE.Color();
    for (let i = 0; i < L.count; i++) {
      pos[i * 3] = rand() * L.span;
      pos[i * 3 + 1] = rand() * L.span;
      pos[i * 3 + 2] = rand() * L.span;
      c.set(pickColor(rand()));
      const tone = 0.5 + rand() * 0.5;
      col[i * 3] = c.r * tone; col[i * 3 + 1] = c.g * tone; col[i * 3 + 2] = c.b * tone;
      // classe de luminosidade: maioria fraca, raras brilhantes (cauda ∝ r³)
      const r = rand();
      lum[i] = 0.25 + 3.75 * r * r * r;
      // pseudo-raio (AC-02): estrelas SÃO sóis — passagens rasantes mostram
      // disco/glare crescendo (2R/d); maioria pequena, raras gigantes (∝ r²)
      const rr = rand();
      rad[i] = L.radMax * (0.18 + 0.82 * rr * rr);
    }
    const quad = new THREE.PlaneGeometry(1, 1);
    const geo = new THREE.InstancedBufferGeometry();
    geo.index = quad.index;
    geo.setAttribute('position', quad.getAttribute('position'));
    geo.setAttribute('iPos', new THREE.InstancedBufferAttribute(pos, 3));
    geo.setAttribute('iColor', new THREE.InstancedBufferAttribute(col, 3));
    geo.setAttribute('iLum', new THREE.InstancedBufferAttribute(lum, 1));
    geo.setAttribute('iRad', new THREE.InstancedBufferAttribute(rad, 1));
    geo.instanceCount = L.count;
    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uCam: { value: new THREE.Vector3() },
        uCamScene: { value: new THREE.Vector3() },
        uSpan: { value: L.span },
        uBeta: { value: 0 },
        uDir: { value: new THREE.Vector3(0, 0, -1) },
        uFade: { value: 0 },
        uD0: { value: L.d0 },
        uCorePx: { value: L.corePx },
        uGlareK: { value: L.glareK },
        uMaxPx: { value: L.maxPx },
        uPxAngle: { value: 0.001 },
        uSpeed: { value: 0 },
        uCloseMax: { value: CLOSE_MAX_PX },
        uStreakK: { value: STREAK_K },
        uCamRight: { value: new THREE.Vector3(1, 0, 0) },
        uCamUp: { value: new THREE.Vector3(0, 1, 0) },
      },
      vertexShader: VERT,
      fragmentShader: FRAG,
      transparent: true,
      depthWrite: false,
      blending: THREE.NormalBlending,     // gotcha: aditivo + log-depth + bloom = NaN
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.frustumCulled = false;
    mesh.renderOrder = -8;                // atrás dos corpos, na frente do skybox
    scene.add(mesh);
    layers.push({ mesh, mat });
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
  game.starfield = {
    layers: layers.length,
    stars: LAYERS.reduce((a, l) => a + l.count, 0),
    mode: 'instanced-quads',
  };
  game.starfieldPhoto = { d0: LAYERS[0].d0, corePx: LAYERS[0].corePx, maxPx: LAYERS[0].maxPx };
}

// Fade fora dos sistemas: dentro do raio do sistema → 0; no vazio → 1.
// EXPORTADO (audit P0-1): é a definição canônica de fronteira p/ TODOS os
// efeitos relativísticos (starfield, tint do postfx) — journey engajada dentro
// do sistema NÃO acende o corredor; ele nasce ao cruzar a fronteira.
// FASES (T-PR-06): só o sistema CARREGADO importa — ele vive na origem da
// cena; os outros estão a anos-luz (fade 1 por construção).
export function systemFade(pos) {
  const key = game.world?.systemKey;
  if (!key) return 1;
  const sys = SYSTEMS.find((s) => s.key === key);
  if (!sys) return 1;
  const d = pos.length() / Math.max(1, sys.radius);
  return boundaryFade(d, SYSTEM_FADE_INNER, SYSTEM_FADE_OUTER);
}

export function updateStarfield() {
  if (!layers.length) return;
  const s = game.ship;
  const j = game.journey;
  // FRONTEIRA MANDA (audit P0-1, bug "crossing stars inside the system"): o
  // floor 0.85 durante a journey anulava o systemFade e acendia o corredor
  // ainda DENTRO do sistema de origem. Agora o fade posicional governa sozinho,
  // e o β VISUAL é escalado por ele — a relatividade (aberração/Doppler/
  // beaming/streaks) só liga depois de cruzar a fronteira e desliga ao entrar
  // no destino. O β cinemático (journey.beta) segue intacto p/ HUD/perfil.
  const fade = systemFade(camera.position);
  const beta = j && j.active ? Math.min(0.995, j.beta) * fade : 0;
  if (s.vel && s.vel.lengthSq() > 1) _dirFlight.copy(s.vel).normalize();
  const pxA = pixelAngle();
  const e = camera.matrixWorld.elements;
  _right.set(e[0], e[1], e[2]).normalize();
  _up.set(e[4], e[5], e[6]).normalize();

  // Câmera GALÁCTICA p/ o wrap (fases T-PR-06): o rebase da origem no vazio
  // não pode teleportar o padrão de estrelas — o mod(span) é ancorado na
  // posição galáctica (origin + câmera), invariante ao rebase.
  _c.copy(camera.position);
  if (game.world?.origin) _c.add(game.world.origin);

  for (const L of layers) {
    const u = L.mat.uniforms;
    u.uCam.value.copy(_c);
    u.uCamScene.value.copy(camera.position);
    u.uBeta.value = beta;
    u.uDir.value.copy(_dirFlight);
    u.uFade.value = fade;
    u.uPxAngle.value = pxA;
    u.uSpeed.value = j && j.active ? j.v : (s.speed || 0);
    u.uCamRight.value.copy(_right);
    u.uCamUp.value.copy(_up);
  }
  game.starfieldFx = { closeMaxPx: CLOSE_MAX_PX, streakK: STREAK_K, beta };
  game.starfieldFade = fade;                 // diagnóstico p/ e2e
  game.starfieldBeta = beta;

  // Nebulosas: wrap na câmera GALÁCTICA (_c) — invariante ao rebase — e
  // reconversão p/ o frame da cena (galáctico − origin = cena).
  const ox = _c.x - camera.position.x, oy = _c.y - camera.position.y, oz = _c.z - camera.position.z;
  for (const sp of nebulae) {
    const span = sp.userData.span, b = sp.userData.base;
    sp.position.set(
      ((b.x - _c.x) % span + span * 1.5) % span - span * 0.5 + _c.x - ox,
      ((b.y - _c.y) % span + span * 1.5) % span - span * 0.5 + _c.y - oy,
      ((b.z - _c.z) % span + span * 1.5) % span - span * 0.5 + _c.z - oz,
    );
    sp.material.opacity = 0.30 * fade;
  }
}
