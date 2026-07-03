// missions.js — EXECUTOR da campanha: materializa a missão ativa da fase corrente
// (bases bomb presas à superfície, contadores clear, aproximações visit) e avança
// fase→fase via campaign.js. As bases se movem com o corpo hospedeiro.

import * as THREE from '../../vendor/three.module.min.js';
import { scene } from './scene.js';
import { game } from './state.js';
import { showOverlay, hideOverlay, showToast } from './hud.js';
import { targetMission, targetBody } from './nav.js';
import { PHASES, initCampaignState, currentPhase, advancePhase, winFinal } from './campaign.js';
import { spawnPhase } from './enemies.js';

function findBody(key) {
  if (key === 'moon') return game.bodies.find((b) => b.isMoon && b.parent?.def.key === 'earth');
  if (key === 'io') return game.bodies.find((b) => b.def.name === 'Io');
  return game.bodies.find((b) => b.def.key === key);
}

// Instalação de superfície: cúpula + torres, escala ∝ raio do corpo.
// INVARIANTE AC-08: pegada ≤3% da ÁREA de superfície do corpo. Raio da pegada
// ≈ 5.8·scale (torres a 5 + cone r0.5, com margem); área π·rf² vs 4πR².
export function baseFootprintFraction(bodyRadius) {
  const s = baseScale(bodyRadius);
  const rf = 5.8 * s;
  return (rf * rf) / (4 * bodyRadius * bodyRadius);
}
function baseScale(bodyRadius) {
  const s = Math.max(14, Math.min(70, bodyRadius * 0.028));
  // Teto AC-08: rf=5.8·s deve caber em ≤3% da área ⇒ s ≤ ~0.058·R. Em corpos
  // pequenos (errantes do núcleo, R~90) o PISO de legibilidade (14) estouraria o
  // teto — o invariante vence o piso.
  return Math.min(s, bodyRadius * 0.058);
}
function baseMesh(bodyRadius) {
  const g = new THREE.Group();
  const dome = new THREE.Mesh(new THREE.SphereGeometry(4, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2),
    new THREE.MeshStandardMaterial({ color: 0x224422, emissive: 0x33ff66, emissiveIntensity: 0.6, metalness: 0.5, roughness: 0.4 }));
  g.add(dome);
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2;
    const t = new THREE.Mesh(new THREE.ConeGeometry(0.5, 6, 6),
      new THREE.MeshStandardMaterial({ color: 0x335533, emissive: 0x22ff44, emissiveIntensity: 0.5 }));
    t.position.set(Math.cos(a) * 5, 2, Math.sin(a) * 5); g.add(t);
  }
  const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.8, 8, 8), new THREE.MeshBasicMaterial({ color: 0x66ff88 }));
  beacon.position.y = 5; g.add(beacon);
  g.scale.setScalar(baseScale(bodyRadius));
  return g;
}

function startMission(midx, blocking = false) {
  const ph = currentPhase();
  const def = ph.missions[midx];
  if (!def) { completePhase(); return; }
  game.missionIndex = midx;
  const targets = [];
  if (def.type === 'bomb') {
    for (const spec of def.bodies) {
      const body = findBody(spec.key);
      if (!body) continue;
      for (let i = 0; i < spec.n; i++) {
        const obj = baseMesh(body.def.radius);
        const dir = new THREE.Vector3((Math.random() - 0.5), (Math.random() - 0.5), (Math.random() - 0.5)).normalize();
        scene.add(obj);
        targets.push({ obj, body, dir, destroyed: false });
      }
    }
  }
  game.mission = { ...def, phaseKey: ph.key, targets, baseKills: game.kills };
  if (def.type === 'bomb') targetMission();          // nav aponta direto o objetivo
  if (def.type === 'visit') {
    const b = findBody(def.key);
    if (b) targetBody(b);                            // nav aponta o corpo da coleta
  }
  if (blocking) showOverlay(`<div style="color:${ph.color}">${def.label}</div><div class="sub">Aponte ao alvo com <b>T</b>, mire com <b>C</b>, acelere com <b>W</b><br><br>[Enter] para decolar</div>`);
  else showToast(`<div style="color:${ph.color}">${def.label}</div>`, 5000);
}

export function startMissions() {
  initCampaignState();
  spawnPhase(PHASES[0].key);
  startMission(0, true);
}

export function beginFlight() { hideOverlay(); }

// QA/debug: força a conclusão da missão ativa (usado por __swDebug.winMission e
// pelo teste de gating da campanha — não é atalho de gameplay).
export function debugCompleteMission() {
  const m = game.mission;
  if (!m) return false;
  if (m.type === 'bomb') {
    for (const t of m.targets) {
      if (!t.destroyed) { t.destroyed = true; if (t.obj.parent) t.obj.parent.remove(t.obj); }
    }
  } else if (m.type === 'clear') game.kills = m.baseKills + m.kills;
  else if (m.type === 'visit') m._forceDone = true;
  return true;
}

function completePhase() {
  const res = advancePhase();
  if (res.final) { winFinal(); game.mission = null; return; }
  spawnPhase(res.phase.key);
  setTimeout(() => startMission(0, false), 1200);
  game.mission = null;
}

export function updateMissions() {
  const m = game.mission;
  if (!m) return;
  // mantém bases presas à superfície (corpos giram/orbitam — a base acompanha)
  for (const t of m.targets || []) {
    if (t.destroyed) continue;
    const up = t.dir;
    t.obj.position.copy(t.body.worldPos).addScaledVector(up, t.body.def.radius);
    t.obj.up.copy(up); t.obj.lookAt(t.body.worldPos);
  }
  // completion por tipo
  let done = false;
  if (m.type === 'bomb') done = m.targets.length > 0 && m.targets.every((t) => t.destroyed);
  else if (m.type === 'clear') done = (game.kills - m.baseKills) >= m.kills;
  else if (m.type === 'visit') {
    const b = findBody(m.key);
    done = m._forceDone || (b && game.ship.pos && !game.ship.landed
      && game.ship.pos.distanceTo(b.worldPos) < m.dist + b.def.radius);
  }

  if (done && !m._done) {
    m._done = true;
    game.score += 1000;
    const ph = currentPhase();
    const next = game.missionIndex + 1;
    if (next >= ph.missions.length) {
      showToast(`<div style="color:#6f6">✔ ${ph.name} CONCLUÍDA! +1000</div>`, 4000);
      setTimeout(() => completePhase(), 2500);
      return;
    }
    showToast(`<div style="color:#6f6">✔ MISSÃO CUMPRIDA! +1000</div>`, 3000);
    setTimeout(() => startMission(next, false), 3000);
  }
}
