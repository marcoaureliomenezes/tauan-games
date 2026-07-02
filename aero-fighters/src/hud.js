// hud.js — HUD na tela + overlay central. Diff-render para evitar reflow desnecessário.
// Exporta: updateHUD, showOverlay, hideOverlay, tickOverlayTimer, setSoundIcon.
// Para adicionar widget novo: adicione span no index.html + campo em _h + linha em updateHUD.

import { game } from './state.js';
import { getAirportForMap } from './airport.js';

const livesEl     = document.getElementById('lives');
const damageBarEl = document.getElementById('damage-bar');
const scoreEl     = document.getElementById('score');
const missilesEl = document.getElementById('missiles');
const heavyEl    = document.getElementById('heavy-missiles');
const nuclearEl  = document.getElementById('nuclear-missiles');
const altEl      = document.getElementById('altitude');
const targetsEl  = document.getElementById('targets');
const missionEl  = document.getElementById('mission');
const overlayEl  = document.getElementById('overlay');
const speedEl    = document.getElementById('speed');
const throttleEl = document.getElementById('throttle');
const stallEl    = document.getElementById('stall-warn');
const approachEl = document.getElementById('approach');
const bossHudEl  = document.getElementById('boss-hud');
const bossFillEl = document.getElementById('boss-bar-fill');

const _h = { lives:-1, hp:-1, score:-1, msls:-1, hvy:-1, nuk:-1, alt:-1, tgt:'', mis:-1, spd:-1, thr:-1, stall:null, guide:'', boss:-1 };

/** Atualiza HUD lendo de `game.player` e flags. Mudanças só renderizam o que mudou. */
export function updateHUD() {
  const liv = Math.max(0, game.player.lives);
  if (liv !== _h.lives) { livesEl.textContent = '♥'.repeat(liv) || '-'; _h.lives = liv; }
  const hp = game.player.hp ?? 3;
  if (hp !== _h.hp && damageBarEl) {
    damageBarEl.textContent = '■'.repeat(Math.max(0, hp)) + '□'.repeat(Math.max(0, 3 - hp));
    damageBarEl.style.color = hp >= 3 ? '#44ff88' : hp === 2 ? '#ffcc44' : '#ff4422';
    _h.hp = hp;
  }
  const sc = Math.max(0, Math.floor(game.score));
  if (sc !== _h.score) { scoreEl.textContent = 'SCORE: ' + String(sc).padStart(6, '0'); _h.score = sc; }
  if (game.player.missiles !== _h.msls) { missilesEl.textContent = 'MSLS: ' + game.player.missiles; _h.msls = game.player.missiles; }
  if (heavyEl && game.player.heavyMissiles !== _h.hvy) { heavyEl.textContent = 'HVY: ' + game.player.heavyMissiles; _h.hvy = game.player.heavyMissiles; }
  if (nuclearEl && game.player.nuclearMissiles !== _h.nuk) {
    _h.nuk = game.player.nuclearMissiles;
    nuclearEl.textContent = 'T NUK: ' + _h.nuk;
    nuclearEl.style.color = _h.nuk > 0 ? '#00ff44' : '#444444';
  }
  // Altímetro honesto (WS-3): metros reais, sem fator x10
  const alt = Math.max(0, Math.floor(game.player.y));
  if (alt !== _h.alt) { altEl.textContent = 'ALT: ' + alt + 'm'; _h.alt = alt; }
  const tgt = `ALVOS: ${game.targetsDestroyed}/${game.targetsTotal}`;
  if (tgt !== _h.tgt && targetsEl) { targetsEl.textContent = tgt; _h.tgt = tgt; }
  const sortie = game.missionRealism?.sortie?.state;
  const missionText = sortie === 'RETURN_TO_BASE' ? '↩ voltar à base' :
    sortie === 'SERVICE_SCENE' ? 'reabastecendo' :
    sortie === 'LANDING_ROLL' || sortie === 'TAXI_IN' ? 'taxi automático' :
    sortie === 'NEXT_SORTIE_READY' ? 'PRÓXIMA MISSÃO PRONTA' :
    sortie === 'TAXI_OUT' ? 'taxi' :
    'MISSÃO ' + game.cycle;
  if (missionText !== _h.mis && missionEl) {
    missionEl.textContent = missionText;
    // Tom calmo (não amarelo-alarme) para as fases de retorno/solo — menos chamativo.
    const calm = sortie === 'RETURN_TO_BASE' || sortie === 'SERVICE_SCENE' ||
      sortie === 'LANDING_ROLL' || sortie === 'TAXI_IN' || sortie === 'TAXI_OUT';
    missionEl.style.color = calm ? '#9fd8e8' : '';
    missionEl.style.fontWeight = calm ? 'normal' : '';
    _h.mis = missionText;
  }
  const spd = Math.round(game.player.speed);
  if (spd !== _h.spd) { speedEl.textContent = 'SPD: ' + spd; _h.spd = spd; }
  const thr = Math.round(game.player.throttle * 100);
  if (thr !== _h.thr) { throttleEl.textContent = 'THR: ' + thr + '%'; _h.thr = thr; }
  // Barra de vida do BOSS (visível só com o monstro vivo)
  if (bossHudEl) {
    const active = game.flags.bossActive === true && (game.flags.bossMaxHp || 0) > 0;
    const frac = active ? Math.max(0, Math.min(1, (game.flags.bossHp || 0) / game.flags.bossMaxHp)) : 0;
    const key = active ? Math.round(frac * 100) : -1;
    if (key !== _h.boss) {
      bossHudEl.style.display = active ? 'flex' : 'none';
      if (bossFillEl) bossFillEl.style.width = (frac * 100).toFixed(0) + '%';
      _h.boss = key;
    }
  }
  // Aviso de STALL só importa em voo alto. Perto do chão e nas fases de
  // decolagem/pouso/serviço a baixa velocidade é intencional — não poluir a tela
  // (era o "alerta piscante" que atrapalhava o pouso).
  const groundedPhase = sortie === 'TAXI_OUT' || sortie === 'TAKEOFF_ROLL' ||
    sortie === 'LANDING_ROLL' || sortie === 'TAXI_IN' || sortie === 'NEXT_SORTIE_READY' ||
    sortie === 'RETURN_TO_BASE' || sortie === 'SERVICE_SCENE';
  const showStall = game.player.stalled && !groundedPhase && game.player.y > 120;
  if (showStall !== _h.stall) { stallEl.style.display = showStall ? 'inline-block' : 'none'; _h.stall = showStall; }

  // Guia de aproximação (WS-4): visível em RETURN_TO_BASE — distância, alinhamento e rampa
  if (approachEl) {
    const showGuide = sortie === 'RETURN_TO_BASE' || sortie === 'LANDING_ROLL' || sortie === 'TAXI_IN' || sortie === 'NEXT_SORTIE_READY';
    let guide = '';
    if (showGuide) {
      const airport = getAirportForMap(game.activeMap);
      if (sortie === 'LANDING_ROLL' || sortie === 'TAXI_IN') {
        // Solo agora é automático — orientação calma, sem mandar virar.
        guide = '✈ taxi automático até o serviço';
      } else if (sortie === 'NEXT_SORTIE_READY') {
        guide = '✓ SERVIÇO COMPLETO | ESPAÇO PARA NOVA MISSÃO';
      } else {
        const r = airport.runway;
        const dx = game.player.x - r.center.x;
        const dz = game.player.pz - r.center.z;
        // Distância quantizada (passos de 25 m) para a linha não ficar piscando.
        const dist = Math.round(Math.hypot(dx, dz) / 25) * 25;
        const align = Math.abs(dx) <= r.width * 0.45 ? 'alinhado' : (dx > 0 ? '← esquerda' : 'direita →');
        guide = `▼ pista ${dist}m | ${align}`;
      }
    }
    if (guide !== _h.guide) {
      approachEl.textContent = guide;
      approachEl.style.display = guide ? 'inline-block' : 'none';
      _h.guide = guide;
    }
  }
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
