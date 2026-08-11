// world.js — Constrói o MUNDO de uma pista no estilo PS1/N64 (Cruis'n World):
// low-poly + TEXTURA RICA. Estrada com asfalto texturizado (faixas pintadas na
// textura), trechos de terra com sulcos, aterros com saia, cercas/guard-rails
// texturizados, placas, árvores em BILLBOARD cruzado, fachadas com janelas,
// mesas estratificadas, céu com sol e nuvens, e HORIZONTE em camadas de
// PARALLAX. Tudo procedural (canvas + geometria) — nenhum asset externo.

import * as THREE from '../../vendor/three.module.min.js';
import { SURFACES } from './tracks.js';
import {
  asphaltTexture, dirtTexture, groundTexture, groundDetailTexture, treeTexture,
  facadeTexture, mesaTexture, skyTexture, fenceTexture, mountainTexture,
  crowdTexture, checkerTexture, roadSignAtlas, signTileUV, sunGlowTexture,
  flareGhostTexture,
} from './textures.js';
import { buildSignsWS6 } from './signage.js';

export const ROAD_SAMPLES = 900;

function rng(seed) {
  let x = seed | 0 || 123456789;
  return () => { x ^= x << 13; x ^= x >>> 17; x ^= x << 5; return ((x >>> 0) % 100000) / 100000; };
}

// ── Amostragem da pista (verdade geométrica de física/IA/builder) ───────────
// Pistas de circuito: spline FECHADA, s circular. Sprint (WS-5, def.open):
// spline ABERTA com tension próprio, s ∈ [0,1] SEM wrap — M = N−1 é o divisor
// de s (amostra 0 = início, amostra N−1 = fim exato da centerline).
export function sampleTrack(def) {
  const pts3 = def.pts.map(([x, z]) => new THREE.Vector3(x, 0, z));
  const open = !!def.open;
  const curve = new THREE.CatmullRomCurve3(pts3, !open, 'catmullrom', def.tension ?? 0.5);
  const N = ROAD_SAMPLES;
  const M = open ? N - 1 : N;                    // divisor de s (índice = s·M)
  const samples = [];
  const up = new THREE.Vector3(0, 1, 0);
  const len = curve.getLength();
  // σ da lombada em unidades FÍSICAS (5 u; operador 2026-08-10): antes 0.0028
  // em s-normalizado — a largura real variava com a volta (7,1 u na cidade ×
  // 9,6 u no arizona) e nas pistas longas a crista era suave demais p/ decolar.
  // WS-5: sprint sobrescreve amp/σ (cristas gaussianas 6,5·exp(−(d/26)²)).
  const bumpAmp = def.bumpAmp ?? 1.7;
  const bumpSigma = (def.bumpSigma ?? 5) / len;
  for (let i = 0; i < N; i++) {
    const s = i / M;
    const pos = curve.getPointAt(s);
    const tan = curve.getTangentAt(s);
    // elevação SEMPRE ≥ 0.3 sobre o terreno: morro = ATERRO com saia (a estrada
    // nunca afunda sob o gramado — bug corrigido 2026-07-18).
    // Sprint: profile(s, L) próprio (2 → 110 → 4 — ver tracks.js).
    let y = def.profile ? def.profile(s, len) : 0.3 + def.hills.amp * (
      (0.5 + 0.5 * Math.sin(s * Math.PI * 2 * def.hills.freq)) * 0.6
      + (0.5 + 0.5 * Math.sin(s * Math.PI * 2 * (def.hills.freq * 2.3) + 1.7)) * 0.4);
    let bump = 0;
    for (const b of def.bumps) {
      let d = Math.abs(s - b); if (!open) d = Math.min(d, 1 - d);
      const g = Math.exp(-(d * d) / (2 * bumpSigma * bumpSigma));
      bump = Math.max(bump, g);
    }
    y += bump * bumpAmp;
    pos.y = y;
    const side = new THREE.Vector3().crossVectors(up, tan).normalize();
    let surface = 'asphalt';
    for (const [a, b] of (def.dirt || [])) if (s >= a && s <= b) surface = 'dirt';
    for (const [a, b] of (def.fords || [])) if (s >= a && s <= b) surface = 'water';
    // largura LOCAL (WS-5): trechos tipados do sprint (dupla/single/terra)
    let width = def.width;
    for (const seg of (def.segments || [])) if (s >= seg.a && s <= seg.b) width = seg.width;
    if (surface === 'dirt' && def.dirtWidth) width = def.dirtWidth;
    let fenceless = false;
    for (const [a, b] of (def.fenceless || [])) if (s >= a && s <= b) fenceless = true;
    samples.push({ pos, tan: tan.clone(), side, s, surface, bump, width, fenceless });
  }
  return { curve, samples, open, M, len };
}

export function sampleAt(track, s) {
  const N = track.samples.length;
  if (track.open) return track.samples[Math.max(0, Math.min(N - 1, Math.round(s * track.M)))];
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
  const closed = !track.open;
  const N = track.samples.length;
  // largura LOCAL por amostra (WS-5): circuitos têm width constante = def.width
  const wL = (sm) => -sm.width / 2, wR = (sm) => sm.width / 2;
  // asfalto (fita fechada completa; sprint: fita aberta A→B)
  const road = new THREE.Mesh(
    closed
      ? ribbon(track, 0, 0, wL, wR, 0.05, 1 / (W * 1.6), true)
      : ribbon(track, 0, N - 1, wL, wR, 0.05, 1 / (W * 1.6), false),
    new THREE.MeshLambertMaterial({ map: asphaltTexture(), side: THREE.DoubleSide }));
  scene.add(road);
  // terra por cima nos trechos de terra
  const S = track.samples;
  const dirtMat = new THREE.MeshLambertMaterial({ map: dirtTexture(), side: THREE.DoubleSide });
  for (const [a, b] of (def.dirt || [])) {
    const iFrom = Math.floor(a * track.M), iTo = Math.floor(b * track.M);
    const seg = new THREE.Mesh(
      ribbon(track, iFrom, iTo, (sm) => -sm.width / 2 - 0.4, (sm) => sm.width / 2 + 0.4, 0.09, 1 / (W * 1.6), false),
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
      closed
        ? ribbon(track, 0, 0,
          (sm) => sm.width / 2 * sideSign,
          (sm) => (sm.width / 2 + 6 + sm.pos.y * 1.6) * sideSign,
          (sm, off) => (Math.abs(off) <= sm.width / 2 + 0.01 ? 0.02 : -sm.pos.y - 0.45),
          1 / 30, true)
        : ribbon(track, 0, N - 1,
          (sm) => sm.width / 2 * sideSign,
          (sm) => (sm.width / 2 + 6 + sm.pos.y * 1.6) * sideSign,
          (sm, off) => (Math.abs(off) <= sm.width / 2 + 0.01 ? 0.02 : -sm.pos.y - 0.45),
          1 / 30, false),
      skirtMat);
    scene.add(skirt);
  }
  // zebras nas curvas fortes
  const curbVerts = [], curbCols = [];
  const c1 = new THREE.Color(def.palette.curb1), c2 = new THREE.Color(def.palette.curb2);
  for (let i = 0; i < N; i += 2) {
    const sm = S[i], nx = S[closed ? (i + 2) % N : Math.min(i + 2, N - 1)];
    const curv = sm.tan.angleTo(S[closed ? (i + 6) % N : Math.min(i + 6, N - 1)].tan);
    if (curv > 0.09) {
      const cc = (i % 4 < 2) ? c1 : c2;
      for (const sd of [-1, 1]) {
        const o0 = (sm.width / 2 - 0.2) * sd, o1 = (sm.width / 2 + 0.7) * sd;
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
  const t = fenceTexture(!!def.scenery.rails);
  // alphaTest 0.2 (era 0.4 — bug M2): mipmapping ERODIA réguas/mourões finos a
  // distância e a cerca SUMIA visualmente com o colisor intacto.
  const mat = new THREE.MeshLambertMaterial({ map: t, transparent: true, alphaTest: 0.2, side: THREE.DoubleSide });
  const S = track.samples, N = S.length;
  if (track.open) {
    // SPRINT (WS-5): cerca ABERTA com lacunas nos trechos `fenceless` (terra
    // sem muro). Quads independentes por segmento — simples e sem costura.
    for (const sideSign of [-1, 1]) {
      const pos = [], uv = [], idx = [];
      let vAcc = 0;
      for (let k = 0; k < N - 1; k++) {
        const a = S[k], b = S[k + 1];
        vAcc += k ? a.pos.distanceTo(S[k - 1].pos) / 10 : 0;
        if (a.fenceless || b.fenceless) continue;
        const oa = (a.width / 2 + 2.4) * sideSign, ob = (b.width / 2 + 2.4) * sideSign;
        const base = pos.length / 3;
        pos.push(a.pos.x + a.side.x * oa, a.pos.y, a.pos.z + a.side.z * oa);
        pos.push(a.pos.x + a.side.x * oa, a.pos.y + 1.15, a.pos.z + a.side.z * oa);
        pos.push(b.pos.x + b.side.x * ob, b.pos.y, b.pos.z + b.side.z * ob);
        pos.push(b.pos.x + b.side.x * ob, b.pos.y + 1.15, b.pos.z + b.side.z * ob);
        uv.push(vAcc, 1, vAcc, 0, vAcc + a.pos.distanceTo(b.pos) / 10, 1, vAcc + a.pos.distanceTo(b.pos) / 10, 0);
        idx.push(base, base + 2, base + 1, base + 1, base + 2, base + 3);
      }
      const fg = new THREE.BufferGeometry();
      fg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      fg.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      fg.setIndex(idx);
      fg.computeVertexNormals();
      scene.add(new THREE.Mesh(fg, mat));
    }
    return;
  }
  const W = def.width;
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
  // WS-6: a cada 4ª placa usa o tile AD do atlas de sinalização (variedade de
  // letreiro de beira de pista — "TAUAN ENERGY" listrado)
  const adTile = signTileUV(7);
  let adAtlas = null;
  for (let k = 0; k < count * 2; k++) {
    const sm = S[Math.floor((k / (count * 2)) * N + 30) % N];
    const text = def.signs[k % count];
    const bg = k % 3 === 0 ? '#155c2e' : k % 3 === 1 ? '#8a6a1a' : '#25355c';
    const isAd = k % 4 === 3;
    const geo = new THREE.PlaneGeometry(6, 3);
    if (isAd) {
      adAtlas = adAtlas || roadSignAtlas();
      const uvs = geo.attributes.uv;
      // PlaneGeometry: (0,1) (1,1) (0,0) (1,0)
      uvs.setXY(0, adTile.u0, adTile.v1); uvs.setXY(1, adTile.u1, adTile.v1);
      uvs.setXY(2, adTile.u0, adTile.v0); uvs.setXY(3, adTile.u1, adTile.v0);
    }
    const sign = new THREE.Mesh(geo,
      new THREE.MeshBasicMaterial({ map: isAd ? adAtlas : signTexture(text, bg, '#f2f0e0'), side: THREE.DoubleSide }));
    // largura LOCAL (full-scan: no sprint a pista dupla tem 18,4 m — placas a
    // def.width/2+5 da centerline ficavam a 0,4 m da borda da estrada)
    const off = (sm.width / 2 + 5) * (k % 2 ? 1 : -1);
    sign.position.set(sm.pos.x + sm.side.x * off, sm.pos.y + 3.4, sm.pos.z + sm.side.z * off);
    sign.lookAt(sm.pos.x, sm.pos.y + 3, sm.pos.z);
    scene.add(sign);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 3.4, 6),
      new THREE.MeshLambertMaterial({ color: 0x777777 }));
    pole.position.set(sign.position.x, sm.pos.y + 1.7, sign.position.z);
    scene.add(pole);
  }
  // PÓRTICO DE LARGADA (race-day dressing): treliça com viga xadrez + faixa.
  // largura LOCAL (full-scan: no sprint s=0 é pista DUPLA 18,4 m — o pórtico
  // dimensionado p/ def.width=9,4 fincava os postes 2,9 m DENTRO da pista).
  const sm0 = S[0];
  const gw = sm0.width;                                // largura do pórtico
  const checker = checkerTexture();
  const beamMat = new THREE.MeshLambertMaterial({ map: checker });
  const postMat = new THREE.MeshLambertMaterial({ color: 0x2a2e36 });
  const beam = new THREE.Mesh(new THREE.BoxGeometry(gw + 6, 1.5, 0.9), beamMat);
  beam.position.set(sm0.pos.x, sm0.pos.y + 8.1, sm0.pos.z);
  beam.rotation.y = Math.atan2(sm0.side.x, sm0.side.z) + Math.PI / 2; // viga ⊥ pista
  scene.add(beam);
  const banner = new THREE.Mesh(new THREE.PlaneGeometry(gw + 6, 2.2),
    new THREE.MeshBasicMaterial({ map: signTexture('LARGADA — TAUAN GP', '#1a1a2e', '#ffd24a'), side: THREE.DoubleSide }));
  banner.position.set(sm0.pos.x, sm0.pos.y + 6.2, sm0.pos.z);
  // frente do plano voltada para quem CHEGA (senão o texto fica espelhado)
  banner.lookAt(sm0.pos.x - sm0.tan.x, sm0.pos.y + 6.2, sm0.pos.z - sm0.tan.z);
  scene.add(banner);
  for (const sd of [-1, 1]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.7, 8.9, 0.7), postMat);
    post.position.set(sm0.pos.x + sm0.side.x * (gw / 2 + 2) * sd, sm0.pos.y + 4.45,
      sm0.pos.z + sm0.side.z * (gw / 2 + 2) * sd);
    scene.add(post);
  }
  // SPRINT (WS-5): pórtico de CHEGADA 30 m antes do fim da centerline (mesma
  // regra do finish_s de main.js) — "CHEGADA — VILA SERRANA".
  if (def.sprint) {
    let acc = 0, iF = S.length - 1;
    for (let k = S.length - 1; k > 0; k--) {
      acc += S[k].pos.distanceTo(S[k - 1].pos);
      if (acc >= 30) { iF = k; break; }
    }
    const smF = S[iF];
    const gwF = smF.width;                             // largura LOCAL (ver pórtico de largada)
    const beamF = new THREE.Mesh(new THREE.BoxGeometry(gwF + 6, 1.5, 0.9), beamMat);
    beamF.position.set(smF.pos.x, smF.pos.y + 8.1, smF.pos.z);
    beamF.rotation.y = Math.atan2(smF.side.x, smF.side.z) + Math.PI / 2;
    scene.add(beamF);
    const bannerF = new THREE.Mesh(new THREE.PlaneGeometry(gwF + 6, 2.2),
      new THREE.MeshBasicMaterial({ map: signTexture('CHEGADA — VILA SERRANA', '#1a2e1a', '#ffd24a'), side: THREE.DoubleSide }));
    bannerF.position.set(smF.pos.x, smF.pos.y + 6.2, smF.pos.z);
    bannerF.lookAt(smF.pos.x - smF.tan.x, smF.pos.y + 6.2, smF.pos.z - smF.tan.z);
    scene.add(bannerF);
    for (const sd of [-1, 1]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.7, 8.9, 0.7), postMat);
      post.position.set(smF.pos.x + smF.side.x * (gwF / 2 + 2) * sd, smF.pos.y + 4.45,
        smF.pos.z + smF.side.z * (gwF / 2 + 2) * sd);
      scene.add(post);
    }
  }
}

// ── TORCIDA no grid (billboards instanciados atrás das cercas, perto da linha)
function buildCrowd(def, track, scene) {
  const S = track.samples, N = S.length;
  const geo = new THREE.PlaneGeometry(7.5, 2.6);
  const mat = new THREE.MeshLambertMaterial({ map: crowdTexture(), side: THREE.DoubleSide });
  const COUNT = 14;
  const inst = new THREE.InstancedMesh(geo, mat, COUNT);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), sc = new THREE.Vector3(1, 1, 1);
  const zAxis = new THREE.Vector3(0, 0, 1), normal = new THREE.Vector3();
  for (let k = 0; k < COUNT; k++) {
    const sd = k % 2 ? 1 : -1;
    // circuito: ao longo do grid (fim da volta); sprint: junto à largada
    const i = track.open
      ? Math.min(N - 1, 8 + ((k / 2) | 0) * 10)
      : ((N - 90 + ((k / 2) | 0) * 16) % N + N) % N;
    const sm = S[i];
    // largura LOCAL (full-scan: junto à largada do sprint a pista dupla tem
    // 18,4 m — a torcida a def.width/2+4,2 ficava 0,3 m DENTRO da estrada)
    const off = (sm.width / 2 + 4.2) * sd;
    v.set(sm.pos.x + sm.side.x * off, sm.pos.y + 1.6, sm.pos.z + sm.side.z * off);
    normal.set(-sm.side.x * sd, 0, -sm.side.z * sd);          // de frente p/ a pista
    q.setFromUnitVectors(zAxis, normal);
    m.compose(v, q, sc);
    inst.setMatrixAt(k, m);
  }
  scene.add(inst);
}

// ── VADOS (WS-5): lâmina d'água translúcida ~90 m de largura cruzando a
// pista (port dos fords do route_builder.gd). O slowdown vem da superfície
// 'water' (grip de terra + arrasto — tracks.js SURFACES).
function buildFords(def, track, scene) {
  if (!def.fords || !def.fords.length) return;
  const mat = new THREE.MeshBasicMaterial({
    color: 0x3f7fc8, transparent: true, opacity: 0.55, side: THREE.DoubleSide,
  });
  for (const [a, b] of def.fords) {
    const iFrom = Math.max(0, Math.floor(a * track.M) - 2);
    const iTo = Math.min(track.samples.length - 1, Math.floor(b * track.M) + 2);
    const water = new THREE.Mesh(ribbon(track, iFrom, iTo, -45, 45, 0.07, 1 / 30, false), mat);
    scene.add(water);
  }
}

// ── CIDADES ENDPOINT (WS-5): ~26 caixas PASTEL por ponta (Tauan City na
// largada, Vila Serrana na chegada), 6–14 m de largura × 5–18 m de altura,
// 16–90 m lateral, até 140 m ao longo da estrada. Mesma pipeline instanciada
// dos prédios do WS-3: geometria compartilhada + pool de fachadas + tint por
// instância. A cidade de destino fica VISÍVEL na aproximação da chegada.
function buildEndpointCities(def, track, scene) {
  if (!def.cities) return;
  const S = track.samples, N = S.length, L = track.len;
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  boxGeo.translate(0, 0.5, 0);
  const pool = [];
  for (let i = 0; i < 4; i++) pool.push(facadeTexture(4000 + i * 131, 6 + i * 2));
  const PASTELS = [
    [1.00, 0.82, 0.78], [0.82, 0.95, 1.00], [0.98, 0.96, 0.78], [0.86, 1.00, 0.84],
    [0.96, 0.86, 1.00], [1.00, 0.90, 0.72],
  ];
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), sc = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0), tint = new THREE.Color();
  for (const [seed, sFrom, sTo] of [[7071, 0.004, 140 / L], [7072, 1 - 140 / L, 0.999]]) {
    const rnd = rng(seed);
    const buckets = pool.map(() => []);
    const COUNT = 26;
    for (let k = 0; k < COUNT; k++) {
      const sm = sampleAt(track, sFrom + rnd() * (sTo - sFrom));
      const sd = rnd() < 0.5 ? -1 : 1;
      const lat = (16 + rnd() * 74) * sd;
      const x = sm.pos.x + sm.side.x * lat + (rnd() - 0.5) * 10;
      const z = sm.pos.z + sm.side.z * lat + (rnd() - 0.5) * 10;
      const w = 6 + rnd() * 8, h = 5 + rnd() * 13, d = 6 + rnd() * 8;
      buckets[(rnd() * pool.length) | 0].push([x, z, w, h, d, rnd() * Math.PI * 2, PASTELS[(rnd() * PASTELS.length) | 0]]);
    }
    buckets.forEach((list, fi) => {
      if (!list.length) return;
      const inst = new THREE.InstancedMesh(boxGeo,
        new THREE.MeshLambertMaterial({ map: pool[fi] }), list.length);
      list.forEach(([x, z, w, h, d, rot, pastel], i) => {
        q.setFromAxisAngle(up, rot);
        v.set(x, -0.4, z); sc.set(w, h, d);
        m.compose(v, q, sc);
        inst.setMatrixAt(i, m);
        tint.setRGB(pastel[0], pastel[1], pastel[2]);
        inst.setColorAt(i, tint);
      });
      if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
      scene.add(inst);
    });
  }
}

// ── Espalhamento fora do corredor ───────────────────────────────────────────
// clear: folga MÍNIMA além da borda da estrada (largura LOCAL — full-scan
// 2026-08-11: os postes de luz da cidade caíam SOBRE a pista: o piso fixo
// minD−4=7 u era menor que a meia-pista de 8 u; cenário não tem colisor —
// prop sobre a pista é "pedra invisível" visual).
function scatterPositions(track, count, minD, maxD, seed, clear = 0.5) {
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
    // TODA amostra (passo 12/3 deixava brecha: entre pontos guardados a
    // centerline se aproxima Δlateral = √(d²−δ²) e o prop caía na pista)
    for (let i = 0; i < N; i++) {
      const dx = S[i].pos.x - x, dz = S[i].pos.z - z;
      const need = Math.max(minD - 4, S[i].width / 2 + clear);
      if (dx * dx + dz * dz < need * need) { ok = false; break; }
    }
    if (ok) out.push([x, -0.4, z, 0.7 + rnd() * 0.8, rnd() * Math.PI * 2]);
  }
  return out;
}

// árvore-billboard instanciada: `planes` planos cruzados (2 = X do N64 p/ longe,
// 3 = estrela p/ perto da pista, onde o paralaxe entre planos denuncia o 2D).
function crossBillboards(scene, texture, spots, w, h, planes = 2) {
  if (!spots.length) return;
  // merge manual dos planos
  const pos = [], uv = [], idx = [];
  for (let p = 0; p < planes; p++) {
    const src = new THREE.PlaneGeometry(w, h);
    src.rotateY((Math.PI / planes) * p);
    const base = pos.length / 3;
    pos.push(...src.attributes.position.array);
    uv.push(...src.attributes.uv.array);
    for (const i of src.index.array) idx.push(base + i);
    src.dispose();
  }
  const g = new THREE.BufferGeometry();
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
    // LOD de 2 níveis: PERTO (14–48 u) árvores de 3 planos; LONGE (40–130 u)
    // o X clássico de 2 planos. Contagem total mantida; tudo InstancedMesh.
    const pines = (sc.trees * 0.7) | 0, leafys = (sc.trees * 0.3) | 0;
    crossBillboards(scene, treeTexture('pine', 7), scatterPositions(track, (pines * 0.5) | 0, 14, 48, 11), 7, 11, 3);
    crossBillboards(scene, treeTexture('pine', 7), scatterPositions(track, pines - ((pines * 0.5) | 0), 40, 130, 111), 7, 11, 2);
    crossBillboards(scene, treeTexture('leafy', 13), scatterPositions(track, (leafys * 0.5) | 0, 16, 50, 77), 8, 10, 3);
    crossBillboards(scene, treeTexture('leafy', 13), scatterPositions(track, leafys - ((leafys * 0.5) | 0), 44, 130, 177), 8, 10, 2);
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
    // PRÉDIOS INSTANCIADOS (WS-3): antes eram 90 meshes × 90 geometrias × 90
    // texturas 128×256 ÚNICAS (~90 uploads de GPU + ~90 draw calls). Agora:
    // 1 BoxGeometry compartilhada + pool de 7 fachadas canvas + 1 InstancedMesh
    // por fachada (≤7 draw calls) + 1 InstancedMesh de coberturas. A VARIEDADE
    // vem de escala/rotação por instância e de instanceColor (matiz de
    // entardecer), não de textura única.
    const rnd = rng(31);
    const spots = scatterPositions(track, sc.buildings, 24, 130, 31);
    // pool: 3 fachadas baixas (10–14 andares) + 4 de torre (16–22 andares) —
    // prédio alto usa fachada com MAIS linhas p/ a janela não esticar.
    const pool = [];
    for (let i = 0; i < 7; i++) pool.push(facadeTexture(1000 + i * 77, i < 3 ? 10 + i * 2 : 16 + (i - 3) * 2));
    const boxGeo = new THREE.BoxGeometry(1, 1, 1);
    boxGeo.translate(0, 0.5, 0);                       // base na origem
    const buckets = pool.map(() => []);
    const roofSpots = [];
    for (const [x, y, z, , rot] of spots) {
      const w = 10 + rnd() * 16, h = 18 + rnd() * 50, d = 10 + rnd() * 16;
      const fi = h < 42 ? (rnd() * 3 | 0) : 3 + (rnd() * 4 | 0);
      buckets[fi].push([x, y, z, w, h, d, rot]);
      roofSpots.push([x, y, z, w, h, d, rot]);
    }
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), s = new THREE.Vector3();
    const up = new THREE.Vector3(0, 1, 0), tint = new THREE.Color();
    buckets.forEach((list, fi) => {
      if (!list.length) return;
      const inst = new THREE.InstancedMesh(boxGeo,
        new THREE.MeshLambertMaterial({ map: pool[fi] }), list.length);
      list.forEach(([x, y, z, w, h, d, rot], i) => {
        q.setFromAxisAngle(up, rot);
        v.set(x, y, z); s.set(w, h, d);
        m.compose(v, q, s);
        inst.setMatrixAt(i, m);
        // matiz por instância: quente (entardecer) ou frio, 0.72–1.05
        const warm = rnd() < 0.5;
        const lum = 0.72 + rnd() * 0.33;
        tint.setRGB(lum * (warm ? 1.06 : 0.92), lum, lum * (warm ? 0.88 : 1.08));
        inst.setColorAt(i, tint);
      });
      if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
      scene.add(inst);
    });
    const roofInst = new THREE.InstancedMesh(boxGeo,
      new THREE.MeshLambertMaterial({ color: 0x30343a }), roofSpots.length);
    roofSpots.forEach(([x, y, z, w, h, d, rot], i) => {
      q.setFromAxisAngle(up, rot);
      v.set(x, y + h - 0.05, z); s.set(w * 1.02, 0.5, d * 1.02);
      m.compose(v, q, s);
      roofInst.setMatrixAt(i, m);
    });
    scene.add(roofInst);
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
    // postes colados na pista: folga de 1 m além da borda (nunca SOBRE ela)
    const spots = scatterPositions(track, sc.lamps, 11, 14, 61, 1.0);
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
// Anéis TEXTURIZADOS (WS-3): gradiente vertical + banda de rocha/neve/estratos
// assada em canvas (mountainTexture). v = altura normalizada do vértice → a
// neve só aparece nos picos mais altos do serrilhado. u repete 6× na volta.
function horizonLayer(def, layer, seed) {
  const rnd = rng(seed);
  const SEG = 96, R = layer.dist;
  const pos = [], idx = [], uv = [];
  const col = new THREE.Color(layer.color);
  // modo da textura pelo bioma da camada: quente → estratos de arenito;
  // verde → crista de mata; frio → neve
  const mode = (col.r > col.g && col.r > col.b) ? 'strata' : (col.g > col.r ? 'ridge' : 'snow');
  for (let i = 0; i <= SEG; i++) {
    const a = (i / SEG) * Math.PI * 2;
    const x = Math.cos(a) * R, z = Math.sin(a) * R;
    const peak = layer.h * (0.45 + layer.jag * (
      0.55 * Math.abs(Math.sin(a * 3.7 + seed)) + 0.45 * rnd()));
    pos.push(x, -40, z);
    pos.push(x, peak, z);
    uv.push((i / SEG) * 6, 0, (i / SEG) * 6, (peak + 40) / (layer.h + 40));
  }
  for (let i = 0; i < SEG; i++) {
    const a = i * 2, b = i * 2 + 1, c = i * 2 + 2, d = i * 2 + 3;
    idx.push(a, b, c, b, d, c);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  const mesh = new THREE.Mesh(g, new THREE.MeshBasicMaterial({
    map: mountainTexture(layer.color, seed * 31 + 7, mode),
    side: THREE.BackSide, fog: false, depthWrite: false,
  }));
  mesh.renderOrder = -5;
  mesh.userData.k = layer.k;
  return mesh;
}

// ── NUVENS (WS-3): anel de impostores — esferas achatadas sem shading, a
// mesma técnica que funcionou na versão Godot (40 a y 170–260). UM único
// InstancedMesh (1 draw call), parallax k≈0.3 + deriva lenta de rotação.
function buildClouds(scene, seed = 97) {
  const rnd = rng(seed);
  const N = 38;
  const geo = new THREE.SphereGeometry(1, 7, 5);
  const mat = new THREE.MeshBasicMaterial({
    color: 0xf8fbff, transparent: true, opacity: 0.88, fog: false, depthWrite: false,
  });
  const inst = new THREE.InstancedMesh(geo, mat, N);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), s = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);
  for (let i = 0; i < N; i++) {
    const a = rnd() * Math.PI * 2, r = 1400 + rnd() * 1000;
    q.setFromAxisAngle(up, rnd() * Math.PI * 2);
    v.set(Math.cos(a) * r, 170 + rnd() * 90, Math.sin(a) * r);
    s.set(38 + rnd() * 58, 9 + rnd() * 8, 22 + rnd() * 26);
    m.compose(v, q, s);
    inst.setMatrixAt(i, m);
  }
  const group = new THREE.Group();
  group.add(inst);
  group.userData.k = 0.3;
  group.renderOrder = -1;
  scene.add(group);
  return group;
}

// ── SOL VISÍVEL + LENS FLARE-lite (WS-6) ────────────────────────────────────
// Sprite de glow aditivo na MESMA direção do sol assado na textura do céu
// (skyTexture pinta o sol no canvas 1024×512 em (780,130) → na esfera do céu
// isso é a direção abaixo). 3 fantasmas (bokeh) ao longo do eixo sol→centro
// da tela, desvanecendo quando a câmera olha p/ longe do sol. Sem shading,
// fog:false, depthWrite:false — 4 draw calls baratos.
const SUN_DIR = new THREE.Vector3(-0.0545, 0.699, -0.713).normalize();
function buildSun(root) {
  const group = new THREE.Group();
  group.name = 'sunFlare';
  const sun = new THREE.Sprite(new THREE.SpriteMaterial({
    map: sunGlowTexture(), blending: THREE.AdditiveBlending,
    depthWrite: false, fog: false, transparent: true, opacity: 0.95,
  }));
  sun.scale.set(1500, 1500, 1);
  sun.renderOrder = -4.5;
  group.add(sun);
  const ghostTex = flareGhostTexture();
  const ghosts = [
    { f: 0.35, size: 280, op: 0.20, color: 0xfff0c0 },
    { f: 0.70, size: 140, op: 0.16, color: 0xc0e0ff },
    { f: 1.10, size: 400, op: 0.10, color: 0xffd0a0 },
  ].map((g) => {
    const spr = new THREE.Sprite(new THREE.SpriteMaterial({
      map: ghostTex, color: g.color, blending: THREE.AdditiveBlending,
      depthWrite: false, fog: false, transparent: true, opacity: 0,
    }));
    spr.scale.set(g.size, g.size, 1);
    spr.renderOrder = -4.5;
    group.add(spr);
    return { spr, ...g };
  });
  root.add(group);
  return { sun, ghosts };
}

// ── Entrada única ───────────────────────────────────────────────────────────
export function buildWorld(def, scene) {
  const track = sampleTrack(def);

  // TUDO do mundo vive sob UM grupo — o restart (main.js) dispõe só esta
  // subárvore (geometrias/materiais/texturas), sem tocar nos carros (GLB
  // compartilhado entre corridas).
  const root = new THREE.Group();
  root.name = 'worldRoot';
  scene.add(root);

  scene.fog = new THREE.Fog(def.palette.fog, 320, 2800);
  root.add(new THREE.AmbientLight(0xffffff, 0.6));
  const sun = new THREE.DirectionalLight(0xfff2d8, 1.15);
  sun.position.set(400, 600, 200);
  root.add(sun);

  // chão texturizado do bioma (512px multi-escala) + OVERLAY de detalhe fino
  // (2ª camada repetida 360× — nítida debaixo do carro)
  const gTex = def.scenery.cacti
    ? groundTexture(def.palette.ground, 0xc98a54, 0x9a5a30)
    : groundTexture(def.palette.ground, 0x5c8a44, 0x2c4c24);
  const ground = new THREE.Mesh(new THREE.CircleGeometry(4500, 48),
    new THREE.MeshLambertMaterial({ map: gTex }));
  ground.rotation.x = -Math.PI / 2; ground.position.y = -0.5;
  root.add(ground);
  const detail = new THREE.Mesh(new THREE.CircleGeometry(4500, 48),
    new THREE.MeshLambertMaterial({
      map: groundDetailTexture(), transparent: true, depthWrite: false,
      polygonOffset: true, polygonOffsetFactor: -1,
    }));
  detail.rotation.x = -Math.PI / 2; detail.position.y = -0.44;
  root.add(detail);

  buildRoad(def, track, root);
  buildFences(def, track, root);
  buildSigns(def, track, root);
  const signage = buildSignsWS6(def, track, root);   // WS-6: placas por dados
  buildCrowd(def, track, root);
  buildScenery(def, track, root);
  buildFords(def, track, root);              // WS-5: vados do sprint
  buildEndpointCities(def, track, root);     // WS-5: Tauan City / Vila Serrana

  const sky = new THREE.Mesh(new THREE.SphereGeometry(7000, 32, 16),
    new THREE.MeshBasicMaterial({
      map: skyTexture(def.palette.skyTop, def.palette.skyBot),
      side: THREE.BackSide, fog: false, depthWrite: false,
    }));
  sky.renderOrder = -6;
  root.add(sky);
  // camadas do def + ANEL MÉDIO derivado (WS-3, k≈0.3): mesma família da
  // camada mais próxima, mais baixo e mais escuro — profundidade de parallax
  const layers = [...def.horizon];
  const near0 = def.horizon[def.horizon.length - 1];
  layers.push({
    color: new THREE.Color(near0.color).multiplyScalar(0.78).getHex(),
    dist: near0.dist * 0.55, h: near0.h * 0.75,
    jag: Math.min(0.7, near0.jag + 0.15), k: 0.3,
  });
  const horizon = layers.map((l, i) => {
    const m = horizonLayer(def, l, 7 + i * 13);
    m.renderOrder = -5 + i * 0.1;                  // longe desenha primeiro
    root.add(m);
    return m;
  });
  const clouds = buildClouds(root);
  const sunFlare = buildSun(root);
  const _sunFwd = new THREE.Vector3(), _sunG = new THREE.Vector3();

  // comprimento total da centerline (validação M1 do surfaceAt / física)
  let trackLen = 0;
  const lastI = track.open ? track.samples.length - 1 : track.samples.length;
  for (let i = 0; i < lastI; i++) {
    trackLen += track.samples[i].pos.distanceTo(track.samples[(i + 1) % track.samples.length].pos);
  }

  return {
    def, track, sky, horizon, clouds, root, trackLen, signage, sunFlare,
    // WS-5 sprint: chegada 30 m antes do fim da centerline (sem voltas)
    finishS: def.sprint ? (trackLen - 30) / trackLen : null,
    update(cam) {
      sky.position.set(cam.position.x, 0, cam.position.z);
      for (const h of horizon) {
        const k = h.userData.k;
        h.position.set(cam.position.x * (1 - k), 0, cam.position.z * (1 - k));
      }
      // nuvens: parallax k=0.3 (mesmo esquema dos anéis) + deriva lenta
      const kc = clouds.userData.k;
      clouds.position.set(cam.position.x * (1 - kc), 0, cam.position.z * (1 - kc));
      clouds.rotation.y = performance.now() * 0.00004;   // ~1 volta a cada 4 min
      // sol: segue a câmera na direção assada no céu; fantasmas no eixo
      // sol→centro da tela (somem quando a câmera olha p/ longe do sol)
      const R = 5500;
      sunFlare.sun.position.set(
        cam.position.x + SUN_DIR.x * R, SUN_DIR.y * R, cam.position.z + SUN_DIR.z * R);
      cam.getWorldDirection(_sunFwd);
      const facing = Math.max(0, _sunFwd.dot(SUN_DIR));
      for (const gh of sunFlare.ghosts) {
        _sunG.copy(_sunFwd).multiplyScalar(1 + gh.f).addScaledVector(SUN_DIR, -gh.f).normalize();
        gh.spr.position.set(
          cam.position.x + _sunG.x * R,
          Math.max(_sunG.y, -0.04) * R,
          cam.position.z + _sunG.z * R);
        gh.spr.material.opacity = gh.op * Math.min(1, facing * 2.2);
      }
    },
    // maxDS (opcional): salto circular MÁXIMO plausível de s num frame
    // (v·dt/trackLen ×2 de margem). Bug M1 ("pedras invisíveis" no miolo da
    // pista): perto do ÁPICE de hairpins as duas pernas da pista cabem na
    // janela ±40 amostras e o vizinho mais próximo podia ser da OUTRA perna —
    // q.dist media para a centerline errada e a cerca teleportava o carro.
    // Com maxDS, um vencedor implausível é REJEITADO e a projeção ancora no
    // segmento do sHint (perna certa), marcando rejected=true.
    surfaceAt(x, z, sHint, maxDS) {
      const S = track.samples, N = S.length, M = track.M, open = track.open;
      const clampI = (i) => open ? Math.max(0, Math.min(N - 1, i)) : ((i % N) + N) % N;
      const base = sHint !== undefined ? clampI(Math.floor(sHint * M)) : 0;
      let best = base, bd = Infinity;
      const range = sHint !== undefined ? 40 : (open ? N - 1 : N / 2);
      for (let w = -range; w <= range; w++) {
        const i = clampI(base + w);
        const dx = S[i].pos.x - x, dz = S[i].pos.z - z;
        const d = dx * dx + dz * dz;
        if (d < bd) { bd = d; best = i; }
      }
      // PROJEÇÃO CONTÍNUA no segmento vizinho (bug "carro saltitando",
      // 2026-07-18): o Y/centerline vinha do sample MAIS PRÓXIMO — degraus a
      // cada ~1,5 m excitavam a suspensão sem parar. Agora interpola.
      const project = (iBest) => {
        const sm = S[iBest];
        const nxt = S[clampI(iBest + 1)], prv = S[clampI(iBest - 1)];
        // escolhe o segmento (best→next ou prev→best) que contém a projeção
        let a = sm, b = nxt, i0 = iBest;
        const abx = b.pos.x - a.pos.x, abz = b.pos.z - a.pos.z;
        let t = ((x - a.pos.x) * abx + (z - a.pos.z) * abz) / Math.max(abx * abx + abz * abz, 1e-9);
        if (t < 0) {
          a = prv; b = sm; i0 = clampI(iBest - 1);
          const ax = b.pos.x - a.pos.x, az = b.pos.z - a.pos.z;
          t = ((x - a.pos.x) * ax + (z - a.pos.z) * az) / Math.max(ax * ax + az * az, 1e-9);
        }
        t = Math.max(0, Math.min(1, t));
        const cx = a.pos.x + (b.pos.x - a.pos.x) * t;
        const cz = a.pos.z + (b.pos.z - a.pos.z) * t;
        const roadY = a.pos.y + (b.pos.y - a.pos.y) * t;
        const dist = Math.hypot(x - cx, z - cz);
        // bug M6: superfície no MESMO referencial do dist (ponta do segmento
        // mais perto da projeção — antes vinha do sample mais próximo e o grip
        // PISCAVA nas bordas) e limiar de offroad alinhado à borda VISÍVEL da
        // fita de terra/estrada (W/2 + 0.4; era W/2 + 1.2).
        // WS-5: largura LOCAL do segmento (trechos tipados do sprint).
        const surfBase = t < 0.5 ? a.surface : b.surface;
        const w = t < 0.5 ? a.width : b.width;
        const surface = dist > w / 2 + 0.4 ? 'offroad' : surfBase;
        return {
          sm, dist, surface, phys: SURFACES[surface],
          s: (i0 + t) / M, roadY, cx, cz, rejected: false,
          w,                                        // largura local (fence/offroad)
          fenceless: a.fenceless || b.fenceless,    // WS-5: terra sem cerca
        };
      };
      let q = project(best);
      if (sHint !== undefined && maxDS !== undefined) {
        const s0 = ((sHint % 1) + 1) % 1;
        let ds = Math.abs(q.s - s0);
        if (!open) ds = Math.min(ds, 1 - ds);       // distância circular
        if (ds > maxDS) {                           // perna errada: ancora no sHint
          q = project(base);
          q.rejected = true;
        }
      }
      return q;
    },
  };
}
