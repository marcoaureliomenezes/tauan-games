// bodies.js — FACHADA da montagem do universo (release space-war-celestial-components-v1).
//
// A construção bespoke que vivia aqui (1.193 linhas, 5 funções de sistema)
// virou a biblioteca de componentes `celestial/` + o mapa declarativo
// `universe.js`. Este arquivo só preserva os pontos de entrada que main.js
// importa: buildSolarSystem(), updateBodyFX(dt), updateSOIView(shipPos).
//
//   celestial/physics.js — leis de derivação (massa→μ/cor/raio, Hill, Kepler…)
//   celestial/atoms.js   — átomos visuais (shaders, texturas, sprites, anéis…)
//   celestial/body.js    — CelestialBody (o record canônico de game.bodies)
//   celestial/motion.js  — Pinned/KeplerRail/MoonRail/EllipseRail/BinaryPair/NBody
//   celestial/stars.js   — Star + taxonomia NASA (main sequence → buraco negro)
//   celestial/planets.js — Planet, Moon, Comet
//   celestial/system.js  — builder único + beacons + culling + decorações
//   universe.js          — OS SISTEMAS, como dados

import { buildUniverse, updateBodyFX, updateSOIView } from './celestial/system.js';
import { universeSystems } from './universe.js';

export { updateBodyFX, updateSOIView };

export function buildSolarSystem() {
  return buildUniverse(universeSystems());
}
