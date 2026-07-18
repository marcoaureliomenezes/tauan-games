// hud.js — HUD: health/stamina/food bars, ammo, gait, controls hint.
// Exports: initHud, updateHud. To add a widget, add a span in index.html + update here.

import { PLAYER, CAMP, ANIMALS, BANDITS } from './config.js';
import { game } from './state.js';

let el = {};

/** Caches DOM refs. Call once from main.js. */
export function initHud() {
  el = {
    hp: document.getElementById('hp-fill'),
    stamina: document.getElementById('stamina-fill'),
    food: document.getElementById('food-fill'),
    ammo: document.getElementById('ammo'),
    gait: document.getElementById('gait'),
    cam: document.getElementById('cam-mode'),
    bandits: document.getElementById('bandits'),
    carrying: document.getElementById('carrying'),
    flash: document.getElementById('damage-flash'),
    prompt: document.getElementById('prompt'),
    staminaTrack: document.getElementById('stamina-fill')?.parentElement,
  };
}

/** Context-sensitive [E] interaction prompt. */
function promptText() {
  const p = game.player;
  for (const b of game.entities.bandits) {
    if (b.state === 'surrendered' &&
        Math.hypot(b.position.x - p.position.x, b.position.z - p.position.z) < BANDITS.CAPTURE_DIST) {
      return '[E] Capturar';
    }
  }
  if (!p.carrying) {
    for (const c of game.entities.carcasses) {
      if (Math.hypot(c.position.x - p.position.x, c.position.z - p.position.z) < ANIMALS.PICKUP_DIST) {
        return '[E] Pegar veado';
      }
    }
  }
  const camp = game.entities.camp;
  if (p.carrying === 'deer' && camp &&
      Math.hypot(camp.position.x - p.position.x, camp.position.z - p.position.z) < CAMP.DELIVER_R) {
    return '[E] Entregar caça';
  }
  return '';
}

function setBar(fill, value, max) {
  if (fill) fill.style.width = `${Math.max(0, Math.min(100, (value / max) * 100))}%`;
}

/** Per-frame HUD refresh from game.player / game.ui. */
export function updateHud() {
  const p = game.player;
  setBar(el.hp, p.health, PLAYER.HEALTH);
  setBar(el.stamina, p.stamina, PLAYER.STAMINA);
  setBar(el.food, p.food, PLAYER.FOOD);
  if (el.ammo) {
    el.ammo.textContent = game.flags.reloading
      ? 'RELOADING…'
      : `AMMO ${p.ammo} / ${p.ammoReserve}`;
  }
  if (el.gait) el.gait.textContent = p.gait.toUpperCase();
  if (el.cam) el.cam.textContent = game.ui.cameraMode === 'first' ? '1ST' : '3RD';
  if (el.bandits) el.bandits.textContent = `BANDIDOS: ${p.banditsCaptured}/5`;
  if (el.carrying) el.carrying.textContent = p.carrying ? `CARRYING: ${p.carrying.toUpperCase()}` : '';
  if (el.flash) el.flash.style.opacity = Math.max(0, Math.min(1, game.flags.damageFlash * 2.2));
  if (el.staminaTrack) el.staminaTrack.classList.toggle('low', p.stamina < 25);
  if (el.prompt) {
    const text = promptText();
    el.prompt.textContent = text;
    el.prompt.classList.toggle('hidden', !text);
  }
}
