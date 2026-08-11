// defense/turret-player.js — Estado do artilheiro da bateria antiaérea (modo
// 'inhauma-defense'): posição fixa no morro + gimbal (yaw/pitch com clamps),
// HP/vidas, slot de arma e munição. A Onda D2 anexa o ESTADO das armas
// (calor da .50, lock AA, timer de recarga) — a lógica fica em turret-weapons.js.
// Lógica PURA — sem Three.js, Node-testável.
// Exporta: createTurretPlayer, wrapYaw, clampPitch, yawTowards, applyMouseLook,
//   selectWeapon, cycleWeapon, TURRET_WEAPONS, WEAPON_LABELS.
// Para ajustar sensibilidade/limites, edite AA_DEFENSE em config.js.

import { AA_DEFENSE } from '../config.js';

const TWO_PI = Math.PI * 2;

/** Normaliza yaw para (-π, π]. */
export function wrapYaw(yaw) {
  return ((((yaw + Math.PI) % TWO_PI) + TWO_PI) % TWO_PI) - Math.PI;
}

/** Clampa pitch nos limites do gimbal (AA_DEFENSE.PITCH_MIN/MAX, rad). */
export function clampPitch(pitch) {
  return Math.min(AA_DEFENSE.PITCH_MAX, Math.max(AA_DEFENSE.PITCH_MIN, pitch));
}

/** Yaw (rad) que aponta o forward (-Z com yaw=0) de (fx,fz) para (tx,tz). */
export function yawTowards(fx, fz, tx, tz) {
  return Math.atan2(-(tx - fx), -(tz - fz));
}

/**
 * Cria o estado do artilheiro.
 * @param {{x:number, y:number, z:number, lookAt:{x:number, y:number, z:number}}} p
 *   posição dos pés no morro (y = cota do terreno) e ponto de visada inicial.
 */
export function createTurretPlayer(p) {
  const dx = p.lookAt.x - p.x;
  const dz = p.lookAt.z - p.z;
  const dist = Math.hypot(dx, dz) || 1;
  const eyeY = p.y + AA_DEFENSE.EYE_HEIGHT;
  return {
    x: p.x, y: p.y, z: p.z,                       // posição fixa (não anda — D1)
    yaw: yawTowards(p.x, p.z, p.lookAt.x, p.lookAt.z),
    pitch: clampPitch(Math.atan2(p.lookAt.y - eyeY, dist)),
    hp: AA_DEFENSE.HP,
    lives: AA_DEFENSE.LIVES,
    weapon: 'mg',                                  // slot ativo — ver TURRET_WEAPONS
    ammo: { mg: Infinity, aa: AA_DEFENSE.AA_MISSILES },
    nukes: AA_DEFENSE.NUKE_STOCK,                  // WEAPONS-V1: 3 nukes táticas (T), sem recarga
    mg: { heat: 0, overheated: false, acc: 0 },   // T-D-04: calor da .50
    lock: { idx: -1, phaseT: 0, shotsFired: 0, holdT: 0 }, // T-W-08: mira por fases
    fireQueue: 0,                                  // T-W-08: fila de disparo do X (cap 4)
    aaRecharge: 0,                                 // T-D-05: s acumulados de recarga
    // WEAPONS-V1: cooldown por tier (aaCooldown é criado pelo consumeAa/tier)
    aaCooldown: 0, bCooldown: 0, rodCooldown: 0, nukeCooldown: 0,
  };
}

/** Aplica deltas de mouse ao gimbal (mouse pra cima = pitch sobe; clamped). */
export function applyMouseLook(turret, dx, dy, sens = AA_DEFENSE.MOUSE_SENS) {
  turret.yaw = wrapYaw(turret.yaw - dx * sens);
  turret.pitch = clampPitch(turret.pitch - dy * sens);
}

/** Slots de arma da bateria (WEAPONS-V1): scroll/dígitos ciclam nesta ordem —
 *  paridade com o caça (1 simples ∞, 2 forte B, 3 nuke T, 4 rod R). */
export const TURRET_WEAPONS = ['mg', 'aa', 'b', 'nuke', 'rod'];

/** Rótulo do slot para o HUD (`ARMA: ...`). */
export const WEAPON_LABELS = {
  mg: '.50', aa: 'MÍSSIL X', b: 'MÍSSIL B', nuke: 'NUKE T', rod: 'ROD R',
};

/** Seleciona o slot de arma (ver TURRET_WEAPONS). Slot inválido é ignorado. */
export function selectWeapon(turret, slot) {
  if (TURRET_WEAPONS.includes(slot)) turret.weapon = slot;
  return turret.weapon;
}

/** Cicla o slot de arma (scroll): mg → aa → b → nuke → rod → mg (e volta). */
export function cycleWeapon(turret, dir = 1) {
  const i = TURRET_WEAPONS.indexOf(turret.weapon);
  const n = TURRET_WEAPONS.length;
  return selectWeapon(turret, TURRET_WEAPONS[(i + dir + n) % n]);
}
