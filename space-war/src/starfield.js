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

// ═══ FÍSICA REPRODUZIDA (documentação de referência — operador 2026-07-17) ═══
// 1. ABERRAÇÃO RELATIVÍSTICA (efeito holofote/headlight): para um observador a
//    velocidade β=v/c, a direção APARENTE de uma estrela desloca-se PARA O RUMO:
//        cos θ_ap = (cos θ + β) / (1 + β·cos θ)
//    A β→1 o céu inteiro se CONCENTRA num círculo cada vez menor à frente —
//    a 0.995c uma estrela que estava a 90° aparece a ~5.7° do centro da tela.
//    É o efeito pedido: "a luz das estrelas no horizonte concentra ao meio".
// 2. DOPPLER RELATIVÍSTICO: δ = 1/(γ(1−β·cosθ')), γ = 1/√(1−β²). A cor de corpo
//    negro desloca com T' = δ·T — estrelas à frente azulam SUTILMENTE, atrás
//    avermelham. (Recolor CONTIDO: tinte leve, nunca ponto azul/vermelho puro.)
// 3. BEAMING (headlight fotométrico): I_obs ∝ δ⁴ — a frente brilha, a traseira
//    apaga. Aplicado no ALFA (brilho), com teto baixo na COR para o ponto
//    continuar parecendo ESTRELA (lei do operador: ponto sólido, nunca borrão).
// 4. PARALAXE: duas camadas em wrap infinito — NEAR (cruzamos de verdade, é o
//    "corredor" de estrelas passando) e FAR (horizonte quase estático que só
//    deriva). Estrelas perto do RUMO crescem ao aproximar (2R/d honesto);
//    as periféricas cruzam a tela sem mudar de tamanho aparente.
//
// d0: gauge de CAMPO (I=1 p/ L=1 a d0) — típico I 0.05–1 ("poeira que acende").
// DENSIDADE (operador 2026-07-17: "milhares; dezenas/centenas por segundo"):
// NEAR 9000 estrelas num cubo de 520k → a 154k u/s de cruzeiro cruzamos ~dezenas
// por segundo de perto e centenas contando o campo todo em movimento.
const LAYERS = [
  { count: HEADLESS ? 2000 : 9000, span: 520_000, d0: 170_000, corePx: 1.6, glareK: 0.8, maxPx: 4, radMax: 900, seed: 1234567 },   // NEAR: paralaxe forte
  { count: HEADLESS ? 1000 : 4000, span: 3_200_000, d0: 340_000, corePx: 1.4, glareK: 0.7, maxPx: 3.5, radMax: 500, seed: 7654321 },  // FAR: deriva lenta
];
// Passagem rasante (AC-02): teto do crescimento angular (2·R/d) — estrelas no
// CENTRO crescem ao aproximar; periféricas ficam pontos. Risco tangencial quase
// eliminado (operador 2026-07-17: "pontos consistentes, NUNCA borrões").
const CLOSE_MAX_PX = 12;

const VERT = `
uniform vec3 uCam;
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
  // GEOMETRIA com teto β=0.90 (cone ~26°): a 0.995 o céu inteiro caberia em
  // ~6° — fisicamente correto mas ilegível (vira meia dúzia de pixels no
  // centro). O funil fica dramático E populado; Doppler/beaming usam o β pleno.
  float bG = min(uBeta, 0.90);
  float ctA = (ct + bG) / max(1.0 + bG * ct, 1e-4);
  vec3 perp = dir - uDir * ct;
  float pl = length(perp);
  vec3 dirA = (pl > 1e-5)
    ? normalize(uDir * ctA + (perp / pl) * sqrt(max(0.0, 1.0 - ctA * ctA)))
    : dir;
  // PONTOS SÓLIDOS (operador 2026-07-17: "estrelas consistentes, opacas,
  // pequenos círculos"): o brilho físico modula POUCO — toda estrela do campo é
  // um ponto legível; o fluxo I só diferencia fraca/brilhante no tamanho.
  float I = iLum * (uD0 * uD0) / (dist * dist);
  float px = min(uCorePx + ((I > 1.0) ? uGlareK * sqrt(I - 1.0) : 0.0), uMaxPx);
  // MAIOR AO CENTRO: estrela perto do rumo (centro da tela) cresce; periférica
  // cruza a tela como ponto de tamanho constante.
  px *= mix(0.9, 1.3, smoothstep(0.55, 0.98, ctA));
  // PASSAGEM RASANTE (AC-02): tamanho ANGULAR honesto 2·R/d — a estrela que
  // vamos cruzar de verdade vira DISCO antes da passagem.
  px = min(px + (2.0 * iRad / dist) / uPxAngle, uCloseMax);
  // fade na borda da célula do wrap: nasce APAGADA, acende ao entrar (20% finais)
  vec3 an = abs(c) / (0.5 * uSpan);
  float edge = 1.0 - smoothstep(0.80, 1.0, max(an.x, max(an.y, an.z)));
  // DOPPLER: δ = 1/(γ(1−β·cosθ')) — recolor térmico + beaming. Usa o MESMO β
  // com teto da geometria: com β pleno 0.995 o beaming δ⁴ apagava TUDO fora do
  // último grau do cone (fisicamente correto, mas a tela ficava vazia).
  float gamma = 1.0 / sqrt(max(1.0 - bG * bG, 1e-4));
  float delta = 1.0 / max(gamma * (1.0 - bG * ctA), 1e-3);
  // beaming no BRILHO (alfa) — a COR tem teto BAIXO: acima o ponto virava um
  // borrão saturado azul/vermelho (bug reportado pelo operador 2026-07-17).
  float boost = clamp(pow(delta, 4.0), 0.02, 9.0);
  float colorBoost = clamp(boost, 0.15, 1.35);
  // corpo negro fica corpo negro com T' = δT: TINTE leve ao longo do locus
  float shift = clamp(delta - 1.0, -0.35, 0.5);
  vColor = mix(iColor, (shift > 0.0) ? vec3(0.80, 0.88, 1.0) : vec3(1.0, 0.62, 0.42), abs(shift) * 0.35) * colorBoost;
  // SEM riscos (operador 2026-07-17): o ponto NUNCA vira traço/borrão — a
  // sensação de velocidade vem do MOVIMENTO de centenas de pontos sólidos.
  // BILLBOARD nos eixos da CÂMERA: o antigo par radial/cross(dirA,axisA)
  // colapsava os quads neste driver (bug caçado por bisseção 2026-07-18 —
  // NENHUMA estrela do campo renderizava; era ESTE o "cadê as estrelas").
  vec3 axisA = uCamRight;
  vec3 axisB = uCamUp;
  // ALFA ALTO por padrão (ponto OPACO): o fluxo I só empurra de 0.65 → 1.0;
  // beaming suavizado (δ², piso 0.5) esmaece a periferia sem apagá-la.
  float aBoost = clamp(pow(delta, 2.0), 0.40, 1.0);
  vAlpha = clamp(0.55 + 0.35 * min(I, 1.0), 0.0, 1.0) * edge * uFade * aBoost;
  vQuad = position.xy * 2.0;                       // −1..1 no quad
  // quad subtendendo px PIXELS (eixo A alongado pelo risco)
  float world = px * dist * uPxAngle;
  vec3 pA = uCam + dirA * dist
    + axisA * position.x * world
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
  // CÍRCULO SÓLIDO com borda curta (anti-alias) — ponto de estrela consistente,
  // não gaussiana esfumaçada (lei do operador: nunca borrão).
  float disc = 1.0 - smoothstep(0.55, 1.0, r2);
  gl_FragColor = vec4(vColor, disc * vAlpha);
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
      lum[i] = 0.45 + 3.55 * r * r * r;
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
  const beta = j && j.active ? Math.min(0.995, j.beta) : 0;
  if (s.vel && s.vel.lengthSq() > 1) _dirFlight.copy(s.vel).normalize();
  const fade = Math.max(systemFade(camera.position), j && j.active ? 0.85 : 0);
  const pxA = pixelAngle();
  const e = camera.matrixWorld.elements;
  _right.set(e[0], e[1], e[2]).normalize();
  _up.set(e[4], e[5], e[6]).normalize();

  for (const L of layers) {
    const u = L.mat.uniforms;
    u.uCam.value.copy(camera.position);
    u.uBeta.value = beta;
    u.uDir.value.copy(_dirFlight);
    u.uFade.value = fade;
    u.uPxAngle.value = pxA;
    u.uSpeed.value = j && j.active ? j.v : (s.speed || 0);
    u.uCamRight.value.copy(_right);
    u.uCamUp.value.copy(_up);
  }
  // streaks ELIMINADOS (lei do operador 2026-07-17: pontos sólidos, nunca
  // borrões) — streakK permanece no diagnóstico como 0 explícito.
  game.starfieldFx = { closeMaxPx: CLOSE_MAX_PX, streakK: 0, beta };
  game.starfieldFade = fade;                 // diagnóstico p/ e2e
  game.starfieldBeta = beta;

  for (const sp of nebulae) {
    const span = sp.userData.span, b = sp.userData.base;
    sp.position.set(
      ((b.x - camera.position.x) % span + span * 1.5) % span - span * 0.5 + camera.position.x,
      ((b.y - camera.position.y) % span + span * 1.5) % span - span * 0.5 + camera.position.y,
      ((b.z - camera.position.z) % span + span * 1.5) % span - span * 0.5 + camera.position.z,
    );
    // nebulosas somem em alta velocidade: a β alta elas viravam "borrões
    // vermelhos/azuis" cruzando a tela — o corredor é de ESTRELAS-ponto.
    sp.material.opacity = 0.30 * fade * (1 - 0.85 * beta);
  }
}
