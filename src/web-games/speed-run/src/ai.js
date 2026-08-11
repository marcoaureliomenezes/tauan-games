// ai.js — Oponentes: seguem a spline com antecipação de curva (freiam antes),
// lane offset próprio e rubber-band suave (espírito Cruis'n: a corrida fica
// junta, mas quem pilota bem vence).
// WS-5 (modo Fuga): POLÍCIA — persegue o jogador direto (não a spline): alvo =
// posição do jogador quando longe (>14 m); perto, alvo 18 m À FRENTE do
// policial na direção do jogador (overshoot estilo PIT).

import { sampleAt } from './world.js';

export function makeAI(st, laneOffset, skill) {
  st.ai = { laneOffset, skill, lookAhead: 0.012 + Math.random() * 0.006 };
  return st;
}

export function makeChaseAI(st) {
  st.ai = { chase: true, skill: 1 };
  return st;
}

export function aiInput(st, world, player) {
  const ai = st.ai;
  // `player`: estado do jogador (novo) ou número = progresso (compat probes)
  const playerSt = typeof player === 'number' ? null : player;
  const playerProgress = playerSt ? playerSt.progress : player;

  // ── PERSEGUIÇÃO (Fuga): mira o jogador, não a spline ─────────────────────
  if (ai.chase && playerSt) {
    const dx = playerSt.pos.x - st.pos.x, dz = playerSt.pos.z - st.pos.z;
    const d = Math.hypot(dx, dz) || 1e-3;
    // longe: mira o jogador; perto: overshoot PIT 18 m à frente na direção dele
    const tx = d > 14 ? playerSt.pos.x : st.pos.x + (dx / d) * 18;
    const tz = d > 14 ? playerSt.pos.z : st.pos.z + (dz / d) * 18;
    const targetHeading = Math.atan2(-(tx - st.pos.x), -(tz - st.pos.z));
    let dh = targetHeading - st.heading;
    while (dh > Math.PI) dh -= Math.PI * 2;
    while (dh < -Math.PI) dh += Math.PI * 2;
    return {
      throttle: 1,
      brake: d < 8 && st.v > playerSt.v + 4 ? 0.5 : 0,
      steer: Math.max(-1, Math.min(1, dh * 2.2)),
    };
  }

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
