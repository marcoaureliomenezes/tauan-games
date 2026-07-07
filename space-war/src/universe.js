// universe.js — O MAPA DECLARATIVO do universo Space War (AC-07/AC-08).
//
// Cada sistema é DADOS: { def: entrada de config.SYSTEMS, bodies() → instâncias
// da biblioteca celestial com motion plugado, decorations() → decorações }.
// Nenhuma função bespoke de montagem: quem materializa tudo é o builder único
// celestial/system.buildUniverse(). Valores físicos vêm de config.js (paridade
// D-3 — massa retro-calculada onde a API pede massa: μ/1e12 M☉, μ/3e6 M⊕).
//
// Para criar um sistema NOVO: adicione uma entrada aqui (e o registro em
// SYSTEMS) — zero código de montagem (valores finais literais, T-PR-04).

import * as THREE from '../../vendor/three.module.min.js';
import { SUN, PLANETS, BINARY, BETELGEUSE, PULSAR, CORE, SYSTEMS } from './config.js';
import { game } from './state.js';
import {
  MainSequenceStar, RedGiant, RedSupergiant, WhiteDwarf, NeutronStar, BlackHole, Star,
} from './celestial/stars.js';
import { Planet, Comet } from './celestial/planets.js';
import { Pinned, KeplerRail, EllipseRail, BinaryPair } from './celestial/motion.js';
import { barycentricRadii, keplerPeriod, hillSoi, l1Distance } from './celestial/physics.js';
import { rocheStream, supernovaRemnant } from './celestial/system.js';

const ORIGIN = new THREE.Vector3(0, 0, 0);

export function universeSystems() {
  return [
    solarSystem(),
    betelgeuseSystem(),
    devourerSystem(),
    pulsarSystem(),
    coreSystem(),
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
    // PAR BARICÊNTRICO honesto (audit T-PR-08): antes a supergigante era Pinned
    // e a Siwarha andava num trilho de gauge — agora os dois dançam em torno do
    // baricentro com o período FÍSICO de Kepler (razão de massas ~14:1: a
    // gigante mal se mexe, a companheira voa — como manda a física).
    const sep = BETELGEUSE.companion.orbit;
    const [rStar, rComp] = barycentricRadii(sep, BETELGEUSE.star.mu, BETELGEUSE.companion.mu);
    const period = keplerPeriod(sep, BETELGEUSE.star.mu + BETELGEUSE.companion.mu);
    const star = new RedSupergiant({
      ...BETELGEUSE.star,
      coronaScale: 3.6,
      light: { color: BETELGEUSE.star.light, intensity: 2.6, range: 700_000 },
    }).withMotion(new BinaryPair(center, { pairRadius: rStar, period, phase: 0 }));

    // Companheira REAL (2025): Siwarha — faísca azul-branca DENTRO do envelope.
    const comp = new Star({ ...BETELGEUSE.companion, parent: star, coronaScale: 6 })
      .withMotion(new BinaryPair(center, { pairRadius: rComp, period, phase: Math.PI }));

    const planets = BETELGEUSE.planets.map((p) =>
      new Planet({ ...p, parent: star })
        .withMotion(new KeplerRail(center, { orbit: p.orbit })));

    return [star, comp, ...planets];
  } };
}

// ═══ SISTEMA 3 — DEVORADOR: buraco negro devorando uma gigante vermelha ══════
// A gigante ENCHE o lóbulo de Roche (config: R = R_L(q=0.4, a=100k) ≈ 30.3k):
// TEARDROP apontando ao BN (uTideDir no STAR_VERT) + CORRENTE DE PLASMA nascendo
// no L1 e enrolando no plano do disco de acreção — a "mão de plasma" do operador.
function devourerSystem() {
  const bh = BINARY.blackHole, gi = BINARY.giant;
  const [rBH, rGi] = barycentricRadii(BINARY.separation, bh.mu, gi.mu);
  const period = keplerPeriod(BINARY.separation, bh.mu + gi.mu);

  let bhBody, giBody;
  return {
    def: SYSTEMS[2],
    bodies: (center) => {
      bhBody = new BlackHole({ ...bh })
        .withMotion(new BinaryPair(center, { pairRadius: rBH, period, phase: 0 }));
      giBody = new RedGiant({ ...gi })
        .withMotion(new BinaryPair(center, { pairRadius: rGi, period, phase: Math.PI }));
      return [bhBody, giBody];
    },
    decorations: () => [
      // Transbordo de Roche: plasma do L1 da gigante → arco trailing → disco.
      rocheStream(giBody, bhBody, {
        l1FromDonor: l1Distance(BINARY.separation, gi.mu, bh.mu),
        tideAmp: 0.30,
        cullKey: 'binary',
      }),
    ],
  };
}

// ═══ SISTEMA 4 — PULSAR: estrela de nêutrons + Sentinela no remanescente ═════
function pulsarSystem() {
  const ns = PULSAR.neutronStar, comp = PULSAR.companion;
  const [rNS, rComp] = barycentricRadii(PULSAR.separation, ns.mu, comp.mu);
  const period = keplerPeriod(PULSAR.separation, ns.mu + comp.mu);

  return {
    def: SYSTEMS[3],
    bodies: (center) => [
      new NeutronStar({ ...ns })
        .withMotion(new BinaryPair(center, { pairRadius: rNS, period, phase: 0 })),
      new MainSequenceStar({ ...comp })
        .withMotion(new BinaryPair(center, { pairRadius: rComp, period, phase: Math.PI })),
    ],
    decorations: (center) => [
      // A casca da supernova que criou o pulsar — envolve o par inteiro.
      supernovaRemnant({ ...PULSAR.remnant, center }),
    ],
  };
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
