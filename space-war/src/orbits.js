// orbits.js — Movimento orbital cinemático (Kepler relativo) e rotação axial.
// Planetas orbitam o seu centro (Sol na origem, ou o baricentro do binário); luas
// orbitam o planeta-pai; o par buraco-negro + estrela-de-nêutrons dança em torno do
// baricentro. Só a NAVE sofre gravidade de verdade (gravity.js) — os corpos seguem
// trilhos previsíveis (problema restrito, estável).

import { EARTH_YEAR } from './config.js';
import { game } from './state.js';

export function initOrbits() {
  for (const b of game.bodies) {
    if (b.isSun) { b.period = b.def.spin; continue; }
    if (b.isMoon || b.binaryPair) continue;   // período já definido na config
    b.period = EARTH_YEAR * b.def.periodFactor;
  }
}

export function updateOrbits(dt) {
  // 1) Par binário (buraco negro ↔ estrela de nêutrons) em torno do baricentro.
  for (const b of game.bodies) {
    if (!b.binaryPair) continue;
    b.pairPhase += ((Math.PI * 2) / b.period) * dt;
    const c = b.barycenter;
    b.worldPos.set(
      c.x + Math.cos(b.pairPhase) * b.pairRadius,
      c.y,
      c.z + Math.sin(b.pairPhase) * b.pairRadius,
    );
    b.group.position.copy(b.worldPos);
  }

  // 2) Planetas em torno do seu centro (Sol na origem ou baricentro do binário).
  for (const b of game.bodies) {
    if (b.isSun || b.isMoon || b.binaryPair) continue;
    const w = (Math.PI * 2) / b.period;
    b.angle += w * dt;
    const r = b.orbit;
    const tilt = b.def.tilt || 0;
    const c = b.orbitCenter;
    b.worldPos.set(
      c.x + Math.cos(b.angle) * r,
      c.y + Math.sin(b.angle) * r * Math.sin(tilt),
      c.z + Math.sin(b.angle) * r,
    );
    b.group.position.copy(b.worldPos);
    b.mesh.rotation.y += ((Math.PI * 2) / b.spin) * dt;
  }

  // 3) Luas em torno do planeta-pai (usa worldPos já atualizado).
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

  // 4) Sol gira (o par binário tem rotação própria animada em updateBodyFX).
  if (game.sun) game.sun.mesh.rotation.y += ((Math.PI * 2) / game.sun.def.spin) * dt;
}
