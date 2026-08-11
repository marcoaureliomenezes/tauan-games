// Web game package: james-bond.
// Loadout inspirado no CS 1.6, em 5 slots:
//   1 faca · 2 Desert Eagle · 3 AK-47 · 4 lança-granadas · 5 granada de mão
//
// `kind` decide como o disparo é resolvido em combat.js:
//   hitscan   — raycast instantâneo (pistola, rifle)
//   melee     — raycast curto de golpe, sem munição nem ruído de tiro
//   launcher  — projétil visível que explode no impacto (lança-granadas)
//   throwable — granada de mão arremessada com pavio
//
// knock = impulso de energia transferido ao inimigo no impacto (proporcional ao calibre).
// View-model params: muzzle = ponta do cano em espaço de view, adsFov = FOV ao mirar.
export const WEAPONS = Object.freeze({
  knife: {
    name: 'FACA', slot: 1, kind: 'melee', mag: Infinity, reserve: Infinity,
    damage: 85, cadence: 0.55, reload: 0, range: 2.4, spread: 0, recoil: 0.012,
    noise: 4, color: 0xb9c0c4, adsFov: 66, knock: 0.9,
    // `hip` sobrepõe a pose padrão do view-model: a faca é levada erguida e
    // mais para dentro da tela, em guarda, não pendurada como um cano.
    hip: [0.2, -0.19, -0.4],
    muzzle: [0, 0.02, -0.5], kick: 0.14, pitch: 0,
  },
  deagle: {
    name: 'DESERT EAGLE', slot: 2, kind: 'hitscan', mag: 7, reserve: Infinity, damage: 82, cadence: 0.32, reload: 3.0,
    // range 170 m: cobre a diagonal do maior quarteirão (~139 m) com folga —
    // sem isso o raycast hardcoded de 90 m (ver combat.js fireRay) cortava o
    // tiro no meio da rua principal antes de alcançar a outra ponta (F2).
    spread: 0.006, recoil: 0.048, noise: 28, color: 0xd7d9d5, adsFov: 58, knock: 1.5, range: 170,
    muzzle: [0, 0.03, -0.92], kick: 0.17, pitch: 150,
  },
  ak47: {
    name: 'AK-47', slot: 3, kind: 'hitscan', mag: 30, reserve: Infinity, damage: 50, cadence: 0.1, reload: 3.0,
    spread: 0.009, recoil: 0.023, noise: 32, auto: true, color: 0x283128, adsFov: 50, penetration: 1, knock: 0.85, range: 170,
    muzzle: [0, 0.05, -1.42], kick: 0.1, pitch: 180,
  },
  rpg: {
    // Munição infinita: a cadência de 5 s é o único limite. O projétil é
    // visível em voo e detona com o mesmo raio da granada de mão.
    name: 'LANÇA-GRANADAS', slot: 4, kind: 'launcher', mag: Infinity, reserve: Infinity,
    damage: 0, cadence: 5.0, reload: 0, spread: 0.002, recoil: 0.075, noise: 46,
    color: 0x3d4238, adsFov: 60, knock: 0, blastRadius: 6.5, muzzleSpeed: 34,
    // Apoiado no ombro: mais alto e deslocado para a direita da tela.
    hip: [0.3, -0.2, -0.42],
    muzzle: [0, 0.04, -1.42], kick: 0.26, pitch: 90,
  },
  grenade: {
    name: 'GRANADA', slot: 5, kind: 'throwable', mag: Infinity, reserve: Infinity,
    damage: 0, cadence: 1.0, reload: 0, spread: 0, recoil: 0.01, noise: 8,
    color: 0x334036, adsFov: 68, knock: 0, blastRadius: 6.5,
    muzzle: [0, 0.02, -0.36], kick: 0.12, pitch: 0,
  },
});

export function freshAmmo() {
  return Object.fromEntries(Object.entries(WEAPONS).map(([id, weapon]) => [id, {
    mag: weapon.mag,
    reserve: weapon.reserve,
  }]));
}
