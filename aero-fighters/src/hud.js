// hud.js — HUD na tela + overlay central. Diff-render para evitar reflow desnecessário.
// Exporta: updateHUD, showOverlay, hideOverlay, tickOverlayTimer, setSoundIcon.
// Para adicionar widget novo: adicione span no index.html + campo em _h + linha em updateHUD.

import { game } from './state.js';

const livesEl    = document.getElementById('lives');
const scoreEl    = document.getElementById('score');
const missilesEl = document.getElementById('missiles');
const heavyEl    = document.getElementById('heavy-missiles');
const altEl      = document.getElementById('altitude');
const targetsEl  = document.getElementById('targets');
const missionEl  = document.getElementById('mission');
const overlayEl  = document.getElementById('overlay');
const speedEl    = document.getElementById('speed');
const throttleEl = document.getElementById('throttle');
const stallEl    = document.getElementById('stall-warn');

const _h = { lives:-1, score:-1, msls:-1, hvy:-1, alt:-1, tgt:'', mis:-1, spd:-1, thr:-1, stall:null };

/** Atualiza HUD lendo de `game.player` e flags. Mudanças só renderizam o que mudou. */
export function updateHUD() {
  const liv = Math.max(0, game.player.lives);
  if (liv !== _h.lives) { livesEl.textContent = '♥'.repeat(liv) || '-'; _h.lives = liv; }
  const sc = Math.max(0, Math.floor(game.score));
  if (sc !== _h.score) { scoreEl.textContent = 'SCORE: ' + String(sc).padStart(6, '0'); _h.score = sc; }
  if (game.player.missiles !== _h.msls) { missilesEl.textContent = 'MSLS: ' + game.player.missiles; _h.msls = game.player.missiles; }
  if (heavyEl && game.player.heavyMissiles !== _h.hvy) { heavyEl.textContent = 'HVY: ' + game.player.heavyMissiles; _h.hvy = game.player.heavyMissiles; }
  const alt = Math.max(0, Math.floor(game.player.y * 10));
  if (alt !== _h.alt) { altEl.textContent = 'ALT: ' + alt + 'm'; _h.alt = alt; }
  const tgt = `ALVOS: ${game.targetsDestroyed}/${game.targetsTotal}`;
  if (tgt !== _h.tgt && targetsEl) { targetsEl.textContent = tgt; _h.tgt = tgt; }
  if (game.cycle !== _h.mis && missionEl) { missionEl.textContent = 'MISSÃO ' + game.cycle; _h.mis = game.cycle; }
  const spd = Math.round(game.player.speed);
  if (spd !== _h.spd) { speedEl.textContent = 'SPD: ' + spd; _h.spd = spd; }
  const thr = Math.round(game.player.throttle * 100);
  if (thr !== _h.thr) { throttleEl.textContent = 'THR: ' + thr + '%'; _h.thr = thr; }
  const stalled = game.player.stalled;
  if (stalled !== _h.stall) { stallEl.style.display = stalled ? 'inline-block' : 'none'; _h.stall = stalled; }
}

let overlayTimer = 0;

/** Mostra overlay central. msHide=0 = permanente até hideOverlay. */
export function showOverlay(title, sub = '', msHide = 0) {
  overlayEl.innerHTML = `<div>${title}</div>` + (sub ? `<div class="sub">${sub}</div>` : '');
  overlayEl.classList.add('visible');
  overlayTimer = msHide > 0 ? msHide / 1000 : 0;
}

export function hideOverlay() {
  overlayEl.classList.remove('visible');
  overlayTimer = 0;
}

/** Decrementa timer de auto-hide. Chamar em cada tick. */
export function tickOverlayTimer(dt) {
  if (overlayTimer > 0) {
    overlayTimer -= dt;
    if (overlayTimer <= 0) hideOverlay();
  }
}

/** Atualiza o ícone do botão de som. */
export function setSoundIcon(muted) {
  const btn = document.getElementById('sound-toggle');
  if (btn) btn.textContent = muted ? '🔇 SOM' : '🔊 SOM';
}
