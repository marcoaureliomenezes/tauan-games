// world.js — Constrói o MUNDO de uma pista no estilo PS1/N64 (Cruis'n World):
// low-poly + TEXTURA RICA. Estrada com asfalto texturizado (faixas pintadas na
// textura), trechos de terra com sulcos, aterros com saia, cercas/guard-rails
// texturizados, placas, árvores em BILLBOARD cruzado, fachadas com janelas,
// mesas estratificadas, céu com sol e nuvens, e HORIZONTE em camadas de
// PARALLAX. Tudo procedural (canvas + geometria) — nenhum asset externo.

import * as THREE from '../../vendor/three.module.min.js';
import { SURFACES } from './tracks.js';
import {
  asphaltTexture, dirtTexture, groundTexture, treeTexture, facadeTexture,
  mesaTexture, skyTexture, fenceTexture,
} from './textures.js';

export const ROAD_SAMPLES = 900;

function rng(seed) {
  let x = seed | 0 || 123456789;
  return () => { x ^= x << 13; x ^= x >>> 17; x ^= x << 5; return ((x >>> 0) % 100000) / 100000; };
}

// ── Amostragem da pista (verdade geométrica de física/IA/builder) ───────────
export function sampleTrack(def) {
  const pts3 = def.pts.map(([x, z]) => new THREE.Vector3(x, 0, z));
  const curve = new THREE.CatmullRomCurve3(pts3, true, 'catmullrom', 0.5);
  const N = ROAD_SAMPLES;
  const samples = [];
  const up = new THREE.Vector3(0, 1, 0);
  for (let i = 0; i < N; i++) {
    const s = i / N;
    const pos = curve.getPointAt(s);
    const tan = curve.getTangentAt(s);
    // elevação SEMPRE ≥ 0.3 sobre o terreno: morro = ATERRO com saia (a estrada
    // nunca afunda sob o gramado — bug corrigido 2026-07-18).
    let y = 0.3 + def.hills.amp * (
      (0.5 + 0.5 * Math.sin(s * Math.PI * 2 * def.hills.freq)) * 0.6
      + (0.5 + 0.5 * Math.sin(s * Math.PI * 2 * (def.hills.freq * 2.3) + 1.7)) * 0.4);
    let bump = 0;
    for (const b of def.bumps) {
      let d = Math.abs(s - b); d = Math.min(d, 1 - d);
      const g = Math.exp(-(d * d) / (2 * 0.0028 * 0.0028));
      bump = Math.max(bump, g);
    }
    y += bump * 1.7;
    pos.y = y;
    const side = new THREE.Vector3().crossVectors(up, tan).normalize();
    let surface = 'asphalt';
    for (const [a, b] of (def.dirt || [])) if (s >= a && s <= b) surface = 'dirt';
    samples.push({ pos, tan: tan.clone(), side, s, surface, bump });
  }
  return { curve, samples };
}

export function sampleAt(track, s) {
  const N = track.samples.length;
  const i = Math.floor(((s % 1) + 1) % 1 * N) % N;
  return track.samples[i];
}

// ── Fita genérica ao longo da pista com UV (u = través, v = comprimento) ────
function ribbon(track, iFrom, iTo, offL, offR, yOff, vScale, closed) {
  const S = track.samples, N = S.length;
  const pos = [], uv = [], idx = [];
  const count = closed ? N + 1 : (iTo - iFrom + 1);
  let vAcc = 0;
  let prev = null;
  for (let k = 0; k < count; k++) {
    const i = closed ? (k % N) : (iFrom + k);
    const sm = S[((i % N) + N) % N];
    if (prev) vAcc += sm.pos.distanceTo(prev) * vScale;
    prev = sm.pos;
    const oL = typeof offL === 'function' ? offL(sm) : offL;
    const oR = typeof offR === 'function' ? offR(sm) : offR;
    const yL = typeof yOff === 'function' ? yOff(sm, oL) : yOff;
    const yR = typeof yOff === 'function' ? yOff(sm, oR) : yOff;
    pos.push(sm.pos.x + sm.side.x * oL, sm.pos.y + yL, sm.pos.z + sm.side.z * oL);
    pos.push(sm.pos.x + sm.side.x * oR, sm.pos.y + yR, sm.pos.z + sm.side.z * oR);
    uv.push(0, vAcc, 1, vAcc);
  }
  for (let k = 0; k < count - 1; k++) {
    const a = k * 2, b = k * 2 + 1, c = k * 2 + 2, d = k * 2 + 3;
    // winding anti-horário visto DE CIMA (side = up×tan aponta p/ -X no rumo
    // -Z): (a,c,b) — sem isto a estrada inteira era backface-culled de cima
    // (bug raiz "carros correndo na grama", 2026-07-18).
    idx.push(a, c, b, b, c, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

// ── Estrada: asfalto texturizado + trechos de terra + saias de aterro ───────
function buildRoad(def, track, scene) {
  const W = def.width;
  // asfalto (fita fechada completa)
  const road = new THREE.Mesh(
    ribbon(track, 0, 0, -W / 2, W / 2, 0.05, 1 / (W * 1.6), true),
    new THREE.MeshLambertMaterial({ map: asphaltTexture(), side: THREE.DoubleSide }));
  scene.add(road);
  // terra por cima nos trechos de terra
  const S = track.samples, N = S.length;
  const dirtMat = new THREE.MeshLambertMaterial({ map: dirtTexture(), side: THREE.DoubleSide });
  for (const [a, b] of (def.dirt || [])) {
    const iFrom = Math.floor(a * N), iTo = Math.floor(b * N);
    const seg = new THREE.Mesh(
      ribbon(track, iFrom, iTo, -W / 2 - 0.4, W / 2 + 0.4, 0.09, 1 / (W * 1.6), false),
      dirtMat);
    scene.add(seg);
  }
  // SAIAS do aterro: da borda da estrada ao chão (grama/deserto escurecido)
  const skirtMat = new THREE.MeshLambertMaterial({
    color: new THREE.Color(def.palette.ground).multiplyScalar(0.82),
    side: THREE.DoubleSide,
  });
  for (const sideSign of [-1, 1]) {
    const skirt = new THREE.Mesh(
      ribbon(track, 0, 0,
        W / 2 * sideSign,
        (sm) => (W / 2 + 6 + sm.pos.y * 1.6) * sideSign,
        (sm, off) => (Math.abs(off) <= W / 2 + 0.01 ? 0.02 : -sm.pos.y - 0.45),
        1 / 30, true),
      skirtMat);
    scene.add(skirt);
  }
  // zebras nas curvas fortes
  const curbVerts = [], curbCols = [];
  const c1 = new THREE.Color(def.palette.curb1), c2 = new THREE.Color(def.palette.curb2);
  for (let i = 0; i < N; i += 2) {
    const sm = S[i], nx = S[(i + 2) % N];
    const curv = sm.tan.angleTo(S[(i + 6) % N].tan);
    if (curv > 0.09) {
      const cc = (i % 4 < 2) ? c1 : c2;
      for (const sd of [-1, 1]) {
        const o0 = (W / 2 - 0.2) * sd, o1 = (W / 2 + 0.7) * sd;
        const p = (s, o) => [s.pos.x + s.side.x * o, s.pos.y + 0.08, s.pos.z + s.side.z * o];
        const v0 = p(sm, o0), v1 = p(sm, o1), v2 = p(nx, o0), v3 = p(nx, o1);
        curbVerts.push(...v0, ...v1, ...v2, ...v1, ...v3, ...v2);
        for (let k = 0; k < 6; k++) curbCols.push(cc.r, cc.g, cc.b);
      }
    }
  }
  const cg = new THREE.BufferGeometry();
  cg.setAttribute('position', new THREE.Float32BufferAttribute(curbVerts, 3));
  cg.setAttribute('color', new THREE.Float32BufferAttribute(curbCols, 3));
  scene.add(new THREE.Mesh(cg, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide })));
}

// ── Cercas texturizadas (madeira) / guard-rails (metal) ─────────────────────
function buildFences(def, track, scene) {
  const W = def.width;
  const t = fenceTexture(!!def.scenery.rails);
  const mat = new THREE.MeshLambertMaterial({ map: t, transparent: true, alphaTest: 0.4, side: THREE.DoubleSide });
  for (const sideSign of [-1, 1]) {
    const off = (W / 2 + 2.4) * sideSign;
    const S = track.samples, N = S.length;
    const pos = [], uv = [], idx = [];
    let vAcc = 0, prev = null;
    for (let k = 0; k <= N; k++) {
      const sm = S[k % N];
      if (prev) vAcc += sm.pos.distanceTo(prev) / 10;
      prev = sm.pos;
      const x = sm.pos.x + sm.side.x * off, z = sm.pos.z + sm.side.z * off;
      pos.push(x, sm.pos.y, z);
      pos.push(x, sm.pos.y + 1.15, z);
      uv.push(0, vAcc, 1, vAcc);
    }
    for (let k = 0; k < N; k++) {
      const a = k * 2, b = k * 2 + 1, c = k * 2 + 2, d = k * 2 + 3;
      idx.push(a, c, b, b, c, d);
    }
    const fg = new THREE.BufferGeometry();
    fg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    fg.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    fg.setIndex(idx);
    // uv: u=0..1 vertical? textura é horizontal — troca: u ao longo, v vertical
    const uvArr = fg.attributes.uv.array;
    for (let k = 0; k <= N; k++) {
      uvArr[k * 4] = vAcc * (k / N); uvArr[k * 4 + 1] = 1;      // base
      uvArr[k * 4 + 2] = vAcc * (k / N); uvArr[k * 4 + 3] = 0;  // topo
    }
    fg.attributes.uv.needsUpdate = true;
    scene.add(new THREE.Mesh(fg, mat));
  }
}

// ── Placas (canvas) + pórtico ───────────────────────────────────────────────
function signTexture(text, bg, fg) {
  const cv = document.createElement('canvas'); cv.width = 256; cv.height = 128;
  const ctx = cv.getContext('2d');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, 256, 128);
  ctx.strokeStyle = fg; ctx.lineWidth = 8; ctx.strokeRect(6, 6, 244, 116);
  ctx.fillStyle = fg; ctx.font = 'bold 34px monospace';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(text, 128, 64, 230);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function buildSigns(def, track, scene) {
  const S = track.samples, N = S.length;
  const count = def.signs.length;
  for (let k = 0; k < count * 2; k++) {
    const sm = S[Math.floor((k / (count * 2)) * N + 30) % N];
    const text = def.signs[k % count];
    const bg = k % 3 === 0 ? '#155c2e' : k % 3 === 1 ? '#8a6a1a' : '#25355c';
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(6, 3),
      new THREE.MeshBasicMaterial({ map: signTexture(text, bg, '#f2f0e0'), side: THREE.DoubleSide }));
    const off = (def.width / 2 + 5) * (k % 2 ? 1 : -1);
    sign.position.set(sm.pos.x + sm.side.x * off, sm.pos.y + 3.4, sm.pos.z + sm.side.z * off);
    sign.lookAt(sm.pos.x, sm.pos.y + 3, sm.pos.z);
    scene.add(sign);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 3.4, 6),
      new THREE.MeshLambertMaterial({ color: 0x777777 }));
    pole.position.set(sign.position.x, sm.pos.y + 1.7, sign.position.z);
    scene.add(pole);
  }
  const sm0 = S[0];
  const gate = new THREE.Mesh(new THREE.PlaneGeometry(def.width + 6, 3),
    new THREE.MeshBasicMaterial({ map: signTexture('LARGADA — TAUAN GP', '#1a1a2e', '#ffd24a'), side: THREE.DoubleSide }));
  gate.position.set(sm0.pos.x, sm0.pos.y + 7, sm0.pos.z);
  // frente do plano voltada para quem CHEGA (senão o texto fica espelhado)
  gate.lookAt(sm0.pos.x - sm0.tan.x, sm0.pos.y + 7, sm0.pos.z - sm0.tan.z);
  scene.add(gate);
  for (const sd of [-1, 1]) {
    const col = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 8.5, 8),
      new THREE.MeshLambertMaterial({ color: 0xcccccc }));
    col.position.set(sm0.pos.x + sm0.side.x * (def.width / 2 + 2) * sd, sm0.pos.y + 4.25,
      sm0.pos.z + sm0.side.z * (def.width / 2 + 2) * sd);
    scene.add(col);
  }
}

// ── Espalhamento fora do corredor ───────────────────────────────────────────
function scatterPositions(track, count, minD, maxD, seed) {
  const rnd = rng(seed);
  const S = track.samples, N = S.length, out = [];
  let guard = 0;
  while (out.length < count && guard++ < count * 30) {
    const sm = S[(rnd() * N) | 0];
    const d = minD + rnd() * (maxD - minD);
    const sideSign = rnd() < 0.5 ? -1 : 1;
    const x = sm.pos.x + sm.side.x * d * sideSign + (rnd() - 0.5) * 12;
    const z = sm.pos.z + sm.side.z * d * sideSign + (rnd() - 0.5) * 12;
    let ok = true;
    for (let i = 0; i < N; i += 12) {
      const dx = S[i].pos.x - x, dz = S[i].pos.z - z;
      if (dx * dx + dz * dz < (minD - 4) * (minD - 4)) { ok = false; break; }
    }
    if (ok) out.push([x, -0.4, z, 0.7 + rnd() * 0.8, rnd() * Math.PI * 2]);
  }
  return out;
}

// billboard cruzado (2 planos em X) instanciado — o pinheiro do N64.
function crossBillboards(scene, texture, spots, w, h) {
  if (!spots.length) return;
  const p1 = new THREE.PlaneGeometry(w, h);
  const p2 = new THREE.PlaneGeometry(w, h);
  p2.rotateY(Math.PI / 2);
  // merge manual
  const g = new THREE.BufferGeometry();
  const pos = [], uv = [], idx = [];
  for (const src of [p1, p2]) {
    const base = pos.length / 3;
    pos.push(...src.attributes.position.array);
    uv.push(...src.attributes.uv.array);
    for (const i of src.index.array) idx.push(base + i);
  }
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  const mat = new THREE.MeshLambertMaterial({
    map: texture, transparent: true, alphaTest: 0.5, side: THREE.DoubleSide,
  });
  const inst = new THREE.InstancedMesh(g, mat, spots.length);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), sc = new THREE.Vector3();
  spots.forEach(([x, y, z, s, rot], i) => {
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rot);
    v.set(x, y + (h / 2) * s, z); sc.set(s, s, s);
    m.compose(v, q, sc); inst.setMatrixAt(i, m);
  });
  scene.add(inst);
}

function buildScenery(def, track, scene) {
  const sc = def.scenery;
  if (sc.trees) {
    crossBillboards(scene, treeTexture('pine', 7), scatterPositions(track, (sc.trees * 0.7) | 0, 16, 100, 11), 7, 11);
    crossBillboards(scene, treeTexture('leafy', 13), scatterPositions(track, (sc.trees * 0.3) | 0, 18, 110, 77), 8, 10);
  }
  if (sc.cacti) {
    crossBillboards(scene, treeTexture('saguaro', 21), scatterPositions(track, sc.cacti, 14, 120, 21), 5, 8);
    const rockMat = new THREE.MeshLambertMaterial({ color: 0x9a5838 });
    const rocks = scatterPositions(track, 120, 13, 130, 23);
    const inst = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(1.3, 0), rockMat, rocks.length);
    const m = new THREE.Matrix4();
    rocks.forEach((p, i) => { m.makeRotationY(p[4]); m.setPosition(p[0], p[1] + 0.7 * p[3], p[2]); inst.setMatrixAt(i, m); });
    scene.add(inst);
  }
  if (sc.buildings) {
    const rnd = rng(31);
    const spots = scatterPositions(track, sc.buildings, 24, 130, 31);
    for (const [x, y, z, , rot] of spots) {
      const w = 10 + rnd() * 16, h = 18 + rnd() * 50, d = 10 + rnd() * 16;
      const facade = facadeTexture(1000 + (rnd() * 1e6 | 0));
      facade.repeat.set(1, Math.max(1, Math.round(h / 24)));
      const roof = new THREE.MeshLambertMaterial({ color: 0x30343a });
      const wall = new THREE.MeshLambertMaterial({ map: facade });
      const bld = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), [wall, wall, roof, roof, wall, wall]);
      bld.position.set(x, y + h / 2, z); bld.rotation.y = rot;
      scene.add(bld);
    }
  }
  if (sc.mesas) {
    const rnd = rng(41);
    const spots = scatterPositions(track, sc.mesas, 100, 340, 41);
    const mt = new THREE.MeshLambertMaterial({ map: mesaTexture() });
    const topMat = new THREE.MeshLambertMaterial({ color: 0xb5713f });
    for (const [x, y, z] of spots) {
      const r = 26 + rnd() * 55, h = 24 + rnd() * 34;
      const mesa = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.72, r, h, 10), [mt, topMat, topMat]);
      mesa.position.set(x, y + h / 2, z);
      scene.add(mesa);
    }
  }
  if (sc.cabins) {
    const rnd = rng(51);
    const spots = scatterPositions(track, sc.cabins, 20, 60, 51);
    for (const [x, y, z, , rot] of spots) {
      const cab = new THREE.Group();
      const base = new THREE.Mesh(new THREE.BoxGeometry(6, 3, 5),
        new THREE.MeshLambertMaterial({ color: 0x7a5636 }));
      base.position.y = 1.5; cab.add(base);
      const roof = new THREE.Mesh(new THREE.ConeGeometry(4.6, 2.4, 4),
        new THREE.MeshLambertMaterial({ color: 0x53382a }));
      roof.position.y = 4.2; roof.rotation.y = Math.PI / 4; cab.add(roof);
      cab.position.set(x, y, z); cab.rotation.y = rot;
      scene.add(cab); void rnd;
    }
  }
  if (sc.lamps) {
    const spots = scatterPositions(track, sc.lamps, 11, 14, 61);
    const inst = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.1, 0.14, 6, 6),
      new THREE.MeshLambertMaterial({ color: 0x666e76 }), spots.length);
    const m = new THREE.Matrix4();
    // postes junto à pista ficam NA altura da estrada (aterro)
    spots.forEach((p, i) => {
      const q = nearestY(track, p[0], p[2]);
      m.setPosition(p[0], q + 3, p[2]); inst.setMatrixAt(i, m);
    });
    scene.add(inst);
  }
}

function nearestY(track, x, z) {
  const S = track.samples; let best = 0, bd = Infinity;
  for (let i = 0; i < S.length; i += 6) {
    const dx = S[i].pos.x - x, dz = S[i].pos.z - z;
    const d = dx * dx + dz * dz;
    if (d < bd) { bd = d; best = i; }
  }
  return S[best].pos.y;
}

// ── Horizonte com PARALLAX + céu texturizado ────────────────────────────────
function horizonLayer(def, layer, seed) {
  const rnd = rng(seed);
  const SEG = 96, R = layer.dist;
  const pos = [], idx = [];
  for (let i = 0; i <= SEG; i++) {
    const a = (i / SEG) * Math.PI * 2;
    const x = Math.cos(a) * R, z = Math.sin(a) * R;
    const peak = layer.h * (0.45 + layer.jag * (
      0.55 * Math.abs(Math.sin(a * 3.7 + seed)) + 0.45 * rnd()));
    pos.push(x, -40, z);
    pos.push(x, peak, z);
  }
  for (let i = 0; i < SEG; i++) {
    const a = i * 2, b = i * 2 + 1, c = i * 2 + 2, d = i * 2 + 3;
    idx.push(a, b, c, b, d, c);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  const mesh = new THREE.Mesh(g, new THREE.MeshBasicMaterial({
    color: layer.color, side: THREE.BackSide, fog: false, depthWrite: false,
  }));
  mesh.renderOrder = -5;
  mesh.userData.k = layer.k;
  return mesh;
}

// ── Entrada única ───────────────────────────────────────────────────────────
export function buildWorld(def, scene) {
  const track = sampleTrack(def);

  scene.fog = new THREE.Fog(def.palette.fog, 320, 2800);
  scene.add(new THREE.AmbientLight(0xffffff, 0.6));
  const sun = new THREE.DirectionalLight(0xfff2d8, 1.15);
  sun.position.set(400, 600, 200);
  scene.add(sun);

  // chão texturizado do bioma
  const gTex = def.scenery.cacti
    ? groundTexture(def.palette.ground, 0xc98a54, 0x9a5a30)
    : groundTexture(def.palette.ground, 0x5c8a44, 0x2c4c24);
  const ground = new THREE.Mesh(new THREE.CircleGeometry(4500, 48),
    new THREE.MeshLambertMaterial({ map: gTex }));
  ground.rotation.x = -Math.PI / 2; ground.position.y = -0.5;
  scene.add(ground);

  buildRoad(def, track, scene);
  buildFences(def, track, scene);
  buildSigns(def, track, scene);
  buildScenery(def, track, scene);

  const sky = new THREE.Mesh(new THREE.SphereGeometry(7000, 32, 16),
    new THREE.MeshBasicMaterial({
      map: skyTexture(def.palette.skyTop, def.palette.skyBot),
      side: THREE.BackSide, fog: false, depthWrite: false,
    }));
  sky.renderOrder = -6;
  scene.add(sky);
  const horizon = def.horizon.map((l, i) => { const m = horizonLayer(def, l, 7 + i * 13); scene.add(m); return m; });

  return {
    def, track, sky, horizon,
    update(cam) {
      sky.position.set(cam.position.x, 0, cam.position.z);
      for (const h of horizon) {
        const k = h.userData.k;
        h.position.set(cam.position.x * (1 - k), 0, cam.position.z * (1 - k));
      }
    },
    surfaceAt(x, z, sHint) {
      const S = track.samples, N = S.length;
      const base = sHint !== undefined ? Math.floor(sHint * N) : 0;
      let best = base, bd = Infinity;
      const range = sHint !== undefined ? 40 : N / 2;
      for (let w = -range; w <= range; w++) {
        const i = ((base + w) % N + N) % N;
        const dx = S[i].pos.x - x, dz = S[i].pos.z - z;
        const d = dx * dx + dz * dz;
        if (d < bd) { bd = d; best = i; }
      }
      // PROJEÇÃO CONTÍNUA no segmento vizinho (bug "carro saltitando",
      // 2026-07-18): o Y/centerline vinha do sample MAIS PRÓXIMO — degraus a
      // cada ~1,5 m excitavam a suspensão sem parar. Agora interpola.
      const sm = S[best];
      const nxt = S[(best + 1) % N], prv = S[(best - 1 + N) % N];
      // escolhe o segmento (best→next ou prev→best) que contém a projeção
      let a = sm, b = nxt, i0 = best;
      const abx = b.pos.x - a.pos.x, abz = b.pos.z - a.pos.z;
      let t = ((x - a.pos.x) * abx + (z - a.pos.z) * abz) / Math.max(abx * abx + abz * abz, 1e-9);
      if (t < 0) {
        a = prv; b = sm; i0 = (best - 1 + N) % N;
        const ax = b.pos.x - a.pos.x, az = b.pos.z - a.pos.z;
        t = ((x - a.pos.x) * ax + (z - a.pos.z) * az) / Math.max(ax * ax + az * az, 1e-9);
      }
      t = Math.max(0, Math.min(1, t));
      const cx = a.pos.x + (b.pos.x - a.pos.x) * t;
      const cz = a.pos.z + (b.pos.z - a.pos.z) * t;
      const roadY = a.pos.y + (b.pos.y - a.pos.y) * t;
      const dist = Math.hypot(x - cx, z - cz);
      const surface = dist > def.width / 2 + 1.2 ? 'offroad' : sm.surface;
      return {
        sm, dist, surface, phys: SURFACES[surface],
        s: (i0 + t) / N, roadY, cx, cz,
      };
    },
  };
}
