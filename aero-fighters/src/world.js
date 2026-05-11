// world.js — Mundo passivo: oceano, ilhas (terreno), céu (nuvens, flak ambiente).
// Exporta: ocean, clouds, createIslands, islandHeightAt, checkTerrainCollision,
//   updateWorld, updateAmbientFlak.
// Para mudar a paleta do mar/ilhas: edite a função createIsland (cores por altitude).
// Para mover ou trocar ilhas: edite ISLAND_DEFS em config.js.

import * as THREE from '../../vendor/three.module.min.js';
import { scene } from './scene.js';
import { game } from './state.js';
import { ISLAND_DEFS, WORLD, COLORS } from './config.js';
import { explosion } from './fx.js';

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
const oceanGeom = new THREE.PlaneGeometry(WORLD.OCEAN_SIZE, WORLD.OCEAN_SIZE, 64, 64);
oceanGeom.rotateX(-Math.PI / 2);
// Salva as posições originais para usar como base nas ondas
const oceanBase = new Float32Array(oceanGeom.attributes.position.array);

export const ocean = new THREE.Mesh(
  oceanGeom,
  new THREE.MeshLambertMaterial({ map: oceanTex }),
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
  const seg = 44;
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

/** Constrói todas as ilhas e popula game.islands com metadados para colisão. */
export function createIslands() {
  for (const [cx, cz, r, h] of ISLAND_DEFS) {
    createIsland(cx, cz, r, h);
    createFoamRing(cx, cz, r);
    // CONTRATO: writer de game.islands
    game.islands.push({ cx, cz, radius: r, peakHeight: h });
  }
}

/** Altura local de uma ilha em (dx, dz) relativos ao centro. Função pura. */
export function islandHeightAt(isl, dx, dz) {
  const r2 = dx * dx + dz * dz;
  if (r2 >= isl.radius * isl.radius) return 0;
  const t = Math.sqrt(r2) / isl.radius;
  return isl.peakHeight * Math.max(0, 1 - t * t * 1.35);
}

/** Checa colisão do avião com terreno. @returns {'SEA'|'MOUNTAIN'|null} */
export function checkTerrainCollision(jetPosition) {
  if (jetPosition.y < 3) return 'SEA';
  for (const isl of game.islands) {
    const dx = jetPosition.x - isl.cx;
    const dz = jetPosition.z - isl.cz;
    const r2 = dx * dx + dz * dz;
    if (r2 < isl.radius * isl.radius) {
      const localH = islandHeightAt(isl, dx, dz);
      if (jetPosition.y < localH + 2.5) return 'MOUNTAIN';
    }
  }
  return null;
}

// ─── Nuvens ──────────────────────────────────────────────────────────────────
const cloudMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.80 });
export const clouds = [];
for (let i = 0; i < WORLD.CLOUD_COUNT; i++) {
  const g = new THREE.Group();
  const n = 4 + Math.floor(Math.random() * 7);
  for (let j = 0; j < n; j++) {
    const r = 7 + Math.random() * 12;
    const s = new THREE.Mesh(new THREE.SphereGeometry(r, 7, 5), cloudMat);
    s.position.set((Math.random() - 0.5) * 35, (Math.random() - 0.5) * 9, (Math.random() - 0.5) * 35);
    g.add(s);
  }
  g.position.set((Math.random() - 0.5) * 4000, 65 + Math.random() * 140, (Math.random() - 0.5) * 4000);
  scene.add(g); clouds.push(g);
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
