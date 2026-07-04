// celestial/physics.js — Leis de derivação físicas da biblioteca de corpos celestes.
// Módulo PURO: sem THREE, sem DOM — testável em node (tests/space-war/tools/).
//
// Escala do jogo (herdada de config.js e PRESERVADA — decisão D-3 do SPEC):
//   μ_Terra = 3.0e6  (massa em massas terrestres: μ = MU_EARTH_GAME · M⊕)
//   μ_Sol   = 1.0e12 (massa em massas solares:   μ = MU_SUN_GAME  · M☉)
// A relação real μ_Sol = 333000·μ_Terra fecha: 333000 × 3.0e6 ≈ 1.0e12.
//
// Referência taxonômica: NASA — Types of Stars
// https://science.nasa.gov/universe/stars/types/
//   · main sequence: 0.1–200 M☉ (~90% das estrelas); massa → cor/temperatura
//   · < 8 M☉  → gigante vermelha → ANÃ BRANCA
//   · 8–20 M☉ → supernova → ESTRELA DE NÊUTRONS (pulsar/magnetar)
//   · > 20 M☉ → BURACO NEGRO estelar
//   · 13–80 M♃ → ANÃ MARROM (nunca acende fusão plena)

export const MU_EARTH_GAME = 3.0e6;
export const MU_SUN_GAME = 1.0e12;

// Raio do Sol na escala do jogo (config.js: 11000 × 2 pós-escala) — âncora da
// derivação massa→raio de main sequence.
export const SUN_RADIUS_GAME = 22000;

export function muFromEarthMasses(mEarth) { return MU_EARTH_GAME * mEarth; }
export function muFromSolarMasses(mSun) { return MU_SUN_GAME * mSun; }
export function solarMassesFromMu(mu) { return mu / MU_SUN_GAME; }
export function earthMassesFromMu(mu) { return mu / MU_EARTH_GAME; }

// ── Espectro de main sequence: massa → classe → cores do shader de estrela ──
// Rampa O→M (azul → vermelho). Cores casadas com as paletas já usadas no jogo
// (Azurak 0xbcd2ff, Sol 0xfff2bf, anãs do core 0xff6a3a) para coerência visual.
const SPECTRAL_LADDER = [
  // [massa mínima M☉, classe, color, color2, cellScale sugerido]
  // Fronteiras reais de massa das classes espectrais: O>16 · B 2.1–16 · A 1.4–2.1
  // · F 1.04–1.4 · G 0.8–1.04 (Sol) · K 0.45–0.8 · M <0.45 (anãs vermelhas).
  [16.0, 'O', 0x9db4ff, 0x5a7ae0, 10],
  [2.1,  'B', 0xbcd2ff, 0x7a9cf0, 9],
  [1.4,  'A', 0xe4ecff, 0xa8bcf0, 9],
  [1.04, 'F', 0xf8f4e8, 0xd8ccae, 8],
  [0.8,  'G', 0xfff2bf, 0xe0c080, 26],   // Sol: granulação fina
  [0.45, 'K', 0xffd27a, 0xd09838, 7],
  [0.2,  'M', 0xff9a52, 0xd06020, 6],
  [0.0,  'M', 0xff6a3a, 0xb03a12, 5],    // anã vermelha profunda
];

export function spectralFromMass(mSun) {
  for (const [minMass, cls, color, color2, cellScale] of SPECTRAL_LADDER) {
    if (mSun >= minMass) return { class: cls, color, color2, cellScale };
  }
  return { class: 'M', color: 0xff6a3a, color2: 0xb03a12, cellScale: 5 };
}

// ── Massa → raio (main sequence, escala do jogo) ────────────────────────────
// Lei real aproximada R ∝ M^0.8 ancorada no Sol do jogo. Clamps para o range
// pilotável do jogo (uma anã vermelha ainda precisa ser um destino visitável).
export function radiusFromMass(mSun) {
  const r = SUN_RADIUS_GAME * Math.pow(Math.max(mSun, 0.01), 0.8);
  return Math.max(1500, Math.min(r, 90000));
}

// ── Destino evolutivo pela massa (escada NASA) ──────────────────────────────
export function remnantTypeForMass(mSun) {
  if (mSun > 20) return 'black-hole';
  if (mSun >= 8) return 'neutron-star';
  return 'white-dwarf';
}

// ── Luminosidade → luz de cena (P2-11) ──────────────────────────────────────
// Main sequence real: L ∝ M^3.5 — proxy JOGÁVEL monótono em M (o renderer não
// aguenta 3.5 décadas de dinâmica; expoente comprimido + clamps). ANCORADO no
// Sol do jogo (massa de gauge 2.2 pós-escala ×2.2): Sol → intensity 3.0 /
// range 1e6 — idêntico ao valor calibrado pré-release (continuidade visual).
export const SUN_MASS_GAUGE = 2.2;
export function lightForMass(mSun) {
  const m = Math.max(mSun ?? 1, 0.05) / SUN_MASS_GAUGE;
  return {
    intensity: Math.min(8, Math.max(1.2, 3 * Math.pow(m, 1.2))),
    range: Math.min(4e6, Math.max(3e5, 1e6 * Math.sqrt(m))),
  };
}

// ── Mecânica orbital ────────────────────────────────────────────────────────
// SOI de Hill no pior caso (periélio): r_H = r_peri · ∛(μ_corpo / 3μ_pai).
export function hillSoi(rPeri, mu, muParent) {
  return rPeri * Math.cbrt(mu / (3 * muParent));
}

// Vis-viva: v² = μ(2/r − 1/a). Velocidade num ponto r de uma órbita de semieixo a.
export function visVivaSpeed(mu, r, a) {
  return Math.sqrt(Math.max(0, mu * (2 / r - 1 / a)));
}

// Velocidade circular e período kepleriano.
export function circularSpeed(mu, r) { return Math.sqrt(mu / r); }
export function keplerPeriod(a, mu) { return 2 * Math.PI * Math.sqrt(a ** 3 / mu); }

// Alcance gravitacional default (mesma regra de config.defaultGravReach).
export function defaultGravReach(def) {
  return Math.max((def.soi || def.radius * 12) * 4, def.radius * 120);
}

// ── Paczyński–Wiita (1980): pseudo-potencial p/ corpos COMPACTOS ─────────────
// Φ = −μ/(r − r_s) → a = μ/(r − r_s)². Reproduz EXATAMENTE a ISCO de
// Schwarzschild em 3·r_s (órbitas circulares abaixo dela são instáveis → mergulho)
// e a órbita marginalmente ligada em 2·r_s, com integrador newtoniano puro.
// Longe do horizonte (r ≫ r_s) converge ao newtoniano — só BN/NS usam.
export function pwAccel(mu, r, rs) {
  const d = Math.max(r - rs, rs * 0.05);
  return mu / (d * d);
}
// Velocidade circular no potencial PW: v²/r = μ/(r−r_s)² → v = √(μ·r)/(r−r_s).
export function pwCircularSpeed(mu, r, rs) {
  return Math.sqrt(mu * r) / Math.max(r - rs, rs * 0.05);
}
// Velocidade de escape PW: ½v² = μ/(r−r_s) → v = √(2μ/(r−r_s)).
export function pwEscapeSpeed(mu, r, rs) {
  return Math.sqrt(2 * mu / Math.max(r - rs, rs * 0.05));
}
// Gradiente de maré (espaguetificação): ∂g = 2μ·h/r³ p/ um corpo de meia-altura h.
export function tidalGradient(mu, r, h) {
  return 2 * mu * h / Math.pow(Math.max(r, 1e-6), 3);
}

// Raios da dança binária em torno do baricentro: r_i ∝ μ do PARCEIRO.
export function barycentricRadii(separation, mu1, mu2) {
  const total = mu1 + mu2;
  return [separation * (mu2 / total), separation * (mu1 / total)];
}

// Parâmetros do trilho elíptico (mesma forma de bodies.makeEllipse, sem THREE):
// p = a(1−e²), h = √(μp). A montagem vetorial (u,v) fica no motion component.
export function ellipseParams(a, e, mu) {
  const p = a * (1 - e * e);
  return { p, h: Math.sqrt(mu * p) };
}
