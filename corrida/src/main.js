// main.js — Cruis'n Tauan: menu (pista+carro) → contagem → corrida de 3 voltas
// → pódio. Chase-cam com shake de rumble, HUD de velocidade/volta/posição.

import * as THREE from '../../vendor/three.module.min.js';
import { TRACKS } from './tracks.js';
import { CARS, buildCarMesh } from './cars.js';
import { buildWorld, sampleAt } from './world.js';
import { makeCarState, stepCar } from './physics.js';
import { makeAI, aiInput } from './ai.js';

const HEADLESS = typeof navigator !== 'undefined' && navigator.webdriver === true;
const LAPS = 3;
const N_AI = 5;

// ── renderer/cena ───────────────────────────────────────────────────────────
const renderer = new THREE.WebGLRenderer({ antialias: !HEADLESS, powerPreference: 'high-performance' });
renderer.setPixelRatio(HEADLESS ? 0.5 : Math.min(window.devicePixelRatio, 1.5));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
document.body.appendChild(renderer.domElement);
const camera = new THREE.PerspectiveCamera(68, window.innerWidth / window.innerHeight, 0.3, 16000);
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ── estado global ───────────────────────────────────────────────────────────
const G = {
  phase: 'menu',                  // menu | countdown | race | finished
  trackIdx: 0, carIdx: 0, menuRow: 0,
  scene: null, world: null,
  player: null, cars: [],         // [{st, mesh, name, isPlayer}]
  countdown: 0, raceT: 0, position: 1,
  keys: {},
};
window.__corrida = G;             // diagnóstico p/ testes e2e

// ── input ───────────────────────────────────────────────────────────────────
window.addEventListener('keydown', (e) => {
  G.keys[e.code] = true;
  if (G.phase === 'menu') menuKey(e.code);
  if ((G.phase === 'finished') && (e.code === 'Enter' || e.code === 'KeyR')) toMenu();
  if (G.phase === 'race' && e.code === 'KeyR') startRace();
});
window.addEventListener('keyup', (e) => { G.keys[e.code] = false; });

function playerInput() {
  const k = G.keys;
  return {
    throttle: (k.KeyW || k.ArrowUp) ? 1 : 0,
    brake: (k.KeyS || k.ArrowDown) ? 1 : 0,
    steer: ((k.KeyA || k.ArrowLeft) ? -1 : 0) + ((k.KeyD || k.ArrowRight) ? 1 : 0),
  };
}

// ── menu ────────────────────────────────────────────────────────────────────
const el = (id) => document.getElementById(id);
function renderMenu() {
  el('menuTracks').innerHTML = TRACKS.map((t, i) =>
    `<div class="opt ${i === G.trackIdx ? 'sel' : ''} ${G.menuRow === 0 && i === G.trackIdx ? 'focus' : ''}">
      <b>${t.name}</b><span>${t.desc}</span></div>`).join('');
  el('menuCars').innerHTML = CARS.map((c, i) =>
    `<div class="opt ${i === G.carIdx ? 'sel' : ''} ${G.menuRow === 1 && i === G.carIdx ? 'focus' : ''}">
      <b>${c.name}</b><span>${c.desc}</span>
      <span class="stats">vel ${c.topSpeed} · acel ${c.accel} · grip ${(c.grip * 100) | 0}%${c.dirtBonus > 0.1 ? ' · 🟤 rei da terra' : ''}</span></div>`).join('');
}
function menuKey(code) {
  if (code === 'ArrowUp' || code === 'KeyW') G.menuRow = 0;
  else if (code === 'ArrowDown' || code === 'KeyS') G.menuRow = 1;
  else if (code === 'ArrowLeft' || code === 'KeyA') {
    if (G.menuRow === 0) G.trackIdx = (G.trackIdx + TRACKS.length - 1) % TRACKS.length;
    else G.carIdx = (G.carIdx + CARS.length - 1) % CARS.length;
  } else if (code === 'ArrowRight' || code === 'KeyD') {
    if (G.menuRow === 0) G.trackIdx = (G.trackIdx + 1) % TRACKS.length;
    else G.carIdx = (G.carIdx + 1) % CARS.length;
  } else if (code === 'Enter') { startRace(); return; }
  renderMenu();
}
function toMenu() {
  G.phase = 'menu';
  el('menu').style.display = 'flex';
  el('finish').style.display = 'none';
  el('hud').style.display = 'none';
  renderMenu();
}

// ── corrida ─────────────────────────────────────────────────────────────────
function startRace() {
  const trackDef = TRACKS[G.trackIdx];
  G.scene = new THREE.Scene();
  G.world = buildWorld(trackDef, G.scene);
  G.cars = [];

  // grid de largada: jogador na última fila (Cruis'n raiz)
  const pool = CARS.filter((_, i) => i !== G.carIdx);
  const roster = [CARS[G.carIdx]];
  for (let i = 0; i < N_AI; i++) roster.push(pool[i % pool.length]);
  roster.forEach((carDef, i) => {
    const row = Math.floor(i / 2), lane = (i % 2 ? 1 : -1) * trackDef.width * 0.22;
    const sm = sampleAt(G.world.track, 1 - (row + 1) * 0.006);
    const spawn = new THREE.Vector3(
      sm.pos.x + sm.side.x * lane, sm.pos.y, sm.pos.z + sm.side.z * lane);
    const heading = Math.atan2(-sm.tan.x, -sm.tan.z);
    const st = makeCarState(carDef, spawn, heading);
    st.sHint = sm.s; st.lastS = sm.s; st.lap = 0;
    const mesh = buildCarMesh(carDef);
    mesh.position.copy(spawn);
    G.scene.add(mesh);
    const entry = { st, mesh, name: carDef.name, isPlayer: i === 0 };
    if (i !== 0) makeAI(st, lane * 0.7, 0.82 + Math.random() * 0.14);
    G.cars.push(entry);
  });
  G.player = G.cars[0];

  G.phase = 'countdown';
  G.countdown = HEADLESS ? 0.1 : 3.6;
  G.raceT = 0;
  el('menu').style.display = 'none';
  el('finish').style.display = 'none';
  el('hud').style.display = 'block';
  el('trackName').textContent = trackDef.name;
}

function finishRace() {
  G.phase = 'finished';
  const pos = G.position;
  const medal = pos === 1 ? '🏆 CAMPEÃO!' : pos === 2 ? '🥈 2º LUGAR' : pos === 3 ? '🥉 3º LUGAR' : `${pos}º LUGAR`;
  el('finishTitle').textContent = medal;
  el('finishSub').textContent = `${G.player.st.def.name} · ${TRACKS[G.trackIdx].name} · tempo ${fmtT(G.raceT)}`;
  el('finish').style.display = 'flex';
}

function fmtT(t) {
  const m = (t / 60) | 0, s = t % 60;
  return `${m}:${s.toFixed(1).padStart(4, '0')}`;
}

// ── câmera de perseguição ───────────────────────────────────────────────────
const _camPos = new THREE.Vector3();
const _look = new THREE.Vector3();
function updateCamera(dt) {
  const st = G.player.st;
  const back = 9 + st.v * 0.06;
  const fx = -Math.sin(st.heading), fz = -Math.cos(st.heading);
  _camPos.set(st.pos.x - fx * back, st.pos.y + 3.6 + st.suspension * 0.5, st.pos.z - fz * back);
  camera.position.lerp(_camPos, Math.min(1, 7 * dt));
  // rumble: tremulação da câmera em terra/fora
  const r = st.rumble;
  if (r > 0.03) {
    camera.position.x += (Math.random() - 0.5) * 0.14 * r;
    camera.position.y += (Math.random() - 0.5) * 0.18 * r;
  }
  _look.set(st.pos.x + fx * 6, st.pos.y + 1.4, st.pos.z + fz * 6);
  camera.lookAt(_look);
  camera.fov = 68 + Math.min(14, st.v * 0.16);          // sensação de velocidade
  camera.updateProjectionMatrix();
}

// ── HUD ─────────────────────────────────────────────────────────────────────
function updateHUD() {
  const st = G.player.st;
  el('speed').textContent = `${(st.v * 3.4) | 0} km/h`;
  el('lap').textContent = `VOLTA ${Math.max(1, Math.min(LAPS, st.lap))}/${LAPS}`;
  el('pos').textContent = `${G.position}º/${G.cars.length}`;
  const q = G.world.surfaceAt(st.pos.x, st.pos.z, st.sHint);
  el('surface').textContent = q.surface === 'dirt' ? '🟤 TERRA' : q.surface === 'offroad' ? '⚠ FORA DA PISTA' : '';
  el('time').textContent = fmtT(G.raceT);
}

// ── loop ────────────────────────────────────────────────────────────────────
let last = performance.now();
function loop() {
  requestAnimationFrame(loop);
  const now = performance.now();
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;

  if (G.phase === 'countdown' || G.phase === 'race' || G.phase === 'finished') {
    if (G.phase === 'countdown') {
      G.countdown -= dt;
      el('count').textContent = G.countdown > 1 ? Math.ceil(G.countdown - 0.6) : 'GO!';
      el('count').style.display = 'block';
      if (G.countdown <= 0) { G.phase = 'race'; el('count').style.display = 'none'; }
    }
    const racing = G.phase === 'race';
    if (racing) G.raceT += dt;

    for (const c of G.cars) {
      const input = !racing && !c.st.finished
        ? { throttle: 0, brake: 1, steer: 0 }
        : c.isPlayer
          ? (c.st.finished ? { throttle: 0, brake: 0.6, steer: 0 } : playerInput())
          : aiInput(c.st, G.world, G.player.st.progress);
      stepCar(c.st, input, G.world, dt);
      c.mesh.position.copy(c.st.pos);
      c.mesh.rotation.set(0, c.st.heading + Math.PI, 0);
      // pitch de suspensão/lombada + inclinação na curva
      c.mesh.rotation.x = c.st.airborne ? -0.12 : c.st.suspension * 1.4;
      c.mesh.rotation.z = -input.steer * Math.min(0.5, c.st.v / 60) * 0.12;
      for (const w of c.mesh.userData.wheels) w.rotation.x += c.st.v * dt * 1.8;
      if (racing && !c.st.finished && c.st.lap > LAPS) {
        c.st.finished = true;
        if (c.isPlayer) finishRace();
      }
    }
    // posição na corrida
    const order = [...G.cars].sort((a, b) => b.st.progress - a.st.progress);
    G.position = order.indexOf(G.player) + 1;

    updateCamera(dt);
    G.world.update(camera);
    updateHUD();
    renderer.render(G.scene, camera);
  }
}

renderMenu();
toMenu();
loop();
window.__corridaReady = true;
