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

// Aceleração |a| = μ/r² de um corpo, com clamp de singularidade dentro do corpo.
function _accelOf(b, dist) {
  const r = Math.max(dist, b.def.radius * 0.85);
  return b.mu / (r * r);
}

const _partnerPull = new THREE.Vector3();

export function computeGravity(pos, out) {
  out.set(0, 0, 0);

  // 1) Corpo dominante = menor SOI que contém a nave (o mais local) — preserva a
  //    hierarquia patched-conics (Terra governa perto da Terra, Sol no interplanetário).
  let dominant = null, domSoi = Infinity, domDist = 0;
  for (const b of game.bodies) {
    const dist = b.worldPos.distanceTo(pos);
    if (dist < b.soi && b.soi < domSoi) { dominant = b; domSoi = b.soi; domDist = dist; }
  }

  // 2) FIX (bug "buraco negro sem atração"): fora de TODOS os SOIs não existe mais
  //    zona morta de gravidade nula — o corpo de MAIOR aceleração real domina o vazio
  //    (na prática: o Sol ou o buraco negro, que alcança através do interestelar).
  if (!dominant) {
    let bestA = 0;
    for (const b of game.bodies) {
      const dist = b.worldPos.distanceTo(pos);
      const a = _accelOf(b, dist);
      if (a > bestA) { bestA = a; dominant = b; domDist = dist; }
    }
    if (!dominant) {
      return {
        dominant: null, gravMag: 0, noReturn: false, dist: Infinity, altitude: Infinity,
        escapeVel: 0, circVel: 0, canEscape: true, pull: out,
      };
    }
  }

  // 3) FIX binário: perto do par BH+NS os DOIS parceiros puxam (campo de um sistema
  //    binário de verdade — nenhum domina sozinho; o "menor SOI" escolhia sempre a
  //    estrela de nêutrons e o buraco negro nunca atraía). O dominante do HUD é o
  //    parceiro de maior aceleração real.
  let partner = null;
  if (dominant.binaryPair) {
    for (const b of game.bodies) {
      if (b !== dominant && b.binaryPair) { partner = b; break; }
    }
    if (partner) {
      const distP = partner.worldPos.distanceTo(pos);
      if (_accelOf(partner, distP) > _accelOf(dominant, domDist)) {
        const tmp = dominant; dominant = partner; partner = tmp;
        domDist = distP;
      }
    }
  }

  const surf = dominant.def.radius;
  const r = Math.max(domDist, surf * 0.85);          // evita singularidade dentro do corpo
  const a = _accelOf(dominant, domDist);              // |aceleração| do corpo dominante
  out.copy(dominant.worldPos).sub(pos).multiplyScalar(a / Math.max(domDist, 1e-6));
  let gravMag = a;
  if (partner) {
    const distP = partner.worldPos.distanceTo(pos);
    const aP = _accelOf(partner, distP);
    _partnerPull.copy(partner.worldPos).sub(pos).multiplyScalar(aP / Math.max(distP, 1e-6));
    out.add(_partnerPull);
    gravMag = out.length();
  }

  const circVel = Math.sqrt(dominant.mu / r);         // v_circular = √(μ/r) — órbita estável
  const escapeVel = circVel * Math.SQRT2;             // v_escape   = √(2μ/r)
  const canEscape = MAX_ESCAPE_SPEED > escapeVel * 1.05;
  const noReturn = !canEscape;                        // gravidade vence a nave → sem volta

  return {
    dominant, gravMag, noReturn, dist: domDist, altitude: domDist - surf,
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
