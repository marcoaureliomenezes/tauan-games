// config.js — Constantes do universo Space War.
// ESCALA GRANDE E REALISTA: corpos ~100x maiores que o protótipo, distâncias
// astronômicas (planetas longe e pequenos de longe, ENORMES de perto), gravidade
// newtoniana com SOI dominante (patched conics, estilo Kerbal) — dá pra orbitar.
// Unidade base ≈ 3 km. Mexer nesses números muda o equilíbrio — é o painel de controle.

// ---------------------------------------------------------------------------
// Tempo
// ---------------------------------------------------------------------------
export const EARTH_YEAR = 1800;     // s para a Terra dar 1 volta no Sol (= 30 min)
export const EARTH_DAY = 60;        // s para a Terra girar 1× (~1 min)
export const MOON_MONTH = 60;       // s para a Lua orbitar a Terra

// ---------------------------------------------------------------------------
// Voo / nave (newtoniano — inércia real, dá pra orbitar)
// ---------------------------------------------------------------------------
export const SHIP = {
  maxThrustAccel: 460,    // u/s² de empuxo no throttle máximo
  boostMultiplier: 4.0,   // afterburner (Shift) → ~1840 u/s²
  brakeAccel: 620,        // freio (tecla X): empuxo contra a velocidade atual
  pitchRate: 1.3,         // rad/s
  yawRate: 1.0,
  rollRate: 2.0,
  alignRate: 3.0,         // rad/s do piloto automático de mira (tecla C)
  maxSpeedSoft: 6000,     // u/s — acima disso o HUD marca "WARP"; sem limite rígido
  startAltitude: 60,      // u acima da superfície da Terra ao decolar
  size: 2.4,              // escala da malha da nave
};

// Atmosfera (perto da Terra, para a decolagem com horizonte)
export const ATMO = {
  thickness: 900,         // espessura da atmosfera acima da superfície (u)
  drag: 0.6,
};

// ---------------------------------------------------------------------------
// Gravidade — SOI DOMINANTE (um corpo te governa por vez)
// Só a gravidade do corpo cujo SOI te contém E é o menor (mais local) é aplicada.
// Assim a Terra te governa perto da Terra (o Sol não te arranca), e dá pra orbitar.
// ---------------------------------------------------------------------------
export const SUN_NORETURN = 13000;  // dentro deste raio do Sol, fuga é impossível mesmo no turbo
                                    // (g_sol > empuxo turbinado ≈1840 u/s² dentro de ~13600)

// Renderização da escala grande
export const RENDER = {
  skyboxRadius: 1_500_000,
  far: 3_000_000,
};

// ---------------------------------------------------------------------------
// Corpos. radius (u) | orbit (u, a partir do pai) | periodFactor (relativo à Terra)
// mu = G·M (gravidade) | soi (raio do campo de influência) | spin (s) | tilt (rad)
// ---------------------------------------------------------------------------
export const SUN = {
  name: 'Sol',
  radius: 9000,
  color: 0xfff2bf,
  mu: 3.4e11,         // domina o sistema; cria a zona de não-retorno (g≥1840 dentro de ~16000)
  soi: 4_000_000,     // governa todo o espaço interplanetário (fora dos SOIs dos planetas)
  spin: 540,
  light: 0xfff4d6,
};

export const PLANETS = [
  {
    name: 'Mercúrio', key: 'mercury',
    radius: 760, color: 0x9a8b7d, color2: 0x6b5d50, kind: 'rock',
    orbit: 22000, periodFactor: 0.241, tilt: 0.12, spin: 90,
    mu: 3.0e7, soi: 5000,    // SOI local — não pode invadir o Sol nem os vizinhos
    moons: [],
  },
  {
    name: 'Vênus', key: 'venus',
    radius: 1900, color: 0xe6cd92, color2: 0xc9a55f, kind: 'cloud',
    orbit: 34000, periodFactor: 0.615, tilt: 0.06, spin: 240,
    mu: 3.1e8, soi: 7000, atmosphere: 0xe6cd92,
    moons: [],
  },
  {
    name: 'Terra', key: 'earth',
    radius: 2000, color: 0x1c66b0, color2: 0x2f7d3a, kind: 'earth',
    orbit: 46000, periodFactor: 1.0, tilt: 0.0, spin: EARTH_DAY,
    mu: 4.4e8, soi: 10000, atmosphere: 0x6fb6ff, hasAtmo: true,   // contém a Lua (orbit 8000)
    moons: [
      { name: 'Lua', radius: 545, color: 0xbfbfc4, orbit: 8000, period: MOON_MONTH, spin: 60, mu: 8.9e6, soi: 3000 },
    ],
  },
  {
    name: 'Marte', key: 'mars',
    radius: 1060, color: 0xb5492c, color2: 0x7d2f1c, kind: 'rock',
    orbit: 66000, periodFactor: 1.881, tilt: 0.03, spin: 62,
    mu: 5.6e7, soi: 9000, atmosphere: 0xd98a6a,
    moons: [
      { name: 'Fobos', radius: 90, color: 0x7a6a5c, orbit: 2200, period: 12, spin: 12, mu: 1.0e5, soi: 600 },
      { name: 'Deimos', radius: 64, color: 0x877668, orbit: 3400, period: 24, spin: 24, mu: 5.0e4, soi: 460 },
    ],
  },
  {
    name: 'Júpiter', key: 'jupiter',
    radius: 21000, color: 0xc9a878, color2: 0x8c6a4a, kind: 'gas', bands: true, redspot: true,
    orbit: 140000, periodFactor: 11.86, tilt: 0.02, spin: 26,
    mu: 1.1e11, soi: 60000, atmosphere: 0xd8b890,   // borda interna 80000 > Marte 66000
    moons: [
      { name: 'Io', radius: 547, color: 0xe6d36a, orbit: 30000, period: 24, spin: 24, mu: 7.5e6, soi: 4400 },
      { name: 'Europa', radius: 470, color: 0xcdbfae, orbit: 40000, period: 40, spin: 40, mu: 6.0e6, soi: 3800 },
      { name: 'Ganimedes', radius: 780, color: 0x9b8d7d, orbit: 48000, period: 64, spin: 64, mu: 1.0e7, soi: 6200 },
      { name: 'Calisto', radius: 720, color: 0x6f6358, orbit: 56000, period: 110, spin: 110, mu: 9.0e6, soi: 5600 },
    ],
  },
  {
    name: 'Saturno', key: 'saturn',
    radius: 18000, color: 0xd8c89a, color2: 0xb09a6a, kind: 'gas', bands: true,
    orbit: 210000, periodFactor: 29.46, tilt: 0.04, spin: 28,
    mu: 6.5e10, soi: 55000, atmosphere: 0xe6d8b0,   // borda interna 155000 > Júpiter 140000
    ring: { inner: 21600, outer: 41000, color: 0xd9c8a0, tilt: 0.47 },
    moons: [
      { name: 'Titã', radius: 760, color: 0xd9a24a, orbit: 47000, period: 90, spin: 90, mu: 1.0e7, soi: 6000 },
      { name: 'Reia', radius: 380, color: 0xb8b0a4, orbit: 33000, period: 54, spin: 54, mu: 4.0e6, soi: 3000 },
    ],
  },
  {
    name: 'Urano', key: 'uranus',
    radius: 8000, color: 0x9fe0e4, color2: 0x73c6cc, kind: 'ice',
    orbit: 280000, periodFactor: 84.0, tilt: 0.05, spin: 34,
    mu: 8.3e9, soi: 35000, atmosphere: 0xaff0f4,
    ring: { inner: 10000, outer: 14000, color: 0x88b0b4, tilt: 1.5 },
    moons: [
      { name: 'Titânia', radius: 360, color: 0xa8a0a0, orbit: 16000, period: 64, spin: 64, mu: 3.0e6, soi: 2400 },
      { name: 'Oberon', radius: 340, color: 0x968e8e, orbit: 22000, period: 90, spin: 90, mu: 2.8e6, soi: 2200 },
    ],
  },
  {
    name: 'Netuno', key: 'neptune',
    radius: 7700, color: 0x3554d4, color2: 0x2138a0, kind: 'ice',
    orbit: 340000, periodFactor: 164.8, tilt: 0.03, spin: 32,
    mu: 8.3e9, soi: 35000, atmosphere: 0x5a78f0,
    moons: [
      { name: 'Tritão', radius: 470, color: 0xc9c0c0, orbit: 15000, period: 60, spin: 60, mu: 3.0e6, soi: 2600, retrograde: true },
    ],
  },
];

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
