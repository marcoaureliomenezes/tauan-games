// formations/formation.js — controlador de formações militares da campanha Inhaúma
// (T-C-02, release v0.3.4). Path de estrada (polilinha
// densa, arc-length como inhauma-traffic) ou waypoints de terreno; offsets de
// coluna/linha/cunha; snap de altura + pitch pelo terreno; exclusões DURAS
// (retângulos + faixa do rio) validadas no SPAWN (clamp ou rejeição — nada por frame);
// rng 100% injetado (determinismo é contrato). Node-safe (sem DOM/scene).
// Exporta: FORMATION_TYPES, createFormation, updateFormations, registerAsTargets.
// deps = { rng, heightAt(x,z), exclusions[], riverPolyline[], riverHalfWidth }.
// Para adicionar tipo de formação: entrada em FORMATION_DEFS.
//
// RENDER (T-C-15, Onda 6): formações com >5 membros renderizam POR LOTE — uma
// InstancedMesh por TIPO de unidade na formação (geometria mesclada + material
// compartilhado de units.js#makeUnitInstanced, padrão inhauma-traffic). O membro
// continua com m.mesh (um proxy Object3D de coordenadas — o barramento de
// dano/homing/score/debug não muda) e a matriz da instância é escrita a cada
// frame pelo controlador; o wreck é a matriz congelada onde o membro caiu (kill
// por membro preservado). Formações ≤5 membros (e patrulhas aéreas, 1-4) seguem
// com makeUnit por membro — mais simples e baratas o bastante. Motivo: budget
// SPEC ≤450 draw calls — medido 644 calls em batalha real do Ato 1 com meshes
// por membro (cada unidade = 8-16 partes × ~50+ unidades vivas).

import * as THREE from '../../../vendor/three.module.min.js';
import { samplePolyline, routeLength } from '../maps/inhauma-road-utils.js';
import { makeUnit, makeUnitInstanced, unitStats, unitTargetType } from './units.js';
import { TARGET_STATS, ENEMY_FIRE } from '../config.js';
import { isAirborneState } from '../sortie-state.js';

const SAMPLE_STEP = 4;     // m entre amostras da validação de path
const MARGIN = 4;          // m de folga além da faixa proibida ao clampear
const MAX_PITCH = 0.32;    // rad — mesmo teto do tráfego (inhauma-traffic.js)

const cyc = (n, seq) => Array.from({ length: n }, (_, i) => seq[i % seq.length]);
const rep = (n, seq) => cyc(n, seq);

/** Catálogo de formações (SPEC §A). compose(n) → lista de unidades; moving=false →
 *  cluster estático em torno da âncora; deploys → para no fim do path (artilharia). */
const FORMATION_DEFS = {
  supplyConvoy:     { spacing: 16, moving: true,  compose: (n) => rep(n, ['truck']) },
  tankPlatoon:      { spacing: 18, moving: true,  compose: (n) => rep(n, ['tank']) },
  armoredColumn:    { spacing: 17, moving: true,  compose: (n) => cyc(n, ['tank', 'apc']) },
  troopColumn:      { spacing: 9,  moving: true,  compose: (n) => cyc(n, ['troops', 'troops', 'troops', 'troops', 'apc']) },
  mixedBattlegroup: { spacing: 15, moving: true,  compose: (n) => cyc(n, ['tank', 'apc', 'truck', 'troops']) },
  artilleryBattery: { spacing: 16, moving: true, deploys: true, compose: (n) => cyc(n, ['artillery', 'artillery', 'artillery', 'truck']) },
  encampment:       { spacing: 12, moving: false, compose: (n) => cyc(n, ['tank', 'apc', 'truck', 'troops']) },
  samSite:          { spacing: 14, moving: false, compose: (n) => [...rep(Math.max(1, Math.round(n / 3)), ['sam']), ...rep(n - Math.max(1, Math.round(n / 3)), ['aaGun'])] },
  aaNest:           { spacing: 10, moving: false, compose: (n) => rep(n, ['aaGun']) },
};
export const FORMATION_TYPES = Object.keys(FORMATION_DEFS);

// ─── Geometria pura de exclusões ──────────────────────────────────────────────
function normRect(e) {
  if (e.minX !== undefined) return e;
  return { minX: e.cx - e.halfW, maxX: e.cx + e.halfW, minZ: e.cz - e.halfL, maxZ: e.cz + e.halfL };
}

function segPointDist(ax, az, bx, bz, px, pz) {
  const dx = bx - ax, dz = bz - az;
  const len2 = dx * dx + dz * dz || 1;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / len2));
  return { d: Math.hypot(px - (ax + t * dx), pz - (az + t * dz)), x: ax + t * dx, z: az + t * dz };
}

/** Menor distância de (x,z) à polilinha + ponto mais próximo. */
export function nearestOnPolyline(poly, x, z) {
  let best = { d: Infinity, x: 0, z: 0 };
  for (let i = 1; i < poly.length; i++) {
    const a = poly[i - 1], b = poly[i];
    const c = segPointDist(a.x, a.z, b.x, b.z, x, z);
    if (c.d < best.d) best = c;
  }
  return best;
}

/** Interseção 2D entre segmentos (teste de orientação) — cruzamentos interiores têm
 *  distância ZERO, que a amostragem vértice↔projeção não enxerga (bug pego pelo T-C-02:
 *  path atravessando o rio no meio dos dois segmentos não era rejeitado). */
function segsCross(ax, az, bx, bz, cx, cz, dx, dz) {
  const o = (px, pz, qx, qz, rx, rz) => (qx - px) * (rz - pz) - (qz - pz) * (rx - px);
  const o1 = o(ax, az, bx, bz, cx, cz), o2 = o(ax, az, bx, bz, dx, dz);
  const o3 = o(cx, cz, dx, dz, ax, az), o4 = o(cx, cz, dx, dz, bx, bz);
  return (o1 * o2 < 0) && (o3 * o4 < 0);
}

/** Menor distância segmento↔polilinha (0 se cruzar; senão vértices + projeções cruzadas). */
function segPolylineDist(ax, az, bx, bz, poly) {
  let best = Infinity;
  for (let i = 1; i < poly.length; i++) {
    const c = poly[i - 1], d = poly[i];
    if (segsCross(ax, az, bx, bz, c.x, c.z, d.x, d.z)) return 0;
    best = Math.min(best,
      segPointDist(ax, az, bx, bz, c.x, c.z).d,
      segPointDist(ax, az, bx, bz, d.x, d.z).d,
      segPointDist(c.x, c.z, d.x, d.z, ax, az).d,
      segPointDist(c.x, c.z, d.x, d.z, bx, bz).d);
  }
  return best;
}

/** Dentro de uma zona de ponte? (cruzamentos estrada×rio legítimos — T-C-02: o deck
 *  passa SOBRE o rio, então o clamp/rejeição de rio é suspenso no raio da ponte). */
function inCrossing(x, z, crossings) {
  for (const c of crossings || []) {
    if (Math.hypot(x - c.x, z - c.z) <= (c.r ?? 30)) return true;
  }
  return false;
}

/** Empurra (x,z) para fora de toda exclusão (retângulos expandidos por swath+MARGIN
 *  e faixa do rio halfWidth+10+swath+MARGIN — salvo em zona de ponte).
 *  Retorna null se não conseguiu. */
function clampPoint(x, z, rects, river, band, swath, crossings) {
  for (let pass = 0; pass < 3; pass++) {
    let moved = false;
    for (const r of rects) {
      const pad = swath + MARGIN;
      if (x < r.minX - pad || x > r.maxX + pad || z < r.minZ - pad || z > r.maxZ + pad) continue;
      const exits = [
        { d: x - (r.minX - pad), x: r.minX - pad, z }, { d: (r.maxX + pad) - x, x: r.maxX + pad, z },
        { d: z - (r.minZ - pad), x, z: r.minZ - pad }, { d: (r.maxZ + pad) - z, x, z: r.maxZ + pad },
      ].sort((a, b) => a.d - b.d)[0];
      x = exits.x; z = exits.z; moved = true;
    }
    if (river && !inCrossing(x, z, crossings)) {
      const near = nearestOnPolyline(river, x, z);
      const need = band + swath + MARGIN;
      if (near.d < need) {
        const ux = near.d > 1e-6 ? (x - near.x) / near.d : 1;
        const uz = near.d > 1e-6 ? (z - near.z) / near.d : 0;
        x = near.x + ux * need; z = near.z + uz * need; moved = true;
      }
    }
    if (!moved) return { x, z };
  }
  return null;
}

/** Densifica o path a cada SAMPLE_STEP e valida/clampa contra as exclusões.
 *  Retorna a polilinha densa válida, ou null (path inválido — rejeitado no spawn). */
function validatePath(pts, rects, river, band, swath, crossings) {
  const total = routeLength(pts);
  const samples = [];
  // samplePolyline dá wrap (d % total — feita para tráfego em anel): a amostra final
  // é o ÚLTIMO PONTO real, nunca samplePolyline(total) (que voltaria ao início).
  for (let d = 0; d < total; d += SAMPLE_STEP) samples.push(samplePolyline(pts, d, total));
  samples.push({ x: pts[pts.length - 1].x, z: pts[pts.length - 1].z });
  for (let i = 0; i < samples.length; i++) {
    const fixed = clampPoint(samples[i].x, samples[i].z, rects, river, band, swath, crossings);
    if (!fixed) return null;
    samples[i] = { x: fixed.x, z: fixed.z };
  }
  // Um segmento entre amostras válidas não pode ATRAVESSAR a faixa do rio nem um
  // retângulo expandido (cruzar o rio = amostras em margens opostas → rejeita) —
  // EXCETO dentro da zona de uma ponte (cruzamento legítimo sobre o deck).
  for (let i = 1; i < samples.length; i++) {
    const a = samples[i - 1], b = samples[i];
    if (river && !inCrossing((a.x + b.x) / 2, (a.z + b.z) / 2, crossings)
        && segPolylineDist(a.x, a.z, b.x, b.z, river) < band + swath) return null;
    for (const r of rects) {
      const mx = (a.x + b.x) / 2, mz = (a.z + b.z) / 2;
      if (mx > r.minX - swath && mx < r.maxX + swath && mz > r.minZ - swath && mz < r.maxZ + swath) return null;
    }
  }
  return samples;
}

// ─── Offsets de formação ──────────────────────────────────────────────────────
function assignOffsets(f) {
  const s = f.def.spacing;
  const alive = f.members.filter((m) => m.alive);
  // 2026-08-11 (operador): 'block' — BLOCO de parada militar (grade ~quadrada,
  // fileiras de cols lado a lado). É o variant das formações da campanha.
  const cols = Math.max(1, Math.ceil(Math.sqrt(alive.length)));
  alive.forEach((m, i) => {
    if (f.variant === 'line') { m.offsetBack = 0; m.offsetSide = (i - (alive.length - 1) / 2) * s; }
    else if (f.variant === 'wedge') {
      const rank = Math.ceil(i / 2);
      m.offsetBack = rank * s; m.offsetSide = (i % 2 === 1 ? 1 : -1) * rank * s * 0.7;
    } else if (f.variant === 'block') {
      const row = Math.floor(i / cols), col = i % cols;
      // Última fileira pode ser incompleta — centra as colunas presentes nela.
      const inRow = Math.min(cols, alive.length - row * cols);
      m.offsetBack = row * s;
      m.offsetSide = (col - (inRow - 1) / 2) * s;
    } else { m.offsetBack = i * s; m.offsetSide = 0; } // coluna (default)
  });
  f.maxBack = alive.length ? Math.max(...alive.map((m) => m.offsetBack)) : 0;
  f.maxSide = alive.length ? Math.max(...alive.map((m) => Math.abs(m.offsetSide))) : 0;
}

const slowestSpeed = (f) => Math.min(...f.members.filter((m) => m.alive).map((m) => m.speed));

// ─── Render por lote (T-C-15 — ver header) ────────────────────────────────────
const _dummy = new THREE.Object3D(); // scratch compartilhado (padrão inhauma-traffic)

/** Cria os meshes dos membros: >5 membros → uma InstancedMesh por tipo de unidade
 *  (m.mesh vira proxy Object3D de coordenadas); ≤5 → makeUnit por membro. */
function buildMemberMeshes(f, units) {
  const useBatches = units.length > 5;
  const batches = new Map(); // unit → { inst, next }
  if (useBatches) {
    const counts = {};
    for (const u of units) counts[u] = (counts[u] || 0) + 1;
    for (const [u, count] of Object.entries(counts)) {
      const inst = makeUnitInstanced(u, count).mesh;
      inst.castShadow = true; inst.receiveShadow = true;
      inst.frustumCulled = false; // instâncias cobrem o path inteiro (padrão tráfego)
      f.group.add(inst);
      batches.set(u, { inst, next: 0 });
    }
  }
  f.members = units.map((unit, i) => {
    const stats = unitStats(unit);
    const b = batches.get(unit);
    const mesh = b ? new THREE.Object3D() : makeUnit(unit);
    if (!b) f.group.add(mesh);
    return {
      unit, index: i, mesh, alive: true, target: null,
      batch: b ? b.inst : null, batchIndex: b ? b.next++ : -1,
      speed: stats.speed, altitude: stats.altitude || 0,
      offsetBack: 0, offsetSide: 0, prevX: null, prevZ: null, prevY: null, pitch: 0,
      segHint: { i: 0 }, // cache de segmento da amostra incremental (sampleAt)
      pos: { x: 0, y: 0, z: 0 },
    };
  });
}

/** Escreve a matriz da instância do membro a partir do proxy (chamado após
 *  qualquer atualização de posição/rotação — spawn estático e placeMoving).
 *  Membro morto NUNCA é re-escrito pelo fluxo de formação: a matriz congela
 *  onde caiu (wreck). EXCEÇÃO deliberada: air-kills.js re-sincroniza membros
 *  AÉREOS mortos durante a animação de queda (via syncMemberMatrix). */
function syncBatch(m) {
  if (!m.batch) return;
  _dummy.position.copy(m.mesh.position);
  _dummy.rotation.copy(m.mesh.rotation);
  _dummy.scale.set(1, 1, 1);
  _dummy.updateMatrix();
  m.batch.setMatrixAt(m.batchIndex, _dummy.matrix);
  m.batch.instanceMatrix.needsUpdate = true;
}

/** Sincroniza a matriz instanciada de um membro a partir do proxy — API pública
 *  para o air-kills.js animar a QUEDA de membros aéreos batched (no-op para
 *  membros com mesh real). */
export function syncMemberMatrix(m) {
  syncBatch(m);
}

// ─── API ──────────────────────────────────────────────────────────────────────

/** Cria uma formação. `path` = polilinha [{x,z}|[x,z]...] (móvel) ou ponto-âncora
 *  (estática). Retorna null se o path violar as exclusões sem conserto (rejeição).
 *  `loop` (T-C-05): ao fim do path o progresso RETORNA ao início em vez de
 *  estacionar — para patrulhas em circuito feche o path (último ponto = primeiro). */
export function createFormation({ type, size = 5, path, variant = 'column', deps, id = null, loop = false }) {
  const def = FORMATION_DEFS[type];
  if (!def) throw new Error(`formation.js: tipo desconhecido '${type}'`);
  const n = Math.max(5, Math.min(25, Math.round(size)));
  const rects = (deps.exclusions || []).map(normRect);
  const river = deps.riverPolyline || null;
  const band = (deps.riverHalfWidth ?? 20) + 10;
  const pts = (Array.isArray(path) ? path : [path]).map((p) => (Array.isArray(p) ? { x: p[0], z: p[1] } : { x: p.x, z: p.z }));

  const f = {
    id: id || `${type}#${createFormation._seq = (createFormation._seq || 0) + 1}`,
    type, def, variant, deps,
    state: def.moving ? 'transit' : 'static',
    loop,
    progress: 0, speed: 0, maxBack: 0, maxSide: 0,
    points: null, pathLength: 0, cum: [], anchor: pts[0],
    group: new THREE.Group(), members: [],
  };
  f.group.name = `formation-${f.id}`;
  const units = def.compose(n);
  buildMemberMeshes(f, units); // T-C-15: >5 membros → InstancedMesh por tipo
  assignOffsets(f);
  f.speed = slowestSpeed(f);

  if (def.moving) {
    if (pts.length < 2) return null;
    const valid = validatePath(pts, rects, river, band, f.maxSide + 3, deps.riverCrossings);
    if (!valid) return null;
    f.points = valid;
    f.pathLength = routeLength(valid);
    f.cum = [0]; // comprimentos acumulados por vértice (amostra incremental)
    for (let i = 1; i < valid.length; i++) {
      f.cum.push(f.cum[i - 1] + Math.hypot(valid[i].x - valid[i - 1].x, valid[i].z - valid[i - 1].z));
    }
    f.pathLength = f.cum[f.cum.length - 1];
    f.progress = f.maxBack; // formação já nasce inteira sobre o path
    placeMoving(f);
  } else {
    // Cluster estático: anel de ângulo áureo com jitter seedado, validado por ponto.
    const placed = [];
    for (let i = 0; i < f.members.length; i++) {
      const r = def.spacing * (0.6 + 1.1 * Math.sqrt(i));
      const a = i * 2.399963 + deps.rng.range(-0.25, 0.25);
      const p = clampPoint(pts[0].x + Math.cos(a) * r, pts[0].z + Math.sin(a) * r, rects, river, band, 3, deps.riverCrossings);
      if (!p) return null;
      placed.push(p);
    }
    f.members.forEach((m, i) => {
      const y = deps.heightAt(placed[i].x, placed[i].z) + m.altitude;
      m.pos = { x: placed[i].x, y, z: placed[i].z };
      m.mesh.position.set(m.pos.x, y, m.pos.z);
      m.mesh.rotation.y = deps.rng.range(0, Math.PI * 2);
      syncBatch(m); // T-C-15: instância nasce na pose do cluster
    });
  }
  return f;
}

/** Amostra incremental: d (arc-length) é monotônico por membro (path aberto, progress
 *  só cresce), então o índice de segmento cacheado torna a amostra O(1) amortizada —
 *  samplePolyline puro rescanaria a polilinha inteira por membro por frame. */
function sampleAt(f, d, hint) {
  let i = hint.i;
  while (i < f.cum.length - 2 && f.cum[i + 1] < d) i++;
  hint.i = i;
  const a = f.points[i], b = f.points[i + 1];
  const segLen = f.cum[i + 1] - f.cum[i] || 1;
  const t = Math.max(0, Math.min(1, (d - f.cum[i]) / segLen));
  return { x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t, ang: Math.atan2(b.x - a.x, b.z - a.z) };
}

/** Posiciona os membros vivos ao longo do path (arc-length + offset lateral), com
 *  snap de altura em deps.heightAt e pitch pela inclinação percorrida (padrão
 *  pitchAlignedCars do inhauma-traffic: corpo alinhado à rampa real). */
function placeMoving(f) {
  for (const m of f.members) {
    if (!m.alive) continue;
    // d é clampado dentro do path — sem wrap (path aberto; samplePolyline daria wrap)
    const d = Math.max(0, Math.min(f.pathLength - 1e-4, f.progress - m.offsetBack));
    const s = sampleAt(f, d, m.segHint);
    const x = s.x + Math.cos(s.ang) * m.offsetSide;
    const z = s.z - Math.sin(s.ang) * m.offsetSide;
    const y = f.deps.heightAt(x, z) + m.altitude;
    if (m.prevX !== null) {
      const moved = Math.hypot(x - m.prevX, z - m.prevZ);
      if (moved > 0.05) m.pitch = Math.max(-MAX_PITCH, Math.min(MAX_PITCH, Math.atan2(y - m.prevY, moved)));
    }
    m.prevX = x; m.prevZ = z; m.prevY = y;
    m.pos = { x, y, z };
    m.mesh.position.set(x, y, z);
    m.mesh.rotation.set(m.pitch, s.ang, 0);
    syncBatch(m); // T-C-15: re-escreve a matriz da instância na nova pose
  }
}

/** Driver por frame: fecha fileiras quando membros morrem (wreck fica parado onde
 *  caiu) e avança formações móveis na velocidade do membro mais lento. */
export function updateFormations(dt, formations, deps) {
  for (const f of formations) {
    let died = false;
    for (const m of f.members) {
      if (m.alive && m.target && m.target.dead) { m.alive = false; died = true; }
    }
    if (died) { assignOffsets(f); f.speed = f.members.some((m) => m.alive) ? slowestSpeed(f) : 0; }
    if (!f.def.moving || f.state !== 'transit') continue;
    f.progress += f.speed * dt;
    if (f.progress >= f.pathLength + f.maxBack) {
      if (f.loop) {
        // T-C-05: patrulha em circuito — reinicia o ciclo (path fechado pelo caller).
        // Reseta o cache de segmento e o pitch (a amostra é monotônica por membro).
        f.progress -= f.pathLength;
        for (const m of f.members) { m.segHint.i = 0; m.prevX = m.prevY = m.prevZ = null; }
      } else {
        f.progress = f.pathLength + f.maxBack;
        f.state = f.def.deploys ? 'deployed' : 'arrived'; // artilharia posiciona e dispara (Onda 4)
      }
    }
    placeMoving(f);
  }
}

/** T-C-05 (JUSTIFICATIVA DA EXTENSÃO): patrulha AÉREA da guarnição de Cachoeira
 *  (zepelim + helicópteros sobre a cidade). Não dava para reusar createFormation:
 *  (1) FORMATION_DEFS é o catálogo de formações de CHÃO — valida o path contra as
 *      exclusões de solo, mas aeronaves em altitude SOBREVOAM cidade/rio de
 *      propósito (a patrulha é sobre a praça); validar daria clamp/rejeição
 *      espúria. Entrada nova no catálogo também quebraria o validador de Onda 1
 *      (test-aero-formations itera FORMATION_TYPES e exige membros fora das
 *      exclusões — correto para chão, errado para ar).
 *  (2) Tamanho livre 1-4 (o clamp de catálogo força 5-25) — a SPEC pede 1
 *      zepelim e 2 helicópteros.
 *  (3) Laço fechado infinito (loop sempre true; o caller fecha o path).
 *  Fora isso reusa TODA a mecânica (offsets, sampleAt, placeMoving, altura do
 *  stats, updateFormations, registerAsTargets). */
export function createAirPatrol({ unit, size = 1, path, deps, id = null }) {
  const n = Math.max(1, Math.min(4, Math.round(size)));
  const pts = (Array.isArray(path) ? path : [path]).map((p) => (Array.isArray(p) ? { x: p[0], z: p[1] } : { x: p.x, z: p.z }));
  if (pts.length < 3) return null;
  const def = { spacing: 26, moving: true }; // esteira aérea em coluna
  const f = {
    id: id || `airPatrol#${createFormation._seq = (createFormation._seq || 0) + 1}`,
    type: 'airPatrol', def, variant: 'column', deps,
    state: 'transit', loop: true,
    progress: 0, speed: 0, maxBack: 0, maxSide: 0,
    points: pts, pathLength: 0, cum: [0], anchor: pts[0],
    group: new THREE.Group(), members: [],
  };
  f.group.name = `formation-${f.id}`;
  for (let i = 0; i < n; i++) {
    const stats = unitStats(unit);
    const mesh = makeUnit(unit);
    f.group.add(mesh);
    f.members.push({
      unit, index: i, mesh, alive: true, target: null,
      speed: stats.speed, altitude: stats.altitude || 0,
      offsetBack: 0, offsetSide: 0, prevX: null, prevZ: null, prevY: null, pitch: 0,
      segHint: { i: 0 }, pos: { x: 0, y: 0, z: 0 },
    });
  }
  assignOffsets(f);
  f.speed = slowestSpeed(f);
  for (let i = 1; i < pts.length; i++) {
    f.cum.push(f.cum[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].z - pts[i - 1].z));
  }
  f.pathLength = f.cum[f.cum.length - 1];
  f.progress = f.maxBack; // patrulha já nasce inteira sobre o circuito
  placeMoving(f);
  return f;
}

/** Registra cada unidade em game.targets no formato exato do fluxo de dano de
 *  targets.js (damageTarget/killTarget leem type/hp/mesh/dead/score/dropChance/spawn*).
 *  O wreck permanece: killTarget chama scene.remove(t.mesh), que é no-op para meshes
 *  filhas de formation.group (não são filhas diretas da cena). */
export function registerAsTargets(formation, game) {
  const out = [];
  for (const m of formation.members) {
    const stats = unitStats(m.unit);
    const t = {
      type: unitTargetType(m.unit), mesh: m.mesh,
      hp: stats.hp, maxHp: stats.hp,
      score: stats.score, hr2: stats.hr2, dropChance: stats.dropChance,
      dead: false,
      fireTimer: 1.0 + game.rng.range(0, 2.0),
      fireInterval: stats.fireInterval,
      range: stats.range,
      path: null, pathIdx: 0,
      airborneAltitude: m.altitude,
      spawnX: m.pos.x, spawnY: m.pos.y, spawnZ: m.pos.z,
      formationId: formation.id, memberIndex: m.index,
      member: m, // referência viva — air-kills.js anima a queda de membros aéreos
    };
    m.target = t;
    game.targets.push(t);
    out.push(t);
  }
  return out;
}

// ─── Fogo inimigo no jogador (T-C-10, SPEC §D) ────────────────────────────────
// Modelo por distância (tabela em config.ENEMY_FIRE): AA 80% a <50 m decaindo ao
// piso 5%; unidades de chão 50% a <50 m, piso 3%. Roll HIT → mira DIRETA na
// posição atual do jato; roll MISS → offset angular seedado de 2-6° (tracers
// passam raspando). SEMPRE linha reta, lead factor 0 — velocidade desviável
// (80 m/s, aplicada pelo caller via spawnBullet opts). rng = game.rng (seedado).
// Node-safe: o disparo em si (mesh/áudio) chega pelo callback `fire` injetado.

/** Probabilidade de acerto por distância. cls: 'aa' | 'ground'. Monotônica não
 *  crescente, com platô pNear até NEAR_M e piso floor (ver ENEMY_FIRE). */
export function hitProbability(dist, cls) {
  const cfg = cls === 'aa' ? ENEMY_FIRE.AA : ENEMY_FIRE.GROUND;
  return Math.max(cfg.floor, Math.min(cfg.pNear, cfg.pNear - Math.max(0, dist / ENEMY_FIRE.NEAR_M - 1) * cfg.decay));
}

const _fireOrig = { x: 0, y: 0, z: 0 }; // scratches compartilhados — o caller
const _fireDir = { x: 0, y: 0, z: 0 };  // consome no próprio callback (sem clone)

/** Driver por frame do fogo de formação: itera game.targets com formationId
 *  (barramento único) e dispara via `fire(t, orig, dir, cls)` quando em range,
 *  com o jogador AIRBORNE. Chamado de updateTargets (targets.js) — mesmo tick
 *  das demais atualizações de alvo, sem relógio próprio. */
export function updateFormationFire(dt, game, jetPos, fire) {
  const airborne = game.missionRealism?.sortie
    ? isAirborneState(game.missionRealism.sortie.state)
    : jetPos.y > 12; // fallback Node (sem máquina de surtida)
  if (!airborne) return;
  for (const t of game.targets) {
    if (!t.formationId || t.dead || !(t.range > 0)) continue;
    const kind = TARGET_STATS[t.type]?.fire;
    const cls = kind === 'aa' || kind === 'missile' ? 'aa'
      : kind === 'cannon' || kind === 'mg' ? 'ground' : null;
    if (!cls) continue; // truck/artillery/zeppelin não engajam o jato
    const dx = jetPos.x - t.mesh.position.x;
    const dy = jetPos.y - t.mesh.position.y;
    const dz = jetPos.z - t.mesh.position.z;
    const dist = Math.hypot(dx, dy, dz);
    if (dist > t.range || dist < 1e-3) continue;
    t.fireTimer -= dt;
    if (t.fireTimer > 0) continue;
    t.fireTimer = t.fireInterval + game.rng.range(0, 0.5);
    let dvx = dx / dist, dvy = dy / dist, dvz = dz / dist;
    if (game.rng.random() >= hitProbability(dist, cls)) {
      // MISS seedado: gira a mira 2-6° num plano perpendicular qualquer.
      const a = ENEMY_FIRE.MISS_DEG[0] + game.rng.random() * (ENEMY_FIRE.MISS_DEG[1] - ENEMY_FIRE.MISS_DEG[0]);
      let px = -dvz, pz = dvx; // perpendicular horizontal à mira
      const pl = Math.hypot(px, pz);
      if (pl < 1e-4) { px = 1; pz = 0; } else { px /= pl; pz /= pl; }
      const tan = Math.tan((a * Math.PI) / 180) * (game.rng.random() < 0.5 ? -1 : 1);
      dvx += px * tan; dvy += (game.rng.random() - 0.5) * tan; dvz += pz * tan;
      const l = Math.hypot(dvx, dvy, dvz); dvx /= l; dvy /= l; dvz /= l;
    }
    const cfg = cls === 'aa' ? ENEMY_FIRE.AA : ENEMY_FIRE.GROUND;
    _fireOrig.x = t.mesh.position.x + dvx * 2;
    _fireOrig.y = t.mesh.position.y + cfg.muzzleY;
    _fireOrig.z = t.mesh.position.z + dvz * 2;
    _fireDir.x = dvx; _fireDir.y = dvy; _fireDir.z = dvz;
    fire(t, _fireOrig, _fireDir, cls);
  }
}
