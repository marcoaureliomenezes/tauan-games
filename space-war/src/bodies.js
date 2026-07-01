// bodies.js — Constrói o Sol, os planetas e as luas com texturas procedurais,
// atmosferas (fresnel) e anéis. Nada é carregado de fora: tudo pintado em canvas.

import * as THREE from '../../vendor/three.module.min.js';
import { SUN, PLANETS, BINARY, defaultGravReach } from './config.js';
import { scene } from './scene.js';
import { game } from './state.js';

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
function makeSphere(radius, tex, emissive) {
  const mat = emissive
    ? new THREE.MeshBasicMaterial({ map: tex })
    : new THREE.MeshStandardMaterial({ map: tex, roughness: 0.95, metalness: 0.0 });
  const seg = radius > 50 ? 40 : radius > 12 ? 28 : 16;
  return new THREE.Mesh(new THREE.SphereGeometry(radius, seg, seg / 2), mat);
}

function reach(def) { return def.gravReach || defaultGravReach(def); }

// Constrói um planeta (+ luas) e o registra. `orbitCenter` é o ponto que ele orbita
// (origem no sistema solar, baricentro no binário). Reaproveitado pelos dois sistemas.
function buildPlanetBody(def, parentBody, system, orbitCenter) {
  const group = new THREE.Group();
  const tex = planetTexture(def);
  const mesh = makeSphere(def.radius, tex, false);
  mesh.rotation.z = def.tilt || 0;
  group.add(mesh);
  if (def.hasAtmo || def.atmosphere) group.add(atmosphere(def.radius, def.atmosphere || 0x6fb6ff));
  if (def.ring) group.add(ringMesh(def.ring));
  const soiMesh = new THREE.Mesh(
    new THREE.SphereGeometry(def.soi, 24, 16),
    new THREE.MeshBasicMaterial({ color: 0x4aa6e0, wireframe: true, transparent: true, opacity: 0.08, depthWrite: false }),
  );
  soiMesh.visible = false;
  group.add(soiMesh);
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
    const mmesh = makeSphere(m.radius, mtex, false);
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

// ---- Buraco negro: horizonte + disco de acreção + anel de fótons ----------
function buildBlackHole(def) {
  const group = new THREE.Group();

  // Horizonte de eventos: esfera preta absoluta (engole a luz).
  const horizon = new THREE.Mesh(
    new THREE.SphereGeometry(def.rs, 32, 20),
    new THREE.MeshBasicMaterial({ color: 0x000000 }),
  );
  group.add(horizon);

  // Anel de fótons: halo fino e brilhante rente ao horizonte (luz curvada).
  const photon = new THREE.Mesh(
    new THREE.TorusGeometry(def.photonRing, def.rs * 0.05, 10, 56),
    new THREE.MeshBasicMaterial({ color: 0xffe6b0, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false }),
  );
  photon.rotation.x = Math.PI / 2;
  group.add(photon);

  // Disco de acreção: corpo-negro radial (vermelho fora → branco-azulado dentro),
  // com assimetria de brilho por Doppler beaming (um lado mais claro).
  const disk = accretionDisk(def.disk.inner, def.disk.outer);
  group.add(disk.mesh);

  // Glow geral do disco (sprite aditivo) para vender o brilho intenso.
  const glow = makeRadialSprite(['rgba(255,230,180,0.5)', 'rgba(255,150,80,0.22)', 'rgba(120,60,200,0.08)', 'rgba(0,0,0,0)']);
  glow.scale.setScalar(def.disk.outer * 2.2);
  group.add(glow);

  const fx = { t: 0, update(dt) {
    this.t += dt;
    disk.mesh.rotation.z -= dt * 0.7;          // disco gira
    disk.update(this.t);                        // anima o shimmer + Doppler
    photon.material.opacity = 0.7 + Math.sin(this.t * 3) * 0.15;
    glow.material.rotation += dt * 0.2;
  } };
  return { group, horizon, fx };
}

// Disco de acreção como malha de anel com cor por vértice (gradiente de corpo-negro)
// e um shimmer animado via material.opacity + leve rotação de textura.
function accretionDisk(inner, outer) {
  const geo = new THREE.RingGeometry(inner, outer, 128, 6);
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const v = new THREE.Vector3().fromBufferAttribute(pos, i);
    const r = (v.length() - inner) / (outer - inner);          // 0 dentro → 1 fora
    const ang = Math.atan2(v.y, v.x);
    // corpo-negro: quente (branco-azul) dentro → frio (vermelho) fora
    const temp = 1 - r;
    const doppler = 0.6 + 0.4 * Math.cos(ang);                 // um lado mais brilhante
    c.setRGB(
      (0.9 + temp * 0.1) * doppler,
      (0.35 + temp * 0.6) * doppler,
      (0.15 + temp * 0.85) * doppler,
    );
    colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const mat = new THREE.MeshBasicMaterial({
    vertexColors: true, side: THREE.DoubleSide, transparent: true,
    opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.rotation.x = Math.PI / 2 + 0.18;          // levemente inclinado
  return { mesh, update(t) { mat.opacity = 0.8 + Math.sin(t * 5) * 0.12; } };
}

// ---- Estrela de nêutrons / pulsar: núcleo + jatos polares + campo magnético --
function buildNeutronStar(def) {
  const group = new THREE.Group();

  // Núcleo: esfera pequena e ofuscante (azul-branco).
  const core = new THREE.Mesh(
    new THREE.SphereGeometry(def.radius, 32, 24),
    new THREE.MeshBasicMaterial({ color: 0xdfeaff }),
  );
  group.add(core);

  // Halo ofuscante.
  const halo = makeRadialSprite(['rgba(220,235,255,0.95)', 'rgba(150,190,255,0.5)', 'rgba(80,120,255,0.15)', 'rgba(0,0,0,0)']);
  halo.scale.setScalar(def.radius * 9);
  group.add(halo);

  // Eixo magnético (inclinado vs rotação) → carrega os dois jatos polares = farol.
  const axis = new THREE.Group();
  axis.rotation.z = def.jetTilt;
  group.add(axis);

  const jetLen = def.radius * 60, jetR = def.radius * 2.6;
  for (const s of [1, -1]) {
    const jet = new THREE.Mesh(
      new THREE.ConeGeometry(jetR, jetLen, 16, 1, true),
      new THREE.MeshBasicMaterial({ color: 0x9fd0ff, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, depthWrite: false }),
    );
    // cone aponta +Y por padrão; posiciona a base na estrela, ápice longe
    jet.position.y = s * jetLen / 2;
    jet.rotation.x = s > 0 ? 0 : Math.PI;
    axis.add(jet);
    // ponta brilhante do feixe
    const tip = makeRadialSprite(['rgba(200,225,255,0.9)', 'rgba(120,170,255,0.3)', 'rgba(0,0,0,0)']);
    tip.scale.setScalar(def.radius * 10);
    tip.position.y = s * jetLen;
    axis.add(tip);
  }

  // Linhas de campo magnético (toros concêntricos ao redor do eixo magnético).
  for (let i = 1; i <= 3; i++) {
    const ringR = def.radius * (2.5 + i * 2.2);
    const loop = new THREE.Mesh(
      new THREE.TorusGeometry(ringR, def.radius * 0.12, 6, 32),
      new THREE.MeshBasicMaterial({ color: 0x77aaff, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false }),
    );
    axis.add(loop);
  }

  const fx = { t: 0, update(dt) {
    this.t += dt;
    // rotação ultrarrápida do pulsar (gira o conjunto inteiro → jatos varrem o céu)
    group.rotation.y += dt * (Math.PI * 2 / def.spin);
    // pulso de brilho
    const p = 0.7 + Math.abs(Math.sin(this.t * (Math.PI * 2 / def.spin))) * 0.3;
    core.material.color.setRGB(0.87 * p + 0.1, 0.92 * p + 0.06, 1.0);
    halo.material.opacity = 0.6 + p * 0.35;
  } };
  return { group, core, fx };
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
