// defense/weapons-v1.js — Lógica PURA da release
// v0.3.9 (T-W-01..T-W-08):
//   · T-W-08 (ADENDO playtest-2 — SUBSTITUI o T-W-01): mira por FASES — amarelo
//     1,5 s (50%) → vermelho 1,5 s (80%) → amarelo 1,5 s (50%); solta após o
//     ciclo ou 5 mísseis no alvo. Acerto por roll seedado (HIT = PN normal;
//     MISS = offset terminal). Quebra de feixe CONGELA o timer da fase por até
//     AA_LOCK_HOLD s (carência — depois o ciclo reinicia no novo alvo).
//   · T-W-02 cooldowns por tier de míssil (X 0.5 s · B 2 s · rod 5 s · nuke 1 s)
//     + fila de disparo seguido do X (cap AA_QUEUE_CAP).
//   · T-W-03 retarget — míssil órfão busca o vivo mais próximo num cone generoso.
//   · T-W-04 rod cinético — PN direto a 3× AA_SPEED, perfura e encadeia 3 kills.
//   · T-W-05 passo balístico do arco da nuke + ponto de mira no terreno.
//   · T-W-07 nightFactor (mesma curva do sky.js — chama de propulsão à noite).
// SEM Three.js, SEM DOM — Node-testável (test-aero-defense-weapons-v1.mjs).
// Exporta: noteLockShot, stepLockPhase, lockPhase, resetLock, rollLockHit,
//   enqueueAaShot, consumeTier, stepTierCooldowns, pickRetarget, rodCfg,
//   stepRod, stepNukeArc, nukeCfg, stepNukeGuided, groundAimPoint, nightFactor.

import { AA_DEFENSE } from '../config.js';
import { pnStep } from './turret-weapons.js';

// ─── T-W-08: mira por fases (amarelo/vermelho/amarelo) ───────────────────────
// lock = { idx, phaseT, shotsFired, holdT }. idx >= 0 = alvo travado (quadrado
// visível desde a aquisição — sem "tracking" prévio). A cor/lado do ciclo vem
// de lockPhase(). O gasto por míssil é contado com noteLockShot() no disparo.

/** Conta 1 míssil lançado no alvo travado (o 5º solta a mira). */
export function noteLockShot(lock) {
  lock.shotsFired = (lock.shotsFired ?? 0) + 1;
  return lock;
}

/** Zera a mira (alvo morreu / despaw / restart do run). */
export function resetLock(lock) {
  lock.idx = -1; lock.phaseT = 0; lock.shotsFired = 0; lock.holdT = 0;
  return lock;
}

/**
 * Avança a mira por fases um frame. candidate = índice do alvo no cone do
 * retículo (pickLockTarget) ou -1. Semântica da quebra de feixe: o timer da
 * fase CONGELA por até AA_LOCK_HOLD s de carência (mira mantida no alvo); se o
 * feixe não volta, o ciclo REINICIA no novo candidato (ou solta, se nenhum).
 */
export function stepLockPhase(lock, candidate, dt, cfg = AA_DEFENSE) {
  if (candidate !== lock.idx) {
    if (lock.idx >= 0 && (lock.holdT ?? 0) < cfg.AA_LOCK_HOLD) {
      lock.holdT = (lock.holdT ?? 0) + dt; // carência: fase congelada
      return lock;
    }
    // novo alvo (ou nenhum): reinicia o ciclo completo
    lock.idx = candidate;
    lock.phaseT = 0;
    lock.shotsFired = 0;
    lock.holdT = 0;
    return lock;
  }
  lock.holdT = 0;
  if (lock.idx < 0) return lock;
  lock.phaseT = (lock.phaseT ?? 0) + dt;
  if (lock.phaseT >= cfg.LOCK_PHASE_S * 3 || (lock.shotsFired ?? 0) >= cfg.LOCK_MAX_SHOTS) {
    resetLock(lock); // fim do ciclo (4,5 s) ou 5 mísseis no alvo
  }
  return lock;
}

/** Fase atual da mira: {index, color, hitP, cycleFrac} ou null (sem alvo). */
export function lockPhase(lock, cfg = AA_DEFENSE) {
  if (lock.idx < 0) return null;
  const i = Math.min(2, Math.floor((lock.phaseT ?? 0) / cfg.LOCK_PHASE_S));
  return {
    index: i,
    color: i === 1 ? 'red' : 'yellow',
    hitP: cfg.LOCK_HIT_P[i],
    cycleFrac: Math.min(1, (lock.phaseT ?? 0) / (cfg.LOCK_PHASE_S * 3)),
  };
}

/** Roll de acerto do disparo: HIT (true) = homing PN normal; MISS (false) =
 *  offset terminal seedado (passa a poucos metros do alvo). rng injetado. */
export function rollLockHit(rng, hitP) {
  return rng() < hitP;
}

/** Enfileira 1 disparo do X pressionado dentro da cadência (cap anti-lag). */
export function enqueueAaShot(turret, cap = AA_DEFENSE.AA_QUEUE_CAP) {
  if ((turret.fireQueue ?? 0) >= cap) return false;
  turret.fireQueue = (turret.fireQueue ?? 0) + 1;
  return true;
}

// ─── T-W-02: cooldowns por tier ──────────────────────────────────────────────

/** Consome o cooldown de um slot de arma. @returns {boolean} false em cooldown. */
export function consumeTier(turret, key, interval) {
  if ((turret[key] ?? 0) > 0) return false;
  turret[key] = interval;
  return true;
}

/** Drena os cooldowns por frame (aaCooldown · bCooldown · rodCooldown · nukeCooldown). */
export function stepTierCooldowns(turret, dt, keys = ['aaCooldown', 'bCooldown', 'rodCooldown', 'nukeCooldown']) {
  for (const k of keys) turret[k] = Math.max(0, (turret[k] ?? 0) - dt);
  return turret;
}

// ─── T-W-03: retarget de míssil órfão ────────────────────────────────────────

/** Vivo mais próximo dentro do cone à frente do vetor velocidade do projétil
 *  m {x,y,z,vx,vy,vz}, ou null (→ segue balístico). Cone generoso (~60°). */
export function pickRetarget(m, targets, coneRad = AA_DEFENSE.RETARGET_CONE) {
  const vm = Math.hypot(m.vx, m.vy, m.vz);
  let best = null, bestD2 = Infinity;
  for (const t of targets) {
    if (t.dead) continue;
    const dx = t.x - m.x, dy = t.y - m.y, dz = t.z - m.z;
    const d2 = dx * dx + dy * dy + dz * dz;
    if (d2 < 1e-9) continue;
    if (vm > 1e-6) {
      const dot = (m.vx * dx + m.vy * dy + m.vz * dz) / (vm * Math.sqrt(d2));
      if (Math.acos(Math.min(1, Math.max(-1, dot))) > coneRad) continue;
    }
    if (d2 < bestD2) { bestD2 = d2; best = t; }
  }
  return best;
}

// ─── T-W-04: rod cinético ────────────────────────────────────────────────────

let _rodBase = null, _rodCfg = null;
/** cfg da PN do rod: 3× a velocidade do míssil fraco, esterço compensado. */
export function rodCfg(cfg = AA_DEFENSE) {
  if (_rodBase !== cfg) {
    _rodBase = cfg;
    _rodCfg = {
      ...cfg,
      AA_SPEED: cfg.AA_SPEED * cfg.ROD_SPEED_MULT,
      AA_LAT_ACCEL: cfg.AA_LAT_ACCEL * cfg.ROD_LAT_MULT,
    };
  }
  return _rodCfg;
}

/**
 * Um passo do rod r {x,y,z,vx,vy,vz,target,life}: PN direto no alvo vivo,
 * balístico sem alvo. A perfuração usa teste SWEPT (menor distância do
 * segmento do passo ao alvo) — a 660 m/s o passo de um frame (>10 m) pularia
 * uma espoleta pontual. @returns {'hit'|'expired'|null} — 'hit' = perfurou
 * (o caller mata o alvo e retargeta enquanto houver pierceLeft).
 */
export function stepRod(r, dt, cfg = AA_DEFENSE) {
  r.life -= dt;
  const px = r.x, py = r.y, pz = r.z;
  if (r.target && !r.target.dead) pnStep(r, r.target, dt, rodCfg(cfg));
  else { r.x += r.vx * dt; r.y += r.vy * dt; r.z += r.vz * dt; }
  if (r.target && !r.target.dead) {
    const t = r.target;
    const sx = r.x - px, sy = r.y - py, sz = r.z - pz;
    const wx = t.x - px, wy = t.y - py, wz = t.z - pz;
    const len2 = sx * sx + sy * sy + sz * sz;
    const tt = len2 > 1e-9
      ? Math.max(0, Math.min(1, (wx * sx + wy * sy + wz * sz) / len2)) : 0;
    const cx = px + sx * tt - t.x, cy = py + sy * tt - t.y, cz = pz + sz * tt - t.z;
    if (cx * cx + cy * cy + cz * cz < cfg.ROD_HIT_R * cfg.ROD_HIT_R) return 'hit';
  }
  return r.life <= 0 ? 'expired' : null;
}

// ─── T-W-05: nuke tática ─────────────────────────────────────────────────────

/** Passo balístico da fase de ARCO da nuke n {x,y,z,vx,vy,vz,life}: gravidade +
 *  integração. O glide guiado reusa pnStep sobre o ponto de mira estático. */
export function stepNukeArc(n, dt, cfg = AA_DEFENSE) {
  n.vy -= cfg.NUKE_GRAVITY * dt;
  n.x += n.vx * dt; n.y += n.vy * dt; n.z += n.vz * dt;
  n.life -= dt;
}

let _nukeBase = null, _nukeCfg = null;
/** cfg da PN do glide da nuke: cruzeiro NUKE_SPEED sobre o ponto de mira. */
export function nukeCfg(cfg = AA_DEFENSE) {
  if (_nukeBase !== cfg) {
    _nukeBase = cfg;
    _nukeCfg = { ...cfg, AA_SPEED: cfg.NUKE_SPEED, AA_LAT_ACCEL: cfg.NUKE_LAT_ACCEL };
  }
  return _nukeCfg;
}

/**
 * Glide da nuke (pós-arco): cruzeiro ALTO sobre o ponto de mira (+NUKE_CRUISE_ALT)
 * enquanto longe — veta clipping nas cristas do vale a caminho do horizonte —
 * e mergulho terminal direto dentro de NUKE_TERMINAL_DIST. Cai sobre a mira.
 */
export function stepNukeGuided(n, dt, cfg = AA_DEFENSE) {
  const dx = n.aim.x - n.x, dz = n.aim.z - n.z;
  const far = Math.hypot(dx, dz) > cfg.NUKE_TERMINAL_DIST;
  const tx = far
    ? { x: n.aim.x, y: n.aim.y + cfg.NUKE_CRUISE_ALT, z: n.aim.z, vx: 0, vy: 0, vz: 0 }
    : n.aim;
  n.life -= dt;
  pnStep(n, tx, dt, nukeCfg(cfg));
}

/** Marcha o raio de mira até cruzar o terreno (ou o cap) — ponto de impacto
 *  pretendido da nuke. heightAt(x,z) injetado (DEM real no modo). */
export function groundAimPoint(origin, dir, heightAt, maxDist = 4000, step = 12) {
  let px = origin.x, py = origin.y, pz = origin.z, d = 0;
  while (d < maxDist) {
    px += dir.x * step; py += dir.y * step; pz += dir.z * step; d += step;
    if (py <= heightAt(px, pz)) return { x: px, y: heightAt(px, pz), z: pz, dist: d };
  }
  return { x: px, y: heightAt(px, pz), z: pz, dist: maxDist };
}

// ─── T-W-07: fator de noite (chama de propulsão visível só de noite) ─────────
// MESMA curva de sky.js#_nightFactor — duplicada de propósito (importar sky.js
// puxaria Three/DOM para o módulo puro; inhauma-city.js faz o mesmo).
const _smooth = (t) => t * t * (3 - 2 * t);
/** 1.0 na escuridão total, 0.0 de dia. tod 0..1 (0 = meia-noite). */
export function nightFactor(tod) {
  if (tod < 0.1) return 1.0;
  if (tod < 0.20) return 1.0 - _smooth((tod - 0.1) / 0.10);
  if (tod < 0.80) return 0.0;
  if (tod < 0.90) return _smooth((tod - 0.80) / 0.10);
  return 1.0;
}
