// maps/inhauma-river-ribbon.js — Render do rio de Inhaúma como RIBBON CONTÍNUO ÚNICO
// (aero-fighters-inhauma-visual-uplift-v1, T-V-15; auditoria §2.5 — a "escada de fitas
// planas" de ~30 meshes separados virou 2 draw calls: 1 água + 1 margem).
//
// O TRAÇADO continua vindo de inhauma-river.js (drenagem do DEM, T-05) — este módulo
// só reconstrói a GEOMETRIA visual por cima da polilinha fina:
//   1. Suaviza a polilinha (Catmull-Rom centripetal da THREE sobre os pontos de
//      drenagem) e amostra seções a cada RIVER_RIBBON_STEP_M.
//   2. Nível d'água: cota local por seção (margem - WATER_BELOW_BANK_M), CLAMPADA
//      monotonicamente a montante→jusante — interpolação suave que mata as costuras
//      entre os antigos segmentos de 280 m sem o rio nunca "subir".
//   3. Largura variável por proxy de área de drenagem: estreita na cabeceira
//      (~RIVER_HEAD_WIDTH_M), alargando até a foz (~RIVER_MOUTH_WIDTH_M).
//   4. Segunda fita um pouco mais larga logo acima do leito entalhado (segue o terreno
//      via heightAt) como FAIXA DE MARGEM arenosa — a água lê como rio, não linha azul.
//   5. Espuma de margem: shader de fluxo compartilhado (environment/water-surface.js)
//      com uFoam=1 — gradiente de alpha branco nas bordas (uv.x), sem textura nova.
//
// Exporta buildInhaumaRiver(scene, heightAt) → { waters } (mesmo contrato do antigo
// buildInhaumaWater). Sem side-effects no load; o entalhe/colisão do rio
// (inhauma-river.js) NÃO muda — só geometria de render.

import * as THREE from '../../../vendor/three.module.min.js';
import { getInhaumaRiverPolyline, WATER_BELOW_BANK_M, RIVER_HALF_WIDTH_M } from './inhauma-river.js';
import { createFlowingWater } from '../environment/water-surface.js';

const RIVER_RIBBON_STEP_M = 12;  // m entre seções transversais do ribbon
const RIVER_HEAD_WIDTH_M = 14;   // largura total na cabeceira (proxy de drenagem)
const RIVER_MOUTH_WIDTH_M = 56;  // largura total na foz
const SHORE_EXTRA_M = 9;         // faixa de margem além da borda d'água (cada lado)
const SHORE_LIFT_M = 0.18;       // a margem flutua um pouco acima do leito entalhado

/** Curso suavizado do rio: [{x, z, level, halfWidth}] a cada RIVER_RIBBON_STEP_M,
 *  nível estritamente não-crescente a jusante, largura crescente (drenagem). */
function buildRiverCourse() {
  const polyline = getInhaumaRiverPolyline();
  const controls = polyline.map((p) => new THREE.Vector3(p.x, p.h - WATER_BELOW_BANK_M, p.z));
  const curve = new THREE.CatmullRomCurve3(controls, false, 'centripetal');
  const count = Math.max(8, Math.ceil(curve.getLength() / RIVER_RIBBON_STEP_M));
  const spaced = curve.getSpacedPoints(count);
  const course = [];
  for (let i = 0; i < spaced.length; i++) {
    const t = i / (spaced.length - 1);
    const prev = course[i - 1];
    // Catmull-Rom pode "overshootar" alguns centímetros — clamp mantém a descida
    // monotônica (o rio nunca sobe), eliminando as costuras entre seções.
    const level = prev ? Math.min(prev.level, spaced[i].y) : spaced[i].y;
    course.push({
      x: spaced[i].x,
      z: spaced[i].z,
      level,
      halfWidth: (RIVER_HEAD_WIDTH_M + (RIVER_MOUTH_WIDTH_M - RIVER_HEAD_WIDTH_M) * Math.pow(t, 0.8)) * 0.5,
    });
  }
  return course;
}

/** Fita da LÂMINA D'ÁGUA (2 vértices por seção, nivelada na cota local) — mesmo
 *  padrão de buildRibbonGeometry em inhauma-road-render.js. uv.x atravessa a fita
 *  (0→1) para o foam de margem do shader; uv.y rola ao longo do curso. */
function buildWaterRibbonGeometry(course) {
  const positions = [];
  const uvs = [];
  const indices = [];
  for (let i = 0; i < course.length; i++) {
    const prev = course[Math.max(0, i - 1)];
    const next = course[Math.min(course.length - 1, i + 1)];
    const dx = next.x - prev.x;
    const dz = next.z - prev.z;
    const len = Math.hypot(dx, dz) || 1;
    const nx = dz / len;
    const nz = -dx / len;
    const cur = course[i];
    positions.push(cur.x + nx * cur.halfWidth, cur.level, cur.z + nz * cur.halfWidth);
    positions.push(cur.x - nx * cur.halfWidth, cur.level, cur.z - nz * cur.halfWidth);
    uvs.push(0, i / 8, 1, i / 8);
    if (i > 0) {
      const a = (i - 1) * 2;
      const b = i * 2;
      indices.push(a, a + 1, b, a + 1, b + 1, b);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

/** Fita da FAIXA DE MARGEM (arenosa), mais larga que a água, seguindo o terreno
 *  entalhado (heightAt) — encosta nas bordas do canal e cobre o leito sob a água. */
function buildShoreRibbonGeometry(course, heightAt) {
  const positions = [];
  const indices = [];
  for (let i = 0; i < course.length; i++) {
    const prev = course[Math.max(0, i - 1)];
    const next = course[Math.min(course.length - 1, i + 1)];
    const dx = next.x - prev.x;
    const dz = next.z - prev.z;
    const len = Math.hypot(dx, dz) || 1;
    const nx = dz / len;
    const nz = -dx / len;
    // Largura por seção: água + faixa lateral, MAS nunca menos que o entalhe fixo do
    // rio (RIVER_HALF_WIDTH_M=20 m) + folga — a montante a água é mais estreita que a
    // trincheira entalhada, e a margem precisa cobrir o fundo/paredes dela (senão o
    // leito seco apareceria abaixo da borda da lâmina d'água).
    const half = Math.max(course[i].halfWidth + SHORE_EXTRA_M, RIVER_HALF_WIDTH_M + 7);
    const lx = course[i].x + nx * half, lz = course[i].z + nz * half;
    const rx = course[i].x - nx * half, rz = course[i].z - nz * half;
    positions.push(lx, heightAt(lx, lz) + SHORE_LIFT_M, lz);
    positions.push(rx, heightAt(rx, rz) + SHORE_LIFT_M, rz);
    if (i > 0) {
      const a = (i - 1) * 2;
      const b = i * 2;
      indices.push(a, a + 1, b, a + 1, b + 1, b);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

/** Rio completo: 1 mesh de água + 1 mesh de margem (2 draw calls para o rio inteiro).
 *  heightAt = inhaumaContinuousHeight (inclui o entalhe do rio). */
export function buildInhaumaRiver(scene, heightAt) {
  const course = buildRiverCourse();

  const shore = new THREE.Mesh(
    buildShoreRibbonGeometry(course, heightAt),
    new THREE.MeshLambertMaterial({
      color: 0x9c8d6b, // areia/lama de margem
      polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1,
    }),
  );
  shore.name = 'inhauma-river-shore';
  shore.receiveShadow = true;
  scene.add(shore);

  const water = createFlowingWater(buildWaterRibbonGeometry(course), {
    rotate: false, // ribbon já está em coordenadas de mundo (XZ, Y para cima)
    foam: 1,       // T-V-15: espuma de margem por alpha-gradiente (uv.x)
    color: 0x3d7fa3,
    deepColor: 0x16405c,
    flow: [0.012, 0.055],
    repeat: 5,
    opacity: 0.9,
  });
  water.name = 'inhauma-river-water';
  scene.add(water);

  return { waters: [water], shore };
}
