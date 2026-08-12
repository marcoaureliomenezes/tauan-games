// maps/inhauma-city.js — Tipologias e fachadas das cidades do mapa Inhauma
// (T-V-12/T-V-13, release v0.3.6): textura canvas de
// janelas com emissiveMap noturno, batches instanciados low-rise/mid-rise/torre com
// setback e telhados inclinados de 2 águas.
// T-C-04 (release v0.3.4): o PLACEMENT dos quarteirões
// virou o genérico buildTownCluster — UM caminho de código para Inhaúma (buildTown)
// e Cachoeira da Prata (buildCachoeira), ambos em inhauma-scene.js.
// Exporta: buildTownCluster (grade + keep-outs + terraceamento → blocks),
//   makeInhaumaTypology / makeCachoeiraTypology (tipologia por posição no distrito),
//   buildCityMeshes (grupo com os InstancedMesh da cidade) e
//   updateInhaumaCityLights (intensidade do emissive por time-of-day).
// Para adicionar uma tipologia nova, edite FACADE_SPECS e a typology callback que o
// caller passa a buildTownCluster.
// NOTA DE TAMANHO: o módulo passa do guideline de 250 linhas com a seção T-C-04
// (~330) — exceção tolerada no padrão de targets.js (~350, CONVENTIONS.md): a
// alternativa (dois módulos de cidade) quebraria o caminho único de placement.

import * as THREE from '../../../vendor/three.module.min.js';

// ─── Paletas por distrito (T-V-13) ───────────────────────────────────────────
// Extensão do esquema de 2 cores anterior (downtown azul-acinzentado 0x9fb0c2 /
// terracota 0xc89a72) para mini-paletas: a fachada canvas é quase branca e a cor
// sai do instanceColor (mesmo padrão das copas em buildForests).
const DOWNTOWN_PALETTE = [0x9fb0c2, 0x8ea2b6, 0xaebbc7, 0x9aa8ba, 0xb6c0ca];
const RESIDENTIAL_PALETTE = [0xc89a72, 0xd2a67e, 0xbb8f68, 0xcfc0a2, 0xc2947a];
const ROOF_PALETTE = [0xa8563a, 0x9c4f36, 0xb26040, 0x8f4a33]; // telhado terracota

// Escolha determinística por coordenada (NÃO usa game.rng — o consumo extra de
// sorteios mudaria a sequência de rng de florestas/tráfego em outros testes).
function hashPick(list, x, z) {
  return list[Math.abs((x * 7 + z * 13) | 0) % list.length];
}
function hashJitter(x, z, lo, hi) {
  const t = (Math.abs(Math.sin(x * 12.9898 + z * 78.233) * 43758.5453) % 1);
  return lo + (hi - lo) * t;
}

// ─── Textura canvas de fachada (T-V-12) ──────────────────────────────────────
// UMA textura por tipologia, gerada uma única vez na criação do mapa. Layout:
// grade regular de janelas com estado acesa/apagada por janela, linhas de piso
// sutis e variação de tinta; o canto superior-esquerdo (u<0.06, v>0.94) é um
// patch plano de "telhado" para onde as UVs das faces de topo/base do box são
// remapeadas (makeFacadeBoxGeometry) — assim a face de cima não mostra janelas.
const FACADE_SPECS = {
  low:   { rows: 2,  cols: 4, litRatio: 0.42 }, // 2-3 pavimentos
  mid:   { rows: 5,  cols: 6, litRatio: 0.35 }, // 4-8 pavimentos
  tower: { rows: 10, cols: 6, litRatio: 0.30 }, // 9+ pavimentos
};

// PRNG local (mulberry32) — textura idêntica a cada carga, sem tocar game.rng.
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Sorteia a grade de janelas UMA vez e desenha os dois canvases casados (difuso
// + emissive) — mesma posição de janela nos dois, senão a janela acesa "anda".
function makeFacadeTextures(kind, seed) {
  const spec = FACADE_SPECS[kind];
  const S = 256;
  const rand = mulberry32(seed);
  const wins = [];
  const mx = S * 0.10, my = S * 0.08;                 // margens da fachada
  const cw = (S - 2 * mx) / spec.cols, ch = (S - 2 * my) / spec.rows;
  for (let r = 0; r < spec.rows; r++) {
    for (let c = 0; c < spec.cols; c++) {
      wins.push({
        x: mx + c * cw + cw * 0.22, y: my + r * ch + ch * 0.20,
        w: cw * 0.56, h: ch * 0.58,
        lit: rand() < spec.litRatio, shade: rand(),
      });
    }
  }

  const mapCanvas = document.createElement('canvas');
  mapCanvas.width = mapCanvas.height = S;
  const ctx = mapCanvas.getContext('2d');
  ctx.fillStyle = '#e9e5dc'; ctx.fillRect(0, 0, S, S); // fachada clara (tinta vem do instanceColor)
  for (let r = 1; r < spec.rows; r++) {                // linhas de piso sutis
    ctx.fillStyle = 'rgba(90,84,74,0.18)';
    ctx.fillRect(mx * 0.4, my + r * ch - 1, S - mx * 0.8, 2);
  }
  ctx.fillStyle = 'rgba(70,64,56,0.35)';               // embasamento térreo mais escuro
  ctx.fillRect(0, S - my * 0.7, S, my * 0.7);
  for (const w of wins) {                              // janelas: vidro escuro, variação de reflexo
    const l = 0.16 + w.shade * 0.14;
    ctx.fillStyle = `rgb(${(l * 90) | 0},${(l * 110) | 0},${(l * 140) | 0})`;
    ctx.fillRect(w.x, w.y, w.w, w.h);
  }
  ctx.fillStyle = '#98938a'; ctx.fillRect(0, 0, 15, 15); // patch de telhado (ver UV remap)

  const emCanvas = document.createElement('canvas');
  emCanvas.width = emCanvas.height = S;
  const ectx = emCanvas.getContext('2d');
  ectx.fillStyle = '#000000'; ectx.fillRect(0, 0, S, S);
  for (const w of wins) {
    if (!w.lit) continue;                              // emissive: só janelas acesas (quente)
    const l = 0.75 + w.shade * 0.25;
    ectx.fillStyle = `rgb(${(255 * l) | 0},${(205 * l) | 0},${(140 * l) | 0})`;
    ectx.fillRect(w.x, w.y, w.w, w.h);
  }

  const map = new THREE.CanvasTexture(mapCanvas);
  map.colorSpace = THREE.SRGBColorSpace;
  const emissiveMap = new THREE.CanvasTexture(emCanvas);
  emissiveMap.colorSpace = THREE.SRGBColorSpace;
  return { map, emissiveMap };
}

// ─── Geometrias ──────────────────────────────────────────────────────────────
// Box unitário com as UVs das faces +y/-y (vértices 8-15 do BoxGeometry: py/ny)
// colapsadas no patch de telhado da textura — as 4 laterais mantêm a fachada.
function makeFacadeBoxGeometry() {
  const geo = new THREE.BoxGeometry(1, 1, 1);
  const uv = geo.attributes.uv;
  for (let i = 8; i < 16; i++) uv.setXY(i, 0.03, 0.97);
  uv.needsUpdate = true;
  return geo;
}

// Prisma triangular de 2 águas (T-V-13 telhado dos low-rise): cumeeira ao longo
// de X, seção com ápice em y=+0.5 e base em y=-0.5, z=±0.5. Sem face inferior
// (fica embutida no box do prédio). 6 tris.
function makeRoofPrismGeometry() {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array([
    -0.5, 0.5, 0,   0.5, 0.5, 0,      // 0,1 — cumeeira
    -0.5, -0.5, -0.5, 0.5, -0.5, -0.5, // 2,3 — base norte
    -0.5, -0.5, 0.5,  0.5, -0.5, 0.5,  // 4,5 — base sul
  ]), 3));
  g.setIndex([0, 1, 2, 1, 3, 2, 0, 4, 1, 1, 4, 5, 0, 2, 4, 1, 5, 3]);
  const flat = g.toNonIndexed();
  flat.computeVertexNormals();
  g.dispose();
  return flat;
}

// ─── Materiais / estado do emissive noturno ──────────────────────────────────
const _facadeMats = []; // materiais com emissiveMap — alimentados em buildCityMeshes

function makeFacadeMaterial(kind, seed) {
  const mat = new THREE.MeshLambertMaterial({ color: 0xffffff });
  if (typeof document !== 'undefined') { // Node (validate/sim): sem canvas, sem mapa
    const { map, emissiveMap } = makeFacadeTextures(kind, seed);
    mat.map = map;
    mat.emissiveMap = emissiveMap;
    mat.emissive = new THREE.Color(0xffc873);
    mat.emissiveIntensity = 0; // dia — updateInhaumaCityLights sobe à noite
  }
  _facadeMats.push(mat);
  return mat;
}

// ─── Construção dos batches (T-V-13) ─────────────────────────────────────────
// 4 InstancedMesh para a cidade inteira: low-rise (box) + telhados (prisma) +
// mid-rise (box) + torres (box, 2 instâncias empilhadas por torre = setback).
// Posições/rotações vêm de buildTown (grade/exclusões existentes — NÃO mover).
const TOWER_BASE_FRAC = 0.62;  // fração da altura no corpo inferior da torre
const TOWER_CAP_SCALE = 0.72;  // recuo do corpo superior (silhueta de setback)

function fillBoxBatch(mesh, list, colorOf, towerCap = false) {
  const dummy = new THREE.Object3D();
  const col = new THREE.Color();
  let i = 0;
  for (const b of list) {
    // T-N-03: charRefs = mapa bloco→instância para a carbonização do firestorm
    // (firestorm.js faz setColorAt preto nesses índices).
    if (!b.charRefs) b.charRefs = [];
    const rotY = ((b.x + b.z) % 9) * 0.05; // mesma micro-rotação da era 1-batch
    if (!towerCap) {
      dummy.position.set(b.x, b.gh + b.h / 2, b.z);
      dummy.scale.set(b.w, b.h, b.d);
      dummy.rotation.set(0, rotY, 0);
      dummy.updateMatrix(); mesh.setMatrixAt(i, dummy.matrix);
      col.setHex(colorOf(b)); mesh.setColorAt(i, col);
      b.charRefs.push({ mesh, index: i }); i++;
    } else {
      const baseH = b.h * TOWER_BASE_FRAC, capH = b.h - baseH;
      dummy.position.set(b.x, b.gh + baseH / 2, b.z);
      dummy.scale.set(b.w, baseH, b.d);
      dummy.rotation.set(0, rotY, 0);
      dummy.updateMatrix(); mesh.setMatrixAt(i, dummy.matrix);
      col.setHex(colorOf(b)); mesh.setColorAt(i, col);
      b.charRefs.push({ mesh, index: i }); i++;
      dummy.position.set(b.x, b.gh + baseH + capH / 2, b.z);
      dummy.scale.set(b.w * TOWER_CAP_SCALE, capH, b.d * TOWER_CAP_SCALE);
      dummy.updateMatrix(); mesh.setMatrixAt(i, dummy.matrix);
      col.setHex(colorOf(b)).multiplyScalar(1.06); mesh.setColorAt(i, col);
      b.charRefs.push({ mesh, index: i }); i++;
    }
  }
}

/** Monta o grupo da cidade (T-V-12/T-V-13). `blocks`: [{x,z,gh,h,w,d,downtown,kind}]
 *  com kind ∈ 'low'|'mid'|'tower' — atribuído por buildTown sem mover ninguém. */
export function buildCityMeshes(blocks) {
  const g = new THREE.Group();
  const low = blocks.filter((b) => b.kind === 'low');
  const mid = blocks.filter((b) => b.kind === 'mid');
  const tower = blocks.filter((b) => b.kind === 'tower');
  const boxGeo = makeFacadeBoxGeometry();

  const batches = [
    { list: low, kind: 'low', seed: 101, cap: false },
    { list: mid, kind: 'mid', seed: 202, cap: false },
    { list: tower, kind: 'tower', seed: 303, cap: true },
  ];
  for (const { list, kind, seed, cap } of batches) {
    if (!list.length) continue;
    const mesh = new THREE.InstancedMesh(boxGeo, makeFacadeMaterial(kind, seed), cap ? list.length * 2 : list.length);
    mesh.frustumCulled = false;
    mesh.castShadow = true;    // T-V-12: sombras da cidade acompanham o jato
    mesh.receiveShadow = true;
    const palette = kind === 'low' ? RESIDENTIAL_PALETTE : DOWNTOWN_PALETTE;
    fillBoxBatch(mesh, list, (b) => hashPick(palette, b.x, b.z), cap);
    g.add(mesh);
  }

  if (low.length) { // telhados inclinados sobre os low-rise (T-V-13)
    const roofs = new THREE.InstancedMesh(makeRoofPrismGeometry(), new THREE.MeshLambertMaterial({ color: 0xffffff }), low.length);
    roofs.frustumCulled = false; roofs.castShadow = true; roofs.receiveShadow = true;
    const dummy = new THREE.Object3D();
    const col = new THREE.Color();
    low.forEach((b, i) => {
      const alongX = b.w >= b.d; // cumeeira no eixo mais longo do footprint
      const roofH = Math.min(b.w, b.d) * 0.30 + 0.8;
      dummy.position.set(b.x, b.gh + b.h + roofH / 2 - 0.05, b.z);
      dummy.scale.set(alongX ? b.w * 1.06 : b.d * 1.06, roofH, (alongX ? b.d : b.w) * 1.08);
      dummy.rotation.set(0, (alongX ? 0 : Math.PI / 2) + ((b.x + b.z) % 9) * 0.05, 0);
      dummy.updateMatrix(); roofs.setMatrixAt(i, dummy.matrix);
      col.setHex(hashPick(ROOF_PALETTE, b.x, b.z)).multiplyScalar(hashJitter(b.x, b.z, 0.85, 1.1));
      roofs.setColorAt(i, col);
      b.charRefs.push({ mesh: roofs, index: i }); // T-N-03: telhado também carboniza
    });
    g.add(roofs);
  }
  return g;
}

// ─── Emissive noturno (T-V-12) ───────────────────────────────────────────────
// MESMA curva de sky.js#_nightFactor — duplicada de propósito: importar sky.js
// puxaria scene.js (toca window no escopo de módulo) e quebraria o Node
// (validate:aero-map / test:aero:sim). Se sky.js mudar a curva, sincronizar aqui.
function nightFactorAt(tod) {
  const s = (t) => { const k = Math.max(0, Math.min(1, t)); return k * k * (3 - 2 * k); };
  if (tod < 0.1) return 1;
  if (tod < 0.2) return 1 - s((tod - 0.1) / 0.1);
  if (tod < 0.8) return 0;
  if (tod < 0.9) return s((tod - 0.8) / 0.1);
  return 1;
}

/** Janelas acesas só à noite (T-V-12): emissiveIntensity ~0 de dia, ~0.9 à noite.
 *  Chamado por updateInhaumaScene a cada frame com game.timeOfDay. */
export function updateInhaumaCityLights(tod) {
  const k = nightFactorAt(typeof tod === 'number' ? tod : 0.35) * 0.9;
  for (const m of _facadeMats) if (m.emissiveMap) m.emissiveIntensity = k;
}

// ─── Placement genérico de quarteirões (T-C-04) ──────────────────────────────
// UM caminho de código para as duas cidades do mapa: buildTown (Inhaúma) e
// buildCachoeira (Cachoeira da Prata) chamam buildTownCluster com shelf/params
// próprios. A ordem das checagens (e o consumo de rng) reproduz EXATAMENTE o loop
// histórico de buildTown — a saída de Inhaúma é bit-a-bit a mesma de antes.
const SHELF_FLAT_SLOPE_MAX_DENSITY = 0.12; // abaixo disso, densidade máxima de quarteirão
const SHELF_MAX_SLOPE = 0.35;              // acima disso, nenhum quarteirão (afinando morro acima)
const TERRACE_CUT_M = 0.35; // m — quanto a base do quarteirão afunda abaixo da média dos 4 cantos

/** Base nivelada do terraceamento: média dos 4 cantos do footprint (w×d, AABB —
 *  mesma simplificação de registerStructure) levemente afundada (T-09). */
function terracedPadHeight(heightAt, x, z, w, d) {
  const hx = w / 2, hz = d / 2;
  const avg = (heightAt(x - hx, z - hz) + heightAt(x + hx, z - hz) +
    heightAt(x - hx, z + hz) + heightAt(x + hx, z + hz)) / 4;
  return avg - TERRACE_CUT_M;
}

/** Tipologia de Inhaúma (T-V-13): torres no núcleo do downtown, mid-rise no resto
 *  do downtown, low-rise com telhado na periferia. Hash por coordenada — sem rng. */
export function makeInhaumaTypology(center, radius) {
  return (x, z) => {
    const rr = Math.hypot(x - center.x, z - center.z);
    const downtown = rr < radius;
    if (downtown && rr < 110 && Math.abs(x * 5 + z * 3) % 3 === 0) {
      return { kind: 'tower', h: 30 + (Math.abs(x * 5 + z * 3) % 17), downtown };
    }
    if (downtown) return { kind: 'mid', h: 15 + (Math.abs(x * 5 + z * 3) % 12), downtown };
    return { kind: 'low', h: 6.5 + (Math.abs(x * 3 + z) % 5), downtown };
  };
}

/** Tipologia de Cachoeira da Prata (T-C-04): cidade menor — low-rise com telhado
 *  dominando, alguns mid-rise perto do centro, sem torres. */
export function makeCachoeiraTypology(center) {
  return (x, z) => {
    const rr = Math.hypot(x - center.x, z - center.z);
    const downtown = rr < 80;
    if (downtown && Math.abs(x * 5 + z * 3) % 4 === 0) {
      return { kind: 'mid', h: 12 + (Math.abs(x * 5 + z * 3) % 8), downtown };
    }
    return { kind: 'low', h: 6 + (Math.abs(x * 3 + z) % 5), downtown };
  };
}

/** Grade de quarteirões sobre um shelf com keep-outs duros. Retorna blocks
 *  [{x,z,gh,h,w,d,downtown,kind}] (formato de buildCityMeshes) e registra cada
 *  prédio via deps.registerStructure (colisão + fogo de nuke).
 *  deps = { rng, heightAt, slopeAt, nearRoad(x,z,m), riverDist(x,z),
 *           riverKeepOut, minH, registerStructure, structureId };
 *  circles = keep-outs circulares [{x,z,r}] (aeroporto, marcos); keepOut(x,z) =
 *  keep-out extra por callback (landmarks da cidade). */
export function buildTownCluster({ shelf, stepX, stepZ, typology, deps, circles = [], keepOut = null }) {
  const blocks = [];
  for (let x = shelf.minX; x <= shelf.maxX; x += stepX) {
    for (let z = shelf.minZ; z <= shelf.maxZ; z += stepZ) {
      if (circles.some((c) => Math.hypot(x - c.x, z - c.z) < c.r)) continue;
      if (keepOut && keepOut(x, z)) continue;
      if (deps.nearRoad(x, z, 12)) continue;                  // não construir sobre a rodovia
      if (deps.riverDist(x, z) < deps.riverKeepOut) continue; // não construir no canal/margem do rio
      if (deps.heightAt(x, z) < deps.minH) continue;          // terreno baixo/alagado demais
      const slope = deps.slopeAt(x, z);
      if (slope > SHELF_MAX_SLOPE) continue;                  // encosta íngreme demais p/ terracear
      if ((x * 7 + z * 13) % 5 === 0) continue;               // lotes vazios (variedade visual)
      // Afina a densidade conforme a inclinação sobe acima do patamar "prateleira plana".
      if (slope > SHELF_FLAT_SLOPE_MAX_DENSITY) {
        const thinT = (slope - SHELF_FLAT_SLOPE_MAX_DENSITY) / (SHELF_MAX_SLOPE - SHELF_FLAT_SLOPE_MAX_DENSITY);
        if (deps.rng.random() < thinT) continue;
      }
      const t = typology(x, z);
      const w = 11 + Math.abs(x % 6);
      const d = 9 + Math.abs(z % 5);
      const padY = terracedPadHeight(deps.heightAt, x, z, w, d);
      const block = { x, z, gh: padY, h: t.h, w, d, downtown: t.downtown, kind: t.kind };
      blocks.push(block);
      // T-N-03: o registro carrega a referência do bloco — buildCityMeshes anexa
      // nele os charRefs (mesh+índice de instância) usados pela carbonização.
      deps.registerStructure(deps.structureId, x, z, w / 2, d / 2, padY + t.h, { block });
    }
  }
  return blocks;
}
