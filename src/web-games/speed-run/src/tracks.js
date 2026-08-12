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
  // VADO (WS-5): água rasa sobre a pista — grip de terra + arrasto de respingo
  water: { grip: 0.62, drag: 1.6, rumble: 0.9 },
};

// pts: [x, z] no plano — o Y vem do perfil de elevação (hills + lombadas).
//
// REGRA DE DESIGN (operador 2026-08-10): NENHUMA curva depois de uma lombada
// antes do carro pousar. Zona de pouso no pior caso (Velocità GT, 76 u/s,
// vy≈15,2 no teto 3+v·0,16, GRAV=28): D ≈ 2·76·15,2/28 + 10 ≈ 92 u após a
// crista, com curvatura κ < 0.002 rad/u (R > 500 u) em TODA a zona — assim o
// desvio lateral no pouso (≈D²·κ/2) fica dentro da meia-pista. Auditoria:
//   pista    lombada  D nec.  reta disp.              ação
//   city     0.16     92 u    curva R=257 logo após   MOVIDA p/ 0.02 (reta ppal 141 u)
//   city     0.55/56  92 u    curva R=108 logo após   MOVIDA p/ 0.03 (costela na reta ppal)
//   city     0.86     92 u    curva R=132 logo após   MOVIDA p/ 0.443 (reta 99 u;
//             a cidade só tem 2 retas ≥92 u — 4ª lombada sacrificada)
//   forest   0.3/31   92 u    curva R=137 a +90 u     MOVIDA p/ 0.42/0.43 (reta 161 u)
//   forest   0.74     92 u    curva R=243 a +120 u    MOVIDA p/ 0.03 (reta 130 u)
//   arizona  0.22     90 u    curva R=293 a +120 u    MOVIDA p/ 0.13 (reta 283 u)
//   arizona  0.48/49/50 92 u  curva R=181 logo após   MOVIDA p/ 0.565/0.575/0.585 (reta 207 u)
//   arizona  0.9      92 u    R=280 a +120 u          MOVIDA p/ 0.885 (reta 149 u)
// Validado por tests/corrida/tools/probe.mjs (PART E) — κ máx real na zona.
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
    bumps: [0.02, 0.03, 0.443],                           // lombadas (obras na reta ppal + reta de trás)
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
    // serra: sobe-e-desce real — amp 16 (era 22): as cristas dos morros
    // LANÇAVAM o carro em alta velocidade com curvas logo depois (mesma regra
    // das lombadas); com 16 o slope máx fica abaixo do gatilho de decolagem.
    hills: { amp: 16, freq: 4 },
    bumps: [0.03, 0.42, 0.43],                            // lombada da entrada + costela no estradão
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
    bumps: [0.13, 0.565, 0.575, 0.585, 0.885],          // costelas de duna (sempre em reta)
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
  // ── WS-5: SPRINT A→B (port do formato Godot, dossiê v0.7.0 §2) ────────────
  // Tauan City → Vila Serrana, ~2 km de serra com bioma de mata. Diferenças
  // estruturais das pistas de circuito:
  //   open: true   → spline ABERTA (Catmull-Rom tension 0.22, (next−prev)×0.22)
  //   profile(s,L) → elevação sob demanda: 2 → 102 → 4 m. Subida íngreme
  //     (smoothstep — nunca dispara salto: só DESCIDA dispara) e descida com
  //     slope em trapézio (cantos de 10% suavizados): full-scan 2026-08-11 —
  //     a descida (trapézio c=0,12, topo 110) media slope 0,121 REAL > 0,118 =
  //     gatilho de voo a 76 u/s (a spline com tension 0,22 mede ~1840 u, não
  //     ~2100) e o carro DECOLAVA na descida principal com CURVA (κ=0,007) na
  //     zona de pouso. Topo 102 m + c=0,10 → slope máx 98/(0,54·L·0,9) ≈
  //     0,109 (−7% sob o gatilho) — descida rápida SEM micro-hops, e o
  //     planalto 0,32→0,46 INTACTO (a lombada 1 em s=0,34 continua decolando:
  //     comprimir o planalto matou o lançamento — probe E1).
  //     Regra das lombadas (probe PART E) vale igual: as 3
  //     cristas gaussianas (6,5·exp(−(d/26)²), σ = 26/√2 ≈ 18,4 u) ficam em
  //     RETAS de ≥92 u e a zona de pouso tem κ < 0.002.
  //   segments     → largura por trecho: pista DUPLA (4×3,9 + 2×1,4 acost.)
  //     nos primeiros 30%, depois single (2×3,7 + 2×1,0); terra = 2×3,4.
  //   fords        → vados: lâmina d'água translúcida (~90 m de largura) sobre
  //     a pista; superfície 'water' (grip de terra + arrasto de respingo).
  //   fenceless    → trechos de terra SEM cerca (visual e colisor).
  //   cities       → cidades endpoint: ~26 caixas pastel instanciadas em cada
  //     ponta (16–90 m lateral, até 140 m ao longo) — Vila Serrana visível na
  //     aproximação da chegada.
  {
    key: 'serra', name: 'Serra do Tauan',
    desc: 'Sprint Tauan City → Vila Serrana — 2 km de serra: pista dupla, terra, vados e saltos.',
    sprint: true, open: true, tension: 0.22,
    width: 9.4,                                       // single: 2×3,7 + 2×1,0
    segments: [{ a: 0, b: 0.30, width: 18.4 }],       // pista DUPLA 4×3,9 + acost. 1,4
    pts: [
      [0, 0], [270, 4], [522, 27],                    // saída de Tauan City (pista dupla)
      [630, 67], [792, 83],                           // reta do salto 1 (crista s=0.34)
      [900, 150],                                     // curva de mata à esquerda
      [1035, 225], [1170, 271], [1305, 317],          // reta do salto 2 (crista s=0.58)
      [1404, 297],                                    // joelho à direita no descampado
      [1530, 248], [1665, 199], [1800, 150],          // reta do salto 3 (crista s=0.78)
      [1917, 135],                                    // chegada a Vila Serrana
    ],
    profile(s, L) {
      if (s < 0.06) return 2;
      if (s < 0.32) { const t = (s - 0.06) / 0.26; return 2 + 96 * t * t * (3 - 2 * t); }
      if (s < 0.46) { const t = (s - 0.32) / 0.14; return 98 + 4 * t * t * (3 - 2 * t); }
      const t = (s - 0.46) / 0.54, c = 0.10;
      const f = t < c ? t * t / (2 * c * (1 - c))
        : t < 1 - c ? (t - c / 2) / (1 - c)
          : 1 - (1 - t) * (1 - t) / (2 * c * (1 - c));
      return 102 - 98 * f; void L;
    },
    bumps: [0.34, 0.58, 0.78],                        // cristas de salto (retas!)
    bumpAmp: 6.5, bumpSigma: 18.4,                    // 6,5·exp(−(d/26)²) do Godot
    dirt: [[0.44, 0.52], [0.70, 0.76]],               // estradões de terra (sem cerca)
    dirtWidth: 6.8,                                   // terra: 2×3,4 (sem acostamento)
    fenceless: [[0.44, 0.52], [0.70, 0.76]],
    fords: [[0.638, 0.652], [0.868, 0.878]],          // vados (água sobre a pista)
    cities: true,
    palette: {
      skyTop: 0x6fb0e0, skyBot: 0xe8f0d0, ground: 0x35602c, road: 0x42454a,
      dirt: 0x7a5c38, curb1: 0xc8b890, curb2: 0x8a7a55, fog: 0xbcd8c4,
    },
    horizon: [
      { color: 0x7d9db8, dist: 5200, h: 560, jag: 0.6, k: 0.06 },   // cordilheira azulada
      { color: 0x39604a, dist: 3200, h: 320, jag: 0.45, k: 0.16 },  // morros de mata
    ],
    scenery: { buildings: 0, trees: 400, lamps: 0, rails: false, fences: true, cacti: 0, cabins: 6, mesas: 0 },
    signs: ['SERRA DO TAUAN', 'VILA SERRANA 2km', 'TERRA A FRENTE', 'VADO!', 'DESCIDA!'],
  },
];
