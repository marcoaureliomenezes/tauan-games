// test-celestial-unit.js — Leis de derivação da biblioteca celestial (node puro).
// Padrão do repo: igual a tests/aero-fighters/tools/test-aero-unit.js — assertivas
// simples, exit 1 no primeiro erro, saída legível. Roda com:
//   npm run test:space-war:unit

import {
  MU_EARTH_GAME, MU_SUN_GAME,
  muFromEarthMasses, muFromSolarMasses, solarMassesFromMu,
  spectralFromMass, radiusFromMass, remnantTypeForMass,
  hillSoi, visVivaSpeed, circularSpeed, keplerPeriod,
  defaultGravReach, barycentricRadii, ellipseParams,
} from '../../../space-war/src/celestial/physics.js';

let failures = 0;
function check(name, cond, detail = '') {
  if (cond) { console.log(`  ok  ${name}`); }
  else { failures++; console.error(`FAIL  ${name}${detail ? ' — ' + detail : ''}`); }
}
function close(a, b, tol = 1e-9) { return Math.abs(a - b) <= tol * Math.max(1, Math.abs(a), Math.abs(b)); }

console.log('· escala μ do jogo (D-3: paridade com config.js)');
check('μ(1 M⊕) = 3.0e6', muFromEarthMasses(1) === 3.0e6);
check('μ(1 M☉) = 1.0e12', muFromSolarMasses(1) === 1.0e12);
check('333000 M⊕ ≈ 1 M☉ (fecha a escala real)', close(muFromEarthMasses(333000), MU_SUN_GAME, 1e-3));
check('Betelgeuse μ=1.6e13 ↔ 16 M☉', close(solarMassesFromMu(1.6e13), 16));

console.log('· espectro por massa (AC-03: 0.2 M☉ = anã vermelha, 15 M☉ = azul)');
const dwarf = spectralFromMass(0.2);
const blue = spectralFromMass(15);
const sun = spectralFromMass(1.0);
check('0.2 M☉ → classe M', dwarf.class === 'M');
check('0.2 M☉ → cor quente/vermelha (R>G>B)', ((dwarf.color >> 16) & 255) > ((dwarf.color >> 8) & 255) && ((dwarf.color >> 8) & 255) > (dwarf.color & 255));
check('15 M☉ → classe B (azul-branca)', blue.class === 'B');
check('15 M☉ → cor fria/azul (B>R)', (blue.color & 255) > ((blue.color >> 16) & 255));
check('1.0 M☉ → classe G (Sol)', sun.class === 'G');
check('1.0 M☉ → cor do Sol do jogo', sun.color === 0xfff2bf);

console.log('· monotonicidade massa→raio (main sequence)');
let mono = true;
let prev = 0;
for (const m of [0.1, 0.3, 0.6, 1, 2, 5, 10, 20, 50]) {
  const r = radiusFromMass(m);
  if (r < prev) mono = false;
  prev = r;
}
check('raio não-decrescente com a massa', mono);
check('raio(1 M☉) = raio do Sol do jogo', close(radiusFromMass(1), 22000));

console.log('· escada de destino evolutivo (NASA)');
check('3 M☉ → white-dwarf', remnantTypeForMass(3) === 'white-dwarf');
check('12 M☉ → neutron-star', remnantTypeForMass(12) === 'neutron-star');
check('25 M☉ → black-hole', remnantTypeForMass(25) === 'black-hole');

console.log('· mecânica orbital');
// Hill: mesma fórmula usada no core (estrelas S vs SMBH)
check('Hill cresce com μ do corpo', hillSoi(1000, 8e11, 4e12) > hillSoi(1000, 1e11, 4e12));
check('Hill S-star exemplo coerente', close(hillSoi(70000 * (1 - 0.3), 2.3e11, 4.0e12), 49000 * Math.cbrt(2.3e11 / 1.2e13), 1e-6));
// vis-viva: em r=a (órbita circular) v = √(μ/r)
check('vis-viva reduz a v_circ em r=a', close(visVivaSpeed(1e12, 50000, 50000), circularSpeed(1e12, 50000)));
// vis-viva no apoápside < v_circ
check('vis-viva no apoápside < v_circ', visVivaSpeed(1e12, 65000, 50000) < circularSpeed(1e12, 65000));
// Kepler: BINARY.pairPeriod do jogo — T = 2π√(140000³/8e12) ≈ 116 s
check('Kepler período do binário ≈ 116 s', close(keplerPeriod(140000, 8.0e12), 2 * Math.PI * Math.sqrt(140000 ** 3 / 8.0e12)));
// baricentro: proporção inversa à massa
const [rBH, rNS] = barycentricRadii(140000, 5.0e12, 3.0e12);
check('baricentro: soma = separação', close(rBH + rNS, 140000));
check('baricentro: mais massivo fica mais perto', rBH < rNS);
// elipse: p = a(1−e²), h = √(μp)
const el = ellipseParams(100000, 0.5, 4e12);
check('elipse p = a(1−e²)', close(el.p, 75000));
check('elipse h = √(μp)', close(el.h, Math.sqrt(4e12 * 75000)));

console.log('· gravReach default (paridade config.defaultGravReach)');
check('usa 4×SOI quando maior', defaultGravReach({ soi: 4200, radius: 100 }) === 16800);
check('usa 120×raio quando maior', defaultGravReach({ radius: 1000 }) === 1000 * 120);

if (failures) { console.error(`\n${failures} falha(s)`); process.exit(1); }
console.log('\ntest-celestial-unit: todas as leis de derivação OK');
