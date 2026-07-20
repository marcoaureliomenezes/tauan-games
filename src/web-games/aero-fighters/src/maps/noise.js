// maps/noise.js — Ruído procedural determinístico (value noise + FBM) para gerar
// relevo contínuo e realista (sem dependências externas, sem assets em runtime).
// Exporta: valueNoise2D, fbm2D, ridgedFbm2D.
//
// Determinístico: a mesma (x,z) sempre devolve o mesmo valor → colisão e malha
// visual usam a MESMA função (verdade de superfície única).

// Hash inteiro estável → [0,1)
function hash2(ix, iz) {
  let h = (ix | 0) * 374761393 + (iz | 0) * 668265263;
  h = (h ^ (h >> 13)) * 1274126177;
  h = h ^ (h >> 16);
  // >>> 0 mantém em uint32
  return ((h >>> 0) % 1000000) / 1000000;
}

function smooth(t) {
  return t * t * (3 - 2 * t); // smoothstep
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

/** Value noise 2D suave em [0,1). */
export function valueNoise2D(x, z) {
  const x0 = Math.floor(x), z0 = Math.floor(z);
  const fx = smooth(x - x0), fz = smooth(z - z0);
  const v00 = hash2(x0, z0), v10 = hash2(x0 + 1, z0);
  const v01 = hash2(x0, z0 + 1), v11 = hash2(x0 + 1, z0 + 1);
  return lerp(lerp(v00, v10, fx), lerp(v01, v11, fx), fz);
}

/** FBM (soma de oitavas) em [0,1) aproximado.
 *  @param freq frequência base (1/escala). @param oct nº de oitavas. */
export function fbm2D(x, z, { freq = 0.0016, oct = 5, lac = 2.0, gain = 0.5 } = {}) {
  let amp = 1, f = freq, sum = 0, norm = 0;
  for (let i = 0; i < oct; i++) {
    sum += amp * valueNoise2D(x * f, z * f);
    norm += amp;
    amp *= gain;
    f *= lac;
  }
  return sum / norm;
}

/** Ridged FBM — cristas afiadas (serras/montanhas). Em [0,1). */
export function ridgedFbm2D(x, z, { freq = 0.0016, oct = 5, lac = 2.0, gain = 0.5 } = {}) {
  let amp = 1, f = freq, sum = 0, norm = 0;
  for (let i = 0; i < oct; i++) {
    const n = 1 - Math.abs(valueNoise2D(x * f, z * f) * 2 - 1); // dobra → cristas
    sum += amp * n * n;
    norm += amp;
    amp *= gain;
    f *= lac;
  }
  return sum / norm;
}

/** Distância de um ponto (px,pz) a um segmento (a→b) — para rios/estradas. */
export function distToSegment(px, pz, ax, az, bx, bz) {
  const dx = bx - ax, dz = bz - az;
  const len2 = dx * dx + dz * dz || 1;
  let t = ((px - ax) * dx + (pz - az) * dz) / len2;
  t = Math.max(0, Math.min(1, t));
  const cx = ax + t * dx, cz = az + t * dz;
  return Math.hypot(px - cx, pz - cz);
}

/** Menor distância de (px,pz) a uma polilinha (array de {x,z}). */
export function distToPolyline(px, pz, pts) {
  let best = Infinity;
  for (let i = 0; i < pts.length - 1; i++) {
    const d = distToSegment(px, pz, pts[i].x, pts[i].z, pts[i + 1].x, pts[i + 1].z);
    if (d < best) best = d;
  }
  return best;
}
