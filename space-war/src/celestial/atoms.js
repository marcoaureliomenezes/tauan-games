// celestial/atoms.js — Átomos VISUAIS reutilizáveis da biblioteca de corpos celestes.
// Extraídos verbatim de bodies.js (release space-war-celestial-components-v1, AC-06):
// shaders de estrela/disco/remanescente, sprites radiais, texturas procedurais de
// planeta, atmosfera fresnel, anéis e a esfera padrão. Nada é carregado de fora:
// tudo pintado em canvas ou gerado em GLSL.

import * as THREE from '../../../vendor/three.module.min.js';

export const HEADLESS = typeof navigator !== 'undefined' && navigator.webdriver === true;

// ── GLSL compartilhado: value-noise 3D + FBM (estrelas, disco, remanescente) ──
export const GLSL_NOISE = /* glsl */ `
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
// limb darkening forte. uCell controla o tamanho das células (Sol ~26 fino,
// Betelgeuse ~1.8 gigante). uLump desloca vértices → silhueta assimétrica (ALMA).
export const STAR_VERT = /* glsl */ `
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
export const STAR_FRAG = /* glsl */ `
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
    // (perf 2026-07-01: 2 fbm3 + componente sintetizada em vez de 3 fbm3)
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

export function starMaterial(def) {
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

export function hex(c) { return '#' + c.toString(16).padStart(6, '0'); }
export function rndSeed(s) {
  let a = s >>> 0;
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

// ---- Texturas procedurais por tipo de corpo ------------------------------
// Memoizadas por identidade visual (gêmeos compartilham textura e memória de GPU).
// Retorna um BUNDLE { map, lights, rough }: lights/rough só existem para 'earth'.
const _texCache = new Map();
export function planetTexture(def) {
  const cacheKey = `${def.kind}|${def.color}|${def.color2 || 0}|${def.radius}|${def.redspot ? 1 : 0}`;
  const hit = _texCache.get(cacheKey);
  if (hit) return hit;
  const texs = buildPlanetTexture(def);
  _texCache.set(cacheKey, texs);
  return texs;
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
      const c = mixColor(def.color, def.color2 || def.color, wob);
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
    // Continentes — posições GUARDADAS para luzes de cidade e rugosidade.
    const conts = [];
    for (let i = 0; i < 26; i++) {
      const cx = rnd() * W, cy = H * 0.2 + rnd() * H * 0.6;
      const cr = 30 + rnd() * 90;
      const land = rnd() < 0.5 ? '#2f7d3a' : '#6b8e3a';
      paintBlob(ctx, cx, cy, cr, land, rnd, 0.8);
      paintBlob(ctx, cx + (rnd() - 0.5) * 40, cy + (rnd() - 0.5) * 30, 18 + rnd() * 40, '#7a5a2a', rnd, 0.4);
      conts.push([cx, cy, cr]);
    }
    // Calotas polares
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    ctx.fillRect(0, 0, W, H * 0.06); ctx.fillRect(0, H * 0.94, W, H * 0.06);
    // Nuvens
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 60; i++) paintBlob(ctx, rnd() * W, rnd() * H, 20 + rnd() * 70, 'rgba(255,255,255,0.35)', rnd, 1);
    ctx.globalCompositeOperation = 'source-over';

    // MAPA DE LUZES DE CIDADE (emissive): aglomerados âmbar sobre continentes.
    const lcv = document.createElement('canvas'); lcv.width = W; lcv.height = H;
    const lctx = lcv.getContext('2d');
    lctx.fillStyle = '#000'; lctx.fillRect(0, 0, W, H);
    for (const [cx, cy, cr] of conts) {
      const clusters = 6 + (rnd() * 14) | 0;
      for (let k = 0; k < clusters; k++) {
        const a = rnd() * Math.PI * 2;
        const d = cr * (0.25 + rnd() * 0.65);          // viés para a "costa"
        const gx = cx + Math.cos(a) * d, gy = cy + Math.sin(a) * d * 0.8;
        const g = lctx.createRadialGradient(gx, gy, 0, gx, gy, 3 + rnd() * 7);
        g.addColorStop(0, 'rgba(255,196,120,0.95)');
        g.addColorStop(1, 'rgba(255,150,60,0)');
        lctx.fillStyle = g;
        lctx.beginPath(); lctx.arc(gx, gy, 3 + rnd() * 7, 0, Math.PI * 2); lctx.fill();
        for (let j = 0; j < 6; j++) {
          lctx.fillStyle = 'rgba(255,210,140,0.9)';
          lctx.fillRect((gx + (rnd() - 0.5) * 22) | 0, (gy + (rnd() - 0.5) * 16) | 0, 1, 1);
        }
      }
    }
    const lightsTex = new THREE.CanvasTexture(lcv);
    lightsTex.colorSpace = THREE.SRGBColorSpace;

    // MAPA DE RUGOSIDADE: oceano LISO (glint especular), terra/calotas ásperas.
    const rcv = document.createElement('canvas'); rcv.width = W; rcv.height = H;
    const rctx = rcv.getContext('2d');
    rctx.fillStyle = 'rgb(70,70,70)'; rctx.fillRect(0, 0, W, H);
    rctx.fillStyle = '#fff';
    for (const [cx, cy, cr] of conts) {
      rctx.beginPath(); rctx.ellipse(cx, cy, cr, cr * 0.8, 0, 0, Math.PI * 2); rctx.fill();
    }
    rctx.fillRect(0, 0, W, H * 0.06); rctx.fillRect(0, H * 0.94, W, H * 0.06);
    const roughTex = new THREE.CanvasTexture(rcv);

    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    return { map: tex, lights: lightsTex, rough: roughTex };
  } else if (def.kind === 'cloud') {
    // Vênus: nuvens cremosas em redemoinho.
    ctx.fillStyle = base; ctx.fillRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 300; i++) paintBlob(ctx, rnd() * W, rnd() * H, 30 + rnd() * 80, `rgba(255,240,200,${rnd() * 0.10})`, rnd, 1);
    ctx.globalCompositeOperation = 'source-over';
  } else {
    // Rocha: base + crateras + variação.
    ctx.fillStyle = base; ctx.fillRect(0, 0, W, H);
    for (let i = 0; i < 400; i++) paintBlob(ctx, rnd() * W, rnd() * H, 4 + rnd() * 30, hex(mixColor(def.color, def.color2 || def.color, rnd())), rnd, 0.6);
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
  return { map: tex, lights: null, rough: null };
}

export function paintBlob(ctx, x, y, r, color, rnd, irregular) {
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

export function mixColor(a, b, t) {
  const ar = (a >> 16) & 255, ag = (a >> 8) & 255, ab = a & 255;
  const br = (b >> 16) & 255, bg = (b >> 8) & 255, bb = b & 255;
  const r = (ar + (br - ar) * t) | 0, g = (ag + (bg - ag) * t) | 0, bl = (ab + (bb - ab) * t) | 0;
  return (r << 16) | (g << 8) | bl;
}

// ---- Atmosfera (fresnel additive) ----------------------------------------
export function atmosphere(radius, color) {
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
export function ringMesh(ring) {
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

// ---- Esfera padrão de corpo ----------------------------------------------
export function makeSphere(radius, texs, emissive, def = null) {
  const tex = texs.map || texs;               // aceita bundle { map, … } ou textura crua
  // HEADLESS (swiftshader/CI): material BASIC — PBR em software-GL derruba o FPS.
  const mat = (emissive || HEADLESS)
    ? new THREE.MeshBasicMaterial({ map: tex })
    : new THREE.MeshStandardMaterial({ map: tex, roughness: 0.95, metalness: 0.0 });
  if (!emissive && !HEADLESS && def) {
    // Relevo barato: a própria textura como bump map.
    if (def.kind === 'rock' || def.kind === 'earth' || !def.kind) {
      mat.bumpMap = tex;
      // clamp superior: relevo é tempero, não contorno.
      mat.bumpScale = Math.min(8, Math.max(0.5, radius * 0.02));
    }
    if (def.kind === 'earth') {
      // Reflexo do Sol no OCEANO + LUZES DE CIDADE no lado noturno.
      if (texs.rough) { mat.roughnessMap = texs.rough; mat.roughness = 1.0; }
      else mat.roughness = 0.62;
      if (texs.lights) {
        mat.emissive = new THREE.Color(0xffb46a);
        mat.emissiveMap = texs.lights;
        mat.emissiveIntensity = 0.55;   // de dia o Sol lava; de noite as cidades brilham
      }
    }
  }
  // TESSELAÇÃO ALTA: na aproximação final o limbo precisa ficar contínuo.
  const seg = HEADLESS ? 24 : radius > 2000 ? 96 : radius > 300 ? 72 : radius > 50 ? 56 : radius > 8 ? 40 : 28;
  return new THREE.Mesh(new THREE.SphereGeometry(radius, seg, Math.floor(seg * 0.66)), mat);
}

// ---- Disco de acreção / toro síncrotron (shader) --------------------------
export const DISK_VERT = /* glsl */ `
  varying vec3 vLocal;
  void main(){ vLocal = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;
export const DISK_FRAG = /* glsl */ `
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
    // ESTRIAS FINAS: ruído "ridged" radial alto/angular baixo, cisalhado pela rotação.
    vec2 sp = vec2(ang * 2.0 + rot * 1.3, rn * 90.0);
    float lam = vnoise(sp) * 0.62 + vnoise(sp * 2.13) * 0.38;
    float stria = pow(1.0 - abs(2.0 * lam - 1.0), 3.0);
    // Streaks de gás: ruído alongado no ângulo (manchas orbitais largas)
    float streak = fbm(vec2(ang * 3.0 + rot, rn * 22.0));
    float fino = fbm(vec2(ang * 9.0 + rot * 1.6, rn * 55.0));
    // Temperatura de corpo-negro: interna quente (paleta parametrizada)
    float temp = pow(1.0 - rn, 1.35);
    vec3 c = mix(uC1, uC2, smoothstep(0.0, 0.45, temp));
    c = mix(c, uC3, smoothstep(0.45, 0.75, temp));
    c = mix(c, uC4, smoothstep(0.75, 0.97, temp));
    // Doppler beaming (P2-9): I_obs = δ^(3+α)·I_emit com v~0.4c na ISCO → o lado
    // que se APROXIMA é ~10× mais brilhante (EHT M87*: assimetria ~10:1).
    float doppler = pow(1.0 + 0.60 * cos(ang), 1.8);
    float bright = (0.20 + 0.55 * streak * (0.5 + 0.5 * fino) + 0.80 * stria) * doppler;
    // Bordas suaves e brilho interno mais intenso (borda interna QUEIMA de branco)
    float edge = smoothstep(0.0, 0.04, rn) * (1.0 - smoothstep(0.80, 1.0, rn));
    vec3 col = c * bright * (0.55 + temp * 2.3) * uGain;
    gl_FragColor = vec4(col, edge * 0.95);
  }
`;
// Rampa térmica (EHT/D.A): externa marrom-avermelhada → interna BRANCO-QUENTE.
export const DISK_FIRE = [[0.26, 0.05, 0.015], [0.95, 0.38, 0.08], [1.0, 0.78, 0.42], [1.0, 0.97, 0.88]];
export const DISK_SYNCHROTRON = [[0.03, 0.06, 0.22], [0.15, 0.42, 0.95], [0.55, 0.85, 1.0], [0.92, 0.97, 1.0]];

export function diskMaterial(inner, outer, gain = 1, palette = DISK_FIRE) {
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

// ---- Casca de remanescente de supernova (shader) ---------------------------
export const REMNANT_FRAG = /* glsl */ `
  uniform float uTime;
  uniform vec3 uCol1;
  uniform vec3 uCol2;
  varying vec3 vDir;
  varying vec3 vN;
  varying vec3 vView;
  ${'__NOISE__'}
  void main(){
    float fil = fbm3(vDir * 7.0 + uTime * 0.004);
    // detalhe fino: 2 oitavas inline — o remanescente cobre a TELA INTEIRA
    // quando se está dentro do sistema; cada vnoise3 poupado é FPS (perf 2026-07-01).
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
export const REMNANT_VERT = /* glsl */ `
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

// ---- Lens flare (texturas procedurais) -------------------------------------
let _flareMain = null, _flareGhost = null;
export function flareTexture(main) {
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
export function makeRadialSprite(stops) {
  const cv = document.createElement('canvas'); cv.width = 128; cv.height = 128;
  const ctx = cv.getContext('2d');
  const g = ctx.createRadialGradient(64, 64, 2, 64, 64, 64);
  for (let i = 0; i < stops.length; i++) g.addColorStop(i / (stops.length - 1), stops[i]);
  ctx.fillStyle = g; ctx.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(cv);
  const mat = new THREE.SpriteMaterial({ map: tex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true });
  return new THREE.Sprite(mat);
}
