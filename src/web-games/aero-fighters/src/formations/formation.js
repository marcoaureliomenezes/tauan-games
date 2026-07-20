// formations/formation.js — controlador de formações militares da campanha Inhaúma
// (T-C-02, release aero-fighters-inhauma-campaign-v1). Path de estrada (polilinha
// densa, arc-length como inhauma-traffic) ou waypoints de terreno; offsets de
// coluna/linha/cunha; snap de altura + pitch pelo terreno; exclusões DURAS
// (retângulos + faixa do rio) validadas no SPAWN (clamp ou rejeição — nada por frame);
// rng 100% injetado (determinismo é contrato). Node-safe (sem DOM/scene).
// Exporta: FORMATION_TYPES, createFormation, updateFormations, registerAsTargets.
// deps = { rng, heightAt(x,z), exclusions[], riverPolyline[], riverHalfWidth }.
// Para adicionar tipo de formação: entrada em FORMATION_DEFS.

import * as THREE from '../../../vendor/three.module.min.js';
import { samplePolyline, routeLength } from '../maps/inhauma-road-utils.js';
import { makeUnit, unitStats, unitTargetType } from './units.js';

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

/** Menor distância segmento↔polilinha (amostrada nos vértices + projeções cruzadas). */
function segPolylineDist(ax, az, bx, bz, poly) {
  let best = Infinity;
  for (let i = 1; i < poly.length; i++) {
    const c = poly[i - 1], d = poly[i];
    best = Math.min(best,
      segPointDist(ax, az, bx, bz, c.x, c.z).d,
      segPointDist(ax, az, bx, bz, d.x, d.z).d,
      segPointDist(c.x, c.z, d.x, d.z, ax, az).d,
      segPointDist(c.x, c.z, d.x, d.z, bx, bz).d);
  }
  return best;
}

/** Empurra (x,z) para fora de toda exclusão (retângulos expandidos por swath+MARGIN
 *  e faixa do rio halfWidth+10+swath+MARGIN). Retorna null se não conseguiu. */
function clampPoint(x, z, rects, river, band, swath) {
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
    if (river) {
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
function validatePath(pts, rects, river, band, swath) {
  const total = routeLength(pts);
  const samples = [];
  // samplePolyline dá wrap (d % total — feita para tráfego em anel): a amostra final
  // é o ÚLTIMO PONTO real, nunca samplePolyline(total) (que voltaria ao início).
  for (let d = 0; d < total; d += SAMPLE_STEP) samples.push(samplePolyline(pts, d, total));
  samples.push({ x: pts[pts.length - 1].x, z: pts[pts.length - 1].z });
  for (let i = 0; i < samples.length; i++) {
    const fixed = clampPoint(samples[i].x, samples[i].z, rects, river, band, swath);
    if (!fixed) return null;
    samples[i] = { x: fixed.x, z: fixed.z };
  }
  // Um segmento entre amostras válidas não pode ATRAVESSAR a faixa do rio nem um
  // retângulo expandido (cruzar o rio = amostras em margens opostas → rejeita).
  for (let i = 1; i < samples.length; i++) {
    const a = samples[i - 1], b = samples[i];
    if (river && segPolylineDist(a.x, a.z, b.x, b.z, river) < band + swath) return null;
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
  alive.forEach((m, i) => {
    if (f.variant === 'line') { m.offsetBack = 0; m.offsetSide = (i - (alive.length - 1) / 2) * s; }
    else if (f.variant === 'wedge') {
      const rank = Math.ceil(i / 2);
      m.offsetBack = rank * s; m.offsetSide = (i % 2 === 1 ? 1 : -1) * rank * s * 0.7;
    } else { m.offsetBack = i * s; m.offsetSide = 0; } // coluna (default)
  });
  f.maxBack = alive.length ? Math.max(...alive.map((m) => m.offsetBack)) : 0;
  f.maxSide = alive.length ? Math.max(...alive.map((m) => Math.abs(m.offsetSide))) : 0;
}

const slowestSpeed = (f) => Math.min(...f.members.filter((m) => m.alive).map((m) => m.speed));

// ─── API ──────────────────────────────────────────────────────────────────────

/** Cria uma formação. `path` = polilinha [{x,z}|[x,z]...] (móvel) ou ponto-âncora
 *  (estática). Retorna null se o path violar as exclusões sem conserto (rejeição). */
export function createFormation({ type, size = 5, path, variant = 'column', deps, id = null }) {
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
    progress: 0, speed: 0, maxBack: 0, maxSide: 0,
    points: null, pathLength: 0, cum: [], anchor: pts[0],
    group: new THREE.Group(), members: [],
  };
  f.group.name = `formation-${f.id}`;
  const units = def.compose(n);
  f.members = units.map((unit, i) => {
    const stats = unitStats(unit);
    const mesh = makeUnit(unit);
    f.group.add(mesh);
    return {
      unit, index: i, mesh, alive: true, target: null,
      speed: stats.speed, altitude: stats.altitude || 0,
      offsetBack: 0, offsetSide: 0, prevX: null, prevZ: null, prevY: null, pitch: 0,
      segHint: { i: 0 }, // cache de segmento da amostra incremental (sampleAt)
      pos: { x: 0, y: 0, z: 0 },
    };
  });
  assignOffsets(f);
  f.speed = slowestSpeed(f);

  if (def.moving) {
    if (pts.length < 2) return null;
    const valid = validatePath(pts, rects, river, band, f.maxSide + 3);
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
      const p = clampPoint(pts[0].x + Math.cos(a) * r, pts[0].z + Math.sin(a) * r, rects, river, band, 3);
      if (!p) return null;
      placed.push(p);
    }
    f.members.forEach((m, i) => {
      const y = deps.heightAt(placed[i].x, placed[i].z) + m.altitude;
      m.pos = { x: placed[i].x, y, z: placed[i].z };
      m.mesh.position.set(m.pos.x, y, m.pos.z);
      m.mesh.rotation.y = deps.rng.range(0, Math.PI * 2);
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
      f.progress = f.pathLength + f.maxBack;
      f.state = f.def.deploys ? 'deployed' : 'arrived'; // artilharia posiciona e dispara (Onda 4)
    }
    placeMoving(f);
  }
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
    };
    m.target = t;
    game.targets.push(t);
    out.push(t);
  }
  return out;
}
