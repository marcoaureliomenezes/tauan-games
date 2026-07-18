// maps/inhauma-bridges.js — Pontes de Inhaúma nos cruzamentos estrada×rio
// (aero-fighters-inhauma-serra-v1, T-06).
//
// Cruzamentos são DETECTADOS PROGRAMATICAMENTE a partir da geometria viva de estrada
// (inhauma-road-defs.js, T-04) e rio (inhauma-river.js, T-05) — nenhuma coordenada de
// ponte é digitada à mão. Se o traçado do rio ou os corredores mudarem num rebake/
// re-autoria futuros, os cruzamentos são recalculados automaticamente.
//
// Duas partes claramente separadas neste módulo (T-06 acceptance: "geometry math
// separated from THREE usage"):
//   1) MATEMÁTICA PURA (sem THREE, Node-safe): computeInhaumaBridgeCrossings,
//      bridgeDeckHeightAt, bridgeStructureFootprints — importáveis e testáveis em
//      Node puro (validate:aero-map / test:aero:sim), como o resto do pipeline de
//      terreno (heightmap-sampler.js, inhauma-river.js, inhauma-road-defs.js).
//   2) CONSTRUÇÃO DE CENA (consome THREE): buildInhaumaBridges — só é chamada em
//      runtime browser (via inhauma-scene.js#buildInhaumaTerrain). O import de THREE
//      em si não toca DOM (só chamadas de canvas/document tocariam, e nenhuma
//      acontece aqui) — mesmo padrão de inhauma-road-props.js/inhauma-road-render.js.
//
// Cadeia de altura (T-06 acceptance: "no road corridor dips below the water line at a
// crossing"): `bridgeDeckHeightAt(x,z,height)` é chamado por ÚLTIMO na cadeia de
// `inhaumaContinuousHeight` (depois do carve do rio e do leito de estrada) e SEGURA a
// altura no nível do tabuleiro perto de um cruzamento, usando a MESMA forma de
// smoothstep-por-distância-ao-rio que `riverCarveAt` (inhauma-river.js) — o blend
// desaparece exatamente onde o carve do rio também desaparece (distância ≥
// RIVER_HALF_WIDTH_M+RIVER_BANK_BLEND_M), então não há costura visível na borda da
// zona de influência (a mesma técnica que garante isso em riverCarveAt/
// applyInhaumaRoadBed). Um portão "ao longo da estrada" (halfLength, medido no
// referencial local do cruzamento) mantém o efeito restrito à vizinhança do
// cruzamento — sem isso, qualquer ponto a menos de ~46 m de QUALQUER trecho do rio
// (não só no cruzamento) seria puxado para a altura do tabuleiro, o que corromperia o
// entalhe do rio no resto do seu traçado.

import * as THREE from '../../../../../vendor/three.module.min.js';
import { INHAUMA_ROAD_CORRIDORS, sampleCorridor } from './inhauma-road-defs.js';
import { INHAUMA_OSM_MAJOR_CORRIDORS } from './inhauma-osm-roads.js';
import {
  distanceToRiver,
  riverBankHeightAt,
  riverWaterLevelAt,
  RIVER_HALF_WIDTH_M,
} from './inhauma-river.js';

// ─── Config (determinística — sem RNG) ────────────────────────────────────────
// Alcance (m) além do canal molhado onde o "puxão" para a altura do tabuleiro ainda
// tem algum efeito (decaindo suavemente a 0 na borda). DELIBERADAMENTE mais largo que
// o próprio RIVER_BANK_BLEND_M do entalhe do rio (inhauma-river.js) — a garantia de
// "nunca introduz costura" vem só do peso convergir suavemente a 0 numa distância
// finita (ver riverBlendWeight), não de casar com o alcance do entalhe do rio; um
// alcance mais largo aqui dá uma transição mais suave nas travessias em ângulo raso
// (a estrada fica perto do rio por mais tempo do que a largura do canal sozinha
// sugeriria — medido empiricamente no cruzamento da MG-238, T-06).
const BRIDGE_BANK_BLEND_M = 55;
const RIVER_INFLUENCE_M = RIVER_HALF_WIDTH_M + BRIDGE_BANK_BLEND_M;

const DECK_EMBED_MARGIN_M = 22;  // m — quanto o tabuleiro FÍSICO (malha+pilares) se
                                  // estende além da borda do canal molhado (âncora em
                                  // terra firme, fora d'água).
const GATE_PAD_M = 8;            // m — folga extra do "portão ao longo da estrada" além
                                  // do ponto onde o blend (RIVER_INFLUENCE_M) já é
                                  // recomputado ao vivo da geometria (evita flicker de
                                  // ponto flutuante bem na borda).
const DECK_ACROSS_MARGIN_M = 4;  // m — folga lateral do tabuleiro além da faixa de
                                  // rolamento (guarda-corpo/acostamento).
const DECK_CLEARANCE_M = 2.2;    // m — folga do tabuleiro acima da lâmina d'água local.
const HIGHWAY_SHOULDER_OFFSET_M = 0.35; // mesma convenção de applyInhaumaRoadBed
const REGIONAL_SHOULDER_OFFSET_M = 0.18; // (inhauma-roads.js) — não importado daqui
                                          // para não acoplar a este módulo; valores
                                          // espelhados deliberadamente (comentado lá).

const DECK_THICKNESS_M = 1.1;
const GUARDRAIL_HEIGHT_M = 1.1;
const GUARDRAIL_THICKNESS_M = 0.22;
const PIER_RADIUS_M = 1.5;
const PIER_SPACING_M = 20;       // m — espaçamento-alvo entre pilares instanciados
const PIER_EDGE_INSET_M = 8;     // m — recuo do 1º/último pilar em relação à ponta do tabuleiro
const PIER_EMBED_M = 1.5;        // m — quanto o pilar penetra no leito, abaixo do solo natural

function shoulderOffset(kind) {
  return kind === 'highway' ? HIGHWAY_SHOULDER_OFFSET_M : REGIONAL_SHOULDER_OFFSET_M;
}

function smoothstep(t) {
  return t * t * (3 - 2 * t);
}

/** Peso [0,1] do "puxão" para a altura do tabuleiro numa distância `d` (m) até o rio —
 *  MESMA forma de riverCarveAt: 1 dentro do canal molhado, decai suavemente até 0 na
 *  borda da zona de influência (RIVER_INFLUENCE_M). */
function riverBlendWeight(d) {
  if (d >= RIVER_INFLUENCE_M) return 0;
  const insideT = d <= RIVER_HALF_WIDTH_M ? 1 : 1 - (d - RIVER_HALF_WIDTH_M) / BRIDGE_BANK_BLEND_M;
  return smoothstep(insideT);
}

/** Reamostra um corredor e devolve os trechos contíguos ESTRITAMENTE dentro do canal
 *  molhado (distanceToRiver < RIVER_HALF_WIDTH_M) — o núcleo de cada cruzamento
 *  rio×estrada candidato a ponte. */
function findChannelSpans(points) {
  const spans = [];
  let current = null;
  for (let i = 0; i < points.length; i++) {
    const inside = distanceToRiver(points[i].x, points[i].z) < RIVER_HALF_WIDTH_M;
    if (inside && !current) current = { startIdx: i };
    if (!inside && current) { current.endIdx = i - 1; spans.push(current); current = null; }
  }
  if (current) { current.endIdx = points.length - 1; spans.push(current); }
  return spans;
}

/** Estende um trecho do canal, amostra por amostra, enquanto o rio ainda tem alguma
 *  influência (distanceToRiver < RIVER_INFLUENCE_M) — devolve os índices onde o
 *  "portão ao longo da estrada" deve terminar. Calculado ao vivo da geometria real
 *  (não um chute de margem fixa): cobre exatamente o alcance necessário mesmo numa
 *  travessia em ângulo raso, onde a estrada fica perto do rio por um trecho maior. */
function extendWhileInfluenced(points, span) {
  let lo = span.startIdx, hi = span.endIdx;
  while (lo > 0 && distanceToRiver(points[lo - 1].x, points[lo - 1].z) < RIVER_INFLUENCE_M) lo--;
  while (hi < points.length - 1 && distanceToRiver(points[hi + 1].x, points[hi + 1].z) < RIVER_INFLUENCE_M) hi++;
  return { lo, hi };
}

/** Cruzamentos rio×estrada de todos os corredores, com a geometria e a altura do
 *  tabuleiro já resolvidas. Puramente determinístico — recalculado sempre a partir da
 *  geometria viva de estrada (T-04) + rio (T-05); nada aqui é uma coordenada digitada
 *  à mão, então um rebake do DEM ou uma re-autoria de corredor recomputa os
 *  cruzamentos automaticamente. */
export function computeInhaumaBridgeCrossings() {
  const crossings = [];
  // T-V-16 (inhauma-visual-uplift-v1): os corredores OSM vendorizados também entram na
  // detecção — a polilinha deles já é densa (≤20 m, sem spline), então alimentam
  // diretamente o mesmo pipeline de findChannelSpans. Sem isso, um corredor OSM que
  // cruza o rio (BR-040, MG-060) afundaria no entalhe do canal sem tabuleiro.
  const sources = [
    ...INHAUMA_ROAD_CORRIDORS.map((c) => ({
      id: c.id, kind: c.kind, width: c.width, points: sampleCorridor(c.control, c.closed),
    })),
    ...INHAUMA_OSM_MAJOR_CORRIDORS.map((c) => ({
      id: c.id, kind: c.kind, width: c.width, points: c.points,
    })),
  ];
  for (const corridor of sources) {
    const points = corridor.points;
    const spans = findChannelSpans(points);
    spans.forEach((span, spanIndex) => {
      const a = points[span.startIdx];
      const b = points[span.endIdx];
      const channelLen = Math.hypot(b.x - a.x, b.z - a.z);
      if (channelLen < 1e-3) return; // toque degenerado de uma amostra só — ignora
      const heading = Math.atan2(b.x - a.x, b.z - a.z); // mesma convenção de `ang` (inhauma-road-utils)
      const midX = (a.x + b.x) / 2, midZ = (a.z + b.z) / 2;
      const halfLength = channelLen / 2 + DECK_EMBED_MARGIN_M;
      const halfWidth = corridor.width / 2 + DECK_ACROSS_MARGIN_M;

      // Portão "ao longo da estrada": estende até onde o rio ainda influencia a altura
      // (ao vivo da geometria, ver extendWhileInfluenced) + um pequeno colchão contra
      // flicker de ponto flutuante bem na borda.
      const { lo, hi } = extendWhileInfluenced(points, span);
      const gateHalfLength = Math.max(
        Math.hypot(points[lo].x - midX, points[lo].z - midZ),
        Math.hypot(points[hi].x - midX, points[hi].z - midZ),
        halfLength,
      ) + GATE_PAD_M;

      const bankA = riverBankHeightAt(a.x, a.z);
      const bankB = riverBankHeightAt(b.x, b.z);
      const offset = shoulderOffset(corridor.kind);
      const naturalDeckLevel = Math.max(bankA ?? 0, bankB ?? 0) - offset;
      const waterMid = riverWaterLevelAt(midX, midZ) ?? Math.max(riverWaterLevelAt(a.x, a.z) ?? 0, riverWaterLevelAt(b.x, b.z) ?? 0);
      const deckHeight = Math.max(naturalDeckLevel, waterMid + DECK_CLEARANCE_M);

      crossings.push({
        id: `${corridor.id}-bridge-${spanIndex}`,
        roadId: corridor.id,
        kind: corridor.kind,
        width: corridor.width,
        midX, midZ, heading,
        halfLength, gateHalfLength, halfWidth,
        deckHeight, waterLevel: waterMid,
      });
    });
  }
  return crossings;
}

let _crossingsCache = null;
function crossings() {
  if (!_crossingsCache) _crossingsCache = computeInhaumaBridgeCrossings();
  return _crossingsCache;
}

/** Projeta (x,z) no referencial LOCAL do cruzamento: `along` = ao longo do eixo da
 *  estrada (direção (sin(heading),cos(heading))), `across` = perpendicular. Mesma
 *  convenção de heading que `inhauma-road-utils.js#samplePolyline` (ang). */
function toLocal(c, x, z) {
  const dx = x - c.midX, dz = z - c.midZ;
  const s = Math.sin(c.heading), co = Math.cos(c.heading);
  const along = dx * s + dz * co;
  const across = dx * co - dz * s;
  return { along, across };
}

// Folga mínima (m) acima da lâmina d'água local, ponderada pelo MESMO peso do blend
// principal — um piso de segurança contra o caso em que o terreno natural (sem a
// ponte) já está muito perto da água bem na borda da zona de influência (travessias
// em ângulo raso, T-06): sem isso, um ponto poderia sobrar com só alguns centímetros
// de folga mesmo dentro da zona de influência. Ponderado por `weight` (não um piso
// fixo) para continuar convergindo a 0 exatamente onde o blend principal converge —
// não introduz costura nova.
const MIN_CLEARANCE_ABOVE_WATER_M = 2.4;

/** Cadeia de altura (T-06): recebe a altura já calculada pelas camadas anteriores
 *  (DEM + entalhe do rio + leito de estrada) e, perto de um cruzamento, SEGURA a
 *  altura em direção ao nível do tabuleiro — a MESMA forma de smoothstep de
 *  `riverCarveAt`, então nunca introduz uma costura (o peso já é 0 exatamente onde a
 *  influência também some, ver RIVER_INFLUENCE_M). Um portão "ao longo da estrada"
 *  (gateHalfLength, calculado ao vivo da geometria) restringe o efeito à vizinhança do
 *  cruzamento — sem ele, qualquer ponto perto de QUALQUER outro trecho do rio seria
 *  afetado. Fora de qualquer cruzamento devolve `height` inalterado. */
export function bridgeDeckHeightAt(x, z, height) {
  for (const c of crossings()) {
    const { along } = toLocal(c, x, z);
    if (Math.abs(along) >= c.gateHalfLength) continue;
    const weight = riverBlendWeight(distanceToRiver(x, z));
    if (weight <= 0) continue;
    let blended = height * (1 - weight) + c.deckHeight * weight;
    const localWater = riverWaterLevelAt(x, z) ?? c.waterLevel;
    const floor = localWater + weight * MIN_CLEARANCE_ABOVE_WATER_M;
    if (blended < floor) blended = floor;
    height = blended;
  }
  return height;
}

/** AABBs (alinhados ao mundo) do tabuleiro de cada ponte — mesma convenção de
 *  `registerStructure(id,x,z,halfX,halfZ,topY)` usada pelo resto do mapa (colisão via
 *  `inhaumaStructureInfoAt`). Conservador (caixa alinhada ao mundo cobrindo o
 *  retângulo orientado do tabuleiro) — o jogo não usa OBBs em lugar nenhum. */
export function bridgeStructureFootprints() {
  const out = [];
  for (const c of crossings()) {
    const s = Math.sin(c.heading), co = Math.cos(c.heading);
    let maxX = 0, maxZ = 0;
    for (const along of [c.halfLength, -c.halfLength]) {
      for (const across of [c.halfWidth, -c.halfWidth]) {
        maxX = Math.max(maxX, Math.abs(along * s + across * co));
        maxZ = Math.max(maxZ, Math.abs(along * co - across * s));
      }
    }
    out.push({ id: `${c.id}-deck`, x: c.midX, z: c.midZ, halfX: maxX, halfZ: maxZ, topY: c.deckHeight });
  }
  return out;
}

// ─── Construção de cena (consome THREE — só chamada em runtime browser) ──────────
const _mc = new Map();
function bmat(color, opts) {
  const key = color + JSON.stringify(opts || 0);
  if (!_mc.has(key)) _mc.set(key, new THREE.MeshLambertMaterial({ color, ...opts }));
  return _mc.get(key);
}

/** Constrói tabuleiro + guarda-corpo + pilares instanciados de todas as pontes e
 *  registra as AABBs de colisão via `registerStructure`. `naturalHeightAt(x,z)` deve
 *  ser a altura NATURAL do terreno (DEM + entalhe do rio, ANTES do leito de estrada e
 *  do próprio tabuleiro — tipicamente `inhaumaBaseHeight`) — os pilares descem até
 *  ela (o leito real do rio sob a ponte), nunca até o nível segurado do tabuleiro.
 *  Retorna `null` se não há cruzamento algum (nenhuma ponte a construir). */
export function buildInhaumaBridges(scene, registerStructure, naturalHeightAt) {
  const list = crossings();
  if (!list.length) return null;

  const group = new THREE.Group();
  group.name = 'inhauma-bridges';
  const dummy = new THREE.Object3D();

  // Tabuleiro (concreto) — 1 instância por cruzamento.
  const deckMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), bmat(0x6d6a60, { roughness: 0.9 }), list.length);
  deckMesh.castShadow = false; deckMesh.receiveShadow = true; deckMesh.frustumCulled = false;

  // Guarda-corpo — 2 instâncias (uma por lado) por cruzamento.
  const railMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), bmat(0xb9b6a3), list.length * 2);
  railMesh.castShadow = false; railMesh.frustumCulled = false;

  // Pilares — número variável por cruzamento (espaçados ao longo do tabuleiro).
  const pierSpecs = [];
  for (const c of list) {
    const length = c.halfLength * 2;
    const usable = Math.max(0, length - 2 * PIER_EDGE_INSET_M);
    const count = Math.max(2, Math.round(usable / PIER_SPACING_M) + 1);
    for (let p = 0; p < count; p++) {
      const t = count === 1 ? 0 : p / (count - 1) - 0.5; // -0.5..0.5
      const along = t * usable;
      const dx = along * Math.sin(c.heading), dz = along * Math.cos(c.heading);
      const px = c.midX + dx, pz = c.midZ + dz;
      const groundY = naturalHeightAt(px, pz) - PIER_EMBED_M;
      const deckBottomY = c.deckHeight - DECK_THICKNESS_M;
      pierSpecs.push({ x: px, z: pz, top: deckBottomY, bottom: Math.min(groundY, deckBottomY - 0.5) });
    }
  }
  const pierMesh = new THREE.InstancedMesh(new THREE.CylinderGeometry(1, 1, 1, 10), bmat(0x8d897c), pierSpecs.length);
  pierMesh.castShadow = false; pierMesh.receiveShadow = true; pierMesh.frustumCulled = false;

  list.forEach((c, i) => {
    const length = c.halfLength * 2;
    const width = c.halfWidth * 2;

    dummy.position.set(c.midX, c.deckHeight - DECK_THICKNESS_M / 2, c.midZ);
    dummy.rotation.set(0, c.heading, 0);
    dummy.scale.set(width, DECK_THICKNESS_M, length);
    dummy.updateMatrix();
    deckMesh.setMatrixAt(i, dummy.matrix);

    for (let side = 0; side < 2; side++) {
      const sign = side === 0 ? -1 : 1;
      const s = Math.sin(c.heading), co = Math.cos(c.heading);
      const railX = c.midX + sign * c.halfWidth * co;
      const railZ = c.midZ - sign * c.halfWidth * s;
      dummy.position.set(railX, c.deckHeight + GUARDRAIL_HEIGHT_M / 2, railZ);
      dummy.rotation.set(0, c.heading, 0);
      dummy.scale.set(GUARDRAIL_THICKNESS_M, GUARDRAIL_HEIGHT_M, length * 0.98);
      dummy.updateMatrix();
      railMesh.setMatrixAt(i * 2 + side, dummy.matrix);
    }

    const footprint = bridgeStructureFootprints()[i];
    registerStructure(footprint.id, footprint.x, footprint.z, footprint.halfX, footprint.halfZ, footprint.topY);
  });

  pierSpecs.forEach((p, i) => {
    const h = Math.max(0.5, p.top - p.bottom);
    dummy.position.set(p.x, p.bottom + h / 2, p.z);
    dummy.rotation.set(0, 0, 0);
    dummy.scale.set(PIER_RADIUS_M, h, PIER_RADIUS_M);
    dummy.updateMatrix();
    pierMesh.setMatrixAt(i, dummy.matrix);
  });

  group.add(deckMesh, railMesh, pierMesh);
  scene.add(group);
  return { group, deckMesh, railMesh, pierMesh, crossingCount: list.length, pierCount: pierSpecs.length };
}
