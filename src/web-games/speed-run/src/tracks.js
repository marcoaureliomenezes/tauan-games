// tracks.js — OS MAPAS do Cruis'n Tauan (inspirado em Cruis'n World, N64).
//
// Cada pista é DADOS: spline fechada (Catmull-Rom), largura, perfil de elevação,
// trechos de TERRA (atrito menor + tremulação), LOMBADAS (s normalizado), paleta
// do bioma, camadas de HORIZONTE com PARALLAX e o cenário ao redor da pista
// (árvores/cactos/prédios, cercas, placas). O builder (world.js) materializa.
//
// Superfícies e física (physics.js consome):
//   asphalt  → grip 1.00, arrasto 1.00, rumble 0
//   dirt     → grip 0.62, arrasto 1.15, rumble 1  (estrada de terra)
//   offroad  → grip 0.45, arrasto 2.30, rumble 1.6 (fora da pista)

export const SURFACES = {
  asphalt: { grip: 1.0, drag: 1.0, rumble: 0.0 },
  dirt: { grip: 0.62, drag: 1.15, rumble: 1.0 },
  offroad: { grip: 0.45, drag: 2.3, rumble: 1.6 },
};

// pts: [x, z] no plano — o Y vem do perfil de elevação (hills + lombadas).
export const TRACKS = [
  {
    key: 'city', name: 'Centro Urbano',
    desc: 'Circuito entre arranha-céus — asfalto liso, desvio de obras em terra.',
    width: 16,
    pts: [
      [0, 0], [220, -40], [420, 0], [560, 140], [560, 340], [430, 470],
      [230, 500], [40, 460], [-120, 520], [-300, 480], [-380, 320],
      [-330, 140], [-180, 60], [-80, -20],
    ],
    // colinas suaves + viaduto
    hills: { amp: 6, freq: 3 },
    bumps: [0.16, 0.55, 0.56, 0.86],                    // lombadas (viaduto/obras)
    dirt: [[0.52, 0.62]],                               // desvio de obras
    palette: {
      skyTop: 0x77b5e8, skyBot: 0xf5d9b0, ground: 0x5b6b5a, road: 0x3a3d42,
      dirt: 0x8a6a45, curb1: 0xd8503c, curb2: 0xf0ead8, fog: 0xc7d8e8,
    },
    horizon: [
      // camadas de parallax: [cor, distância, altura, serrilhado, k(parallax)]
      { color: 0x8fa8c0, dist: 5200, h: 420, jag: 0.5, k: 0.06 },   // montanhas ao longe
      { color: 0x5e7590, dist: 3400, h: 260, jag: 0.25, k: 0.16 },  // skyline distante
    ],
    scenery: { buildings: 90, trees: 60, lamps: 48, rails: true, fences: false, cacti: 0, cabins: 0, mesas: 0 },
    signs: ['TAUAN GP', 'CENTRO', 'BOX 500m', 'CURVA!', 'OBRAS — TERRA'],
  },
  {
    key: 'forest', name: 'Floresta Temperada',
    desc: 'Serra verde com pinheiros, cercas de madeira e um trecho de terra batida.',
    width: 14,
    pts: [
      [0, 0], [260, -60], [480, 40], [600, 240], [520, 430], [330, 520],
      [140, 620], [-80, 660], [-280, 580], [-420, 420], [-460, 220],
      [-360, 40], [-180, -40],
    ],
    hills: { amp: 22, freq: 4 },                        // serra: sobe-e-desce real
    bumps: [0.3, 0.31, 0.74],
    dirt: [[0.38, 0.56]],                               // estradão de terra na mata
    palette: {
      skyTop: 0x6fb0e0, skyBot: 0xdff0d8, ground: 0x3f6b34, road: 0x44474c,
      dirt: 0x7a5c38, curb1: 0xc8b890, curb2: 0x8a7a55, fog: 0xbcd8c4,
    },
    horizon: [
      { color: 0x7d9db8, dist: 5200, h: 520, jag: 0.6, k: 0.06 },   // cordilheira azulada
      { color: 0x39604a, dist: 3200, h: 300, jag: 0.45, k: 0.16 },  // morros de mata
    ],
    scenery: { buildings: 0, trees: 420, lamps: 0, rails: false, fences: true, cacti: 0, cabins: 8, mesas: 0 },
    signs: ['SERRA VERDE', 'DESCIDA!', 'TERRA 400m', 'MADEIREIRA', 'CURVA!'],
  },
  {
    key: 'arizona', name: 'Deserto do Arizona',
    desc: 'Retões na Route 66 entre mesas vermelhas e saguaros — areia solta no acostamento.',
    width: 15,
    pts: [
      [0, 0], [340, -30], [640, 60], [820, 260], [760, 480], [520, 560],
      [260, 520], [40, 600], [-240, 640], [-460, 520], [-560, 300],
      [-460, 90], [-220, -30],
    ],
    hills: { amp: 10, freq: 2.5 },
    bumps: [0.22, 0.48, 0.49, 0.5, 0.9],                // costelas de duna
    dirt: [[0.62, 0.78]],
    palette: {
      skyTop: 0x6fa8d8, skyBot: 0xf6c890, ground: 0xb5713f, road: 0x4a453e,
      dirt: 0x9a6a3c, curb1: 0xd0d0c8, curb2: 0x707068, fog: 0xe8c9a0,
    },
    horizon: [
      { color: 0xc06a48, dist: 5400, h: 380, jag: 0.2, k: 0.06 },   // mesas no horizonte
      { color: 0x8a4a34, dist: 3300, h: 240, jag: 0.15, k: 0.16 },  // buttes mais perto
    ],
    scenery: { buildings: 0, trees: 0, lamps: 0, rails: false, fences: true, cacti: 260, cabins: 3, mesas: 14 },
    signs: ['ROUTE 66', 'GAS 2mi', 'ARIZONA', 'AREIA!', 'MOTEL'],
  },
];
