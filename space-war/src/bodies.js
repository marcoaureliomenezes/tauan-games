// bodies.js — Constrói o Sol, os planetas e as luas com texturas procedurais,
// atmosferas (fresnel) e anéis. Nada é carregado de fora: tudo pintado em canvas.

import * as THREE from '../../vendor/three.module.min.js';
import { SUN, PLANETS } from './config.js';
import { scene } from './scene.js';
import { game } from './state.js';

function hex(c) { return '#' + c.toString(16).padStart(6, '0'); }
function rndSeed(s) {
  let a = s >>> 0;
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

// ---- Texturas procedurais por tipo de corpo ------------------------------
function planetTexture(def) {
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

export function buildSolarSystem() {
  // --- Sol ---
  const sunGroup = new THREE.Group();
  const sunTex = sunTexture();
  const sunMesh = makeSphere(SUN.radius, sunTex, true);
  sunGroup.add(sunMesh);
  // Glow corona (sprite aditivo)
  const glow = sunGlow(SUN.radius);
  sunGroup.add(glow);
  // Luz
  const light = new THREE.PointLight(SUN.light, 3.2, 0, 0.0);
  sunGroup.add(light);
  scene.add(sunGroup);
  const sun = { def: SUN, group: sunGroup, mesh: sunMesh, worldPos: new THREE.Vector3(0, 0, 0), mu: SUN.mu, soi: SUN.soi, isMoon: false, isSun: true, parent: null, angle: 0 };
  game.sun = sun;
  game.bodies.push(sun);

  // --- Planetas ---
  for (const def of PLANETS) {
    const group = new THREE.Group();
    const tex = planetTexture(def);
    const mesh = makeSphere(def.radius, tex, false);
    mesh.rotation.z = def.tilt || 0;
    group.add(mesh);
    if (def.hasAtmo || def.atmosphere) group.add(atmosphere(def.radius, def.atmosphere || 0x6fb6ff));
    if (def.ring) group.add(ringMesh(def.ring));
    // Bolha do campo de influência (SOI) — visível só quando você se aproxima.
    const soiMesh = new THREE.Mesh(
      new THREE.SphereGeometry(def.soi, 24, 16),
      new THREE.MeshBasicMaterial({ color: 0x4aa6e0, wireframe: true, transparent: true, opacity: 0.08, depthWrite: false }),
    );
    soiMesh.visible = false;
    group.add(soiMesh);
    scene.add(group);
    const body = {
      def, group, mesh, soiMesh, worldPos: new THREE.Vector3(), mu: def.mu, soi: def.soi,
      isMoon: false, parent: sun, angle: Math.random() * Math.PI * 2, orbit: def.orbit,
      period: null, spin: def.spin, moons: [],
    };
    game.bodies.push(body);

    // --- Luas ---
    for (const m of (def.moons || [])) {
      const mg = new THREE.Group();
      const mtex = planetTexture({ ...m, kind: 'rock', color2: m.color });
      const mmesh = makeSphere(m.radius, mtex, false);
      mg.add(mmesh);
      scene.add(mg);
      const moon = {
        def: m, group: mg, mesh: mmesh, worldPos: new THREE.Vector3(), mu: m.mu, soi: m.soi,
        isMoon: true, parent: body, angle: Math.random() * Math.PI * 2, orbit: m.orbit,
        period: m.period, spin: m.spin, retrograde: !!m.retrograde,
      };
      body.moons.push(moon);
      game.bodies.push(moon);
    }
  }
  return game.bodies;
}

// Mostra a bolha de SOI só quando a nave se aproxima (evita poluição visual + custo).
export function updateSOIView(shipPos) {
  for (const b of game.bodies) {
    if (!b.soiMesh) continue;
    b.soiMesh.visible = shipPos.distanceTo(b.worldPos) < b.soi * 1.3;
  }
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
