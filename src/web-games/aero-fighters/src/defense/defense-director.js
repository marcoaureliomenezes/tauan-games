// defense/defense-director.js — Diretor do modo 'inhauma-defense' (T-D-09,
// release v0.3.5). Spawn INFINITO de caças com taxa
// escalando por kills (intervalo base 6 s ×0.93 a cada 5 kills, piso 1.5 s;
// esquadrilha 1→4 por degraus; cap de vivos com FILA), score/kills consolidados
// (abatimento .50/AA/aliado = KILL_SCORE, interceptação = INTERCEPT_BONUS),
// streak a cada STREAK_EVERY, integridade da cidade (−CITY_DAMAGE por impacto,
// ~20 impactos derrubam) e as duas derrotas: cidade 0% ('city') ou artilheiro
// sem vidas ('battery').
// T-D-02 (release v0.3.10): a direção de
// ingresso da esquadrilha é QUANTIZADA em DIR_SECTORS (4) setores de 90°
// relativos ao eixo SOLDIER→LOOK_AT (frente = sobre a cidade; o setor oposto é
// a retaguarda, coberta pela bateria REAR_BATT_*), com jitter seedado de
// ±DIR_SECTOR_JITTER rad dentro do setor (< 45° — nunca invade o vizinho).
// Lógica PURA — sem Three.js/DOM; rng seedado (createRng(seed+':defense-
// director')). defense-mode.js faz a fiação visual/overlay por frame.
// Exporta: createDefenseDirector, spawnInterval, squadSize, stepDirector,
//   registerKill, registerInterception, registerCityImpact, registerPlayerDown,
//   resetDirector, directorTelemetry, frontAxis, pickSquadDirection,
//   stepHorde, registerHordeArrival, registerHordeKill (WEAPONS-V1, T-W-05).

import { createRng } from '../rng.js';
import { AA_DEFENSE } from '../config.js';

/** Intervalo atual entre esquadrilhas: 6 s × 0.93^floor(kills/5), piso 1.5 s. */
export function spawnInterval(d, cfg = AA_DEFENSE) {
  const steps = Math.floor(d.kills / cfg.DIR_KILLS_STEP);
  return Math.max(cfg.DIR_MIN_INTERVAL, cfg.DIR_BASE_INTERVAL * Math.pow(cfg.DIR_RATE, steps));
}

/** Tamanho da esquadrilha pelos degraus de kills (1→4). */
export function squadSize(d, cfg = AA_DEFENSE) {
  let n = 1;
  for (let i = 1; i < cfg.DIR_SQUAD_KILLS.length; i++) {
    if (d.kills >= cfg.DIR_SQUAD_KILLS[i]) n = i + 1;
  }
  return Math.min(n, cfg.DIR_SQUAD_KILLS.length);
}

/** T-D-02: eixo "frente" = bússola SOLDIER→LOOK_AT (rad, atan2 z/x). O setor 0
 *  é centrado nele; o setor DIR_SECTORS/2 (2) é a retaguarda. */
export function frontAxis(cfg = AA_DEFENSE) {
  return Math.atan2(cfg.LOOK_AT.z - cfg.SOLDIER_POS.z, cfg.LOOK_AT.x - cfg.SOLDIER_POS.x);
}

/** T-D-02: sorteia a direção da esquadrilha num dos DIR_SECTORS setores de
 *  90° (setor seedado) + jitter de ±DIR_SECTOR_JITTER rad. Consome 2 draws do
 *  rng (setor, jitter) — determinístico por seed.
 *  @returns {{dir:number, sector:number}} */
export function pickSquadDirection(rng, cfg = AA_DEFENSE) {
  const sector = Math.floor(rng() * cfg.DIR_SECTORS);
  const jitter = (rng() * 2 - 1) * cfg.DIR_SECTOR_JITTER;
  return { dir: frontAxis(cfg) + sector * ((Math.PI * 2) / cfg.DIR_SECTORS) + jitter, sector };
}

/**
 * Cria o diretor. @param seed seed da sessão (derivada com ':defense-director')
 * Estado: { kills, score, cityIntegrity, spawnT, pending[], squads, spawned,
 *   cityHits, defeated } — pending = fila de esquadrilhas esperando vaga
 *   (cap DIR_MAX_ALIVE de vivos).
 */
export function createDefenseDirector(seed, cfg = AA_DEFENSE) {
  const rng = createRng(String(seed ?? 'aero-default-seed') + ':defense-director');
  return {
    rng,
    kills: 0,
    score: 0,
    cityIntegrity: 100,
    spawnT: cfg.DIR_FIRST_DELAY,
    pending: [],        // esquadrilhas agendadas: { count, dir, sector } (dir = bússola rad)
    squads: 0,          // esquadrilhas agendadas no run (telemetria de regime)
    spawned: 0,         // caças efetivamente lançados no run
    cityHits: 0,        // impactos sofridos pela cidade (telemetria)
    hordeT: cfg.HORDE_FIRST_S, // WEAPONS-V1 (T-W-05): s até a próxima horda
    hordes: 0,          // hordas lançadas no run (telemetria)
    defeated: null,     // null | 'city' | 'battery'
  };
}

/**
 * Um passo do diretor. Agenda esquadrilhas no ritmo de spawnInterval e drena a
 * fila respeitando o cap de vivos.
 * @param d diretor @param dt s @param alive caças vivos agora (incl. caindo)
 * @returns {Array} eventos {type:'spawn', count, dir, sector} — dir = ângulo de
 *   bússola da esquadrilha (T-D-02: quantizado em DIR_SECTORS setores de 90° a
 *   partir do eixo SOLDIER→LOOK_AT + jitter; sector = índice do setor).
 */
export function stepDirector(d, dt, alive, cfg = AA_DEFENSE) {
  const ev = [];
  if (d.defeated) return ev; // partida encerrada: céu congela até o restart
  d.spawnT -= dt;
  if (d.spawnT <= 0) {
    d.spawnT += spawnInterval(d, cfg);
    d.squads += 1;
    const { dir, sector } = pickSquadDirection(d.rng.random, cfg); // T-D-02
    d.pending.push({ count: squadSize(d, cfg), dir, sector });
  }
  let room = Math.max(0, cfg.DIR_MAX_ALIVE - alive);
  while (room > 0 && d.pending.length) {
    const batch = d.pending[0];
    const n = Math.min(batch.count, room);
    batch.count -= n;
    room -= n;
    d.spawned += n;
    if (batch.count <= 0) d.pending.shift();
    ev.push({ type: 'spawn', count: n, dir: batch.dir, sector: batch.sector });
  }
  return ev;
}

/**
 * Abate de caça (qualquer fonte: 'mg' | 'aa' | 'ally'). Consolida kills/score.
 * @returns {null|{streak:number}} — streak a cada STREAK_EVERY abates.
 */
export function registerKill(d, source = 'mg', cfg = AA_DEFENSE) {
  d.kills += 1;
  d.score += cfg.KILL_SCORE;
  if (d.kills % cfg.STREAK_EVERY === 0) return { streak: d.kills, source };
  return null;
}

/** Interceptação de míssil anti-jogador no ar — bônus sem contar abate. */
export function registerInterception(d, cfg = AA_DEFENSE) {
  d.score += cfg.INTERCEPT_BONUS;
  return d.score;
}

/**
 * Impacto de míssil inimigo na cidade: −CITY_DAMAGE% (~20 impactos derrubam).
 * @returns {{integrity:number, defeated:null|'city'}}
 */
export function registerCityImpact(d, cfg = AA_DEFENSE) {
  d.cityHits += 1;
  d.cityIntegrity = Math.max(0, d.cityIntegrity - cfg.CITY_DAMAGE);
  if (d.cityIntegrity <= 0 && !d.defeated) d.defeated = 'city';
  return { integrity: d.cityIntegrity, defeated: d.defeated };
}

/** Artilheiro sem vidas — derrota 'battery' (BATERIA DESTRUÍDA). */
export function registerPlayerDown(d) {
  if (!d.defeated) d.defeated = 'battery';
  return d.defeated;
}

/** Reseta o run (restart pós-derrota): placar/cidade/fila zerados; o rng
 *  segue a sequência (novo run, mesma sessão — direções não se repetem). */
export function resetDirector(d, cfg = AA_DEFENSE) {
  d.kills = 0;
  d.score = 0;
  d.cityIntegrity = 100;
  d.spawnT = cfg.DIR_FIRST_DELAY;
  d.pending = [];
  d.squads = 0;
  d.spawned = 0;
  d.cityHits = 0;
  d.hordeT = cfg.HORDE_FIRST_S;
  d.hordes = 0;
  d.defeated = null;
  return d;
}

// ─── WEAPONS-V1 (T-W-05): horda no horizonte (boss) ──────────────────────────
// A horda é agenda PURA do diretor (seedada — primeiro em HORDE_FIRST_S, ciclo
// HORDE_CYCLE_S); spawn/marcha/chegada viram eventos consumidos pelo
// defense-mode (a formação reusada de src/formations é entidade LOCAL do modo,
// nunca entra em game.targets).

/**
 * Relógio da horda. @returns {Array} [{type:'horde-spawn', dir}] quando a
 *  próxima horda deve se montar no horizonte (dir = bússola seedada). */
export function stepHorde(d, dt, cfg = AA_DEFENSE) {
  const ev = [];
  if (d.defeated) return ev;
  d.hordeT -= dt;
  if (d.hordeT <= 0) {
    d.hordeT += cfg.HORDE_CYCLE_S;
    d.hordes += 1;
    ev.push({ type: 'horde-spawn', dir: d.rng.random() * Math.PI * 2 });
  }
  return ev;
}

/**
 * A horda CHEGOU à cidade: dano pesado na integridade (−HORDE_CITY_DAMAGE%).
 * @returns {{integrity:number, defeated:null|'city'}}
 */
export function registerHordeArrival(d, cfg = AA_DEFENSE) {
  d.cityIntegrity = Math.max(0, d.cityIntegrity - cfg.HORDE_CITY_DAMAGE);
  if (d.cityIntegrity <= 0 && !d.defeated) d.defeated = 'city';
  return { integrity: d.cityIntegrity, defeated: d.defeated };
}

/** Unidade da horda destruída (nuke) — score sem contar abate de caça. */
export function registerHordeKill(d, n = 1, cfg = AA_DEFENSE) {
  d.score += cfg.HORDE_KILL_SCORE * n;
  return d.score;
}

/** Telemetria de regime para o HUD/game.defense e para os testes. */
export function directorTelemetry(d, alive, cfg = AA_DEFENSE) {
  return {
    spawnInterval: spawnInterval(d, cfg),
    squadSize: squadSize(d, cfg),
    alive,
    queued: d.pending.reduce((s, b) => s + b.count, 0),
    kills: d.kills,
    score: d.score,
    cityIntegrity: d.cityIntegrity,
    cityHits: d.cityHits,
    squads: d.squads,
    hordes: d.hordes ?? 0,
    defeated: d.defeated,
  };
}
