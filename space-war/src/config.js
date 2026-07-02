// config.js — Constantes do universo Space War.
//
// FILOSOFIA DE ESCALA (corrigida): TAMANHOS em proporção REAL, só as DISTÂNCIAS são
// comprimidas (senão a viagem levaria horas). Base: raio da Terra = 100 u (1 u ≈ 64 km).
//   Sol 11000 (≈109× Terra)  Júpiter 1100 (≈11×)  Saturno 915  Urano/Netuno ~400
//   Terra 100  Vênus 95  Marte 53  Mercúrio 38  Lua 27
// O Sol DOMINA o céu; Júpiter é gigante perto dos rochosos mas anão perto do Sol.
// Buraco negro e estrela de nêutrons são COMPACTOS (menores que a Terra) com massa
// monstruosa — o drama é a gravidade, não o tamanho.
//
// μ = G·M é proporcional à MASSA real (massa da Terra = 1). μ_Terra escolhido para dar
// gravidade de superfície ~300 u/s² (decola fácil, orbita fácil). Mexer aqui muda tudo.

// ---------------------------------------------------------------------------
// Tempo
// ---------------------------------------------------------------------------
export const EARTH_YEAR = 1800;     // s para a Terra dar 1 volta no Sol (= 30 min)
export const EARTH_DAY = 60;        // s para a Terra girar 1× (~1 min)
export const MOON_MONTH = 80;       // s para a Lua orbitar a Terra

// μ base: μ_Terra. g_superfície = μ/raio² = 3.0e6/100² = 300 u/s².
const MU_EARTH = 3.0e6;
const mu = (earthMasses) => MU_EARTH * earthMasses;   // μ proporcional à massa real

// ---------------------------------------------------------------------------
// Voo / nave
// ---------------------------------------------------------------------------
export const SHIP = {
  maxThrustAccel: 520,    // u/s² de empuxo no throttle máximo (modo newtoniano)
  boostMultiplier: 5.5,   // afterburner (Shift) — viagem rápida, mas o Sol/buraco negro ainda prendem
  brakeAccel: 700,        // freio (tecla X) no modo newtoniano
  pitchRate: 1.7,         // rad/s — giro responsivo
  yawRate: 1.35,
  rollRate: 2.1,
  alignRate: 4.5,         // rad/s do piloto automático de mira (tecla C)
  maxSpeedSoft: 9000,     // u/s — acima disso o HUD marca "WARP"; sem limite rígido
  startAltitude: 6,       // u acima da superfície da Terra ao decolar
  size: 2.0,              // escala da malha da nave
  // --- Flight Assist (Set Speed + COAST) ---
  // throttle>0 acelera a velocidade rumo ao nariz (até cruiseSpeed×boost) com empuxo
  // FINITO; throttle=0 NÃO freia → você COASTA (essencial pra entrar em órbita). O freio
  // (X) é a única desaceleração ativa. A gravidade entra sempre por cima → dá pra orbitar.
  cruiseSpeed: 2600,      // u/s — velocidade-alvo no throttle 100% (assist)
  assistSteer: 3.4,       // 1/s — quão rápido a VELOCIDADE acompanha o nariz (navegação
                          // responsiva: você vai para onde aponta). Maior = mais arcade.
  assistThrust: 560,      // u/s² — empuxo finito (modo coast/newtoniano)
  stopRate: 3.2,          // 1/s — amortecimento do freio (X) no assist
  mouseSens: 0.0013,      // sensibilidade do mouse
};

// Atmosfera padrão (espessura acima da superfície, fração do raio). Reentrada queima.
export const ATMO = {
  thicknessFactor: 0.28,  // espessura da atmosfera = raio × isto
  drag: 1.6,              // arrasto atmosférico (desacelera + esquenta)
  burnSpeed: 900,         // acima desta velocidade dentro da atmosfera, o casco esquenta
  burnDamage: 14,         // dano/s ao casco quando超 superaquece
};

export const SUN_NORETURN = 60000;  // referência visual; a fuga real é decidida por canEscape

// Alcance gravitacional padrão quando `gravReach` não é declarado.
export function defaultGravReach(def) {
  return Math.max((def.soi || def.radius * 12) * 4, def.radius * 120);
}

// Velocidade máxima sustentável (cruzeiro × turbo) — base do veredito "DÁ PARA FUGIR?".
export const MAX_ESCAPE_SPEED = 2600 * 5.5;

// Renderização. `far` alcança o sistema binário vizinho; near pequeno p/ chegar perto.
export const RENDER = {
  skyboxRadius: 1_500_000,
  far: 2_200_000,
  near: 0.3,
};

// ---------------------------------------------------------------------------
// Sol — raio ≈ 109× Terra. Domina o céu de qualquer planeta.
// ---------------------------------------------------------------------------
export const SUN = {
  name: 'Sol', key: 'sun',
  radius: 11000,
  color: 0xfff2bf,
  mu: mu(333000),       // massa do Sol = 333000 Terras → μ ≈ 1.0e12
  soi: 560_000,         // governa o espaço interplanetário (Netuno 480k cabe), mas NÃO o binário (820k)
  gravReach: 560_000,
  spin: 540,
  light: 0xfff4d6,
};

// radius em PROPORÇÃO REAL; orbit COMPRIMIDO (ordem e escala relativa preservadas).
export const PLANETS = [
  {
    name: 'Mercúrio', key: 'mercury',
    radius: 38, color: 0x9a8b7d, color2: 0x6b5d50, kind: 'rock',
    orbit: 26000, periodFactor: 0.241, tilt: 0.12, spin: 90,
    mu: mu(0.055), soi: 1600,
    moons: [],
  },
  {
    name: 'Vênus', key: 'venus',
    radius: 95, color: 0xe6cd92, color2: 0xc9a55f, kind: 'cloud',
    orbit: 40000, periodFactor: 0.615, tilt: 0.06, spin: 240,
    mu: mu(0.815), soi: 3200, atmosphere: 0xe6cd92, hasAtmo: true,
    moons: [],
  },
  {
    name: 'Terra', key: 'earth',
    radius: 100, color: 0x1c66b0, color2: 0x2f7d3a, kind: 'earth',
    orbit: 55000, periodFactor: 1.0, tilt: 0.0, spin: EARTH_DAY,
    mu: mu(1.0), soi: 4200, atmosphere: 0x6fb6ff, hasAtmo: true, ocean: true,
    moons: [
      { name: 'Lua', radius: 27, color: 0xbfbfc4, orbit: 3200, period: MOON_MONTH, spin: 80, mu: mu(0.0123), soi: 900 },
    ],
  },
  {
    name: 'Marte', key: 'mars',
    radius: 53, color: 0xb5492c, color2: 0x7d2f1c, kind: 'rock',
    orbit: 78000, periodFactor: 1.881, tilt: 0.03, spin: 62,
    mu: mu(0.107), soi: 2600, atmosphere: 0xd98a6a, hasAtmo: true,
    moons: [
      { name: 'Fobos', radius: 3, color: 0x7a6a5c, orbit: 240, period: 12, spin: 12, mu: mu(1.8e-9), soi: 30 },
      { name: 'Deimos', radius: 2.5, color: 0x877668, orbit: 400, period: 24, spin: 24, mu: mu(2.5e-10), soi: 24 },
    ],
  },
  {
    name: 'Júpiter', key: 'jupiter',
    radius: 1100, color: 0xc9a878, color2: 0x8c6a4a, kind: 'gas', bands: true, redspot: true,
    orbit: 150000, periodFactor: 11.86, tilt: 0.02, spin: 26,
    mu: mu(317.8), soi: 28000, atmosphere: 0xd8b890, hasAtmo: true,
    moons: [
      { name: 'Io', radius: 29, color: 0xe6d36a, orbit: 3000, period: 24, spin: 24, mu: mu(0.015), soi: 320 },
      { name: 'Europa', radius: 24, color: 0xcdbfae, orbit: 4200, period: 40, spin: 40, mu: mu(0.008), soi: 280 },
      { name: 'Ganimedes', radius: 41, color: 0x9b8d7d, orbit: 5600, period: 64, spin: 64, mu: mu(0.025), soi: 440 },
      { name: 'Calisto', radius: 38, color: 0x6f6358, orbit: 7400, period: 110, spin: 110, mu: mu(0.018), soi: 400 },
    ],
  },
  {
    name: 'Saturno', key: 'saturn',
    radius: 915, color: 0xd8c89a, color2: 0xb09a6a, kind: 'gas', bands: true,
    orbit: 245000, periodFactor: 29.46, tilt: 0.09, spin: 28,
    mu: mu(95.2), soi: 22000, atmosphere: 0xe6d8b0, hasAtmo: true,
    ring: { inner: 1150, outer: 2150, color: 0xd9c8a0, tilt: 0.47 },
    moons: [
      { name: 'Titã', radius: 40, color: 0xd9a24a, orbit: 5500, period: 90, spin: 90, mu: mu(0.0225), soi: 420 },
      { name: 'Reia', radius: 12, color: 0xb8b0a4, orbit: 3600, period: 54, spin: 54, mu: mu(0.0004), soi: 130 },
    ],
  },
  {
    name: 'Urano', key: 'uranus',
    radius: 400, color: 0x9fe0e4, color2: 0x73c6cc, kind: 'ice',
    orbit: 370000, periodFactor: 84.0, tilt: 1.4, spin: 34,
    mu: mu(14.5), soi: 12000, atmosphere: 0xaff0f4, hasAtmo: true,
    ring: { inner: 520, outer: 700, color: 0x88b0b4, tilt: 1.5 },
    moons: [
      { name: 'Titânia', radius: 12, color: 0xa8a0a0, orbit: 1400, period: 64, spin: 64, mu: mu(0.0006), soi: 130 },
      { name: 'Oberon', radius: 12, color: 0x968e8e, orbit: 1900, period: 90, spin: 90, mu: mu(0.0005), soi: 120 },
    ],
  },
  {
    name: 'Netuno', key: 'neptune',
    radius: 385, color: 0x3554d4, color2: 0x2138a0, kind: 'ice',
    orbit: 480000, periodFactor: 164.8, tilt: 0.49, spin: 32,
    mu: mu(17.1), soi: 12000, atmosphere: 0x5a78f0, hasAtmo: true,
    moons: [
      { name: 'Tritão', radius: 21, color: 0xc9c0c0, orbit: 1500, period: 60, spin: 60, mu: mu(0.0036), soi: 160, retrograde: true },
    ],
  },
];

// ===========================================================================
// OS 5 SISTEMAS ESTELARES (operador, 2026-07-01)
// 1. Sistema Solar (Sol + planetas + luas)         — trilhos keplerianos
// 2. Betelgeuse (supergigante vermelha)            — trilhos
// 3. Binário: buraco negro (morte de estrela) + pulsar — par em trilho + remanescente
// 4. Caótico: 2 estrelas diferentes + planetas     — N-CORPOS integrado (caos real)
// 5. Núcleo da Galáxia: SMBH + 12 estrelas caóticas — N-CORPOS integrado
//
// DISTÂNCIAS (pedido do operador): sistemas num anel ~650-820k do Sol (era 820k
// só o binário) + MOTOR INTERESTELAR (overdrive fora de qualquer SOI) → viagem
// típica de 1-3 min em cruzeiro, segundos com turbo.
// ===========================================================================

// Overdrive interestelar: fora de TODOS os SOIs a nave desperta o motor
// interestelar — multiplicador de cruzeiro/empuxo com rampa suave.
export const OVERDRIVE = {
  mult: 4.5,        // × cruiseSpeed quando totalmente engajado
  thrustMult: 4.0,  // × empuxo/steer para alcançar a nova velocidade-alvo
  rampIn: 2.5,      // s para engajar (fora de SOI)
  rampOut: 1.2,     // s para desengajar (ao entrar num sistema)
};

export const SYSTEMS = [
  { key: 'solar', name: 'Sistema Solar', center: [0, 0, 0], radius: 560_000, primary: 'sun' },
  { key: 'betelgeuse', name: 'Betelgeuse', center: [520_000, 30_000, -520_000], radius: 300_000, primary: 'betelgeuse' },
  { key: 'binary', name: 'Binário BN+Pulsar', center: [-650_000, 0, 220_000], radius: 280_000, primary: 'blackhole' },
  { key: 'chaotic', name: 'Binário Caótico', center: [180_000, -30_000, 730_000], radius: 260_000, primary: 'azurak' },
  { key: 'core', name: 'Núcleo da Galáxia', center: [-380_000, 60_000, -720_000], radius: 420_000, primary: 'sgr' },
];

// ---------------------------------------------------------------------------
// SISTEMA 3 — BINÁRIO: buraco negro (nascido da MORTE de uma estrela — o
// remanescente de supernova ainda envolve o sistema) + estrela de nêutrons.
// Separação LARGA (64k, pedido do operador) — dá para orbitar cada um.
// ---------------------------------------------------------------------------
export const BINARY = {
  center: SYSTEMS[2].center,
  separation: 140_000,      // BEM afastados (pedido do operador) → região de Hill ~44k
                            // em volta de cada um = órbitas estáveis para a nave
  // pairPeriod é DERIVADO da física em bodies.js: T = 2π·√(a³/μ_total) ≈ 116 s.
  // Trilho consistente com a gravidade → a aceleração de frame cancela o parceiro
  // e órbitas em volta de cada membro FECHAM.
  remnant: { radius: 210_000, color1: 0xff6a3a, color2: 0x46d8c8 }, // casca da supernova

  blackHole: {
    name: 'Buraco Negro', key: 'blackhole', kind: 'blackhole',
    rs: 160,                  // horizonte com presença visual (ainda compacto)
    radius: 160,
    mu: 5.0e12,               // monstruoso e local
    soi: 150_000, gravReach: 150_000,
    disk: { inner: 340, outer: 3200 },   // disco de acreção GRANDE (visível de longe)
    photonRing: 215,
  },
  neutronStar: {
    name: 'Estrela de Nêutrons', key: 'neutron', kind: 'neutron',
    radius: 30,               // minúscula (≈ uma cidade), densíssima — de propósito
    mu: 3.0e12,               // gravidade brutal e local
    spin: 1.4,                // pulsar ultrarrápido
    jetTilt: 0.5,
    lensRs: 80,               // "mesmo não sendo um buraco negro… ela curva o espaço"
    soi: 110_000, gravReach: 110_000,
    // região do vento de pulsar/toro síncrotron: arrasto → ESPIRAL DA MORTE
    // (mesma mecânica do disco de acreção do BN — captura orbital, não sucção)
    disk: { inner: 90, outer: 2200 },
  },
};

// ---------------------------------------------------------------------------
// SISTEMA 2 — BETELGEUSE: supergigante vermelha (M2Iab). Na escala real ela
// teria ~900× o raio solar; aqui 5.5× o Sol do jogo (60k) já domina o céu a
// centenas de milhares de u. Células de convecção GIGANTES (poucas células
// cobrem a superfície — nada da granulação fina do Sol), fotosfera assimétrica
// fervendo, envelope de poeira. Vai virar supernova — os planetas são carvão.
// ---------------------------------------------------------------------------
export const BETELGEUSE = {
  star: {
    name: 'Betelgeuse', key: 'betelgeuse', kind: 'redsupergiant',
    radius: 60_000, color: 0xff9a4d, color2: 0x7a2d0c,  // ~3600 K: LARANJA profundo (não vermelho)
    mu: 1.6e13,               // ~16 massas solares (na escala μ do jogo)
    soi: 300_000, gravReach: 300_000,
    spin: 900, light: 0xffb080,
    cellScale: 1.8,           // freq. do FBM: 2-4 células de convecção GIGANTES no disco
    lumpyLimb: 0.045,         // deslocamento de vértice low-freq — silhueta assimétrica (ALMA)
  },
  // α Ori B "Siwarha" — companheira REAL confirmada em 2025: faísca azul-branca
  // orbitando DENTRO do envelope estendido da gigante.
  companion: {
    name: 'Siwarha', key: 'siwarha', kind: 'star',
    radius: 900, color: 0xcfe0ff, color2: 0x8fb0f0, mu: 5.0e10,
    soi: 9000, gravReach: 30_000, spin: 120, cellScale: 12,
    orbit: 86_000, periodFactor: 2.4,
  },
  planets: [
    { name: 'Cinza', key: 'cinza', radius: 130, color: 0x4a3f38, color2: 0x2b241f, kind: 'rock',
      orbit: 110_000, periodFactor: 3.2, tilt: 0.05, spin: 70, mu: mu(1.4), soi: 4800, moons: [] },
    { name: 'Brasa', key: 'brasa', radius: 240, color: 0x6b3020, color2: 0x40180c, kind: 'rock',
      orbit: 160_000, periodFactor: 5.6, tilt: 0.10, spin: 55, mu: mu(4.0), soi: 8200,
      atmosphere: 0xff7040, hasAtmo: true, moons: [] },
    { name: 'Fuligem', key: 'fuligem', radius: 480, color: 0x37312e, color2: 0x1e1a18, kind: 'ice',
      orbit: 235_000, periodFactor: 9.5, tilt: 0.35, spin: 40, mu: mu(11), soi: 11_000, moons: [] },
  ],
};

// ---------------------------------------------------------------------------
// SISTEMA 4 — BINÁRIO CAÓTICO: duas estrelas DIFERENTES (azul quente + laranja
// fria) em órbita mútua EXCÊNTRICA integrada de verdade; planetas circumbinários
// com velocidades perturbadas → trajetórias caóticas (problema de 3 corpos REAL).
// ---------------------------------------------------------------------------
export const CHAOTIC = {
  stars: [
    { name: 'Azurak', key: 'azurak', kind: 'star',
      radius: 6500, color: 0xbcd2ff, color2: 0x7a9cf0, mu: 6.0e11,
      soi: 90_000, gravReach: 260_000, spin: 300, light: 0xcfe0ff, cellScale: 9.0 },
    { name: 'Karvon', key: 'karvon', kind: 'star',
      radius: 3800, color: 0xffa04a, color2: 0xd06018, mu: 2.5e11,
      soi: 60_000, gravReach: 260_000, spin: 380, light: 0xffd0a0, cellScale: 7.0 },
  ],
  pairSep: 42_000,            // separação inicial do par
  pairEcc: 0.45,              // excentricidade da dança
  planets: [
    { name: 'Vagante-I', key: 'vag1', radius: 110, color: 0x8a94a8, color2: 0x5a6478, kind: 'rock',
      orbitR: 85_000, velJitter: 0.72, mu: mu(0.9), soi: 3600, moons: [] },
    { name: 'Vagante-II', key: 'vag2', radius: 300, color: 0xc9b088, color2: 0x97815e, kind: 'gas',
      orbitR: 120_000, velJitter: 1.18, mu: mu(30), soi: 9000, atmosphere: 0xd8c098, hasAtmo: true, moons: [] },
    { name: 'Vagante-III', key: 'vag3', radius: 95, color: 0x6fc0c8, color2: 0x3f888e, kind: 'ice',
      orbitR: 65_000, velJitter: 0.55, mu: mu(0.6), soi: 3000, moons: [] },
    { name: 'Vagante-IV', key: 'vag4', radius: 170, color: 0xb06a4a, color2: 0x753f28, kind: 'rock',
      orbitR: 150_000, velJitter: 1.35, mu: mu(2.2), soi: 5200, moons: [] },
    { name: 'Vagante-V', key: 'vag5', radius: 70, color: 0xd8d0c0, color2: 0xa09884, kind: 'rock',
      orbitR: 100_000, velJitter: 0.88, mu: mu(0.3), soi: 2400, moons: [] },
  ],
  softening: 2500,            // ε do integrador (evita singularidades)
};

// =============================================================================
// ESCALA DE APROXIMAÇÃO (2026-07-02, pedido do operador): com raios em proporção
// real a Terra era uma BOLINHA mesmo colado nela (R=100 vs câmera a ~24 u — o
// limbo curvava na tela a 71 u de altitude). Corpos agora MUITO maiores: de
// longe continuam pontos, mas CRESCEM até virar PAREDE na aproximação (o
// horizonte achata no limite do contato, como na realidade). Buraco negro e
// estrela de nêutrons ficam COMPACTOS de propósito — é a física deles.
//  - raio: pequenos (<200) ×9 · médios (<500: Urano/Netuno…) ×3.2 · gigantes ×2.4
//  - μ ∝ fator do raio → v_circ e v_esc NA SUPERFÍCIE preservadas (pilotável)
//  - SOI ×2.0 (×1.6 nos gigantes) — conferido: sem sobreposição entre vizinhos
//  - anéis × fator do planeta; órbitas de LUAS re-espaçadas (fator único por
//    planeta preserva o espaçamento relativo; piso = raio novo + anel)
//  - Sol ×2 (22k — ainda bem menor que Betelgeuse, 60k)
// =============================================================================
function approachScale(p, forceF = null) {
  const f = forceF ?? (p.radius < 200 ? 9 : p.radius < 500 ? 3.2 : 2.4);
  const soiF = f === 2.4 ? 1.6 : 2.0;
  p.radius *= f;
  p.mu *= f;
  p.soi *= soiF;
  if (p.ring) { p.ring.inner *= f; p.ring.outer *= f; }
  if (p.moons && p.moons.length) {
    let k = 1;
    for (const m of p.moons) {
      m.radius *= 9;
      m.mu *= 9;
      m.soi = Math.max(m.soi * 2.0, m.radius * 2.2);
      const floor = Math.max(p.radius * 2.1, p.ring ? p.ring.outer * 1.12 : 0) + m.radius * 2;
      k = Math.max(k, floor / m.orbit);
    }
    for (const m of p.moons) m.orbit *= k;
  }
}
for (const p of PLANETS) approachScale(p);
// Betelgeuse/caótico: fator ÚNICO ×4.5 (preserva a ordem de tamanhos da lista)
for (const p of BETELGEUSE.planets) approachScale(p, 4.5);
for (const p of CHAOTIC.planets) approachScale(p, 4.5);
SUN.radius *= 2;
// μ do Sol acompanha (×2.2): sem isso a superfície MAIOR fica mais "fraca"
// (v_esc ∝ √(μ/R)) e a ZONA DE NÃO-RETORNO do Sol deixaria de existir (AC-04b).
SUN.mu *= 2.2;

// ---------------------------------------------------------------------------
// SISTEMA 5 — NÚCLEO DA GALÁXIA (rework 2026-07-02, pedido do operador): as
// estrelas S andam em ELIPSES KEPLERIANAS calmas em trilho — como as órbitas
// REAIS medidas em volta de Sagitário A* (S2 e companhia) — mais DISTANTES e
// MAIORES, cada uma com campo gravitacional próprio e SOI de Hill: dá para
// aproximar e SEGUIR uma estrela em órbita DELA enquanto ela orbita o buraco
// negro (patched-conics + aceleração de frame exata do trilho elíptico).
// O caos N-corpos de verdade fica no sistema 'chaotic'.
// ---------------------------------------------------------------------------
export const CORE = {
  smbh: {
    name: 'Sagitário A✦', key: 'sgr', kind: 'blackhole',
    rs: 900, radius: 900,
    mu: 4.0e12,
    soi: 420_000, gravReach: 420_000,
    disk: { inner: 2000, outer: 14_000 },
    photonRing: 1200,
    jet: true,                // jato relativístico bipolar (print M87*)
  },
  starCount: 12,
  aMin: 70_000,      // semieixo maior mínimo (estrelas menores por dentro)
  aMax: 260_000,     // semieixo maior máximo (supergigantes na periferia)
  eMin: 0.12,        // excentricidades moderadas — grandioso, não caótico
  eMax: 0.50,
  inclMax: 0.55,     // rad — planos orbitais variados (como os S-stars reais)
  // paleta espectral (M vermelha → O azul), MAIOR e mais massiva que antes;
  // ordenada da MENOR para a MAIOR: o raio cresce com o semieixo (Hill maior fora)
  starPalette: [
    { color: 0xff6a3a, color2: 0xb03a12, radius: 2800, mu: 2.3e11, cellScale: 5 },
    { color: 0xff9a52, color2: 0xd06020, radius: 3300, mu: 2.9e11, cellScale: 6 },
    { color: 0xffd27a, color2: 0xd09838, radius: 3800, mu: 3.6e11, cellScale: 7 },
    { color: 0xfff2cc, color2: 0xe0c080, radius: 4600, mu: 4.6e11, cellScale: 8 },
    { color: 0xcfe0ff, color2: 0x93b0e8, radius: 5400, mu: 5.8e11, cellScale: 9 },
    { color: 0xa8c4ff, color2: 0x6a8ce0, radius: 6500, mu: 7.2e11, cellScale: 10 },
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
