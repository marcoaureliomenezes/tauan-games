// celestial/index.js — Fachada da biblioteca de componentes celestes.
// Um único import para autores de sistemas: classes, movimento, física e builder.

export { CelestialBody } from './body.js';
export {
  Star, MainSequenceStar, RedGiant, RedSupergiant, WhiteDwarf, BrownDwarf,
  NeutronStar, BlackHole,
} from './stars.js';
export { Planet, Moon, Comet } from './planets.js';
export { Pinned, KeplerRail, MoonRail, EllipseRail, BinaryPair, NBodyDynamic } from './motion.js';
export { initUniverse, loadSystem, unloadSystem, updateBodyFX, updateSOIView, accretionStream, supernovaRemnant } from './system.js';
export * as physics from './physics.js';
