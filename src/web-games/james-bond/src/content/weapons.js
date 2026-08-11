// Web game package: james-bond.
// View-model params: muzzle = barrel tip in view space, ads = centered aim pose.
export const WEAPONS = Object.freeze({
  p7: {
    name: 'P7 SERVICE', slot: 1, mag: 8, reserve: 48, damage: 34, cadence: 0.28, reload: 1.25,
    spread: 0.009, recoil: 0.021, noise: 17, color: 0xd7d9d5, adsFov: 60,
    muzzle: [0, 0.02, -0.86], kick: 0.09, pitch: 220,
  },
  p7s: {
    name: 'P7 SUPPRESSED', slot: 2, mag: 8, reserve: 40, damage: 30, cadence: 0.3, reload: 1.3,
    spread: 0.007, recoil: 0.015, noise: 5, color: 0x4f5650, adsFov: 60,
    muzzle: [0, 0.02, -1.12], kick: 0.06, pitch: 300, suppressed: true,
  },
  smg: {
    name: 'VX-9 SMG', slot: 3, mag: 24, reserve: 96, damage: 18, cadence: 0.082, reload: 1.75,
    spread: 0.02, recoil: 0.011, noise: 22, auto: true, color: 0x272b2c, adsFov: 56,
    muzzle: [0, 0.04, -1.06], kick: 0.05, pitch: 320,
  },
  rifle: {
    name: 'AR-21 RIFLE', slot: 4, mag: 30, reserve: 90, damage: 27, cadence: 0.11, reload: 2.05,
    spread: 0.012, recoil: 0.016, noise: 28, auto: true, penetration: 1, color: 0x283128, adsFov: 50,
    muzzle: [0, 0.05, -1.42], kick: 0.07, pitch: 180,
  },
  shotgun: {
    name: 'M12 SHOTGUN', slot: 5, mag: 6, reserve: 30, damage: 13, pellets: 8, cadence: 0.85, reload: 2.3,
    spread: 0.07, recoil: 0.05, noise: 34, color: 0x49392b, adsFov: 58,
    muzzle: [0, 0.05, -1.28], kick: 0.16, pitch: 120,
  },
});

export function freshAmmo() {
  return Object.fromEntries(Object.entries(WEAPONS).map(([id, weapon]) => [id, {
    mag: weapon.mag,
    reserve: weapon.reserve,
  }]));
}
