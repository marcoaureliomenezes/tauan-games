#!/usr/bin/env node
// tools/bake-inhauma-dem.mjs — Bake offline: baixa + decodifica tiles Terrarium (AWS
// Terrain Tiles), converte para altura de jogo, e grava o asset vendorizado
// assets/inhauma-dem/{heightmap.u16, heightmap.json}. Roda SÓ em dev, nunca em runtime
// (nada aqui é importado por src/**). Sem dependências npm — só Node builtins.
//
// Para trocar região/escala: edite as constantes REGION abaixo e rode de novo:
//   node src/web-games/aero-fighters/tools/bake-inhauma-dem.mjs
// Determinístico: mesmas constantes + mesmos tiles da AWS => mesmo binário byte-a-byte
// (nenhum timestamp de wall-clock entra no heightmap.u16 ou no heightmap.json).

import { inflateSync } from 'node:zlib';
import https from 'node:https';
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

// ─── Região pinada (2026-07-14) ────────────────────────────────────────────────
// Vale em U estilo Chamonix (entre o maciço do Mont Blanc e a cadeia das Aiguilles
// Rouges) — "terreno acidentado" de verdade (relevo real, não FBM procedural).
// Verificado hoje: 49 tiles z13 (x 4249..4255, y 2913..2919) todos HTTP 200 na
// s3://elevation-tiles-prod (anônimo, licença attribution-only Tilezen/joerd).
const REGION = {
  name: 'Chamonix U-valley (Mont Blanc massif / Aiguilles Rouges chain)',
  centerLatLon: [45.923, 6.87], // vila de Chamonix — cai no meio do recorte
  zoom: 13,
  tileXRange: [4249, 4255], // 7 tiles de largura
  tileYRange: [2913, 2919], // 7 tiles de altura
};
const TILE_PX = 256;
const TILE_ENDPOINT = 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png';

// ─── Escala de jogo (2026-07-14, calibrada com os dados reais do recorte) ─────
// worldSize: lado do quadrado coberto pelo asset em metros de JOGO (quase 1:1 com os
// ~23.8 km reais dos 1792 px a ~13.29 m/px reais em z13/lat 46°).
// verticalScale + floorOffsetM: h_game = (h_real_m − baseRealElevationM) × verticalScale
//   + floorOffsetM. Calibrado para: piso do vale perto da origem ~6 m acima do nível
//   d'água do jogo (WATER_LEVEL=4.5), e picos do recorte em ~900–1300 m de jogo
//   (dramático mas abaixo do fog far=2600 / camera far=6000). Ver notas de bake mais
//   abaixo (medidas reais: min≈589 m, p50≈2142 m, p98≈3834 m, max≈4790 m).
const WORLD_SIZE = 20000;       // m de jogo (lado do quadrado)
const VERTICAL_SCALE = 0.34;    // adimensional — relevo real × este fator = relevo de jogo
const FLOOR_OFFSET_M = 6;       // m de jogo — altura de jogo no pixel de origem

const OUT_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'assets', 'inhauma-dem');

// ─── Fetch ──────────────────────────────────────────────────────────────────
function fetchBuffer(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      if (res.statusCode !== 200) { reject(new Error(`HTTP ${res.statusCode} fetching ${url}`)); return; }
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    }).on('error', reject);
  });
}

// ─── Decoder PNG mínimo (8-bit RGB, sem interlace) ────────────────────────────
// Os tiles Terrarium são PNG 256×256, colorType=2 (RGB), bitDepth=8, sem interlace,
// deflate padrão. Implementamos só o necessário (sem libs): parse de chunks IHDR/IDAT,
// node:zlib.inflateSync, e des-filtro por scanline (None/Sub/Up/Average/Paeth — spec PNG).
function paeth(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  if (pb <= pc) return b;
  return c;
}

function decodePNG(buf) {
  if (buf.length < 8 || buf.readUInt32BE(0) !== 0x89504e47) throw new Error('not a PNG');
  let pos = 8;
  let width = 0, height = 0, bitDepth = 0, colorType = 0, interlace = 0;
  const idatChunks = [];
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos);
    const type = buf.toString('ascii', pos + 4, pos + 8);
    const dataStart = pos + 8;
    if (type === 'IHDR') {
      width = buf.readUInt32BE(dataStart);
      height = buf.readUInt32BE(dataStart + 4);
      bitDepth = buf.readUInt8(dataStart + 8);
      colorType = buf.readUInt8(dataStart + 9);
      interlace = buf.readUInt8(dataStart + 12);
    } else if (type === 'IDAT') {
      idatChunks.push(buf.subarray(dataStart, dataStart + len));
    } else if (type === 'IEND') {
      break;
    }
    pos = dataStart + len + 4; // pula CRC
  }
  if (bitDepth !== 8 || colorType !== 2 || interlace !== 0) {
    throw new Error(`tile PNG inesperado: bitDepth=${bitDepth} colorType=${colorType} interlace=${interlace}`);
  }
  const raw = inflateSync(Buffer.concat(idatChunks));
  const bpp = 3; // RGB8
  const stride = width * bpp;
  const out = Buffer.alloc(height * stride);
  let rawPos = 0;
  for (let y = 0; y < height; y++) {
    const filterType = raw[rawPos]; rawPos += 1;
    const rowStart = y * stride;
    const prevRowStart = rowStart - stride;
    for (let x = 0; x < stride; x++) {
      const raw8 = raw[rawPos + x];
      const a = x >= bpp ? out[rowStart + x - bpp] : 0;
      const b = y > 0 ? out[prevRowStart + x] : 0;
      const c = (y > 0 && x >= bpp) ? out[prevRowStart + x - bpp] : 0;
      let value;
      switch (filterType) {
        case 0: value = raw8; break;
        case 1: value = raw8 + a; break;
        case 2: value = raw8 + b; break;
        case 3: value = raw8 + Math.floor((a + b) / 2); break;
        case 4: value = raw8 + paeth(a, b, c); break;
        default: throw new Error(`filtro PNG não suportado: ${filterType}`);
      }
      out[rowStart + x] = value & 0xff;
    }
    rawPos += stride;
  }
  return { width, height, data: out, bpp };
}

/** Terrarium: elevação (m) = R×256 + G + B/256 − 32768. */
function terrariumElevation(r, g, b) {
  return (r * 256 + g + b / 256) - 32768;
}

// ─── Matemática de tiles (Web Mercator) ───────────────────────────────────────
function lon2tileXf(lon, z) { return (lon + 180) / 360 * 2 ** z; }
function lat2tileYf(lat, z) {
  const latRad = lat * Math.PI / 180;
  return (1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2 * 2 ** z;
}

// ─── Pipeline principal ───────────────────────────────────────────────────────
async function stitchElevationGrid() {
  const [x0, x1] = REGION.tileXRange;
  const [y0, y1] = REGION.tileYRange;
  const tilesX = x1 - x0 + 1;
  const tilesY = y1 - y0 + 1;
  const gridW = tilesX * TILE_PX;
  const gridH = tilesY * TILE_PX;
  const elevReal = new Float32Array(gridW * gridH);

  for (let ty = y0; ty <= y1; ty++) {
    for (let tx = x0; tx <= x1; tx++) {
      const url = TILE_ENDPOINT.replace('{z}', REGION.zoom).replace('{x}', tx).replace('{y}', ty);
      const buf = await fetchBuffer(url);
      const { width, height, data, bpp } = decodePNG(buf);
      const ox = (tx - x0) * TILE_PX;
      const oy = (ty - y0) * TILE_PX;
      for (let py = 0; py < height; py++) {
        for (let px = 0; px < width; px++) {
          const i = (py * width + px) * bpp;
          elevReal[(oy + py) * gridW + (ox + px)] = terrariumElevation(data[i], data[i + 1], data[i + 2]);
        }
      }
      process.stderr.write('.');
    }
  }
  process.stderr.write('\n');
  return { gridW, gridH, elevReal };
}

function computeOriginPixel(gridW, gridH, x0, y0) {
  const fx = lon2tileXf(REGION.centerLatLon[1], REGION.zoom) - x0;
  const fy = lat2tileYf(REGION.centerLatLon[0], REGION.zoom) - y0;
  const px = Math.round(fx * TILE_PX);
  const py = Math.round(fy * TILE_PX);
  if (px < 0 || py < 0 || px >= gridW || py >= gridH) {
    throw new Error('origin pixel fora do grid — REGION.centerLatLon não cai no recorte de tiles');
  }
  return { px, py };
}

function quantizeToU16(gameHeights) {
  let minH = Infinity, maxH = -Infinity;
  for (const h of gameHeights) { if (h < minH) minH = h; if (h > maxH) maxH = h; }
  const range = maxH - minH || 1;
  const out = new Uint16Array(gameHeights.length);
  for (let i = 0; i < gameHeights.length; i++) {
    out[i] = Math.max(0, Math.min(65535, Math.round(((gameHeights[i] - minH) / range) * 65535)));
  }
  return { quantized: out, minH, maxH };
}

async function main() {
  const { gridW, gridH, elevReal } = await stitchElevationGrid();
  const [x0] = REGION.tileXRange;
  const [y0] = REGION.tileYRange;
  const origin = computeOriginPixel(gridW, gridH, x0, y0);
  const baseRealElevationM = elevReal[origin.py * gridW + origin.px];

  // h_game = (h_real - baseReal) * verticalScale + floorOffset. Não clampa em 0 aqui —
  // o clamp(≥0) é responsabilidade da cadeia de altura do jogo (inhauma-scene.js), que
  // já preserva esse contrato para a base FBM anterior.
  const gameHeights = new Float32Array(elevReal.length);
  for (let i = 0; i < elevReal.length; i++) {
    gameHeights[i] = (elevReal[i] - baseRealElevationM) * VERTICAL_SCALE + FLOOR_OFFSET_M;
  }

  const { quantized, minH, maxH } = quantizeToU16(gameHeights);

  mkdirSync(OUT_DIR, { recursive: true });
  const u16Path = path.join(OUT_DIR, 'heightmap.u16');
  const jsonPath = path.join(OUT_DIR, 'heightmap.json');

  const u16Buffer = Buffer.from(quantized.buffer, quantized.byteOffset, quantized.byteLength);
  writeFileSync(u16Path, u16Buffer);

  const gamePxSize = WORLD_SIZE / gridW;
  const metadata = {
    schemaVersion: 1,
    // Data fixa do bake pinado (2026-07-14) — NÃO usar new Date() aqui: o rebake deve
    // reproduzir o binário e o JSON byte-a-byte a partir das mesmas constantes.
    bakeDate: '2026-07-14T00:00:00Z',
    region: REGION,
    sourceTiles: {
      provider: 'AWS Terrain Tiles (Terrarium)',
      endpoint: TILE_ENDPOINT,
      zoom: REGION.zoom,
      xRange: REGION.tileXRange,
      yRange: REGION.tileYRange,
      tileCount: (REGION.tileXRange[1] - REGION.tileXRange[0] + 1) * (REGION.tileYRange[1] - REGION.tileYRange[0] + 1),
    },
    dims: { width: gridW, height: gridH },
    worldSize: WORLD_SIZE,
    gamePxSize,
    originPixel: origin,
    baseRealElevationM,
    verticalScale: VERTICAL_SCALE,
    floorOffsetM: FLOOR_OFFSET_M,
    heightRange: { min: minH, max: maxH },
    encoding: {
      format: 'uint16-le-raw',
      rowMajor: true,
      dequantizeFormula: 'min + (u16 / 65535) * (max - min)',
    },
    attribution: {
      text: 'Terrain data © Tilezen/joerd — AWS Terrain Tiles (Terrarium)',
      license: 'attribution-only (no restriction on use beyond credit)',
      url: 'https://github.com/tilezen/joerd/blob/master/docs/attribution.md',
    },
  };
  writeFileSync(jsonPath, JSON.stringify(metadata, null, 2) + '\n');

  console.log(`wrote ${u16Path} (${(u16Buffer.length / 1024 / 1024).toFixed(2)} MiB)`);
  console.log(`wrote ${jsonPath}`);
  console.log(`dims=${gridW}x${gridH} worldSize=${WORLD_SIZE} gamePxSize=${gamePxSize.toFixed(4)}`);
  console.log(`origin pixel=(${origin.px},${origin.py}) baseRealElevationM=${baseRealElevationM.toFixed(2)}`);
  console.log(`heightRange (game-m, pre-clamp) = [${minH.toFixed(2)}, ${maxH.toFixed(2)}]`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
