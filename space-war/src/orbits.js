// orbits.js — Movimento orbital cinemático (Kepler relativo) e rotação axial.
// Planetas orbitam o Sol; luas orbitam o planeta-pai. Só a NAVE sofre gravidade
// de verdade (gravity.js) — os corpos seguem trilhos previsíveis (problema restrito).

import { EARTH_YEAR } from './config.js';
import { game } from './state.js';

export function initOrbits() {
  for (const b of game.bodies) {
    if (b.isSun) { b.period = b.def.spin; continue; }
    if (b.isMoon) continue;               // período já definido na config
    b.period = EARTH_YEAR * b.def.periodFactor;
  }
}

export function updateOrbits(dt) {
  // 1) Planetas em torno do Sol (origem).
  for (const b of game.bodies) {
    if (b.isSun || b.isMoon) continue;
    const w = (Math.PI * 2) / b.period;   // velocidade angular
    b.angle += w * dt;
    const r = b.orbit;
    const tilt = b.def.tilt || 0;
    // Órbita no plano XZ com leve inclinação (a coordenada Y ondula com o ângulo).
    b.worldPos.set(
      Math.cos(b.angle) * r,
      Math.sin(b.angle) * r * Math.sin(tilt),
      Math.sin(b.angle) * r,
    );
    b.group.position.copy(b.worldPos);
    // rotação axial
    b.mesh.rotation.y += ((Math.PI * 2) / b.spin) * dt;
  }
  // 2) Luas em torno do planeta-pai (usa worldPos já atualizado).
  for (const b of game.bodies) {
    if (!b.isMoon) continue;
    const dir = b.retrograde ? -1 : 1;
    const w = dir * (Math.PI * 2) / b.period;
    b.angle += w * dt;
    const r = b.orbit;
    const p = b.parent.worldPos;
    b.worldPos.set(p.x + Math.cos(b.angle) * r, p.y + Math.sin(b.angle) * r * 0.18, p.z + Math.sin(b.angle) * r);
    b.group.position.copy(b.worldPos);
    b.mesh.rotation.y += ((Math.PI * 2) / b.spin) * dt;
  }
  // 3) Sol gira.
  if (game.sun) game.sun.mesh.rotation.y += ((Math.PI * 2) / game.sun.def.spin) * dt;
}
