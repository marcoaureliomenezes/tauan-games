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

import * as THREE from '../../../../vendor/three.module.min.js';

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
  const q = world.surfaceAt(st.pos.x, st.pos.z, st.sHint);
  st.sHint = q.s;
  const phys = q.phys;
  // grip efetivo: carro × superfície (+ bônus Adventure/pickup na terra)
  let grip = d.grip * phys.grip;
  if (q.surface === 'dirt') grip = Math.min(1, grip + d.dirtBonus * 0.5);
  if (st.airborne) grip = 0;

  // --- longitudinal (com MARCHA À RÉ: freio com carro parado recua) ---
  const topSpeed = d.topSpeed * (q.surface === 'offroad' ? 0.55 : 1);
  const capsized = Math.abs(st.roll) > 0.6;            // capotado: sem tração
  const drive = capsized ? 0 : d.accel * input.throttle * Math.max(0, 1 - Math.max(st.v, 0) / topSpeed);
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
  const yawRate = input.steer * d.handling * speedF * (0.45 + 0.55 * grip)
    * Math.sign(st.v || 1);                             // em RÉ o volante inverte
  if (!capsized) st.heading += yawRate * dt;
  // deriva: parte da curva vira deslize lateral quando o grip não segura
  const slide = input.steer * Math.abs(st.v) * (1 - grip) * 0.5;
  st.lat += (slide - st.lat) * Math.min(1, 4 * dt);

  // --- rumble (terra/fora): tremulação ∝ velocidade ---
  const targetRumble = phys.rumble * Math.min(1, Math.abs(st.v) / 30);
  st.rumble += (targetRumble - st.rumble) * Math.min(1, 6 * dt);
  if (st.rumble > 0.05) st.heading += (Math.random() - 0.5) * 0.02 * st.rumble;

  // --- integra posição ---
  _fwd.set(-Math.sin(st.heading), 0, -Math.cos(st.heading));
  _side.set(-_fwd.z, 0, _fwd.x);
  st.pos.addScaledVector(_fwd, st.v * dt);
  st.pos.addScaledVector(_side, st.lat * dt);

  // --- COLISÃO com a cerca/guard-rail (operador 2026-07-18): a cerca é
  // BARREIRA SÓLIDA, não fantasma. Bater raspando arranha e perde velocidade;
  // bater de frente RICOCHETEIA o carro de volta para a pista.
  const q2 = world.surfaceAt(st.pos.x, st.pos.z, st.sHint);
  const FENCE = world.def.width / 2 + 2.1;             // cerca visual está a +2.4
  st.hitWall = false;
  if (q2.dist > FENCE) {
    const dx = st.pos.x - q2.cx, dz = st.pos.z - q2.cz;
    const dl = Math.hypot(dx, dz) || 1;
    const nx = dx / dl, nz = dz / dl;                  // normal para FORA
    st.pos.x = q2.cx + nx * FENCE;
    st.pos.z = q2.cz + nz * FENCE;
    // componente da velocidade (frente + deriva) contra a cerca → ricochete
    const fhx = -Math.sin(st.heading), fhz = -Math.cos(st.heading);
    const vx = fhx * st.v - fhz * st.lat, vz = fhz * st.v + fhx * st.lat;
    const vOut = vx * nx + vz * nz;                    // >0 = indo contra a cerca
    if (vOut > 0) {
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

  // --- vertical: segue a estrada (Y INTERPOLADO no segmento — sem degraus/
  // saltito); crista rápida = DECOLA ---
  const roadY = q2.roadY;
  if (st.airborne) {
    st.vy -= GRAV * dt;
    st.pos.y += st.vy * dt;
    if (st.pos.y <= roadY) {                            // pouso
      st.airborne = false;
      st.pos.y = roadY;
      st.susV -= Math.min(14, Math.abs(st.vy)) * 0.06;  // afundada de suspensão
      st.vy = 0;
    }
  } else {
    const dy = roadY - st.pos.y;
    const climbV = dy / Math.max(dt, 1e-4);
    if (climbV < -9 && st.v > 18) {                     // estrada caiu: voa
      st.airborne = true;
      st.vy = Math.max(2.5, -climbV * 0.35);            // arremesso da crista
      st.vy = Math.min(st.vy, 3 + st.v * 0.12);
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

const CAR_R = 2.1;
export function collideCars(a, b) {
  const dx = b.pos.x - a.pos.x, dz = b.pos.z - a.pos.z;
  const d2 = dx * dx + dz * dz;
  const minD = CAR_R * 2;
  if (d2 > minD * minD || d2 < 1e-6) return false;
  const d = Math.sqrt(d2);
  const nx = dx / d, nz = dz / d;
  const overlap = (minD - d) / 2;
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
