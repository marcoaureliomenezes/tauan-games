// ballistics.js — Solver de SOLUÇÃO DE TIRO sob o campo gravitacional real.
//
// Pedido do operador (2026-07-03): "C aponta para ONDE LANÇAR — a bomba segue o
// puxão da gravidade (corpo ou combinação de corpos) numa trajetória curva até o
// alvo. Física séria, não estrita." O solver usa o MESMO campo do jogo
// (gravityFn injetada = computeGravity), então tudo que a biblioteca celestial
// puxa — planeta, lua, estrela, buraco negro, marés — dobra o tiro de verdade.
//
// Método (D-1 do SPEC): alvo virtual iterado (shooting method) — simula a
// trajetória com Euler semi-implícito, mede o erro no ponto de maior aproximação
// e desloca o alvo virtual pelo vetor de erro; ≤8 iterações convergem em campos
// suaves. Alvo em movimento: predição linear worldVel·t (D-2). Módulo PURO
// (sem THREE) — testável em node com campo analítico.

function len(x, y, z) { return Math.sqrt(x * x + y * y + z * z); }

/**
 * @param {object} o
 *   pos {x,y,z} — posição de lançamento (nave)
 *   vel {x,y,z} — velocidade da nave (herdada pelo projétil)
 *   speed number — velocidade de ejeção do projétil (relativa à nave)
 *   targetPos {x,y,z} — posição atual do alvo
 *   targetVel {x,y,z}|null — velocidade do alvo (corpo hospedeiro)
 *   gravityFn (p:{x,y,z}, out:{x,y,z}) => void — preenche a aceleração em p
 *   dt, maxT, tol, iters — integração/convergência
 * @returns {{ok:boolean, dir:{x,y,z}, tof:number, miss:number, points:Array<{x,y,z}>}}
 */
export function solveBallistic({
  pos, vel, speed, targetPos, targetVel = null,
  gravityFn, dt = 0.1, maxT = 45, tol = 900, iters = 8,
}) {
  const tvx = targetVel ? targetVel.x : 0;
  const tvy = targetVel ? targetVel.y : 0;
  const tvz = targetVel ? targetVel.z : 0;
  const targetAt = (t, out) => {
    out.x = targetPos.x + tvx * t; out.y = targetPos.y + tvy * t; out.z = targetPos.z + tvz * t;
    return out;
  };

  // Alvo virtual inicial: alvo previsto num chute de tempo de voo (distância/veloc.)
  const d0 = len(targetPos.x - pos.x, targetPos.y - pos.y, targetPos.z - pos.z);
  let tGuess = d0 / Math.max(1, speed);
  const V = { x: 0, y: 0, z: 0 };
  targetAt(tGuess, V);

  const g = { x: 0, y: 0, z: 0 };
  const T = { x: 0, y: 0, z: 0 };
  let best = null;

  for (let it = 0; it < iters; it++) {
    // direção de lançamento para o alvo virtual atual
    let dx = V.x - pos.x, dy = V.y - pos.y, dz = V.z - pos.z;
    const dl = len(dx, dy, dz) || 1;
    dx /= dl; dy /= dl; dz /= dl;

    // simula a trajetória balística (gravidade pura)
    let px = pos.x, py = pos.y, pz = pos.z;
    let vx = dx * speed + vel.x, vy = dy * speed + vel.y, vz = dz * speed + vel.z;
    let bestD = Infinity, bestT = 0, bx = px, by = py, bz = pz;
    const points = [{ x: px, y: py, z: pz }];
    let t = 0;
    let stepsSincePoint = 0;
    while (t < maxT) {
      g.x = 0; g.y = 0; g.z = 0;
      gravityFn({ x: px, y: py, z: pz }, g);
      vx += g.x * dt; vy += g.y * dt; vz += g.z * dt;
      px += vx * dt; py += vy * dt; pz += vz * dt;
      t += dt;
      targetAt(t, T);
      const dd = len(px - T.x, py - T.y, pz - T.z);
      if (dd < bestD) { bestD = dd; bestT = t; bx = px; by = py; bz = pz; }
      if (++stepsSincePoint >= 5) { points.push({ x: px, y: py, z: pz }); stepsSincePoint = 0; }
      if (dd < tol * 0.5) break;                    // acertou — para cedo
      if (t > bestT + 6 && dd > bestD * 2.5) break; // afastando de vez — desiste
    }

    const cand = {
      ok: bestD <= tol,
      dir: { x: dx, y: dy, z: dz },
      tof: bestT, miss: bestD, points,
    };
    if (!best || cand.miss < best.miss) best = cand;
    if (cand.ok) break;

    // correção do alvo virtual: desloca pelo vetor de erro no ponto de aproximação
    targetAt(bestT, T);
    V.x += T.x - bx; V.y += T.y - by; V.z += T.z - bz;
    tGuess = bestT;
  }
  return best;
}
