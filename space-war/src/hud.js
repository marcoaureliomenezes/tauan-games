// hud.js — Atualiza o HUD textual e os alertas.

import { game } from './state.js';
import { currentTarget, targetDistance } from './nav.js';

const el = (id) => document.getElementById(id);

export function updateHUD() {
  const s = game.ship;
  const tgt = currentTarget();
  if (tgt) set('navtarget', `→ ${tgt.name}: ${fmt(targetDistance())}${s.aligning ? ' 🎯' : ''}`);
  set('speed', `VEL: ${s.speed.toFixed(0)} u/s${s.speed > 900 ? ' ⚡WARP' : ''}`);
  set('throttle', `THR: ${(s.throttle * 100).toFixed(0)}%${s.boost ? ' 🔥' : ''}`);
  set('dominant', s.dominant ? `ÓRBITA: ${s.dominant.def.name}` : 'ESPAÇO PROFUNDO');
  set('altitude', s.dominant ? `ALT: ${fmt(s.altitude)}` : '');
  set('gravity', `G: ${s.gravMag.toFixed(1)} u/s²`);
  set('hp', `CASCO: ${Math.max(0, s.hp | 0)}%`);
  set('nukes', `☢ NUKES: ${s.nukes}`);
  set('score', `SCORE: ${String(game.score).padStart(6, '0')}`);
  set('kills', `ABATES: ${game.kills}`);
  if (game.mission) set('mission', game.mission.label);

  const warn = el('warning');
  if (warn) {
    if (s.landed) { warn.textContent = '🚀 SEGURE [W] PARA DECOLAR'; warn.style.display = 'block'; warn.style.color = '#66ddff'; }
    else if (s.noReturn) { warn.textContent = '☢ ZONA DE NÃO-RETORNO SOLAR — FUJA!'; warn.style.display = 'block'; warn.style.color = '#ff5560'; }
    else if (s.spawnGrace > 0) { warn.textContent = `🛡 ESCUDO ${Math.ceil(s.spawnGrace)}s`; warn.style.display = 'block'; warn.style.color = '#66ddff'; }
    else if (s.hp < 30) { warn.textContent = '⚠ CASCO CRÍTICO'; warn.style.display = 'block'; warn.style.color = '#ff5560'; }
    else if (s.inAtmosphere) { warn.textContent = '🌍 ATMOSFERA'; warn.style.display = 'block'; warn.style.color = '#ffcc44'; }
    else warn.style.display = 'none';
  }
}

function fmt(v) {
  const a = Math.abs(v);
  if (a > 1000) return `${(v / 1000).toFixed(1)}k u`;
  return `${v.toFixed(0)} u`;
}
function set(id, txt) { const e = el(id); if (e) e.textContent = txt; }

export function showOverlay(html) {
  const o = el('overlay'); if (!o) return;
  o.innerHTML = html; o.classList.add('visible');
}
export function hideOverlay() { el('overlay')?.classList.remove('visible'); }

let toastTimer = null;
export function showToast(html, ms = 4000) {
  const t = el('toast'); if (!t) return;
  t.innerHTML = html; t.classList.add('visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('visible'), ms);
}
