// ai.js — Oponentes: seguem a spline com antecipação de curva (freiam antes),
// lane offset próprio e rubber-band suave (espírito Cruis'n: a corrida fica
// junta, mas quem pilota bem vence).

import { sampleAt } from './world.js';

export function makeAI(st, laneOffset, skill) {
  st.ai = { laneOffset, skill, lookAhead: 0.012 + Math.random() * 0.006 };
  return st;
}

export function aiInput(st, world, playerProgress) {
  const ai = st.ai;
  const ahead = sampleAt(world.track, st.sHint + ai.lookAhead);
  const ahead2 = sampleAt(world.track, st.sHint + ai.lookAhead * 2.6);
  // alvo: ponto adiante com deslocamento de faixa
  const tx = ahead.pos.x + ahead.side.x * ai.laneOffset;
  const tz = ahead.pos.z + ahead.side.z * ai.laneOffset;
  const dx = tx - st.pos.x, dz = tz - st.pos.z;
  const targetHeading = Math.atan2(-dx, -dz);
  let dh = targetHeading - st.heading;
  while (dh > Math.PI) dh -= Math.PI * 2;
  while (dh < -Math.PI) dh += Math.PI * 2;
  const steer = Math.max(-1, Math.min(1, dh * 2.2));

  // curvatura à frente → alvo de velocidade
  const curv = ahead.tan.angleTo(ahead2.tan);
  let vTarget = st.def.topSpeed * ai.skill * (1 - Math.min(0.55, curv * 2.2));
  // rubber-band: atrás do jogador anda mais, na frente relaxa
  const gap = playerProgress - st.progress;
  vTarget *= 1 + Math.max(-0.12, Math.min(0.18, gap * 0.35));

  return {
    throttle: st.v < vTarget ? 1 : 0.1,
    brake: st.v > vTarget * 1.15 ? 0.8 : 0,
    steer,
  };
}
