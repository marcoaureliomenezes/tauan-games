// Web game package: james-bond.
//
// Modelo PURO de espalhamento/precisão do tiro. Existe separado de combat.js
// pelo mesmo motivo de gameplay/ballistics.js: testável em node, sem THREE,
// sem cena.
//
// F2 — precisão de primeiro tiro: um tiro único, deliberado (um clique só,
// sem segurar o gatilho), disparado depois de `firstShotWindow` segundos sem
// atirar, quase não espalha — é o tiro que precisa conectar a distância de
// mapa inteiro quando a mira está em cima do alvo. Rajada sustentada continua
// espalhando pelo acumulador `bloom` de combat.js (soma a cada tiro, decai
// com o tempo) — este módulo não mexe nisso, só decide o multiplicador de
// espalhamento do tiro atual.

import { CONFIG } from '../config.js';

/**
 * @param {number} timeSinceLastShot segundos desde o último disparo desta arma
 * @param {{firstShotWindow?: number}} weapon
 * @returns {boolean} true quando este tiro se qualifica como "primeiro tiro preciso"
 */
export function isPrecisionShot(timeSinceLastShot, weapon) {
  const window = weapon?.firstShotWindow ?? CONFIG.firstShotWindow;
  return timeSinceLastShot >= window;
}

/**
 * Espalhamento final do tiro, em radianos (mesma unidade de `weapon.spread`).
 *
 * @param {{spread:number}} weapon
 * @param {{bloom?:number, moveFactor?:number, crouchFactor?:number,
 *          adsFactor?:number, precise?:boolean}} state
 */
export function computeSpread(weapon, state = {}) {
  const { bloom = 0, moveFactor = 1, crouchFactor = 1, adsFactor = 1, precise = false } = state;
  const bloomFactor = precise ? CONFIG.precisionSpreadFactor : (1 + bloom);
  return weapon.spread * bloomFactor * moveFactor * crouchFactor * adsFactor;
}
