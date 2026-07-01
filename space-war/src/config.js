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

// ---------------------------------------------------------------------------
// SISTEMA BINÁRIO — 2º sistema, logo depois de Netuno (~770k), independente do Sol.
// "Sol" = par BURACO NEGRO + ESTRELA DE NÊUTRONS orbitando o baricentro.
// Ambos COMPACTOS (menores que a Terra) com massa monstruosa concentrada.
// ---------------------------------------------------------------------------
export const BINARY = {
  center: [820_000, 0, 0],   // depois de Netuno, fora do SOI do Sol (560k) → sistemas isolados
  separation: 22000,
  pairPeriod: 160,

  blackHole: {
    name: 'Buraco Negro', key: 'blackhole', kind: 'blackhole',
    rs: 70,                   // horizonte de eventos MINÚSCULO (compacto)
    radius: 70,
    mu: 5.0e12,               // monstruoso e local — zona de não-retorno ~ até 40k
    soi: 230_000, gravReach: 230_000,    // governa o sistema binário, sem alcançar Netuno
    disk: { inner: 150, outer: 1400 },   // disco de acreção GRANDE (visível de longe)
    photonRing: 95,
  },
  neutronStar: {
    name: 'Estrela de Nêutrons', key: 'neutron', kind: 'neutron',
    radius: 28,               // minúscula (≈ uma cidade), densíssima
    mu: 3.0e12,               // gravidade brutal e local
    spin: 1.4,                // pulsar ultrarrápido
    jetTilt: 0.5,
    soi: 200_000, gravReach: 200_000,
  },
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
