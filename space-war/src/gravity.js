// gravity.js — Gravidade sobre a NAVE no modelo PATCHED-CONICS (estilo Kerbal).
// Cada corpo tem uma esfera de influência (SOI). O corpo dominante é o de MENOR SOI
// que contém a nave (o mais local) — e SÓ ele aplica gravidade. Isso é o que torna
// ÓRBITAS possíveis e estáveis em torno de QUALQUER corpo (a Terra te governa perto da
// Terra; o Sol governa o espaço interplanetário; o buraco negro governa o seu sistema).
// "Todo corpo tem gravidade" = todo corpo te puxa dentro do seu SOI.
//
// Devolve também a análise de voo orbital: velocidade de órbita circular v_circ=√(μ/r),
// de escape v_esc=√(2μ/r), e se a nave consegue escapar com sua velocidade máxima.

import * as THREE from '../../vendor/three.module.min.js';
import { MAX_ESCAPE_SPEED } from './config.js';
import { game } from './state.js';

export function computeGravity(pos, out) {
  out.set(0, 0, 0);

  // Corpo dominante = menor SOI que contém a nave (o mais local).
  let dominant = null, domSoi = Infinity, domDist = 0;
  for (const b of game.bodies) {
    const dist = b.worldPos.distanceTo(pos);
    if (dist < b.soi && b.soi < domSoi) { dominant = b; domSoi = b.soi; domDist = dist; }
  }

  if (!dominant) {
    return {
      dominant: null, gravMag: 0, noReturn: false, dist: Infinity, altitude: Infinity,
      escapeVel: 0, circVel: 0, canEscape: true, pull: out,
    };
  }

  const surf = dominant.def.radius;
  const r = Math.max(domDist, surf * 0.85);          // evita singularidade dentro do corpo
  const a = dominant.mu / (r * r);                    // |aceleração| do corpo dominante
  out.copy(dominant.worldPos).sub(pos).multiplyScalar(a / Math.max(domDist, 1e-6));

  const circVel = Math.sqrt(dominant.mu / r);         // v_circular = √(μ/r) — órbita estável
  const escapeVel = circVel * Math.SQRT2;             // v_escape   = √(2μ/r)
  const canEscape = MAX_ESCAPE_SPEED > escapeVel * 1.05;
  const noReturn = !canEscape;                        // gravidade vence a nave → sem volta

  return {
    dominant, gravMag: a, noReturn, dist: domDist, altitude: domDist - surf,
    escapeVel, circVel, canEscape, pull: out,
  };
}

// Detecta colisão / contato com a superfície (ou horizonte) do corpo mais próximo.
export function surfaceContact(pos, margin = 0) {
  for (const b of game.bodies) {
    const d = b.worldPos.distanceTo(pos);
    if (d < b.def.radius + margin) return { body: b, depth: b.def.radius + margin - d };
  }
  return null;
}
