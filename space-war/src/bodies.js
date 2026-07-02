// bodies.js — Constrói o Sol, os planetas e as luas com texturas procedurais,
// atmosferas (fresnel) e anéis. Nada é carregado de fora: tudo pintado em canvas.

import * as THREE from '../../vendor/three.module.min.js';
import { Lensflare, LensflareElement } from '../../vendor/jsm/objects/Lensflare.js';
import { SUN, PLANETS, BINARY, BETELGEUSE, CHAOTIC, CORE, SYSTEMS, EARTH_YEAR, defaultGravReach } from './config.js';
import { scene, camera } from './scene.js';
import { game } from './state.js';

const HEADLESS = typeof navigator !== 'undefined' && navigator.webdriver === true;

// ── GLSL compartilhado: value-noise 3D + FBM (estrelas, disco, remanescente) ──
const GLSL_NOISE = /* glsl */ `
  float hash3(vec3 p){ return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453123); }
  float vnoise3(vec3 p){
    vec3 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float n000=hash3(i), n100=hash3(i+vec3(1,0,0)), n010=hash3(i+vec3(0,1,0)), n110=hash3(i+vec3(1,1,0));
    float n001=hash3(i+vec3(0,0,1)), n101=hash3(i+vec3(1,0,1)), n011=hash3(i+vec3(0,1,1)), n111=hash3(i+vec3(1,1,1));
    return mix(mix(mix(n000,n100,f.x), mix(n010,n110,f.x), f.y),
               mix(mix(n001,n101,f.x), mix(n011,n111,f.x), f.y), f.z);
  }
  float fbm3(vec3 p){
    float v = 0.0, a = 0.5;
    for (int i = 0; i < 4; i++) { v += a * vnoise3(p); p *= 2.07; a *= 0.5; }
    return v;
  }
`;

// ── Shader genérico de ESTRELA: convecção FBM com domain-warp, rampa de cor e
// limb darkening forte (borda escurece e "esfria"). uCell controla o tamanho das
// células: Sol ~26 (granulação fina) vs Betelgeuse ~1.8 (2-4 células GIGANTES).
// uLump desloca vértices em baixa frequência → silhueta assimétrica (ALMA).
const STAR_VERT = /* glsl */ `
  uniform float uTime;
  uniform float uCell;
  uniform float uLump;
  varying vec3 vN;
  varying vec3 vDir;
  varying vec3 vView;
  ${'__NOISE__'}
  void main(){
    vDir = normalize(position);
    float d = uLump > 0.0 ? (fbm3(vDir * max(1.2, uCell * 0.6) + uTime * 0.012) - 0.5) : 0.0;
    vec3 p = position * (1.0 + d * uLump * 2.0);
    vN = normalize(normalMatrix * normal);
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    vView = normalize(-mv.xyz);
    gl_Position = projectionMatrix * mv;
  }
`.replace('__NOISE__', GLSL_NOISE);
const STAR_FRAG = /* glsl */ `
  uniform float uTime;
  uniform float uCell;
  uniform vec3 uHot;
  uniform vec3 uMid;
  uniform vec3 uCool;
  uniform vec3 uDeep;
  varying vec3 vN;
  varying vec3 vDir;
  varying vec3 vView;
  ${'__NOISE__'}
  void main(){
    // domain warp: células que se deformam lentamente (fotosfera fervendo).
    // (perf 2026-07-01: 2 fbm3 + componente sintetizada em vez de 3 fbm3 —
    // visualmente indistinguível, corta 4 vnoise3 POR FRAGMENTO em tela cheia)
    float qa = fbm3(vDir * uCell + uTime * 0.020);
    float qb = fbm3(vDir * uCell + vec3(5.2, 1.3, 2.8) + uTime * 0.016);
    vec3 q = vec3(qa, qb, qa * 0.62 + qb * 0.38);
    float n = fbm3(vDir * uCell * 1.9 + q * 1.35 - uTime * 0.01);
    float t = clamp(n * 1.55 - 0.18, 0.0, 1.0);           // temperatura relativa da célula
    vec3 c = mix(uCool, uMid, smoothstep(0.12, 0.55, t));
    c = mix(c, uHot, smoothstep(0.58, 0.95, t));
    // limb darkening forte (supergigantes escurecem MUITO na borda)
    float mu_ = max(dot(normalize(vN), normalize(vView)), 0.0);
    c = mix(uDeep, c, pow(mu_, 0.5));
    gl_FragColor = vec4(c, 1.0);
  }
`.replace('__NOISE__', GLSL_NOISE);

function starMaterial(def) {
  const mid = new THREE.Color(def.color);
  const deep = new THREE.Color(def.color2 || def.color).multiplyScalar(0.55);
  const hot = mid.clone().lerp(new THREE.Color(0xffffff), 0.65);
  const cool = mid.clone().lerp(new THREE.Color(def.color2 || def.color), 0.75);
  return new THREE.ShaderMaterial({
    vertexShader: STAR_VERT,
    fragmentShader: STAR_FRAG,
    uniforms: {
      uTime: { value: Math.random() * 100 },
      uCell: { value: def.cellScale ?? 20 },
      uLump: { value: def.lumpyLimb ?? 0 },
      uHot: { value: hot },
      uMid: { value: mid },
      uCool: { value: cool },
      uDeep: { value: deep },
    },
  });
}

// Estrela genérica: esfera shader + corona sprite tintada; luz opcional.
function buildStar(def, { light = null, coronaScale = 4.2 } = {}) {
  const group = new THREE.Group();
  const seg = HEADLESS ? 24 : (def.radius > 20000 ? 128 : def.radius > 3000 ? 96 : 64);
  const mat = starMaterial(def);
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(def.radius, seg, Math.floor(seg * 0.66)), mat);
  group.add(mesh);
  const c = new THREE.Color(def.color);
  const corona = makeRadialSprite([
    `rgba(${(c.r * 255) | 0},${(c.g * 255) | 0},${(c.b * 255) | 0},0.55)`,
    `rgba(${(c.r * 255) | 0},${(c.g * 200) | 0},${(c.b * 160) | 0},0.20)`,
    'rgba(0,0,0,0)',
  ]);
  corona.scale.setScalar(def.radius * coronaScale);
  group.add(corona);
  if (light) {
    const pl = new THREE.PointLight(light.color, light.intensity ?? 3.0, light.range ?? 1_000_000, 0.0);
    group.add(pl);
  }
  const fx = { t: 0, update(dt) {
    this.t += dt;
    mat.uniforms.uTime.value += dt;
    corona.material.opacity = 0.75 + Math.sin(this.t * 0.9) * 0.12;
  } };
  return { group, mesh, corona, fx };
}

const ORIGIN = new THREE.Vector3(0, 0, 0);
// Hooks de animação por-frame dos corpos especiais (disco de acreção, jatos, pulso).
const bodyFx = [];

function hex(c) { return '#' + c.toString(16).padStart(6, '0'); }
function rndSeed(s) {
  let a = s >>> 0;
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

// ---- Texturas procedurais por tipo de corpo ------------------------------
// Memoizadas por identidade visual: os planetas gêmeos do sistema binário
// reaproveitam a textura do planeta original (corta 21 gerações de canvas no load
// e compartilha memória de GPU — essencial para FPS em software-GL).
const _texCache = new Map();
function planetTexture(def) {
  const cacheKey = `${def.kind}|${def.color}|${def.color2 || 0}|${def.radius}|${def.redspot ? 1 : 0}`;
  const hit = _texCache.get(cacheKey);
  if (hit) return hit;
  const tex = buildPlanetTexture(def);
  _texCache.set(cacheKey, tex);
  return tex;
}
function buildPlanetTexture(def) {
  const W = 1024, H = 512;
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const ctx = cv.getContext('2d');
  const rnd = rndSeed(def.name.length * 131 + def.radius * 17 + 3);
  const base = hex(def.color), base2 = hex(def.color2 || def.color);

  if (def.kind === 'gas' || def.kind === 'ice') {
    // Bandas horizontais com turbulência.
    for (let y = 0; y < H; y++) {
      const t = y / H;
      const wob = Math.sin(t * Math.PI * (def.kind === 'gas' ? 22 : 9) + Math.sin(t * 40) * 0.6) * 0.5 + 0.5;
      const c = mix(def.color, def.color2 || def.color, wob);
      ctx.fillStyle = hex(c);
      ctx.fillRect(0, y, W, 1);
    }
    // Redemoinhos suaves
    ctx.globalCompositeOperation = 'overlay';
    for (let i = 0; i < 240; i++) {
      const y = rnd() * H;
      ctx.fillStyle = `rgba(255,255,255,${rnd() * 0.05})`;
      ctx.beginPath(); ctx.ellipse(rnd() * W, y, 30 + rnd() * 120, 4 + rnd() * 10, 0, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
    if (def.redspot) {
      const g = ctx.createRadialGradient(W * 0.62, H * 0.62, 2, W * 0.62, H * 0.62, 60);
      g.addColorStop(0, 'rgba(220,90,40,0.95)'); g.addColorStop(1, 'rgba(220,90,40,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(W * 0.62, H * 0.62, 70, 40, 0, 0, Math.PI * 2); ctx.fill();
    }
  } else if (def.kind === 'earth') {
    // Oceano
    ctx.fillStyle = base; ctx.fillRect(0, 0, W, H);
    const og = ctx.createLinearGradient(0, 0, 0, H);
    og.addColorStop(0, 'rgba(10,40,90,0.5)'); og.addColorStop(0.5, 'rgba(20,90,150,0)'); og.addColorStop(1, 'rgba(10,40,90,0.5)');
    ctx.fillStyle = og; ctx.fillRect(0, 0, W, H);
    // Continentes (blobs verdes/marrons)
    for (let i = 0; i < 26; i++) {
      const cx = rnd() * W, cy = H * 0.2 + rnd() * H * 0.6;
      const land = rnd() < 0.5 ? '#2f7d3a' : '#6b8e3a';
      paintBlob(ctx, cx, cy, 30 + rnd() * 90, land, rnd, 0.8);
      paintBlob(ctx, cx + (rnd() - 0.5) * 40, cy + (rnd() - 0.5) * 30, 18 + rnd() * 40, '#7a5a2a', rnd, 0.4);
    }
    // Calotas polares
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    ctx.fillRect(0, 0, W, H * 0.06); ctx.fillRect(0, H * 0.94, W, H * 0.06);
    // Nuvens
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 60; i++) paintBlob(ctx, rnd() * W, rnd() * H, 20 + rnd() * 70, 'rgba(255,255,255,0.35)', rnd, 1);
    ctx.globalCompositeOperation = 'source-over';
  } else if (def.kind === 'cloud') {
    // Vênus: nuvens cremosas em redemoinho.
    ctx.fillStyle = base; ctx.fillRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 300; i++) paintBlob(ctx, rnd() * W, rnd() * H, 30 + rnd() * 80, `rgba(255,240,200,${rnd() * 0.10})`, rnd, 1);
    ctx.globalCompositeOperation = 'source-over';
  } else {
    // Rocha: base + crateras + variação.
    ctx.fillStyle = base; ctx.fillRect(0, 0, W, H);
    for (let i = 0; i < 400; i++) paintBlob(ctx, rnd() * W, rnd() * H, 4 + rnd() * 30, hex(mix(def.color, def.color2 || def.color, rnd())), rnd, 0.6);
    // Crateras
    for (let i = 0; i < 120; i++) {
      const x = rnd() * W, y = rnd() * H, r = 3 + rnd() * 14;
      ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.10)'; ctx.beginPath(); ctx.arc(x - r * 0.2, y - r * 0.2, r * 0.7, 0, Math.PI * 2); ctx.fill();
    }
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function paintBlob(ctx, x, y, r, color, rnd, irregular) {
  ctx.fillStyle = color;
  ctx.beginPath();
  const pts = 10;
  for (let i = 0; i <= pts; i++) {
    const a = (i / pts) * Math.PI * 2;
    const rr = r * (1 - irregular * 0.5 + rnd() * irregular * 0.5);
    const px = x + Math.cos(a) * rr, py = y + Math.sin(a) * rr * 0.8;
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.closePath(); ctx.fill();
}

function mix(a, b, t) {
  const ar = (a >> 16) & 255, ag = (a >> 8) & 255, ab = a & 255;
  const br = (b >> 16) & 255, bg = (b >> 8) & 255, bb = b & 255;
  const r = (ar + (br - ar) * t) | 0, g = (ag + (bg - ag) * t) | 0, bl = (ab + (bb - ab) * t) | 0;
  return (r << 16) | (g << 8) | bl;
}

// ---- Atmosfera (fresnel additive) ----------------------------------------
function atmosphere(radius, color) {
  const mat = new THREE.ShaderMaterial({
    transparent: true, blending: THREE.AdditiveBlending, side: THREE.BackSide, depthWrite: false,
    uniforms: { uColor: { value: new THREE.Color(color) } },
    vertexShader: `varying vec3 vN; varying vec3 vView;
      void main(){ vN=normalize(normalMatrix*normal); vec4 mv=modelViewMatrix*vec4(position,1.0); vView=normalize(-mv.xyz); gl_Position=projectionMatrix*mv; }`,
    fragmentShader: `varying vec3 vN; varying vec3 vView; uniform vec3 uColor;
      void main(){ float f=pow(1.0-max(dot(vN,vView),0.0),2.4); gl_FragColor=vec4(uColor, f*0.9); }`,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius * 1.12, 24, 16), mat);
  return mesh;
}

// ---- Anéis ---------------------------------------------------------------
function ringMesh(ring) {
  const cv = document.createElement('canvas'); cv.width = 512; cv.height = 16;
  const ctx = cv.getContext('2d');
  const rnd = rndSeed(99);
  for (let x = 0; x < 512; x++) {
    const a = 0.25 + Math.sin(x * 0.21) * 0.18 + rnd() * 0.18;
    ctx.fillStyle = `rgba(${(ring.color >> 16) & 255},${(ring.color >> 8) & 255},${ring.color & 255},${a})`;
    ctx.fillRect(x, 0, 1, 16);
  }
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
  const geo = new THREE.RingGeometry(ring.inner, ring.outer, 96);
  // remapear UV radialmente
  const pos = geo.attributes.position; const uv = geo.attributes.uv;
  for (let i = 0; i < pos.count; i++) {
    const v = new THREE.Vector3().fromBufferAttribute(pos, i);
    const r = (v.length() - ring.inner) / (ring.outer - ring.inner);
    uv.setXY(i, r, 0.5);
  }
  const mat = new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide, transparent: true, depthWrite: false });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.rotation.x = Math.PI / 2 + (ring.tilt || 0);
  return mesh;
}

// ---- Construção de um corpo ----------------------------------------------
function makeSphere(radius, tex, emissive, def = null) {
  const mat = emissive
    ? new THREE.MeshBasicMaterial({ map: tex })
    : new THREE.MeshStandardMaterial({ map: tex, roughness: 0.95, metalness: 0.0 });
  if (!emissive && def) {
    // Relevo barato: a própria textura como bump map — crateras e continentes
    // ganham sombreamento 3D no terminador em vez de parecerem pintura chapada.
    if (def.kind === 'rock' || def.kind === 'earth' || !def.kind) {
      mat.bumpMap = tex;
      mat.bumpScale = Math.max(0.5, radius * 0.02);
    }
    if (def.kind === 'earth') mat.roughness = 0.62;   // oceano com brilho especular do Sol
  }
  // TESSELAÇÃO ALTA (pedido do operador): na aproximação final o arco do limbo
  // precisa ficar RETO até virar plano na colisão — 40 segmentos davam um limbo
  // poligonal de "brinquedo". Agora corpos grandes têm limbo contínuo de perto.
  const seg = HEADLESS ? 24 : radius > 2000 ? 96 : radius > 300 ? 72 : radius > 50 ? 56 : radius > 8 ? 40 : 28;
  return new THREE.Mesh(new THREE.SphereGeometry(radius, seg, Math.floor(seg * 0.66)), mat);
}

function reach(def) { return def.gravReach || defaultGravReach(def); }

// Constrói um planeta (+ luas) e o registra. `orbitCenter` é o ponto que ele orbita
// (origem no sistema solar, baricentro no binário). Reaproveitado pelos dois sistemas.
function buildPlanetBody(def, parentBody, system, orbitCenter) {
  const group = new THREE.Group();
  const tex = planetTexture(def);
  const mesh = makeSphere(def.radius, tex, false, def);
  mesh.rotation.z = def.tilt || 0;
  group.add(mesh);
  if (def.hasAtmo || def.atmosphere) group.add(atmosphere(def.radius, def.atmosphere || 0x6fb6ff));
  if (def.ring) group.add(ringMesh(def.ring));
  // SOI wireframe REMOVIDO (2026-07-01): a bolha aramada gigante dominava o céu
  // inteiro perto de qualquer corpo — estética de debug, não de jogo. O HUD
  // (PUXÃO + ÓRBITA/FUGA) já comunica a esfera de influência.
  const soiMesh = null;
  scene.add(group);
  const body = {
    def, group, mesh, soiMesh, worldPos: new THREE.Vector3(), mu: def.mu, soi: def.soi,
    gravReach: reach(def), system, orbitCenter,
    isMoon: false, isSun: false, parent: parentBody, angle: Math.random() * Math.PI * 2,
    orbit: def.orbit, period: null, spin: def.spin, moons: [],
  };
  game.bodies.push(body);

  for (const m of (def.moons || [])) {
    const mg = new THREE.Group();
    const mtex = planetTexture({ ...m, kind: 'rock', color2: m.color });
    const mmesh = makeSphere(m.radius, mtex, false, { kind: 'rock' });
    mg.add(mmesh);
    scene.add(mg);
    const moon = {
      def: m, group: mg, mesh: mmesh, worldPos: new THREE.Vector3(), mu: m.mu, soi: m.soi,
      gravReach: reach(m), system, orbitCenter: null,   // luas seguem o pai dinamicamente
      isMoon: true, isSun: false, parent: body, angle: Math.random() * Math.PI * 2,
      orbit: m.orbit, period: m.period, spin: m.spin, retrograde: !!m.retrograde,
    };
    body.moons.push(moon);
    game.bodies.push(moon);
  }
  return body;
}

// Registro de corpo-estrela (primária pinada de um sistema).
function registerStar(def, starBuilt, systemKey, centerVec, { isSun = false } = {}) {
  starBuilt.group.position.copy(centerVec);
  scene.add(starBuilt.group);
  const body = {
    def, group: starBuilt.group, mesh: starBuilt.mesh, worldPos: centerVec.clone(),
    mu: def.mu, soi: def.soi, gravReach: reach(def), system: systemKey, orbitCenter: null,
    isMoon: false, isSun, parent: null, angle: 0,
  };
  game.bodies.push(body);
  bodyFx.push(starBuilt.fx);
  return body;
}

// Corpo DINÂMICO (integrado por N-corpos em orbits.js).
function makeDynamic(body, sysDef, { vel, softening, anchor = null, centralMu, reinjectR }) {
  body.dynamic = true;
  body.vel = vel.clone();
  body.acc = new THREE.Vector3();
  body.softening = softening;
  body.anchor = anchor;
  body.systemDef = sysDef;
  body.centralMu = centralMu;
  body.reinjectR = reinjectR;
  body.spin = body.def.spin || 0;
  game.dynBodies = game.dynBodies || [];
  game.dynBodies.push(body);
}

export function buildSolarSystem() {
  game.dynBodies = game.dynBodies || [];

  // --- Sol (shader de granulação fina + lens flare + luz do sistema) ---
  const sunBuilt = buildStar({ ...SUN, cellScale: 26 }, {
    light: { color: SUN.light, intensity: 3.2, range: 1_000_000 },
    coronaScale: 5.0,
  });
  if (!HEADLESS) {
    const flare = new Lensflare();
    flare.addElement(new LensflareElement(flareTexture(true), 640, 0, new THREE.Color(0xfff0c8)));
    flare.addElement(new LensflareElement(flareTexture(false), 110, 0.55, new THREE.Color(0xffd9a0)));
    flare.addElement(new LensflareElement(flareTexture(false), 60, 0.85, new THREE.Color(0xaac8ff)));
    flare.addElement(new LensflareElement(flareTexture(false), 150, 1.2, new THREE.Color(0xff9a70)));
    sunBuilt.group.children.find((o) => o.isPointLight)?.add(flare);
  }
  const sun = registerStar(SUN, sunBuilt, 'home', ORIGIN, { isSun: true });
  game.sun = sun;

  // --- Planetas do sistema solar ---
  for (const def of PLANETS) buildPlanetBody(def, sun, 'home', ORIGIN);

  // --- Os outros 4 sistemas ---
  buildBinarySystem();
  buildBetelgeuseSystem();
  buildChaoticSystem();
  buildCoreSystem();
  buildSystemBeacons();

  return game.bodies;
}

// ===========================================================================
// SISTEMA 2 — BETELGEUSE: supergigante laranja com células gigantes, limbo
// assimétrico, envelope de poeira, pluma unilateral e a companheira Siwarha.
// ===========================================================================
function buildBetelgeuseSystem() {
  const center = new THREE.Vector3(...SYSTEMS[1].center);
  const def = BETELGEUSE.star;
  const built = buildStar(def, {
    light: { color: def.light, intensity: 2.6, range: 700_000 },
    coronaScale: 3.6,
  });
  // Envelope de poeira ENORME e tênue (tijolo dessaturado) + pluma unilateral
  const dust = makeRadialSprite(['rgba(140,74,47,0.10)', 'rgba(110,55,35,0.05)', 'rgba(0,0,0,0)']);
  dust.scale.setScalar(def.radius * 9);
  built.group.add(dust);
  const plume = makeRadialSprite(['rgba(255,154,77,0.16)', 'rgba(180,80,40,0.07)', 'rgba(0,0,0,0)']);
  plume.scale.set(def.radius * 4.2, def.radius * 2.2, 1);
  plume.position.set(def.radius * 2.4, def.radius * 1.1, 0);
  built.group.add(plume);
  const star = registerStar(def, built, 'betelgeuse', center, { isSun: true });

  // Companheira REAL (2025): Siwarha — faísca azul-branca DENTRO do envelope.
  const compDef = BETELGEUSE.companion;
  const compBuilt = buildStar(compDef, { coronaScale: 6 });
  scene.add(compBuilt.group);
  const comp = {
    def: compDef, group: compBuilt.group, mesh: compBuilt.mesh, worldPos: new THREE.Vector3(),
    mu: compDef.mu, soi: compDef.soi, gravReach: reach(compDef), system: 'betelgeuse',
    orbitCenter: center, isMoon: false, isSun: false, parent: star,
    angle: Math.random() * Math.PI * 2, orbit: compDef.orbit,
    period: EARTH_YEAR * compDef.periodFactor, spin: compDef.spin,
  };
  game.bodies.push(comp);
  bodyFx.push(compBuilt.fx);

  // Planetas carbonizados em trilho
  for (const p of BETELGEUSE.planets) buildPlanetBody(p, star, 'betelgeuse', center);
}

// ===========================================================================
// SISTEMA 4 — BINÁRIO CAÓTICO: 2 estrelas DIFERENTES integradas (excêntricas)
// + planetas circumbinários com jitter de velocidade → problema de 3 corpos real.
// ===========================================================================
function buildChaoticSystem() {
  const sysDef = SYSTEMS[3];
  const center = new THREE.Vector3(...sysDef.center);
  const [d1, d2] = CHAOTIC.stars;
  const muT = d1.mu + d2.mu;
  const a = CHAOTIC.pairSep, e = CHAOTIC.pairEcc;
  const rApo = a * (1 + e);
  const vRel = Math.sqrt(muT * (2 / rApo - 1 / a));   // vis-viva no apoápside

  const built1 = buildStar(d1, { light: { color: d1.light, intensity: 2.4, range: 500_000 }, coronaScale: 5 });
  const built2 = buildStar(d2, { light: { color: d2.light, intensity: 2.0, range: 400_000 }, coronaScale: 5 });
  const f1 = d2.mu / muT, f2 = d1.mu / muT;   // frações do baricentro
  const s1 = registerStar(d1, built1, 'chaotic', center.clone().add(new THREE.Vector3(rApo * f1, 0, 0)));
  const s2 = registerStar(d2, built2, 'chaotic', center.clone().add(new THREE.Vector3(-rApo * f2, 0, 0)));
  makeDynamic(s1, sysDef, {
    vel: new THREE.Vector3(0, 0, vRel * f1),
    softening: CHAOTIC.softening, centralMu: muT, reinjectR: a,
  });
  makeDynamic(s2, sysDef, {
    vel: new THREE.Vector3(0, 0, -vRel * f2),
    softening: CHAOTIC.softening, centralMu: muT, reinjectR: a,
  });

  for (const p of CHAOTIC.planets) {
    const body = buildPlanetBody(p, s1, 'chaotic', center);
    body.orbitCenter = null;                       // sai do trilho → dinâmico
    const ang = Math.random() * Math.PI * 2;
    body.worldPos.set(
      center.x + Math.cos(ang) * p.orbitR,
      center.y + (Math.random() - 0.5) * p.orbitR * 0.12,
      center.z + Math.sin(ang) * p.orbitR,
    );
    body.group.position.copy(body.worldPos);
    const vC = Math.sqrt(muT / p.orbitR) * p.velJitter;
    const s = Math.random() < 0.5 ? 1 : -1;
    makeDynamic(body, sysDef, {
      vel: new THREE.Vector3(-Math.sin(ang) * vC * s, (Math.random() - 0.5) * vC * 0.2, Math.cos(ang) * vC * s),
      softening: CHAOTIC.softening, centralMu: muT, reinjectR: p.orbitR,
    });
  }
}

// ===========================================================================
// SISTEMA 5 — NÚCLEO DA GALÁXIA: SMBH pinado + 12 estrelas S caóticas + planetas
// perdidos, tudo integrado. Enxame vivo com deflexões mútuas de verdade.
// ===========================================================================
function buildCoreSystem() {
  const sysDef = SYSTEMS[4];
  const center = new THREE.Vector3(...sysDef.center);

  // SMBH central (pinado — âncora do integrador)
  const bhGroup = buildBlackHole(CORE.smbh);
  bhGroup.group.position.copy(center);
  scene.add(bhGroup.group);
  const smbh = {
    def: CORE.smbh, group: bhGroup.group, mesh: bhGroup.horizon, worldPos: center.clone(),
    mu: CORE.smbh.mu, soi: CORE.smbh.soi, gravReach: reach(CORE.smbh), system: 'core',
    isMoon: false, isSun: false, parent: null, angle: 0,
  };
  game.bodies.push(smbh);
  bodyFx.push(bhGroup.fx);

  // 12 estrelas S — órbitas excêntricas variadas (v_circ × 0.55..1.15, planos tortos)
  for (let i = 0; i < CORE.starCount; i++) {
    const pal = CORE.starPalette[i % CORE.starPalette.length];
    const def = {
      name: `Estrela S${i + 1}`, key: `s${i + 1}`, kind: 'star',
      radius: pal.radius * (0.8 + Math.random() * 0.4),
      color: pal.color, color2: pal.color2, mu: pal.mu,
      soi: 30_000, gravReach: 80_000, spin: 200 + Math.random() * 300,
      cellScale: pal.cellScale,
    };
    const built = buildStar(def, { coronaScale: 5.5 });
    const r = CORE.starOrbitMin + Math.random() * (CORE.starOrbitMax - CORE.starOrbitMin);
    const ang = Math.random() * Math.PI * 2;
    const pos = center.clone().add(new THREE.Vector3(
      Math.cos(ang) * r, (Math.random() - 0.5) * r * 0.35, Math.sin(ang) * r,
    ));
    const star = registerStar(def, built, 'core', pos);
    const vC = Math.sqrt(CORE.smbh.mu / r) * (0.55 + Math.random() * 0.6);
    const s = Math.random() < 0.5 ? 1 : -1;
    makeDynamic(star, sysDef, {
      vel: new THREE.Vector3(-Math.sin(ang) * vC * s, (Math.random() - 0.5) * vC * 0.3, Math.cos(ang) * vC * s),
      softening: CORE.softening, anchor: smbh, centralMu: CORE.smbh.mu,
      reinjectR: (CORE.starOrbitMin + CORE.starOrbitMax) / 2,
    });
  }

  // Planetas perdidos vagando no enxame
  for (let i = 0; i < CORE.planetCount; i++) {
    const def = {
      name: `Errante-${i + 1}`, key: `err${i + 1}`,
      radius: 90 + Math.random() * 220,
      color: [0x8a7a68, 0x6a8098, 0x9a6a50][i % 3], color2: 0x3a342e,
      kind: i % 2 ? 'rock' : 'ice', spin: 50, mu: 3.0e6 * (0.5 + Math.random()), soi: 2600, moons: [],
    };
    const body = buildPlanetBody(def, smbh, 'core', center);
    body.orbitCenter = null;
    const r = 40_000 + Math.random() * 120_000;
    const ang = Math.random() * Math.PI * 2;
    body.worldPos.set(center.x + Math.cos(ang) * r, center.y + (Math.random() - 0.5) * r * 0.3, center.z + Math.sin(ang) * r);
    body.group.position.copy(body.worldPos);
    const vC = Math.sqrt(CORE.smbh.mu / r) * (0.6 + Math.random() * 0.55);
    const s = Math.random() < 0.5 ? 1 : -1;
    makeDynamic(body, sysDef, {
      vel: new THREE.Vector3(-Math.sin(ang) * vC * s, (Math.random() - 0.5) * vC * 0.25, Math.cos(ang) * vC * s),
      softening: CORE.softening, anchor: smbh, centralMu: CORE.smbh.mu, reinjectR: r,
    });
  }
}

// ===========================================================================
// SISTEMA BINÁRIO
// ===========================================================================
function buildBinarySystem() {
  const center = new THREE.Vector3(...BINARY.center);
  const bh = BINARY.blackHole, ns = BINARY.neutronStar;

  // Raios da dança binária ∝ inverso da massa (baricentro real).
  const total = bh.mu + ns.mu;
  const rBH = BINARY.separation * (ns.mu / total);
  const rNS = BINARY.separation * (bh.mu / total);
  // Período FÍSICO do par (Kepler): T = 2π·√(a³/μ_total). Trilho consistente com
  // a gravidade → a aceleração de frame cancela o puxão do parceiro e a nave
  // consegue órbitas FECHADAS em volta de cada membro.
  const pairPeriod = 2 * Math.PI * Math.sqrt(BINARY.separation ** 3 / total);

  // --- Buraco negro ---
  const bhGroup = buildBlackHole(bh);
  scene.add(bhGroup.group);
  const bhBody = {
    def: bh, group: bhGroup.group, mesh: bhGroup.horizon, worldPos: new THREE.Vector3(),
    mu: bh.mu, soi: bh.soi, gravReach: reach(bh), system: 'binary',
    isMoon: false, isSun: false, parent: null, binaryPair: true,
    barycenter: center, pairRadius: rBH, pairPhase: 0, period: pairPeriod,
  };
  game.bodies.push(bhBody);
  bodyFx.push(bhGroup.fx);

  // --- Estrela de nêutrons (pulsar) ---
  const nsGroup = buildNeutronStar(ns);
  scene.add(nsGroup.group);
  const nsBody = {
    def: ns, group: nsGroup.group, mesh: nsGroup.core, worldPos: new THREE.Vector3(),
    mu: ns.mu, soi: ns.soi, gravReach: reach(ns), system: 'binary',
    isMoon: false, isSun: false, parent: null, binaryPair: true,
    barycenter: center, pairRadius: rNS, pairPhase: Math.PI, period: pairPeriod,
  };
  game.bodies.push(nsBody);
  bodyFx.push(nsGroup.fx);

  // Luz azul-branca da estrela de nêutrons (ilumina os planetas gêmeos).
  const nsLight = new THREE.PointLight(0xcfe0ff, 3.0, 900_000, 0.0);
  nsGroup.group.add(nsLight);

  // Corrente de acreção: gás arrancado da estrela de nêutrons espiralando para o
  // disco do buraco negro — o par se comporta como um binário de verdade
  // (transferência de massa VISÍVEL entre os dois, reposicionada a cada frame).
  const streamMat = new THREE.MeshBasicMaterial({
    color: 0xaad4ff, transparent: true, opacity: 0.28,
    blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
  });
  const stream = new THREE.Mesh(
    new THREE.CylinderGeometry(bh.disk.inner * 0.14, ns.radius * 0.5, 1, 10, 1, true),
    streamMat,
  );
  scene.add(stream);
  const _sDir = new THREE.Vector3();
  const _sUp = new THREE.Vector3(0, 1, 0);
  bodyFx.push({ t: 0, update(dt) {
    this.t += dt;
    _sDir.copy(bhBody.worldPos).sub(nsBody.worldPos);
    const dist = _sDir.length();
    stream.visible = bhBody.group.visible && dist > 1;
    if (!stream.visible) return;
    _sDir.multiplyScalar(1 / dist);
    stream.position.copy(nsBody.worldPos).addScaledVector(_sDir, dist * 0.5);
    stream.scale.set(1, dist * 0.88, 1);
    stream.quaternion.setFromUnitVectors(_sUp, _sDir);
    streamMat.opacity = 0.09 + 0.05 * Math.sin(this.t * 2.3);
  } });

  // REMANESCENTE DE SUPERNOVA: a casca filamentar da estrela que MORREU para
  // criar o buraco negro — envolve o sistema inteiro (a história de origem).
  const remnant = buildSupernovaRemnant(BINARY.remnant);
  remnant.group.position.copy(center);
  scene.add(remnant.group);
  bodyFx.push(remnant.fx);
  _remnantGroup = remnant.group;

  // (Os planetas-gêmeos foram removidos em 2026-07-01: com 5 sistemas reais o
  //  clone do sistema solar virava ruído — o binário é BN + pulsar + remanescente.)
}

// Casca de remanescente de supernova: esfera gigante com filamentos FBM,
// borda realçada (fresnel invertido → look de CASCA), 2 cores (Hα + O III).
const REMNANT_FRAG = /* glsl */ `
  uniform float uTime;
  uniform vec3 uCol1;
  uniform vec3 uCol2;
  varying vec3 vDir;
  varying vec3 vN;
  varying vec3 vView;
  ${'__NOISE__'}
  void main(){
    float fil = fbm3(vDir * 7.0 + uTime * 0.004);
    // detalhe fino: 2 oitavas inline (não fbm3 completo) — o remanescente cobre a
    // TELA INTEIRA quando se está dentro do sistema binário; cada vnoise3 poupado
    // aqui é FPS direto no pior lugar (perf 2026-07-01).
    vec3 p2 = vDir * 16.0 - uTime * 0.003;
    float fil2 = vnoise3(p2) * 0.667 + vnoise3(p2 * 2.07) * 0.333;
    // filamentos: cristas do ruído
    float f = smoothstep(0.42, 0.62, fil) * (0.35 + 0.65 * fil2);
    // casca: borda do disco realça (limbo brilha, centro quase transparente)
    float mu_ = abs(dot(normalize(vN), normalize(vView)));
    float shell = pow(1.0 - mu_, 2.2);
    vec3 c = mix(uCol1, uCol2, smoothstep(0.3, 0.75, fil2));
    float alpha = (0.05 + 0.75 * f) * shell * 0.55;
    if (alpha < 0.004) discard;
    gl_FragColor = vec4(c, alpha);
  }
`.replace('__NOISE__', GLSL_NOISE);
const REMNANT_VERT = /* glsl */ `
  varying vec3 vDir;
  varying vec3 vN;
  varying vec3 vView;
  void main(){
    vDir = normalize(position);
    vN = normalize(normalMatrix * normal);
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vView = normalize(-mv.xyz);
    gl_Position = projectionMatrix * mv;
  }
`;

let _remnantGroup = null;
function buildSupernovaRemnant(def) {
  const group = new THREE.Group();
  const mat = new THREE.ShaderMaterial({
    vertexShader: REMNANT_VERT,
    fragmentShader: REMNANT_FRAG,
    uniforms: {
      uTime: { value: 0 },
      uCol1: { value: new THREE.Color(def.color1) },
      uCol2: { value: new THREE.Color(def.color2) },
    },
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
  });
  const seg = HEADLESS ? 20 : 64;
  const shell = new THREE.Mesh(new THREE.SphereGeometry(def.radius, seg, Math.floor(seg * 0.66)), mat);
  shell.renderOrder = 1;
  group.add(shell);
  const fx = { t: 0, update(dt) {
    this.t += dt;
    mat.uniforms.uTime.value = this.t;
    shell.rotation.y += dt * 0.002;                 // deriva lenta dos filamentos
    const grow = 1 + this.t * 0.00012;              // expansão sutil contínua
    shell.scale.setScalar(Math.min(1.25, grow));
  } };
  return { group, fx };
}

// Beacons: um farol colorido por sistema distante — o que você VÊ e mira de longe;
// some quando o sistema detalhado assume (culling por proximidade).
const _beacons = [];
function buildSystemBeacons() {
  const tints = {
    betelgeuse: ['rgba(255,170,100,0.98)', 'rgba(230,110,50,0.5)', 'rgba(150,50,20,0.15)', 'rgba(0,0,0,0)'],
    binary: ['rgba(220,232,255,0.98)', 'rgba(150,185,255,0.55)', 'rgba(150,90,230,0.18)', 'rgba(0,0,0,0)'],
    chaotic: ['rgba(200,220,255,0.95)', 'rgba(255,180,110,0.45)', 'rgba(120,80,50,0.12)', 'rgba(0,0,0,0)'],
    core: ['rgba(255,240,220,0.98)', 'rgba(255,190,120,0.5)', 'rgba(160,80,200,0.20)', 'rgba(0,0,0,0)'],
  };
  for (const sys of SYSTEMS) {
    if (sys.key === 'solar') continue;
    if (sys.key === 'betelgeuse') continue;   // a própria estrela é o farol
    const sp = makeRadialSprite(tints[sys.key]);
    sp.scale.setScalar(sys.key === 'betelgeuse' ? 26000 : 17000);
    sp.position.set(...sys.center);
    scene.add(sp);
    _beacons.push({ sys, sprite: sp });
  }
}

// ---- Buraco negro: horizonte + disco de acreção (shader) + anel de lensing ----
// Realismo (2026-07-01): o disco é um ShaderMaterial com rotação DIFERENCIAL
// (anéis internos giram mais rápido, ~Kepler), streaks turbulentos de gás, rampa
// de corpo-negro (branco-azul quente por dentro → vermelho profundo por fora) e
// Doppler beaming (o lado que vem na sua direção é mais brilhante). O "anel de
// lensing" é um segundo anel SEMPRE DE FRENTE para a câmera rente ao horizonte —
// vende a luz curvada (look Interstellar) sem raytracer.
const DISK_VERT = /* glsl */ `
  varying vec3 vLocal;
  void main(){ vLocal = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;
const DISK_FRAG = /* glsl */ `
  uniform float uTime;
  uniform float uInner;
  uniform float uOuter;
  uniform float uGain;
  uniform vec3 uC1;
  uniform vec3 uC2;
  uniform vec3 uC3;
  uniform vec3 uC4;
  varying vec3 vLocal;
  float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }
  float vnoise(vec2 p){
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x),
               mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
  }
  float fbm(vec2 p){
    float v = 0.0, a = 0.5;
    for (int i = 0; i < 4; i++) { v += a * vnoise(p); p *= 2.13; a *= 0.5; }
    return v;
  }
  void main(){
    float r = length(vLocal.xy);
    float ang = atan(vLocal.y, vLocal.x);
    float rn = clamp((r - uInner) / (uOuter - uInner), 0.0, 1.0);
    // Rotação diferencial ~Kepler: quanto mais interno, mais rápido o gás circula.
    float rot = uTime * 1.6 * pow(1.0 / (rn + 0.22), 1.5) * 0.22;
    // Streaks de gás: ruído alongado no ângulo (filamentos orbitais)
    float streak = fbm(vec2(ang * 3.0 + rot, rn * 22.0));
    float fino = fbm(vec2(ang * 9.0 + rot * 1.6, rn * 55.0));
    // Temperatura de corpo-negro: interna quente (paleta parametrizada — fogo
    // para discos de acreção, azul-síncrotron para o toro do pulsar)
    float temp = pow(1.0 - rn, 1.35);
    vec3 c = mix(uC1, uC2, smoothstep(0.0, 0.45, temp));
    c = mix(c, uC3, smoothstep(0.45, 0.75, temp));
    c = mix(c, uC4, smoothstep(0.75, 0.97, temp));
    // Doppler beaming: o lado do gás que se aproxima é mais brilhante (lado fixo)
    float doppler = 1.0 + 0.55 * cos(ang);
    float bright = (0.30 + 0.90 * streak * (0.55 + 0.45 * fino)) * doppler;
    // Bordas suaves e brilho interno mais intenso
    float edge = smoothstep(0.0, 0.05, rn) * (1.0 - smoothstep(0.82, 1.0, rn));
    vec3 col = c * bright * (0.7 + temp * 1.9) * uGain;
    gl_FragColor = vec4(col, edge * 0.95);
  }
`;
const DISK_FIRE = [[0.30, 0.04, 0.01], [1.0, 0.42, 0.10], [1.0, 0.85, 0.55], [0.85, 0.90, 1.0]];
const DISK_SYNCHROTRON = [[0.03, 0.06, 0.22], [0.15, 0.42, 0.95], [0.55, 0.85, 1.0], [0.92, 0.97, 1.0]];

function diskMaterial(inner, outer, gain = 1, palette = DISK_FIRE) {
  return new THREE.ShaderMaterial({
    vertexShader: DISK_VERT,
    fragmentShader: DISK_FRAG,
    uniforms: {
      uTime: { value: 0 },
      uInner: { value: inner },
      uOuter: { value: outer },
      uGain: { value: gain },
      uC1: { value: new THREE.Vector3(...palette[0]) },
      uC2: { value: new THREE.Vector3(...palette[1]) },
      uC3: { value: new THREE.Vector3(...palette[2]) },
      uC4: { value: new THREE.Vector3(...palette[3]) },
    },
    side: THREE.DoubleSide,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
}

function buildBlackHole(def) {
  const group = new THREE.Group();

  // Horizonte de eventos: esfera preta absoluta (engole a luz).
  const horizon = new THREE.Mesh(
    new THREE.SphereGeometry(def.rs, 48, 32),
    new THREE.MeshBasicMaterial({ color: 0x000000 }),
  );
  group.add(horizon);

  // Anel de fótons duplo: halos finos e cravados rente ao horizonte (luz presa).
  const photon = new THREE.Mesh(
    new THREE.TorusGeometry(def.photonRing, def.rs * 0.035, 10, 72),
    new THREE.MeshBasicMaterial({ color: 0xfff2cc, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }),
  );
  photon.rotation.x = Math.PI / 2;
  group.add(photon);
  const photon2 = new THREE.Mesh(
    new THREE.TorusGeometry(def.photonRing * 1.18, def.rs * 0.02, 8, 72),
    new THREE.MeshBasicMaterial({ color: 0xffd9a0, transparent: true, opacity: 0.45, blending: THREE.AdditiveBlending, depthWrite: false }),
  );
  photon2.rotation.x = Math.PI / 2;
  group.add(photon2);

  // Disco de acreção plano (shader) — levemente inclinado.
  const diskMat = diskMaterial(def.disk.inner, def.disk.outer, 1.0);
  const disk = new THREE.Mesh(new THREE.RingGeometry(def.disk.inner, def.disk.outer, 160, 4), diskMat);
  disk.rotation.x = Math.PI / 2 + 0.18;
  group.add(disk);

  // Anel de LENSING: mesmo shader, sempre de frente para a câmera, rente ao
  // horizonte — a imagem curvada do disco em volta da sombra, de qualquer ângulo.
  const lensMat = diskMaterial(def.rs * 1.12, def.rs * 2.6, 0.85);
  const lens = new THREE.Mesh(new THREE.RingGeometry(def.rs * 1.12, def.rs * 2.6, 96, 2), lensMat);
  group.add(lens);

  // (Sprite de glow REMOVIDO 2026-07-01: mesmo sutil virava uma bolha branca
  //  gigante de perto — o bloom do pós-processamento já dá o halo do disco.)

  const fx = { t: 0, update(dt) {
    this.t += dt;
    diskMat.uniforms.uTime.value = this.t;      // rotação diferencial no shader
    lensMat.uniforms.uTime.value = this.t * 1.4;
    lens.quaternion.copy(camera.quaternion);     // billboard: lente sempre de frente
    photon.material.opacity = 0.78 + Math.sin(this.t * 3) * 0.12;
    photon2.material.opacity = 0.35 + Math.sin(this.t * 2.2 + 1.4) * 0.10;
  } };
  return { group, horizon, fx };
}

// ---- Estrela de nêutrons / pulsar: núcleo + jatos polares + magnetosfera dipolo --
// Realismo (2026-07-01): jatos em DUAS camadas (feixe interno cravado + bainha
// externa difusa), MAGNETOSFERA com linhas de campo dipolo de verdade (r = L·sin²θ,
// tubos 3D em vários azimutes — não toros chapados) e EFEITO FAROL: quando o feixe
// varre a direção da câmera, o brilho estoura (é assim que se "vê" um pulsar).
function dipoleFieldLine(L, phi, radius) {
  // Linha de campo dipolo clássica: r(θ) = L·sin²θ, do polo norte ao polo sul.
  const pts = [];
  for (let i = 0; i <= 40; i++) {
    const th = 0.35 + (i / 40) * (Math.PI - 0.7);
    const r = Math.max(radius * 1.1, L * Math.sin(th) * Math.sin(th));
    pts.push(new THREE.Vector3(
      r * Math.sin(th) * Math.cos(phi),
      r * Math.cos(th),
      r * Math.sin(th) * Math.sin(phi),
    ));
  }
  const curve = new THREE.CatmullRomCurve3(pts);
  return new THREE.Mesh(
    new THREE.TubeGeometry(curve, 40, radius * 0.06, 5, false),
    new THREE.MeshBasicMaterial({ color: 0x86b4ff, transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false }),
  );
}

// RESTYLE 2026-07-01 (veredito do operador): anatomia de pulsar REAL (referência
// Caranguejo/Crab): núcleo COMPACTO ofuscante (o bloom faz o glare — nada de "ovo"
// chapado), TORO DE VENTO síncrotron azul no equador (o anel do Crab), dois jatos
// FINOS relativísticos ao longo do eixo, gaiola dipolo tênue. O farol é um flash
// CURTO quando o feixe varre a câmera — não um balão inflando.
function buildNeutronStar(def) {
  const group = new THREE.Group();

  // Núcleo: pequeno, branco-azulado, BRILHANTE (satura via bloom, não via sprite).
  const core = new THREE.Mesh(
    new THREE.SphereGeometry(def.radius, 48, 32),
    new THREE.MeshBasicMaterial({ color: 0xf4f8ff }),
  );
  group.add(core);
  // Brilho pontual curto (metade do raio do antigo, gradiente que MORRE cedo)
  const glint = makeRadialSprite(['rgba(235,244,255,0.85)', 'rgba(160,200,255,0.15)', 'rgba(0,0,0,0)']);
  glint.scale.setScalar(def.radius * 2.6);
  group.add(glint);

  // Eixo magnético (inclinado vs rotação) → jatos + toro carregados por ele.
  const axis = new THREE.Group();
  axis.rotation.z = def.jetTilt;
  group.add(axis);

  // TORO DE VENTO síncrotron (equatorial ao eixo magnético) — shader do disco
  // com paleta azul; rotação diferencial anima os filamentos circulares.
  const torusMat = diskMaterial(def.radius * 3.2, def.radius * 14, 0.85, DISK_SYNCHROTRON);
  const torus = new THREE.Mesh(
    new THREE.RingGeometry(def.radius * 3.2, def.radius * 14, 96, 3),
    torusMat,
  );
  torus.rotation.x = Math.PI / 2;
  axis.add(torus);

  // JATOS relativísticos: cilindros FINOS e longos (não cones gordos), com um
  // núcleo interno mais cravado — leitura de "agulha de luz".
  const jetLen = def.radius * 90;
  const jetMats = [];
  for (const s of [1, -1]) {
    const outer = new THREE.Mesh(
      new THREE.CylinderGeometry(def.radius * 0.9, def.radius * 0.35, jetLen, 10, 1, true),
      new THREE.MeshBasicMaterial({ color: 0x9fd0ff, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, depthWrite: false }),
    );
    outer.position.y = s * jetLen / 2;
    outer.rotation.x = s > 0 ? 0 : Math.PI;
    axis.add(outer);
    const inner = new THREE.Mesh(
      new THREE.CylinderGeometry(def.radius * 0.30, def.radius * 0.12, jetLen * 1.05, 8, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xeaf4ff, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, depthWrite: false }),
    );
    inner.position.y = s * jetLen * 0.525;
    inner.rotation.x = s > 0 ? 0 : Math.PI;
    axis.add(inner);
    jetMats.push(outer.material, inner.material);
  }

  // Gaiola dipolo: poucas linhas, bem tênues (estrutura, não neon).
  for (let i = 0; i < 6; i++) {
    const phi = (i / 6) * Math.PI * 2;
    const line = dipoleFieldLine(def.radius * 6.5, phi, def.radius);
    line.material.opacity = 0.09;
    axis.add(line);
  }

  const _jetDir = new THREE.Vector3();
  const _toCam = new THREE.Vector3();
  const fx = { t: 0, update(dt) {
    this.t += dt;
    // rotação ultrarrápida do pulsar (jatos + toro varrem o céu)
    group.rotation.y += dt * (Math.PI * 2 / def.spin);
    torusMat.uniforms.uTime.value = this.t;
    // cintilação dos jatos
    const flick = 0.85 + 0.15 * Math.sin(this.t * 37.3);
    jetMats[0].opacity = 0.22 * flick; jetMats[1].opacity = 0.6 * flick;
    jetMats[2].opacity = 0.22 * flick; jetMats[3].opacity = 0.6 * flick;
    // FAROL: flash curto e intenso quando o feixe cruza a câmera
    _jetDir.set(0, 1, 0).applyQuaternion(group.quaternion).applyQuaternion(axis.quaternion);
    _toCam.copy(camera.position).sub(group.position).normalize();
    const sweep = Math.pow(Math.abs(_jetDir.dot(_toCam)), 24);
    glint.material.opacity = Math.min(0.95, 0.5 + sweep * 0.45);
    glint.scale.setScalar(def.radius * (2.6 + sweep * 2.2));
    core.material.color.setRGB(0.92 + sweep * 0.08, 0.95 + sweep * 0.05, 1.0);
  } };
  return { group, core, fx };
}

// Texturas procedurais para o lens flare (principal = glow denso; ghost = anel fraco).
let _flareMain = null, _flareGhost = null;
function flareTexture(main) {
  const cached = main ? _flareMain : _flareGhost;
  if (cached) return cached;
  const cv = document.createElement('canvas'); cv.width = cv.height = 128;
  const ctx = cv.getContext('2d');
  const g = ctx.createRadialGradient(64, 64, 2, 64, 64, 64);
  if (main) {
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.18, 'rgba(255,238,200,0.85)');
    g.addColorStop(0.5, 'rgba(255,190,110,0.25)');
    g.addColorStop(1, 'rgba(255,150,70,0)');
  } else {
    g.addColorStop(0, 'rgba(255,255,255,0)');
    g.addColorStop(0.65, 'rgba(255,255,255,0.06)');
    g.addColorStop(0.82, 'rgba(255,255,255,0.28)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
  }
  ctx.fillStyle = g; ctx.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(cv);
  if (main) _flareMain = tex; else _flareGhost = tex;
  return tex;
}

// Sprite radial reutilizável a partir de uma lista de color-stops.
function makeRadialSprite(stops) {
  const cv = document.createElement('canvas'); cv.width = 128; cv.height = 128;
  const ctx = cv.getContext('2d');
  const g = ctx.createRadialGradient(64, 64, 2, 64, 64, 64);
  for (let i = 0; i < stops.length; i++) g.addColorStop(i / (stops.length - 1), stops[i]);
  ctx.fillStyle = g; ctx.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(cv);
  const mat = new THREE.SpriteMaterial({ map: tex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true });
  return new THREE.Sprite(mat);
}

// Anima os corpos especiais (disco de acreção, jatos do pulsar, pulso solar).
export function updateBodyFX(dt) {
  for (const f of bodyFx) f.update(dt);
}

// CULLING POR SISTEMA: cada sistema distante fica invisível (zero draw calls)
// até a nave se aproximar — no lugar brilha o BEACON colorido daquele sistema.
// O sistema solar (home) é sempre visível.
const _sysCenter = new THREE.Vector3();
export function updateSOIView(shipPos) {
  for (const sys of SYSTEMS) {
    if (sys.key === 'solar') continue;
    _sysCenter.set(...sys.center);
    const near = shipPos.distanceTo(_sysCenter) < sys.radius * 1.15;
    for (const b of game.bodies) {
      if (b.system !== sys.key) continue;
      // Betelgeuse NUNCA some: uma supergigante de 60k de raio é visível de
      // qualquer lugar do mapa — como a Betelgeuse real no céu da Terra.
      if (b.def.key === 'betelgeuse') { b.group.visible = true; continue; }
      if (b.group.visible !== near) b.group.visible = near;
    }
    if (sys.key === 'binary' && _remnantGroup) _remnantGroup.visible = near;
  }
  for (const bc of _beacons) {
    _sysCenter.set(...bc.sys.center);
    bc.sprite.visible = shipPos.distanceTo(_sysCenter) > bc.sys.radius * 0.9;
  }
}

// (Texturas canvas do Sol removidas — o Sol agora usa o shader genérico de
//  estrela com granulação fina, como todas as estrelas dos 5 sistemas.)
