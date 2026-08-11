// Game modes (SPEC v0.9.0 R-01/R-02, ADR-1). Modo Tauan is tuned for a
// 3-year-old: no deadlines, no collateral fines, one target at a time, soft
// 50% thresholds, stronger wrecking ball and stronger homing. Modo Contratos
// is the original game, untouched.

export const MODES = {
  tauan: {
    id: 'tauan',
    label: 'Modo Tauan',
    // mission shaping (consumed by MissionSystem options in main.js)
    threshold: 0.5,
    singleTarget: true,
    deadlines: false,
    collateralFines: false,
    // destruction ease (R-02): energy multiplier on ball impacts
    damageMultiplier: 2.5,
    // homing servo tuning (R-03, ADR-2): stronger assist for the kid
    homing: { gain: 2.6, maxA: 34, cruise: 15 },
  },
  contratos: {
    id: 'contratos',
    label: 'Modo Contratos',
    threshold: null,           // per-contract spec.threshold (0.8–0.9)
    singleTarget: false,
    deadlines: true,
    collateralFines: true,
    damageMultiplier: 1.0,
    homing: { gain: 2.0, maxA: 26, cruise: 14 },
  },
};

export const DEFAULT_MODE = 'tauan';
