// gravity.js — Campo gravitacional newtoniano sobre a NAVE.
// accel = Σ mu_i · (p_i - p) / |d|³, ativo só dentro do SOI de cada corpo,
// com falloff suave na borda (modelo patched-conics, estilo Kerbal).
// Identifica o corpo dominante, a magnitude da gravidade e a zona de não-retorno do Sol.

import * as THREE from '../../vendor/three.module.min.js';
import { SUN_NORETURN } from './config.js';
import { game } from './state.js';

const _d = new THREE.Vector3();

export function computeGravity(pos, out) {
  out.set(0, 0, 0);

  // Patched conics: encontra o corpo cujo SOI te contém e é o MENOR (mais local).
  // Só ESSE corpo aplica gravidade — então a Terra te governa perto da Terra, e o
  // Sol não te arranca da superfície. É o que torna órbitas possíveis e estáveis.
  let dominant = null, domSoi = Infinity, domDist = 0;
  for (const b of game.bodies) {
    const dist = b.worldPos.distanceTo(pos);
    if (dist < b.soi && b.soi < domSoi) { dominant = b; domSoi = b.soi; domDist = dist; }
  }

  if (!dominant) return { dominant: null, gravMag: 0, noReturn: false, dist: Infinity, altitude: Infinity };

  const surf = dominant.def.radius;
  const r = Math.max(domDist, surf * 0.9);         // evita singularidade dentro do corpo
  const a = dominant.mu / (r * r);
  _d.copy(dominant.worldPos).sub(pos).multiplyScalar(1 / (domDist || 1));
  out.addScaledVector(_d, a);

  const noReturn = dominant.isSun && domDist < SUN_NORETURN;
  return { dominant, gravMag: a, noReturn, dist: domDist, altitude: domDist - surf };
}

// Detecta colisão / contato com a superfície do corpo dominante.
// Retorna o corpo se a nave estiver tocando/dentro da superfície, senão null.
export function surfaceContact(pos, margin = 0) {
  for (const b of game.bodies) {
    const d = b.worldPos.distanceTo(pos);
    if (d < b.def.radius + margin) return { body: b, depth: b.def.radius + margin - d };
  }
  return null;
}
