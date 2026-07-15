// maps/inhauma-scene.js — Construção do mapa Inhauma REALISTA.
// Relevo contínuo (FBM) + rio entalhado + represa/reservatório + usina nuclear +
// fábricas + florestas + estradas com carros + cidade. Sem assets externos.
//
// Verdade de superfície única: inhaumaContinuousHeight(x,z) alimenta TANTO a malha
// visual QUANTO a colisão (via a região gigante registrada em game.islands).

import * as THREE from '../../../vendor/three.module.min.js';
import { game } from '../state.js';
import { applyAirportClearing } from '../landing-zones.js';
import { fbm2D, distToPolyline } from './noise.js';
import { applyInhaumaRoadBed, nearAnyRoad } from './inhauma-roads.js';
import { getPortalMounds } from './inhauma-road-defs.js';
import { updateRoadTraffic } from './inhauma-traffic.js';
import { createReflectiveWater, createFlowingWater, updateWaterSurfaces } from '../environment/water-surface.js';
import { loadInhaumaDem, sampleDemHeight } from './heightmap-sampler.js';

// sky.js importa scene.js (que toca window no escopo de módulo) — carga LAZY para
// este módulo continuar importável em Node (validate:aero-map).
let _getSunData = null;
if (typeof window !== 'undefined') {
  import('../sky.js').then((m) => { _getSunData = m.getSunData; }).catch(() => {});
}

// DEM vendorizado (T-01/T-02) — verdade de superfície de base do vale
// (aero-fighters-inhauma-serra-v1). Top-level await: qualquer módulo que importe
// (direta ou transitivamente) este arquivo só termina de avaliar depois que o asset
// estiver carregado — inhaumaBaseHeight/inhaumaContinuousHeight nunca são chamadas
// antes disso (create() dos mapas é síncrono hoje; ver maps/index.js). Sem
// `window`/`document`/`<canvas>` aqui — loadInhaumaDem() é Node-safe (fs) e
// browser-safe (fetch) pela mesma função, então o top-level await funciona nos dois
// runtimes (validate:aero-map/test:aero:sim em Node, index.html no browser).
await loadInhaumaDem();

// ─── Geografia ────────────────────────────────────────────────────────────────
export const WATER_LEVEL = 4.5;     // m — cota da lâmina d'água
// FIX água-no-aeroporto (2026-07-01): o curso antigo passava a ~52 m do centro da
// pista (x=-560,z=320) — DENTRO do leito (RIVER_W=60). Com o rio desenhado de ponta
// a ponta (WS-3), a lâmina d'água cobria a pista (pavimento na cota 0 < 4.5).
// O trecho a montante agora CONTORNA o aeroporto pelo NORTE (≥ ~120 m de qualquer
// superfície do aeródromo) e desce para o reservatório pelo nordeste. Nenhuma
// estrada autorada cruza o novo traçado (todas ficam ao sul de z≈105 nesse setor).
const RIVER = [
  { x: -1250, z: -780 }, { x: -940, z: 520 }, { x: -660, z: 860 },
  { x: -260, z: 660 }, { x: -120, z: 240 }, { x: 320, z: 470 },
  { x: 760, z: 700 }, { x: 1200, z: 900 },
];
const RIVER_W = 60;       // meia-largura do leito
const VALLEY_W = 200;     // meia-largura do vale (rampa até o leito)
const DAM = { x: 320, z: 470, ang: 0.6 }; // barragem (atravessa o rio)
const RESERVOIR = { x: 60, z: 350, rx: 300, rz: 160 }; // lago da represa (a montante, no vale)
const structures = [];

// Features nomeadas — v0.2.0 FBM: geravam relevo (featureContribution). A partir de
// aero-fighters-inhauma-serra-v1 o relevo vem do DEM (sampleDemHeight) — a lista NÃO
// contribui mais para a altura (D-2: "INHAUMA_FEATURES contribution removed"). Mantida
// (neutralizada) só como metadado de posição/rótulo para os diagnostics existentes
// (game.missionRealism.inhaumaMap.terrainRegions, consumidos por inhauma.js/testes de
// fidelidade) — esses nomes/posições apontavam para morros autorais que já não existem;
// T-04..T-10 (roads/city/QA) devem revisá-los contra o relevo real do DEM.
export const INHAUMA_FEATURES = [
  { id: 'urban-rise-inhauma', cx: 0, cz: 0, radius: 360, peakHeight: 14, type: 'urbanRise' },
  { id: 'morros-oeste-inhauma', cx: -380, cz: 40, radius: 300, peakHeight: 58, type: 'roundedHill' },
  { id: 'morro-norte-inhauma', cx: -40, cz: -330, radius: 250, peakHeight: 50, type: 'roundedHill' },
  { id: 'serra-sete-lagoas', cx: 760, cz: -300, radius: 460, peakHeight: 96, type: 'ridge' },
  { id: 'vale-cachoeira-prata', cx: -940, cz: 520, radius: 260, peakHeight: 16, type: 'valley' },
  { id: 'morros-sudeste-inhauma', cx: 330, cz: 330, radius: 240, peakHeight: 44, type: 'roundedHill' },
  { id: 'serra-leste-inhauma', cx: 1300, cz: 120, radius: 380, peakHeight: 70, type: 'ridge' },
].map((d, index) => ({ ...d, index }));

// WS-2: colinas de portal de túnel — geradas das pontas de estrada (inhauma-road-defs).
// Somadas ao relevo para que TODA estrada aberta fure uma encosta real, nunca pare no ar.
const PORTAL_MOUNDS = getPortalMounds();
function portalMoundContribution(x, z) {
  let h = 0;
  for (const m of PORTAL_MOUNDS) {
    const t = Math.hypot(x - m.x, z - m.z) / m.radius;
    if (t < 1) h += m.peak * Math.max(0, 1 - t * t * 1.3); // mesma curva de roundedHill
  }
  return h;
}

// Ruído de detalhe de alta frequência sobre o DEM (13 m/px) — evita o look "liso de
// vinil" de perto sem alterar o relevo macro (vale/cristas). Amplitude pequena
// (±3 m) e frequência alta (~1/22 m) — bem abaixo da escala das feições do DEM.
// Coordenadas deslocadas para não correlacionar com outros usos de fbm2D no jogo.
function inhaumaDetailNoise(x, z) {
  return (fbm2D(x + 8000, z - 5000, { freq: 0.045, oct: 3 }) - 0.5) * 6;
}

/** Altura base do terreno em coords de mundo, antes de cortes de estrada. */
function inhaumaBaseHeight(x, z) {
  // DEM real (Chamonix U-valley, T-01/T-02) + micro-relevo de alta frequência.
  let h = sampleDemHeight(x, z) + inhaumaDetailNoise(x, z);

  // Colinas de portal de túnel (WS-2) — encostas onde as estradas entram em túnel.
  h += portalMoundContribution(x, z);

  // Entalhe do rio: rampa para o leito (cria vale + canal abaixo da água)
  const dr = distToPolyline(x, z, RIVER);
  if (dr < VALLEY_W) {
    const k = 1 - dr / VALLEY_W;            // 0 na borda → 1 no eixo
    const carve = k * k * 46;               // profundidade do vale
    h -= carve;
    if (dr < RIVER_W) h = Math.min(h, WATER_LEVEL - 7); // leito submerso
  }
  // Bacia do reservatório a montante da barragem
  const er = Math.hypot((x - RESERVOIR.x) / RESERVOIR.rx, (z - RESERVOIR.z) / RESERVOIR.rz);
  if (er < 1) h = Math.min(h, WATER_LEVEL - 5 - (1 - er) * 8);

  // Piso em 0: leito do rio/lago fica em 0 e a lâmina d'água (WATER_LEVEL) cobre.
  // Mantém colisão (max(0,h)) idêntica ao diagnostics (alvos sempre aterrados).
  h = Math.max(h, 0);
  // Clareira do aeroporto (pista plana, sem morro)
  return applyAirportClearing(h, x, z, 'inhauma');
}

/** Altura contínua final. A estrada gerada assenta o terreno para evitar fitas flutuando. */
export function inhaumaContinuousHeight(x, z) {
  const base = inhaumaBaseHeight(x, z);
  return applyInhaumaRoadBed(x, z, base, inhaumaBaseHeight);
}

// ─── Materiais utilitários ──────────────────────────────────────────────────
const _mc = new Map();
function lmat(color, opts) {
  const key = color + JSON.stringify(opts || 0);
  if (!_mc.has(key)) _mc.set(key, new THREE.MeshLambertMaterial({ color, ...opts }));
  return _mc.get(key);
}
// Lambert (não PBR) para evitar compilação de shader cara no warmup → FPS na decolagem.
function smat(color) {
  return lmat(color);
}

function biomeColor(h, out, i) {
  // paleta por cota: várzea verde → mata → rocha → topo claro
  let r, g, b;
  if (h < WATER_LEVEL + 1.5) { r = 0.74; g = 0.68; b = 0.46; }       // areia/margem
  else if (h < 18) { r = 0.33; g = 0.50; b = 0.24; }                  // campo verde
  else if (h < 48) { r = 0.20; g = 0.42; b = 0.18; }                  // mata densa
  else if (h < 80) { r = 0.42; g = 0.40; b = 0.30; }                  // rocha
  else { r = 0.62; g = 0.62; b = 0.58; }                              // topo
  out[i] = r; out[i + 1] = g; out[i + 2] = b;
}

// ─── Terreno infinito visual (chunks reciclados) ─────────────────────────────
const TERR = { chunkSize: 2600, radius: 1, seg: 54 };
const TERRAIN_COLLISION_RADIUS = 1e9;

function registerStructure(id, x, z, halfX, halfZ, topY) {
  structures.push({ id, x, z, halfX, halfZ, topY });
}

export function inhaumaStructureInfoAt(x, z) {
  let hit = null;
  for (const s of structures) {
    if (Math.abs(x - s.x) <= s.halfX && Math.abs(z - s.z) <= s.halfZ) {
      if (!hit || s.topY > hit.height) hit = { height: s.topY, kind: 'structure', id: s.id };
    }
  }
  return hit;
}

// Lista de estruturas (casas/prédios/fábricas) em coords de mundo — exposto para a nuke
// incendiar cenário (WS-5). Cada item: {id, x, z, halfX, halfZ, topY}.
export function getInhaumaStructures() {
  return structures;
}

function updateTerrainChunkGeometry(chunk, gridX, gridZ) {
  const half = TERR.chunkSize / 2;
  const centerX = gridX * TERR.chunkSize;
  const centerZ = gridZ * TERR.chunkSize;
  const pos = chunk.geometry.attributes.position;
  const col = chunk.geometry.attributes.color;
  for (let i = 0; i < pos.count; i++) {
    const wx = centerX + pos.getX(i);
    const wz = centerZ + pos.getZ(i);
    const h = inhaumaContinuousHeight(wx, wz);
    pos.setY(i, h);
    biomeColor(h, col.array, i * 3);
  }
  pos.needsUpdate = true;
  col.needsUpdate = true;
  chunk.geometry.computeVertexNormals();
  chunk.position.set(centerX, 0, centerZ);
  chunk.userData.gridX = gridX;
  chunk.userData.gridZ = gridZ;
  // Evita costura visível de frustum em chunk grande.
  chunk.frustumCulled = false;
}

function createTerrainChunk(gridX, gridZ, material) {
  const geo = new THREE.PlaneGeometry(TERR.chunkSize, TERR.chunkSize, TERR.seg, TERR.seg);
  geo.rotateX(-Math.PI / 2);
  geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(geo.attributes.position.count * 3), 3));
  const mesh = new THREE.Mesh(geo, material);
  mesh.receiveShadow = true;
  updateTerrainChunkGeometry(mesh, gridX, gridZ);
  return mesh;
}

// FIX lag-de-voo (2026-07-01): cruzar uma borda de célula reconstruía os 9 chunks
// NO MESMO FRAME (9 × 55×55 amostras de altura FBM+estradas + 9 computeVertexNormals
// + 9 uploads de geometria) — um congelamento periódico a cada ~2.6 km de voo. Agora:
//  - chunks cujo grid continua dentro da janela 3×3 são REUTILIZADOS como estão;
//  - só os que saíram são re-gerados, no MÁXIMO 1 POR FRAME (fila amortizada).
// Mover 1 célula = 3 rebuilds espalhados em 3 frames (~16 ms cada) em vez de 9 num só.
export function updateInfiniteTerrain(playerPos, terrain, drainAll = false) {
  if (!terrain || !playerPos) return;
  const baseX = Math.round(playerPos.x / TERR.chunkSize);
  const baseZ = Math.round(playerPos.z / TERR.chunkSize);
  if (baseX !== terrain.baseX || baseZ !== terrain.baseZ) {
    terrain.baseX = baseX;
    terrain.baseZ = baseZ;
    const wanted = [];
    for (let gx = baseX - TERR.radius; gx <= baseX + TERR.radius; gx++) {
      for (let gz = baseZ - TERR.radius; gz <= baseZ + TERR.radius; gz++) wanted.push([gx, gz]);
    }
    const claimed = new Set();
    const free = [];
    for (const chunk of terrain.chunks) {
      const key = chunk.userData.gridX + ':' + chunk.userData.gridZ;
      const inWindow = wanted.some(([gx, gz]) => gx + ':' + gz === key);
      if (inWindow && !claimed.has(key)) claimed.add(key);
      else free.push(chunk);
    }
    terrain.queue = [];
    for (const [gx, gz] of wanted) {
      if (claimed.has(gx + ':' + gz)) continue;
      terrain.queue.push({ chunk: free.pop(), gx, gz });
    }
  }
  if (terrain.queue?.length) {
    do {
      const job = terrain.queue.shift();
      updateTerrainChunkGeometry(job.chunk, job.gx, job.gz);
    } while (drainAll && terrain.queue.length);
  }
}

export function buildInhaumaTerrain(scene) {
  const material = new THREE.MeshLambertMaterial({ vertexColors: true });
  const terrain = { chunks: [], baseX: null, baseZ: null };
  for (let i = 0; i < (TERR.radius * 2 + 1) ** 2; i++) {
    const mesh = createTerrainChunk(0, 0, material);
    terrain.chunks.push(mesh);
    scene.add(mesh);
  }
  // Boot é momento de carga: constrói a janela 3×3 inteira de uma vez (drainAll).
  updateInfiniteTerrain({ x: 0, z: 0 }, terrain, true);

  // Registra UMA região virtual gigante: colisão/HUD usam a função contínua,
  // enquanto a malha visual é reciclada em chunks ao redor do avião.
  game.islands.length = 0;
  structures.length = 0;
  game.islands.push({
    cx: 0, cz: 0, radius: TERRAIN_COLLISION_RADIUS, peakHeight: 120, type: 'inhauma-continuous', mesh: terrain.chunks[4],
  });
  return terrain;
}

// Altura da SUPERFÍCIE RENDERIZADA do terreno: amostra a MESMA grade dos chunks
// (espaçamento chunkSize/seg) e interpola bilinearmente. Objetos e colisão assentam
// no que é DESENHADO, não no pico contínuo sub-amostrado — elimina o "float" de
// ~7-9 m nos cumes agudos das serras (WS-1 / bug aero-inhauma-invisible-mountains).
const TERR_STEP = TERR.chunkSize / TERR.seg; // 2600/54 ≈ 48.148 m — passo da grade do mesh
export function inhaumaVisualSurfaceHeight(x, z) {
  const x0 = Math.floor(x / TERR_STEP) * TERR_STEP;
  const z0 = Math.floor(z / TERR_STEP) * TERR_STEP;
  const tx = (x - x0) / TERR_STEP;
  const tz = (z - z0) / TERR_STEP;
  const h00 = inhaumaContinuousHeight(x0, z0);
  const h10 = inhaumaContinuousHeight(x0 + TERR_STEP, z0);
  const h01 = inhaumaContinuousHeight(x0, z0 + TERR_STEP);
  const h11 = inhaumaContinuousHeight(x0 + TERR_STEP, z0 + TERR_STEP);
  const h0 = h00 + (h10 - h00) * tx;
  const h1 = h01 + (h11 - h01) * tx;
  return h0 + (h1 - h0) * tz;
}

/** Height-fn registrada (assinatura compatível com world.js: (isl, dx, dz)).
 *  Usa a superfície RENDERIZADA para grounding/colisão casarem com o mesh visível. */
export function inhaumaHeightAt(isl, dx, dz) {
  return inhaumaVisualSurfaceHeight(isl.cx + dx, isl.cz + dz);
}

// ─── Água (rio + reservatório), animada ──────────────────────────────────────
// Reuso de terceiros (2026-07-01): reservatório = examples/jsm Water (reflexivo,
// waternormals oficial do three r165); rio = shader de fluxo compartilhado
// (environment/water-surface.js — reutilizável pelos outros mapas).
export function buildInhaumaWater(scene) {
  const waters = [];

  // Reservatório (lago da represa) — 1 superfície reflexiva por mapa
  const lake = createReflectiveWater(
    new THREE.PlaneGeometry(RESERVOIR.rx * 2, RESERVOIR.rz * 2, 1, 1),
    { color: 0x2a6d94, opacity: 0.96 },
  );
  lake.position.set(RESERVOIR.x, WATER_LEVEL, RESERVOIR.z);
  scene.add(lake); waters.push(lake);

  // Rio (ribbon de segmentos seguindo TODA a polilinha — WS-3: rio visível de ponta a
  // ponta, não só a jusante da barragem. O leito já é escavado ao longo de todo o
  // traçado por inhaumaBaseHeight, então basta desenhar a lâmina d'água inteira.)
  for (let i = 0; i < RIVER.length - 1; i++) {
    const a = RIVER[i], b = RIVER[i + 1];
    const mx = (a.x + b.x) / 2, mz = (a.z + b.z) / 2;
    const len = Math.hypot(b.x - a.x, b.z - a.z);
    const seg = createFlowingWater(
      new THREE.PlaneGeometry(RIVER_W * 2.8, len + 40),
      { color: 0x3d7fa3, deepColor: 0x16405c, flow: [0.012, 0.055], repeat: 5, opacity: 0.9 },
    );
    seg.rotation.z = -Math.atan2(b.x - a.x, b.z - a.z);
    seg.position.set(mx, WATER_LEVEL - 0.2, mz);
    scene.add(seg); waters.push(seg);
  }
  return { waters };
}

// ─── Barragem (represa) ──────────────────────────────────────────────────────
export function buildDam(scene) {
  const g = new THREE.Group();
  const concrete = smat(0xb9b9b3, { roughness: 0.95 });
  // Paredão curvo (arco) atravessando o vale
  const wall = new THREE.Mesh(new THREE.BoxGeometry(360, 46, 26), concrete);
  wall.position.set(DAM.x, 18, DAM.z);
  wall.rotation.y = DAM.ang;
  wall.castShadow = false; wall.receiveShadow = true;
  g.add(wall);
  registerStructure('represa-inhauma', DAM.x, DAM.z, 190, 28, 46);
  // Crista / estrada no topo
  const crest = new THREE.Mesh(new THREE.BoxGeometry(364, 3, 8), smat(0x3a3a3a));
  crest.position.set(DAM.x, 41, DAM.z); crest.rotation.y = DAM.ang; g.add(crest);
  // Vertedouros (3 vãos)
  for (let i = -1; i <= 1; i++) {
    const sx = DAM.x + Math.cos(DAM.ang) * i * 90;
    const sz = DAM.z - Math.sin(DAM.ang) * i * 90;
    const spill = new THREE.Mesh(new THREE.BoxGeometry(26, 30, 28), smat(0x6f6f6a));
    spill.position.set(sx, 16, sz); spill.rotation.y = DAM.ang; g.add(spill);
  }
  scene.add(g);
  return g;
}

// ─── Usina nuclear (torres de resfriamento + cúpula + vapor) ──────────────────
export function buildNuclearPlant(scene) {
  const px = 620, pz = 640; // a jusante, perto do rio
  const baseY = inhaumaContinuousHeight(px, pz);
  const g = new THREE.Group();
  const towerMat = smat(0xd8d8d2, { roughness: 0.85 });
  const steamEmitters = [];

  // 2 torres hiperbólicas (perfil estreitado no meio via LatheGeometry)
  for (const ox of [-55, 55]) {
    const pts = [];
    for (let i = 0; i <= 10; i++) {
      const t = i / 10;
      const r = 34 - Math.sin(t * Math.PI) * 13;   // cintura estreita
      pts.push(new THREE.Vector2(r, t * 70));
    }
    const tower = new THREE.Mesh(new THREE.LatheGeometry(pts, 24), towerMat);
    tower.position.set(px + ox, baseY, pz);
    tower.castShadow = false; tower.receiveShadow = true;
    g.add(tower);
    registerStructure(`torre-resfriamento-${ox}`, px + ox, pz, 34, 34, baseY + 70);
    steamEmitters.push({ x: px + ox, y: baseY + 70, z: pz });
  }
  // Cúpula do reator
  const dome = new THREE.Mesh(new THREE.SphereGeometry(20, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2), smat(0xcfd3d6, { metalness: 0.3, roughness: 0.5 }));
  dome.position.set(px, baseY, pz - 80); g.add(dome);
  registerStructure('cupula-reator-inhauma', px, pz - 80, 24, 24, baseY + 22);
  const reactorBase = new THREE.Mesh(new THREE.CylinderGeometry(22, 22, 14, 16), towerMat);
  reactorBase.position.set(px, baseY + 7, pz - 80); g.add(reactorBase);
  // Prédios auxiliares
  for (const [bx, bz, w] of [[px - 90, pz - 30, 30], [px + 95, pz - 40, 26], [px, pz + 70, 40]]) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, 16, w * 0.7), smat(0x9aa0a6));
    b.position.set(bx, baseY + 8, bz); b.castShadow = false; g.add(b);
    registerStructure('predio-usina-inhauma', bx, bz, w / 2, w * 0.35, baseY + 16);
  }
  scene.add(g);
  return { group: g, steamEmitters };
}

// ─── Fábricas (zona industrial + chaminés) ───────────────────────────────────
export function buildFactories(scene) {
  const zones = [[1180, -260], [1080, -120], [-820, 300]];
  const smoke = [];
  const g = new THREE.Group();
  for (const [zx, zz] of zones) {
    const by = inhaumaContinuousHeight(zx, zz);
    const shed = new THREE.Mesh(new THREE.BoxGeometry(70, 22, 44), smat(0x7d7468));
    shed.position.set(zx, by + 11, zz); shed.castShadow = false; g.add(shed);
    registerStructure('fabrica-inhauma', zx, zz, 35, 22, by + 24);
    const roof = new THREE.Mesh(new THREE.BoxGeometry(74, 3, 48), smat(0x4a4640));
    roof.position.set(zx, by + 23, zz); g.add(roof);
    for (let i = -1; i <= 1; i++) {
      const ch = new THREE.Mesh(new THREE.CylinderGeometry(3.4, 4, 30, 10), smat(0x8a3b2a));
      ch.position.set(zx + i * 14, by + 30, zz - 16); ch.castShadow = false; g.add(ch);
      registerStructure('chamine-inhauma', zx + i * 14, zz - 16, 5, 5, by + 45);
      smoke.push({ x: zx + i * 14, y: by + 46, z: zz - 16 });
    }
    // tanques
    for (const [tx, tz] of [[zx - 44, zz + 10], [zx - 44, zz - 14]]) {
      const tank = new THREE.Mesh(new THREE.CylinderGeometry(9, 9, 16, 14), smat(0xc8ccce, { metalness: 0.3 }));
      tank.position.set(tx, by + 8, tz); g.add(tank);
      registerStructure('tanque-industrial-inhauma', tx, tz, 10, 10, by + 16);
    }
  }
  scene.add(g);
  return { group: g, smoke };
}

// ─── Florestas (árvores instanciadas em encostas de cota média) ───────────────
// Posições de árvore em coords de mundo — exposto para a nuke incendiar cenário (WS-5).
export const inhaumaTrees = [];

// Espécies de árvore (WS-3): geometrias/cores distintas por banda de altitude, cada uma
// um par de InstancedMesh (tronco+copa) com jitter de cor por instância. Copa usa base
// branca (lmat(0xffffff)) × instanceColor para a cor sair exata (padrão buildTown).
const TREE_SPECIES = [
  // key,       band,     trunk[rTop,rBot,h,seg]|null, trunkCol,  crown['cone'|'ico'|'sphere', ...args], crownCol,   sMin,sMax
  { key: 'pine',      band: [30, 70], trunk: [0.5, 0.8, 7, 5], trunkCol: 0x4a3520, crown: ['cone', 2.4, 11, 6], crownCol: 0x1f4d1c, sMin: 0.8, sMax: 1.6 },
  { key: 'broadleaf', band: [13, 42], trunk: [0.9, 1.2, 4, 6], trunkCol: 0x5b3f2a, crown: ['ico', 3.6],         crownCol: 0x3a7a2f, sMin: 0.8, sMax: 1.7 },
  { key: 'bush',      band: [7, 22],  trunk: null,             trunkCol: 0,        crown: ['sphere', 2.4, 7, 5], crownCol: 0x5a7a30, sMin: 0.7, sMax: 1.3 },
  { key: 'dry',       band: [16, 60], trunk: [0.5, 0.9, 6, 5], trunkCol: 0x6a5a3a, crown: ['cone', 2.4, 7, 6],  crownCol: 0x8a7a40, sMin: 0.7, sMax: 1.2 },
];

function makeCrownGeo(spec) {
  const c = spec.crown;
  if (c[0] === 'cone') return new THREE.ConeGeometry(c[1], c[2], c[3]);
  if (c[0] === 'ico') return new THREE.IcosahedronGeometry(c[1], 0);
  return new THREE.SphereGeometry(c[1], c[2], c[3]);
}

export function buildForests(scene) {
  inhaumaTrees.length = 0;
  const buckets = TREE_SPECIES.map(() => []);
  for (let i = 0; i < 1700; i++) {
    const range = TERR.chunkSize * 1.35;
    const x = game.rng.range(-range, range);
    const z = game.rng.range(-range, range);
    const h = inhaumaContinuousHeight(x, z);
    if (h < WATER_LEVEL + 3 || h > 70) continue;          // sem árvore na água/topo de rocha
    if (Math.abs(x + 560) < 360 && Math.abs(z - 320) < 360) continue; // longe do aeroporto
    if (Math.hypot(x, z) < 240) continue;                 // longe do centro urbano
    if (distToPolyline(x, z, RIVER) < RIVER_W + 10) continue;
    if (nearAnyRoad(x, z, 14)) continue;                  // sem árvore sobre a rodovia
    if (game.rng.random() > (h > 22 ? 0.85 : 0.35)) continue; // mais densa na mata alta
    // Escolhe espécie pela banda de altitude; ~12% viram árvore seca espalhada.
    const candidates = [];
    for (let s = 0; s < TREE_SPECIES.length; s++) {
      const [lo, hi] = TREE_SPECIES[s].band;
      if (h >= lo && h <= hi) candidates.push(s);
    }
    if (!candidates.length) continue;
    let si = candidates[Math.floor(game.rng.random() * candidates.length)];
    if (game.rng.random() < 0.12) si = 3; // dry
    const sc = game.rng.range(TREE_SPECIES[si].sMin, TREE_SPECIES[si].sMax);
    buckets[si].push({ x, y: h, z, s: sc });
    inhaumaTrees.push({ x, y: h, z });
  }
  const dummy = new THREE.Object3D();
  const col = new THREE.Color();
  const meshes = [];
  TREE_SPECIES.forEach((spec, si) => {
    const items = buckets[si];
    if (!items.length) return;
    const crownMesh = new THREE.InstancedMesh(makeCrownGeo(spec), lmat(0xffffff), items.length);
    crownMesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(items.length * 3), 3);
    crownMesh.frustumCulled = false; crownMesh.castShadow = false;
    let trunkMesh = null, trunkH = 0;
    if (spec.trunk) {
      trunkH = spec.trunk[2];
      trunkMesh = new THREE.InstancedMesh(new THREE.CylinderGeometry(spec.trunk[0], spec.trunk[1], spec.trunk[2], spec.trunk[3]), lmat(spec.trunkCol), items.length);
      trunkMesh.frustumCulled = false; trunkMesh.castShadow = false;
    }
    items.forEach((t, i) => {
      if (trunkMesh) {
        dummy.position.set(t.x, t.y + trunkH * 0.5 * t.s, t.z);
        dummy.scale.set(t.s, t.s, t.s); dummy.rotation.set(0, 0, 0);
        dummy.updateMatrix(); trunkMesh.setMatrixAt(i, dummy.matrix);
      }
      const crownY = t.y + (spec.trunk ? trunkH * 0.9 : spec.crown[1] * 0.7) * t.s;
      dummy.position.set(t.x, crownY, t.z);
      dummy.scale.set(t.s, t.s, t.s);
      dummy.rotation.set(0, (t.x * 0.7 + t.z * 0.3) % Math.PI, 0);
      dummy.updateMatrix(); crownMesh.setMatrixAt(i, dummy.matrix);
      // Jitter de luminância por instância — mata o look de "clone".
      col.setHex(spec.crownCol);
      const j = game.rng.range(0.82, 1.16);
      crownMesh.instanceColor.setXYZ(i, Math.min(1, col.r * j), Math.min(1, col.g * j), Math.min(1, col.b * j));
    });
    if (trunkMesh) { scene.add(trunkMesh); meshes.push(trunkMesh); }
    scene.add(crownMesh); meshes.push(crownMesh);
  });
  return meshes.length ? { meshes } : null;
}

// ─── Cidade (downtown + igreja + campos + praça) ─────────────────────────────
export function buildTown(scene) {
  const g = new THREE.Group();
  const dummy = new THREE.Object3D();
  // Quarteirões: prédios variados, mais altos no centro
  const blocks = [];
  for (let x = -240; x <= 240; x += 26) {
    for (let z = -240; z <= 240; z += 24) {
      const rr = Math.hypot(x, z);
      if (rr > 260) continue;
      if (Math.hypot(x - 20, z + 40) < 55) continue;  // igreja
      if (Math.abs(x + 170) < 70 && Math.abs(z + 90) < 55) continue; // campo
      if (nearAnyRoad(x, z, 12)) continue;                 // não construir sobre a rodovia
      if ((x * 7 + z * 13) % 5 === 0) continue;
      const downtown = rr < 110;
      const hgt = downtown ? 18 + (Math.abs(x * 5 + z * 3) % 26) : 7 + (Math.abs(x * 3 + z) % 8);
      const gh = inhaumaContinuousHeight(x, z);
      const w = 11 + Math.abs(x % 6);
      const d = 9 + Math.abs(z % 5);
      blocks.push({ x, z, gh, h: hgt, w, d, downtown });
      registerStructure('predio-inhauma', x, z, w / 2, d / 2, gh + hgt);
    }
  }
  const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), lmat(0xb9a98f), blocks.length);
  mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(blocks.length * 3), 3);
  mesh.frustumCulled = false;
  blocks.forEach((b, i) => {
    dummy.position.set(b.x, b.gh + b.h / 2, b.z);
    dummy.scale.set(b.w, b.h, b.d);
    dummy.rotation.set(0, ((b.x + b.z) % 9) * 0.05, 0);
    dummy.updateMatrix(); mesh.setMatrixAt(i, dummy.matrix);
    const c = b.downtown ? new THREE.Color(0x9fb0c2) : new THREE.Color(0xc89a72).offsetHSL(0, 0, (Math.abs(b.x) % 5) * 0.02);
    mesh.instanceColor.setXYZ(i, c.r, c.g, c.b);
  });
  mesh.castShadow = false; mesh.receiveShadow = true;
  g.add(mesh);

  // Igreja (corpo + torre + pináculo)
  const ghCh = inhaumaContinuousHeight(20, -40);
  const church = new THREE.Mesh(new THREE.BoxGeometry(32, 14, 46), lmat(0xece3c8));
  church.position.set(20, ghCh + 7, -40); g.add(church);
  registerStructure('igreja-inhauma', 20, -40, 16, 23, ghCh + 14);
  const tower = new THREE.Mesh(new THREE.BoxGeometry(12, 22, 12), lmat(0xe2d8b8));
  tower.position.set(20, ghCh + 11, -70); g.add(tower);
  registerStructure('torre-igreja-inhauma', 20, -70, 6, 6, ghCh + 29);
  const spire = new THREE.Mesh(new THREE.ConeGeometry(8, 14, 4), lmat(0xb04a30));
  spire.position.set(20, ghCh + 29, -70); spire.rotation.y = Math.PI / 4; g.add(spire);

  // Campos de futebol (gramado + linhas + gols)
  for (const [fx, fz] of [[-170, -90], [200, 140]]) {
    const fy = inhaumaContinuousHeight(fx, fz) + 0.3;
    const field = new THREE.Mesh(new THREE.PlaneGeometry(105, 68), lmat(0x2f8c3a));
    field.rotation.x = -Math.PI / 2; field.position.set(fx, fy, fz); g.add(field);
    for (const gx of [-50, 50]) {
      const goal = new THREE.Mesh(new THREE.BoxGeometry(2, 5, 14), lmat(0xffffff));
      goal.position.set(fx + gx, fy + 2.5, fz); g.add(goal);
    }
  }
  // Praça central
  const plazaY = inhaumaContinuousHeight(45, 40) + 0.25;
  const plaza = new THREE.Mesh(new THREE.PlaneGeometry(64, 52), lmat(0x6f8d62));
  plaza.rotation.x = -Math.PI / 2; plaza.position.set(45, plazaY, 40); g.add(plaza);

  scene.add(g);
  return g;
}

// ─── Update (água + carros + vapor/fumaça) ───────────────────────────────────
export function updateInhaumaScene(dt, refs, playerPos) {
  updateInfiniteTerrain(playerPos, refs.terrain);
  if (refs.water) updateWaterSurfaces(dt, _getSunData ? _getSunData().direction : undefined);
  if (refs.cars) {
    updateRoadTraffic(dt, refs.cars, inhaumaContinuousHeight);
    if (game.missionRealism?.inhaumaMap?.traffic) {
      game.missionRealism.inhaumaMap.traffic.active = refs.cars.diagnostics;
    }
  }
}
