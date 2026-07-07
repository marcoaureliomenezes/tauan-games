// universe.js — O MAPA DECLARATIVO do universo Space War (AC-07/AC-08).
//
// Cada sistema é DADOS: { def: entrada de config.SYSTEMS, bodies() → instâncias
// da biblioteca celestial com motion plugado, decorations() → decorações }.
// Nenhuma função bespoke de montagem: quem materializa tudo é o builder único
// celestial/system.buildUniverse(). Valores físicos vêm de config.js (paridade
// D-3 — massa retro-calculada onde a API pede massa: μ/1e12 M☉, μ/3e6 M⊕).
//
// Para criar um sistema NOVO: adicione uma entrada aqui (e o registro em
// SYSTEMS) — zero código de montagem. O sistema "Véu" no fim é a prova (AC-08).

import * as THREE from '../../vendor/three.module.min.js';
import { SUN, PLANETS, BINARY, BETELGEUSE, CHAOTIC, CORE, SYSTEMS } from './config.js';
import { game } from './state.js';
import {
  MainSequenceStar, RedGiant, RedSupergiant, WhiteDwarf, NeutronStar, BlackHole, Star,
} from './celestial/stars.js';
import { Planet, Comet } from './celestial/planets.js';
import { Pinned, KeplerRail, EllipseRail, BinaryPair, NBodyDynamic } from './celestial/motion.js';
import { barycentricRadii, keplerPeriod, visVivaSpeed, hillSoi } from './celestial/physics.js';
import { accretionStream, supernovaRemnant } from './celestial/system.js';

const ORIGIN = new THREE.Vector3(0, 0, 0);

// ═══ SISTEMA 6 — VÉU (demo AC-08): gigante vermelha + anã branca + cometa ════
// Autorado 100% aqui — config.js intocado; o registro em SYSTEMS é aditivo.
const VEIL_SYSTEM = {
  key: 'veil', name: 'Véu — Gigante+Anã',
  // Valores finais literais — como TODO o config desde T-PR-04 (as passadas de
  // escala in-place foram colapsadas; não existe mais "lado do bloco de escala").
  center: [21_000_000, 525_000, 16_625_000], radius: 200_000, primary: 'veilgiant',
  lum: 8.02, arriveDist: 150_000,
};
SYSTEMS.push(VEIL_SYSTEM);

const VEIL = {
  giant: {
    name: 'Braseiro', key: 'veilgiant',
    mass: 5,                    // 5 M☉ → μ 5.0e12 derivado (D-3)
    radius: 30_000,
    lum: 8,                     // gigante inchada (default do kind, explícito)
    soi: 130_000, gravReach: 200_000, spin: 700,
    light: { color: 0xffb080, intensity: 2.4, range: 600_000 },
  },
  dwarf: {
    name: 'Véspera', key: 'veildwarf',
    mass: 0.9,                  // 0.9 M☉ num corpo do tamanho da Terra
    lum: 0.02,                  // anã branca: brilho de superfície alto, L ínfima
    soi: 40_000, gravReach: 90_000, spin: 60,
  },
  separation: 90_000,
  comet: { name: 'Cometa do Véu', key: 'veilcomet', radius: 40 },
};

export function universeSystems() {
  return [
    solarSystem(),
    betelgeuseSystem(),
    binarySystem(),
    chaoticSystem(),
    coreSystem(),
    veilSystem(),
  ];
}

// ═══ SISTEMA 1 — SOLAR: Sol + 8 planetas + luas + cometa Halley ══════════════
function solarSystem() {
  return { def: SYSTEMS[0], bodies: (center) => {
    const sun = new MainSequenceStar({
      ...SUN,
      cellScale: 26,            // granulação fina (vs células gigantes de supergigante)
      coronaScale: 5.0,
      lum: 1.0,                 // gauge fotométrico do jogo (I=1 a PHOTO_D0)
      light: { color: SUN.light, intensity: 3.2, range: 1_000_000, flare: true },
    }).withMotion(new Pinned(center));
    game.sun = sun;

    const planets = PLANETS.map((def) =>
      new Planet({ ...def, parent: sun })
        .withMotion(new KeplerRail(center, { orbit: def.orbit })));

    // Cometa periódico (AC-09): periélio dentro da órbita de Mercúrio, elipse
    // e=0.90 — a cauda anti-solar explode na aproximação e some no afélio.
    const halley = new Comet({
      ...{ name: 'Halley', key: 'halley', radius: 45 },
      parent: sun, primary: sun, rPeri: 90_000, tailMax: 30_000,
    }).withMotion(new EllipseRail(center, {
      mu: SUN.mu, a: 900_000, e: 0.90, incl: 0.28, node: 2.0, theta0: 1.2, dir: 1,
    }));

    return [sun, ...planets, halley];
  } };
}

// ═══ SISTEMA 2 — BETELGEUSE: supergigante + companheira Siwarha + carvões ════
function betelgeuseSystem() {
  return { def: SYSTEMS[1], bodies: (center) => {
    const star = new RedSupergiant({
      ...BETELGEUSE.star,
      coronaScale: 3.6,
      // alwaysVisible saiu (proporções verdadeiras): a 26M u a supergigante é
      // um PONTO fotométrico/glow — nenhuma malha cruza o vazio interestelar.
      light: { color: BETELGEUSE.star.light, intensity: 2.6, range: 700_000 },
    }).withMotion(new Pinned(center));

    // Companheira REAL (2025): Siwarha — faísca azul-branca DENTRO do envelope.
    const comp = new Star({ ...BETELGEUSE.companion, parent: star, coronaScale: 6 })
      .withMotion(new KeplerRail(center, { orbit: BETELGEUSE.companion.orbit }));

    const planets = BETELGEUSE.planets.map((p) =>
      new Planet({ ...p, parent: star })
        .withMotion(new KeplerRail(center, { orbit: p.orbit })));

    return [star, comp, ...planets];
  } };
}

// ═══ SISTEMA 3 — BINÁRIO: buraco negro + pulsar dentro do remanescente ═══════
function binarySystem() {
  const bh = BINARY.blackHole, ns = BINARY.neutronStar;
  // Baricentro real (r ∝ μ do parceiro) + período FÍSICO de Kepler: o trilho é
  // consistente com a gravidade → órbitas fechadas em volta de cada membro.
  const [rBH, rNS] = barycentricRadii(BINARY.separation, bh.mu, ns.mu);
  const period = keplerPeriod(BINARY.separation, bh.mu + ns.mu);

  let bhBody, nsBody;
  return {
    def: SYSTEMS[2],
    bodies: (center) => {
      bhBody = new BlackHole({ ...bh })
        .withMotion(new BinaryPair(center, { pairRadius: rBH, period, phase: 0 }));
      nsBody = new NeutronStar({ ...ns })   // light vem do config (fonte única — P1-1)
        .withMotion(new BinaryPair(center, { pairRadius: rNS, period, phase: Math.PI }));
      return [bhBody, nsBody];
    },
    decorations: (center) => [
      // Gás do REMANESCENTE caindo no disco do BN (P1-4): uma estrela de nêutrons
      // (v_esc ≈ 0.6c) NUNCA doa massa — quem alimenta o disco é o casulo da
      // supernova. Fonte = ponto fixo na casca interna do remanescente.
      accretionStream({
        def: { radius: 2600 },
        worldPos: new THREE.Vector3(center.x + BINARY.remnant.radius * 0.62, center.y + 9_000, center.z - 24_000),
        group: { visible: true },
      }, bhBody),
      // A casca da estrela que MORREU para criar o BN — envolve o sistema inteiro.
      // SEM cullKey: o fade por distância (AC-05) é quem governa a visibilidade —
      // a "bola de plasma" acende na aproximação em vez de pipocar no cull.
      supernovaRemnant({ ...BINARY.remnant, center }),
    ],
  };
}

// ═══ SISTEMA 4 — BINÁRIO CAÓTICO: 2 estrelas integradas + planetas 3-corpos ══
function chaoticSystem() {
  const sysDef = SYSTEMS[3];
  return { def: sysDef, bodies: (center) => {
    // systemDef LOCAL (fases): a reinjeção do integrador mede a fuga contra o
    // centro DA CENA (o sistema é construído na origem), não o centro galáctico.
    const localDef = { center: [center.x, center.y, center.z], radius: sysDef.radius };
    const [d1, d2] = CHAOTIC.stars;
    const muT = d1.mu + d2.mu;
    const a = CHAOTIC.pairSep, e = CHAOTIC.pairEcc;
    const rApo = a * (1 + e);
    const vRel = visVivaSpeed(muT, rApo, a);          // vis-viva no apoápside
    const f1 = d2.mu / muT, f2 = d1.mu / muT;         // frações do baricentro

    const s1 = new MainSequenceStar({ ...d1, coronaScale: 5, light: { color: d1.light, intensity: 2.4, range: 500_000 } })
      .withMotion(new NBodyDynamic({
        pos: center.clone().add(new THREE.Vector3(rApo * f1, 0, 0)),
        vel: new THREE.Vector3(0, 0, vRel * f1),
        softening: CHAOTIC.softening, systemDef: localDef, centralMu: muT, reinjectR: a,
      }));
    const s2 = new MainSequenceStar({ ...d2, coronaScale: 5, light: { color: d2.light, intensity: 2.0, range: 400_000 } })
      .withMotion(new NBodyDynamic({
        pos: center.clone().add(new THREE.Vector3(-rApo * f2, 0, 0)),
        vel: new THREE.Vector3(0, 0, -vRel * f2),
        softening: CHAOTIC.softening, systemDef: localDef, centralMu: muT, reinjectR: a,
      }));

    // Planetas circumbinários com jitter de velocidade → problema de 3 corpos real.
    const planets = CHAOTIC.planets.map((p) => {
      const ang = Math.random() * Math.PI * 2;
      const pos = new THREE.Vector3(
        center.x + Math.cos(ang) * p.orbitR,
        center.y + (Math.random() - 0.5) * p.orbitR * 0.12,
        center.z + Math.sin(ang) * p.orbitR,
      );
      const vC = Math.sqrt(muT / p.orbitR) * p.velJitter;
      const s = Math.random() < 0.5 ? 1 : -1;
      return new Planet({ ...p, parent: s1 }).withMotion(new NBodyDynamic({
        pos,
        vel: new THREE.Vector3(-Math.sin(ang) * vC * s, (Math.random() - 0.5) * vC * 0.2, Math.cos(ang) * vC * s),
        softening: CHAOTIC.softening, systemDef: localDef, centralMu: muT, reinjectR: p.orbitR,
      }));
    });

    return [s1, s2, ...planets];
  } };
}

// ═══ SISTEMA 5 — NÚCLEO DA GALÁXIA: SMBH + 12 estrelas S + errantes ══════════
function coreSystem() {
  const sysDef = SYSTEMS[4];
  return { def: sysDef, bodies: (center) => {
    const smbh = new BlackHole({ ...CORE.smbh })
      .withMotion(new Pinned(center, { isSun: false }));

    // 12 estrelas S em elipses keplerianas (como as órbitas reais de Sgr A*):
    // semieixo cresce com o índice; SOI de HILL no periélio (pior caso) garante
    // que dá para orbitar a estrela e SEGUI-LA contornando o buraco negro.
    const stars = [];
    for (let i = 0; i < CORE.starCount; i++) {
      const t = i / (CORE.starCount - 1);
      const pal = CORE.starPalette[Math.min(CORE.starPalette.length - 1, Math.floor(t * CORE.starPalette.length))];
      const a = (CORE.aMin + t * (CORE.aMax - CORE.aMin)) * (0.92 + Math.random() * 0.16);
      const e = CORE.eMin + Math.random() * (CORE.eMax - CORE.eMin);
      const rPeri = a * (1 - e);
      const rHill = hillSoi(rPeri, pal.mu, CORE.smbh.mu);
      const radius = Math.min(pal.radius * (0.9 + Math.random() * 0.2), rHill / 3.2);
      const soi = Math.min(Math.max(0.55 * rHill, 2.2 * radius), 30_000);
      stars.push(new MainSequenceStar({
        name: `Estrela S${i + 1}`, key: `s${i + 1}`,
        radius, color: pal.color, color2: pal.color2, mu: pal.mu, lum: pal.lum,
        soi, gravReach: 90_000, spin: 200 + Math.random() * 300,
        cellScale: pal.cellScale, coronaScale: 5.5,
      }).withMotion(new EllipseRail(center, {
        mu: CORE.smbh.mu, a, e,
        incl: (Math.random() * 2 - 1) * CORE.inclMax,
        node: Math.random() * Math.PI * 2,
        theta0: Math.random() * Math.PI * 2,
        dir: Math.random() < 0.5 ? -1 : 1,
      })));
    }

    // Planetas errantes — elipses excêntricas inclinadas entre as estrelas.
    const wanderers = [];
    for (let i = 0; i < CORE.planetCount; i++) {
      wanderers.push(new Planet({
        name: `Errante-${i + 1}`, key: `err${i + 1}`,
        radius: 90 + Math.random() * 220,
        color: [0x8a7a68, 0x6a8098, 0x9a6a50][i % 3], color2: 0x3a342e,
        kind: i % 2 ? 'rock' : 'ice', spin: 50,
        mu: 3.0e6 * (0.5 + Math.random()), soi: 2600,
        parent: smbh,
      }).withMotion(new EllipseRail(center, {
        mu: CORE.smbh.mu,
        a: 90_000 + Math.random() * 130_000,
        e: 0.25 + Math.random() * 0.35,
        incl: (Math.random() * 2 - 1) * CORE.inclMax,
        node: Math.random() * Math.PI * 2,
        theta0: Math.random() * Math.PI * 2,
        dir: Math.random() < 0.5 ? -1 : 1,
      })));
    }

    return [smbh, ...stars, ...wanderers];
  } };
}

// ═══ SISTEMA 6 — VÉU (AC-08): prova de que sistema novo = SÓ DADOS ═══════════
// Uma gigante vermelha e uma anã branca dançando em par binário — o par de tipos
// que a escada NASA prevê (<8 M☉ → anã branca) — com um cometa costurando os dois.
function veilSystem() {
  let giant, dwarf;
  return {
    def: VEIL_SYSTEM,
    bodies: (center) => {
      giant = new RedGiant({ ...VEIL.giant });
      dwarf = new WhiteDwarf({ ...VEIL.dwarf, parent: giant });
      const [rG, rD] = barycentricRadii(VEIL.separation, giant.mu, dwarf.mu);
      const period = keplerPeriod(VEIL.separation, giant.mu + dwarf.mu);
      giant.withMotion(new BinaryPair(center, { pairRadius: rG, period, phase: 0 }));
      dwarf.withMotion(new BinaryPair(center, { pairRadius: rD, period, phase: Math.PI }));

      const comet = new Comet({
        ...VEIL.comet,
        parent: giant, primary: giant, rPeri: 26_400, tailMax: 20_000,
      }).withMotion(new EllipseRail(center, {
        mu: giant.mu + dwarf.mu, a: 120_000, e: 0.78, incl: 0.3, node: 1.1, theta0: 0.4, dir: 1,
      }));
      return [giant, dwarf, comet];
    },
    decorations: () => [
      // A anã rouba massa da gigante inchada — mesmo componente do binário BN+pulsar.
      accretionStream(giant, dwarf, { cullKey: 'veil' }),
    ],
  };
}
