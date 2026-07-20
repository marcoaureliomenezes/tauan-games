// maps/heightmap-sampler.js — Sampler bilinear do DEM vendorizado de Inhaúma +
// continuação procedural do relevo além da borda do asset (T-V-10).
// Exporta: loadInhaumaDem, sampleDemHeight, demSlopeAt, demBounds.
// Para trocar a região/escala do asset, edite tools/bake-inhauma-dem.mjs e rebake —
// este módulo só LÊ o binário já pronto (zero side-effect no load, zero rede).
//
// Node-safe: nem `document`, nem `window`, nem `<canvas>`. Decodifica o MESMO binário
// (Uint16 LE row-major) da MESMA forma em Node (node:fs) e browser (fetch) — só a
// forma de OBTER os bytes muda; a leitura/interpolação é uma única função (R-5).

import { ridgedFbm2D, fbm2D } from './noise.js';

const ASSET_URL = new URL('../../assets/inhauma-dem/heightmap.json', import.meta.url);
const U16_URL = new URL('../../assets/inhauma-dem/heightmap.u16', import.meta.url);

const isNode = typeof process !== 'undefined' && !!process.versions?.node;

let _loadPromise = null;
let _state = null; // { meta, view: Uint16Array }

async function readJsonNode(url) {
  const { readFile } = await import('node:fs/promises');
  const { fileURLToPath } = await import('node:url');
  const text = await readFile(fileURLToPath(url), 'utf8');
  return JSON.parse(text);
}

async function readBinaryNode(url) {
  const { readFile } = await import('node:fs/promises');
  const { fileURLToPath } = await import('node:url');
  const buf = await readFile(fileURLToPath(url));
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
}

async function readJsonBrowser(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`heightmap-sampler: fetch ${url} -> HTTP ${res.status}`);
  return res.json();
}

async function readBinaryBrowser(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`heightmap-sampler: fetch ${url} -> HTTP ${res.status}`);
  return res.arrayBuffer();
}

/** Carrega (uma vez) o DEM vendorizado. Idempotente: chamadas repetidas reusam a
 *  mesma promise/estado — seguro chamar de vários pontos sem duplicar I/O. */
export function loadInhaumaDem() {
  if (_loadPromise) return _loadPromise;
  _loadPromise = (async () => {
    const [meta, arrayBuffer] = isNode
      ? await Promise.all([readJsonNode(ASSET_URL), readBinaryNode(U16_URL)])
      : await Promise.all([readJsonBrowser(ASSET_URL), readBinaryBrowser(U16_URL)]);
    const view = new Uint16Array(arrayBuffer);
    const expected = meta.dims.width * meta.dims.height;
    if (view.length !== expected) {
      throw new Error(`heightmap-sampler: heightmap.u16 has ${view.length} samples, expected ${expected}`);
    }
    _state = { meta, view };
    return _state;
  })();
  return _loadPromise;
}

function requireState() {
  if (!_state) {
    throw new Error('heightmap-sampler: sampleDemHeight/demSlopeAt/demBounds called before loadInhaumaDem() resolved');
  }
  return _state;
}

/** Dequantiza um valor Uint16 [0,65535] para altura de jogo (m), usando heightRange. */
function dequantize(meta, q) {
  const { min, max } = meta.heightRange;
  return min + (q / 65535) * (max - min);
}

/** Altura no pixel exato (px,py), sem interpolação. Fora do grid => null. */
function pixelHeight(state, px, py) {
  const { meta, view } = state;
  const { width, height } = meta.dims;
  if (px < 0 || py < 0 || px >= width || py >= height) return null;
  return dequantize(meta, view[py * width + px]);
}

/** Converte coordenadas de mundo (x,z) para coordenadas fracionárias de pixel do DEM. */
function worldToPixelF(meta, x, z) {
  const { px: ox, py: oy } = meta.originPixel;
  return { fx: ox + x / meta.gamePxSize, fy: oy + z / meta.gamePxSize };
}

/** Bilinear estrito dentro do grid (sem fallback de borda). null se fora. */
function bilinearInside(state, fx, fy) {
  const { meta } = state;
  const { width, height } = meta.dims;
  const x0 = Math.floor(fx), y0 = Math.floor(fy);
  if (x0 < 0 || y0 < 0 || x0 + 1 >= width || y0 + 1 >= height) return null;
  const tx = fx - x0, ty = fy - y0;
  const h00 = pixelHeight(state, x0, y0);
  const h10 = pixelHeight(state, x0 + 1, y0);
  const h01 = pixelHeight(state, x0, y0 + 1);
  const h11 = pixelHeight(state, x0 + 1, y0 + 1);
  const h0 = h00 + (h10 - h00) * tx;
  const h1 = h01 + (h11 - h01) * tx;
  return h0 + (h1 - h0) * ty;
}

/** Altura bilinear clampada na borda (amostra o pixel de borda mais próximo em vez de
 *  null) — usada como base do blend suave fora do asset. */
function bilinearClamped(state, fx, fy) {
  const { meta } = state;
  const { width, height } = meta.dims;
  const cx = Math.min(Math.max(fx, 0), width - 1 - 1e-6);
  const cy = Math.min(Math.max(fy, 0), height - 1 - 1e-6);
  return bilinearInside(state, cx, cy);
}

// T-V-10 (aero-fighters-inhauma-visual-uplift-v1): a versão anterior degradava o
// relevo fora do asset para um plano PLANO de 6 m ao longo de EDGE_BLEND_M — a
// "panqueca flutuante" na borda do mundo (shot 15 da auditoria). Agora o fallback é
// uma continuação ridged-FBM ancorada na cota da borda: serras/colinas procedurais
// que nascem do próprio perfil do DEM. REGRA DURA: dentro dos bounds o retorno é
// BIT-IDÊNTICO ao de sempre (bilinear puro, early return abaixo) — só o ramo fora
// dos bounds mudou. Determinismo: o ruído de noise.js é hash puro de (x,z) — sem
// RNG, sem seed de estado — então a mesma coordenada sempre devolve a mesma altura
// (colisão e malha visual continuam vendo a MESMA superfície).
const EDGE_BLEND_M = 800; // m de jogo — distância de transição além da borda
const CONT_RIDGE_AMP_M = 240; // amplitude das serras de continuação (λ ~2,6 km)
const CONT_HILL_AMP_M = 60;   // ondulação média (λ ~650 m) sobre a cota de base

function smoothstep(t) {
  return t * t * (3 - 2 * t);
}

/** Relevo procedural além do DEM: cota da borda como base + serras ridged-FBM.
 *  Coordenadas deslocadas para não correlacionar com nenhum outro uso de ruído do
 *  jogo (detalhe/cristas/neve/rocha de inhauma-scene.js). Piso em 2 m para nunca
 *  gerar cota negativa fora do asset. */
function continuationHeight(x, z, edgeHeight) {
  const ridge = ridgedFbm2D(x + 137000, z - 92000, { freq: 1 / 2600, oct: 4 });
  const hills = fbm2D(x - 46000, z + 71000, { freq: 1 / 650, oct: 3 });
  const h = edgeHeight + ridge * CONT_RIDGE_AMP_M + (hills - 0.5) * 2 * CONT_HILL_AMP_M;
  return Math.max(2, h);
}

/** Amostra bilinear a altura do DEM (m de jogo) em coords de mundo (x,z).
 *  Dentro dos bounds: bilinear puro (bit-idêntico, T-V-10). Além dos bounds: clampa
 *  no valor de borda e mistura suavemente para a continuação procedural ao longo de
 *  EDGE_BLEND_M (fim do plano de 6 m). */
export function sampleDemHeight(x, z) {
  const state = requireState();
  const { fx, fy } = worldToPixelF(state.meta, x, z);
  const inside = bilinearInside(state, fx, fy);
  if (inside !== null) return inside;

  const edgeHeight = bilinearClamped(state, fx, fy);
  const { width, height } = state.meta.dims;
  const overX = Math.max(0, -fx, fx - (width - 1));
  const overY = Math.max(0, -fy, fy - (height - 1));
  const overPx = Math.hypot(overX, overY);
  const overM = overPx * state.meta.gamePxSize;
  const t = smoothstep(Math.min(1, overM / EDGE_BLEND_M));
  return edgeHeight * (1 - t) + continuationHeight(x, z, edgeHeight) * t;
}

// Passo (m de jogo) para a diferença central do gradiente — pequeno o bastante para
// capturar relevo local, grande o bastante para não amplificar ruído de quantização
// (a resolução do grid é ~11 m/px; usamos ~1 pixel de passo).
function slopeStepMeters(meta) {
  return meta.gamePxSize;
}

/** Inclinação local (adimensional, |gradiente|) em (x,z) — diferença central. */
export function demSlopeAt(x, z) {
  const state = requireState();
  const step = slopeStepMeters(state.meta);
  const hxPlus = sampleDemHeight(x + step, z);
  const hxMinus = sampleDemHeight(x - step, z);
  const hzPlus = sampleDemHeight(x, z + step);
  const hzMinus = sampleDemHeight(x, z - step);
  const dhdx = (hxPlus - hxMinus) / (2 * step);
  const dhdz = (hzPlus - hzMinus) / (2 * step);
  return Math.hypot(dhdx, dhdz);
}

/** Bounds em coords de mundo do asset carregado: {minX,maxX,minZ,maxZ} (m de jogo). */
export function demBounds() {
  const { meta } = requireState();
  const { px: ox, py: oy } = meta.originPixel;
  const { width, height } = meta.dims;
  return {
    minX: (0 - ox) * meta.gamePxSize,
    maxX: (width - 1 - ox) * meta.gamePxSize,
    minZ: (0 - oy) * meta.gamePxSize,
    maxZ: (height - 1 - oy) * meta.gamePxSize,
  };
}
