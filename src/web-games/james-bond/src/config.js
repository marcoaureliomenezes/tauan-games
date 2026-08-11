// Web game package: james-bond.
export const CONFIG = Object.freeze({
  cellSize: 3.6,
  wallHeight: 3.15,
  // Segundo andar: topo da laje, espessura da laje e altura das paredes de cima.
  // floorHeight fica acima de wallHeight para sobrar pé-direito no térreo.
  floorHeight: 3.55,
  slabThickness: 0.26,
  upperWallHeight: 3.0,
  climbSpeed: 3.1,
  eyeHeight: 1.68,
  playerSpeed: 4.8,
  sprintSpeed: 7.2,
  crouchSpeed: 2.6,
  jumpSpeed: 4.6,
  gravity: 14,
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
  // Orçamento global de A* (YUKA) por fixed step, somado entre TODOS os
  // inimigos — evita a espiral de morte em que uma explosão solta o mapa
  // inteiro em `pursue`/`investigate` ao mesmo tempo (ver ai/guards.js).
  maxRepathsPerStep: 2,
  explosionRayBudget: 10,
  baseFov: 74,
  sprintFovBoost: 5,
  adsSpeed: 11,
  recoilRecover: 6.5,
  bloomPerShot: 0.6,
  bloomDecay: 3.4,
  // Precisão de primeiro tiro (F2): um tiro só, disparado depois de ficar
  // este tempo sem atirar, ignora quase todo o espalhamento da arma — é o
  // "tiro só, bem mirado" que precisa conectar a distância de mapa inteiro.
  // Rajada sustentada continua espalhando pelo acumulador `bloom` normal
  // (ver combat.js).
  firstShotWindow: 0.5,
  precisionSpreadFactor: 0.06,
  hudRefresh: 0.1,
  saveKey: 'james-bond-progress-v1',
});

// Sensibilidade do mouse (F1): multiplicador aplicado por cima do
// `pointerSpeed` base (normal ou modo criança — ver KIDS/LOOK abaixo).
// 1.0 preserva a sensação atual do jogo; a faixa cobre de "bem lento" a
// "bem rápido" sem inverter o eixo nem sair do que o PointerLockControls
// aceita como escala linear.
export const SENSITIVITY = Object.freeze({ min: 0.3, max: 3, default: 1, step: 0.1 });

/** Converte qualquer entrada (slider, localStorage, teste) num valor válido. */
export function clampSensitivity(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return SENSITIVITY.default;
  return Math.min(SENSITIVITY.max, Math.max(SENSITIVITY.min, number));
}

// Modo criança: a mira fica presa a um cone estreito à frente, para quem ainda
// está aprendendo a usar o mouse não acabar olhando para o chão ou para o céu.
// Um pouco mais de margem para baixo que para cima, senão o inimigo colado
// no jogador some do enquadramento.
export const KIDS = Object.freeze({
  pitchDownDeg: 24,
  pitchUpDeg: 16,
  pointerSpeed: 0.45,
});

// Limites padrão do olhar (ângulo polar, medido a partir do +Y).
export const LOOK = Object.freeze({
  minPolarAngle: Math.PI * 0.08,
  maxPolarAngle: Math.PI * 0.92,
  pointerSpeed: 0.78,
});

// accuracy = real per-round hit probability at point blank; falls off with distance.
export const DIFFICULTY = Object.freeze({
  agent: { label: 'AGENT', enemyHealth: 70, reaction: 0.8, accuracy: 0.2, damage: 6, burst: [2, 3], burstGap: 1.15, extraObjective: false },
  secret: { label: 'SECRET AGENT', enemyHealth: 92, reaction: 0.55, accuracy: 0.27, damage: 9, burst: [2, 4], burstGap: 0.95, extraObjective: true },
  double: { label: '00 AGENT', enemyHealth: 115, reaction: 0.38, accuracy: 0.34, damage: 12, burst: [3, 5], burstGap: 0.8, extraObjective: true },
});
