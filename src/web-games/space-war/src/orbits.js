// orbits.js — Movimento dos corpos em DOIS regimes:
//
//  1. TRILHOS keplerianos (sistemas hierárquicos estáveis): Sol/Betelgeuse e seus
//     planetas/luas, e o par BN+pulsar em torno do baricentro — previsível, barato.
//  2. N-CORPOS INTEGRADO (sistema caótico 'chaotic'): estrelas e planetas se
//     atraem de VERDADE — velocity-Verlet (simplético, sem drift secular de
//     energia), softening de Plummer (F ∝ 1/(r²+ε²)) e passos FIXOS
//     sub-amostrados (dt variável quebraria a simpleticidade).
//     (O núcleo galáctico saiu do integrador em 2026-07-02: estrelas S em
//      trilho ELÍPTICO kepleriano — calmas, previsíveis e "seguíveis".)
//
// Só a NAVE sofre gravidade em gravity.js; aqui é o universo se movendo.

import { EARTH_YEAR, SYSTEMS } from './config.js';
import { game } from './state.js';

const SUBSTEP = 1 / 90;    // s — passo fixo do integrador
const MAX_FRAME = 0.08;    // clamp (troca de aba não explode o integrador)
let _acc = 0;

export function initOrbits() {
  for (const b of game.bodies) {
    if (b.isSun) { b.period = b.def.spin; continue; }
    if (b.isMoon || b.binaryPair || b.dynamic || b.ellipse) continue;
    if (b.period == null) b.period = EARTH_YEAR * (b.def.periodFactor || 1);
  }
}

// ── Forças do enxame dinâmico (todos os pares do MESMO sistema + âncora) ─────
function computeDynAccels() {
  const dyn = game.dynBodies;
  for (const b of dyn) b.acc.set(0, 0, 0);
  for (let i = 0; i < dyn.length; i++) {
    const A = dyn[i];
    const eps2A = A.softening * A.softening;
    // âncora estática (SMBH pinado no centro do núcleo galáctico)
    if (A.anchor) {
      const P = A.anchor.worldPos;
      const dx = P.x - A.worldPos.x, dy = P.y - A.worldPos.y, dz = P.z - A.worldPos.z;
      const r2 = dx * dx + dy * dy + dz * dz + eps2A;
      const inv = A.anchor.mu / (r2 * Math.sqrt(r2));
      A.acc.x += dx * inv; A.acc.y += dy * inv; A.acc.z += dz * inv;
    }
    for (let j = i + 1; j < dyn.length; j++) {
      const B = dyn[j];
      if (A.system !== B.system) continue;
      const dx = B.worldPos.x - A.worldPos.x;
      const dy = B.worldPos.y - A.worldPos.y;
      const dz = B.worldPos.z - A.worldPos.z;
      const r2 = dx * dx + dy * dy + dz * dz + eps2A;
      const invR3 = 1 / (r2 * Math.sqrt(r2));
      const aA = B.mu * invR3, aB = A.mu * invR3;
      A.acc.x += dx * aA; A.acc.y += dy * aA; A.acc.z += dz * aA;
      B.acc.x -= dx * aB; B.acc.y -= dy * aB; B.acc.z -= dz * aB;
    }
  }
}

// Reinjeção: caos ejeta corpos; quem passa de 2.2× o raio do sistema volta numa
// órbita tangencial nova (o enxame nunca morre — é um espetáculo contínuo).
function recycleEscapees() {
  for (const b of game.dynBodies) {
    const sys = b.systemDef;
    const cx = sys.center[0], cy = sys.center[1], cz = sys.center[2];
    const dx = b.worldPos.x - cx, dy = b.worldPos.y - cy, dz = b.worldPos.z - cz;
    const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (d < sys.radius * 2.2) continue;
    const r = b.reinjectR * (0.7 + Math.random() * 0.6);
    const ang = Math.random() * Math.PI * 2;
    b.worldPos.set(cx + Math.cos(ang) * r, cy + (Math.random() - 0.5) * r * 0.25, cz + Math.sin(ang) * r);
    const vC = Math.sqrt(b.centralMu / r);
    // tangente no plano XZ (± sentido aleatório) com jitter — volta caótico
    const s = Math.random() < 0.5 ? 1 : -1;
    b.vel.set(-Math.sin(ang) * vC * s, (Math.random() - 0.5) * vC * 0.15, Math.cos(ang) * vC * s);
  }
}

function integrateDynamics(dt) {
  const dyn = game.dynBodies;
  if (!dyn.length) return;
  _acc = Math.min(_acc + Math.min(dt, MAX_FRAME), 0.25);
  while (_acc >= SUBSTEP) {
    _acc -= SUBSTEP;
    const h = SUBSTEP;
    // velocity-Verlet: x += v·h + ½a·h² ; a' ; v += ½(a+a')·h
    for (const b of dyn) {
      b.worldPos.x += b.vel.x * h + 0.5 * b.acc.x * h * h;
      b.worldPos.y += b.vel.y * h + 0.5 * b.acc.y * h * h;
      b.worldPos.z += b.vel.z * h + 0.5 * b.acc.z * h * h;
      b._pax = b.acc.x; b._pay = b.acc.y; b._paz = b.acc.z;
    }
    computeDynAccels();
    for (const b of dyn) {
      b.vel.x += 0.5 * (b._pax + b.acc.x) * h;
      b.vel.y += 0.5 * (b._pay + b.acc.y) * h;
      b.vel.z += 0.5 * (b._paz + b.acc.z) * h;
    }
  }
  recycleEscapees();
  for (const b of dyn) {
    b.group.position.copy(b.worldPos);
    if (b.mesh && b.spin) b.mesh.rotation.y += ((Math.PI * 2) / b.spin) * dt;
  }
}

export function updateOrbits(dt) {
  // 1) Par binário (buraco negro ↔ estrela de nêutrons) em torno do baricentro.
  for (const b of game.bodies) {
    if (!b.binaryPair) continue;
    const w = (Math.PI * 2) / b.period;
    b.pairPhase += w * dt;
    const c = b.barycenter;
    b.worldPos.set(
      c.x + Math.cos(b.pairPhase) * b.pairRadius,
      c.y,
      c.z + Math.sin(b.pairPhase) * b.pairRadius,
    );
    b.group.position.copy(b.worldPos);
    // aceleração do trilho (SHM): a = −ω²·(pos−centro) — EXATA para o círculo
    if (!b.worldAcc) b.worldAcc = b.worldPos.clone().set(0, 0, 0);
    b.worldAcc.set(c.x, c.y, c.z).sub(b.worldPos).multiplyScalar(w * w);
  }

  // 1b) TRILHO ELÍPTICO KEPLERIANO (estrelas S do núcleo galáctico, errantes):
  //     r(θ)=p/(1+e·cosθ), avanço por anomalia verdadeira θ̇=h/r² — forma EXATA
  //     da elipse, custo ~zero, sem drift. A aceleração de FRAME do corpo é a
  //     gravidade REAL do SMBH no ponto do trilho, a = −μ·r̂/r² (exata p/ elipse,
  //     melhor que o SHM circular) → orbitar/SEGUIR uma estrela em movimento
  //     fecha redondo, igual à Terra em volta do Sol.
  for (const b of game.bodies) {
    const el = b.ellipse;
    if (!el) continue;
    const r0 = el.p / (1 + el.e * Math.cos(el.theta));
    el.theta += (el.h / (r0 * r0)) * dt * el.dir;
    const r = el.p / (1 + el.e * Math.cos(el.theta));
    b.worldPos.copy(el.center)
      .addScaledVector(el.u, Math.cos(el.theta) * r)
      .addScaledVector(el.v, Math.sin(el.theta) * r);
    b.group.position.copy(b.worldPos);
    if (b.spin && b.mesh) b.mesh.rotation.y += ((Math.PI * 2) / b.spin) * dt;
    if (!b.worldAcc) b.worldAcc = b.worldPos.clone().set(0, 0, 0);
    b.worldAcc.copy(el.center).sub(b.worldPos);
    const d = Math.max(1e-6, b.worldAcc.length());
    b.worldAcc.multiplyScalar(el.mu / (d * d * d));
  }

  // 2) Planetas/companheiras EM TRILHO em torno do seu centro (Sol, Betelgeuse…).
  for (const b of game.bodies) {
    if (b.isSun || b.isMoon || b.binaryPair || b.dynamic || b.ellipse || !b.orbitCenter) continue;
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
    if (b.spin) b.mesh.rotation.y += ((Math.PI * 2) / b.spin) * dt;
    // aceleração do trilho (SHM em cada coordenada): a = −ω²·(pos−centro).
    // A NAVE recebe esta aceleração de FRAME quando este corpo domina (gravity.js)
    // → no frame co-móvel a dinâmica vira Kepler puro e a órbita FECHA redonda.
    if (!b.worldAcc) b.worldAcc = b.worldPos.clone().set(0, 0, 0);
    b.worldAcc.set(c.x, c.y, c.z).sub(b.worldPos).multiplyScalar(w * w);
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
    if (b.spin) b.mesh.rotation.y += ((Math.PI * 2) / b.spin) * dt;
    // frame da lua = SHM local + aceleração do pai (composição de frames)
    if (!b.worldAcc) b.worldAcc = b.worldPos.clone().set(0, 0, 0);
    b.worldAcc.set(p.x, p.y, p.z).sub(b.worldPos).multiplyScalar(w * w);
    if (b.parent.worldAcc) b.worldAcc.add(b.parent.worldAcc);
  }

  // 4) Sistemas CAÓTICOS: N-corpos de verdade.
  integrateDynamics(dt);

  // 5) Rotação axial das estrelas fixas (primárias pinadas).
  for (const b of game.bodies) {
    if (b.isSun && b.mesh && b.def.spin) {
      b.mesh.rotation.y += ((Math.PI * 2) / b.def.spin) * dt;
    }
  }

  // 6) VELOCIDADE DE MUNDO de cada corpo (diferença finita nos trilhos; o
  //    integrador já conhece a sua). Essencial para ÓRBITAS em torno de corpos
  //    que se MOVEM: a nave precisa co-mover com o planeta (frame relativo).
  if (dt > 0) {
    for (const b of game.bodies) {
      if (!b.worldVel) { b.worldVel = b.worldPos.clone().set(0, 0, 0); b._pvp = b.worldPos.clone(); continue; }
      if (b.dynamic && b.vel) { b.worldVel.copy(b.vel); b._pvp.copy(b.worldPos); continue; }
      b.worldVel.copy(b.worldPos).sub(b._pvp).multiplyScalar(1 / dt);
      b._pvp.copy(b.worldPos);
    }
  }
}
