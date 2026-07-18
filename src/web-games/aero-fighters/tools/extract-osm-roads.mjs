// tools/extract-osm-roads.mjs — Conversor OFFLINE GeoJSON → corredores OSM vendorizados
// (aero-fighters-inhauma-visual-uplift-v1, T-V-16; auditoria §2.6 + SPEC: reimport
// seletivo APROVADO pelo operador — "limpo, não a teia").
//
// Lê o GeoJSON major-exportado pelo osmium (ver extract-osm-roads.sh — só
// highway=motorway/trunk/primary/secondary do inhauma-osm.pbf) e gera
// src/maps/inhauma-osm-roads.js com POUCOS corredores limpos, já em coordenadas de
// mundo do jogo. O jogo continua 100% offline em runtime (o dado é vendorizado).
//
// Projeção: origem/escala de src/maps/inhauma-data/projection.js, MAS com sinal de z
// INVERTIDO em relação ao rótulo "z=north" do metadata: verificado empiricamente
// contra o DEM (2026-07-18) que z = -(lat-origem)·LATM·worldScale é a convenção que
// assenta as vias no piso do vale (MG-060: altura média 18 m vs 252 m com o outro
// sinal). Em Three.js (x=leste, y=up, right-handed) +z aponta para o SUL — o eixo
// "north" do metadata é o rótulo do pipeline web de origem, não a convenção do mundo.
//
// Curadoria (qualidade > quantidade, cap de 12 estradas totais do contrato
// validate:aero-map — 4 autorais + até 8 OSM):
//   - MG-238 OSM é DESCARTADA: o corredor autoral mg-238 (com pista dupla T-V-16) já
//     a representa; importar a via real criaria um paralelo duplicado ~100-150 m ao
//     lado. Idem trechos trunk 'MG-238' puros.
//   - Mantidos os 8 corredores mais limpos e relevantes (ver KEEP abaixo).
//   - Vias < MIN_LENGTH_M após encadeamento são descartadas.
//   - Pontos dentro das zonas de exclusão do aeroporto (metadata.js) são REMOVIDOS e a
//     via é cortada em sub-trechos (só sobrevivem trechos ≥ MIN_LENGTH_M).
//   - O rio NÃO é critério de corte: cruzamentos rio×estrada dos corredores OSM ganham
//     ponte automaticamente em inhauma-bridges.js (T-V-16 estendeu a detecção, que já
//     era programática, para além dos corredores autorais). O conversor REPORTA a
//     distância mínima de cada corredor ao rio para curadoria.
//   - Simplificação Douglas-Peucker (tol SIMPLIFY_TOL_M) + redensificação ≤20 m —
//     respeita o contrato anti-spiderweb (<2000 pontos totais, segmentos <25-30 m).
//
// Uso (a partir de repos/tauan-games):
//   node --experimental-default-type=module src/web-games/aero-fighters/tools/extract-osm-roads.mjs \
//     <major.geojson> [saida.js]

import { readFileSync, writeFileSync } from 'node:fs';
import { INHAUMA_PROJECTION } from '../src/maps/inhauma-data/projection.js';
import { INHAUMA_WEB_MAP_METADATA } from '../src/maps/inhauma-data/metadata.js';
import { loadInhaumaDem } from '../src/maps/heightmap-sampler.js';
import { distanceToRiver } from '../src/maps/inhauma-river.js';

const MIN_LENGTH_M = 150;        // vias/sub-trechos menores que isso são descartados
const CHAIN_SNAP_M = 40;         // distância máx. entre pontas para encadear vias
const SIMPLIFY_TOL_M = 8;        // tolerância Douglas-Peucker (m)
const DENSIFY_STEP_M = 20;       // espaçamento máx. entre pontos do corredor final
const MAX_CORRIDORS = 8;         // 4 autorais + 8 OSM = 12 (teto do contrato Node)

// Corredores a manter (ref OSM → definição do corredor de jogo). kind/width seguem as
// classes do renderer existente (inhauma-road-render.js): highway/regional/street.
const KEEP = [
  { ref: 'BR-040;BR-135', id: 'osm-br-040', name: 'BR-040', kind: 'highway', width: 14 },
  { ref: 'MG-060', id: 'osm-mg-060', name: 'MG-060 (ramal sul)', kind: 'regional', width: 10 },
  { ref: 'MG-238;MG-424', id: 'osm-mg-424', name: 'MG-424', kind: 'regional', width: 10 },
  { ref: 'Avenida Prefeito Alberto Moura', id: 'osm-av-alberto-moura', name: 'Av. Alberto Moura', kind: 'regional', width: 10 },
  { ref: 'AMG-0375', id: 'osm-amg-0375', name: 'AMG-0375', kind: 'street', width: 8 },
  { ref: 'MG-231', id: 'osm-mg-231', name: 'MG-231', kind: 'street', width: 8 },
  { ref: 'AMG-0350', id: 'osm-amg-0350', name: 'AMG-0350', kind: 'street', width: 8 },
  { ref: 'AMG-0360', id: 'osm-amg-0360', name: 'AMG-0360 (ramal)', kind: 'street', width: 8 },
];

function project(lon, lat) {
  return {
    x: (lon - INHAUMA_PROJECTION.originLon) * INHAUMA_PROJECTION.lonMetersPerDegree * INHAUMA_PROJECTION.worldScale,
    z: -(lat - INHAUMA_PROJECTION.originLat) * INHAUMA_PROJECTION.latMetersPerDegree * INHAUMA_PROJECTION.worldScale,
  };
}

function lineLength(pts) {
  let total = 0;
  for (let i = 1; i < pts.length; i++) total += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].z - pts[i - 1].z);
  return total;
}

/** Encadeia vias de um mesmo ref: liga pontas próximas (≤ CHAIN_SNAP_M) numa
 *  polilinha contínua, orientando cada via no sentido que aproxima as pontas. Depois
 *  funde CADEIAS entre si iterativamente (rampas/trechos que só conectam depois de
 *  outra via ser absorvida). Por fim, detecta o "U" de via dupla mapeada como duas
 *  mãos one-way (a cadeia sai, dobra na ponta e volta paralela): corta no ponto de
 *  maior afastamento do início e fica com a metade mais longa — uma ÚNICA linha de
 *  centro por corredor, sem zigue-zague/hairpin. */
function chainWays(ways) {
  const chains = [];
  for (const way of ways) {
    let best = null;
    for (const chain of chains) {
      const cand = bestChainJoin(chain, way);
      if (cand && (!best || cand.d < best.d)) best = cand;
    }
    if (!best) { chains.push([...way]); continue; }
    joinInto(best.chain, way, best.how);
  }
  // Fusão iterativa de cadeias pelas pontas (até estabilizar).
  for (;;) {
    let merged = false;
    outer: for (let i = 0; i < chains.length; i++) {
      for (let j = i + 1; j < chains.length; j++) {
        const cand = bestChainJoin(chains[i], chains[j]);
        if (cand) {
          joinInto(chains[i], chains[j], cand.how);
          chains.splice(j, 1);
          merged = true;
          break outer;
        }
      }
    }
    if (!merged) break;
  }
  return chains
    .map(unfoldDualCarriageway)
    .sort((a, b) => lineLength(b) - lineLength(a));
}

function bestChainJoin(chain, way) {
  const ends = [
    { d: dist(way[0], chain[chain.length - 1]), how: 'append-fwd' },
    { d: dist(way[way.length - 1], chain[chain.length - 1]), how: 'append-rev' },
    { d: dist(way[way.length - 1], chain[0]), how: 'prepend-fwd' },
    { d: dist(way[0], chain[0]), how: 'prepend-rev' },
  ];
  let best = null;
  for (const e of ends) if (e.d <= CHAIN_SNAP_M && (!best || e.d < best.d)) best = { chain, ...e };
  return best;
}

function joinInto(chain, way, how) {
  const pts = how.endsWith('rev') ? [...way].reverse() : way;
  if (how.startsWith('append')) chain.push(...pts);
  else chain.unshift(...pts);
}

function dist(a, b) { return Math.hypot(a.x - b.x, a.z - b.z); }

/** Se a cadeia "vai e volta" (ponta final perto do início e comprimento muito maior
 *  que o alcance geográfico), é uma via dupla dobrada em U: corta no ponto mais
 *  distante do início e devolve a metade mais longa. */
function unfoldDualCarriageway(chain) {
  if (chain.length < 8) return chain;
  const total = lineLength(chain);
  const reach = dist(chain[0], chain[chain.length - 1]);
  if (reach > 200 || total < reach * 2.2) return chain;
  let maxD = 0, tip = 0;
  for (let i = 0; i < chain.length; i++) {
    const d = dist(chain[i], chain[0]);
    if (d > maxD) { maxD = d; tip = i; }
  }
  const a = chain.slice(0, tip + 1);
  const b = chain.slice(tip);
  return lineLength(a) >= lineLength(b) ? a : b;
}

/** Corta a polilinha removendo pontos "proibidos" (zona do aeroporto / rio) —
 *  devolve os sub-trechos contíguos ≥ 2 pontos. */
function splitAtForbidden(pts, isForbidden) {
  const out = [];
  let current = [];
  for (const p of pts) {
    if (isForbidden(p)) {
      if (current.length >= 2) out.push(current);
      current = [];
    } else {
      current.push(p);
    }
  }
  if (current.length >= 2) out.push(current);
  return out;
}

/** Douglas-Peucker clássico (tolerância em m). */
function simplify(pts, tol) {
  if (pts.length < 3) return pts;
  const keep = new Uint8Array(pts.length);
  keep[0] = keep[pts.length - 1] = 1;
  const stack = [[0, pts.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop();
    const dx = pts[b].x - pts[a].x, dz = pts[b].z - pts[a].z;
    const len = Math.hypot(dx, dz) || 1;
    let maxD = 0, maxI = -1;
    for (let i = a + 1; i < b; i++) {
      const d = Math.abs((pts[i].x - pts[a].x) * dz - (pts[i].z - pts[a].z) * dx) / len;
      if (d > maxD) { maxD = d; maxI = i; }
    }
    if (maxD > tol) { keep[maxI] = 1; stack.push([a, maxI], [maxI, b]); }
  }
  return pts.filter((_, i) => keep[i]);
}

/** Redensifica para segmentos ≤ DENSIFY_STEP_M (contrato: maxGap < 25-30 m). */
function densify(pts) {
  const out = [pts[0]];
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i];
    const len = Math.hypot(b.x - a.x, b.z - a.z);
    const steps = Math.max(1, Math.ceil(len / DENSIFY_STEP_M));
    for (let s = 1; s <= steps; s++) {
      out.push({
        x: Math.round((a.x + ((b.x - a.x) * s) / steps) * 10) / 10,
        z: Math.round((a.z + ((b.z - a.z) * s) / steps) * 10) / 10,
      });
    }
  }
  return out;
}

const inAirportZone = (p) => INHAUMA_WEB_MAP_METADATA.airportExclusionZones.some((zone) =>
  Math.abs(p.x - zone.cx) <= zone.halfW && Math.abs(p.z - zone.cz) <= zone.halfL);

async function main() {
  const [input, output = new URL('../src/maps/inhauma-osm-roads.js', import.meta.url).pathname] = process.argv.slice(2);
  if (!input) {
    console.error('uso: extract-osm-roads.mjs <major.geojson> [saida.js]');
    process.exit(1);
  }
  await loadInhaumaDem(); // necessário p/ distanceToRiver (drenagem do DEM)
  const fc = JSON.parse(readFileSync(input, 'utf8'));

  const byRef = new Map();
  for (const f of fc.features) {
    if (f.geometry?.type !== 'LineString') continue;
    const ref = f.properties?.ref || f.properties?.name;
    if (!ref) continue;
    const way = f.geometry.coordinates.map(([lon, lat]) => project(lon, lat));
    if (way.length >= 2) {
      if (!byRef.has(ref)) byRef.set(ref, []);
      byRef.get(ref).push(way);
    }
  }

  const corridors = [];
  const dropped = [];
  for (const spec of KEEP) {
    const ways = byRef.get(spec.ref);
    if (!ways?.length) { dropped.push(`${spec.ref}: ref ausente no extract`); continue; }
    const main = chainWays(ways)[0]; // cadeia mais longa (ver chainWays)
    const pieces = splitAtForbidden(main, inAirportZone);
    const usable = pieces.filter((pts) => lineLength(pts) >= MIN_LENGTH_M);
    if (!usable.length) { dropped.push(`${spec.ref}: todo trecho < ${MIN_LENGTH_M} m após cortes`); continue; }
    for (let i = 0; i < usable.length; i++) {
      const pts = densify(simplify(usable[i], SIMPLIFY_TOL_M));
      const minRiver = Math.min(...pts.map((p) => distanceToRiver(p.x, p.z)));
      corridors.push({
        id: usable.length > 1 ? `${spec.id}-${i + 1}` : spec.id,
        ref: spec.ref.split(';')[0],
        name: spec.name,
        kind: spec.kind,
        width: spec.width,
        length: Math.round(lineLength(pts)),
        minRiverM: Math.round(minRiver),
        points: pts,
      });
    }
  }
  // Teto de corredores (contrato Node: 4 autorais + até MAX_CORRIDORS OSM = 12 vias).
  // Empates resolvidos pelo mais comprido — qualidade/cobertura sobre quantidade.
  corridors.sort((a, b) => b.length - a.length);
  const kept = corridors.slice(0, MAX_CORRIDORS);
  for (const c of corridors.slice(MAX_CORRIDORS)) dropped.push(`${c.id}: acima do teto de ${MAX_CORRIDORS} corredores OSM`);

  const totalPoints = kept.reduce((sum, c) => sum + c.points.length, 0);
  console.log(`corredores: ${kept.length} (${totalPoints} pontos)`);
  for (const c of kept) console.log(`  ${c.id} [${c.kind}] ${c.length} m, ${c.points.length} pts, rio mín ${c.minRiverM} m`);
  if (dropped.length) console.log(`descartados: ${dropped.join('; ')}`);

  const banner = `// maps/inhauma-osm-roads.js — VENDORIZADO, GERADO OFFLINE (T-V-16,
// aero-fighters-inhauma-visual-uplift-v1) por tools/extract-osm-roads.mjs a partir de
// aero-fighters-v2/Content/World/inhauma-osm.pbf (sha256 ${INHAUMA_WEB_MAP_METADATA.inputSha256})
// via osmium tags-filter highway=motorway,trunk,primary,secondary + osmium export.
// NÃO EDITAR À MÃO — regerar com tools/extract-osm-roads.sh.
// Reimport seletivo APROVADO pelo operador na SPEC da release (auditoria §2.6):
// só corredores maiores, limpos e curados — não a teia de 2169 vias. Coordenadas já
// em mundo de jogo (projeção de inhauma-data/projection.js, z com sinal sul-positivo
// verificado contra o DEM — ver o cabeçalho do conversor). Pontos redondados a 0,1 m,
// segmentos ≤ ${DENSIFY_STEP_M} m, sem pontos nas zonas de exclusão do aeroporto;
// cruzamentos com o rio viram ponte em inhauma-bridges.js. MG-238 OSM omitida de
// propósito: o corredor autoral mg-238 (pista dupla, T-V-16) já a representa.
export const INHAUMA_OSM_MAJOR_CORRIDORS = `;
  const body = JSON.stringify(kept.map(({ length, minRiverM, ...c }) => c), null, 1)
    .replace(/\{\n\s+"x": ([\d.-]+),\n\s+"z": ([\d.-]+)\n\s+\}/g, '{ "x": $1, "z": $2 }');
  writeFileSync(output, `${banner}${body};\n`);
  console.log(`escrito: ${output}`);
}

await main();
