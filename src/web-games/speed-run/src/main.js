// main.js — Cruis'n Tauan: menu (pista+carro) → contagem → corrida de 3 voltas
// → pódio. Chase-cam com shake de rumble, HUD de velocidade/volta/posição.

import * as THREE from '../../vendor/three.module.min.js';
import { TRACKS } from './tracks.js';
import { CARS, TRAFFIC_DEFS, POLICE_DEFS, buildCarMesh, makePolice, disposeProcCarGeometries } from './cars.js';
import { buildWorld, sampleAt } from './world.js';
import { makeCarState, stepCar, collideCars, clampToFence } from './physics.js';
import { makeAI, makeChaseAI, aiInput } from './ai.js';
import { music } from './music.js';        // MUSICA: trilha procedural (Top Gear style)

const HEADLESS = typeof navigator !== 'undefined' && navigator.webdriver === true;
const LAPS = 3;
const N_AI = 5;
// WS-5: modos da pista sprint (Serra do Tauan) — Corrida A→B ou Fuga da polícia
const MODES = [
  { key: 'corrida', name: 'Corrida', desc: 'Sprint A→B contra 5 rivais — sem voltas.' },
  { key: 'fuga', name: 'Fuga 🚔', desc: 'Escape da polícia até Vila Serrana com a carroceria inteira.' },
];

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
  mode: 'corrida',                // WS-5: corrida | fuga (só na pista sprint)
  sprint: false, chase: null, finishS: null,
  scene: null, world: null,
  player: null, cars: [],         // [{st, mesh, name, isPlayer}]
  countdown: 0, raceT: 0, position: 1,
  keys: {},
};
window.__corrida = G;             // diagnóstico p/ testes e2e
G.camera = camera;                // p/ inspeção visual em debug (camOverride)
G.renderer = renderer;            // p/ medir renderer.info (draw calls/texturas) em probes
G.spawnSpike = (side) => spawnSpike(side);   // WS-5: specs forçam spike strip

// ── input ───────────────────────────────────────────────────────────────────
window.addEventListener('keydown', (e) => {
  music.init();                                     // MUSICA: 1º gesto libera o AudioContext
  if (e.code === 'KeyM') music.toggleMute();        // MUSICA: M = mute
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
    // A/esquerda = +heading (vira p/ -X = esquerda da tela) — sinal validado
    // em jogo; o mapeamento antigo estava INVERTIDO (bug operador 2026-07-18)
    steer: ((k.KeyA || k.ArrowLeft) ? 1 : 0) + ((k.KeyD || k.ArrowRight) ? -1 : 0),
    nitro: (k.ShiftLeft || k.ShiftRight) ? 1 : 0,       // NITRO: Shift (v0.8.0)
  };
}

// ── NITRO (v0.8.0) ──────────────────────────────────────────────────────────
// Recurso do JOGADOR (a IA não usa — vantagem do jogador, decisão de design):
// carga 0–100, consome 33/s segurando Shift, regenera 8/s (×2 após 3 s em
// velocidade no acelerador sem colisões). Seco = sem efeito + flash "SEM
// NITRO" 1× por apertada. Na Fuga, as PANCADAS DA POLÍCIA não drenam nitro
// (o consumo é só por uso e o timer de regen ignora ram policial).
const NITRO = { drain: 33, regen: 8, regenBoostAfter: 3, minV: 1, regenMinV: 10, minStart: 5 };
let nitroGlowGeo = null, nitroGlowMat = null;       // cache p/ restart sem leak
function makeNitro() {
  return { charge: 100, active: false, regenT: 0, flashT: 0, wasKey: false };
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
  // WS-5: linha MODO só existe na pista sprint
  const sprint = !!TRACKS[G.trackIdx].sprint;
  el('menuModesLabel').style.display = sprint ? 'block' : 'none';
  el('menuModes').style.display = sprint ? 'flex' : 'none';
  if (sprint) {
    el('menuModes').innerHTML = MODES.map((m, i) =>
      `<div class="opt ${m.key === G.mode ? 'sel' : ''} ${G.menuRow === 2 && m.key === G.mode ? 'focus' : ''}">
        <b>${m.name}</b><span>${m.desc}</span></div>`).join('');
  }
}
function menuKey(code) {
  const sprint = !!TRACKS[G.trackIdx].sprint;
  const rows = sprint ? 3 : 2;
  if (code === 'ArrowUp' || code === 'KeyW') G.menuRow = (G.menuRow + rows - 1) % rows;
  else if (code === 'ArrowDown' || code === 'KeyS') G.menuRow = (G.menuRow + 1) % rows;
  else if (code === 'ArrowLeft' || code === 'KeyA') {
    if (G.menuRow === 0) G.trackIdx = (G.trackIdx + TRACKS.length - 1) % TRACKS.length;
    else if (G.menuRow === 1) G.carIdx = (G.carIdx + CARS.length - 1) % CARS.length;
    else G.mode = MODES[(MODES.findIndex((m) => m.key === G.mode) + MODES.length - 1) % MODES.length].key;
  } else if (code === 'ArrowRight' || code === 'KeyD') {
    if (G.menuRow === 0) G.trackIdx = (G.trackIdx + 1) % TRACKS.length;
    else if (G.menuRow === 1) G.carIdx = (G.carIdx + 1) % CARS.length;
    else G.mode = MODES[(MODES.findIndex((m) => m.key === G.mode) + 1) % MODES.length].key;
  } else if (code === 'Enter') { startRace(); return; }
  // trocou de pista: modo Fuga só existe no sprint; menuRow 2 só no sprint
  if (!TRACKS[G.trackIdx].sprint) { G.mode = 'corrida'; if (G.menuRow === 2) G.menuRow = 0; }
  renderMenu();
}
function toMenu() {
  G.phase = 'menu';
  music.setIntensity('menu');                       // MUSICA: mix esparsa no menu
  el('menu').style.display = 'flex';
  el('finish').style.display = 'none';
  el('hud').style.display = 'none';
  el('life').style.display = 'none';
  el('msg').textContent = '';
  renderMenu();
}

// ── corrida ─────────────────────────────────────────────────────────────────
// PMREM cacheado por PISTA (WS-3): antes um PMREMGenerator era criado a cada
// largada e NUNCA descartado (vazamento de FBOs/shaders). A env texture vive
// fora do worldRoot — não é disposta no rebuild.
const pmremCache = new Map();          // trackDef.key → env texture

// dispõe SÓ a subárvore do mundo (worldRoot): geometrias, materiais e texturas
// canvas da pista. Carros ficam fora — seus GLBs/materiais são compartilhados
// entre corridas (cars.js) e NÃO podem ser dispostos. As exceções (geometrias
// PROCEDURAIS do idea/fallback, frescas a cada build) são dispostas à parte
// por disposeProcCarGeometries — chamado junto desta faxina no startRace.
function disposeWorldSubtree(scene) {
  const root = scene.getObjectByName('worldRoot');
  if (!root) return;
  root.traverse((o) => {
    if (o.geometry) o.geometry.dispose();
    const mats = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : [];
    for (const mt of mats) {
      for (const key of ['map', 'alphaMap', 'lightMap', 'emissiveMap']) {
        if (mt[key]) mt[key].dispose();
      }
      mt.dispose();
    }
  });
  scene.remove(root);
}

function startRace() {
  const trackDef = TRACKS[G.trackIdx];
  if (G.scene) {
    disposeWorldSubtree(G.scene);      // restart hygiene (WS-3)
    disposeProcCarGeometries();        // geometrias procedurais (idea/fallback) da corrida anterior
  }
  G.scene = new THREE.Scene();
  G.world = buildWorld(trackDef, G.scene);
  G.cars = [];

  // WS-5: sprint A→B (sem voltas) e modo Fuga (perseguição policial)
  G.sprint = !!trackDef.sprint;
  G.finishS = G.world.finishS;               // null nas pistas de circuito
  G.chase = null;

  // grid de largada: circuito = últimas filas antes da linha (jogador atrás,
  // Cruis'n raiz); sprint = slots a partir do início (s = 14+8·i m, ±1,9 m)
  const slot = (i) => {
    if (G.world.track.open) {
      const sm = sampleAt(G.world.track, (14 + 8 * i) / G.world.trackLen);
      return { sm, lane: (i % 2 ? 1 : -1) * 1.9 };
    }
    const row = Math.floor(i / 2), lane = (i % 2 ? 1 : -1) * trackDef.width * 0.22;
    return { sm: sampleAt(G.world.track, 1 - (row + 1) * 0.006), lane };
  };
  const spawnAt = (carDef, i) => {
    const { sm, lane } = slot(i);
    const spawn = new THREE.Vector3(
      sm.pos.x + sm.side.x * lane, sm.pos.y, sm.pos.z + sm.side.z * lane);
    const heading = Math.atan2(-sm.tan.x, -sm.tan.z);
    const st = makeCarState(carDef, spawn, heading);
    st.sHint = sm.s; st.lastS = sm.s; st.lap = 0; st.cp = 0;
    const mesh = buildCarMesh(carDef);
    mesh.position.copy(spawn);
    G.scene.add(mesh);
    return { st, mesh, name: carDef.name, isPlayer: false };
  };

  if (G.sprint && G.mode === 'fuga') {
    // ── FUGA: jogador à frente (slot 5), 3 viaturas atrás (slots 0–2) ──────
    const chase = {
      life: 100, cd: 0, msg: '', msgT: 0,
      spikeT: 16, spikes: [], over: false, caught: false, escaped: false,
    };
    G.chase = chase;
    const player = spawnAt(CARS[G.carIdx], 5);
    player.isPlayer = true;
    G.cars.push(player);
    G.player = player;
    for (let i = 0; i < 3; i++) {
      const cop = spawnAt(POLICE_DEFS[i], i);
      cop.isPolice = true;
      makePolice(cop.mesh);
      makeChaseAI(cop.st);
      G.cars.push(cop);
    }
  } else {
    // ── CORRIDA (circuito ou sprint): jogador + N_AI rivais ────────────────
    const pool = CARS.filter((_, i) => i !== G.carIdx);
    const roster = [CARS[G.carIdx]];
    for (let i = 0; i < N_AI; i++) roster.push(pool[i % pool.length]);
    roster.forEach((carDef, i) => {
      const entry = spawnAt(carDef, i);
      entry.isPlayer = i === 0;
      if (i !== 0) makeAI(entry.st, slot(i).lane * 0.7, 0.82 + Math.random() * 0.14);
      G.cars.push(entry);
    });
    G.player = G.cars[0];
  }

  // TRÁFEGO CIVIL (operador 2026-07-18): carros comuns circulando devagar,
  // espalhados pela pista — desviar deles faz parte da corrida (Cruis'n raiz).
  for (let i = 0; i < 4; i++) {
    const tdef = TRAFFIC_DEFS[i % TRAFFIC_DEFS.length];
    const sm = sampleAt(G.world.track, 0.15 + i * 0.2);
    const lane = (i % 2 ? 1 : -1) * sm.width * 0.2;
    const spawn = new THREE.Vector3(
      sm.pos.x + sm.side.x * lane, sm.pos.y, sm.pos.z + sm.side.z * lane);
    const st = makeCarState(tdef, spawn, Math.atan2(-sm.tan.x, -sm.tan.z));
    st.sHint = sm.s; st.lastS = sm.s; st.lap = 0;
    const mesh = buildCarMesh(tdef);
    mesh.position.copy(spawn);
    G.scene.add(mesh);
    makeAI(st, lane * 0.8, 0.2 + (i % 2) * 0.05);       // BEM devagar
    G.cars.push({ st, mesh, name: tdef.name, isPlayer: false, isTraffic: true });
  }

  // reflexos de ambiente na lataria (o brilho de vitrine dos NFS): PMREM do
  // próprio mundo — os MeshStandardMaterial dos GLB refletem céu/paisagem.
  // WS-3: cache por pista + generator descartado após o uso.
  if (!HEADLESS) {
    let envTex = pmremCache.get(trackDef.key);
    if (!envTex) {
      const pmrem = new THREE.PMREMGenerator(renderer);
      envTex = pmrem.fromScene(G.scene, 0.04).texture;
      pmrem.dispose();
      pmremCache.set(trackDef.key, envTex);
    }
    G.scene.environment = envTex;
  }

  G.phase = 'countdown';
  G.countdown = HEADLESS ? 0.1 : 3.6;
  music.setIntensity('race');                       // MUSICA: mix cheia na corrida
  G.raceT = 0;
  G.nitro = makeNitro();                            // NITRO: carga cheia a cada largada
  // NITRO: glow de escapamento (barato — 2 esferas emissivas atrás do carro
  // do jogador; ligadas só com o nitro ativo, no loop de render). Geo/mat
  // CACHEADOS em nível de módulo: o restart (R) não vaza buffer de GPU.
  if (!nitroGlowGeo) {
    nitroGlowGeo = new THREE.SphereGeometry(0.22, 8, 6);
    nitroGlowMat = new THREE.MeshBasicMaterial({ color: 0x55ccff });
  }
  G.nitroGlows = [];
  for (const gx of [-0.55, 0.55]) {
    const g = new THREE.Mesh(nitroGlowGeo, nitroGlowMat);
    g.position.set(gx, 0.65, 2.1);                // traseira (modelo anda p/ -Z)
    g.visible = false;
    G.player.mesh.add(g);
    G.nitroGlows.push(g);
  }
  el('menu').style.display = 'none';
  el('finish').style.display = 'none';
  el('hud').style.display = 'block';
  el('life').style.display = G.chase ? 'block' : 'none';
  el('msg').textContent = '';
  el('trackName').textContent = trackDef.name + (G.chase ? ' — FUGA 🚔' : '');
}

function finishRace() {
  G.phase = 'finished';
  const trackName = TRACKS[G.trackIdx].name;
  if (G.chase) {
    // WS-5 Fuga: dois finais — escapou (cruzou finish_s vivo) ou pego (vida 0)
    const ch = G.chase;
    ch.over = true;
    for (const c of G.cars) if (c.isPolice) c.st.finished = true;
    if (ch.caught) {
      el('finishTitle').textContent = '🚔 PEGO PELA POLÍCIA!';
      el('finishSub').textContent = `${G.player.st.def.name} · ${trackName} · aguentou ${fmtT(G.raceT)}`;
    } else {
      ch.escaped = true;
      el('finishTitle').textContent = '🏁 VOCÊ ESCAPOU!';
      el('finishSub').textContent = `Chegou a Vila Serrana · tempo ${fmtT(G.raceT)} · vida ${Math.round(ch.life)}%`;
    }
  } else {
    const pos = G.position;
    const medal = pos === 1 ? '🏆 CAMPEÃO!' : pos === 2 ? '🥈 2º LUGAR' : pos === 3 ? '🥉 3º LUGAR' : `${pos}º LUGAR`;
    el('finishTitle').textContent = medal;
    el('finishSub').textContent = `${G.player.st.def.name} · ${trackName} · tempo ${fmtT(G.raceT)}`;
  }
  el('finish').style.display = 'flex';
}

// ── WS-5 Fuga: dano + spike strips ──────────────────────────────────────────
const clampDmg = (v) => Math.max(4, Math.min(30, v));

function damage(amount, msg) {
  const ch = G.chase;
  if (!ch || ch.over || ch.cd > 0) return;
  ch.life = Math.max(0, ch.life - amount);
  ch.cd = 0.6;
  ch.msg = msg;
  ch.msgT = 1.4;
  if (ch.life <= 0) {
    ch.caught = true;
    G.player.st.finished = true;
    finishRace();
  }
}

// velocidade 2D do carro (frente + deriva) — p/ fechamento relativo das batidas
function velOf(st) {
  const fx = -Math.sin(st.heading), fz = -Math.cos(st.heading);
  return [fx * st.v - fz * st.lat, fz * st.v + fx * st.lat];
}

// SPIKE STRIP: barra amarela + 6 cones em METADE da pista, 130 m à frente do
// jogador. Atropelar = pneu furado (v×0,55 + grip reduzido 2 s) + 12 de dano.
// Geometrias/materiais POR TIRA: o grupo vive sob worldRoot e o restart
// (disposeWorldSubtree) dispõe tudo — recurso compartilhado morreria no 2º uso.
function spawnSpike(side) {
  const ch = G.chase;
  if (!ch || ch.over) return null;
  const st = G.player.st;
  const s = Math.min(st.sHint + 130 / G.world.trackLen, G.finishS - 0.01);
  const sm = sampleAt(G.world.track, s);
  const sd = side ?? (Math.random() < 0.5 ? -1 : 1);
  const halfW = sm.width / 2;
  const group = new THREE.Group();
  const cx = sm.pos.x + sm.side.x * (halfW / 2) * sd;
  const cz = sm.pos.z + sm.side.z * (halfW / 2) * sd;
  const rotY = Math.atan2(sm.tan.x, sm.tan.z);          // barra ⊥ tangente
  const bar = new THREE.Mesh(new THREE.BoxGeometry(halfW - 0.4, 0.22, 1.1),
    new THREE.MeshLambertMaterial({ color: 0xd8c020 }));
  bar.position.set(cx, sm.pos.y + 0.11, cz);
  bar.rotation.y = rotY;
  group.add(bar);
  const coneMat = new THREE.MeshLambertMaterial({ color: 0xe05020 });
  for (let k = 0; k < 6; k++) {
    const cone = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.65, 8), coneMat);
    const o = ((k + 0.5) / 6 - 0.5) * (halfW - 0.8) * sd + (halfW / 2) * sd;
    cone.position.set(sm.pos.x + sm.side.x * o, sm.pos.y + 0.32, sm.pos.z + sm.side.z * o);
    group.add(cone);
  }
  G.world.root.add(group);
  const spike = { s, side: sd, sm, group, hit: false };
  ch.spikes.push(spike);
  return spike;
}

function fmtT(t) {
  const m = (t / 60) | 0, s = t % 60;
  return `${m}:${s.toFixed(1).padStart(4, '0')}`;
}

// ── câmera de perseguição ───────────────────────────────────────────────────
const _camPos = new THREE.Vector3();
const _look = new THREE.Vector3();
function updateCamera(dt) {
  if (G.camOverride) { G.camOverride(camera); return; }   // debug/inspeção
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
  // NITRO (v0.8.0): kick de FOV +6° COMPOSTO sobre a lógica de velocidade
  // (suavizado p/ não dar pop) + tremulação sutil de tela enquanto queima.
  const nitroOn = G.nitro && G.nitro.active;
  G.fovKick = (G.fovKick || 0) + ((nitroOn ? 6 : 0) - (G.fovKick || 0)) * Math.min(1, 8 * dt);
  if (nitroOn) {
    camera.position.x += (Math.random() - 0.5) * 0.06;
    camera.position.y += (Math.random() - 0.5) * 0.08;
  }
  camera.fov = 68 + Math.min(14, st.v * 0.16) + G.fovKick;   // sensação de velocidade
  camera.updateProjectionMatrix();
}

// ── HUD ─────────────────────────────────────────────────────────────────────
function updateHUD() {
  const st = G.player.st;
  el('speed').textContent = `${(st.v * 3.4) | 0} km/h`;
  if (G.sprint) {
    // WS-5: "Faltam X.X km" em vez de voltas; na Fuga, distância da polícia
    const remKm = Math.max(0, (G.finishS - st.sHint) * G.world.trackLen / 1000);
    el('lap').textContent = `Faltam ${remKm.toFixed(1)} km`;
    if (G.chase) {
      let nearest = Infinity;
      for (const c of G.cars) {
        if (!c.isPolice) continue;
        nearest = Math.min(nearest, Math.hypot(c.st.pos.x - st.pos.x, c.st.pos.z - st.pos.z));
      }
      el('pos').textContent = `🚔 Polícia a ${nearest | 0} m`;
      const ch = G.chase;
      el('lifeFill').style.width = `${ch.life}%`;
      el('lifeFill').style.background = ch.life > 40 ? '#3cd060' : '#e03028';
      el('msg').textContent = ch.msgT > 0 ? ch.msg : '';
    } else {
      el('pos').textContent = `${G.position}º/${G.cars.filter((c) => !c.isTraffic).length}`;
    }
  } else {
    el('lap').textContent = `VOLTA ${Math.max(1, Math.min(LAPS, st.lap))}/${LAPS}`;
    el('pos').textContent = `${G.position}º/${G.cars.filter((c) => !c.isTraffic).length}`;
  }
  const q = G.world.surfaceAt(st.pos.x, st.pos.z, st.sHint);
  el('surface').textContent = q.surface === 'dirt' ? '🟤 TERRA'
    : q.surface === 'water' ? '💦 VADO'
      : q.surface === 'offroad' ? '⚠ FORA DA PISTA' : '';
  el('time').textContent = fmtT(G.raceT);
  // NITRO (v0.8.0): barra cyan ao lado da velocidade + flash "SEM NITRO"
  const n = G.nitro;
  if (n) {
    el('nitroFill').style.width = `${n.charge}%`;
    el('nitroFill').style.background = n.active ? '#8ff0ff' : '#1f8fe0';
    el('nitroMsg').style.display = n.flashT > 0 ? 'block' : 'none';
  }
}

// ── loop ────────────────────────────────────────────────────────────────────
// TIMESTEP FIXO (operador 2026-08-10): a simulação roda em SUBSTEPS de 120 Hz
// com acumulador. Antes dt era clampado em 0,05 s — abaixo de 20 FPS o jogo
// inteiro rodava em CÂMERA LENTA. Agora FPS baixo faz MAIS substeps e o tempo
// de simulação acompanha o tempo real; o render lê o estado mais recente.
const SUB = 1 / 120;
const MAX_SUB = 60;                         // até 0,5 s de sim por frame (~2 fps)
let acc = 0;
let last = performance.now();

// um substep de simulação (física + colisões + posição na corrida)
function simStep(dt) {
  const racing = G.phase === 'race';
  if (racing) G.raceT += dt;
  const ch = G.chase;
  if (racing && ch && !ch.over) {
    ch.cd = Math.max(0, ch.cd - dt);
    ch.msgT = Math.max(0, ch.msgT - dt);
    ch.spikeT -= dt;
    if (ch.spikeT <= 0) { spawnSpike(); ch.spikeT = 16; }
  }
  for (const c of G.cars) {
    // countdown: neutro (brake acionaria a marcha à RÉ nova); quem terminou
    // freia até parar (SEM marcha à ré — o carro não recua depois da linha)
    const input = !racing && !c.st.finished
      ? { throttle: 0, brake: 0, steer: 0 }
      : c.st.finished
        ? { throttle: 0, brake: c.st.v > 0.5 ? 0.6 : 0, steer: 0 }
        : c.isPlayer
          ? playerInput()
          : aiInput(c.st, G.world, G.player.st);
    c.input = input;                                 // p/ visuais por frame
    // NITRO (v0.8.0): o recurso é SÓ do jogador (a IA nunca recebe a tecla).
    // Ativação + consumo por substep (dt-scaled, 120 Hz) — nunca por frame.
    if (c.isPlayer && G.nitro) {
      const n = G.nitro;
      const key = input.nitro > 0;
      // HISTERESE anti-"engasgo": liga com carga ≥ 5, queima até 0. Sem isso o
      // regen de 8/s faria o tanque vazio piscar o boost (0,2 s liga/desliga).
      const can = n.active ? n.charge > 0 : n.charge >= NITRO.minStart;
      // só empurrando p/ frente (v > 1); NO AR é permitido (Cruis'n style)
      n.active = racing && key && can && c.st.v > NITRO.minV;
      // flash "SEM NITRO": 1× por apertada (borda de subida com tanque seco)
      if (racing && key && !n.wasKey && n.charge < NITRO.minStart) n.flashT = 0.9;
      n.wasKey = key;
      input.nitro = n.active ? 1 : 0;              // seco/parado: sem efeito
      if (n.active) {
        n.charge = Math.max(0, n.charge - NITRO.drain * dt);
        n.regenT = 0;
      }
    }
    stepCar(c.st, input, G.world, dt);
    if (racing && !c.st.finished) {
      if (G.sprint) {
        // WS-5 sprint: SEM voltas — termina em finish_s (30 m antes do fim);
        // 6 checkpoints de progresso (sanity) em s = (i+1)/6.
        // c === G.player (não isPlayer): os probes e2e dirigem o jogador via
        // hook st.ai (isPlayer=false) e a chegada TEM que disparar igual.
        if (c.st.sHint >= G.finishS) {
          c.st.finished = true;
          if (c === G.player) finishRace();
        }
        while (c.st.cp < 6 && c.st.sHint >= (c.st.cp + 1) / 6) c.st.cp++;
      } else if (c.st.lap > LAPS) {
        c.st.finished = true;
        if (c === G.player) finishRace();
      }
    }
  }
  // COLISÕES carro-carro (elásticas) — inclui o tráfego civil
  let playerBump = false;                       // NITRO: colisão zera o regen
  for (let i = 0; i < G.cars.length; i++) {
    for (let j = i + 1; j < G.cars.length; j++) {
      const a = G.cars[i], b = G.cars[j];
      // WS-5 Fuga: fechamento relativo ANTES do impulso (dano por batida)
      let rel = 0;
      if (racing && ch && !ch.over && (a === G.player || b === G.player)) {
        const [ax, az] = velOf(a.st), [bx, bz] = velOf(b.st);
        rel = Math.hypot(ax - bx, az - bz);
      }
      const hit = collideCars(a.st, b.st);
      if (hit && (a === G.player || b === G.player)) {
        const other = a === G.player ? b : a;
        // NITRO: na Fuga o RAM POLICIAL não drena nitro nem zera o regen
        if (!other.isPolice) playerBump = true;
      }
      if (hit && rel > 0) {
        const other = a === G.player ? b : a;
        if (other.isPolice && rel > 3) damage(8, '🚔 PANCADA DA POLÍCIA!');
        else if (other.isTraffic && rel > 4) damage(clampDmg(0.9 * rel), '💥 ACIDENTE!');
      }
    }
  }
  // WS-5 Fuga: BATIDA na cerca (>9 m/s de impacto) + spike strips
  if (racing && ch && !ch.over) {
    const st = G.player.st;
    if (st.hitWall && st.wallImpact > 9) damage(clampDmg(0.55 * st.wallImpact), '🧱 BATIDA!');
    for (const sp of ch.spikes) {
      if (sp.hit) continue;
      const ds = (st.sHint - sp.s) * G.world.trackLen;
      if (ds < -2 || ds > 2) continue;
      const lat = (st.pos.x - sp.sm.pos.x) * sp.sm.side.x + (st.pos.z - sp.sm.pos.z) * sp.sm.side.z;
      if (Math.sign(lat) === sp.side && Math.abs(lat) < sp.sm.width / 2 + 1) {
        sp.hit = true;
        st.v *= 0.55;                              // estouro: perda seca de velocidade
        st.punctureT = 2;                          // + grip reduzido por 2 s
        damage(12, '🔧 PNEU FURADO!');
      }
    }
    // faxina: tiras muito atrás saem de cena (o restart dispõe o resto)
    for (let k = ch.spikes.length - 1; k >= 0; k--) {
      const sp = ch.spikes[k];
      if ((st.sHint - sp.s) * G.world.trackLen > 200) {
        G.world.root.remove(sp.group);
        ch.spikes.splice(k, 1);
      }
    }
  }
  // bug M5: o empurrão do par podia atravessar a cerca — re-clampa SÓ POSIÇÃO
  // (sem ricochete: o carro foi empurrado, não dirigiu contra o muro).
  for (const c of G.cars) clampToFence(c.st, G.world);
  // NITRO (v0.8.0): regen por substep — 8/s quando não está queimando; ×2
  // depois de 3 s SEGUIDOS em velocidade no acelerador sem colisões (cerca,
  // tráfego ou rival; o ram policial da Fuga não conta — ver playerBump).
  if (G.nitro && racing) {
    const n = G.nitro, st = G.player.st, pIn = G.player.input || { throttle: 0 };
    n.flashT = Math.max(0, n.flashT - dt);
    if (!n.active) {
      const clean = pIn.throttle > 0 && st.v > NITRO.regenMinV && !st.hitWall && !playerBump;
      n.regenT = clean ? n.regenT + dt : 0;
      const rate = n.regenT >= NITRO.regenBoostAfter ? NITRO.regen * 2 : NITRO.regen;
      n.charge = Math.min(100, n.charge + rate * dt);
    }
  }
  // posição na corrida (tráfego civil e polícia não contam)
  const racers = G.cars.filter((c) => !c.isTraffic && !c.isPolice);
  const order = [...racers].sort((a, b) => b.st.progress - a.st.progress);
  G.position = order.indexOf(G.player) + 1;
}

function loop() {
  requestAnimationFrame(loop);
  const now = performance.now();
  // clamp 0,5 s = orçamento MAX_SUB×SUB: sim NUNCA entra em câmera lenta até ~2 fps
  const frameDt = Math.min(0.5, (now - last) / 1000);
  last = now;

  if (G.phase === 'countdown' || G.phase === 'race' || G.phase === 'finished') {
    if (G.phase === 'countdown') {
      G.countdown -= frameDt;
      el('count').textContent = G.countdown > 1 ? Math.ceil(G.countdown - 0.6) : 'GO!';
      el('count').style.display = 'block';
      if (G.countdown <= 0) { G.phase = 'race'; el('count').style.display = 'none'; }
    }
    acc += frameDt;
    let n = 0;
    while (acc >= SUB && n < MAX_SUB) { acc -= SUB; simStep(SUB); n++; }
    if (n === MAX_SUB) acc = 0;             // aba em 2º plano: despeja backlog absurdo

    // visuais por frame (estado mais recente da sim)
    for (const c of G.cars) {
      const input = c.input || { steer: 0 };
      c.mesh.position.copy(c.st.pos);
      c.mesh.rotation.set(0, c.st.heading + Math.PI, 0);
      // pitch de suspensão/lombada + inclinação na curva
      c.mesh.rotation.x = c.st.airborne ? -0.12 : c.st.suspension * 1.4;
      c.mesh.rotation.z = -input.steer * Math.min(0.5, Math.abs(c.st.v) / 60) * 0.12
        + c.st.roll;                                     // capotamento
      if (Math.abs(c.st.roll) > 1.2) c.mesh.position.y = c.st.pos.y + 0.7;
      // rodas: rolagem real (ω = v/r) no pivô do cubo; dianteiras esterçam
      for (const w of c.mesh.userData.wheels) {
        w.pivot.rotation.x += (c.st.v * frameDt) / w.radius;
        if (w.front) w.pivot.rotation.y = input.steer * 0.42; // mesmo sentido do heading
      }
      // WS-5: GIROFLEX da viatura — alterna vermelho/azul a cada 0,2 s (0,4 s)
      const lb = c.mesh.userData.lightbar;
      if (lb) {
        const on = (G.raceT % 0.4) < 0.2;
        lb.red.visible = on;
        lb.blue.visible = !on;
      }
    }
    // NITRO: glow dos escapamentos só enquanto queima
    if (G.nitroGlows) {
      const on = !!(G.nitro && G.nitro.active);
      for (const g of G.nitroGlows) g.visible = on;
    }

    updateCamera(frameDt);
    G.world.update(camera);
    updateHUD();
    renderer.render(G.scene, camera);
  }
}

renderMenu();
toMenu();
loop();
window.__corridaReady = true;
