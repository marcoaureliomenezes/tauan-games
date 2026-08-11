// noise.js — Deterministic seeded noise: vendored simplex-noise when present,
// built-in seeded simplex fallback otherwise. Exports: initNoise(seed), getNoise2D,
// fbm2, mulberry32. To change the noise source, edit initNoise().

let noise2D = null;

/** Deterministic PRNG (mulberry32) — same sequence for a given seed. */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ─── Built-in 2D simplex fallback (Gustavson-style, seeded permutation) ──────
const GRAD2 = [1, 1, -1, 1, 1, -1, -1, -1, 1, 0, -1, 0, 0, 1, 0, -1];
const F2 = 0.3660254037844386;  // 0.5*(sqrt(3)-1)
const G2 = 0.21132486540518713; // (3-sqrt(3))/6

function makeSimplex2D(random) {
  const p = new Uint8Array(256);
  for (let i = 0; i < 256; i++) p[i] = i;
  for (let i = 255; i > 0; i--) {
    const j = (random() * (i + 1)) | 0;
    const t = p[i]; p[i] = p[j]; p[j] = t;
  }
  const perm = new Uint8Array(512);
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
  return function (xin, yin) {
    let n0 = 0, n1 = 0, n2 = 0;
    const s = (xin + yin) * F2;
    const i = Math.floor(xin + s), j = Math.floor(yin + s);
    const t = (i + j) * G2;
    const x0 = xin - (i - t), y0 = yin - (j - t);
    const i1 = x0 > y0 ? 1 : 0, j1 = x0 > y0 ? 0 : 1;
    const x1 = x0 - i1 + G2, y1 = y0 - j1 + G2;
    const x2 = x0 - 1 + 2 * G2, y2 = y0 - 1 + 2 * G2;
    const ii = i & 255, jj = j & 255;
    let t0 = 0.5 - x0 * x0 - y0 * y0;
    if (t0 > 0) {
      t0 *= t0;
      const g = (perm[ii + perm[jj]] & 7) * 2;
      n0 = t0 * t0 * (GRAD2[g] * x0 + GRAD2[g + 1] * y0);
    }
    let t1 = 0.5 - x1 * x1 - y1 * y1;
    if (t1 > 0) {
      t1 *= t1;
      const g = (perm[ii + i1 + perm[jj + j1]] & 7) * 2;
      n1 = t1 * t1 * (GRAD2[g] * x1 + GRAD2[g + 1] * y1);
    }
    let t2 = 0.5 - x2 * x2 - y2 * y2;
    if (t2 > 0) {
      t2 *= t2;
      const g = (perm[ii + 1 + perm[jj + 1]] & 7) * 2;
      n2 = t2 * t2 * (GRAD2[g] * x2 + GRAD2[g + 1] * y2);
    }
    return 70 * (n0 + n1 + n2); // ~[-1, 1]
  };
}

/**
 * Initializes the noise source. Tries the vendored simplex-noise (jwagner v4 ESM:
 * exports createNoise2D/createNoise3D); falls back to the built-in simplex if the
 * vendor file is absent. Always deterministic for a given seed + source.
 * @returns {Promise<string>} 'vendor' | 'fallback' (stored in game.world.noiseSource)
 */
export async function initNoise(seed) {
  const random = mulberry32(seed);
  try {
    const mod = await import('../../vendor/simplex-noise.js');
    noise2D = mod.createNoise2D(random);
    return 'vendor';
  } catch (e) {
    noise2D = makeSimplex2D(random);
    return 'fallback';
  }
}

/** Active 2D noise function. initNoise() must have resolved first. */
export function getNoise2D() {
  return noise2D;
}

/** Fractal Brownian motion over the active 2D noise. Returns roughly [-1, 1]. */
export function fbm2(x, y, octaves, lacunarity, gain) {
  const n = noise2D;
  let sum = 0, amp = 1, norm = 0;
  for (let o = 0; o < octaves; o++) {
    sum += n(x, y) * amp;
    norm += amp;
    amp *= gain;
    x *= lacunarity;
    y *= lacunarity;
  }
  return sum / norm;
}
