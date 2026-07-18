// maps/inhauma-river.js — Rio de Inhaúma derivado da DRENAGEM do DEM real
// (aero-fighters-inhauma-serra-v1, T-05). Substitui o polyline autoral RIVER da era
// FBM (v0.2.0) por um traçado calculado a partir do heightmap-sampler (T-01/T-02):
// nenhuma coordenada de rio é digitada à mão — tudo deriva do `sampleDemHeight`.
//
// Pure-JS, Node-safe (sem THREE/DOM) — importável em Node (validate:aero-map,
// test:aero:sim/unit) e no browser. Determinístico: mesma entrada (o heightmap
// vendorizado) sempre produz a mesma polilinha — sem `Math.random`/RNG.
//
// Algoritmo (resumo — ver `traceInhaumaRiver` abaixo para o detalhe):
//   1. Delimita uma janela de busca em torno da origem (onde fica a cidade/aeroporto)
//      dentro de `demBounds()`.
//   2. Inunda (flood-fill 4-conexo) a partir da origem todas as células abaixo de um
//      teto de altura — a MÁSCARA do corredor de vale (a bacia de drenagem local).
//   3. Dentro da máscara, o ponto de MAIOR altitude é a "cabeceira" (extremidade alta
//      do eixo do vale) e o de MENOR altitude é a "foz" (para onde a água escoa).
//   4. Um caminho de MENOR CUSTO DE SUBIDA (Dijkstra 8-conexo, custo = distância +
//      penalidade forte por ganho de altitude) liga cabeceira → foz — aproxima bem o
//      caminho de "descida mais íngreme" de uma rota de drenagem real, sem ficar preso
//      em pequenas depressões locais (problema de um steepest-descent guloso ingênuo).
//   5. Um filtro final descarta qualquer ponto que subiria em relação ao anterior —
//      garante que a polilinha exportada é estritamente NÃO-CRESCENTE em altitude ao
//      longo do fluxo (cabeceira → foz), a prova de "segue a drenagem" pedida pelos
//      testes (T-05 acceptance).
//
// Exports:
//   getInhaumaRiverPolyline()   → [{x,z,h}, ...] (~50-150 pontos, cabeceira → foz)
//   distanceToRiver(x,z)        → menor distância (m) até a polilinha
//   riverBankHeightAt(x,z)      → altura NATURAL do DEM na margem mais próxima (sem
//                                  entalhe) — usado por T-06 para nivelar pontes.
//   riverCarveAt(x,z,height)    → altura entalhada (canal raso + margens suaves),
//                                  mesma convenção de `applyInhaumaRoadBed(x,z,h,fn)`.
//   riverWaterLevelAt(x,z)      → cota da lâmina d'água na margem mais próxima.
//   riverSurfaceInfoAt(x,z)     → {height,kind:'water'} dentro do canal molhado, ou
//                                  null fora dele — plugável em inhaumaStructureInfoAt.
//   RIVER_HALF_WIDTH_M, RIVER_BANK_BLEND_M, RIVER_CARVE_DEPTH_M — constantes de forma
//   (T-06 usa a polilinha + a meia-largura para achar cruzamentos rio×estrada).

import { sampleDemHeight, demBounds } from './heightmap-sampler.js';

// ─── Config (determinística — sem RNG) ────────────────────────────────────────
const SEARCH_RANGE_M = 5000;   // janela de busca em torno da origem (m de jogo)
const MASK_STEP_M = 80;        // resolução da grade de máscara/Dijkstra (m)
const VALLEY_CEILING_M = 190;  // teto de altitude que define o corredor de vale
const CLIMB_PENALTY = 200;     // custo extra por metro de SUBIDA (Dijkstra) — favorece
                                // fortemente descidas, evita escalar cristas locais.

const RIVER_HALF_WIDTH_M = 20;   // meia-largura do canal molhado (largura total 40 m,
                                  // dentro da faixa pedida de 30-60 m)
const RIVER_BANK_BLEND_M = 26;   // extensão da rampa de margem suave além do canal
const RIVER_CARVE_DEPTH_M = 3;   // profundidade do leito sob a margem natural (2-4 m)
const WATER_BELOW_BANK_M = 0.6;  // lâmina d'água fica um pouco abaixo da margem natural

const NEIGH8 = [
  [1, 0], [-1, 0], [0, 1], [0, -1],
  [1, 1], [1, -1], [-1, 1], [-1, -1],
];
const NEIGH8_DIST = [1, 1, 1, 1, Math.SQRT2, Math.SQRT2, Math.SQRT2, Math.SQRT2];

// Bucket-grid spatial index for `nearestOnRiver` — same pattern as
// `maps/inhauma-roads.js` (ROAD_INDEX_CELL/addSegmentToIndex/closestRoadSegment).
// Without it, `nearestOnRiver` is an O(segmentCount) linear scan called once PER
// VERTEX during terrain-chunk generation (~3025 vertices/chunk at TERR.seg=54) — with
// ~110 river segments that is ~330k point-to-segment distance checks per chunk
// rebuild, well past the "max 1 chunk rebuild per frame" budget. The index turns each
// query into a handful of segments in the query point's own cell + margin ring.
const RIVER_INDEX_CELL_M = 200; // m — bucket size (comfortably > influence radius)

// ─── Fila de prioridade mínima (heap binário simples, sem dependências) ───────
class MinHeap {
  constructor() { this._a = []; }
  get size() { return this._a.length; }
  push(item) {
    const a = this._a;
    a.push(item);
    let i = a.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (a[p][0] <= a[i][0]) break;
      [a[p], a[i]] = [a[i], a[p]];
      i = p;
    }
  }
  pop() {
    const a = this._a;
    const top = a[0];
    const last = a.pop();
    if (a.length) {
      a[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1, r = 2 * i + 2;
        let s = i;
        if (l < a.length && a[l][0] < a[s][0]) s = l;
        if (r < a.length && a[r][0] < a[s][0]) s = r;
        if (s === i) break;
        [a[s], a[i]] = [a[i], a[s]];
        i = s;
      }
    }
    return top;
  }
}

// ─── Grade auxiliar para a máscara do corredor de vale ────────────────────────
function buildValleyGrid() {
  const bounds = demBounds();
  const minX = Math.max(bounds.minX, -SEARCH_RANGE_M);
  const maxX = Math.min(bounds.maxX, SEARCH_RANGE_M);
  const minZ = Math.max(bounds.minZ, -SEARCH_RANGE_M);
  const maxZ = Math.min(bounds.maxZ, SEARCH_RANGE_M);
  const nxLo = Math.ceil(minX / MASK_STEP_M);
  const nxHi = Math.floor(maxX / MASK_STEP_M);
  const nzLo = Math.ceil(minZ / MASK_STEP_M);
  const nzHi = Math.floor(maxZ / MASK_STEP_M);
  const width = nxHi - nxLo + 1;
  const height = nzHi - nzLo + 1;
  return {
    nxLo, nxHi, nzLo, nzHi, width, height,
    key(ix, iz) { return (ix - nxLo) + (iz - nzLo) * width; },
    inBounds(ix, iz) { return ix >= nxLo && ix <= nxHi && iz >= nzLo && iz <= nzHi; },
    worldX(ix) { return ix * MASK_STEP_M; },
    worldZ(iz) { return iz * MASK_STEP_M; },
  };
}

/** Inunda (BFS 4-conexo) o corredor de vale abaixo de VALLEY_CEILING_M a partir da
 *  origem (a cidade/aeroporto ficam sempre no fundo do vale — T-01/T-02). */
function floodValleyMask(grid) {
  const visited = new Uint8Array(grid.width * grid.height); // 0 = não visto, 1 = no vale
  const originIx = 0, originIz = 0;
  if (!grid.inBounds(originIx, originIz)) {
    throw new Error('inhauma-river: DEM bounds do not contain the world origin');
  }
  visited[grid.key(originIx, originIz)] = 1;
  const stack = [[originIx, originIz]];
  while (stack.length) {
    const [ix, iz] = stack.pop();
    for (const [dx, dz] of NEIGH8.slice(0, 4)) {
      const nx = ix + dx, nz = iz + dz;
      if (!grid.inBounds(nx, nz)) continue;
      const k = grid.key(nx, nz);
      if (visited[k]) continue;
      const h = sampleDemHeight(grid.worldX(nx), grid.worldZ(nz));
      if (h < VALLEY_CEILING_M) {
        visited[k] = 1;
        stack.push([nx, nz]);
      } else {
        visited[k] = 2; // fora do corredor — marcado para não reavaliar
      }
    }
  }
  return visited;
}

/** Extremidades do eixo do vale: a célula mais ALTA da máscara é a cabeceira (nasce
 *  o rio), a mais BAIXA é a foz (para onde a drenagem escoa). Ambas ficam, por
 *  construção, na borda do corredor conectado — não dentro dele arbitrariamente. */
function findValleyAxisEnds(grid, mask) {
  let head = null, headH = -Infinity;
  let mouth = null, mouthH = Infinity;
  for (let iz = grid.nzLo; iz <= grid.nzHi; iz++) {
    for (let ix = grid.nxLo; ix <= grid.nxHi; ix++) {
      if (mask[grid.key(ix, iz)] !== 1) continue;
      const h = sampleDemHeight(grid.worldX(ix), grid.worldZ(iz));
      if (h > headH) { headH = h; head = { ix, iz, h }; }
      if (h < mouthH) { mouthH = h; mouth = { ix, iz, h }; }
    }
  }
  if (!head || !mouth) {
    throw new Error('inhauma-river: valley mask is empty — cannot locate river axis');
  }
  return { head, mouth };
}

/** Dijkstra 8-conexo restrito à máscara do vale, com custo = distância + subida ×
 *  CLIMB_PENALTY. Aproxima a rota de menor esforço de subida entre dois pontos —
 *  hidrologicamente, a água sempre acha o caminho de menor resistência morro abaixo;
 *  isso evita o "falso mínimo local" de um steepest-descent guloso de raio curto. */
function leastClimbPath(grid, mask, fromIx, fromIz, toIx, toIz) {
  const n = grid.width * grid.height;
  const dist = new Float64Array(n).fill(Infinity);
  const prev = new Int32Array(n).fill(-1);
  const done = new Uint8Array(n);
  const heap = new MinHeap();
  const fromKey = grid.key(fromIx, fromIz);
  dist[fromKey] = 0;
  heap.push([0, fromIx, fromIz]);
  const toKey = grid.key(toIx, toIz);
  while (heap.size) {
    const [d, ix, iz] = heap.pop();
    const k = grid.key(ix, iz);
    if (done[k]) continue;
    done[k] = 1;
    if (k === toKey) break;
    if (d > dist[k] + 1e-9) continue;
    const h0 = sampleDemHeight(grid.worldX(ix), grid.worldZ(iz));
    for (let i = 0; i < NEIGH8.length; i++) {
      const [dx, dz] = NEIGH8[i];
      const nx = ix + dx, nz = iz + dz;
      if (!grid.inBounds(nx, nz)) continue;
      const nk = grid.key(nx, nz);
      if (mask[nk] !== 1) continue;
      const h1 = sampleDemHeight(grid.worldX(nx), grid.worldZ(nz));
      const climb = Math.max(0, h1 - h0);
      const cost = NEIGH8_DIST[i] * MASK_STEP_M + climb * CLIMB_PENALTY;
      const nd = d + cost;
      if (nd < dist[nk]) {
        dist[nk] = nd;
        prev[nk] = k;
        heap.push([nd, nx, nz]);
      }
    }
  }
  if (!Number.isFinite(dist[toKey])) {
    throw new Error('inhauma-river: no connected path found between valley axis ends');
  }
  const path = [];
  let cur = toKey;
  while (cur !== -1) {
    const iz = Math.floor(cur / grid.width) + grid.nzLo;
    const ix = (cur - (iz - grid.nzLo) * grid.width) + grid.nxLo;
    path.push({ x: grid.worldX(ix), z: grid.worldZ(iz), h: sampleDemHeight(grid.worldX(ix), grid.worldZ(iz)) });
    cur = prev[cur];
  }
  path.reverse();
  return path;
}

/** Descarta qualquer ponto que subiria em relação ao último ponto mantido — garante
 *  uma sequência estritamente NÃO-CRESCENTE em altitude (o rio nunca "sobe"). Como o
 *  Dijkstra de menor-subida já produz um caminho quase monotônico, isso remove só as
 *  pequenas ondulações residuais do grid, sem distorcer o traçado geral. */
function enforceMonotonicDescent(points) {
  const out = [points[0]];
  for (let i = 1; i < points.length; i++) {
    if (points[i].h <= out[out.length - 1].h + 1e-6) out.push(points[i]);
  }
  return out;
}

/** Traça o rio de Inhaúma a partir do DEM. Determinístico — mesma entrada, mesma
 *  saída. Ver o resumo do algoritmo no cabeçalho do módulo. */
function traceInhaumaRiver() {
  const grid = buildValleyGrid();
  const mask = floodValleyMask(grid);
  const { head, mouth } = findValleyAxisEnds(grid, mask);
  const raw = leastClimbPath(grid, mask, head.ix, head.iz, mouth.ix, mouth.iz);
  const polyline = enforceMonotonicDescent(raw);
  if (polyline.length < 2) {
    throw new Error('inhauma-river: traced polyline is degenerate (< 2 points)');
  }
  return polyline;
}

let _polylineCache = null;

/** Polilinha do rio (cabeceira → foz), ~50-150 pontos, altura estritamente não-
 *  crescente ao longo do fluxo. Calculada uma vez e cacheada (chamada é barata depois
 *  disso — não recalcula a cada frame). */
export function getInhaumaRiverPolyline() {
  if (!_polylineCache) _polylineCache = traceInhaumaRiver();
  return _polylineCache;
}

// Margem de busca ao redor de cada segmento indexado — precisa cobrir a maior zona de
// influência que qualquer consumidor consulta (o entalhe some além de RIVER_HALF_WIDTH_M
// + RIVER_BANK_BLEND_M; adiciona folga para consumidores futuros como T-06).
const RIVER_INDEX_MARGIN_M = RIVER_HALF_WIDTH_M + RIVER_BANK_BLEND_M + 40;

let _segmentIndex = null; // Map<'cx,cz', segment[]>

function indexCellKey(cx, cz) { return `${cx},${cz}`; }
function indexCellCoord(v) { return Math.floor(v / RIVER_INDEX_CELL_M); }

function buildSegmentIndex() {
  if (_segmentIndex) return _segmentIndex;
  const poly = getInhaumaRiverPolyline();
  const index = new Map();
  for (let i = 0; i < poly.length - 1; i++) {
    const a = poly[i], b = poly[i + 1];
    const segment = { ax: a.x, az: a.z, bx: b.x, bz: b.z, ah: a.h, bh: b.h };
    const minX = Math.min(a.x, b.x) - RIVER_INDEX_MARGIN_M;
    const maxX = Math.max(a.x, b.x) + RIVER_INDEX_MARGIN_M;
    const minZ = Math.min(a.z, b.z) - RIVER_INDEX_MARGIN_M;
    const maxZ = Math.max(a.z, b.z) + RIVER_INDEX_MARGIN_M;
    for (let cx = indexCellCoord(minX); cx <= indexCellCoord(maxX); cx++) {
      for (let cz = indexCellCoord(minZ); cz <= indexCellCoord(maxZ); cz++) {
        const key = indexCellKey(cx, cz);
        let bucket = index.get(key);
        if (!bucket) { bucket = []; index.set(key, bucket); }
        bucket.push(segment);
      }
    }
  }
  _segmentIndex = index;
  return index;
}

/** Ponto mais próximo da polilinha a (x,z): distância + posição projetada + altura de
 *  margem (interpolada linearmente ao longo do segmento — sem THREE, matemática pura,
 *  mesmo padrão de `distToSegment`/`distToPolyline` em maps/noise.js). Usa o índice em
 *  grade (só examina segmentos cujo bounding box + margem toca a célula de (x,z)) —
 *  barato o bastante para rodar por vértice na geração de chunk de terreno. Devolve
 *  `null` quando (x,z) está fora do alcance indexado de qualquer segmento (bem além da
 *  zona de influência do rio) — os consumidores tratam isso como "longe do rio". */
function nearestOnRiver(x, z) {
  const index = buildSegmentIndex();
  const cx = indexCellCoord(x), cz = indexCellCoord(z);
  let best = null;
  for (let dcx = -1; dcx <= 1; dcx++) {
    for (let dcz = -1; dcz <= 1; dcz++) {
      const bucket = index.get(indexCellKey(cx + dcx, cz + dcz));
      if (!bucket) continue;
      for (const segment of bucket) {
        const dx = segment.bx - segment.ax, dz = segment.bz - segment.az;
        const len2 = dx * dx + dz * dz || 1;
        let t = ((x - segment.ax) * dx + (z - segment.az) * dz) / len2;
        t = Math.max(0, Math.min(1, t));
        const px = segment.ax + t * dx, pz = segment.az + t * dz;
        const distance = Math.hypot(x - px, z - pz);
        if (!best || distance < best.distance) {
          best = { distance, x: px, z: pz, bankHeight: segment.ah + (segment.bh - segment.ah) * t };
        }
      }
    }
  }
  return best;
}

/** Menor distância (m) de (x,z) até a polilinha do rio. */
export function distanceToRiver(x, z) {
  const info = nearestOnRiver(x, z);
  return info ? info.distance : Infinity;
}

/** Altura NATURAL do DEM (sem entalhe) na margem mais próxima — referência para T-06
 *  nivelar o tabuleiro da ponte no nível do terreno ao redor, não do leito escavado. */
export function riverBankHeightAt(x, z) {
  const info = nearestOnRiver(x, z);
  return info ? info.bankHeight : null;
}

/** Contribuição do rio para a cadeia de altura (mesma convenção de
 *  `applyInhaumaRoadBed(x,z,height,baseHeightAt)`): recebe a altura já calculada pelas
 *  camadas anteriores e devolve a altura entalhada — canal raso (2-4 m) com margens
 *  suaves (smoothstep), nunca um degrau abrupto. Fora da zona de influência devolve
 *  `height` inalterado (contribuição zero). */
export function riverCarveAt(x, z, height) {
  const info = nearestOnRiver(x, z);
  if (!info) return height;
  const influence = RIVER_HALF_WIDTH_M + RIVER_BANK_BLEND_M;
  if (info.distance >= influence) return height;
  const bedHeight = info.bankHeight - RIVER_CARVE_DEPTH_M;
  const insideT = info.distance <= RIVER_HALF_WIDTH_M
    ? 1
    : 1 - (info.distance - RIVER_HALF_WIDTH_M) / RIVER_BANK_BLEND_M;
  const k = insideT * insideT * (3 - 2 * insideT); // smoothstep — margens suaves
  return height * (1 - k) + bedHeight * k;
}

/** Cota da lâmina d'água na margem mais próxima — um pouco abaixo da margem natural,
 *  acima do leito escavado (o canal fica submerso o suficiente para "encher"). */
export function riverWaterLevelAt(x, z) {
  const info = nearestOnRiver(x, z);
  return info ? info.bankHeight - WATER_BELOW_BANK_M : null;
}

/** Verdade de superfície do rio, no formato plugável em `inhaumaStructureInfoAt`
 *  (mesmo contrato de `{height, kind}` que `world.js#surfaceInfoAt` espera). Só
 *  reporta 'water' DENTRO do canal molhado (não na rampa de margem) — voar contra o
 *  rio soa como água (splash/afundamento); fora do canal a superfície natural
 *  (terreno/estrutura) continua reportando normalmente. Retorna `null` fora do canal. */
export function riverSurfaceInfoAt(x, z) {
  const info = nearestOnRiver(x, z);
  if (!info || info.distance >= RIVER_HALF_WIDTH_M) return null;
  return { height: info.bankHeight - WATER_BELOW_BANK_M, kind: 'water' };
}

export { RIVER_HALF_WIDTH_M, RIVER_BANK_BLEND_M, RIVER_CARVE_DEPTH_M, WATER_BELOW_BANK_M };
