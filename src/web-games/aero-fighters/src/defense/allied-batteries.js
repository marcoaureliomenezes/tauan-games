// defense/allied-batteries.js — Baterias AA ALIADAS do modo 'inhauma-defense'
// (T-D-08, release v0.3.5): 3-5 posições seedadas no
// morro (perto do jogador) e na base, ancoradas no terreno real. Fogo
// autônomo contra caças no alcance: tracers ricos visualmente + míssil
// ocasional com chance de acerto baixa (ALLY_BATT_HIT_P ~5-10% — quem decide
// a batalha é o jogador). Destrutíveis: attack-run inimigo as vira carcaça
// fumegante (wreck → o modo registra um smoke emitter persistente) e elas
// PARAM de atirar.
// T-D-03 (release v0.3.10): +1 bateria DEDICADA
// da retaguarda ("minha retaguarda é protegida por outra bateria antiaérea") —
// posição FIXA no setor traseiro (lado oposto do morro em relação a LOOK_AT, a
// REAR_BATT_DIST m do soldado), alvo preferencial = caças no setor traseiro
// (±60° do eixo reverso visto do soldado) ou mirando o jogador, e engajamento
// EFETIVO (REAR_BATT_HIT_P ≥ 0.5, alcance 900 m, ciclo de míssil mais rápido).
// Lógica PURA — sem Three.js/DOM. Exporta:
//   placeAlliedBatteries, stepBattery, stepAllyMissile, damageBattery,
//   rearAxis, isRearThreat.

import { AA_DEFENSE } from '../config.js';

/** T-D-03: eixo-traseiro unitário (de LOOK_AT para o SOLDIER, em x/z). */
export function rearAxis(cfg = AA_DEFENSE) {
  const dx = cfg.SOLDIER_POS.x - cfg.LOOK_AT.x;
  const dz = cfg.SOLDIER_POS.z - cfg.LOOK_AT.z;
  const d = Math.hypot(dx, dz) || 1e-9;
  return { x: dx / d, z: dz / d };
}

/** T-D-03: o caça é ameaça da retaguarda? Verdadeiro se está no setor traseiro
 *  (bearing visto do SOLDIER a ±60° do eixo-traseiro — REAR_BATT_SECTOR_COS)
 *  ou se o alvo atual dele é o jogador (caça anti-artilheiro vindo por trás). */
export function isRearThreat(f, cfg = AA_DEFENSE) {
  if (f.target?.kind === 'player') return true;
  const ax = rearAxis(cfg);
  const dx = f.x - cfg.SOLDIER_POS.x;
  const dz = f.z - cfg.SOLDIER_POS.z;
  const d = Math.hypot(dx, dz);
  if (d < 1e-6) return false;
  return (dx * ax.x + dz * ax.z) / d >= cfg.REAR_BATT_SECTOR_COS;
}

/**
 * Posiciona as baterias. 1-2 no morro perto do soldado, o resto em anel na
 * base militar, +1 FIXA da retaguarda (T-D-03, flag rearGuard).
 * @param ctx {heightAt(x,z), soldier:{x,z}, base:{x,z}}
 * @returns {Array} registros {x,y,z,yaw,hp,dead,wreck,cool,mslT,mesh,rearGuard}
 */
export function placeAlliedBatteries(rng, ctx, cfg = AA_DEFENSE) {
  const count = Math.round(cfg.ALLY_BATTERIES[0] +
    rng() * (cfg.ALLY_BATTERIES[1] - cfg.ALLY_BATTERIES[0]));
  const onHill = count >= 4 ? 2 : 1;
  const list = [];
  for (let i = 0; i < count; i++) {
    const hill = i < onHill;
    const ang = rng() * Math.PI * 2;
    const rad = hill ? 22 + rng() * 40 : 55 + rng() * 90;
    const cx = hill ? ctx.soldier.x : ctx.base.x;
    const cz = hill ? ctx.soldier.z : ctx.base.z;
    const x = cx + Math.cos(ang) * rad;
    const z = cz + Math.sin(ang) * rad;
    list.push({
      x, z, y: ctx.heightAt(x, z),
      yaw: rng() * Math.PI * 2,
      hp: cfg.ALLY_BATT_HP, maxHp: cfg.ALLY_BATT_HP,
      dead: false, wreck: false, rearGuard: false,
      cool: rng() * 0.5, mslT: cfg.ALLY_BATT_MSL_S * (0.5 + rng()),
      mesh: null,
    });
  }
  // T-D-03: a bateria da retaguarda — posição determinística no eixo-traseiro.
  const ax = rearAxis(cfg);
  const rx = ctx.soldier.x + ax.x * cfg.REAR_BATT_DIST;
  const rz = ctx.soldier.z + ax.z * cfg.REAR_BATT_DIST;
  list.push({
    x: rx, z: rz, y: ctx.heightAt(rx, rz),
    yaw: Math.atan2(-ax.x, -ax.z), // cano de serviço apontado para a retaguarda
    hp: cfg.ALLY_BATT_HP, maxHp: cfg.ALLY_BATT_HP,
    dead: false, wreck: false, rearGuard: true,
    cool: 0, mslT: cfg.REAR_BATT_MSL_S,
    mesh: null,
  });
  return list;
}

/**
 * Fogo autônomo da bateria contra o caça vivo mais próximo no alcance. A
 * bateria da retaguarda (rearGuard, T-D-03) PRIORIZA ameaças do setor traseiro
 * (isRearThreat) e usa os parâmetros REAR_BATT_* (alcance longo, acerto alto).
 * @param ctx {rng, fighters:[{x,y,z,vx,vy,vz,dead,target?}]}
 * @returns {Array} eventos {type:'tracer', from, dir, speed} |
 *   {type:'missile', from, target, willHit} — vazio se morta/sem alvo.
 */
export function stepBattery(b, dt, ctx, cfg = AA_DEFENSE) {
  const ev = [];
  if (b.dead) return ev; // carcaça fumegante NÃO atira
  const range = b.rearGuard ? cfg.REAR_BATT_RANGE : cfg.ALLY_BATT_RANGE;
  const rps = b.rearGuard ? cfg.REAR_BATT_RPS : cfg.ALLY_BATT_RPS;
  const s = b.rearGuard ? cfg.REAR_BATT_SPREAD : cfg.ALLY_BATT_SPREAD;
  let best = null, bestD2 = Infinity, bestPrio = false;
  for (const f of ctx.fighters) {
    if (f.dead) continue;
    const dx = f.x - b.x, dy = f.y - b.y, dz = f.z - b.z;
    const d2 = dx * dx + dy * dy + dz * dz;
    if (d2 >= range * range) continue;
    const prio = !!b.rearGuard && isRearThreat(f, cfg);
    if (best && prio === bestPrio && d2 >= bestD2) continue; // mais longe no mesmo tier
    if (best && !prio && bestPrio) continue;                 // prioridade vence distância
    best = f; bestD2 = d2; bestPrio = prio;
  }
  if (!best) return ev;
  const from = { x: b.x, y: b.y + 1.7, z: b.z };
  // Tracers: cadência rica, dispersão alta (eficácia mecânica baixa).
  b.cool -= dt;
  if (b.cool <= 0) {
    b.cool += 1 / rps;
    const lead = Math.sqrt(bestD2) / 150; // lead grosseiro pelo tempo de voo
    let dx = best.x + best.vx * lead - from.x;
    let dy = best.y + best.vy * lead - from.y;
    let dz = best.z + best.vz * lead - from.z;
    const d = Math.hypot(dx, dy, dz) || 1e-9;
    dx /= d; dy /= d; dz /= d;
    ev.push({
      type: 'tracer', from,
      dir: {
        x: dx + (ctx.rng() * 2 - 1) * s,
        y: dy + (ctx.rng() * 2 - 1) * s,
        z: dz + (ctx.rng() * 2 - 1) * s,
      },
      speed: 150,
    });
  }
  // Míssil ocasional: chance de acerto rolada NO DISPARO (seedada).
  b.mslT -= dt;
  if (b.mslT <= 0) {
    const mslS = b.rearGuard ? cfg.REAR_BATT_MSL_S : cfg.ALLY_BATT_MSL_S;
    const hitP = b.rearGuard ? cfg.REAR_BATT_HIT_P : cfg.ALLY_BATT_HIT_P;
    b.mslT = mslS * (0.7 + ctx.rng() * 0.6);
    ev.push({ type: 'missile', from, target: best, willHit: ctx.rng() < hitP });
  }
  return ev;
}

/**
 * Um passo do míssil aliado (homing simples). Acerto só se willHit (rolado
 * no disparo) — do contrário faz uma curva de "quase acerto" e expira.
 * @returns {null|{impact:{x,y,z}, hit:boolean, target}}
 */
export function stepAllyMissile(m, dt, ctx, cfg = AA_DEFENSE) {
  m.life -= dt;
  const t = m.target;
  if (t && !t.dead) {
    const dx = t.x - m.x, dy = t.y - m.y, dz = t.z - m.z;
    const d = Math.hypot(dx, dy, dz) || 1e-9;
    const s = cfg.ALLY_BATT_MSL_SPEED;
    // MISS: mira num ponto deslocado acima do caça (curva plausível, nunca acerta).
    const ox = m.willHit ? 0 : 24, oy = m.willHit ? 0 : 30;
    const k = Math.min(1, 3.2 * dt);
    m.vx += ((dx + ox) / d * s - m.vx) * k;
    m.vy += ((dy + oy) / d * s - m.vy) * k;
    m.vz += (dz / d * s - m.vz) * k;
    if (m.willHit && d < 10) return { impact: { x: m.x, y: m.y, z: m.z }, hit: true, target: t };
  }
  m.x += m.vx * dt; m.y += m.vy * dt; m.z += m.vz * dt;
  if (m.y <= ctx.heightAt(m.x, m.z)) return { impact: { x: m.x, y: m.y, z: m.z }, hit: false, target: null };
  if (m.life <= 0 || !t || t.dead) return { impact: { x: m.x, y: m.y, z: m.z }, hit: false, target: null };
  return null;
}

/**
 * Dano numa bateria (impacto AG inimigo). @returns {boolean} true na MORTE —
 * o modo então a vira carcaça: explosão + smoke emitter persistente (wreck).
 */
export function damageBattery(b, dmg) {
  if (b.dead) return false;
  b.hp -= dmg;
  if (b.hp > 0) return false;
  b.dead = true;
  b.wreck = true;
  return true;
}
