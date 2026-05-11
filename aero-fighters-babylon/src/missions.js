// missions.js — Fluxo de missoes: start/restart/crash/nextMission.
// Exporta: spawnMission, startGame, restartGame, gameOver, crashAndDie,
//   nextMission, checkMissionComplete, targetCountForMission.

import { game } from './state.js';
import { TARGET_LAYOUT, MISSION } from './config.js';
import { spawnTarget, clearTargets } from './targets.js';
import { clearMissiles, clearPickups, recycleBullet, clearNuclears } from './projectiles.js';
import { megaExplosion, scheduleDelayed } from './fx.js';
import { jet, respawnJet } from './player.js';
import { audio } from './audio.js';
import { showOverlay, hideOverlay } from './hud.js';

export function targetCountForMission(m) {
  const sizes = MISSION.WAVE_SIZES;
  if (m <= sizes.length) return sizes[m - 1];
  return sizes[sizes.length - 1];
}

export function spawnMission(missionNum) {
  clearTargets();
  game.targetsDestroyed = 0;
  const n = targetCountForMission(missionNum);
  const layout = TARGET_LAYOUT;
  const count = Math.min(n, layout.length);
  for (let i = 0; i < count; i++) {
    const [idx, dx, dz, type] = layout[i];
    spawnTarget(idx, dx, dz, type);
  }
  game.targetsTotal = game.targets.length;
  showOverlay(
    'MISSAO ' + missionNum,
    game.targetsTotal + ' alvos militares detectados\ndestrua todos para avançar',
    2200,
  );
}

export function startGame() {
  if (game.running) return;
  game.running = true;
  hideOverlay();
  audio.startEngine();
  if (game.targets.length === 0) spawnMission(game.cycle);
}

export function restartGame() {
  clearTargets();
  for (const p of game.projectiles) recycleBullet(p);
  game.projectiles.length = 0;
  clearMissiles();
  clearPickups();
  clearNuclears();
  game.score = 0;
  game.kills = 0;
  game.cycle = 1;
  game.targetsDestroyed = 0;
  game.targetsTotal = 0;
  game.player.lives = 3;
  game.player.missiles = 100;
  game.player.heavyMissiles = 10;
  game.player.nuclearMissiles = 3;
  game.player.dead = false;
  game.flags.missionFailed = false;
  game.flags.missionCompleteShown = false;
  game.flags.invincibility = 0;
  game.flags.crashFreezeTime = 0;
  respawnJet();
  game.running = true;
  hideOverlay();
  audio.startEngine();
  spawnMission(1);
}

export function gameOver(reason) {
  reason = reason !== undefined ? reason : '';
  if (game.flags.missionFailed) return;
  game.running = false;
  game.flags.missionFailed = true;
  game.player.dead = true;
  audio.stopEngine();
  showOverlay(reason || 'MISSAO FALHOU', 'pressione Espaco para reiniciar', 0);
}

export function crashAndDie(where) {
  if (game.flags.missionFailed) return;
  megaExplosion(jet.position.clone(), 'crash');
  jet.setEnabled(false);
  game.flags.crashFreezeTime = 2.5;
  const label = where === 'SEA' ? 'IMPACTO NO MAR' : 'COLISAO COM TERRENO';
  scheduleDelayed(0.1, () => gameOver('AERONAVE DESTRUIDA\n' + label));
}

export function nextMission() {
  game.cycle += 1;
  showOverlay('MISSAO COMPLETA', 'Missao ' + (game.cycle - 1) + ' cumprida — preparando proxima zona', MISSION.NEXT_OVERLAY_MS);
  scheduleDelayed(MISSION.COMPLETE_DELAY_MS / 1000, () => {
    if (!game.flags.missionFailed) spawnMission(game.cycle);
  });
}

export function checkMissionComplete() {
  if (!game.running || game.flags.missionCompleteShown) return;
  if (game.targetsTotal === 0) return;
  if (game.targetsDestroyed >= game.targetsTotal) {
    game.flags.missionCompleteShown = true;
    scheduleDelayed(2.5, () => { game.flags.missionCompleteShown = false; });
    nextMission();
  }
}
