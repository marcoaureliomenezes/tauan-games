// missions.js — Objetivos: bombardear bases alienígenas em luas/planetas e limpar caças.
// As bases ficam "presas" à superfície do corpo e se movem com ele.

import * as THREE from '../../vendor/three.module.min.js';
import { scene } from './scene.js';
import { game } from './state.js';
import { showOverlay, hideOverlay, showToast } from './hud.js';
import { targetMission } from './nav.js';

const MISSIONS = [
  { label: 'MISSÃO 1 — Bombardeie a base alienígena na LUA (☢ nuke)', type: 'bomb', bodies: [{ key: 'moon', n: 1 }] },
  { label: 'MISSÃO 2 — Destrua 5 caças inimigos perto de MARTE', type: 'clear', kills: 5 },
  { label: 'MISSÃO 3 — Bombardeie 2 bases em MARTE (☢ nuke)', type: 'bomb', bodies: [{ key: 'mars', n: 2 }] },
  { label: 'MISSÃO 4 — Bombardeie a fortaleza alienígena em IO (Júpiter)', type: 'bomb', bodies: [{ key: 'io', n: 1 }] },
];

function findBody(key) {
  if (key === 'moon') return game.bodies.find((b) => b.isMoon && b.parent?.def.key === 'earth');
  if (key === 'io') return game.bodies.find((b) => b.def.name === 'Io');
  return game.bodies.find((b) => b.def.key === key);
}

function baseMesh() {
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
  g.scale.setScalar(48);          // base grande o bastante p/ ver na superfície do corpo
  return g;
}

function startMission(idx, blocking = false) {
  const def = MISSIONS[idx];
  if (!def) { win(); return; }
  game.missionIndex = idx;
  const targets = [];
  if (def.type === 'bomb') {
    for (const spec of def.bodies) {
      const body = findBody(spec.key);
      if (!body) continue;
      for (let i = 0; i < spec.n; i++) {
        const obj = baseMesh();
        const dir = new THREE.Vector3((Math.random() - 0.5), (Math.random() - 0.5), (Math.random() - 0.5)).normalize();
        scene.add(obj);
        targets.push({ obj, body, dir, destroyed: false });
      }
    }
  }
  game.mission = { ...def, targets, baseKills: game.kills };
  if (def.type === 'bomb') targetMission();    // o nav aponta direto para o objetivo
  if (blocking) showOverlay(`<div style="color:#7df">${def.label}</div><div class="sub">Aponte ao alvo com <b>T</b>, mire com <b>C</b>, acelere com <b>W</b><br><br>[Enter] para decolar</div>`);
  else showToast(`<div style="color:#7df">${def.label}</div>`, 5000);
}

export function startMissions() { startMission(0, true); }

export function beginFlight() { hideOverlay(); }

export function updateMissions() {
  const m = game.mission;
  if (!m) return;
  // mantém bases presas à superfície
  for (const t of m.targets) {
    if (t.destroyed) continue;
    const up = t.dir;
    t.obj.position.copy(t.body.worldPos).addScaledVector(up, t.body.def.radius);
    t.obj.up.copy(up); t.obj.lookAt(t.body.worldPos);
  }
  // completion
  let done = false;
  if (m.type === 'bomb') done = m.targets.length > 0 && m.targets.every((t) => t.destroyed);
  else if (m.type === 'clear') done = (game.kills - m.baseKills) >= m.kills;

  if (done && !m._done) {
    m._done = true;
    game.score += 1000;
    const next = game.missionIndex + 1;
    if (next >= MISSIONS.length) { win(); return; }
    showToast(`<div style="color:#6f6">✔ MISSÃO CUMPRIDA! +1000</div>`, 3000);
    setTimeout(() => startMission(next, false), 3000);
  }
}

function win() {
  game.phase = 'win';
  showOverlay(`<div style="color:#6cf">🌌 SISTEMA SOLAR LIBERTADO!</div><div class="sub">Score final: ${game.score}<br>Abates: ${game.kills}<br><br>[Enter] para reiniciar</div>`);
}
