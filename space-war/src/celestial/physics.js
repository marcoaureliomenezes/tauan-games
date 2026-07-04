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

// ── Viagem brachistochrone (interstellar-journey, AC-02) ────────────────────
// Queima contínua flip-and-burn: a = 4D/T²; v_pico = 2D/T no meio; perfil
// x/D = 2s² (s ≤ ½) e 1 − 2(1−s)² (s > ½), com v simétrico v(s) = v(1−s).
export function journeyProfile(D, T, t) {
  const a = 4 * D / (T * T);
  const s = Math.max(0, Math.min(1, t / T));
  let x, v;
  if (s <= 0.5) {
    x = 2 * D * s * s;
    v = a * (s * T);
  } else {
    const u = 1 - s;
    x = D * (1 - 2 * u * u);
    v = a * (u * T);
  }
  return { x, v, s, a, vPeak: 2 * D / T };
}

// Duração ∝ distância entre os limites do operador (3:00–6:00 min).
export function journeyDuration(D, dMin, dMax) {
  const f = Math.max(0, Math.min(1, (D - dMin) / Math.max(1, dMax - dMin)));
  return 180 + 180 * f;
}

// Aberração relativística (forma APARENTE: repouso → observador em movimento):
// cos θ_ap = (cos θ + β)/(1 + β cos θ) — o céu AGRUPA à frente ("headlight");
// uma estrela a 90° do rumo aparece em arccos β (8.1° a β=0.99).
export function aberrateCos(cosTheta, beta) {
  return (cosTheta + beta) / (1 + beta * cosTheta);
}

// Fator Doppler δ = 1/(γ(1 − β cos θ')) — corpo negro permanece corpo negro com
// T' = δ·T; intensidade observada ∝ δ⁴ (beaming).
export function dopplerFactor(cosThetaObs, beta) {
  const gamma = 1 / Math.sqrt(1 - beta * beta);
  return 1 / (gamma * (1 - beta * cosThetaObs));
}

// ── Fotometria de fontes pontuais (photometric-stars, AC-01/02) ─────────────
// Estrela é fonte NÃO-RESOLVIDA: um ponto de PSF cujo tamanho é ~fixo e cuja
// ENERGIA varia — F ∝ L/d², m = −2.5·log₁₀F, I = 10^(0.4(m_ref−m)). A forma
// jogável equivalente ancora a magnitude de referência numa distância de gauge:
//   I = L·(D0/d)²  (I=1 ⇔ estrela de L=1 vista de D0)
// Saturou (I>1): a energia excedente vira GLARE de raio ∝ √(I−1) (conserva
// energia — Spencer et al., SIGGRAPH 1995). Sub-saturada: esmaece por
// cobertura (α = I), nunca encolhe abaixo do núcleo. Cânone Stellarium/Celestia/
// Gaia Sky (ver revisão 2026-07-04, apêndice A).
export const PHOTO_D0 = 1_000_000;   // gauge das estrelas de SISTEMA (L do Sol = 1)

export function pointIntensity(L, d, d0 = PHOTO_D0) {
  const dd = Math.max(d, 1e-6);
  return L * (d0 / dd) * (d0 / dd);
}

// Tamanho do ponto em PIXELS: núcleo fixo + glare √(I−1), com teto.
export function pointPx(I, corePx = 2.2, glareK = 2.6, maxPx = 26) {
  const glare = I > 1 ? glareK * Math.sqrt(I - 1) : 0;
  return Math.min(corePx + glare, maxPx);
}

// Opacidade do ponto: cobertura sub-pixel (fade flux-conserving abaixo de I=1).
export function pointAlpha(I) {
  return Math.max(0, Math.min(1, I));
}

// Tamanho angular do DISCO em pixels: θ = 2R/d sobre o ângulo de 1 pixel.
export function discPx(radius, d, pxAngle) {
  return (2 * radius / Math.max(d, 1e-6)) / Math.max(pxAngle, 1e-9);
}

// LOD ponto↔disco com HISTERESE (sobe a disco em 2px, desce a ponto em 1px —
// escada Celestia/Gaia Sky, anti-flicker).
export const LOD_UP_PX = 2.0;
export const LOD_DOWN_PX = 1.0;
export function lodStep(prevMode, dPx) {
  if (prevMode === 'point') return dPx >= LOD_UP_PX ? 'disc' : 'point';
  return dPx < LOD_DOWN_PX ? 'point' : 'disc';
}

// Luminosidade VISUAL declarada (D-7): massas/raios do jogo são comprimidos p/
// jogabilidade — derivar L deles (M^3.5 / R²T⁴) inverte a hierarquia visual.
// `def.lum` manda; defaults por kind (pulsar: Crab ≈ 1.2e5 L☉ comprimido — a
// fonte pontual mais brilhante do jogo, doutrina do μ do Sgr A*).
export const STAR_LUM_DEFAULTS = {
  star: 0.6, redgiant: 8, redsupergiant: 60, whitedwarf: 0.02, neutron: 80,
};
export function lumForStar(def) {
  if (def.lum != null) return def.lum;
  return STAR_LUM_DEFAULTS[def.kind] ?? 0;
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
