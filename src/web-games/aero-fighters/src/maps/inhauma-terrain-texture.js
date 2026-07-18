// maps/inhauma-terrain-texture.js — Texturas procedurais (canvas) do terreno Inhaúma.
// Exporta: createInhaumaTerrainTextures.
// Para ajustar o grão/detalhe, edite TEX_SIZE/DETAIL_REPEAT e as frequências abaixo.
//
// T-V-11 (aero-fighters-inhauma-visual-uplift-v1): o terreno era vertex colors
// puros numa grade de 39 m/vértice — o look "domo pintado" (auditoria §2.2). Aqui:
// (a) textura de DETALHE tileable em escala de cinza (luminância neutra — modula,
// não recolore) usada como `map` no MeshLambertMaterial({vertexColors:true}) do
// terreno — Lambert multiplica map × vertexColors, matando o look flat a custo zero
// de vértices; (b) normal map barato derivado do MESMO campo de ruído, para relevo
// de perto. Geradas UMA vez no create do mapa (buildInhaumaTerrain) — NUNCA por
// rebuild de chunk (o budget de ~16 ms/chunk da fila amortizada fica intacto).
//
// Browser-only: usa <canvas> — o chamador (buildInhaumaTerrain) só invoca quando
// `document` existe (test:aero:sim roda buildInhaumaTerrain em Node sem DOM).
// Texturas procedurais canvas são permitidas (T-V-03, CONVENTIONS.md).

import * as THREE from '../../../../../vendor/three.module.min.js';
import { fbm2D } from './noise.js';

const TEX_SIZE = 256;
// Repetição por chunk de 2100 m: 2100/350 = 6 m por tile → 256 px ≈ 6 m (~23 mm/px,
// grão de grama/terra na faixa 4-8 m pedida). As UVs 0-1 da PlaneGeometry do chunk
// são escaladas por este repeat (RepeatWrapping).
const DETAIL_REPEAT = 350;
// Frequências do campo de ruído em unidades de pixel: ~44 px ≈ 1 m (manchas) e
// ~9 px ≈ 20 cm (grão fino). Coordenadas deslocadas para não correlacionar com os
// outros canais de ruído do mapa.
const FIELD = [
  { freq: 1 / 44, oct: 4, weight: 0.6, offX: 311000, offZ: -273000 },
  { freq: 1 / 9,  oct: 3, weight: 0.4, offX: -197000, offZ: 163000 },
];
const NORMAL_STRENGTH = 2.2; // ganho do gradiente → inclinação da normal

/** fbm2D tileable: blenda 4 cópias deslocadas de um tile pelos pesos do canto —
 *  as bordas casam perfeitamente sob RepeatWrapping. */
function tileableFbm(x, y, f) {
  const u = x / TEX_SIZE, v = y / TEX_SIZE;
  const a = fbm2D(x + f.offX, y + f.offZ, f);
  const b = fbm2D(x - TEX_SIZE + f.offX, y + f.offZ, f);
  const c = fbm2D(x + f.offX, y - TEX_SIZE + f.offZ, f);
  const d = fbm2D(x - TEX_SIZE + f.offX, y - TEX_SIZE + f.offZ, f);
  return a * (1 - u) * (1 - v) + b * u * (1 - v) + c * (1 - u) * v + d * u * v;
}

/** Campo de altura 256² (0..1) que alimenta as duas texturas. */
function buildHeightField() {
  const h = new Float32Array(TEX_SIZE * TEX_SIZE);
  for (let y = 0; y < TEX_SIZE; y++) {
    for (let x = 0; x < TEX_SIZE; x++) {
      let n = 0;
      for (const f of FIELD) n += tileableFbm(x, y, f) * f.weight;
      h[y * TEX_SIZE + x] = n;
    }
  }
  return h;
}

function makeCanvas() {
  const c = document.createElement('canvas');
  c.width = TEX_SIZE; c.height = TEX_SIZE;
  return c;
}

/** Detalhe em escala de cinza (r=g=b): luminância média ~0,9 — modula o vertex
 *  color sem recolorir nem clarear demais o terreno. */
function makeDetailTexture(field) {
  const c = makeCanvas();
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(TEX_SIZE, TEX_SIZE);
  for (let i = 0; i < field.length; i++) {
    const lum = Math.max(0, Math.min(1, 0.78 + 0.5 * (field[i] - 0.5)));
    const g = Math.round(lum * 255);
    img.data[i * 4] = g; img.data[i * 4 + 1] = g; img.data[i * 4 + 2] = g;
    img.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(DETAIL_REPEAT, DETAIL_REPEAT);
  tex.colorSpace = THREE.SRGBColorSpace; // albedo
  tex.anisotropy = 4;
  return tex;
}

/** Normal map derivado do mesmo campo (diferença central com wraparound — o campo
 *  é tileable, então as bordas casam). */
function makeNormalTexture(field) {
  const c = makeCanvas();
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(TEX_SIZE, TEX_SIZE);
  const at = (x, y) => field[((y + TEX_SIZE) % TEX_SIZE) * TEX_SIZE + ((x + TEX_SIZE) % TEX_SIZE)];
  for (let y = 0; y < TEX_SIZE; y++) {
    for (let x = 0; x < TEX_SIZE; x++) {
      const dx = (at(x + 1, y) - at(x - 1, y)) * NORMAL_STRENGTH;
      const dy = (at(x, y + 1) - at(x, y - 1)) * NORMAL_STRENGTH;
      const inv = 1 / Math.hypot(dx, dy, 1);
      const i = (y * TEX_SIZE + x) * 4;
      img.data[i] = Math.round((-dx * inv * 0.5 + 0.5) * 255);
      img.data[i + 1] = Math.round((-dy * inv * 0.5 + 0.5) * 255);
      img.data[i + 2] = Math.round((inv * 0.5 + 0.5) * 255);
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(DETAIL_REPEAT, DETAIL_REPEAT);
  tex.anisotropy = 4;
  return tex;
}

/** Gera { detailMap, normalMap } para o material do terreno. UMA chamada por
 *  create de mapa — custo único de ~256² amostras de ruído. */
export function createInhaumaTerrainTextures() {
  const field = buildHeightField();
  return { detailMap: makeDetailTexture(field), normalMap: makeNormalTexture(field) };
}
