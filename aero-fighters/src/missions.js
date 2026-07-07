// missions.js — Layout fixo de alvos + fluxo de missão (start/restart/crash/nextMission).
// Exporta: spawnMission, startGame, restartGame, gameOver, crashAndDie, nextMission, targetCountForMission.
// Para adicionar uma missão diferente: edite TARGET_LAYOUT em config.js.

import * as THREE from '../../vendor/three.module.min.js';
import { game } from './state.js';
import { TARGET_LAYOUT, MISSION } from './config.js';
import { spawnTarget, clearTargets } from './targets.js';
import { spawnBoss, bossAlive, clearBoss } from './boss.js';
import { getTargetLayout, getMapHeightFn } from './maps/index.js';
import { clearMissiles, clearPickups, recycleBullet } from './projectiles.js';
import { megaExplosion, scheduleDelayed, spawnScorchMark, spawnWaterSplash } from './fx.js';
import { jet, respawnJet } from './player.js';
import { audio } from './audio.js';
import { showOverlay, hideOverlay, killFeed } from './hud.js';
import { SortieEvent, SortieState, transitionSortie } from './sortie-state.js';

/** Quantos alvos a missão N tem. Missão 1=8, 2=12, 3+=16. */
export function targetCountForMission(m) {
  const sizes = MISSION.WAVE_SIZES;
  if (m <= sizes.length) return sizes[m - 1];
  return sizes[sizes.length - 1];
}

/** Spawna todos os alvos da missão N e mostra overlay. */
export function spawnMission(missionNum) {
  clearTargets();
  clearBoss();
  game.flags.bossSpawned = false;
  // CONTRATO: writer de game.targetsDestroyed / targetsTotal
  game.targetsDestroyed = 0;
  game.flags.rtbAnnounced = false; // nova missão libera o detector de conclusão
  const n = targetCountForMission(missionNum);
  // Usa o layout e heightFn do mapa ativo
  const activeMap = game.activeMap || 'islands';
  const layout = getTargetLayout(activeMap);
  const heightFn = getMapHeightFn(activeMap);
  const count = Math.min(n, layout.length);
  for (let i = 0; i < count; i++) {
    const [idx, dx, dz, type] = layout[i];
    spawnTarget(idx, dx, dz, type, heightFn);
  }
  game.targetsTotal = game.targets.length;
  showOverlay(
    `MISSÃO ${missionNum}`,
    `${game.targetsTotal} alvos militares detectados\ndestrua todos para avançar`,
    2200,
  );
}

/** Inicia o jogo a partir do menu inicial. */
export function startGame() {
  if (game.running) return;
  // CONTRATO: writer de game.running
  game.running = true;
  if (game.missionRealism?.enabled) {
    if (game.missionRealism.sortie.state === SortieState.MENU) {
      transitionSortie(game.missionRealism.sortie, SortieEvent.START, {}, game.time);
    }
  }
  hideOverlay();
  audio.startEngine();
  if (game.targets.length === 0) spawnMission(game.cycle);
}

/** Reinicia tudo do zero (após gameOver). */
export function restartGame() {
  clearTargets();
  clearBoss();
  game.flags.bossSpawned = false;
  for (const p of game.projectiles) recycleBullet(p);
  game.projectiles.length = 0;
  clearMissiles();
  clearPickups();
  game.score = 0;
  game.kills = 0;
  game.cycle = 1;
  game.targetsDestroyed = 0;
  game.targetsTotal = 0;
  game.player.lives = 3;
  game.player.hp = 3;
  game.player.missiles = 100;
  game.player.heavyMissiles = 10;
  game.player.dead = false;
  game.flags.missionFailed = false;
  game.flags.missionCompleteShown = false;
  game.flags.invincibility = 0;
  game.flags.crashFreezeTime = 0;
  game.flags.mayday = false;
  game.flags.maydayTimer = 0;
  game.flags.damageSmoke = 0;
  game.flags.sinking = 0;
  game.flags.nukeSlowmo = 0;
  game.flags.nukeShockArrival = null;
  game.flags.supportMissilesFired = 0;
  if (game.missionRealism?.enabled) {
    game.missionRealism.sortie.state = SortieState.TAXI_OUT;
    game.missionRealism.sortie.history.push({ from: null, event: 'restart', to: SortieState.TAXI_OUT, at: game.time });
    game.missionRealism.service.active = false;
    game.missionRealism.service.phase = 'idle';
    game.missionRealism.ejection.active = false;
    if (game.missionRealism.autoTaxi) {
      game.missionRealism.autoTaxi.active = false;
      game.missionRealism.autoTaxi.phase = 'idle';
    }
  }
  respawnJet();
  game.running = true;
  hideOverlay();
  audio.startEngine();
  spawnMission(1);
}

/** Encerra o jogo com overlay de derrota. */
export function gameOver(reason = '') {
  if (game.flags.missionFailed) return;
  game.running = false;
  game.flags.missionFailed = true;
  game.player.dead = true;
  audio.stopEngine();
  showOverlay(reason || 'MISSÃO FALHOU', 'pressione Espaço para reiniciar', 0);
}

/** Crash imediato em terreno: roteado por tipo de superfície (WS-1/WS-5).
 *  'WATER' → splash (sem fireball debaixo d'água); 'GROUND'/'MOUNTAIN' → explosão. */
export function crashAndDie(where) {
  if (game.flags.missionFailed) return;
  const isWater = where === 'WATER' || where === 'SEA';
  if (isWater) {
    // Água (WS-5): splash sem fireball; o avião AFUNDA visível por ~4 s
    // (animação em updatePlayer via flags.sinking) antes do game over.
    spawnWaterSplash(jet.position.clone());
    audio.explosion(0.35, jet.position);
    game.flags.sinking = 4.2;
    game.flags.crashFreezeTime = 4.6;
    scheduleDelayed(4.3, () => gameOver('AERONAVE PERDIDA\nAFUNDOU NO MAR'));
  } else {
    megaExplosion(jet.position.clone(), 'crash');
    spawnScorchMark(jet.position.clone(), 13);
    jet.visible = false;
    game.flags.crashFreezeTime = 2.5;
    scheduleDelayed(0.1, () => gameOver('AERONAVE DESTRUÍDA\nCOLISÃO COM O TERRENO'));
  }
}

/** Missão cumprida RECUPERA a esquadrilha (T-AR-02, demanda do operador):
 *  os ferimentos do jogador saram e os amigos vivos são reparados em voo. */
function healSquadron() {
  const healed = game.player.hp < 3;
  game.player.hp = 3;
  let allies = 0;
  for (const wm of game.wingmen) {
    if (wm.dead || wm.falling) continue;
    if (wm.hp < 3) allies++;
    wm.hp = 3;
  }
  if (healed || allies) killFeed('✚ missão cumprida — esquadrilha reparada', '#5dffa0');
}

/** Avança para a próxima missão. */
export function nextMission() {
  healSquadron();
  if (game.missionRealism?.enabled) {
    transitionSortie(game.missionRealism.sortie, SortieEvent.ALL_TARGETS_DESTROYED, {}, game.time);
    // Trava o re-disparo: enquanto retornamos à base, o detector de conclusão não
    // deve reanunciar (era o que fazia o overlay "piscar" na tela a cada ~2.5s).
    game.flags.rtbAnnounced = true;
    // Toast curto e discreto — a orientação contínua de volta à base fica numa
    // linha pequena e estável no HUD (não num overlay grande piscando na tela).
    showOverlay('alvos destruídos', 'volte ao aeroporto para pousar', 1300);
    return;
  }
  game.cycle += 1;
  showOverlay('MISSÃO COMPLETA', `Missão ${game.cycle - 1} cumprida — preparando próxima zona`, MISSION.NEXT_OVERLAY_MS);
  scheduleDelayed(MISSION.COMPLETE_DELAY_MS / 1000, () => {
    if (!game.flags.missionFailed) spawnMission(game.cycle);
  });
}

/** Detecta missão completa (todos alvos destruídos). Chamar a cada tick. */
export function checkMissionComplete() {
  if (!game.running || game.flags.missionCompleteShown) return;
  // Já anunciado e em retorno à base — não reanuncia (anti-flash).
  if (game.flags.rtbAnnounced) return;
  if (game.targetsTotal === 0) return;
  if (game.targetsDestroyed >= game.targetsTotal) {
    // BOSS KAIJU: nasce quando todas as fortificações caem. A missão só completa
    // (e o pouso só libera) depois de matá-lo.
    if (!game.flags.bossSpawned) {
      game.flags.bossSpawned = true;
      const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(jet.quaternion);
      spawnBoss(jet.position, fwd);
      showOverlay('⚠ MONSTRO GIGANTE!', 'destrua o KAIJU para liberar o pouso', 2800);
      return;
    }
    if (bossAlive()) return; // espera a morte do boss
    game.flags.missionCompleteShown = true;
    scheduleDelayed(2.5, () => { game.flags.missionCompleteShown = false; });
    nextMission();
  }
}
