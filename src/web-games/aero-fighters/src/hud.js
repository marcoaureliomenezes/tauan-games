// hud.js — HUD na tela + overlay central. Diff-render para evitar reflow desnecessário.
// Exporta: updateHUD, showOverlay, hideOverlay, tickOverlayTimer, setSoundIcon.
// Para adicionar widget novo: adicione span no index.html + campo em _h + linha em updateHUD.

import { game } from './state.js';
import { getAirportForMap } from './airport.js';
import { ACT_TITLES } from './campaign.js';

const livesEl     = document.getElementById('lives');
const damageBarEl = document.getElementById('damage-bar');
const scoreEl     = document.getElementById('score');
const missilesEl = document.getElementById('missiles');
const heavyEl    = document.getElementById('heavy-missiles');
const nuclearEl  = document.getElementById('nuclear-missiles');
const rodEl      = document.getElementById('rod-missiles');
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
// T-D-03 (inhauma-defense-v1): bloco do modo defesa — fora dele fica display:none
// e o HUD de voo segue intacto.
const flightHudEl  = document.getElementById('flight-hud');
const defenseHudEl = document.getElementById('defense-hud');
const defScoreEl   = document.getElementById('def-score');
const defCityEl    = document.getElementById('def-city');
const defHeatEl    = document.getElementById('def-heat');
const defMissilesEl = document.getElementById('def-missiles');
const defWeaponEl  = document.getElementById('def-weapon');
const defAlertEl   = document.getElementById('def-alert');
// WEAPONS-V1: linha do arsenal (cooldown por tier + nukes) e aviso da horda
const defArsenalEl = document.getElementById('def-arsenal');
const defHordeEl   = document.getElementById('def-horde');

// T-D-05: quadrado de lock — criado dinamicamente (index.html intocado)
let defLockEl = null;
function ensureDefLockEl() {
  if (!defLockEl && defenseHudEl) {
    defLockEl = document.createElement('div');
    defLockEl.id = 'def-lock';
    defLockEl.style.cssText = 'position:fixed;display:none;pointer-events:none;' +
      'border:2px solid #ffe08a;box-shadow:0 0 6px rgba(0,0,0,0.6);';
    defenseHudEl.appendChild(defLockEl);
  }
  return defLockEl;
}

// T-D-09: linha de abates + regime do diretor — criada dinamicamente logo
// abaixo do SCORE (mesmo padrão do quadrado de lock: index.html intocado).
let defKillsEl = null;
function ensureDefKillsEl() {
  if (!defKillsEl && defScoreEl?.parentNode) {
    defKillsEl = document.createElement('span');
    defKillsEl.id = 'def-kills';
    defKillsEl.style.color = '#ffb27d';
    defScoreEl.parentNode.insertBefore(defKillsEl, defScoreEl.nextSibling);
  }
  return defKillsEl;
}

const _h = { lives:-1, hp:-1, score:-1, msls:-1, hvy:-1, nuk:-1, rod:-1, alt:-1, tgt:'', mis:-1, spd:-1, thr:-1, stall:null, guide:'', boss:-1,
  defense:null, defScore:-1, defCity:-1, defHeat:'', defMsls:'', defWeapon:'', defAlert:null, defLock:'', defKills:'',
  defArsenal:'', defHorde:'' };

/** Atualiza HUD lendo de `game.player` e flags. Mudanças só renderizam o que mudou. */
export function updateHUD() {
  // T-D-03: modo defesa troca o HUD de voo pelo bloco da bateria (diff-render).
  const def = game.activeMap === 'inhauma-defense';
  if (def !== _h.defense) {
    if (flightHudEl) flightHudEl.style.display = def ? 'none' : 'contents';
    if (defenseHudEl) defenseHudEl.style.display = def ? 'block' : 'none';
    _h.defense = def;
  }
  if (def && game.defense) {
    const d = game.defense;
    const dScore = Math.max(0, Math.floor(d.score));
    if (dScore !== _h.defScore && defScoreEl) {
      defScoreEl.textContent = 'SCORE: ' + String(dScore).padStart(6, '0');
      _h.defScore = dScore;
    }
    const dCity = Math.max(0, Math.round(d.cityIntegrity));
    if (dCity !== _h.defCity && defCityEl) {
      defCityEl.textContent = 'INHAÚMA: ' + dCity + '%';
      defCityEl.style.color = dCity > 60 ? '#7dd7ff' : dCity > 30 ? '#ffcc44' : '#ff5544';
      _h.defCity = dCity;
    }
    // T-D-09: abates + regime do diretor (esquadrilha ×n / intervalo de spawn)
    const dKills = (d.kills | 0) + ':' + (d.squadSize | 0) + ':' + (d.alive | 0);
    if (dKills !== _h.defKills) {
      const el = ensureDefKillsEl();
      if (el) {
        el.textContent = 'ABATES: ' + (d.kills | 0) +
          ' · SQD×' + (d.squadSize | 0) + ' · ' + (d.alive | 0) + ' NO AR';
      }
      _h.defKills = dKills;
    }
    // Barra de calor da .50 em 8 degraus (T-D-04: trava OVERHEAT aos 100%)
    const heatFrac = Math.max(0, Math.min(1, d.heat || 0));
    const dHeat = '█'.repeat(Math.round(heatFrac * 8)).padEnd(8, '░') + (d.overheat ? ' ⚠OVERHEAT' : '');
    if (dHeat !== _h.defHeat && defHeatEl) {
      defHeatEl.textContent = 'HEAT: ' + dHeat;
      defHeatEl.style.color = d.overheat || heatFrac > 0.85 ? '#ff5544' : '#ffab5e';
      _h.defHeat = dHeat;
    }
    // T-D-05: estoque de mísseis AA + indicador de recarga lenta.
    // Upgrade (operador 2026-07-19): estoque ∞ → mostra '∞' (Infinity|0 seria 0).
    const dMsls = (d.missiles === Infinity ? '∞' : (d.missiles | 0)) + (d.aaRechargeFrac > 0 ? 'r' : '');
    if (dMsls !== _h.defMsls && defMissilesEl) {
      defMissilesEl.textContent = 'AA: ' + (d.missiles === Infinity ? '∞' : (d.missiles | 0)) + (d.aaRechargeFrac > 0 ? ' ↻' : '');
      defMissilesEl.style.color = (d.missiles | 0) > 0 ? '#9dff9d' : '#ffcc44';
      _h.defMsls = dMsls;
    }
    // WEAPONS-V1: slot ativo vindo do modo (mg/.50 · X · B · T · R)
    const dWeapon = 'ARMA: ' + (d.weaponLabel ?? (d.turret?.weapon === 'aa' ? 'MÍSSIL AA' : '.50'));
    if (dWeapon !== _h.defWeapon && defWeaponEl) {
      defWeaponEl.textContent = dWeapon;
      _h.defWeapon = dWeapon;
    }
    // WEAPONS-V1: arsenal — cooldown por tier (● pronto / s restantes) + nukes
    const cd = (s) => (s > 0.05 ? s.toFixed(1) + 's' : '●');
    const dArsenal = `${cd(d.cdX)}|${cd(d.cdB)}|${d.nukes ?? 0}|${cd(d.cdRod)}`;
    if (dArsenal !== _h.defArsenal && defArsenalEl) {
      defArsenalEl.textContent = `X ${cd(d.cdX)} · B ${cd(d.cdB)} · T ×${d.nukes ?? 0} · R ${cd(d.cdRod)}`;
      _h.defArsenal = dArsenal;
    }
    // WEAPONS-V1 (T-W-05): aviso da horda + contagem da janela (pisca como o alert)
    const eta = d.hordeEta;
    const hordeSig = eta == null
      ? 'off'
      : `${Math.ceil(eta)}:${Math.floor(performance.now() / 320) % 2 === 0 ? 'on' : 'dim'}`;
    if (hordeSig !== _h.defHorde && defHordeEl) {
      defHordeEl.style.display = hordeSig === 'off' ? 'none' : 'inline-block';
      if (hordeSig !== 'off') {
        defHordeEl.textContent = `⚠ HORDA NO HORIZONTE — ${Math.ceil(eta)}s`;
        defHordeEl.style.opacity = hordeSig.endsWith('dim') ? '0.35' : '1';
      }
      _h.defHorde = hordeSig;
    }
    // T-D-07: telegraph do míssil anti-jogador — o marcador PISCA enquanto
    // houver míssil inbound (assinatura inclui a fase do blink → diff-render).
    const dAlert = d.alert === true;
    const alertSig = dAlert
      ? (Math.floor(performance.now() / 280) % 2 === 0 ? 'on' : 'dim')
      : 'off';
    if (alertSig !== _h.defAlert && defAlertEl) {
      defAlertEl.style.display = alertSig === 'off' ? 'none' : 'inline-block';
      defAlertEl.style.opacity = alertSig === 'dim' ? '0.25' : '1';
      _h.defAlert = alertSig;
    }
    // T-D-05: quadrado de lock fechando sobre o alvo (46→20 px; vermelho travado)
    const lkVis = d.lockVisible === true;
    const lkSig = lkVis
      ? `${Math.round(d.lockX)}:${Math.round(d.lockY)}:${d.locked ? 1 : 0}:${Math.round((d.lockFrac || 0) * 20)}`
      : '';
    if (lkSig !== _h.defLock) {
      const el = ensureDefLockEl();
      if (el) {
        el.style.display = lkVis ? 'block' : 'none';
        if (lkVis) {
          const size = Math.round(46 - (d.lockFrac || 0) * 26);
          el.style.width = size + 'px';
          el.style.height = size + 'px';
          el.style.left = (d.lockX - size / 2) + 'px';
          el.style.top = (d.lockY - size / 2) + 'px';
          el.style.borderColor = d.locked ? '#ff5544' : '#ffe08a';
        }
      }
      _h.defLock = lkSig;
    }
  } else if (_h.defLock !== '') {
    // saiu do modo defesa: esconde o quadrado de lock e o aviso da horda
    if (defLockEl) defLockEl.style.display = 'none';
    if (defHordeEl) defHordeEl.style.display = 'none';
    _h.defLock = '';
    _h.defHorde = '';
  }
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
  // 2026-08-11: armas por COOLDOWN — o HUD mostra recarga, não contagem.
  // Pronta = "✓"; recarregando = segundos restantes (0.1 s de resolução nas
  // táticas, 1 s na nuclear). Cache _h evita escrita de DOM por frame.
  const cd = game.player.weaponCooldowns || { light: 0, heavy: 0, rod: 0, nuclear: 0 };
  const fmtCd = (s, coarse) => (s <= 0 ? '✓' : coarse ? Math.ceil(s) + 's' : (Math.ceil(s * 10) / 10).toFixed(1) + 's');
  const mslTxt = fmtCd(cd.light, false);
  if (_h.msls !== mslTxt) {
    _h.msls = mslTxt;
    missilesEl.textContent = 'X MSL: ' + mslTxt;
    missilesEl.style.color = cd.light <= 0 ? '#9dff9d' : '#888888';
  }
  const hvyTxt = fmtCd(cd.heavy, false);
  if (heavyEl && _h.hvy !== hvyTxt) {
    _h.hvy = hvyTxt;
    heavyEl.textContent = 'B HVY: ' + hvyTxt;
    heavyEl.style.color = cd.heavy <= 0 ? '#9dff9d' : '#888888';
  }
  const nukTxt = fmtCd(cd.nuclear, true);
  if (nuclearEl && _h.nuk !== nukTxt) {
    _h.nuk = nukTxt;
    nuclearEl.textContent = 'T NUK: ' + nukTxt;
    nuclearEl.style.color = cd.nuclear <= 0 ? '#00ff44' : '#666666';
  }
  const rodTxt = fmtCd(cd.rod, false);
  if (rodEl && _h.rod !== rodTxt) {
    _h.rod = rodTxt;
    rodEl.textContent = 'R ROD: ' + rodTxt;
    rodEl.style.color = cd.rod <= 0 ? '#dddddd' : '#666666';
  }
  // Altímetro honesto (WS-3): metros reais, sem fator x10
  const alt = Math.max(0, Math.floor(game.player.y));
  if (alt !== _h.alt) { altEl.textContent = 'ALT: ' + alt + 'm'; _h.alt = alt; }
  // T-C-06/T-C-07: em Inhaúma o contador de wave ("ALVOS n/m") é substituído pela
  // linha de objetivo do ATO (a campanha espelha os contadores em targetsTotal/
  // targetsDestroyed — a linha lê game.campaign direto para o título do ato).
  const c = game.activeMap === 'inhauma' ? game.campaign : null;
  const tgt = c
    ? (c.victory ? 'CACHOEIRA LIBERTADA — VITÓRIA'
      : `ATO ${c.act} — ${ACT_TITLES[c.act]}: ${c.actTargetsDestroyed}/${c.actTargetsTotal}`)
    : `ALVOS: ${game.targetsDestroyed}/${game.targetsTotal}`;
  if (tgt !== _h.tgt && targetsEl) { targetsEl.textContent = tgt; _h.tgt = tgt; }
  const sortie = game.missionRealism?.sortie?.state;
  const missionText = sortie === 'RETURN_TO_BASE' ? '↩ voltar à base' :
    sortie === 'SERVICE_SCENE' ? 'reabastecendo' :
    sortie === 'LANDING_ROLL' || sortie === 'TAXI_IN' ? 'taxi automático' :
    sortie === 'NEXT_SORTIE_READY' ? 'PRÓXIMA MISSÃO PRONTA' :
    sortie === 'TAXI_OUT' ? 'taxi' :
    c ? `ATO ${c.act}` : // T-C-07: sem "MISSÃO N" em Inhaúma
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
