// nuclear-fx.js — Pluma nuclear PERSISTENTE (autoridade única do cogumelo — WS-5).
// Exporta: spawnNuclearFx, updateNuclearFx, nuclearFxState.
//
// Rework de realismo (2026-07-01, aceite do operador sobre T-WR-05):
//  - Fireball = 1 esfera com ShaderMaterial FBM (ferve, esfria por rampa blackbody,
//    sobe e vira o núcleo da copa — não uma "bola lisa").
//  - Copa + talo + saia de poeira = UM InstancedMesh de billboards de fumaça
//    (~116 quads, 1 draw call) com textura procedural de puff — leitura volumétrica,
//    barato o suficiente para 60 s. Toda a animação é paramétrica (uniforms).
//  - Proporções reais de cogumelo: altura ~1400 m, copa ~760 m de diâmetro
//    (largura ≈ 0.55 × altura), talo 60→110 m de raio.
//  - Anéis de condensação (Wilson clouds) brancos subindo nos primeiros segundos.
//  - Anel de choque de solo mantido; luz transitória mantida.
// O burst violento inicial (flash + fireballs + pops) continua em fx.js#nuclearExplosion.
// Ticado por main.js: updateNuclearFx(dt) a cada frame.

import * as THREE from '../../vendor/three.module.min.js';
import { scene } from './scene.js';

const HEADLESS = typeof navigator !== 'undefined' && navigator.webdriver === true;

const active = [];
export const nuclearFxState = {
  active: false,
  stage: 'idle',
  fireballRadius: 0,
  plumeHeight: 0,
  shockwaveRadius: 0,
  activeParticles: 0,
  lightPulse: 0,
};

const LIFETIME = 60;    // s — cogumelo persiste ~1 minuto (pedido do operador)
const CEILING = 950;    // m — teto da pluma: alto, mas LEGÍVEL da distância de jogo
const RISE_T = 45;      // s — tempo para a pluma atingir o teto, depois segura
const CAP_HALF_W = 330; // m — meia-largura final da copa (diâmetro ~660 m)
const CAP_H = 140;      // m — meia-altura vertical da copa
const STEM_R = 95;      // m — raio do talo no topo (afunila para ~60 na base)
const SKIRT_R = 420;    // m — raio final da saia de poeira na base

// Contagem de billboards (1 draw call). Headless: mínimo para os probes.
const N_CAP = HEADLESS ? 10 : 64;
const N_STEM = HEADLESS ? 8 : 46;
const N_SKIRT = HEADLESS ? 6 : 24;

// Rampa de cores de fogo: branco-quente → amarelo → laranja → vermelho.
const FIRE_STOPS = [0xffffff, 0xffee88, 0xffaa30, 0xff5020];
const _rampA = new THREE.Color();
const _rampB = new THREE.Color();
function fireColorAt(u, out) {
  const n = FIRE_STOPS.length - 1;
  const seg = Math.max(0, Math.min(n - 1, Math.floor(u * n)));
  const localT = Math.max(0, Math.min(1, u * n - seg));
  out.copy(_rampA.setHex(FIRE_STOPS[seg])).lerp(_rampB.setHex(FIRE_STOPS[seg + 1]), localT);
  return out;
}
const _col = new THREE.Color();

// ── Textura procedural de puff de fumaça (gerada 1× por sessão) ───────────────
let _smokeTex = null;
function smokeTexture() {
  if (_smokeTex || typeof document === 'undefined') return _smokeTex;
  const S = 128;
  const cv = document.createElement('canvas');
  cv.width = cv.height = S;
  const ctx = cv.getContext('2d');
  ctx.clearRect(0, 0, S, S);
  // Nuvem = soma de ~64 blobs radiais dentro de um falloff gaussiano central.
  for (let i = 0; i < 64; i++) {
    const a = Math.random() * Math.PI * 2;
    const rr = Math.pow(Math.random(), 1.6) * S * 0.30;
    const x = S / 2 + Math.cos(a) * rr;
    const y = S / 2 + Math.sin(a) * rr;
    const r = S * (0.07 + Math.random() * 0.14);
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    const al = 0.10 + Math.random() * 0.16;
    g.addColorStop(0, `rgba(255,255,255,${al})`);
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  // Falloff global para nenhum puff ter borda dura.
  const mask = ctx.createRadialGradient(S / 2, S / 2, S * 0.18, S / 2, S / 2, S * 0.5);
  mask.addColorStop(0, 'rgba(255,255,255,1)');
  mask.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.globalCompositeOperation = 'destination-in';
  ctx.fillStyle = mask;
  ctx.fillRect(0, 0, S, S);
  _smokeTex = new THREE.CanvasTexture(cv);
  return _smokeTex;
}

// ── Shader do fireball: FBM 3D, rampa blackbody, ferve e esfria ───────────────
const FIRE_VERT = /* glsl */ `
  uniform float uTime;
  uniform float uDisp;
  varying vec3 vN;
  float hash(vec3 p){ return fract(sin(dot(p, vec3(127.1,311.7,74.7))) * 43758.5453123); }
  float vnoise(vec3 p){
    vec3 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float n000=hash(i), n100=hash(i+vec3(1,0,0)), n010=hash(i+vec3(0,1,0)), n110=hash(i+vec3(1,1,0));
    float n001=hash(i+vec3(0,0,1)), n101=hash(i+vec3(1,0,1)), n011=hash(i+vec3(0,1,1)), n111=hash(i+vec3(1,1,1));
    return mix(mix(mix(n000,n100,f.x), mix(n010,n110,f.x), f.y),
               mix(mix(n001,n101,f.x), mix(n011,n111,f.x), f.y), f.z);
  }
  float fbm(vec3 p){
    float v = 0.0, a = 0.5;
    for (int i = 0; i < 4; i++) { v += a * vnoise(p); p *= 2.03; a *= 0.5; }
    return v;
  }
  void main(){
    vN = normal;
    float d = fbm(normal * 2.6 + vec3(0.0, -uTime * 0.55, 0.0));
    vec3 p = position * (1.0 + uDisp * (d - 0.5) * 0.55);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`;
const FIRE_FRAG = /* glsl */ `
  uniform float uTime;
  uniform float uFade;
  varying vec3 vN;
  float hash(vec3 p){ return fract(sin(dot(p, vec3(127.1,311.7,74.7))) * 43758.5453123); }
  float vnoise(vec3 p){
    vec3 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float n000=hash(i), n100=hash(i+vec3(1,0,0)), n010=hash(i+vec3(0,1,0)), n110=hash(i+vec3(1,1,0));
    float n001=hash(i+vec3(0,0,1)), n101=hash(i+vec3(1,0,1)), n011=hash(i+vec3(0,1,1)), n111=hash(i+vec3(1,1,1));
    return mix(mix(mix(n000,n100,f.x), mix(n010,n110,f.x), f.y),
               mix(mix(n001,n101,f.x), mix(n011,n111,f.x), f.y), f.z);
  }
  float fbm(vec3 p){
    float v = 0.0, a = 0.5;
    for (int i = 0; i < 4; i++) { v += a * vnoise(p); p *= 2.03; a *= 0.5; }
    return v;
  }
  vec3 fireRamp(float x){
    vec3 c = mix(vec3(0.06,0.02,0.01), vec3(0.85,0.22,0.04), smoothstep(0.0, 0.35, x));
    c = mix(c, vec3(1.0, 0.62, 0.13), smoothstep(0.35, 0.65, x));
    c = mix(c, vec3(1.0, 0.96, 0.80), smoothstep(0.65, 0.92, x));
    return c;
  }
  void main(){
    float n = fbm(vN * 3.1 + vec3(0.0, -uTime * 0.75, uTime * 0.12));
    // esfriamento: o "calor" cai com o tempo, o ruído vira manchas frias primeiro
    float heat = clamp(n * 1.55 - uTime * 0.085, 0.0, 1.0);
    vec3 c = fireRamp(heat);
    float alpha = uFade * (0.30 + 0.70 * heat);
    gl_FragColor = vec4(c, alpha);
  }
`;

// ── Shader dos puffs instanciados (copa + talo + saia — 1 draw call) ──────────
const PUFF_VERT = /* glsl */ `
  attribute vec4 aShape;  // (ângulo, fração radial, fração de altura, escala-base)
  attribute vec3 aSeed;   // (seed 0-1, spin rad/s, drift)
  attribute float aKind;  // 0 = copa, 1 = talo, 2 = saia
  uniform float uTime;
  uniform float uPlumeH;
  uniform float uCapHalfW;
  uniform float uCapH;
  uniform float uStemR;
  uniform float uSkirtR;
  uniform vec2  uWob;
  varying vec2 vUv;
  varying float vKind;
  varying float vSeed;
  varying float vYFrac;
  void main(){
    vUv = uv; vKind = aKind; vSeed = aSeed.x; vYFrac = aShape.z;
    float ang = aShape.x + uTime * aSeed.z;       // deriva angular lenta (rolagem)
    vec3 c;
    float scl = aShape.w;
    if (aKind < 0.5) {
      // COPA: casca de domo em volta do topo da pluma; "ferve" com pulso no raio
      float pulse = 1.0 + 0.06 * sin(uTime * (0.5 + aSeed.x) + aSeed.x * 17.0);
      float r = aShape.y * uCapHalfW * pulse;
      float yy = uPlumeH + aShape.z * uCapH;
      c = vec3(cos(ang) * r + uWob.x, yy, sin(ang) * r + uWob.y);
      scl *= (0.45 + 0.55 * (uCapHalfW / ${CAP_HALF_W.toFixed(1)}));
    } else if (aKind < 1.5) {
      // TALO: coluna que afunila na base e balança com a pluma
      float yv = aShape.z;
      float r = aShape.y * uStemR * (0.62 + 0.48 * yv);
      float yy = yv * uPlumeH;
      float w = yv * yv;                            // topo acompanha o wobble
      c = vec3(cos(ang) * r + uWob.x * w, yy, sin(ang) * r + uWob.y * w);
      scl *= (0.55 + 0.45 * (uPlumeH / ${CEILING.toFixed(1)}));
    } else {
      // SAIA de poeira: anel baixo que varre para fora nos primeiros ~8 s
      float sweep = clamp(uTime / 8.0, 0.10, 1.0);
      float r = aShape.y * uSkirtR * sweep;
      c = vec3(cos(ang) * r, 6.0 + aShape.z * 26.0, sin(ang) * r);
      scl *= (0.5 + 0.9 * sweep);
    }
    vec4 view = modelViewMatrix * vec4(c, 1.0);
    float spin = aSeed.y * uTime + aSeed.x * 6.2831;
    float cs = cos(spin), sn = sin(spin);
    vec2 corner = vec2(position.x, position.y) * scl;
    view.xy += vec2(corner.x * cs - corner.y * sn, corner.x * sn + corner.y * cs);
    gl_Position = projectionMatrix * view;
  }
`;
const PUFF_FRAG = /* glsl */ `
  uniform sampler2D uMap;
  uniform vec3 uHot;
  uniform vec3 uMid;
  uniform vec3 uCool;
  uniform float uTime;
  uniform float uTailFade;
  varying vec2 vUv;
  varying float vKind;
  varying float vSeed;
  varying float vYFrac;
  void main(){
    float a = texture2D(uMap, vUv).a;
    // Esfriamento: copa segura o calor mais tempo que o talo; saia é poeira desde cedo.
    float coolT = vKind < 0.5 ? uTime / 7.5 : vKind < 1.5 ? uTime / 4.5 : 1.2;
    float cool = clamp(coolT + vSeed * 0.25, 0.0, 1.0);
    vec3 c = mix(uHot, uMid, smoothstep(0.0, 0.55, cool));
    c = mix(c, uCool, smoothstep(0.55, 1.0, cool));
    // Sombreamento fake: topo iluminado pelo sol, base do puff em sombra
    c *= (0.82 + 0.50 * vUv.y);
    // Talo levemente mais escuro no baixo (poeira aspirada)
    if (vKind > 0.5 && vKind < 1.5) c *= (0.80 + 0.20 * vYFrac);
    float alpha = a * uTailFade * (vKind > 1.5 ? clamp(1.0 - (uTime - 14.0) / 12.0, 0.0, 0.85) : 0.92);
    if (alpha < 0.01) discard;
    gl_FragColor = vec4(c, alpha);
  }
`;

function buildPuffMesh() {
  const N = N_CAP + N_STEM + N_SKIRT;
  const quad = new THREE.PlaneGeometry(2, 2);
  const geo = new THREE.InstancedBufferGeometry();
  geo.index = quad.index;
  geo.attributes.position = quad.attributes.position;
  geo.attributes.uv = quad.attributes.uv;
  const shape = new Float32Array(N * 4);
  const seed = new Float32Array(N * 3);
  const kind = new Float32Array(N);
  let k = 0;
  // COPA: domo — mais denso na borda (torus roll), alguns no miolo alto
  for (let i = 0; i < N_CAP; i++, k++) {
    const edge = i < N_CAP * 0.7;
    const ang = Math.random() * Math.PI * 2;
    const radF = edge ? 0.62 + Math.random() * 0.38 : Math.random() * 0.55;
    const yF = edge ? -0.20 + Math.random() * 0.60 : 0.30 + Math.random() * 0.60;
    const scl = 135 + Math.random() * 110;
    shape.set([ang, radF, yF, scl], k * 4);
    seed.set([Math.random(), (Math.random() - 0.5) * 0.35, (Math.random() - 0.5) * 0.05], k * 3);
    kind[k] = 0;
  }
  // TALO: coluna em leve espiral
  for (let i = 0; i < N_STEM; i++, k++) {
    const ang = Math.random() * Math.PI * 2;
    const radF = 0.35 + Math.random() * 0.65;
    const yF = 0.04 + (i / N_STEM) * 0.90 + Math.random() * 0.05;
    const scl = 95 + Math.random() * 70;
    shape.set([ang, radF, yF, scl], k * 4);
    seed.set([Math.random(), (Math.random() - 0.5) * 0.5, (Math.random() < 0.5 ? -1 : 1) * (0.04 + Math.random() * 0.05)], k * 3);
    kind[k] = 1;
  }
  // SAIA: anel de poeira na base
  for (let i = 0; i < N_SKIRT; i++, k++) {
    const ang = (i / N_SKIRT) * Math.PI * 2 + Math.random() * 0.4;
    const radF = 0.75 + Math.random() * 0.35;
    const yF = Math.random();
    const scl = 60 + Math.random() * 60;
    shape.set([ang, radF, yF, scl], k * 4);
    seed.set([Math.random(), (Math.random() - 0.5) * 0.4, (Math.random() - 0.5) * 0.06], k * 3);
    kind[k] = 2;
  }
  geo.setAttribute('aShape', new THREE.InstancedBufferAttribute(shape, 4));
  geo.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seed, 3));
  geo.setAttribute('aKind', new THREE.InstancedBufferAttribute(kind, 1));
  geo.instanceCount = N;
  const mat = new THREE.ShaderMaterial({
    vertexShader: PUFF_VERT,
    fragmentShader: PUFF_FRAG,
    uniforms: {
      uMap: { value: smokeTexture() },
      uTime: { value: 0 },
      uPlumeH: { value: 0 },
      uCapHalfW: { value: 30 },
      uCapH: { value: 60 },
      uStemR: { value: 40 },
      uSkirtR: { value: SKIRT_R },
      uWob: { value: new THREE.Vector2() },
      uHot: { value: new THREE.Color(0xffc06a) },
      uMid: { value: new THREE.Color(0xc4b6a4) },
      uCool: { value: new THREE.Color(0xbdb3a6) },
      uTailFade: { value: 1 },
    },
    transparent: true,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false; // shape animada em GPU — bounding estático mentiria
  mesh.renderOrder = 2;
  return mesh;
}

export function spawnNuclearFx(epicenter) {
  const group = new THREE.Group();

  // Fireball FBM (núcleo que vira a copa)
  const fire = new THREE.Mesh(
    new THREE.SphereGeometry(1, HEADLESS ? 16 : 48, HEADLESS ? 12 : 32),
    new THREE.ShaderMaterial({
      vertexShader: FIRE_VERT,
      fragmentShader: FIRE_FRAG,
      uniforms: {
        uTime: { value: 0 },
        uFade: { value: 1 },
        uDisp: { value: HEADLESS ? 0 : 1 },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  );
  fire.renderOrder = 3;

  // Puffs de fumaça (copa + talo + saia) — 1 draw call
  const puffs = buildPuffMesh();

  // Anel de choque de solo
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(1, 1.06, 72),
    new THREE.MeshBasicMaterial({ color: 0xfff0aa, transparent: true, opacity: 0.85, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.renderOrder = 4;

  // Anéis de condensação (Wilson clouds): brancos, sobem e expandem cedo
  const wilson = [];
  for (let i = 0; i < 2; i++) {
    const w = new THREE.Mesh(
      new THREE.TorusGeometry(1, 0.055, 8, 48),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }),
    );
    w.rotation.x = Math.PI / 2;
    w.renderOrder = 4;
    wilson.push(w);
    group.add(w);
  }

  const light = new THREE.PointLight(0xffaa44, 8, 2200, 1.0);
  light.position.set(0, 60, 0);

  group.add(fire, puffs, ring, light);
  group.position.copy(epicenter);
  scene.add(group);
  active.push({ group, fire, puffs, ring, wilson, light, t: 0 });
  nuclearFxState.active = true;
  nuclearFxState.stage = 'flash';
}

export function updateNuclearFx(dt) {
  for (let i = active.length - 1; i >= 0; i--) {
    const fx = active[i];
    fx.t += dt;
    const t = fx.t;

    // Subida da pluma: ease-out até o teto em RISE_T s, depois segura.
    const riseLin = Math.min(1, t / RISE_T);
    const rise = 1 - (1 - riseLin) * (1 - riseLin); // ease-out: rápido cedo, lento no topo
    const plumeH = rise * CEILING;
    // Turbulência barata (wobble senoidal), cresce um pouco com a altura.
    const wobX = (Math.sin(t * 0.9) * 8 + Math.cos(t * 0.47) * 6) * (0.4 + rise);
    const wobZ = (Math.cos(t * 0.73) * 7 + Math.sin(t * 0.39) * 5) * (0.4 + rise);
    const tailFade = t > LIFETIME - 15 ? Math.max(0, 1 - (t - (LIFETIME - 15)) / 15) : 1;

    // ── Fireball: cresce ~4 s, sobe colado ao topo da pluma, esfria e some ~9 s ──
    const fireR = Math.min(130, 8 + t * 34);
    const fireRise = Math.min(plumeH + 20, 30 + t * t * 6);
    const fireFade = Math.max(0, 1 - t / 9);
    fx.fire.position.set(wobX * 0.6, fireRise, wobZ * 0.6);
    fx.fire.scale.setScalar(fireR);
    fx.fire.material.uniforms.uTime.value = t;
    fx.fire.material.uniforms.uFade.value = fireFade;
    fx.fire.visible = fireFade > 0.01;

    // ── Puffs (copa + talo + saia): só uniforms — animação toda na GPU ──
    const u = fx.puffs.material.uniforms;
    u.uTime.value = t;
    u.uPlumeH.value = Math.max(40, plumeH);
    u.uCapHalfW.value = 40 + rise * (CAP_HALF_W - 40);
    u.uCapH.value = 60 + rise * (CAP_H - 60);
    u.uStemR.value = 34 + rise * (STEM_R - 34);
    u.uWob.value.set(wobX, wobZ);
    // Copa herda a cor do fogo nos primeiros segundos (iluminada por dentro)
    fireColorAt(Math.min(1, t / 4.5), _col);
    u.uHot.value.copy(_col);
    u.uTailFade.value = tailFade;

    // ── Anéis de condensação: expandem e somem em ~7 s ──
    for (let wi = 0; wi < fx.wilson.length; wi++) {
      const w = fx.wilson[wi];
      const wt = t - 1.0 - wi * 1.6;
      if (wt < 0 || wt > 6.5) { w.material.opacity = 0; continue; }
      const wr = 60 + wt * 90;
      w.scale.setScalar(wr);
      w.position.y = fireRise * (0.55 + wi * 0.22);
      w.material.opacity = 0.5 * Math.sin(Math.min(1, wt / 6.5) * Math.PI);
    }

    // ── Shockwave de solo: varre até ~750 m em ~3.4 s e some ──
    const shockR = Math.min(750, t * 220);
    fx.ring.scale.setScalar(shockR);
    fx.ring.material.opacity = Math.max(0, 0.85 - t * 0.24);

    // ── Luz transitória da detonação ──
    if (fx.light) fx.light.intensity = Math.max(0, 8 * (1 - t / 3.2));

    // ── Estado (debug HUD) — timeline de 60 s ──
    nuclearFxState.stage = t < 0.3 ? 'flash' : t < 2.5 ? 'fireball' : t < LIFETIME - 15 ? 'mushroom' : 'dissipating';
    nuclearFxState.fireballRadius = fireR * fireFade;
    nuclearFxState.plumeHeight = plumeH;
    nuclearFxState.shockwaveRadius = shockR;
    nuclearFxState.activeParticles = active.length * (N_CAP + N_STEM + N_SKIRT);
    nuclearFxState.lightPulse = Math.max(0, 1 - t / 3.2);

    if (t > LIFETIME) {
      scene.remove(fx.group);
      fx.fire.geometry.dispose();
      fx.fire.material.dispose();
      fx.puffs.geometry.dispose();
      fx.puffs.material.dispose();
      fx.ring.geometry.dispose();
      fx.ring.material.dispose();
      for (const w of fx.wilson) { w.geometry.dispose(); w.material.dispose(); }
      active.splice(i, 1);
    }
  }
  if (active.length === 0 && nuclearFxState.active) {
    nuclearFxState.active = false;
    nuclearFxState.stage = 'idle';
  }
}
