// hud.js — Atualiza o HUD textual e os alertas.

import { game } from './state.js';
import { currentTarget, targetDistance } from './nav.js';
import { nearestPlanetary, modeParams } from './mode.js';

const el = (id) => document.getElementById(id);

export function updateHUD() {
  const s = game.ship;
  const mp = modeParams();
  const tgt = currentTarget();
  if (tgt) set('navtarget', `→ ${tgt.name}: ${fmt(targetDistance())}${s.aligning ? ' 🎯' : ''}`);
  const od = s.overdrive > 0.05 ? ` ✦INTERESTELAR ×${(1 + 3.5 * s.overdrive).toFixed(1)}` : '';
  set('speed', `VEL: ${s.speed.toFixed(0)} u/s${od || (s.speed > mp.cruiseSpeed * 3 ? ' ⚡WARP' : '')}`);
  set('throttle', `${s.flightAssist ? '🛟 ' : ''}THR: ${(s.throttle * 100).toFixed(0)}%${s.boost ? ' 🔥' : ''}${s.orbitAssist ? ' ◎' : ''}`);

  // MODO DE VOO (three-states-v1): ORBIT (sistema planetário) / CRUISE
  // (interplanetário) / JOURNEY. Em CRUISE perto de um sistema planetário,
  // sugere o acoplamento (a borda NÃO desacelera sozinha).
  {
    let mtxt, mcol = '#8fd6ff';
    if (game.mode === 'orbit' && game.planetary) {
      mtxt = `◎ ÓRBITA — SISTEMA ${game.planetary.name.toUpperCase()}`;
    } else if (game.mode === 'journey') {
      mtxt = '⭒ JORNADA INTERESTELAR'; mcol = '#c9a2ff';
    } else {
      const near = s.pos ? nearestPlanetary(s.pos, 2.2) : null;
      if (near) {
        // aviso de aproximação RÁPIDA: a borda acopla e freia, mas quem chega
        // a milhares de u/s ainda atravessa boa parte do sistema no blend
        const body = near.system.body;
        const rvx = s.vel.x - (body.worldVel ? body.worldVel.x : 0);
        const rvy = s.vel.y - (body.worldVel ? body.worldVel.y : 0);
        const rvz = s.vel.z - (body.worldVel ? body.worldVel.z : 0);
        const relSp = Math.sqrt(rvx * rvx + rvy * rvy + rvz * rvz);
        const localCruise = Math.max(near.system.radius / 20, 120);
        const hot = relSp > localCruise * 4;
        mtxt = `✦ CRUISE · ${near.system.name} a ${fmt(near.edgeDist)} — ${hot ? '⚠ ALTA VELOCIDADE: desacelere [X] p/ acoplar' : 'desacelere p/ acoplar'}`;
        mcol = hot ? '#ff8a5c' : '#ffd27a';
      } else {
        mtxt = s.interstellar ? '✦ CRUISE — ESPAÇO INTERESTELAR' : '✦ CRUISE INTERPLANETÁRIA';
      }
    }
    set('mode', mtxt);
    const mel = el('mode');
    if (mel && mel._col !== mcol) { mel.style.color = mcol; mel._col = mcol; }
  }
  set('dominant', s.interstellar
    ? 'ESPAÇO INTERESTELAR'
    : s.dominant ? `${s.inOrbit ? '🛰 EM ÓRBITA de' : 'CAMPO:'} ${s.dominant.def.name}` : 'ESPAÇO PROFUNDO');
  set('altitude', s.dominant ? `ALT: ${fmt(s.altitude)}` : '');

  // Gravidade com cor escalando do calmo (lilás) ao crítico (vermelho).
  set('gravity', `G: ${s.gravMag.toFixed(1)} u/s²`);
  const gel = el('gravity');
  if (gel) {
    const gcol = s.gravMag > 800 ? '#ff5560' : s.gravMag > 200 ? '#ffaa44' : '#b8a0ff';
    if (gel._col !== gcol) { gel.style.color = gcol; gel._col = gcol; }
  }

  // Órbita: v_circ alvo + decomposição REAL tangencial/radial da velocidade —
  // é o instrumento que torna órbita pilotável ([O] circulariza sozinho).
  const oel = el('orbit');
  if (oel) {
    oel.textContent = (s.dominant && s.circVel > 1 && !s.interstellar)
      ? `v○ ${fmt(s.circVel)}/s · tang ${fmt(s.vTangential || 0)}/s · rad ${s.vRadial >= 0 ? '+' : ''}${fmt(s.vRadial || 0)}/s`
      : '';
  }

  // Análise de FUGA: % da velocidade de escape já atingida + estado + veredito.
  const eel = el('escape');
  if (eel) {
    if (s.dominant && s.escapeVel > 1) {
      const sp = s.speed;
      const pct = Math.min(999, Math.round((sp / s.escapeVel) * 100));
      let state, col;
      if (!s.canEscape) { state = '⛔ PRESO'; col = '#ff5560'; }
      else if (sp >= s.escapeVel) { state = '🚀 FUGA'; col = '#66ff88'; }
      else if (sp >= s.circVel * 0.82 && sp <= s.circVel * 1.25) { state = '🛰 ÓRBITA'; col = '#8fd6ff'; }
      else if (sp < s.circVel * 0.82) { state = '↓ QUEDA'; col = '#ffaa44'; }
      else { state = '↑ SUBINDO'; col = '#ffd24d'; }
      eel.textContent = `FUGA: ${fmt(s.escapeVel)}/s · ${pct}% ${state}`;
      eel.style.color = col;
    } else { eel.textContent = ''; }
  }

  // Brilho de reentrada (aquecimento do casco na atmosfera).
  const hg = el('heatGlow');
  if (hg) hg.style.opacity = Math.min(0.92, (s.heat || 0)).toFixed(2);

  set('hp', `CASCO: ${Math.max(0, s.hp | 0)}%`);
  // Recarga de nukes (campanha): mostra o timer quando a reserva não está cheia.
  const regen = s.nukes < 4 ? ` ⟳${Math.max(0, 20 - (s.nukeRegen || 0)) | 0}s` : '';
  const higgs = s.higgsCd > 0 ? `${Math.ceil(s.higgsCd)}s` : 'PRONTA';
  set('nukes', `☢ NUKES: ${s.nukes}${regen} · ✦[G] ∞ · Ħ[H] ${higgs}`);
  set('score', `SCORE: ${String(game.score).padStart(6, '0')}`);
  set('kills', `ABATES: ${game.kills}`);
  if (game.journey && game.journey.active) {
    const j = game.journey;
    const rem = Math.max(0, j.T - j.t);
    const bar = '▓'.repeat(Math.round(j.s * 10)).padEnd(10, '░');
    const fase = j.phase === 'coast' ? ' · CRUZEIRO v_max' : j.phase === 'decel' ? ' · FREANDO' : ' · ACELERANDO';
    set('mission', `⭒ QUEIMA → ${j.targetName} ${bar} ETA ${Math.floor(rem / 60)}:${String(Math.round(rem % 60)).padStart(2, '0')} · β ${j.beta.toFixed(2)}${fase}`);
  } else if (game.mission) set('mission', game.mission.label);
  else if (game.campaign && game.phase === 'flight') set('mission', 'CAMPANHA — aguarde a próxima missão…');

  const warn = el('warning');
  if (warn) {
    const domKind = s.dominant && s.dominant.def.kind;
    const domName = s.dominant && s.dominant.def.name;
    if (s.landed) { warn.textContent = '🚀 SEGURE [W] PARA DECOLAR'; warn.style.display = 'block'; warn.style.color = '#66ddff'; }
    else if (domKind === 'blackhole' && !s.canEscape) { warn.textContent = '🕳 HORIZONTE DE EVENTOS — FUJA OU MORRA!'; warn.style.display = 'block'; warn.style.color = '#c08aff'; }
    else if (domKind === 'neutron' && !s.canEscape) { warn.textContent = '⭐ GRAVIDADE DA ESTRELA DE NÊUTRONS — TURBO JÁ!'; warn.style.display = 'block'; warn.style.color = '#9fd0ff'; }
    else if (!s.canEscape) { warn.textContent = '⛔ NÃO DÁ PARA FUGIR — TURBO PRA LONGE!'; warn.style.display = 'block'; warn.style.color = '#ff5560'; }
    else if (s.tideWarn) { warn.textContent = '🫀 MARÉ EXTREMA — ESPAGUETIFICAÇÃO! Afaste-se do corpo compacto'; warn.style.display = 'block'; warn.style.color = '#ff8a5c'; }
    else if (s.diskDrag) { warn.textContent = '🌀 ARRASTO DO DISCO DE ACREÇÃO — órbita em DECAIMENTO (espiral da morte)'; warn.style.display = 'block'; warn.style.color = '#c9a2ff'; }
    else if (s.heat > 0.55) { warn.textContent = '🔥 REENTRADA CRÍTICA — CASCO QUEIMANDO!'; warn.style.display = 'block'; warn.style.color = '#ff7a30'; }
    else if (s.spawnGrace > 0) { warn.textContent = `🛡 ESCUDO ${Math.ceil(s.spawnGrace)}s`; warn.style.display = 'block'; warn.style.color = '#66ddff'; }
    else if (s.hp < 30) { warn.textContent = '⚠ CASCO CRÍTICO'; warn.style.display = 'block'; warn.style.color = '#ff5560'; }
    else if (s.heat > 0.18) { warn.textContent = '🔥 REENTRADA — desacelere'; warn.style.display = 'block'; warn.style.color = '#ffaa44'; }
    else if (s.inAtmosphere) { warn.textContent = `🌍 ATMOSFERA DE ${domName ? domName.toUpperCase() : ''}`; warn.style.display = 'block'; warn.style.color = '#ffcc44'; }
    else warn.style.display = 'none';
  }
}

function fmt(v) {
  const a = Math.abs(v);
  if (a > 1000) return `${(v / 1000).toFixed(1)}k u`;
  return `${v.toFixed(0)} u`;
}
// Só toca no DOM quando o texto MUDOU (setar textContent igual ainda custa recalc).
function set(id, txt) { const e = el(id); if (e && e._txt !== txt) { e.textContent = txt; e._txt = txt; } }

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
