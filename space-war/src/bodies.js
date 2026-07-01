// bodies.js — Constrói o Sol, os planetas e as luas com texturas procedurais,
// atmosferas (fresnel) e anéis. Nada é carregado de fora: tudo pintado em canvas.

import * as THREE from '../../vendor/three.module.min.js';
import { Lensflare, LensflareElement } from '../../vendor/jsm/objects/Lensflare.js';
import { SUN, PLANETS, BINARY, defaultGravReach } from './config.js';
import { scene, camera } from './scene.js';
import { game } from './state.js';

const HEADLESS = typeof navigator !== 'undefined' && navigator.webdriver === true;

const ORIGIN = new THREE.Vector3(0, 0, 0);
const BIN_CENTER = new THREE.Vector3(...BINARY.center);
const BIN_CULL = 220_000;   // cada corpo binário aparece quando a nave chega a esta distância DELE
// Hooks de animação por-frame dos corpos especiais (disco de acreção, jatos, pulso).
const bodyFx = [];
// Beacon: estrela brilhante sempre visível na posição do binário, pra você ENXERGAR
// e mirar o destino de longe. Some quando o sistema detalhado aparece (ao se aproximar).
let binBeacon = null;

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
  const seg = radius > 50 ? 40 : radius > 12 ? 28 : 16;
  return new THREE.Mesh(new THREE.SphereGeometry(radius, seg, seg / 2), mat);
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

export function buildSolarSystem() {
  // --- Sol ---
  const sunGroup = new THREE.Group();
  const sunTex = sunTexture();
  const sunMesh = makeSphere(SUN.radius, sunTex, true);
  sunGroup.add(sunMesh);
  const corona = sunGlow(SUN.radius);
  sunGroup.add(corona);
  // Luz do Sol — alcance FINITO (1,4M) p/ cobrir o sistema solar mas NÃO o binário.
  const light = new THREE.PointLight(SUN.light, 3.2, 1_400_000, 0.0);
  sunGroup.add(light);
  // Lens flare (examples/jsm vendorado): brilho de lente ao olhar para o Sol.
  if (!HEADLESS) {
    const flare = new Lensflare();
    flare.addElement(new LensflareElement(flareTexture(true), 640, 0, new THREE.Color(0xfff0c8)));
    flare.addElement(new LensflareElement(flareTexture(false), 110, 0.55, new THREE.Color(0xffd9a0)));
    flare.addElement(new LensflareElement(flareTexture(false), 60, 0.85, new THREE.Color(0xaac8ff)));
    flare.addElement(new LensflareElement(flareTexture(false), 150, 1.2, new THREE.Color(0xff9a70)));
    light.add(flare);
  }
  scene.add(sunGroup);
  const sun = {
    def: SUN, group: sunGroup, mesh: sunMesh, worldPos: new THREE.Vector3(0, 0, 0),
    mu: SUN.mu, soi: SUN.soi, gravReach: reach(SUN), system: 'home', orbitCenter: ORIGIN,
    isMoon: false, isSun: true, parent: null, angle: 0,
  };
  game.sun = sun;
  game.bodies.push(sun);
  // pulso solar (anima a corona única + a cor do disco — barato, sem fill extra)
  bodyFx.push({ t: 0, update(dt) {
    this.t += dt;
    const p = 0.85 + Math.sin(this.t * 1.7) * 0.12;
    corona.scale.setScalar(SUN.radius * (5.5 + Math.sin(this.t * 1.3) * 0.25));
    sunMesh.material.color.setRGB(1, 0.92 * p + 0.05, 0.55 * p);
  } });

  // --- Planetas do sistema solar ---
  for (const def of PLANETS) buildPlanetBody(def, sun, 'home', ORIGIN);

  // --- Segundo sistema: binário buraco-negro + estrela-de-nêutrons ---
  buildBinarySystem();

  return game.bodies;
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

  // --- Buraco negro ---
  const bhGroup = buildBlackHole(bh);
  scene.add(bhGroup.group);
  const bhBody = {
    def: bh, group: bhGroup.group, mesh: bhGroup.horizon, worldPos: new THREE.Vector3(),
    mu: bh.mu, soi: bh.soi, gravReach: reach(bh), system: 'binary',
    isMoon: false, isSun: false, parent: null, binaryPair: true,
    barycenter: center, pairRadius: rBH, pairPhase: 0, period: BINARY.pairPeriod,
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
    barycenter: center, pairRadius: rNS, pairPhase: Math.PI, period: BINARY.pairPeriod,
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

  // Beacon: ponto brilhante (branco-azul + tom púrpura do disco) visível do sistema
  // solar inteiro. É o que você vê e mira de longe; some ao chegar perto (detalhe assume).
  binBeacon = makeRadialSprite(['rgba(220,232,255,0.98)', 'rgba(150,185,255,0.55)', 'rgba(150,90,230,0.18)', 'rgba(0,0,0,0)']);
  binBeacon.scale.setScalar(17000);
  binBeacon.position.copy(center);
  scene.add(binBeacon);

  // --- Planetas gêmeos orbitando o baricentro, em ÓRBITAS COMPACTAS (50k–197k) ---
  // Mantidos dentro do domínio do binário (SOI 230k) e fora da zona de não-retorno (~40k),
  // pra NÃO vazarem para o SOI do Sol. É um sistema planetário aninhado no buraco negro.
  PLANETS.forEach((def, i) => {
    const twin = { ...def, key: def.key + '2', name: def.name + ' β', orbit: 50000 + i * 21000 };
    if (def.moons) twin.moons = def.moons.map((m) => ({ ...m, name: m.name + ' β' }));
    buildPlanetBody(twin, null, 'binary', center);
  });
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
    // Temperatura de corpo-negro: interna quente
    float temp = pow(1.0 - rn, 1.35);
    vec3 c = mix(vec3(0.30, 0.04, 0.01), vec3(1.0, 0.42, 0.10), smoothstep(0.0, 0.45, temp));
    c = mix(c, vec3(1.0, 0.85, 0.55), smoothstep(0.45, 0.75, temp));
    c = mix(c, vec3(0.85, 0.90, 1.0), smoothstep(0.75, 0.97, temp));
    // Doppler beaming: o lado do gás que se aproxima é mais brilhante (lado fixo)
    float doppler = 1.0 + 0.55 * cos(ang);
    float bright = (0.30 + 0.90 * streak * (0.55 + 0.45 * fino)) * doppler;
    // Bordas suaves e brilho interno mais intenso
    float edge = smoothstep(0.0, 0.05, rn) * (1.0 - smoothstep(0.82, 1.0, rn));
    vec3 col = c * bright * (0.7 + temp * 1.9) * uGain;
    gl_FragColor = vec4(col, edge * 0.95);
  }
`;
function diskMaterial(inner, outer, gain = 1) {
  return new THREE.ShaderMaterial({
    vertexShader: DISK_VERT,
    fragmentShader: DISK_FRAG,
    uniforms: {
      uTime: { value: 0 },
      uInner: { value: inner },
      uOuter: { value: outer },
      uGain: { value: gain },
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

function buildNeutronStar(def) {
  const group = new THREE.Group();

  // Núcleo: esfera pequena e ofuscante (azul-branco) — o bloom faz o resto.
  const core = new THREE.Mesh(
    new THREE.SphereGeometry(def.radius, 32, 24),
    new THREE.MeshBasicMaterial({ color: 0xeaf2ff }),
  );
  group.add(core);

  // Halo ofuscante — gradiente CURTO (cai a ~zero na metade do raio do sprite)
  // para ler como brilho pontual intenso, não como um ovo bege chapado.
  const halo = makeRadialSprite(['rgba(230,240,255,0.9)', 'rgba(150,190,255,0.22)', 'rgba(80,120,255,0.04)', 'rgba(0,0,0,0)']);
  halo.scale.setScalar(def.radius * 5);
  group.add(halo);

  // Eixo magnético (inclinado vs rotação) → carrega os dois jatos polares = farol.
  const axis = new THREE.Group();
  axis.rotation.z = def.jetTilt;
  group.add(axis);

  const jetLen = def.radius * 60, jetR = def.radius * 2.6;
  const jetMats = [];
  for (const s of [1, -1]) {
    // Bainha externa difusa
    const sheath = new THREE.Mesh(
      new THREE.ConeGeometry(jetR, jetLen, 16, 1, true),
      new THREE.MeshBasicMaterial({ color: 0x9fd0ff, transparent: true, opacity: 0.28, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, depthWrite: false }),
    );
    sheath.position.y = s * jetLen / 2;
    sheath.rotation.x = s > 0 ? 0 : Math.PI;
    axis.add(sheath);
    // Feixe interno cravado e brilhante
    const beam = new THREE.Mesh(
      new THREE.ConeGeometry(jetR * 0.38, jetLen * 1.06, 12, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xdcecff, transparent: true, opacity: 0.75, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, depthWrite: false }),
    );
    beam.position.y = s * jetLen * 0.53;
    beam.rotation.x = s > 0 ? 0 : Math.PI;
    axis.add(beam);
    jetMats.push(sheath.material, beam.material);
    // ponta brilhante do feixe
    const tip = makeRadialSprite(['rgba(200,225,255,0.9)', 'rgba(120,170,255,0.3)', 'rgba(0,0,0,0)']);
    tip.scale.setScalar(def.radius * 10);
    tip.position.y = s * jetLen;
    axis.add(tip);
  }

  // Magnetosfera: linhas de campo dipolo em 8 azimutes × 2 conchas (L distintos).
  for (let i = 0; i < 8; i++) {
    const phi = (i / 8) * Math.PI * 2;
    axis.add(dipoleFieldLine(def.radius * 5.2, phi, def.radius));
    if (i % 2 === 0) axis.add(dipoleFieldLine(def.radius * 8.5, phi + 0.35, def.radius));
  }

  const _jetDir = new THREE.Vector3();
  const _toCam = new THREE.Vector3();
  const fx = { t: 0, update(dt) {
    this.t += dt;
    // rotação ultrarrápida do pulsar (gira o conjunto inteiro → jatos varrem o céu)
    group.rotation.y += dt * (Math.PI * 2 / def.spin);
    // pulso de brilho + cintilação dos jatos
    const p = 0.7 + Math.abs(Math.sin(this.t * (Math.PI * 2 / def.spin))) * 0.3;
    core.material.color.setRGB(0.87 * p + 0.1, 0.92 * p + 0.06, 1.0);
    const flick = 0.86 + 0.14 * Math.sin(this.t * 31.7);
    for (const m of jetMats) m.opacity = (m.color.r > 0.7 ? 0.75 : 0.28) * flick;
    // EFEITO FAROL: feixe apontando para a câmera → flash (pulsar visível de longe)
    _jetDir.set(0, 1, 0).applyQuaternion(group.quaternion).applyQuaternion(axis.quaternion);
    _toCam.copy(camera.position).sub(group.position).normalize();
    const sweep = Math.pow(Math.abs(_jetDir.dot(_toCam)), 18);
    halo.material.opacity = Math.min(0.92, 0.55 + p * 0.2 + sweep * 0.5);
    halo.scale.setScalar(def.radius * (5 + sweep * 3));
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

// Mostra a bolha de SOI só quando a nave se aproxima + CULL do sistema binário.
// Quando a nave está longe do binário (jogo no sistema solar), todo o grupo binário
// fica invisível → ZERO draw calls, FPS de volta ao baseline mesmo em software-GL.
export function updateSOIView(shipPos) {
  for (const b of game.bodies) {
    if (b.system === 'binary') {
      const vis = shipPos.distanceTo(b.worldPos) < BIN_CULL;   // cull POR CORPO
      if (b.group.visible !== vis) b.group.visible = vis;
    }
    if (!b.soiMesh) continue;
    b.soiMesh.visible = shipPos.distanceTo(b.worldPos) < b.soi * 1.3;
  }
  // Beacon (estrela brilhante do binário) visível enquanto o par compacto está longe.
  if (binBeacon) binBeacon.visible = shipPos.distanceTo(BIN_CENTER) > BIN_CULL * 0.8;
}

// ---- Texturas/visuais do Sol ---------------------------------------------
function sunTexture() {
  const W = 1024, H = 512;
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const ctx = cv.getContext('2d');
  const rnd = rndSeed(42);
  ctx.fillStyle = '#ffcf4d'; ctx.fillRect(0, 0, W, H);
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 800; i++) paintBlob(ctx, rnd() * W, rnd() * H, 10 + rnd() * 50, `rgba(255,${180 + rnd() * 60 | 0},80,${rnd() * 0.25})`, rnd, 1);
  ctx.globalCompositeOperation = 'source-over';
  // manchas solares
  for (let i = 0; i < 18; i++) { ctx.fillStyle = 'rgba(120,40,0,0.35)'; ctx.beginPath(); ctx.arc(rnd() * W, rnd() * H, 4 + rnd() * 16, 0, Math.PI * 2); ctx.fill(); }
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function sunGlow(radius) {
  const cv = document.createElement('canvas'); cv.width = 256; cv.height = 256;
  const ctx = cv.getContext('2d');
  const g = ctx.createRadialGradient(128, 128, 20, 128, 128, 128);
  g.addColorStop(0, 'rgba(255,240,180,0.9)');
  g.addColorStop(0.25, 'rgba(255,180,80,0.5)');
  g.addColorStop(0.6, 'rgba(255,120,40,0.18)');
  g.addColorStop(1, 'rgba(255,90,30,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, 256, 256);
  const tex = new THREE.CanvasTexture(cv);
  const mat = new THREE.SpriteMaterial({ map: tex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.setScalar(radius * 5.5);
  return sprite;
}
