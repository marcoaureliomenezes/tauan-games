// Web game package: james-bond.
export const CONFIG = Object.freeze({
  cellSize: 3.6,
  wallHeight: 3.15,
  eyeHeight: 1.68,
  playerSpeed: 4.8,
  sprintSpeed: 7.2,
  crouchSpeed: 2.6,
  maxHealth: 100,
  startingArmor: 50,
  interactRange: 2.45,
  fixedStep: 1 / 60,
  maxFrameDelta: 0.08,
  radarRange: 32,
  enemyVisionRange: 23,
  enemyVisionCos: 0.48,
  enemyHearingScale: 1,
  enemySpeed: 2.35,
  enemyFireRange: 18,
  maxShooters: 2,
  explosionRayBudget: 10,
  baseFov: 74,
  sprintFovBoost: 5,
  adsSpeed: 11,
  recoilRecover: 6.5,
  bloomPerShot: 0.6,
  bloomDecay: 3.4,
  hudRefresh: 0.1,
  saveKey: 'james-bond-progress-v1',
});

// accuracy = real per-round hit probability at point blank; falls off with distance.
export const DIFFICULTY = Object.freeze({
  agent: { label: 'AGENT', enemyHealth: 70, reaction: 0.8, accuracy: 0.2, damage: 6, burst: [2, 3], burstGap: 1.15, extraObjective: false },
  secret: { label: 'SECRET AGENT', enemyHealth: 92, reaction: 0.55, accuracy: 0.27, damage: 9, burst: [2, 4], burstGap: 0.95, extraObjective: true },
  double: { label: '00 AGENT', enemyHealth: 115, reaction: 0.38, accuracy: 0.34, damage: 12, burst: [3, 5], burstGap: 0.8, extraObjective: true },
});
