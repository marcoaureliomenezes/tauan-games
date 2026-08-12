// physics.js — Física ARCADE do carro (espírito Cruis'n: generosa mas com
// personalidade). Estado por carro: pos (Vector3), heading (rad), v (u/s),
// vy (vertical), airborne, sHint (progresso na spline p/ busca local).
//
// Leis:
//  · aceleração: a = accel·throttle·(1 − v/topSpeed) − arrasto(superfície)
//  · direção: yawRate = steer·handling·grip_ef·f(v) — em terra o carro
//    ESCORREGA (grip menor → curva mais aberta + deriva lateral)
//  · superfície: asfalto/terra/fora-da-pista mudam grip, arrasto e RUMBLE
//    (tremulação: shake de câmera + micro-ruído no heading)
//  · LOMBADA: o Y do carro segue a estrada; se a estrada CAI mais rápido que
//    a gravidade permite (crista de lombada em alta velocidade), o carro
//    DECOLA: vy balístico, sem grip no ar, pouso com afundada de suspensão.

import * as THREE from '../../vendor/three.module.min.js';

export const GRAV = 28;

export function makeCarState(carDef, spawn, heading) {
  return {
    def: carDef,
    pos: spawn.clone(),
    heading,                       // rad, 0 = -Z
    v: 0, vy: 0,
    airborne: false,
    lat: 0,                        // deriva lateral (u/s)
    sHint: 0,
    lap: 1, lastS: 0, progress: 0,
    rumble: 0, suspension: 0, susV: 0,
    roll: 0, rollV: 0, flippedT: 0,     // capotamento (rad, rad/s, tempo de ponta-cabeça)
    finished: false,
  };
}

export function forwardOf(heading) {
  return new THREE.Vector3(-Math.sin(heading), 0, -Math.cos(heading));
}

const _fwd = new THREE.Vector3();
const _side = new THREE.Vector3();

// input: { throttle 0..1, brake 0..1, steer -1..1 }
export function stepCar(st, input, world, dt) {
  const d = st.def;
  // bug M1: deslocamento plausível de s NESTE substep (viagem ×2 de margem) —
  // perto de hairpins o vizinho mais próximo pode ser da OUTRA perna da pista;
  // a validação rejeita essa captura e ancora no segmento do sHint.
  const maxDS = (Math.abs(st.v) + Math.abs(st.lat)) * dt * 2 / world.trackLen
    + 2.5 / world.track.samples.length;
  const q = world.surfaceAt(st.pos.x, st.pos.z, st.sHint, maxDS);
  if (!q.rejected) st.sHint = q.s;               // s rejeitado NUNCA volta p/ sHint
  const phys = q.phys;
  // grip efetivo: carro × superfície (+ bônus Adventure/pickup na terra)
  let grip = d.grip * phys.grip;
  if (q.surface === 'dirt') grip = Math.min(1, grip + d.dirtBonus * 0.5);
  if (st.airborne) grip = 0;
  // WS-5 (modo Fuga): PNEU FURADO — perda de grip + arrasto forte por 2 s
  if (st.punctureT > 0) {
    grip *= 0.55;
    st.v *= Math.max(0, 1 - 0.9 * dt);
    st.punctureT -= dt;
  }

  // --- longitudinal (com MARCHA À RÉ: freio com carro parado recua) ---
  // NITRO (v0.8.0): input.nitro=1 → acel ×1,8 + teto de velocidade +25%.
  // O RECURSO (carga/regen) vive no main.js (simStep, por substep); aqui só
  // o efeito mecânico. Permitido no ar (Cruis'n style) — a decisão é do caller.
  const nitro = input.nitro ? 1 : 0;
  const topSpeed = d.topSpeed * (q.surface === 'offroad' ? 0.55 : 1) * (nitro ? 1.25 : 1);
  const capsized = Math.abs(st.roll) > 0.6;            // capotado: sem tração
  const drive = capsized ? 0 : d.accel * (nitro ? 1.8 : 1) * input.throttle * Math.max(0, 1 - Math.max(st.v, 0) / topSpeed);
  const dragF = (0.35 * phys.drag + 0.012 * Math.abs(st.v) * phys.drag) * Math.sign(st.v || 0);
  let dv = (drive - dragF) * dt;
  if (input.brake > 0) {
    if (st.v > 0.5) dv -= d.brake * input.brake * dt;                 // freando
    else if (!capsized) dv -= d.accel * 0.55 * input.brake * dt;      // RÉ
  }
  st.v += dv;
  // sem TETO duro: acima do topSpeed o motor não empurra (termo 1−v/top) e o
  // EXCESSO (impulso de colisão) decai suave por arrasto — um teto duro
  // destruía a quantidade de movimento transferida nas batidas.
  const vMax = topSpeed * 1.15;
  if (st.v > vMax) st.v -= (st.v - vMax) * Math.min(1, 2.5 * dt);
  st.v = Math.max(-topSpeed * 0.28, st.v);
  if (input.brake === 0 && input.throttle === 0 && Math.abs(st.v) < 0.4) st.v = 0;

  // --- direção ---
  const av = Math.abs(st.v);
  const speedF = av / (av + 14);                        // parado não gira
  // operador 2026-08-10: FALLOFF em alta velocidade — ~30% menos sensibilidade
  // perto do top speed (o volante ficava nervoso demais no retão).
  const yawRate = input.steer * d.handling * speedF * (0.45 + 0.55 * grip)
    * (1 / (1 + av / 150))
    * Math.sign(st.v || 1);                             // em RÉ o volante inverte
  if (!capsized) st.heading += yawRate * dt;
  // deriva: parte da curva vira deslize lateral quando o grip não segura
  const slide = input.steer * Math.abs(st.v) * (1 - grip) * 0.5;
  st.lat += (slide - st.lat) * Math.min(1, 4 * dt);

  // --- rumble (terra/fora): tremulação ∝ velocidade ---
  const targetRumble = phys.rumble * Math.min(1, Math.abs(st.v) / 30);
  st.rumble += (targetRumble - st.rumble) * Math.min(1, 6 * dt);
  // ruído escalado por dt (timestep fixo: era por FRAME — a 120 Hz dobrava)
  if (st.rumble > 0.05) st.heading += (Math.random() - 0.5) * 0.02 * st.rumble * Math.min(1, dt * 60);

  // --- integra posição ---
  _fwd.set(-Math.sin(st.heading), 0, -Math.cos(st.heading));
  _side.set(-_fwd.z, 0, _fwd.x);
  st.pos.addScaledVector(_fwd, st.v * dt);
  st.pos.addScaledVector(_side, st.lat * dt);

  // --- COLISÃO com a cerca/guard-rail (operador 2026-07-18): a cerca é
  // BARREIRA SÓLIDA, não fantasma. Bater raspando arranha e perde velocidade;
  // bater de frente RICOCHETEIA o carro de volta para a pista.
  const q2 = world.surfaceAt(st.pos.x, st.pos.z, st.sHint, maxDS);
  if (!q2.rejected) st.sHint = q2.s;             // s rejeitado NUNCA volta p/ sHint
  // WS-5: largura LOCAL (trechos tipados do sprint) e trechos SEM cerca
  // (fenceless — estradões de terra: pode sair p/ o offroad, sem muro).
  const FENCE = (q2.w ?? world.def.width) / 2 + FENCE_OFF;
  st.hitWall = false;
  if (!q2.fenceless && q2.dist > FENCE) {
    // BARREIRA UNILATERAL (full-scan 2026-08-11): só contém quem cruzou a
    // cerca NESTE substep. Se `over` excede o deslocamento possível num
    // substep, a cerca "apareceu" longe do carro — retomada de cerca após
    // trecho FENCELESS (estradões de terra do sprint) ou estreitamento de
    // largura (pista dupla → single). O clamp incondicional TELEPORTAVA o
    // carro 20–66 m para dentro num único substep ("muro invisível"). Agora
    // o carro segue fora da pista e retorna pelo flanco, sem pop.
    const over = q2.dist - FENCE;
    const travel = (Math.abs(st.v) + Math.abs(st.lat)) * dt;
    if (over <= travel + 1.2) {
    const dx = st.pos.x - q2.cx, dz = st.pos.z - q2.cz;
    const dl = Math.hypot(dx, dz) || 1;
    const nx = dx / dl, nz = dz / dl;                  // normal para FORA
    st.pos.x = q2.cx + nx * FENCE;
    st.pos.z = q2.cz + nz * FENCE;
    // componente da velocidade (frente + deriva) contra a cerca → ricochete
    const fhx = -Math.sin(st.heading), fhz = -Math.cos(st.heading);
    const vx = fhx * st.v - fhz * st.lat, vz = fhz * st.v + fhx * st.lat;
    const vOut = vx * nx + vz * nz;                    // >0 = indo contra a cerca
    // bug M1: captura REJEITADA (perna errada) só clampa posição/grip do
    // segmento válido — SEM ricochete de parede que não está ali.
    if (!q2.rejected && vOut > 0) {
      st.wallImpact = vOut;                        // WS-5: dano do modo Fuga
      const rvx = vx - 1.6 * vOut * nx;                // reflete (restituição 0.6)
      const rvz = vz - 1.6 * vOut * nz;
      const impact = vOut / Math.max(Math.hypot(vx, vz), 1e-3); // 0 raspão → 1 frontal
      // SEM teleporte do nariz: a velocidade refletida vira componentes
      // frente/lateral do carro (heading intacto) + guinada CONTÍNUA p/ dentro
      applyVel(st, rvx * (1 - 0.5 * impact), rvz * (1 - 0.5 * impact));
      let dAng = Math.atan2(-rvx, -rvz) - st.heading;  // nariz gira LIMITADO p/ o quique
      while (dAng > Math.PI) dAng -= 2 * Math.PI;
      while (dAng < -Math.PI) dAng += 2 * Math.PI;
      st.heading += Math.max(-0.4, Math.min(0.4, dAng)) * (0.35 + 0.65 * impact);
      st.suspension -= 0.10 * impact;                  // tranco na suspensão
      st.rumble = Math.min(1.6, st.rumble + 0.9 * impact);
      if (impact > 0.55 && Math.abs(st.v) > 22) st.rollV += (Math.random() < 0.5 ? -1 : 1) * impact * 2.6;
      st.hitWall = true;
    }
    }
  }

  // --- vertical: segue a estrada (Y INTERPOLADO no segmento — sem degraus/
  // saltito); crista rápida = DECOLA ---
  const roadY = q2.roadY;
  if (st.airborne) {
    st.vy -= GRAV * dt;
    st.pos.y += st.vy * dt;
    // arrasto de ar leve em voo (operador 2026-08-10): o carro é PROJETADO,
    // não foguete — ~6%/s de perda horizontal até o pouso.
    const airDrag = Math.max(0, 1 - 0.06 * dt);
    st.v *= airDrag;
    st.lat *= airDrag;
    if (st.pos.y <= roadY) {                            // pouso
      st.airborne = false;
      st.pos.y = roadY;
      st.susV -= Math.min(18, Math.abs(st.vy)) * 0.09;  // afundada CRISP de suspensão
      st.vy = 0;
    }
  } else {
    const dy = roadY - st.pos.y;
    const climbV = dy / Math.max(dt, 1e-4);
    if (climbV < -9 && st.v > 18) {                     // estrada caiu: voa
      st.airborne = true;
      // PROJEÇÃO Cruis'n (operador 2026-08-10): vy acompanha a taxa de queda
      // da crista (×1,1; era ×0,35 — salto tímido) com teto 3+v·0,16: a 60 u/s
      // sai ~12,6 u/s (~0,9 s de voo), a 76 u/s ~15,2 u/s (~1,1 s, ~80 u).
      st.vy = Math.max(2.5, -climbV * 1.1);             // arremesso da crista
      st.vy = Math.min(st.vy, 3 + st.v * 0.16);
    } else {
      st.pos.y = roadY;
      st.vy = 0;
    }
  }

  // --- CAPOTAMENTO (operador 2026-07-18): impactos fortes rolam o carro;
  // de ponta-cabeça ele perde tração e em 2 s desvira sozinho.
  if (Math.abs(st.rollV) > 0.01 || Math.abs(st.roll) > 0.01) {
    st.roll += st.rollV * dt;
    st.rollV *= Math.max(0, 1 - 2.2 * dt);              // atrito de rolagem
    st.roll = Math.max(-Math.PI, Math.min(Math.PI, st.roll));
    if (Math.abs(st.roll) > 2.2) {                      // de ponta-cabeça
      st.flippedT += dt;
      st.v *= Math.max(0, 1 - 3 * dt);                  // arrasto de teto no chão
      if (st.flippedT > 2) {                            // desvira em 2 s
        st.roll *= Math.max(0, 1 - 6 * dt);
        if (Math.abs(st.roll) < 0.15) { st.roll = 0; st.rollV = 0; st.flippedT = 0; }
      }
    } else if (Math.abs(st.rollV) < 0.25) {
      st.roll *= Math.max(0, 1 - 5 * dt);               // tombo leve volta sozinho
      if (Math.abs(st.roll) < 0.02) { st.roll = 0; st.rollV = 0; st.flippedT = 0; }
    }
  }

  // --- suspensão (pitch/afundada visual) — mola amortecida ---
  st.susV += (-st.suspension * 60 - st.susV * 14) * dt;
  st.suspension += st.susV * dt;

  // --- progresso de volta ---
  const s = q2.s;
  if (st.lastS > 0.9 && s < 0.1) st.lap += 1;           // cruzou a largada
  if (st.lastS < 0.1 && s > 0.9) st.lap -= 1;           // marcha ré na linha
  st.lastS = s;
  st.progress = st.lap + s;

  return q2;
}

// Distância centerline→COLISOR da cerca. Bug M3: o colisor (+2.1) ficava
// DENTRO da cerca visual (+2.4, world.js buildFences) — o carro "batia no ar"
// antes de tocar a cerca. Agora 0.15 para FORA do plano visual: o contato
// acontece exatamente na cerca visível.
const FENCE_OFF = 2.55;

// bug M5: após o empurrão carro-carro (collideCars), re-clampa SÓ A POSIÇÃO
// na cerca — sem ricochete nem mudança de velocidade: o carro foi EMPURRADO
// para fora, não "entrou no muro" (antes o clamp do próximo frame refletia
// como se ele tivesse dirigido contra a parede).
export function clampToFence(st, world) {
  const q = world.surfaceAt(st.pos.x, st.pos.z, st.sHint);
  if (q.fenceless) return;                       // WS-5: terra sem cerca
  const FENCE = (q.w ?? world.def.width) / 2 + FENCE_OFF;
  if (q.dist <= FENCE) return;
  // full-scan 2026-08-11: carro MUITO além da cerca (veio de um trecho
  // fenceless ou foi empurrado p/ o offroad aberto) — re-clampar seria um
  // teleporte de dezenas de metros. Barreira unilateral: ele volta pelo
  // flanco. Só re-clampa o empurrão local do collideCars (bug M5).
  if (q.dist > FENCE + 1.5) return;
  const dx = st.pos.x - q.cx, dz = st.pos.z - q.cz;
  const dl = Math.hypot(dx, dz) || 1;
  st.pos.x = q.cx + (dx / dl) * FENCE;
  st.pos.z = q.cz + (dz / dl) * FENCE;
}

// bug M4: colisor por veículo — CÁPSULA 2D ao longo do eixo do carro, com o
// comprimento/largura REAIS do modelo (def.colLen/colWid, registrados no
// normalize() do cars.js). O círculo único CAR_R=2.1 disparava ~0,9 u no ar
// ao lado do caminhão (6,5 u) e deixava nariz/rabeta sem colisor. h=0
// degenera para o círculo barato de antes (carros "redondos").
function capsuleOf(st) {
  const len = st.def.colLen || 4.3, wid = st.def.colWid || 2.0;
  const r = Math.min(wid, len) / 2;
  const h = Math.max(0, len / 2 - r);
  const fx = -Math.sin(st.heading), fz = -Math.cos(st.heading);
  return { x: st.pos.x, z: st.pos.z, fx, fz, h, r };
}

// pontos mais próximos entre dois segmentos 2D (Ericson, RTCD 5.1.9)
function closestSegSeg(a, b) {
  const d1x = a.fx * a.h * 2, d1z = a.fz * a.h * 2;
  const d2x = b.fx * b.h * 2, d2z = b.fz * b.h * 2;
  const p1x = a.x - a.fx * a.h, p1z = a.z - a.fz * a.h;
  const p2x = b.x - b.fx * b.h, p2z = b.z - b.fz * b.h;
  const rx = p1x - p2x, rz = p1z - p2z;
  const A = d1x * d1x + d1z * d1z, E = d2x * d2x + d2z * d2z;
  const B = d1x * d2x + d1z * d2z, C = d1x * rx + d1z * rz, F = d2x * rx + d2z * rz;
  const EPS = 1e-9, clamp01 = (v) => Math.max(0, Math.min(1, v));
  let s, t;
  if (A <= EPS && E <= EPS) { s = 0; t = 0; }
  else if (A <= EPS) { s = 0; t = clamp01(F / E); }
  else if (E <= EPS) { t = 0; s = clamp01(-C / A); }
  else {
    const den = A * E - B * B;
    s = den > EPS ? clamp01((B * F - C * E) / den) : 0;
    t = clamp01((B * s + F) / E);
    s = clamp01((B * t - C) / A);
  }
  return [p1x + d1x * s, p1z + d1z * s, p2x + d2x * t, p2z + d2z * t];
}

export function collideCars(a, b) {
  const ca = capsuleOf(a), cb = capsuleOf(b);
  const [ax, az, bx, bz] = closestSegSeg(ca, cb);
  const minD = ca.r + cb.r;
  let nx = bx - ax, nz = bz - az;
  const d2 = nx * nx + nz * nz;
  if (d2 >= minD * minD) return false;
  let d = Math.sqrt(d2);
  if (d < 1e-6) {                          // eixos cruzados: separa pelos centros
    nx = b.pos.x - a.pos.x; nz = b.pos.z - a.pos.z;
    d = Math.hypot(nx, nz) || 1;
  }
  nx /= d; nz /= d;
  const overlap = (minD - Math.min(Math.sqrt(d2), minD)) / 2;
  a.pos.x -= nx * overlap; a.pos.z -= nz * overlap;
  b.pos.x += nx * overlap; b.pos.z += nz * overlap;
  const afx = -Math.sin(a.heading), afz = -Math.cos(a.heading);
  const bfx = -Math.sin(b.heading), bfz = -Math.cos(b.heading);
  const avx = afx * a.v - afz * a.lat, avz = afz * a.v + afx * a.lat;
  const bvx = bfx * b.v - bfz * b.lat, bvz = bfz * b.v + bfx * b.lat;
  const aN = avx * nx + avz * nz, bN = bvx * nx + bvz * nz;
  const closing = aN - bN;
  if (closing <= 0) return true;
  // ELÁSTICA 1-D com MASSAS REAIS ao longo da normal (conserva p = mv):
  // carro leve que acerta caminhão perde muito; caminhão acertado voa pouco —
  // e o atingido SEMPRE herda impulso (nada de teto de velocidade engolindo).
  const ma = a.def.mass || 1.2, mb = b.def.mass || 1.2, e = 0.35; // carros amassam, não quicam
  const pSum = ma * aN + mb * bN;
  const aN2 = (pSum + mb * e * (bN - aN)) / (ma + mb);
  const bN2 = (pSum + ma * e * (aN - bN)) / (ma + mb);
  const navx = avx + (aN2 - aN) * nx, navz = avz + (aN2 - aN) * nz;
  const nbvx = bvx + (bN2 - bN) * nx, nbvz = bvz + (bN2 - bN) * nz;
  applyVel(a, navx, navz);
  applyVel(b, nbvx, nbvz);
  // pancada lateral forte: induz CAPOTAMENTO
  if (closing > 26) {
    const side = Math.sign(nx * Math.cos(b.heading) - nz * Math.sin(b.heading)) || 1;
    b.rollV += side * closing * 0.09;
    a.rollV -= side * closing * 0.05;
  }
  a.rumble = Math.min(1.6, a.rumble + 0.5);
  b.rumble = Math.min(1.6, b.rumble + 0.5);
  return true;
}

// Aplica uma velocidade nova SEM teleportar o nariz (bug "movimento não
// contínuo"): decompõe em componente FRENTE (st.v) e LATERAL (st.lat) do
// carro. O empurrão lateral decai naturalmente no laço de deriva do stepCar.
function applyVel(st, vx, vz) {
  const fx = -Math.sin(st.heading), fz = -Math.cos(st.heading);
  st.v = vx * fx + vz * fz;
  st.lat = vx * -fz + vz * fx;
}
