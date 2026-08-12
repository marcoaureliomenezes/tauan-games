// rng.js — deterministic RNG for QA/test mode.

function hashSeed(seed) {
  const text = String(seed ?? 'aero-default-seed');
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed) {
  let t = seed >>> 0;
  return function next() {
    t += 0x6d2b79f5;
    let x = t;
    x = Math.imul(x ^ (x >>> 15), x | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

export function createRng(seed) {
  const next = mulberry32(hashSeed(seed));
  return {
    seed: String(seed ?? 'aero-default-seed'),
    random: next,
    range(min, max) {
      return min + (max - min) * next();
    },
    int(min, max) {
      return Math.floor(min + (max - min + 1) * next());
    },
    pick(items) {
      if (!items.length) return undefined;
      return items[Math.floor(next() * items.length)];
    },
  };
}

export function parseRuntimeConfig(search = '') {
  const params = new URLSearchParams(search || '');
  const testMode = params.get('testMode') === '1' || params.get('qa') === '1';
  return {
    testMode,
    seed: params.get('seed') || 'aero-default-seed',
    map: params.get('map') || null,
    mission: params.has('mission') ? Math.max(1, Number(params.get('mission')) || 1) : null,
  };
}
