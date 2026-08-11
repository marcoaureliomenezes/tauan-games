// defense/enemy-ordnance.js — Ordenança inimiga do modo 'inhauma-defense'
// (T-D-07, release v0.3.5): míssil ar-solo com arco
// balístico → terminal dive sobre o ponto alvo, tracers da rajada anti-jogador
// e a regra de interceptação pela .50 (proximidade < INTERCEPT_R = bônus).
// Lógica PURA — sem Three.js/DOM: registros planos {x,y,z,vx,vy,vz}; o
// defense-mode.js faz os meshes, a trilha de fumaça (spawnMissileSmoke) e os
// impactos (explosion/scorch/spawnPropFire). O telegraph do míssil
// anti-jogador (alarme + #def-alert) também é do modo — aqui só o flag
// `atPlayer`. Exporta: spawnAgMissile, stepAgMissile, spawnEnemyTracer,
//   stepEnemyTracer, tryIntercept.

import { AA_DEFENSE } from '../config.js';

/**
 * Lança um míssil ar-solo de um caça em attack-run.
 * @param from {x,y,z} posição do caça @param dir direção unitária do voo
 * @param target {kind,x,y,z,ref} alvo resolvido (enemy-fighters)
 * @param rng () => 0..1 — varia o impulso do arco (seedado)
 */
export function spawnAgMissile(from, dir, target, rng, cfg = AA_DEFENSE) {
  const dist = Math.hypot(target.x - from.x, target.z - from.z);
  // Impulso vertical do arco: sobe mais quanto mais longe o alvo (arco real).
  const up = Math.min(0.72, 0.28 + dist * 0.0011) * (0.85 + rng() * 0.3);
  const s = cfg.AG_MISSILE_SPEED;
  const flat = Math.sqrt(Math.max(0.05, 1 - up * up));
  return {
    x: from.x, y: from.y, z: from.z,
    vx: dir.x * s * flat, vy: s * up, vz: dir.z * s * flat,
    target, atPlayer: target.kind === 'player',
    life: cfg.AG_LIFE, dead: false, isOrdnance: true,
    hr2: cfg.INTERCEPT_R * cfg.INTERCEPT_R, // alvo da .50 (interceptação)
    smokeT: 0,
  };
}

/**
 * Um passo do míssil AG. Arco (gravidade AG_ARC_GRAVITY) até AG_TERMINAL_DIST
 * do alvo; depois terminal dive guiado ao ponto (velocidade renormalizada).
 * @param ctx {heightAt(x,z)}
 * @returns {null|{impact:{x,y,z,dist}}|{expired:true}} — dist = erro ao alvo.
 */
export function stepAgMissile(m, dt, ctx, cfg = AA_DEFENSE) {
  if (m.dead) return null;
  m.life -= dt;
  const dx = m.target.x - m.x, dz = m.target.z - m.z;
  const dy = m.target.y - m.y;
  const horiz = Math.hypot(dx, dz);
  if (horiz > cfg.AG_TERMINAL_DIST) {
    m.vy -= cfg.AG_ARC_GRAVITY * dt; // fase de arco: balística pura
  } else {
    // Terminal dive: gira a velocidade para o ponto alvo (turn capado).
    const d3 = Math.hypot(dx, dy, dz) || 1e-9;
    const s = cfg.AG_MISSILE_SPEED;
    const wx = (dx / d3) * s, wy = (dy / d3) * s, wz = (dz / d3) * s;
    const k = Math.min(1, cfg.AG_TERMINAL_TURN * dt * 2.2);
    m.vx += (wx - m.vx) * k; m.vy += (wy - m.vy) * k; m.vz += (wz - m.vz) * k;
    const v = Math.hypot(m.vx, m.vy, m.vz) || 1e-9;
    m.vx *= s / v; m.vy *= s / v; m.vz *= s / v;
  }
  m.x += m.vx * dt; m.y += m.vy * dt; m.z += m.vz * dt;
  const dist = Math.hypot(m.target.x - m.x, m.target.y - m.y, m.target.z - m.z);
  const ground = ctx.heightAt(m.x, m.z);
  if (dist <= cfg.AG_HIT_R || m.y <= ground) {
    if (m.y < ground) m.y = ground; // impacto real NA superfície (scorch)
    // T-D-09: kind/atPlayer no evento — o modo roteia o impacto ao diretor
    // (integridade da cidade/derrota) sem re-ler o alvo.
    return { impact: { x: m.x, y: m.y, z: m.z, dist, kind: m.target.kind, atPlayer: m.atPlayer } };
  }
  if (m.life <= 0) return { expired: true };
  return null;
}

/**
 * Um tracer da rajada anti-jogador do caça. Dispersão FIGHTER_GUN_SPREAD,
 * mira no ponto do jogador com lead zero (rajada "no caminho" — justa).
 */
export function spawnEnemyTracer(from, aim, rng, cfg = AA_DEFENSE) {
  let dx = aim.x - from.x, dy = aim.y - from.y, dz = aim.z - from.z;
  const d = Math.hypot(dx, dy, dz) || 1e-9;
  dx /= d; dy /= d; dz /= d;
  const a = (rng() * 2 - 1) * cfg.FIGHTER_GUN_SPREAD;
  const b = (rng() * 2 - 1) * cfg.FIGHTER_GUN_SPREAD;
  const s = cfg.FIGHTER_GUN_SPEED;
  return {
    x: from.x, y: from.y, z: from.z,
    vx: (dx + a) * s, vy: (dy + b) * s, vz: (dz - a) * s,
    life: 3.0,
  };
}

/**
 * Um passo do tracer inimigo.
 * @param ctx {heightAt(x,z), player?{x,y,z}, playerR?} — player p/ acerto.
 * @returns {null|{impact:{x,y,z}}|{playerHit:true}|{expired:true}}
 */
export function stepEnemyTracer(t, dt, ctx) {
  t.life -= dt;
  t.x += t.vx * dt; t.y += t.vy * dt; t.z += t.vz * dt;
  if (ctx.player) {
    const r = ctx.playerR ?? 2.5;
    const dx = t.x - ctx.player.x, dy = t.y - ctx.player.y, dz = t.z - ctx.player.z;
    if (dx * dx + dy * dy + dz * dz < r * r) return { playerHit: true };
  }
  if (t.y <= ctx.heightAt(t.x, t.z)) return { impact: { x: t.x, y: t.y, z: t.z } };
  if (t.life <= 0) return { expired: true };
  return null;
}

/**
 * Regra de interceptação (testável): uma bala .50 a < INTERCEPT_R de um
 * míssil inimigo o destrói no ar (bônus INTERCEPT_BONUS — aplicado pelo modo).
 * @returns {boolean} true quando interceptou (marca m.dead).
 */
export function tryIntercept(bullet, missile, r = AA_DEFENSE.INTERCEPT_R) {
  if (missile.dead) return false;
  const dx = bullet.x - missile.x, dy = bullet.y - missile.y, dz = bullet.z - missile.z;
  if (dx * dx + dy * dy + dz * dz >= r * r) return false;
  missile.dead = true;
  return true;
}
