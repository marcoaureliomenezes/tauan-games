// maps/inhauma-garrison.js — Guarnição de ocupação de Cachoeira da Prata
// (T-C-05, release v0.3.4 — SPEC §B). Cachoeira está
// OCUPADA: patrulha aérea (zepelim + helicópteros) sobre a cidade, ninhos de AA
// nos morros ao redor, colunas blindadas circulando na osm-mg-060 e o QG
// (encampment + samSite) na borda norte — objetivo final do Ato 2.
// Tudo nasce de game.rng (determinismo é contrato) e entra em game.targets via
// registerAsTargets (o fluxo de dano/homing/nuke/score de targets.js funciona
// sem adaptação). Node-safe (sem DOM/scene — ambos injetados).
// Exporta: buildCachoeiraGarrison, garrisonDiagnostics.
// Para mudar a composição da força, edite CACHOEIRA_GARRISON em config.js.

import { createFormation, createAirPatrol, registerAsTargets } from '../formations/formation.js';
import { getInhaumaRoads, nearAnyRoad } from './inhauma-roads.js';
import { distanceToRiver, RIVER_HALF_WIDTH_M } from './inhauma-river.js';
import { CACHOEIRA_PRACA, CACHOEIRA_CHURCH } from './inhauma-scene.js';
import { CACHOEIRA_GARRISON } from '../config.js';

// Trechos da osm-mg-060 que margeiam a cidade (a coluna vai e volta no MESMO
// corredor — o controlador só faz paths abertos, então o laço é ida-e-volta).
// T-D-04: com a cidade em (-950,2050), os trechos são o fim SE da estrada
// (z∈[1300,1556] — o mais próximo que a rodovia chega do novo vale, ~560 m).
const ARMOR_SEGMENTS = [[1300, 1500], [1420, 1556]];
const AIR_LOOP_POINTS = 10;        // vértices do polígono de patrulha aérea
const AA_CANDIDATES = 80;          // amostras seedadas do anel de morros
const AA_MIN_HEIGHT_M = 14;        // morro de verdade — acima da cota do shelf (11 m)
const AA_MAX_SLOPE = 0.55;         // topo aterrissável para o cluster do aaNest

const centerOf = (shelf) => ({ x: (shelf.minX + shelf.maxX) / 2, z: (shelf.minZ + shelf.maxZ) / 2 });

const insideShelf = (shelf, x, z, margin = 0) =>
  x >= shelf.minX - margin && x <= shelf.maxX + margin &&
  z >= shelf.minZ - margin && z <= shelf.maxZ + margin;

/** Inclinação numérica (dh/dm) a partir do heightAt injetado — sem depender do DEM. */
function slopeAt(heightAt, x, z) {
  const d = 12;
  const dx = (heightAt(x + d, z) - heightAt(x - d, z)) / (2 * d);
  const dz = (heightAt(x, z + d) - heightAt(x, z - d)) / (2 * d);
  return Math.hypot(dx, dz);
}

/** Circuito fechado de patrulha aérea: polígono de n pontos com jitter seedado,
 *  último ponto = primeiro (createAirPatrol faz loop infinito). */
function closedAirLoop(cx, cz, radius, n, rng) {
  const pts = [];
  const phase = rng.range(0, Math.PI * 2);
  for (let i = 0; i < n; i++) {
    const a = phase + (i / n) * Math.PI * 2;
    const r = radius * rng.range(0.85, 1.15);
    pts.push({ x: cx + Math.cos(a) * r, z: cz + Math.sin(a) * r });
  }
  pts.push({ x: pts[0].x, z: pts[0].z });
  return pts;
}

/** Path ida-e-volta sobre um trecho da estrada (laço terrestre que NUNCA sai do
 *  corredor — o teste exige ponto do path a ≤25 m da polilinha da estrada). */
function roadOutAndBack(road, zMin, zMax) {
  const seg = road.points.filter((p) => p.z >= zMin && p.z <= zMax);
  if (seg.length < 2) return null;
  return [...seg, ...seg.slice(0, -1).reverse()];
}

/** Morros do anel ao redor do shelf: máximos locais seedados, fora do shelf, fora
 *  de estrada/rio, com topo plano o bastante para o cluster. Ordena por altura e
 *  colhe os `count` mais altos com separação mínima. */
function pickAaHilltops(deps, shelf, count) {
  const c = centerOf(shelf);
  const [rMin, rMax] = CACHOEIRA_GARRISON.aaAnnulus;
  const candidates = [];
  for (let i = 0; i < AA_CANDIDATES; i++) {
    const a = deps.rng.range(0, Math.PI * 2);
    const r = deps.rng.range(rMin, rMax);
    const x = c.x + Math.cos(a) * r, z = c.z + Math.sin(a) * r;
    if (insideShelf(shelf, x, z, 40)) continue;
    if (nearAnyRoad(x, z, 12)) continue;
    if (distanceToRiver(x, z) < RIVER_HALF_WIDTH_M + 25) continue;
    const h = deps.heightAt(x, z);
    if (h < AA_MIN_HEIGHT_M) continue;
    if (slopeAt(deps.heightAt, x, z) > AA_MAX_SLOPE) continue;
    candidates.push({ x, z, h });
  }
  candidates.sort((a, b) => b.h - a.h);
  const picked = [];
  for (const cand of candidates) {
    if (picked.length >= count) break;
    if (picked.every((p) => Math.hypot(p.x - cand.x, p.z - cand.z) >= CACHOEIRA_GARRISON.aaMinSeparation)) {
      picked.push(cand);
    }
  }
  return picked;
}

let _diagnostics = null;

/** Diagnóstico da guarnição (consumido pela campanha na Onda 3 e exposto em
 *  game.missionRealism.inhaumaMap.garrison — contrato aditivo). */
export function garrisonDiagnostics() {
  return _diagnostics;
}

/** Constrói a força de ocupação. `scene` e `game` injetados (Node-safe);
 *  formationDeps = { rng, heightAt, exclusions[], riverPolyline, riverHalfWidth }.
 *  Retorna { formations, formationDeps, diagnostics } — formations alimenta o
 *  updateFormations do updateInhaumaScene. */
export function buildCachoeiraGarrison(scene, { game, formationDeps, shelf }) {
  const c = centerOf(shelf);
  const rng = formationDeps.rng;
  const formations = [];
  const spawn = (opts, air = false) => {
    // 2026-08-11 (operador): formações terrestres em BLOCO (grade), não em fila.
    // Patrulhas aéreas seguem em esteira (column) — bloco não faz sentido no ar.
    const f = air ? createAirPatrol(opts) : createFormation({ variant: 'block', ...opts });
    if (!f) return null;
    scene.add(f.group);
    registerAsTargets(f, game);
    formations.push(f);
    return f;
  };

  // 1) Patrulha aérea sobre a cidade (zepelim alto, helicópteros baixos).
  for (let i = 0; i < CACHOEIRA_GARRISON.zeppelinPatrols; i++) {
    spawn({ unit: 'zeppelin', size: 1, deps: formationDeps, id: `cachoeira-zeppelin-${i + 1}`,
      path: closedAirLoop(c.x, c.z, 210, AIR_LOOP_POINTS, rng) }, true);
  }
  for (let i = 0; i < CACHOEIRA_GARRISON.heliPatrols; i++) {
    const ox = rng.range(-70, 70), oz = rng.range(-70, 70);
    spawn({ unit: 'helicopter', size: 1, deps: formationDeps, id: `cachoeira-heli-${i + 1}`,
      path: closedAirLoop(c.x + ox, c.z + oz, 130 + i * 25, 8, rng) }, true);
  }

  // 2) Ninhos de AA nos morros ao redor (fora do shelf, acima da cota da cidade).
  const hilltops = pickAaHilltops(formationDeps, shelf, CACHOEIRA_GARRISON.aaNests);
  hilltops.forEach((p, i) => {
    spawn({ type: 'aaNest', size: 5, path: [p], deps: formationDeps, id: `cachoeira-aa-${i + 1}` });
  });

  // 2.5) Baterias AA DENTRO da cidade (doutrina 300/200, 2026-08-11): a praça e
  //      o largo da igreja são clareiras reais (clearZones da tipologia — sem
  //      prédios). A exclusão do shelf protege o TRÁFEGO de formações; baterias
  //      estáticas posicionadas de propósito nas clareiras não a violam, então o
  //      deps local remove só o retângulo que contém o centro da cidade.
  const townDeps = {
    ...formationDeps,
    exclusions: (formationDeps.exclusions || []).filter(
      (r) => !(r.minX <= c.x && c.x <= r.maxX && r.minZ <= c.z && c.z <= r.maxZ),
    ),
  };
  const townAaSpots = [
    { x: CACHOEIRA_PRACA.x, z: CACHOEIRA_PRACA.z },
    { x: CACHOEIRA_CHURCH.x + 14, z: CACHOEIRA_CHURCH.z + 12 }, // largo, fora da igreja
  ];
  for (let i = 0; i < Math.min(CACHOEIRA_GARRISON.townAaBatteries, townAaSpots.length); i++) {
    spawn({ type: 'aaNest', size: CACHOEIRA_GARRISON.townAaSize, path: [townAaSpots[i]],
      deps: townDeps, id: `cachoeira-town-aa-${i + 1}` });
  }

  // 3) Blindados circulando nos trechos de estrada da cidade (laço ida-e-volta).
  const road = getInhaumaRoads().find((r) => r.id === 'osm-mg-060');
  for (let i = 0; i < Math.min(CACHOEIRA_GARRISON.armorColumns, ARMOR_SEGMENTS.length); i++) {
    const path = road ? roadOutAndBack(road, ...ARMOR_SEGMENTS[i]) : null;
    if (!path) continue;
    spawn({ type: 'armoredColumn', size: CACHOEIRA_GARRISON.armorSize, path,
      deps: formationDeps, id: `cachoeira-armor-${i + 1}`, loop: true });
  }

  // 4) QG da ocupação (objetivo final do Ato 2): encampment + samSite na borda
  //    norte — perto do centro da cidade mas FORA do shelf (exclusão dura).
  const hq = { x: c.x + rng.range(-15, 15), z: shelf.minZ - 70 + rng.range(-10, 10) };
  spawn({ type: 'encampment', size: CACHOEIRA_GARRISON.hqTroops, path: [hq],
    deps: formationDeps, id: 'cachoeira-hq' });
  const sam = { x: c.x + 85 + rng.range(-10, 10), z: shelf.minZ - 55 + rng.range(-8, 8) };
  spawn({ type: 'samSite', size: CACHOEIRA_GARRISON.samSize, path: [sam],
    deps: formationDeps, id: 'cachoeira-hq-sam' });

  _diagnostics = {
    town: 'cachoeira-da-prata',
    center: { x: c.x, z: c.z },
    formationCount: formations.length,
    unitCount: formations.reduce((sum, f) => sum + f.members.length, 0),
    aaNests: hilltops.map((p) => ({ x: Math.round(p.x), z: Math.round(p.z), height: Math.round(p.h) })),
    hq: { encampment: { x: Math.round(hq.x), z: Math.round(hq.z) }, samSite: { x: Math.round(sam.x), z: Math.round(sam.z) } },
    formations: formations.map((f) => ({
      id: f.id, type: f.type, size: f.members.length, state: f.state, loop: !!f.loop,
      anchor: { x: Math.round(f.anchor.x), z: Math.round(f.anchor.z) },
    })),
  };
  return { formations, formationDeps, diagnostics: _diagnostics };
}
