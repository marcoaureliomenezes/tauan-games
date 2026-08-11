// defense/turret-weapons.js — Lógica PURA das armas da bateria antiaérea
// (T-D-04 .50 / T-D-05 míssil AA, release v0.3.5):
// modelo de calor, dispersão, passo balístico, lock por cone, navegação
// proporcional simplificada, estoque/recarga e o passo dos drones de debug.
// SEM Three.js, SEM DOM — tudo opera sobre {x,y,z} planos e recebe cfg/rng
// injetados: Node-testável (tests/aero-fighters/tools/test-aero-defense-weapons.mjs).
// Os pools visuais (tracers/mísseis) ficam em projectiles.js; o orquestrador
// do modo (defense-mode.js) faz a fiação por frame.
// Exporta: mgFireTick, mgSpreadDir, mgStepBullet, angleOffAxis, pickLockTarget,
//   stepLock, pnStep, stepAaRecharge, consumeAa, createDebugDrones, stepDrone,
//   killDroneState.

import { AA_DEFENSE } from '../config.js';

// ─── T-D-04: calor da .50 ────────────────────────────────────────────────────
// Calor só SOBE atirando (MG_HEAT_PER_SHOT por tiro); parado (ou superaquecido)
// dissipa a MG_COOL_RATE/s. Aos 100% trava (overheated) e só rearma ao cruzar
// MG_RESUME para baixo — pausa forçada de cooldown. `acc` acumula frações de
// tiro para cadência exata (MG_RPS) independente do fps.

/**
 * Avança o estado da .50 por um frame.
 * @param {{heat:number, overheated:boolean, acc:number}} mg estado (turret.mg)
 * @param {number} dt segundos
 * @param {boolean} wantFire gatilho segurado E arma 'mg' E pointer lock
 * @returns {number} tiros a spawnar neste frame (0 em cooldown/overheat)
 */
export function mgFireTick(mg, dt, wantFire, cfg = AA_DEFENSE) {
  let shots = 0;
  if (wantFire && !mg.overheated) {
    mg.acc += cfg.MG_RPS * dt;
    while (mg.acc >= 1 && !mg.overheated) {
      mg.acc -= 1;
      shots += 1;
      mg.heat = Math.min(1, mg.heat + cfg.MG_HEAT_PER_SHOT);
      if (mg.heat >= 1) mg.overheated = true;
    }
  } else {
    mg.acc = 0;
  }
  if (!wantFire || mg.overheated) {
    mg.heat = Math.max(0, mg.heat - cfg.MG_COOL_RATE * dt);
    if (mg.overheated && mg.heat <= cfg.MG_RESUME) mg.overheated = false;
  }
  return shots;
}

/** Direção de disparo com dispersão: perturba `dir` por até `spread` rad em
 *  dois eixos ortogonais ao forward. rng injetado (determinístico nos testes). */
export function mgSpreadDir(dir, rng, spread = AA_DEFENSE.MG_SPREAD) {
  // eixo ortogonal U = up × dir (se dir quase vertical, usa X × dir)
  let ux = -dir.z, uy = 0, uz = dir.x; // up(0,1,0) × dir
  let ul = Math.hypot(ux, uy, uz);
  if (ul < 1e-6) { ux = 0; uy = -dir.z; uz = dir.y; ul = Math.hypot(ux, uy, uz) || 1; }
  ux /= ul; uy /= ul; uz /= ul;
  // V = dir × U
  const vx = dir.y * uz - dir.z * uy;
  const vy = dir.z * ux - dir.x * uz;
  const vz = dir.x * uy - dir.y * ux;
  const a = (rng() * 2 - 1) * spread;
  const b = (rng() * 2 - 1) * spread;
  const ox = dir.x + ux * a + vx * b;
  const oy = dir.y + uy * a + vy * b;
  const oz = dir.z + uz * a + vz * b;
  const l = Math.hypot(ox, oy, oz) || 1;
  return { x: ox / l, y: oy / l, z: oz / l };
}

/** Passo balístico de uma bala .50 {x,y,z,vx,vy,vz,dist}: gravidade leve,
 *  sem arrasto. NÃO hitscan — a posição avança dt a dt (cap via b.dist). */
export function mgStepBullet(b, dt, gravity = AA_DEFENSE.MG_GRAVITY) {
  b.vy -= gravity * dt;
  const dx = b.vx * dt, dy = b.vy * dt, dz = b.vz * dt;
  b.x += dx; b.y += dy; b.z += dz;
  b.dist += Math.hypot(dx, dy, dz);
}

// ─── T-D-05: lock por cone no retículo ───────────────────────────────────────

/** Ângulo (rad) entre o forward do gimbal e a direção origem→alvo. */
export function angleOffAxis(fwd, from, to) {
  const dx = to.x - from.x, dy = to.y - from.y, dz = to.z - from.z;
  const len = Math.hypot(dx, dy, dz) || 1e-9;
  const dot = (fwd.x * dx + fwd.y * dy + fwd.z * dz) / len;
  return Math.acos(Math.min(1, Math.max(-1, dot)));
}

/** Índice do alvo vivo mais PRÓXIMO dentro do cone do retículo, ou -1. */
export function pickLockTarget(origin, fwd, targets, coneRad = AA_DEFENSE.AA_LOCK_CONE) {
  let best = -1, bestD2 = Infinity;
  for (let i = 0; i < targets.length; i++) {
    const t = targets[i];
    if (t.dead) continue;
    if (angleOffAxis(fwd, origin, t) > coneRad) continue;
    const dx = t.x - origin.x, dy = t.y - origin.y, dz = t.z - origin.z;
    const d2 = dx * dx + dy * dy + dz * dz;
    if (d2 < bestD2) { bestD2 = d2; best = i; }
  }
  return best;
}

/** Avança o tracking do lock: troca de candidato ou quebra de feixe (fora do
 *  cone) zera o progresso; AA_LOCK_TIME segundos contínuos travam. Upgrade
 *  (operador 2026-07-19): uma vez travado, o lock PERSISTE por AA_LOCK_HOLD s
 *  mesmo sem feixe — a "identificação dura mais na mira". */
export function stepLock(lock, candidate, dt, lockTime = AA_DEFENSE.AA_LOCK_TIME, holdTime = AA_DEFENSE.AA_LOCK_HOLD ?? 0) {
  if (candidate !== lock.idx) {
    if (lock.locked && holdTime > 0 && (lock.hold ?? 0) < holdTime) {
      lock.hold = (lock.hold ?? 0) + dt; // carência: mantém idx/track/locked
      return lock;
    }
    lock.idx = candidate; lock.track = 0; lock.locked = false; lock.hold = 0;
  }
  if (candidate >= 0) {
    lock.hold = 0;
    lock.track += dt;
    if (lock.track >= lockTime) lock.locked = true;
  }
  return lock;
}

// ─── T-D-05: navegação proporcional simplificada ─────────────────────────────
// Comando clássico a = N · Vc · ω (ω = taxa de rotação da linha de visada),
// com magnitude CAPADA em AA_LAT_ACCEL e velocidade renormalizada para
// AA_SPEED. MISS documentado: o míssil ERRA quando a aceleração lateral
// exigida supera AA_LAT_ACCEL de forma sustentada (alvo quebra mais fechado
// que o envelope — ex.: jink de 90° a curta distância) ou quando AA_LIFE
// expira antes da intercepção (autodestruição).

/**
 * Um passo de PN. @param m {x,y,z,vx,vy,vz} míssil @param t idem alvo
 * @returns {number} distância ao alvo ANTES do passo (para a espoleta).
 */
export function pnStep(m, t, dt, cfg = AA_DEFENSE) {
  const rx = t.x - m.x, ry = t.y - m.y, rz = t.z - m.z;
  const r = Math.hypot(rx, ry, rz) || 1e-9;
  const vrx = t.vx - m.vx, vry = t.vy - m.vy, vrz = t.vz - m.vz;
  // ω = (r × vrel) / r² — eixo de rotação da linha de visada
  const wx = (ry * vrz - rz * vry) / (r * r);
  const wy = (rz * vrx - rx * vrz) / (r * r);
  const wz = (rx * vry - ry * vrx) / (r * r);
  // velocidade de fechamento (positiva = aproximando)
  const vc = -(rx * vrx + ry * vry + rz * vrz) / r;
  // comando PN na forma vetorial: a = N·Vc·(ω × v̂_m) — gira a velocidade do
  // míssil em torno do eixo ω (acelerar ao longo de ω NÃO esterça: ω é o eixo
  // da rotação da LOS, perpendicular ao plano de manobra).
  const vm = Math.hypot(m.vx, m.vy, m.vz) || 1e-9;
  const ux = m.vx / vm, uy = m.vy / vm, uz = m.vz / vm;
  const k = cfg.AA_NAV_N * vc;
  let ax = k * (wy * uz - wz * uy);
  let ay = k * (wz * ux - wx * uz);
  let az = k * (wx * uy - wy * ux);
  const amag = Math.hypot(ax, ay, az);
  if (amag > cfg.AA_LAT_ACCEL) {
    const c = cfg.AA_LAT_ACCEL / amag;
    ax *= c; ay *= c; az *= c;
  }
  m.vx += ax * dt; m.vy += ay * dt; m.vz += az * dt;
  const v = Math.hypot(m.vx, m.vy, m.vz) || 1e-9;
  const s = cfg.AA_SPEED / v;
  m.vx *= s; m.vy *= s; m.vz *= s;
  m.x += m.vx * dt; m.y += m.vy * dt; m.z += m.vz * dt;
  return r;
}

// ─── T-D-05: estoque + recarga lenta ─────────────────────────────────────────

/** Recarga: 1 míssil a cada AA_RECHARGE_S, até AA_STOCK (inerte com estoque ∞).
 *  Também consome o cooldown de cadência (AA_FIRE_INTERVAL — upgrade operador). */
export function stepAaRecharge(turret, dt, cfg = AA_DEFENSE) {
  turret.aaCooldown = Math.max(0, (turret.aaCooldown ?? 0) - dt);
  if (turret.ammo.aa >= cfg.AA_STOCK) { turret.aaRecharge = 0; return; }
  turret.aaRecharge += dt;
  while (turret.aaRecharge >= cfg.AA_RECHARGE_S && turret.ammo.aa < cfg.AA_STOCK) {
    turret.aaRecharge -= cfg.AA_RECHARGE_S;
    turret.ammo.aa += 1;
  }
}

/** Consome 1 míssil do estoque, respeitando a cadência AA_FIRE_INTERVAL (máx 2/s).
 *  @returns {boolean} false se vazio OU em cooldown. */
export function consumeAa(turret, interval = AA_DEFENSE.AA_FIRE_INTERVAL ?? 0) {
  if ((turret.aaCooldown ?? 0) > 0) return false;
  if (turret.ammo.aa <= 0) return false;
  turret.ammo.aa -= 1;
  turret.aaCooldown = interval;
  return true;
}

// ─── T-D-05: drones de DEBUG (Onda D3 substitui por caças reais) ─────────────
// Alvos aéreos lentos em círculo sobre o vale — existem SÓ para exercitar o
// lock/PN/dano da Onda D2. defense-mode cria os meshes; aqui só o estado.

/** Cria os registros dos drones (sem mesh — defense-mode anexa o visual). */
export function createDebugDrones(cfg = AA_DEFENSE) {
  const drones = [];
  for (let i = 0; i < cfg.DEBUG_DRONES; i++) {
    const radius = cfg.DRONE_RADIUS[i % cfg.DRONE_RADIUS.length];
    const d = {
      cx: cfg.LOOK_AT.x, cz: cfg.LOOK_AT.z,
      alt: cfg.DRONE_ALT[i % cfg.DRONE_ALT.length],
      radius,
      angle: (i / cfg.DEBUG_DRONES) * Math.PI * 2,
      angVel: (cfg.DRONE_SPEED / radius) * (i % 2 ? 1 : -1), // giros alternados
      x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0,
      hp: cfg.DRONE_HP, hr2: 49,                  // raio de acerto ~7 m
      dead: false, falling: false, fallVy: 0, respawnT: 0,
      mesh: null, smokeT: 0,
    };
    stepDrone(d, 0, 0, cfg); // posiciona no círculo
    drones.push(d);
  }
  return drones;
}

/** Marca o drone como abatido: começa a queda simples (a queda
 *  cinematográfica — spiral/pique/glide — é da Onda D4). */
export function killDroneState(d) {
  d.dead = true;
  d.falling = true;
  d.fallVy = 0;
}

function respawnDrone(d, cfg) {
  d.dead = false; d.falling = false; d.fallVy = 0;
  d.hp = cfg.DRONE_HP;
  d.angle += Math.PI / 2; // reentra em outro ponto do círculo
  stepDrone(d, 0, 0, cfg);
}

/**
 * Avança um drone. @param groundY cota do terreno sob o drone
 * @returns {string|null} 'falling' | 'crashed' | 'respawned' | null
 */
export function stepDrone(d, dt, groundY, cfg = AA_DEFENSE) {
  if (d.dead) {
    if (d.falling) {
      d.fallVy += 24 * dt;
      d.y -= d.fallVy * dt;
      d.x += d.vx * 0.25 * dt; // deriva residual
      d.z += d.vz * 0.25 * dt;
      d.vx *= 1 - 0.4 * dt; d.vz *= 1 - 0.4 * dt;
      if (d.y <= groundY) {
        d.y = groundY;
        d.falling = false;
        d.respawnT = cfg.DRONE_RESPAWN_S;
        return 'crashed';
      }
      return 'falling';
    }
    d.respawnT -= dt;
    if (d.respawnT <= 0) { respawnDrone(d, cfg); return 'respawned'; }
    return null;
  }
  d.angle += d.angVel * dt;
  d.x = d.cx + Math.cos(d.angle) * d.radius;
  d.z = d.cz + Math.sin(d.angle) * d.radius;
  d.y = d.alt;
  d.vx = -Math.sin(d.angle) * d.angVel * d.radius;
  d.vz = Math.cos(d.angle) * d.angVel * d.radius;
  d.vy = 0;
  return null;
}
