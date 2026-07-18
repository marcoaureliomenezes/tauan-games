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

  // --- longitudinal ---
  const topSpeed = d.topSpeed * (q.surface === 'offroad' ? 0.55 : 1);
  const drive = d.accel * input.throttle * Math.max(0, 1 - st.v / topSpeed);
  const dragF = 0.35 * phys.drag + 0.012 * st.v * phys.drag;
  st.v += (drive - dragF - d.brake * input.brake * (st.v > 0 ? 1 : 0)) * dt;
  if (st.v < 0) st.v = 0;

  // --- direção ---
  const speedF = st.v / (st.v + 14);                    // parado não gira
  const yawRate = input.steer * d.handling * speedF * (0.45 + 0.55 * grip);
  st.heading += yawRate * dt;
  // deriva: parte da curva vira deslize lateral quando o grip não segura
  const slide = input.steer * st.v * (1 - grip) * 0.5;
  st.lat += (slide - st.lat) * Math.min(1, 4 * dt);

  // --- rumble (terra/fora): tremulação ∝ velocidade ---
  const targetRumble = phys.rumble * Math.min(1, st.v / 30);
  st.rumble += (targetRumble - st.rumble) * Math.min(1, 6 * dt);
  if (st.rumble > 0.05) st.heading += (Math.random() - 0.5) * 0.02 * st.rumble;

  // --- integra posição ---
  _fwd.set(-Math.sin(st.heading), 0, -Math.cos(st.heading));
  _side.set(-_fwd.z, 0, _fwd.x);
  st.pos.addScaledVector(_fwd, st.v * dt);
  st.pos.addScaledVector(_side, st.lat * dt);

  // --- corredor: além do acostamento, parede macia empurra de volta ---
  const q2 = world.surfaceAt(st.pos.x, st.pos.z, st.sHint);
  const maxDist = world.def.width / 2 + 9;
  if (q2.dist > maxDist) {
    const sm = q2.sm;
    const dx = st.pos.x - sm.pos.x, dz = st.pos.z - sm.pos.z;
    const dl = Math.hypot(dx, dz) || 1;
    st.pos.x = sm.pos.x + (dx / dl) * maxDist;
    st.pos.z = sm.pos.z + (dz / dl) * maxDist;
    st.v *= (1 - 1.6 * dt);
    st.lat = 0;
  }

  // --- vertical: segue a estrada; crista rápida = DECOLA ---
  const roadY = q2.sm.pos.y;
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

  // --- suspensão (pitch/afundada visual) — mola amortecida ---
  st.susV += (-st.suspension * 60 - st.susV * 9) * dt;
  st.suspension += st.susV * dt;

  // --- progresso de volta ---
  const s = q2.s;
  if (st.lastS > 0.9 && s < 0.1) st.lap += 1;           // cruzou a largada
  if (st.lastS < 0.1 && s > 0.9) st.lap -= 1;           // marcha ré na linha
  st.lastS = s;
  st.progress = st.lap + s;

  return q2;
}
