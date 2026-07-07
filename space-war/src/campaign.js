// campaign.js — A CAMPANHA em 5 fases do Space War (release space-war-campaign-v1).
//
// Fases ordenadas sobre os sistemas: Solar → Betelgeuse → Binário BN+Pulsar →
// Binário Caótico → Núcleo da Galáxia. Cada fase é DADOS (missões bomb|clear|visit);
// completar a fase desbloqueia a próxima e faz o spawn dos inimigos dela (D-2:
// viajar é livre — o que é bloqueado é missão/progresso). O sistema Véu fica fora
// da campanha (exploração livre). missions.js é o executor da missão ativa.

import { game } from './state.js';
import { showOverlay, showToast } from './hud.js';

// Cada fase é uma CAÇADA sequencial (operador 2026-07-03): `hunt` alvos — bases em
// LUAS/planetas DIFERENTES ou NAVES CAPITAIS orbitando corpos — spawnam UM DE CADA
// VEZ (destruiu → o próximo aparece em outro corpo). Contagem +2 por fase:
// 5 → 7 → 9 → 11 → 13. Missões `visit` continuam depois da caçada.
export const PHASES = [
  {
    key: 'solar', sys: 'solar', name: 'FASE 1 — SISTEMA SOLAR', color: '#7df',
    brief: 'Cace as 5 instalações da invasão — cada uma numa lua diferente — e colha dados do Halley.',
    hunt: 5,
    missions: [
      { label: 'FASE 1·FINAL — Colha dados do cometa HALLEY (aproxime-se a 2.5k u)', type: 'visit', key: 'halley', dist: 2500 },
    ],
  },
  {
    key: 'betelgeuse', sys: 'betelgeuse', name: 'FASE 2 — BETELGEUSE', color: '#ffb080',
    brief: 'Cace os 7 postos da frota nos planetas carbonizados e sonde a companheira Siwarha.',
    hunt: 7,
    missions: [
      { label: 'FASE 2·FINAL — Sonde SIWARHA dentro do envelope de poeira (14k u)', type: 'visit', key: 'siwarha', dist: 14000 },
    ],
  },
  {
    key: 'binary', sys: 'binary', name: 'FASE 3 — BINÁRIO BN+PULSAR', color: '#cfe0ff',
    brief: 'Sem superfícies aqui: cace as 9 NAVES CAPITAIS orbitando o buraco negro e o pulsar.',
    hunt: 9,
    missions: [
      { label: 'FASE 3·FINAL — Roce o PULSAR — chegue a 30k u e sobreviva', type: 'visit', key: 'neutron', dist: 30000 },
    ],
  },
  {
    key: 'chaotic', sys: 'chaotic', name: 'FASE 4 — BINÁRIO CAÓTICO', color: '#bcd2ff',
    brief: 'Cace os 11 alvos escondidos entre os planetas do caos de 3 corpos.',
    hunt: 11,
    missions: [],
  },
  {
    key: 'core', sys: 'core', name: 'FASE 5 — NÚCLEO DA GALÁXIA', color: '#ffd27a',
    brief: 'A frota final: 13 alvos entre os errantes e as estrelas S de Sagitário A✦.',
    hunt: 13,
    missions: [
      { label: 'FASE 5·FINAL — Roce o anel de fótons de SGR A✦ (22k u) e sobreviva', type: 'visit', key: 'sgr', dist: 22000 },
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
  game.screen = 'win';
  showOverlay(`<div style="color:#ffd27a">🌌 GALÁXIA LIBERTADA!</div>
    <div class="sub">As 5 fases da campanha foram vencidas — do Sistema Solar a Sagitário A✦.<br>
    Score final: ${game.score} · Abates: ${game.kills}<br><br>[Enter] para reiniciar</div>`);
}
