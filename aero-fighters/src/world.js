// world.js — Mundo passivo: oceano, ilhas (terreno), céu (nuvens, flak ambiente).
// Exporta: ocean, clouds, createIslands, islandHeightAt, checkTerrainCollision,
//   updateWorld, updateAmbientFlak.
// Para mudar a paleta do mar/ilhas: edite a função createIsland (cores por altitude).
// Para mover ou trocar ilhas: edite ISLAND_DEFS em config.js.

import * as THREE from '../../vendor/three.module.min.js';
import { scene, HEADLESS } from './scene.js';
import { game } from './state.js';
import { ISLAND_DEFS, WORLD, COLORS, PLAYER } from './config.js';
import { explosion } from './fx.js';
import { airportSurface } from './landing-zones.js';
import { getAirportForMap } from './airport.js';
import { inhaumaStructureInfoAt } from './maps/inhauma-scene.js';

// ─── Oceano ──────────────────────────────────────────────────────────────────
const oceanCanvas = document.createElement('canvas');
oceanCanvas.width = 512; oceanCanvas.height = 512;
{
  const ctx = oceanCanvas.getContext('2d');
  ctx.fillStyle = '#004f7a'; ctx.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 25; i++) {
    const x = Math.random() * 512, y = Math.random() * 512, r = 30 + Math.random() * 60;
    const grd = ctx.createRadialGradient(x, y, 0, x, y, r);
    grd.addColorStop(0, 'rgba(0,120,180,0.18)');
    grd.addColorStop(1, 'rgba(0,120,180,0)');
    ctx.fillStyle = grd; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  }
  for (let i = 0; i < 350; i++) {
    const x = Math.random() * 512, y = Math.random() * 512, l = 12 + Math.random() * 55;
    const a = 0.06 + Math.random() * 0.2;
    ctx.strokeStyle = `rgba(${100 + (Math.random() * 70) | 0},${170 + (Math.random() * 60) | 0},${220 + (Math.random() * 30) | 0},${a})`;
    ctx.lineWidth = 0.5 + Math.random() * 1.5;
    ctx.beginPath(); ctx.moveTo(x, y);
    ctx.bezierCurveTo(x + l * 0.3, y - 2, x + l * 0.7, y + 2, x + l, y);
    ctx.stroke();
  }
  for (let i = 0; i < 70; i++) {
    const x = Math.random() * 512, y = Math.random() * 512;
    ctx.fillStyle = `rgba(255,255,255,${0.04 + Math.random() * 0.11})`;
    ctx.beginPath();
    ctx.ellipse(x, y, 8 + Math.random() * 28, 2 + Math.random() * 4, Math.random() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
  }
}
const oceanTex = new THREE.CanvasTexture(oceanCanvas);
oceanTex.wrapS = oceanTex.wrapT = THREE.RepeatWrapping;
oceanTex.repeat.set(50, 50);

// Geometria de oceano com vértices animados (64×64 segmentos = 4225 vértices)
const oceanGeom = new THREE.PlaneGeometry(WORLD.OCEAN_SIZE, WORLD.OCEAN_SIZE, HEADLESS ? 8 : 64, HEADLESS ? 8 : 64);
oceanGeom.rotateX(-Math.PI / 2);
// Salva as posições originais para usar como base nas ondas
const oceanBase = new Float32Array(oceanGeom.attributes.position.array);

export const ocean = new THREE.Mesh(
  oceanGeom,
  new THREE.MeshLambertMaterial({
    map: oceanTex,
    polygonOffset: true,
    polygonOffsetFactor: 1.0,
    polygonOffsetUnits: 1.0,
  }),
);
ocean.position.y = 0;
ocean.receiveShadow = true;
scene.add(ocean);

let _oceanFrame = 0;
/** Anima vértices do oceano com 3 ondas senoidais sobrepostas. */
function updateOceanWaves() {
  // Atualiza a cada 2 frames para economizar — ainda visualmente fluido
  if ((_oceanFrame++ & 1) !== 0) return;
  const t = performance.now() * 0.0008;
  const pos = oceanGeom.attributes.position;
  const arr = pos.array;
  for (let i = 0; i < pos.count; i++) {
    const x = oceanBase[i * 3];
    const z = oceanBase[i * 3 + 2];
    const wave =
      Math.sin(x * 0.04 + t * 1.8) * 0.55 +
      Math.cos(z * 0.05 + t * 1.5) * 0.45 +
      Math.sin((x + z) * 0.07 + t * 2.4) * 0.30;
    arr[i * 3 + 1] = wave;
  }
  pos.needsUpdate = true;
  // Normals recompute é caro — pular (oceano usa Lambert que aceita normals desatualizadas;
  // textura + offset fazem o trabalho visual maior)
}

// ─── Ilhas ───────────────────────────────────────────────────────────────────
function createIsland(cx, cz, radius, peakHeight) {
  const seg = HEADLESS ? 16 : 44;
  const geo = new THREE.PlaneGeometry(radius * 2, radius * 2, seg, seg);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const colors = [];
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    const dist = Math.sqrt(x * x + z * z) / radius;
    // Mais octaves de ruído para perfil orgânico
    const noise =
      Math.sin(x * 0.18) * Math.cos(z * 0.14) * 5 +
      Math.sin(x * 0.36 + 1.5) * Math.cos(z * 0.29 + 0.8) * 2.5 +
      Math.sin(x * 0.72) * Math.cos(z * 0.63) * 1.2 +
      Math.sin(x * 1.42 + 0.4) * Math.cos(z * 1.18 - 0.6) * 0.6;
    const h = Math.max(0, (1 - dist * dist * 1.35) * peakHeight + noise);
    pos.setY(i, h);
    // Transições suaves entre zonas (sem cortes abruptos)
    let r, g, b;
    if (h < 2.0) {
      // Praia branca-areia (faixa larga 0-2m)
      r = 0.91; g = 0.85; b = 0.62;
    } else if (h < 4.5) {
      // Praia → grama (transição suave)
      const k = (h - 2.0) / 2.5;
      r = 0.91 + k * (0.55 - 0.91);
      g = 0.85 + k * (0.72 - 0.85);
      b = 0.62 + k * (0.36 - 0.62);
    } else {
      const t = h / peakHeight;
      if      (t < 0.30) { r = 0.55; g = 0.72; b = 0.36; }  // grama
      else if (t < 0.58) { r = 0.22; g = 0.52; b = 0.16; }  // floresta
      else if (t < 0.80) { r = 0.50; g = 0.40; b = 0.28; }  // rocha
      else               { r = 0.93; g = 0.93; b = 0.97; }  // neve
    }
    colors.push(r, g, b);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true }));
  mesh.position.set(cx, 0, cz);
  mesh.receiveShadow = true;
  scene.add(mesh);
  return mesh;
}

// Função de altura do mapa ativo — trocada via setActiveHeightFn ao mudar de mapa.
// Default: islandHeightAt (mapa Ilhas é o padrão).
let _activeHeightFn = islandHeightAt;

/** Define a função de altura do mapa ativo. Chamado por main.js ao trocar de mapa. */
export function setActiveHeightFn(fn) { _activeHeightFn = fn; }

/** Retorna a função de altura ativa para diagnósticos/testes. */
export function getActiveHeightFn() { return _activeHeightFn; }

/** Anel de espuma branca em volta de cada ilha (no waterline). */
function createFoamRing(cx, cz, radius) {
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(radius * 0.94, radius * 1.05, 48),
    new THREE.MeshBasicMaterial({ color: 0xeef6ff, transparent: true, opacity: 0.55, side: THREE.DoubleSide }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.set(cx, 0.6, cz);  // levemente acima do mar para evitar z-fight
  scene.add(ring);
  return ring;
}

/** Palmeiras nas faixas de praia das ilhas (WS-7) — 2 InstancedMesh (troncos+copas). */
function scatterPalms() {
  if (HEADLESS) return;
  const spots = [];
  for (const isl of game.islands) {
    const n = Math.max(3, Math.floor(isl.radius / 12));
    for (let i = 0; i < n; i++) {
      const a = game.rng.range(0, Math.PI * 2);
      const rr = isl.radius * game.rng.range(0.62, 0.88);
      const dx = Math.cos(a) * rr, dz = Math.sin(a) * rr;
      const h = islandHeightAt(isl, dx, dz);
      if (h > 0.4 && h < 3.0) spots.push({ x: isl.cx + dx, y: h, z: isl.cz + dz, s: game.rng.range(0.8, 1.4) });
    }
  }
  if (!spots.length) return;
  const trunkGeo = new THREE.CylinderGeometry(0.16, 0.26, 5, 5);
  const frondGeo = new THREE.ConeGeometry(2.2, 1.6, 6);
  const trunks = new THREE.InstancedMesh(trunkGeo, new THREE.MeshLambertMaterial({ color: 0x8a6844 }), spots.length);
  const fronds = new THREE.InstancedMesh(frondGeo, new THREE.MeshLambertMaterial({ color: 0x2f7a32 }), spots.length);
  trunks.frustumCulled = false; fronds.frustumCulled = false;
  const d = new THREE.Object3D();
  spots.forEach((p, i) => {
    d.position.set(p.x, p.y + 2.5 * p.s, p.z); d.scale.setScalar(p.s); d.rotation.y = p.x * 0.7;
    d.updateMatrix(); trunks.setMatrixAt(i, d.matrix);
    d.position.y = p.y + 5.2 * p.s;
    d.updateMatrix(); fronds.setMatrixAt(i, d.matrix);
  });
  scene.add(trunks); scene.add(fronds);
}

/** Constrói todas as ilhas e popula game.islands com metadados para colisão. */
export function createIslands() {
  for (const [cx, cz, r, h] of ISLAND_DEFS) {
    const mesh = createIsland(cx, cz, r, h);
    createFoamRing(cx, cz, r);
    // CONTRATO: writer de game.islands
    game.islands.push({ cx, cz, radius: r, peakHeight: h, mesh });
  }
  scatterPalms();
}

/** Altura local de uma ilha em (dx, dz) relativos ao centro. Função pura.
 *  Usa a mesma fórmula que createIsland() — parabólica + noise senoidal 4 octaves (T-BF01).
 *  Antes usava apenas a parábola, causando divergência entre colisão e mesh visual. */
export function islandHeightAt(isl, dx, dz) {
  const r2 = dx * dx + dz * dz;
  if (r2 >= isl.radius * isl.radius) return 0;
  const dist = Math.sqrt(r2) / isl.radius;
  const noise =
    Math.sin(dx * 0.18) * Math.cos(dz * 0.14) * 5 +
    Math.sin(dx * 0.36 + 1.5) * Math.cos(dz * 0.29 + 0.8) * 2.5 +
    Math.sin(dx * 0.72) * Math.cos(dz * 0.63) * 1.2 +
    Math.sin(dx * 1.42 + 0.4) * Math.cos(dz * 1.18 - 0.6) * 0.6;
  return Math.max(0, (1 - dist * dist * 1.35) * isl.peakHeight + noise);
}

/** VERDADE DE SUPERFÍCIE (WS-1) — única fonte para colisão, pouso e HUD.
 *  Devolve { height, kind } com kind ∈ 'water'|'land'|'mountain'|'runway'|'taxiway'|'service'.
 *  Água só existe onde o mapa tem água: islands (mar aberto) e rio (além da praia). */
export function surfaceInfoAt(x, z) {
  const surf = airportSurface({ x, z }, game.activeMap);
  if (surf !== 'none') {
    return { height: getAirportForMap(game.activeMap).elevation, kind: surf };
  }
  let h = 0;
  for (const isl of game.islands) {
    const dx = x - isl.cx;
    const dz = z - isl.cz;
    if (dx * dx + dz * dz < isl.radius * isl.radius) {
      const localH = _activeHeightFn(isl, dx, dz);
      if (localH > h) h = localH;
    }
  }
  const mapKey = game.activeMap || 'islands';
  if (mapKey === 'inhauma') {
    const structure = inhaumaStructureInfoAt(x, z);
    if (structure) return structure;
  }
  if (h > 2.5) return { height: h, kind: 'mountain' };
  if (mapKey === 'islands') return { height: Math.max(h, 0), kind: h > 0.5 ? 'land' : 'water' };
  if (mapKey === 'rio') return { height: h, kind: z < -230 && h <= 0.5 ? 'water' : 'land' };
  return { height: h, kind: 'land' };
}

/** Checa colisão do avião com terreno via surfaceInfoAt.
 *  @returns {'WATER'|'GROUND'|'MOUNTAIN'|null} — pavimento nunca colide aqui
 *  (a máquina de contato em player.js trata pouso/hard-landing). */
export function checkTerrainCollision(jetPosition) {
  const s = surfaceInfoAt(jetPosition.x, jetPosition.z);
  if (s.kind === 'runway' || s.kind === 'taxiway' || s.kind === 'service') return null;
  if (s.kind === 'structure') return jetPosition.y < s.height + 1.2 ? 'GROUND' : null;
  if (s.kind === 'mountain') {
    return jetPosition.y < s.height + PLAYER.MOUNTAIN_BUFFER ? 'MOUNTAIN' : null;
  }
  if (s.kind === 'water') return jetPosition.y < 1.5 ? 'WATER' : null;
  return jetPosition.y < s.height + 1.2 ? 'GROUND' : null;
}

// ─── Nuvens Volumétricas ──────────────────────────────────────────────────────
// Três camadas de altitude com MeshStandardMaterial para resposta à luz.
// cloudMats[] guarda referências para atualização dinâmica de cor via ciclo dia/noite.
export const clouds = [];
const cloudMats = [];

// Camadas: [altMin, altMax, count, radiusMin, radiusMax, sphereCountMin, sphereCountMax]
const CLOUD_LAYERS = HEADLESS ? [] : [
  [80,  130, 20,  8, 18, 15, 25],   // Baixa
  [220, 380, 25, 12, 25, 15, 28],   // Média
  [500, 750, 15, 20, 40, 12, 20],   // Alta (cirrus — mais esparsas)
];

for (const [altMin, altMax, count, rMin, rMax, sMin, sMax] of CLOUD_LAYERS) {
  for (let i = 0; i < count; i++) {
    const g = new THREE.Group();
    // ADR-U5: fog:false mata a tinta bege do fog do mapa; emissive leve dá leitura
    // de nuvem (não rocha); cachos achatados em Y.
    const mat = new THREE.MeshStandardMaterial({
      color: 0xffffff, roughness: 0.95, metalness: 0.0,
      emissive: 0x33363c, emissiveIntensity: 0.5, fog: false,
    });
    cloudMats.push(mat);
    const n = sMin + Math.floor(Math.random() * (sMax - sMin + 1));
    const spread = rMax * 2.5;
    for (let j = 0; j < n; j++) {
      const r = rMin + Math.random() * (rMax - rMin);
      const s = new THREE.Mesh(new THREE.SphereGeometry(r, 8, 6), mat);
      s.position.set(
        (Math.random() - 0.5) * spread,
        (Math.random() - 0.5) * (rMax * 0.5),
        (Math.random() - 0.5) * spread,
      );
      g.add(s);
    }
    g.position.set(
      (Math.random() - 0.5) * 4000,
      altMin + Math.random() * (altMax - altMin),
      (Math.random() - 0.5) * 4000,
    );
    g.scale.y = 0.55; // nuvens achatadas (ADR-U5)
    scene.add(g);
    clouds.push(g);
  }
}

let _cloudColorTimer = 0;
/** Atualiza cor das nuvens com base no timeOfDay (a cada ~2s para não gastar por frame). */
export function updateCloudColors(tod) {
  const isDawn  = tod > 0.15 && tod < 0.28;
  const isDusk  = tod > 0.72 && tod < 0.86;
  const isNight = tod < 0.18 || tod > 0.82;
  const cloudColor = isNight ? 0x1a2030 : (isDawn || isDusk) ? 0xffb08a : 0xffffff;
  for (const m of cloudMats) m.color.setHex(cloudColor);
}

/** Atualiza oceano (offset de textura + vertex waves, recentralizar no player) e drift de nuvens. */
export function updateWorld(dt, playerPosition) {
  oceanTex.offset.y += dt * 0.22;
  oceanTex.offset.x += dt * 0.05;
  ocean.position.x = playerPosition.x;
  ocean.position.z = playerPosition.z;
  updateOceanWaves();
  for (const c of clouds) {
    c.position.x += dt * 4;
    if (c.position.x > playerPosition.x + 2000) c.position.x -= 4000;
  }
  // Atualiza cor das nuvens a cada ~2s
  _cloudColorTimer -= dt;
  if (_cloudColorTimer <= 0) {
    _cloudColorTimer = 2.0;
    updateCloudColors(game.timeOfDay || 0.35);
  }
}

// ─── Flak ambiente (decorativo, sem dano) ────────────────────────────────────
const _flakV = new THREE.Vector3();
const _flakFwd = new THREE.Vector3();
const _flakRight = new THREE.Vector3();
let flakTimer = 0;

/** Spawn de pequenas explosões cinza no céu (atmosfera de zona de guerra). */
export function updateAmbientFlak(dt, playerPosition, playerQuaternion) {
  if (game.cycle < WORLD.AMBIENT_FLAK_GATE_CYCLE) return;
  if (!game.running || game.flags.missionFailed) return;
  flakTimer -= dt;
  if (flakTimer > 0) return;
  flakTimer = 0.6 + Math.random() * 0.8;
  _flakFwd.set(0, 0, -1).applyQuaternion(playerQuaternion);
  _flakRight.set(1, 0, 0).applyQuaternion(playerQuaternion);
  const fx = playerPosition.x + _flakFwd.x * (30 + Math.random() * 50) + _flakRight.x * (Math.random() - 0.5) * 60;
  const fy = playerPosition.y + (Math.random() - 0.3) * 30;
  const fz = playerPosition.z + _flakFwd.z * (30 + Math.random() * 50) + _flakRight.z * (Math.random() - 0.5) * 60;
  _flakV.set(fx, fy, fz);
  explosion(_flakV, 0.6, COLORS.flakAmbient);
}

/** Deforma a geometria das ilhas dentro do raio de blast nuclear (cratera). */
export function deformTerrainNuclear(epicenter, blastRadius) {
  for (const isl of game.islands) {
    if (!isl.mesh) continue;
    const dx = isl.cx - epicenter.x;
    const dz = isl.cz - epicenter.z;
    const islDist = Math.sqrt(dx * dx + dz * dz);
    if (islDist > blastRadius + isl.radius) continue;

    const geo = isl.mesh.geometry;
    const posAttr = geo.attributes.position;
    for (let i = 0; i < posAttr.count; i++) {
      const wx = isl.cx + posAttr.getX(i);
      const wz = isl.cz + posAttr.getZ(i);
      const d = Math.sqrt((wx - epicenter.x) ** 2 + (wz - epicenter.z) ** 2);
      if (d < blastRadius) {
        const crater = -(1 - d / blastRadius) * 30;
        posAttr.setY(i, Math.max(0, posAttr.getY(i) + crater));
      }
    }
    posAttr.needsUpdate = true;
    geo.computeVertexNormals();
  }
}
