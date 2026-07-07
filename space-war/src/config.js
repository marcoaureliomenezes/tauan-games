// config.js — Constantes do universo Space War.
//
// FILOSOFIA DE ESCALA: TAMANHOS em proporção real entre si, DISTÂNCIAS comprimidas
// (senão a viagem levaria horas). Base histórica: raio da Terra = 100 u, depois
// APPROACH-SCALE ×22/×9/×6 (corpo vira MUNDO na aproximação; μ ∝ fator → v_esc de
// superfície preservada) e PROPORÇÕES VERDADEIRAS (θ = 2R/d honesto; Sol re-gauge
// 11k/1.1e12; sistemas vizinhos a 19–29M u — "anos-luz").
//
// VALORES FINAIS LITERAIS (audit 2026-07-07, T-PR-04): este arquivo já teve TRÊS
// passadas sequenciais de mutação in-place (approach-scale → distâncias ×4 →
// proporções verdadeiras ×8) empilhadas sobre os mesmos arrays — uma armadilha
// order-dependent (um def novo era ou não escalado conforme a posição textual;
// o Véu precisou se auto-multiplicar em universe.js). As passadas foram COLAPSADAS:
// todo valor abaixo é o valor EFETIVO final, verificado por snapshot-diff contra o
// config antigo (tests/space-war/tools/test-celestial-unit.js cobre invariantes).
// Não há mais nenhuma mutação de config em import-time. Defs novos são literais
// finais — sem "qual lado do bloco de escala" para acertar.
//
// μ = G·M. μ_Terra final 6.6e7 (g_superfície = μ/R² = 6.6e7/2200² ≈ 13.6? não —
// v_circ/v_esc de SUPERFÍCIE é o que a approach-scale preservou; g de superfície
// mudou junto com o raio, decisão da época). μ_Sol 1.1e12.

// ---------------------------------------------------------------------------
// Tempo
// ---------------------------------------------------------------------------
export const EARTH_YEAR = 1800;     // s (gauge dos periodFactor dos trilhos circulares)
export const EARTH_DAY = 60;
export const MOON_MONTH = 80;

// ---------------------------------------------------------------------------
// Voo / nave
// ---------------------------------------------------------------------------
export const SHIP = {
  maxThrustAccel: 520,    // u/s² de empuxo no throttle máximo (modo newtoniano)
  boostMultiplier: 5.5,   // afterburner (Shift)
  brakeAccel: 700,        // freio (tecla X) no modo newtoniano
  pitchRate: 1.7,         // rad/s
  yawRate: 1.35,
  rollRate: 2.1,
  alignRate: 4.5,         // rad/s do piloto automático de mira (tecla C)
  maxSpeedSoft: 9000,     // u/s — acima disso o HUD marca "WARP"
  startAltitude: 6,       // u acima da superfície da Terra ao decolar
  size: 2.0,
  // --- Flight Assist (Set Speed + COAST) ---
  cruiseSpeed: 2600,      // u/s — velocidade-alvo no throttle 100% (assist)
  assistSteer: 3.4,       // 1/s — quão rápido a VELOCIDADE acompanha o nariz
  assistThrust: 560,      // u/s² — empuxo finito (modo coast/newtoniano)
  stopRate: 3.2,          // 1/s — amortecimento do freio (X) no assist
  mouseSens: 0.0013,
};

// Atmosfera padrão (espessura acima da superfície, fração do raio).
export const ATMO = {
  thicknessFactor: 0.28,
  drag: 1.6,
  burnSpeed: 900,
  burnDamage: 14,
};

export const SUN_NORETURN = 60000;  // referência visual; a fuga real é canEscape

// Alcance gravitacional padrão quando `gravReach` não é declarado.
export function defaultGravReach(def) {
  return Math.max((def.soi || def.radius * 12) * 4, def.radius * 120);
}

// Velocidade máxima sustentável (cruzeiro × turbo) — base do "DÁ PARA FUGIR?".
export const MAX_ESCAPE_SPEED = 2600 * 5.5;

// Renderização: far cobre o anel de sistemas (sprites; malhas cullam por sistema).
export const RENDER = {
  skyboxRadius: 40_000_000,
  far: 60_000_000,
  near: 0.3,
};

// Overdrive interestelar: fora de TODOS os SOIs a nave desperta o motor
// interestelar — multiplicador de cruzeiro/empuxo com rampa suave.
export const OVERDRIVE = {
  mult: 24,         // × cruiseSpeed quando totalmente engajado
  thrustMult: 16,   // × empuxo/steer
  rampIn: 2.5,      // s para engajar (fora de SOI)
  rampOut: 1.2,     // s para desengajar (ao entrar num sistema)
};

// ---------------------------------------------------------------------------
// Sol — raio ≈ 109× a Terra original; re-gauge das proporções verdadeiras.
// μ/R preservado → v_esc de superfície EXATA (zona de não-retorno intacta).
// ---------------------------------------------------------------------------
export const SUN = {
  name: 'Sol', key: 'sun',
  radius: 11_000,
  color: 0xfff2bf,
  mu: 1.1e12,
  soi: 4_200_000,       // governa o espaço interplanetário (Netuno 3.84M cabe)
  gravReach: 4_200_000,
  spin: 540,
  light: 0xfff4d6,
};

// Valores FINAIS (approach-scale + distâncias ×4 + órbitas ×2 já aplicadas).
export const PLANETS = [
  {
    name: 'Mercúrio', key: 'mercury',
    radius: 836, color: 0x9a8b7d, color2: 0x6b5d50, kind: 'rock',
    orbit: 208_000, periodFactor: 0.964, tilt: 0.12, spin: 90,
    mu: 3_630_000, soi: 12_800,
    moons: [],
  },
  {
    name: 'Vênus', key: 'venus',
    radius: 2090, color: 0xe6cd92, color2: 0xc9a55f, kind: 'cloud',
    orbit: 320_000, periodFactor: 2.46, tilt: 0.06, spin: 240,
    mu: 53_790_000, soi: 25_600, atmosphere: 0xe6cd92, hasAtmo: true,
    moons: [],
  },
  {
    name: 'Terra', key: 'earth',
    radius: 2200, color: 0x1c66b0, color2: 0x2f7d3a, kind: 'earth',
    orbit: 440_000, periodFactor: 4, tilt: 0.0, spin: EARTH_DAY,
    mu: 66_000_000, soi: 33_600, atmosphere: 0x6fb6ff, hasAtmo: true, ocean: true,
    moons: [
      { name: 'Lua', radius: 594, color: 0xbfbfc4, orbit: 5808, period: MOON_MONTH, spin: 80, mu: 811_800, soi: 1800 },
    ],
  },
  {
    name: 'Marte', key: 'mars',
    radius: 1166, color: 0xb5492c, color2: 0x7d2f1c, kind: 'rock',
    orbit: 624_000, periodFactor: 7.524, tilt: 0.03, spin: 62,
    mu: 7_062_000, soi: 20_800, atmosphere: 0xd98a6a, hasAtmo: true,
    moons: [
      { name: 'Fobos', radius: 66, color: 0x7a6a5c, orbit: 2580.6, period: 12, spin: 12, mu: 0.1188, soi: 145.2 },
      { name: 'Deimos', radius: 55, color: 0x877668, orbit: 4301, period: 24, spin: 24, mu: 0.0165, soi: 121 },
    ],
  },
  {
    name: 'Júpiter', key: 'jupiter',
    radius: 6600, color: 0xc9a878, color2: 0x8c6a4a, kind: 'gas', bands: true, redspot: true,
    orbit: 1_200_000, periodFactor: 47.44, tilt: 0.02, spin: 26,
    mu: 5_720_400_000, soi: 179_200, atmosphere: 0xd8b890, hasAtmo: true,
    moons: [
      { name: 'Io', radius: 638, color: 0xe6d36a, orbit: 15_136, period: 24, spin: 24, mu: 990_000, soi: 1403.6 },
      { name: 'Europa', radius: 528, color: 0xcdbfae, orbit: 21_190.4, period: 40, spin: 40, mu: 528_000, soi: 1161.6 },
      { name: 'Ganimedes', radius: 902, color: 0x9b8d7d, orbit: 28_253.866666666667, period: 64, spin: 64, mu: 1_650_000, soi: 1984.4 },
      { name: 'Calisto', radius: 836, color: 0x6f6358, orbit: 37_335.46666666667, period: 110, spin: 110, mu: 1_188_000, soi: 1839.2 },
    ],
  },
  {
    name: 'Saturno', key: 'saturn',
    radius: 5490, color: 0xd8c89a, color2: 0xb09a6a, kind: 'gas', bands: true,
    orbit: 1_960_000, periodFactor: 117.84, tilt: 0.09, spin: 28,
    mu: 1_713_600_000, soi: 140_800, atmosphere: 0xe6d8b0, hasAtmo: true,
    ring: { inner: 6900, outer: 12_900, color: 0xd9c8a0, tilt: 0.47 },
    moons: [
      { name: 'Titã', radius: 880, color: 0xd9a24a, orbit: 22_880, period: 90, spin: 90, mu: 1_485_000, soi: 1936 },
      { name: 'Reia', radius: 264, color: 0xb8b0a4, orbit: 14_976, period: 54, spin: 54, mu: 26_400, soi: 580.8 },
    ],
  },
  {
    name: 'Urano', key: 'uranus',
    radius: 3600, color: 0x9fe0e4, color2: 0x73c6cc, kind: 'ice',
    orbit: 2_960_000, periodFactor: 336, tilt: 1.4, spin: 34,
    mu: 391_500_000, soi: 96_000, atmosphere: 0xaff0f4, hasAtmo: true,
    ring: { inner: 4680, outer: 6300, color: 0x88b0b4, tilt: 1.5 },
    moons: [
      { name: 'Titânia', radius: 264, color: 0xa8a0a0, orbit: 8088, period: 64, spin: 64, mu: 39_600, soi: 580.8 },
      { name: 'Oberon', radius: 264, color: 0x968e8e, orbit: 10_976.571428571428, period: 90, spin: 90, mu: 33_000, soi: 580.8 },
    ],
  },
  {
    name: 'Netuno', key: 'neptune',
    radius: 3465, color: 0x3554d4, color2: 0x2138a0, kind: 'ice',
    orbit: 3_840_000, periodFactor: 659.2, tilt: 0.49, spin: 32,
    mu: 461_700_000, soi: 96_000, atmosphere: 0x5a78f0, hasAtmo: true,
    moons: [
      { name: 'Tritão', radius: 462, color: 0xc9c0c0, orbit: 8200.5, period: 60, spin: 60, mu: 237_600, soi: 1016.4, retrograde: true },
    ],
  },
];

// ===========================================================================
// OS SISTEMAS ESTELARES — registry canônico (fonte única; universe.js registra
// registry canônico). Centros FINAIS (anel a 19–29M u do Sol: "anos-luz"
// — de outro sistema só cruzam pontos fotométricos).
// ===========================================================================
// `lum` = luminosidade SOMADA das estrelas do sistema (estática — os glows
// fotométricos do starlod precisam dela mesmo com o sistema DESCARREGADO; fases
// T-PR-06). `arriveDist` = recuo do ponto de chegada da viagem interestelar.
//
// ROSTER (operador, audit 2026-07-07): 1. Solar · 2. Betelgeuse + Siwarha ·
// 3. DEVORADOR (BN devorando uma gigante vermelha — teardrop + corrente de
// Roche) · 4. PULSAR (estrela de nêutrons orbitando a Sentinela, dentro do
// remanescente da sua supernova) · 5. Sagitário A✦ (estrelas S).
export const SYSTEMS = [
  { key: 'solar', name: 'Sistema Solar', center: [0, 0, 0], radius: 4_200_000, primary: 'sun', lum: 1.0, arriveDist: 130_000 },
  { key: 'betelgeuse', name: 'Betelgeuse', center: [16_640_000, 960_000, -16_640_000], radius: 300_000, primary: 'betelgeuse', lum: 60.9, arriveDist: 240_000 },
  { key: 'binary', name: 'Devorador — BN + Gigante', center: [-20_800_000, 0, 7_040_000], radius: 280_000, primary: 'blackhole', lum: 8, arriveDist: 130_000 },
  { key: 'pulsar', name: 'Pulsar — NS + Sentinela', center: [5_760_000, -960_000, 23_360_000], radius: 260_000, primary: 'neutron', lum: 80.6, arriveDist: 130_000 },
  { key: 'core', name: 'Núcleo da Galáxia', center: [-12_160_000, 1_920_000, -23_040_000], radius: 420_000, primary: 'sgr', lum: 6.9, arriveDist: 130_000 },
];

// ---------------------------------------------------------------------------
// SISTEMA 3 — DEVORADOR (roster do audit 2026-07-07): buraco negro devorando
// uma GIGANTE VERMELHA. A gigante ENCHE o lóbulo de Roche (Eggleton q=0.4 →
// R_L ≈ 0.303·a = 30.3k ≈ raio dela): teardrop apontando ao BN + corrente de
// plasma nascendo no L1 e enrolando no plano do disco (celestial/system.rocheStream).
// ---------------------------------------------------------------------------
export const BINARY = {
  separation: 100_000,      // a: dimensionada p/ transbordo exato do lóbulo

  blackHole: {
    name: 'Buraco Negro', key: 'blackhole', kind: 'blackhole',
    rs: 480,
    radius: 480,
    mu: 5.0e12,
    soi: 150_000, gravReach: 150_000,
    disk: { inner: 1440, outer: 16_000 },  // ISCO = 3·rs — ALIMENTADO pela corrente
    tideKillR: 7800,          // zona de MARÉ ≈ 16·rs
    photonRing: 1248,         // borda da sombra = 2.6·rs (EHT M87*/Sgr A*)
    jet: true,
  },
  giant: {
    name: 'Devorada', key: 'devorada', kind: 'redgiant',
    radius: 30_000,           // = lóbulo de Roche (transbordo contínuo)
    mu: 2.0e12,               // 2 M☉ de gigante inchada (q = 2/5 vs o BN)
    lum: 8,
    color: 0xff9a52, color2: 0x8a2d0c,
    soi: 60_000, gravReach: 120_000, spin: 700,
    cellScale: 3.0, coronaScale: 4.2,
    light: { color: 0xffb080, intensity: 2.2, range: 500_000 },
  },
};

// ---------------------------------------------------------------------------
// SISTEMA 4 — PULSAR: a estrela de nêutrons orbitando a Sentinela (estrela de
// ~1 M☉), dentro do remanescente da supernova que criou o pulsar.
// ---------------------------------------------------------------------------
export const PULSAR = {
  separation: 120_000,
  remnant: { radius: 190_000, color1: 0xff6a3a, color2: 0x46d8c8 },
  neutronStar: {
    name: 'Estrela de Nêutrons', key: 'neutron', kind: 'neutron',
    radius: 90,               // compacta; PW usa r_s = R/2.5
    mu: 2.0e12,               // 2.0 M☉ — ≤ limite TOV ~2.2 (PSR J0740+6620)
    light: { color: 0x9bbcff, intensity: 4.0, range: 500_000 },
    lum: 80,                  // fonte PONTUAL mais brilhante do jogo (Crab comprimido)
    spin: 1.4,
    jetTilt: 0.5,
    lensRs: 80,
    soi: 55_000, gravReach: 110_000,
    disk: { inner: 270, outer: 2600 },   // vento de pulsar/toro síncrotron
    tideKillR: 420,
  },
  companion: {
    name: 'Sentinela', key: 'sentinela', kind: 'star',
    radius: 5200, color: 0xfff2bf, color2: 0xe0c080, mu: 9.0e11, lum: 0.6,
    soi: 45_000, gravReach: 90_000, spin: 260, cellScale: 22,
    light: { color: 0xfff4d6, intensity: 2.2, range: 500_000 },
  },
};

// ---------------------------------------------------------------------------
// SISTEMA 2 — BETELGEUSE: supergigante vermelha (M2Iab) + companheira real.
// ---------------------------------------------------------------------------
export const BETELGEUSE = {
  star: {
    name: 'Betelgeuse', key: 'betelgeuse', kind: 'redsupergiant',
    radius: 60_000, color: 0xff9a4d, color2: 0x7a2d0c,  // ~3600 K: LARANJA profundo
    mu: 1.6e13,               // ~16 M☉
    soi: 300_000, gravReach: 300_000,
    spin: 900, light: 0xffb080,
    lum: 60,
    cellScale: 1.8,           // 2-4 células de convecção GIGANTES no disco
    lumpyLimb: 0.045,         // silhueta assimétrica (ALMA)
  },
  // α Ori B "Siwarha" — companheira REAL confirmada em 2025.
  companion: {
    name: 'Siwarha', key: 'siwarha', kind: 'star',
    radius: 2200, color: 0xcfe0ff, color2: 0x8fb0f0, mu: 1.15e12,
    lum: 0.9,
    soi: 20_000, gravReach: 60_000, spin: 120, cellScale: 12,
    orbit: 86_000, periodFactor: 2.4,
  },
  planets: [
    { name: 'Cinza', key: 'cinza', radius: 1300, color: 0x4a3f38, color2: 0x2b241f, kind: 'rock',
      orbit: 110_000, periodFactor: 3.2, tilt: 0.05, spin: 70, mu: 42_000_000, soi: 9600, moons: [] },
    { name: 'Brasa', key: 'brasa', radius: 2400, color: 0x6b3020, color2: 0x40180c, kind: 'rock',
      orbit: 160_000, periodFactor: 5.6, tilt: 0.10, spin: 55, mu: 120_000_000, soi: 16_400,
      atmosphere: 0xff7040, hasAtmo: true, moons: [] },
    { name: 'Fuligem', key: 'fuligem', radius: 4800, color: 0x37312e, color2: 0x1e1a18, kind: 'ice',
      orbit: 235_000, periodFactor: 9.5, tilt: 0.35, spin: 40, mu: 330_000_000, soi: 22_000, moons: [] },
  ],
};

// ---------------------------------------------------------------------------
// SISTEMA 5 — NÚCLEO DA GALÁXIA: estrelas S em elipses keplerianas railed em
// volta de Sagitário A* (patched-conics + Hill SOI — dá para SEGUIR uma estrela).
// ---------------------------------------------------------------------------
export const CORE = {
  smbh: {
    name: 'Sagitário A✦', key: 'sgr', kind: 'blackhole',
    rs: 2700, radius: 2700,
    mu: 4.0e13,               // SMBH ≫ qualquer BN estelar (hierarquia preservada)
    soi: 420_000, gravReach: 420_000,
    disk: { inner: 8100, outer: 28_000 },   // ISCO = 3·rs
    photonRing: 7020,         // borda da sombra = 2.6·rs
    diskGain: 0.4,            // Sgr A* real é QUIESCENTE (~1e-9 L_Edd)
    // SEM tideKillR: maré no horizonte ∝ 1/M² — um SMBH deixa a nave CRUZAR.
    jet: true,
  },
  starCount: 12,
  aMin: 70_000,
  aMax: 260_000,
  eMin: 0.12,
  eMax: 0.50,
  inclMax: 0.55,
  starPalette: [
    { color: 0xff6a3a, color2: 0xb03a12, radius: 2800, mu: 2.3e11, cellScale: 5, lum: 0.3 },
    { color: 0xff9a52, color2: 0xd06020, radius: 3300, mu: 2.9e11, cellScale: 6, lum: 0.4 },
    { color: 0xffd27a, color2: 0xd09838, radius: 3800, mu: 3.6e11, cellScale: 7, lum: 0.5 },
    { color: 0xfff2cc, color2: 0xe0c080, radius: 4600, mu: 4.6e11, cellScale: 8, lum: 0.6 },
    { color: 0xcfe0ff, color2: 0x93b0e8, radius: 5400, mu: 5.8e11, cellScale: 9, lum: 0.75 },
    { color: 0xa8c4ff, color2: 0x6a8ce0, radius: 6500, mu: 7.2e11, cellScale: 10, lum: 0.9 },
  ],
  planetCount: 3,
};

// Cor do laser do jogador e dos inimigos
export const COLORS = {
  playerLaser: 0x66ffcc,
  enemyLaser: 0xff5544,
  nuke: 0x66ff66,
  thruster: 0x66ccff,
};

// Helper: período orbital (s) de um planeta
export function orbitalPeriod(periodFactor) {
  return EARTH_YEAR * periodFactor;
}
