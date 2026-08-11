// campaign.js — Diretor de campanha do mapa Inhaúma (T-C-06, release
// v0.3.4 — SPEC §C). Substitui o loop de waves SOMENTE
// em Inhaúma (os outros mapas seguem missions.js/boss.js intocados).
//
//   Ato 1 "SALVAR INHAÚMA": baterias de artilharia (deploy a 600-1200 m da
//     TOWN_SHELF — a Onda 4 as faz atirar) + colunas de invasão (supplyConvoy 5,
//     troopColumn 8, armoredColumn 10, tankPlatoon 12) partem do vale de
//     Cachoeira em horários SEEDADOS (spawn-over-time, nunca tudo junto) por
//     rotas validadas contra as exclusões reais. Objetivo: destruir TODOS os
//     alvos do ato. Coluna que chega ao fim do path ('arrived') = invasão
//     bem-sucedida = Inhaúma cai (mission-failed; reset do ato no restart).
//   Ato 2 "LIBERTAR CACHOEIRA": destruir TODA a guarnição de ocupação (T-C-05).
//     Vitória = guarnição varrida; o mundo segue vivo (voo livre).
//
// Ciclo de vida: initCampaign no create do mapa (maps/inhauma.js) +
// updateCampaign(dt, game) todo frame a partir do MAIN TICK (main.js) — não do
// update do mapa, porque o relógio da campanha só avança com game.running (o
// update do mapa também roda no branch parado do tick). O serviço no aeroporto
// é escolha do jogador a qualquer momento (sem RTB forçado; o gate do auto-taxi
// nunca dispara spawnMission em Inhaúma — ver missions.js).
//
// game.campaign = { act, actTargetsTotal, actTargetsDestroyed, spawnedCount,
// quota, victory, failed } — ADITIVO a window.game. game.targetsTotal/
// targetsDestroyed ESPELHAM os contadores do ato (HUD/debug/service gate
// continuam funcionando; rebase na troca de ato). rng DERIVADO
// (createRng(seed+':campaign')) — mesmo padrão da guarnição (reload determinístico).
// Node-safe: UI (overlay) e falha chegam por hooks injetados (setCampaignHooks).
// Exporta: initCampaign, updateCampaign, resetCampaign, setCampaignHooks, ACT_TITLES.

import { createRng } from './rng.js';
import { CAMPAIGN } from './config.js';
import { createFormation, createAirPatrol, updateFormations, registerAsTargets } from './formations/formation.js';
import { updateCityWar, resetCityWar } from './city-war.js';
import { TOWN_SHELF, CACHOEIRA_SHELF, inhaumaVisualSurfaceHeight } from './maps/inhauma-scene.js';
import { getInhaumaRoads } from './maps/inhauma-roads.js';
import { getInhaumaRiverPolyline, RIVER_HALF_WIDTH_M } from './maps/inhauma-river.js';
import { INHAUMA_AIRPORT_EXCLUSION_ZONES } from './maps/inhauma-road-airport.js';
import { computeInhaumaBridgeCrossings } from './maps/inhauma-bridges.js';

export const ACT_TITLES = { 1: 'SALVAR INHAÚMA', 2: 'LIBERTE CACHOEIRA' };

// Hooks de UI/falha — injetados por missions.js (browser); no-op em Node.
let _hooks = { showOverlay: () => {}, onFailure: () => {} };
export function setCampaignHooks(hooks) { Object.assign(_hooks, hooks); }

/** Deps de formação da campanha: MESMAS exclusões da guarnição (cidades +
 *  aeroporto + rio) + zonas de ponte; rng derivado seed+':campaign'. */
function campaignFormationDeps(game) {
  return {
    rng: createRng(`${game.runtime?.seed ?? 'aero-default-seed'}:campaign`),
    heightAt: inhaumaVisualSurfaceHeight, // mesma superfície RENDERIZADA (padrão guarnição)
    exclusions: [TOWN_SHELF, CACHOEIRA_SHELF, ...INHAUMA_AIRPORT_EXCLUSION_ZONES],
    riverPolyline: getInhaumaRiverPolyline(),
    riverHalfWidth: RIVER_HALF_WIDTH_M,
    riverCrossings: computeInhaumaBridgeCrossings().map((c) => ({ x: c.midX, z: c.midZ, r: c.halfLength + 10 })),
  };
}

/** Rota 'road': trecho da estrada definido em CAMPAIGN.roadWindow + saída de
 *  terreno (roadTail), juntando o corredor até a TOWN_SHELF (template validado
 *  offline). T-D-04: com Cachoeira no vale SUDOESTE, a osm-mg-060 é
 *  percorrida do fim SE para o fim NW — ordena por z DECRESCENTE (o vale está
 *  no z alto; antes da mudança o vale ficava no z baixo e a ordem era inversa).
 *  2026-08-11: a coluna PARTE de Cachoeira (-1300,2950 — distância +50%) pelo
 *  valleyPrefix antes de entrar na cabeça SE da estrada. */
function roadRoute() {
  const w = CAMPAIGN.roadWindow;
  const road = getInhaumaRoads().find((r) => r.id === w.roadId);
  if (!road) return null;
  const seg = road.points.filter((p) => p.z > w.zMin && p.z < w.zMax);
  if (seg.length < 2) return null;
  // Orienta Cachoeira→Inhaúma: começa no ponto de maior z (vale SW) e desce até
  // o fim NW da estrada — as formações AVANÇAM em direção à cidade.
  const pts = seg.map((p) => [p.x, p.z]).sort((a, b) => b[1] - a[1]);
  return [...CAMPAIGN.valleyPrefix, ...pts, ...CAMPAIGN.columnRoutes.roadTail];
}

function resolveRoute(entry) {
  if (entry.route.startsWith('artillery')) return CAMPAIGN.artilleryRoutes[Number(entry.route.slice(9))];
  if (entry.route === 'road') return roadRoute() || CAMPAIGN.columnRoutes.north;
  return CAMPAIGN.columnRoutes[entry.route];
}

/** Agenda seedada do Ato 1: artilharias primeiro, depois as colunas, com
 *  intervalo crescente — o ato inteiro se desenrola em ~10-15 min de jogo. */
function buildSchedule(rng) {
  const entries = [];
  let at = CAMPAIGN.FIRST_SPAWN_S;
  const gap = () => { at += rng.range(CAMPAIGN.SPAWN_GAP_S[0], CAMPAIGN.SPAWN_GAP_S[1]); };
  for (let i = 0; i < CAMPAIGN.artilleryCount; i++) {
    entries.push({ type: 'artilleryBattery', size: rng.int(CAMPAIGN.artillerySize[0], CAMPAIGN.artillerySize[1]), route: `artillery${i}`, at });
    gap();
  }
  const routeIds = ['north', 'road', 'farNorth'];
  for (const [type, size] of CAMPAIGN.columns) {
    entries.push({ type, size, route: rng.pick(routeIds), at });
    gap();
  }
  // 2026-08-11 ("mais helicópteros"): 2 escoltas de helicóptero sobre o corredor
  // de avanço — ENTRAM NA AGENDA como tudo mais (spawn-over-time é contrato:
  // nada nasce antes de FIRST_SPAWN_S, e resetCampaign as renasce via pending).
  // Os `at` caem DEPOIS da primeira janela de spawn (o teste T-C-06(b) exige
  // 1-2 formações logo após FIRST_SPAWN_S) e dentro dos gaps do ato.
  entries.push({ air: 'helicopter', size: 1, anchor: { x: -600, z: 1500 }, at: CAMPAIGN.FIRST_SPAWN_S + rng.range(25, 45), type: 'heliEscort', route: 'air' });
  entries.push({ air: 'helicopter', size: 1, anchor: { x: -150, z: 650 }, at: CAMPAIGN.FIRST_SPAWN_S + rng.range(65, 95), type: 'heliEscort', route: 'air' });
  entries.sort((a, b) => a.at - b.at);
  return entries;
}

const countDead = (formations) =>
  formations.reduce((sum, f) => sum + f.members.filter((m) => m.target && m.target.dead).length, 0);
const countMembers = (formations) => formations.reduce((sum, f) => sum + f.members.length, 0);

/** Espelha os contadores do ato em game.targetsTotal/targetsDestroyed. */
function mirror(game, c) {
  // CONTRATO: writer de game.targetsTotal / game.targetsDestroyed (semântica de
  // "total" = objetivo do ATO — SPEC §F; HUD/debug/service gate leem daqui).
  game.targetsTotal = c.actTargetsTotal;
  game.targetsDestroyed = c.actTargetsDestroyed;
}

/** Inicializa o diretor (idempotente). deps = { scene, garrisonFormations } —
 *  ambos vindos do create do mapa Inhaúma (maps/inhauma.js). */
export function initCampaign(game, deps = {}) {
  if (game.campaign) return game.campaign;
  const formationDeps = campaignFormationDeps(game);
  const schedule = buildSchedule(formationDeps.rng);
  const c = {
    act: 1,
    actTargetsTotal: schedule.reduce((sum, e) => sum + e.size, 0),
    actTargetsDestroyed: 0,
    spawnedCount: 0,          // entradas da agenda já processadas (spawn ou falha)
    quota: schedule.length,
    victory: false,
    failed: false,
    t: 0,                     // relógio da campanha (só avança com game.running)
    pending: [...schedule],
    formations: [],           // formações VIVAS do Ato 1 (a campanha as dirige)
    garrison: deps.garrisonFormations || [],
    formationDeps,
    scene: deps.scene,
  };
  game.campaign = c;
  mirror(game, c);
  return c;
}

function spawnEntry(game, c, entry) {
  c.spawnedCount += 1;
  // 2026-08-11 ("mais helicópteros"): entrada AÉREA da agenda — escolta de
  // helicóptero circulando o waypoint âncora do corredor de avanço. Abatível,
  // com queda cinematográfica (air-kills.js); conta no objetivo do ato como
  // qualquer entrada (o total do ato é a soma dos sizes da agenda).
  if (entry.air) {
    const rng = c.formationDeps.rng;
    const pts = [];
    const phase = rng.range(0, Math.PI * 2);
    for (let k = 0; k < 8; k++) {
      const ang = phase + (k / 8) * Math.PI * 2;
      pts.push({ x: entry.anchor.x + Math.cos(ang) * 170, z: entry.anchor.z + Math.sin(ang) * 170 });
    }
    pts.push({ x: pts[0].x, z: pts[0].z });
    const fa = createAirPatrol({ unit: entry.air, size: entry.size, path: pts,
      deps: c.formationDeps, id: `campaign-act1-${c.spawnedCount}-${entry.type}` });
    if (!fa) { c.actTargetsTotal -= entry.size; return; }
    c.scene.add(fa.group);
    registerAsTargets(fa, game);
    c.formations.push(fa);
    return;
  }
  // 2026-08-11 (operador): formações avançam em BLOCO (grade ~quadrada), não
  // em fila — variant 'block' de formation.js#assignOffsets. O bloco alarga o
  // swath de validação; onde a geometria rejeita (corredor da estrada cola na
  // faixa do rio; pinch do corredor norte p/ spacing ≥16), degrada para coluna
  // NA MESMA rota antes de cair para o template norte.
  const mk = (path, variant) => createFormation({
    type: entry.type, size: entry.size, path, variant,
    deps: c.formationDeps, id: `campaign-act1-${c.spawnedCount}-${entry.type}`,
  });
  const route = resolveRoute(entry);
  let f = mk(route, 'block') || mk(route, 'column');
  if (!f && entry.route !== 'north') {
    // Fallback defensivo: o corredor norte é o template de referência validado.
    f = mk(CAMPAIGN.columnRoutes.north, 'block') || mk(CAMPAIGN.columnRoutes.north, 'column');
  }
  if (!f) { c.actTargetsTotal -= entry.size; return; } // spawn rejeitado: ajusta a quota de alvos
  c.scene.add(f.group);
  registerAsTargets(f, game);
  c.formations.push(f);
}

function advanceAct(game, c) {
  if (c.act === 1) {
    c.act = 2;
    c.actTargetsTotal = countMembers(c.garrison); // rebase: objetivo vira a guarnição
    c.actTargetsDestroyed = countDead(c.garrison);
    mirror(game, c);
    _hooks.showOverlay('INHAÚMA DEFENDIDA', 'AGORA LIBERTE CACHOEIRA DA PRATA', 3200);
    return;
  }
  c.victory = true; // mundo segue vivo (voo livre) — sem próximo ato
  _hooks.showOverlay(
    'CACHOEIRA DA PRATA LIBERTADA — VITÓRIA',
    `score ${Math.floor(game.score)} · ${game.kills} alvos destruídos · ${Math.round(c.t)}s de campanha`,
    6000,
  );
}

/** Tick do diretor — chamado do main tick (ver header). */
export function updateCampaign(dt, game) {
  const c = game.campaign;
  if (!c || c.victory || c.failed) return;
  c.t += dt;
  while (c.pending.length && c.pending[0].at <= c.t) spawnEntry(game, c, c.pending.shift());
  updateFormations(dt, c.formations, c.formationDeps);
  // T-C-09: guerra urbana — as baterias 'deployed' bombardeiam os prédios de
  // Inhaúma no MESMO relógio da campanha (um relógio só; no-op fora de Inhaúma
  // ou antes de initCityWar).
  updateCityWar(dt, game);
  // Invasão bem-sucedida: qualquer coluna do Ato 1 que COMPLETA o path (estado
  // 'arrived' — artilharia vira 'deployed', que é legítimo) derruba Inhaúma.
  if (c.act === 1 && c.formations.some((f) => f.state === 'arrived')) {
    c.failed = true;
    _hooks.onFailure();
    return;
  }
  const alive = c.act === 1 ? c.formations : c.garrison;
  c.actTargetsDestroyed = countDead(alive);
  mirror(game, c);
  const allSpawned = c.pending.length === 0;
  if (allSpawned && c.actTargetsTotal > 0 && c.actTargetsDestroyed >= c.actTargetsTotal) advanceAct(game, c);
}

/** Reset do Ato 1 após invasão bem-sucedida (restartGame): remove SÓ as
 *  formações da campanha (grupos da cena + alvos com formationId da campanha) —
 *  a guarnição de Cachoeira NUNCA é tocada (mundo persistente entre tentativas). */
export function resetCampaign(game) {
  const c = game.campaign;
  if (!c) return;
  resetCityWar(); // T-C-09: apaga projéteis em voo + focos/fumaças do bombardeio
  const campaignIds = new Set(c.formations.map((f) => f.id));
  for (const f of c.formations) c.scene.remove(f.group);
  for (let i = game.targets.length - 1; i >= 0; i--) {
    if (campaignIds.has(game.targets[i].formationId)) game.targets.splice(i, 1);
  }
  const formationDeps = campaignFormationDeps(game); // rng novo, mesma seed → mesma agenda
  const schedule = buildSchedule(formationDeps.rng);
  c.act = 1;
  c.actTargetsTotal = schedule.reduce((sum, e) => sum + e.size, 0);
  c.actTargetsDestroyed = 0;
  c.spawnedCount = 0;
  c.quota = schedule.length;
  c.failed = false;
  c.t = 0;
  c.pending = schedule;
  c.formations = [];
  c.formationDeps = formationDeps;
  mirror(game, c);
}
