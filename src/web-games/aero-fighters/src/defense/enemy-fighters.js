// defense/enemy-fighters.js — Caças inimigos do modo 'inhauma-defense'
// (T-D-06 estados + T-D-10 queda cinematográfica). Ciclo seedado: ingress →
// attack-run (mergulho + release) → egress (jinks) → re-ingress (novo alvo ou
// despawn após FIGHTER_RUNS_MAX). Alvos 45/30/15/10; lock AA = chaff+evasão.
// Abatido: startDying → 'dying' (spiral/glide/dive por RNG, sink acelerando,
// debris, ejeção 20%); stepDying até o impacto no terreno real.
// Lógica 100% PURA (Node-testável; o mesh vive em defense-mode.js).
// Exporta: FIGHTER_STATES, FALL_STYLES, pickTargetKind, pickFighterTarget,
//   spawnFighter, stepFighter, startDying, stepDying.
import { AA_DEFENSE } from '../config.js';

/** Estados canônicos do caça (ordem do ciclo de ataque). */
export const FIGHTER_STATES = ['ingress', 'attack-run', 'egress', 're-ingress'];

const wrapPi = (a) => ((((a + Math.PI) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)) - Math.PI;
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
// ─── Seleção de alvo (pesos 45/30/15/10) ─────────────────────────────────────
/** Sorteia o TIPO de alvo pelos pesos. rng injetado (determinístico). */
export function pickTargetKind(rng, weights = AA_DEFENSE.TARGET_WEIGHTS) {
  const total = weights.reduce((s, w) => s + w[1], 0);
  let roll = rng() * total;
  for (const [kind, w] of weights) {
    roll -= w;
    if (roll < 0) return kind;
  }
  return weights[weights.length - 1][0];
}

/** Resolve um alvo concreto. sets {city, base, battery, player} — listas vivas
 *  montadas pelo modo. Fallbacks: sem bateria → cidade; sem cidade → base. */
export function pickFighterTarget(rng, sets, weights = AA_DEFENSE.TARGET_WEIGHTS) {
  let kind = pickTargetKind(rng, weights);
  if (kind === 'battery' && !sets.battery.length) kind = 'city';
  if (kind === 'city' && !sets.city.length) kind = 'base';
  if (kind === 'city') {
    const s = sets.city[Math.floor(rng() * sets.city.length)];
    return { kind, x: s.x, y: s.topY ?? 6, z: s.z, ref: s };
  }
  if (kind === 'base') {
    const b = sets.base[Math.floor(rng() * sets.base.length)];
    return { kind, x: b.x, y: b.y, z: b.z, ref: b };
  }
  if (kind === 'battery') {
    const b = sets.battery[Math.floor(rng() * sets.battery.length)];
    return { kind, x: b.x, y: b.y + 2, z: b.z, ref: b };
  }
  return { kind: 'player', x: sets.player.x, y: sets.player.y, z: sets.player.z, ref: null };
}

// ─── Spawn + kinemática ──────────────────────────────────────────────────────
/** Cria o registro do caça (sem mesh — defense-mode anexa o visual). */
export function spawnFighter(rng, ctx, cfg = AA_DEFENSE) {
  const ang = rng() * Math.PI * 2; // direção de bússola seedada
  const dist = cfg.FIGHTER_SPAWN_DIST * (0.9 + rng() * 0.2);
  const x = ctx.center.x + Math.cos(ang) * dist;
  const z = ctx.center.z + Math.sin(ang) * dist;
  const target = pickFighterTarget(rng, ctx.targetSets, cfg.TARGET_WEIGHTS);
  return {
    x, z,
    y: cfg.FIGHTER_SPAWN_ALT[0] + rng() * (cfg.FIGHTER_SPAWN_ALT[1] - cfg.FIGHTER_SPAWN_ALT[0]),
    vx: 0, vy: 0, vz: 0,
    yaw: Math.atan2(-(target.x - x), -(target.z - z)), pitch: 0,
    speed: cfg.FIGHTER_SPEED[0] + rng() * (cfg.FIGHTER_SPEED[1] - cfg.FIGHTER_SPEED[0]),
    state: 'ingress', stateT: 0,
    target,
    hp: Math.round(cfg.FIGHTER_HP[0] + rng() * (cfg.FIGHTER_HP[1] - cfg.FIGHTER_HP[0])),
    hr2: cfg.FIGHTER_HIT_R * cfg.FIGHTER_HIT_R,
    dead: false, falling: false,
    // T-D-10: campos da queda (preenchidos por startDying)
    fallStyle: null, roll: 0, sink: 0, spinDir: 1, debrisLeft: 0, debrisT: 0, eject: false,
    runs: 0, released: 0, releaseT: 0, gunT: 0, gunElapsed: 0, plan: null,
    locked: false, evadeT: 0, evadeDir: 1,
    jinkFreq: 1.6 + rng() * 1.8, jinkSign: rng() < 0.5 ? -1 : 1,
    flybyPlayed: false,
    mesh: null,
  };
}

/** Voo suave em direção a um ponto: yaw/pitch rate-limited; extraYaw = jinks. */
function flyTowards(f, dt, tx, ty, tz, extraYaw, cfg) {
  const dx = tx - f.x, dy = ty - f.y, dz = tz - f.z;
  const dYaw = wrapPi(Math.atan2(-dx, -dz) + extraYaw - f.yaw);
  const turn = (f.evadeT > 0 ? cfg.FIGHTER_EVADE_TURN : cfg.FIGHTER_TURN_RATE) * dt;
  f.yaw = wrapPi(f.yaw + clamp(dYaw, -turn, turn) + (f.evadeT > 0 ? f.evadeDir * cfg.FIGHTER_EVADE_TURN * dt : 0));
  const horiz = Math.hypot(dx, dz) || 1e-9;
  const dPitch = clamp(Math.atan2(dy, horiz), -0.72, 0.62) - f.pitch;
  const pRate = cfg.FIGHTER_PITCH_RATE * dt;
  f.pitch += clamp(dPitch, -pRate, pRate);
  const cp = Math.cos(f.pitch);
  f.vx = -Math.sin(f.yaw) * cp * f.speed;
  f.vz = -Math.cos(f.yaw) * cp * f.speed;
  f.vy = Math.sin(f.pitch) * f.speed;
  f.x += f.vx * dt; f.y += f.vy * dt; f.z += f.vz * dt;
}

/** Plano da corrida (seedado no attack-run): cidade/base/bateria = 1-2
 *  mísseis AG; jogador = míssil (50%) ou rajada. */
function planAttack(f, rng, cfg) {
  if (f.target.kind === 'player') {
    f.plan = { kind: rng() < 0.5 ? 'missile' : 'guns' };
  } else {
    f.plan = { kind: 'missile', count: 1 + (rng() < 0.5 ? 1 : 0) }; // 1-2 AG
  }
  f.released = 0; f.releaseT = 0; f.gunT = 0; f.gunElapsed = 0;
}

/** Avança o caça um frame. ctx {heightAt(x,z), rng, targetSets, center}.
 *  @returns {Array} eventos {type:'release'|'gun'|'chaff'|'despawn', ...} */
export function stepFighter(f, dt, ctx, cfg = AA_DEFENSE) {
  const ev = [];
  if (f.dead) return ev;
  f.stateT += dt;
  // Evasão pós-lock: chaff/flare 1x + quebra dura (defete o envelope da PN).
  if (f.locked && f.evadeT <= 0) {
    f.evadeT = cfg.FIGHTER_EVADE_S;
    f.evadeDir = ctx.rng() < 0.5 ? -1 : 1;
    ev.push({ type: 'chaff', x: f.x, y: f.y, z: f.z });
  }
  if (f.evadeT > 0) {
    f.evadeT -= dt;
    if (f.evadeT <= 0) f.locked = false;
  }
  const t = f.target;
  const distT = Math.hypot(t.x - f.x, t.z - f.z);

  if (f.state === 'ingress') {
    const alt = Math.max(ctx.heightAt(t.x, t.z) + 190, t.y + 170);
    flyTowards(f, dt, t.x, alt, t.z, 0, cfg);
    if (distT < cfg.FIGHTER_ATTACK_DIST && f.evadeT <= 0) {
      f.state = 'attack-run'; f.stateT = 0;
      planAttack(f, ctx.rng, cfg);
    }
  } else if (f.state === 'attack-run') {
    flyTowards(f, dt, t.x, t.y + 10, t.z, 0, cfg);
    // Janela de release: entra em RELEASE_DIST, fecha no ABORT (egress).
    if (distT <= cfg.FIGHTER_RELEASE_DIST && distT > cfg.FIGHTER_ABORT_DIST) {
      if (f.plan.kind === 'missile' && f.released < (f.plan.count ?? 1)) {
        f.releaseT -= dt;
        if (f.releaseT <= 0) {
          f.releaseT = 0.35; // mísseis escalonados
          f.released += 1;
          ev.push({ type: 'release', x: f.x, y: f.y, z: f.z, dir: norm(f), target: t });
        }
      } else if (f.plan.kind === 'guns' && f.gunElapsed <= cfg.FIGHTER_GUN_S) {
        f.gunElapsed += dt; // rajada dura FIGHTER_GUN_S DENTRO da janela
        f.gunT -= dt;
        if (f.gunT <= 0) {
          f.gunT = 1 / cfg.FIGHTER_GUN_RPS;
          ev.push({ type: 'gun', x: f.x, y: f.y, z: f.z, dir: norm(f), target: t });
        }
      }
    }
    if (distT <= cfg.FIGHTER_ABORT_DIST || f.y <= t.y + cfg.FIGHTER_DIVE_CLR + 14) {
      f.state = 'egress'; f.stateT = 0; f.runs += 1;
    }
  } else if (f.state === 'egress') {
    // Sobe AFASTANDO do alvo, com jinks seedados (serpenteio anti-AA).
    const away = Math.atan2(f.x - t.x, f.z - t.z);
    const jink = Math.sin(f.stateT * f.jinkFreq) * cfg.FIGHTER_JINK * f.jinkSign;
    flyTowards(f, dt,
      f.x + Math.sin(away) * 500, f.y + 220, f.z + Math.cos(away) * 500, jink, cfg);
    if (f.stateT >= cfg.FIGHTER_EGRESS_S) { f.state = 're-ingress'; f.stateT = 0; }
  } else { // re-ingress
    if (f.runs >= cfg.FIGHTER_RUNS_MAX) {
      // Sai de cena: voa para longe do centro até o despawn.
      flyTowards(f, dt,
        ctx.center.x + (f.x - ctx.center.x) * 3, f.y + 260,
        ctx.center.z + (f.z - ctx.center.z) * 3, 0, cfg);
      if (Math.hypot(f.x - ctx.center.x, f.z - ctx.center.z) > cfg.FIGHTER_SPAWN_DIST * 1.15) {
        ev.push({ type: 'despawn' });
      }
    } else {
      f.target = pickFighterTarget(ctx.rng, ctx.targetSets, cfg.TARGET_WEIGHTS);
      f.state = 'ingress'; f.stateT = 0;
    }
  }

  // Clamp de terreno: clearance relaxada SÓ na janela de mergulho.
  const ground = ctx.heightAt(f.x, f.z);
  const clr = f.state === 'attack-run' ? cfg.FIGHTER_DIVE_CLR : cfg.FIGHTER_TERRAIN_CLR;
  if (f.y < ground + clr) f.y = ground + clr;
  return ev;
}

/** Direção unitária do voo (nariz = -Z com yaw=0). */
function norm(f) {
  const cp = Math.cos(f.pitch);
  return { x: -Math.sin(f.yaw) * cp, y: Math.sin(f.pitch), z: -Math.cos(f.yaw) * cp };
}

// ─── T-D-10: queda cinematográfica (estado terminal 'dying') ─────────────────
/** Estilos de queda sorteados por RNG no abate. */
export const FALL_STYLES = ['spiral', 'glide', 'dive'];

/** Marca o caça como abatido e sorteia a queda: estilo (spiral = parafuso
 *  fechando / glide = descida longa e rasa / dive = pique quase vertical),
 *  2-4 sheds de debris e 20% de ejeção. NÃO é alvo nem travável (dead=true).
 *  @returns {string} o estilo sorteado (telemetria/teste). */
export function startDying(f, rng, cfg = AA_DEFENSE) {
  f.dead = true; f.falling = true; f.state = 'dying'; f.stateT = 0;
  f.fallStyle = FALL_STYLES[Math.floor(rng() * FALL_STYLES.length) % FALL_STYLES.length];
  f.spinDir = rng() < 0.5 ? -1 : 1;
  f.roll = 0; f.sink = 8; // sink inicial — acelera até o regime do estilo
  const [dMin, dMax] = cfg.FALL_DEBRIS;
  f.debrisLeft = dMin + Math.floor(rng() * (dMax - dMin + 1));
  f.debrisT = 0.5 + rng() * 0.6;
  f.eject = rng() < cfg.FALL_EJECT_P;
  return f.fallStyle;
}

/** Um passo da queda. Sink monotônico (nunca sobe, sem NaN — o impacto no
 *  terreno real é garantido). ctx {heightAt(x,z), rng}.
 *  @returns {Array} eventos {type:'shed',...} | {type:'impact', x,y,z, style}. */
export function stepDying(f, dt, ctx, cfg = AA_DEFENSE) {
  const ev = [];
  if (!f.falling) return ev;
  f.stateT += dt;
  const [s0, s1] = cfg.FALL_SINK[f.fallStyle];
  const target = s0 + (s1 - s0) * Math.min(1, f.stateT / 2.2); // rampa do estilo
  f.sink = Math.min(target, f.sink + cfg.FALL_GRAVITY * dt);
  if (f.fallStyle === 'spiral') {
    // Parafuso fechando: yaw gira cada vez mais rápido, roll acompanha.
    f.yaw = wrapPi(f.yaw + f.spinDir * (1.6 + f.stateT * 0.7) * dt);
    f.roll += f.spinDir * 3.2 * dt;
    f.speed = Math.max(18, f.speed * (1 - 0.22 * dt));
  } else if (f.fallStyle === 'glide') {
    // Descida longa e rasa, roll lento de um lado ao outro.
    f.roll = Math.sin(f.stateT * 1.1) * 0.55 * f.spinDir;
    f.speed = Math.max(30, f.speed * (1 - 0.06 * dt));
  } else { // dive — nariz no chão, quase sem velocidade horizontal
    f.roll += f.spinDir * 0.7 * dt;
    f.speed = Math.max(6, f.speed * (1 - 0.5 * dt));
  }
  f.pitch = -Math.atan2(f.sink, f.speed); // nariz acompanha a trajetória
  f.vx = -Math.sin(f.yaw) * f.speed; f.vz = -Math.cos(f.yaw) * f.speed; f.vy = -f.sink;
  f.x += f.vx * dt; f.y += f.vy * dt; f.z += f.vz * dt;
  f.debrisT -= dt; // debris se soltando 2-4× durante a queda
  if (f.debrisT <= 0 && f.debrisLeft > 0) {
    f.debrisLeft -= 1;
    f.debrisT = 0.45 + ctx.rng() * 0.55;
    ev.push({ type: 'shed', x: f.x, y: f.y, z: f.z, vx: f.vx, vy: f.vy, vz: f.vz });
  }
  const ground = ctx.heightAt(f.x, f.z);
  if (f.y <= ground) {
    f.y = ground; f.falling = false;
    ev.push({ type: 'impact', x: f.x, y: ground, z: f.z, style: f.fallStyle });
  }
  return ev;
}
