// campaign.js — A CAMPANHA em 5 fases do Space War (release space-war-campaign-v1).
//
// Fases ordenadas sobre os sistemas: Solar → Betelgeuse → Binário BN+Pulsar →
// Binário Caótico → Núcleo da Galáxia. Cada fase é DADOS (missões bomb|clear|visit);
// completar a fase desbloqueia a próxima e faz o spawn dos inimigos dela (D-2:
// viajar é livre — o que é bloqueado é missão/progresso). O sistema Véu fica fora
// da campanha (exploração livre). missions.js é o executor da missão ativa.

import { game } from './state.js';
import { showOverlay, showToast } from './hud.js';

export const PHASES = [
  {
    key: 'solar', sys: 'solar', name: 'FASE 1 — SISTEMA SOLAR', color: '#7df',
    brief: 'Liberte o Sistema Solar: Lua, Marte, Io — e colha dados do cometa Halley.',
    missions: [
      { label: 'MISSÃO 1 — Bombardeie a base alienígena na LUA (☢ nuke)', type: 'bomb', bodies: [{ key: 'moon', n: 1 }] },
      { label: 'MISSÃO 2 — Destrua 5 caças inimigos perto de MARTE', type: 'clear', kills: 5 },
      { label: 'MISSÃO 3 — Bombardeie 2 bases em MARTE (☢ nuke)', type: 'bomb', bodies: [{ key: 'mars', n: 2 }] },
      { label: 'MISSÃO 4 — Bombardeie a fortaleza alienígena em IO (Júpiter)', type: 'bomb', bodies: [{ key: 'io', n: 1 }] },
      { label: 'MISSÃO 5 — Colha dados do cometa HALLEY (aproxime-se a 2.5k u)', type: 'visit', key: 'halley', dist: 2500 },
    ],
  },
  {
    key: 'betelgeuse', sys: 'betelgeuse', name: 'FASE 2 — BETELGEUSE', color: '#ffb080',
    brief: 'A supergigante morre. Expulse a frota dos planetas carbonizados e sonde a companheira Siwarha.',
    missions: [
      { label: 'FASE 2·M1 — Destrua 6 caças na órbita de BRASA', type: 'clear', kills: 6 },
      { label: 'FASE 2·M2 — Bombardeie 2 bases em FULIGEM (☢ nuke)', type: 'bomb', bodies: [{ key: 'fuligem', n: 2 }] },
      { label: 'FASE 2·M3 — Sonde SIWARHA dentro do envelope de poeira (14k u)', type: 'visit', key: 'siwarha', dist: 14000 },
    ],
  },
  {
    key: 'binary', sys: 'binary', name: 'FASE 3 — BINÁRIO BN+PULSAR', color: '#cfe0ff',
    brief: 'Dentro do remanescente de supernova: destrua as estações e roce o farol do pulsar.',
    missions: [
      { label: 'FASE 3·M1 — Destrua 6 hostis guardando o remanescente', type: 'clear', kills: 6 },
      { label: 'FASE 3·M2 — Roce o PULSAR — chegue a 30k u e sobreviva', type: 'visit', key: 'neutron', dist: 30000 },
    ],
  },
  {
    key: 'chaotic', sys: 'chaotic', name: 'FASE 4 — BINÁRIO CAÓTICO', color: '#bcd2ff',
    brief: 'Duas estrelas, planetas em caos de 3 corpos — e a frota escondida entre eles.',
    missions: [
      { label: 'FASE 4·M1 — Bombardeie as bases em VAGANTE-II e VAGANTE-IV (☢)', type: 'bomb', bodies: [{ key: 'vag2', n: 1 }, { key: 'vag4', n: 1 }] },
      { label: 'FASE 4·M2 — Destrua 6 caças no enxame caótico', type: 'clear', kills: 6 },
    ],
  },
  {
    key: 'core', sys: 'core', name: 'FASE 5 — NÚCLEO DA GALÁXIA', color: '#ffd27a',
    brief: 'Sagitário A✦. A fortaleza final orbita as estrelas S do buraco negro supermassivo.',
    missions: [
      { label: 'FASE 5·M1 — Roce o anel de fótons de SGR A✦ (22k u) e sobreviva', type: 'visit', key: 'sgr', dist: 22000 },
      { label: 'FASE 5·M2 — Destrua a fortaleza na órbita da Estrela S6 (7 abates)', type: 'clear', kills: 7 },
      { label: 'FASE 5·M3 — Bombardeie as 3 bases nos planetas ERRANTES (☢)', type: 'bomb', bodies: [{ key: 'err1', n: 1 }, { key: 'err2', n: 1 }, { key: 'err3', n: 1 }] },
    ],
  },
];

export function initCampaignState() {
  game.campaign = {
    phase: 0,
    unlocked: PHASES.map((_, i) => i === 0),
    done: PHASES.map(() => false),
  };
}

export function currentPhase() { return PHASES[game.campaign?.phase ?? 0]; }

// Fase concluída: marca, desbloqueia a próxima e devolve o que o executor precisa.
export function advancePhase() {
  const c = game.campaign;
  c.done[c.phase] = true;
  const next = c.phase + 1;
  if (next >= PHASES.length) return { final: true };
  c.unlocked[next] = true;
  c.phase = next;
  const ph = PHASES[next];
  showToast(`<div style="color:${ph.color}">🔓 ${ph.name} DESBLOQUEADA</div><div class="sub">${ph.brief}</div>`, 7000);
  return { final: false, phase: ph };
}

export function phaseStatus(sysKey) {
  // Estado de campanha de um sistema p/ o mapa: 'done' | 'active' | 'locked' | null (fora da campanha)
  const i = PHASES.findIndex((p) => p.sys === sysKey);
  if (i < 0) return null;
  const c = game.campaign;
  if (!c) return null;
  if (c.done[i]) return 'done';
  if (i === c.phase) return 'active';
  return c.unlocked[i] ? 'active' : 'locked';
}

export function winFinal() {
  game.phase = 'win';
  showOverlay(`<div style="color:#ffd27a">🌌 GALÁXIA LIBERTADA!</div>
    <div class="sub">As 5 fases da campanha foram vencidas — do Sistema Solar a Sagitário A✦.<br>
    Score final: ${game.score} · Abates: ${game.kills}<br><br>[Enter] para reiniciar</div>`);
}
