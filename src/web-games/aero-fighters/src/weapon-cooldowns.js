// weapon-cooldowns.js — armas do jogador por CADÊNCIA, não por munição.
// Conceito (operador, 2026-08-11): todo míssil é infinito; o que limita é o
// cooldown por arma. Módulo PURO (zero three.js/DOM) — testável em Node.
//
//   X  (leve)    — até 5 por segundo  → 0.2 s
//   B  (pesado)  — 1 por segundo      → 1.0 s
//   R  (rod)     — 1 a cada 5 s       → 5.0 s
//   T  (nuclear) — 1 por minuto       → 60 s
//
// Contrato: o cooldown só é ARMADO quando o disparo de fato acontece (ex.: rod
// sem alvo válido no raio não arma; leve/pesado sem lock não armam). Quem decide
// isso é o caller (main.js), via tryConsume() após confirmar o disparo.

export const WEAPON_COOLDOWN_S = {
  light: 0.2,
  heavy: 1.0,
  rod: 5.0,
  nuclear: 60.0,
};

/** Estado inicial: todas as armas prontas. */
export function createWeaponCooldowns() {
  return { light: 0, heavy: 0, rod: 0, nuclear: 0 };
}

/** Avança o relógio: decrementa cada cooldown até o piso 0. */
export function tickWeaponCooldowns(cd, dt) {
  for (const k in cd) cd[k] = Math.max(0, cd[k] - dt);
}

/** true se a arma está pronta para disparar. */
export function weaponReady(cd, kind) {
  return (cd[kind] ?? 0) <= 0;
}

/** Arma o cooldown da arma (chamar SÓ quando o disparo aconteceu).
 * Retorna false (e não arma) se a arma ainda estava recarregando. */
export function tryConsume(cd, kind) {
  if (!weaponReady(cd, kind)) return false;
  cd[kind] = WEAPON_COOLDOWN_S[kind];
  return true;
}

/** Fração restante de recarga em [0,1] — 0 = pronta (para HUD/visual). */
export function cooldownFrac(cd, kind) {
  const total = WEAPON_COOLDOWN_S[kind];
  return total > 0 ? Math.min(1, Math.max(0, (cd[kind] ?? 0) / total)) : 0;
}

/** Reduz o cooldown corrente de uma arma (recompensas/pickups/serviço).
 * `seconds = Infinity` zera (recarga completa). */
export function shaveCooldown(cd, kind, seconds) {
  cd[kind] = Math.max(0, (cd[kind] ?? 0) - seconds);
}

/** Zera todos os cooldowns (rearm completo no serviço de pista). */
export function resetWeaponCooldowns(cd) {
  for (const k in cd) cd[k] = 0;
}
