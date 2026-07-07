// missions.js — EXECUTOR da campanha: CAÇADA sequencial de alvos (bases de
// superfície v2 legíveis ou NAVES CAPITAIS orbitando corpos), um alvo de cada vez —
// destruiu → o próximo aparece em OUTRO corpo (operador 2026-07-03) — mais as
// missões `visit`. Bases ficam presas à superfície; naves capitais orbitam devagar.

import * as THREE from '../../vendor/three.module.min.js';
import { scene } from './scene.js';
import { game } from './state.js';
import { SYSTEMS } from './config.js';
import { showOverlay, hideOverlay, showToast } from './hud.js';
import { targetMission, targetBody, targetSystem } from './nav.js';
import { PHASES, initCampaignState, currentPhase, advancePhase, winFinal } from './campaign.js';
import { spawnPhase, spawnEscort } from './enemies.js';

function findBody(key) {
  if (key === 'moon') return game.bodies.find((b) => b.isMoon && b.parent?.def.key === 'earth');
  return game.bodies.find((b) => b.def.key === key) || game.bodies.find((b) => b.def.name.toLowerCase() === String(key).toLowerCase());
}

// ── Instalação de superfície v2 (LEGÍVEL — pedido do operador): plataforma +
// cúpula de comando com faixa de janelas + módulos habitat + antena com farol +
// postes de perímetro + pad de pouso. INVARIANTE AC-08: pegada (raio ≈ 8·scale,
// a plataforma) ≤ 3% da área ⇒ scale ≤ ~0.042·R.
export function baseFootprintFraction(bodyRadius) {
  const s = baseScale(bodyRadius);
  const rf = 8 * s;
  return (rf * rf) / (4 * bodyRadius * bodyRadius);
}
function baseScale(bodyRadius) {
  const s = Math.max(14, Math.min(70, bodyRadius * 0.028));
  return Math.min(s, bodyRadius * 0.042);
}
function baseMesh(bodyRadius) {
  const g = new THREE.Group();
  const metal = new THREE.MeshStandardMaterial({ color: 0x3a4148, metalness: 0.7, roughness: 0.45 });
  // plataforma
  const plat = new THREE.Mesh(new THREE.CylinderGeometry(8, 8.6, 0.7, 18), metal);
  plat.position.y = 0.35; g.add(plat);
  // cúpula de comando + faixa de janelas emissivas
  const dome = new THREE.Mesh(new THREE.SphereGeometry(3.1, 18, 12, 0, Math.PI * 2, 0, Math.PI / 2),
    new THREE.MeshStandardMaterial({ color: 0x4a5560, metalness: 0.5, roughness: 0.35 }));
  dome.position.y = 0.7; g.add(dome);
  const win = new THREE.Mesh(new THREE.TorusGeometry(2.6, 0.22, 6, 24),
    new THREE.MeshBasicMaterial({ color: 0x9fe8ff }));
  win.rotation.x = Math.PI / 2; win.position.y = 2.0; g.add(win);
  // módulos habitat (cilindros deitados, radiais)
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + 0.5;
    const hab = new THREE.Mesh(new THREE.CapsuleGeometry(1.0, 3.2, 4, 8),
      new THREE.MeshStandardMaterial({ color: 0x5c6a75, metalness: 0.4, roughness: 0.5 }));
    hab.rotation.z = Math.PI / 2; hab.rotation.y = -a;
    hab.position.set(Math.cos(a) * 5.2, 1.2, Math.sin(a) * 5.2);
    g.add(hab);
  }
  // antena com farol vermelho
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.2, 9, 6), metal);
  mast.position.set(-3.4, 5.2, 2.2); g.add(mast);
  const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.45, 8, 8),
    new THREE.MeshBasicMaterial({ color: 0xff4444 }));
  beacon.position.set(-3.4, 9.9, 2.2); g.add(beacon);
  // pad de pouso com anel emissivo + postes de perímetro
  const pad = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.4, 0.25, 16),
    new THREE.MeshStandardMaterial({ color: 0x2c3238, metalness: 0.6, roughness: 0.6 }));
  pad.position.set(4.6, 0.85, -3.4); g.add(pad);
  const padRing = new THREE.Mesh(new THREE.TorusGeometry(2.0, 0.16, 6, 20),
    new THREE.MeshBasicMaterial({ color: 0x66ff99 }));
  padRing.rotation.x = Math.PI / 2; padRing.position.set(4.6, 1.02, -3.4); g.add(padRing);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const light = new THREE.Mesh(new THREE.SphereGeometry(0.3, 6, 6),
      new THREE.MeshBasicMaterial({ color: 0xffc266 }));
    light.position.set(Math.cos(a) * 7.6, 1.1, Math.sin(a) * 7.6);
    g.add(light);
  }
  g.scale.setScalar(baseScale(bodyRadius));
  return g;
}

// ── NAVE CAPITAL (alvo orbitante "big big" — operador): casco alongado ~700 u,
// ponte, motores com brilho, torres e luzes de navegação bombordo/estibordo.
function capitalShipMesh() {
  const g = new THREE.Group();
  const hullMat = new THREE.MeshStandardMaterial({ color: 0x54222a, metalness: 0.65, roughness: 0.4 });
  const hull = new THREE.Mesh(new THREE.BoxGeometry(6, 4.6, 30), hullMat);
  g.add(hull);
  const spine = new THREE.Mesh(new THREE.CylinderGeometry(1.9, 1.9, 34, 10), hullMat);
  spine.rotation.x = Math.PI / 2; g.add(spine);
  const bridge = new THREE.Mesh(new THREE.BoxGeometry(3.6, 2.6, 5),
    new THREE.MeshStandardMaterial({ color: 0x6a333c, metalness: 0.6, roughness: 0.35 }));
  bridge.position.set(0, 3.4, 9); g.add(bridge);
  const winBand = new THREE.Mesh(new THREE.BoxGeometry(3.7, 0.5, 3.6),
    new THREE.MeshBasicMaterial({ color: 0xaad4ff }));
  winBand.position.set(0, 3.6, 9); g.add(winBand);
  for (const sx of [-1.9, 1.9]) {
    const eng = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.4, 4, 10),
      hullMat);
    eng.rotation.x = Math.PI / 2; eng.position.set(sx, -0.6, 16); g.add(eng);
    const glow = new THREE.Mesh(new THREE.CircleGeometry(1.15, 12),
      new THREE.MeshBasicMaterial({ color: 0xff8844 }));
    glow.position.set(sx, -0.6, 18.1); g.add(glow);
  }
  for (const tz of [-9, -2, 5]) {
    const tur = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.1, 2.2), hullMat);
    tur.position.set(0, 2.8, tz); g.add(tur);
  }
  const pLight = new THREE.Mesh(new THREE.SphereGeometry(0.4, 6, 6), new THREE.MeshBasicMaterial({ color: 0xff5555 }));
  pLight.position.set(-3.2, 0, -14); g.add(pLight);
  const sLight = new THREE.Mesh(new THREE.SphereGeometry(0.4, 6, 6), new THREE.MeshBasicMaterial({ color: 0x55ff88 }));
  sLight.position.set(3.2, 0, -14); g.add(sLight);
  g.scale.setScalar(22);            // casco ~660-750 u de ponta a ponta
  return g;
}

// ── Sítios da caçada: cicla LUAS → planetas do sistema; a cada 3º alvo (e SEMPRE
// no binário, sem superfícies) o alvo é uma NAVE CAPITAL orbitando um corpo. ──
function buildHuntSites(ph, n) {
  const bodies = game.bodies.filter((b) => b.system === ph.sys);
  const moons = bodies.filter((b) => b.isMoon);
  const planets = bodies.filter((b) => !b.isMoon && !b.isSun
    && ['rock', 'ice', 'gas', 'earth', 'cloud'].includes(b.def.kind));
  const surf = [...moons, ...planets];
  const anchors = bodies.filter((b) => !b.isMoon && b.def.radius > 200);
  const sites = [];
  for (let i = 0; i < n; i++) {
    const shipTurn = ph.sys === 'binary' || surf.length === 0 || (i % 3 === 2);
    if (shipTurn && anchors.length) sites.push({ kind: 'ship', body: anchors[i % anchors.length] });
    else sites.push({ kind: 'base', body: surf[i % surf.length] });
  }
  return sites;
}

function spawnHuntTarget(m) {
  const site = m.sites[m.killed];
  const body = site.body;
  let t;
  if (site.kind === 'ship') {
    const obj = capitalShipMesh();
    t = {
      obj, body, ship: true, destroyed: false,
      a0: Math.random() * Math.PI * 2, r: body.def.radius * 1.9,
      y: body.def.radius * 0.25, spd: 0.05,
    };
  } else {
    const obj = baseMesh(body.def.radius);
    const dir = new THREE.Vector3((Math.random() - 0.5), (Math.random() - 0.5), (Math.random() - 0.5)).normalize();
    t = { obj, body, dir, destroyed: false };
  }
  scene.add(t.obj);
  m.targets.push(t);
  spawnEscort(body, m.phaseKey);                 // 3 caças nascem com o alvo
  m.label = `CAÇADA ${m.phaseName}: alvo ${m.killed + 1}/${m.total} — ${site.kind === 'ship' ? 'NAVE CAPITAL em' : 'base em'} ${body.def.name}`;
  game.mission = m;
  targetMission();                                // nav retargeta o novo objetivo
}

function startMission(midx, blocking = false) {
  const ph = currentPhase();
  const list = phaseMissions(ph);
  const def = list[midx];
  if (!def) { completePhase(); return; }
  game.missionIndex = midx;

  // FASES (T-PR-06): a missão só MATERIALIZA (alvos/escoltas/spawns) com o
  // sistema da fase CARREGADO. Fora dele, a missão fica PENDENTE — o objetivo
  // é a viagem: nav mira o sistema; onSystemLoaded materializa na chegada.
  if (def.type === 'hunt') {
    const m = {
      type: 'hunt', total: def.total, killed: 0, targets: [],
      phaseKey: ph.key, phaseName: ph.name, baseKills: game.kills, label: '',
    };
    game.mission = m;
    if (game.world.systemKey !== ph.sys) {
      markPending(m, ph, blocking);
      return;
    }
    m.sites = buildHuntSites(ph, def.total);
    spawnHuntTarget(m);
    if (blocking) showOverlay(`<div style="color:${ph.color}">${m.label}</div><div class="sub">${ph.brief}<br>Aponte com <b>T</b>, calcule a SOLUÇÃO com <b>C</b>, lance com <b>F</b><br><br>[Enter] para decolar</div>`);
    else showToast(`<div style="color:${ph.color}">${m.label}</div>`, 6000);
    return;
  }

  const targets = [];
  game.mission = { ...def, phaseKey: ph.key, targets, baseKills: game.kills };
  if (game.world.systemKey !== ph.sys) {
    markPending(game.mission, ph, blocking);
    return;
  }
  if (def.type === 'visit') {
    const b = findBody(def.key);
    if (b) targetBody(b);
  }
  if (blocking) showOverlay(`<div style="color:${ph.color}">${def.label}</div><div class="sub">[Enter] para decolar</div>`);
  else showToast(`<div style="color:${ph.color}">${def.label}</div>`, 5000);
}

function markPending(m, ph, blocking = false) {
  const sysName = (SYSTEMS.find((s) => s.key === ph.sys) || {}).name || ph.sys;
  m.pending = true;
  m.label = `${ph.name}: VIAJE para ${sysName} — [T] mira o sistema · [Z] engata a viagem`;
  targetSystem(ph.sys);
  if (blocking) showOverlay(`<div style="color:${ph.color}">${m.label}</div><div class="sub">[Enter] para decolar</div>`);
  else showToast(`<div style="color:${ph.color}">${m.label}</div>`, 6000);
}

// ── Hooks de fase (chamados pelo main via celestial/system) ─────────────────
export function onSystemLoaded(key) {
  const m = game.mission;
  if (!m || !game.campaign) return;
  const ph = currentPhase();
  if (ph.sys !== key || !m.pending) return;
  m.pending = false;
  spawnPhase(ph.key);
  if (m.type === 'hunt') {
    m.sites = buildHuntSites(ph, m.total);
    spawnHuntTarget(m);                             // retoma do alvo m.killed
    showToast(`<div style="color:${ph.color}">${m.label}</div>`, 6000);
  } else if (m.type === 'visit') {
    const b = findBody(m.key);
    if (b) targetBody(b);
    showToast(`<div style="color:${ph.color}">${m.label}</div>`, 5000);
  }
}

export function onSystemUnloaded() {
  const m = game.mission;
  if (!m || m._done) return;
  // alvos são objetos do sistema descarregado — morrem com ele; missão pendente
  for (const t of m.targets || []) {
    if (t.obj && t.obj.parent) t.obj.parent.remove(t.obj);
  }
  if (m.targets) m.targets.length = 0;
  if (!m.pending) {
    const ph = currentPhase();
    markPending(m, ph);
  }
}

function phaseMissions(ph) {
  const list = [];
  if (ph.hunt) list.push({ type: 'hunt', total: ph.hunt });
  return [...list, ...ph.missions];
}

export function startMissions() {
  initCampaignState();
  spawnPhase(PHASES[0].key);
  startMission(0, true);
}

export function beginFlight() { hideOverlay(); }

// QA/debug: conclui a missão ativa (caçada inteira, contador clear ou visita).
export function debugCompleteMission() {
  const m = game.mission;
  if (!m) return false;
  if (m.type === 'hunt') {
    for (const t of m.targets) { if (!t.destroyed) { t.destroyed = true; if (t.obj.parent) t.obj.parent.remove(t.obj); } }
    m.killed = m.total;
  } else if (m.type === 'visit') m._forceDone = true;
  return true;
}
// QA/debug: destrói SÓ o alvo atual da caçada (testa a cadeia k → k+1).
export function debugKillTarget() {
  const m = game.mission;
  if (!m || m.type !== 'hunt') return false;
  const t = m.targets[m.targets.length - 1];
  if (t && !t.destroyed) { t.destroyed = true; if (t.obj.parent) t.obj.parent.remove(t.obj); return true; }
  return false;
}

function completePhase() {
  const res = advancePhase();
  if (res.final) { winFinal(); game.mission = null; return; }
  // FASES: o spawn da próxima fase acontece em onSystemLoaded (o sistema dela
  // ainda não existe — o jogador precisa VIAJAR até lá).
  setTimeout(() => startMission(0, false), 1200);
  game.mission = null;
}

export function updateMissions() {
  const m = game.mission;
  if (!m) return;
  // bases presas à superfície; naves capitais em órbita lenta body-relativa
  for (const t of m.targets || []) {
    if (t.destroyed) continue;
    if (t.ship) {
      const a = t.a0 + game.time * t.spd;
      t.obj.position.set(
        t.body.worldPos.x + Math.cos(a) * t.r,
        t.body.worldPos.y + t.y,
        t.body.worldPos.z + Math.sin(a) * t.r,
      );
      t.obj.rotation.y = -a;                     // proa tangente à órbita
    } else {
      const up = t.dir;
      t.obj.position.copy(t.body.worldPos).addScaledVector(up, t.body.def.radius);
      t.obj.up.copy(up); t.obj.lookAt(t.body.worldPos);
    }
  }

  let done = false;
  if (m.type === 'hunt') {
    const current = m.targets[m.targets.length - 1];
    if (current && current.destroyed && m.killed < m.total) {
      m.killed++;
      game.score += 400;
      if (m.killed < m.total) {
        const next = m.sites[m.killed];
        showToast(`<div style="color:#6f6">✔ ALVO ${m.killed}/${m.total} DESTRUÍDO</div><div class="sub">Próximo: ${next.kind === 'ship' ? 'NAVE CAPITAL em' : 'base em'} ${next.body.def.name}</div>`, 5000);
        spawnHuntTarget(m);
      }
    }
    done = m.killed >= m.total;
  } else if (m.type === 'visit') {
    const b = findBody(m.key);
    done = m._forceDone || (b && game.ship.pos && !game.ship.landed
      && game.ship.pos.distanceTo(b.worldPos) < m.dist + b.def.radius);
  }

  if (done && !m._done) {
    m._done = true;
    game.score += 1000;
    const ph = currentPhase();
    const next = game.missionIndex + 1;
    if (next >= phaseMissions(ph).length) {
      showToast(`<div style="color:#6f6">✔ ${ph.name} CONCLUÍDA! +1000</div>`, 4000);
      setTimeout(() => completePhase(), 2500);
      return;
    }
    showToast(`<div style="color:#6f6">✔ MISSÃO CUMPRIDA! +1000</div>`, 3000);
    setTimeout(() => startMission(next, false), 3000);
  }
}
