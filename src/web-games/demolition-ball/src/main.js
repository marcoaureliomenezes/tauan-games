// Demolition Ball — entry point. Wires city, rig, traffic, missions, HUD.

import { Renderer } from './renderer.js';
import { buildCity, StructureIndex, CITY_HALF } from './city.js';
import { DebrisField } from './debris.js';
import { Rig, safeBallPos } from './rig.js';
import { Traffic } from './traffic.js';
import { Pedestrians } from './pedestrians.js';
import { Crew } from './crew.js';
import { MissionSystem } from './missions.js';
import { MODES, DEFAULT_MODE } from './modes.js';
import { Minimap } from './minimap.js';
import { Audio } from './audio.js';
import {
  v3, vadd, vsub, vscale, vlen, vnorm, clamp, lerp, wrapAngle, vaddScaled, vdot,
} from './math.js';

const canvas = document.getElementById('scene');
const mapCanvas = document.getElementById('minimap');
const hud = {
  mission: document.getElementById('mission-title'),
  brief: document.getElementById('mission-brief'),
  bar: document.getElementById('progress-fill'),
  pct: document.getElementById('progress-pct'),
  timer: document.getElementById('timer'),
  money: document.getElementById('money'),
  speed: document.getElementById('speed'),
  rope: document.getElementById('rope'),
  swing: document.getElementById('swing'),
  banner: document.getElementById('banner'),
  bannerText: document.getElementById('banner-text'),
  bannerSub: document.getElementById('banner-sub'),
  stats: document.getElementById('stats'),
  overlay: document.getElementById('start-overlay'),
  targets: document.getElementById('target-list'),
  modeTauan: document.getElementById('mode-tauan'),
  modeContratos: document.getElementById('mode-contratos'),
  crewBtn: document.getElementById('crew-btn'),
};

// ?quality=low trims shadow resolution and draw distance — used by the
// automated tests, which run on a software rasteriser.
const LOW = new URLSearchParams(location.search).get('quality') === 'low';
const DRAW_MAX = LOW ? 240 : 420;      // beyond this, a structure is skipped
const DRAW_DETAIL = LOW ? 110 : 190;   // beyond this, an intact one is a single box

const renderer = new Renderer(canvas, LOW ? { shadowSize: 1024, maxPixelRatio: 1 } : {});
if (LOW) renderer.env.cloudHq = false;   // one snoise octave on software rasterisers
const city = buildCity();
renderer.setStaticMesh(city.staticMesh);

const debris = new DebrisField();
const structureIndex = new StructureIndex(city.structures);
const audio = new Audio();

// Spawn the rig on a road near the middle of town.
const rig = new Rig(-CITY_HALF + 8, -CITY_HALF + 40, 0);
const traffic = new Traffic(34, 77, city.river);
const pedestrians = new Pedestrians(city);
const crew = new Crew();

function callCrew() {
  if (started && crew.call(missions, rig)) audio.chime(true);
}

let collapseEvents = [];
const world = {
  structures: city.structures,
  index: structureIndex,
  debris,
  bounds: { half: CITY_HALF },
  onCollapse: (structure, cells) => { collapseEvents.push({ structure, cells }); },
  river: city.river,
  damageMultiplier: 1,
  homingConfig: null,          // null -> rig.js HOMING_DEFAULT
  homingTarget: null,
};

// Game mode (SPEC v0.9.0 R-01): chosen on the start overlay, locked once the
// game begins. Rebuilding the MissionSystem re-rolls the contract chain, so the
// backdrop contract behind the overlay always matches the selected mode.
let mode = MODES[DEFAULT_MODE];
let missions = null;

function selectMode(id) {
  if (started || !MODES[id]) return;
  mode = MODES[id];
  missions = new MissionSystem(city.structures, 4242, {
    singleTarget: mode.singleTarget,
    thresholdOverride: mode.threshold,
    deadlines: mode.deadlines,
    collateralFines: mode.collateralFines,
  });
  missions.start(simTime);
  world.damageMultiplier = mode.damageMultiplier;
  world.homingConfig = mode.homing;
  hud.modeTauan.classList.toggle('sel', mode.id === 'tauan');
  hud.modeContratos.classList.toggle('sel', mode.id === 'contratos');
}

// The homing servo (R-03, ADR-2) aims at the nearest unfinished contract
// target; with no active target it aims at the nearest car on the street.
world.homingTarget = () => {
  const m = missions && missions.current;
  if (m && !m.done) {
    const th = missions.thresholdOf();
    let best = null;
    let bd = Infinity;
    for (const t of m.targets) {
      if (t.progress >= th) continue;
      const d = Math.hypot(t.center.x - rig.ball.pos.x, t.center.z - rig.ball.pos.z);
      if (d < bd) { bd = d; best = t; }
    }
    if (best) return { x: best.center.x, z: best.center.z };
  }
  let best = null;
  let bd = Infinity;
  for (const c of traffic.aliveCars) {
    const d = Math.hypot(c.pos.x - rig.ball.pos.x, c.pos.z - rig.ball.pos.z);
    if (d < bd) { bd = d; best = c; }
  }
  return best ? { x: best.pos.x, z: best.pos.z } : null;
};

// ---------------------------------------------------------------- input
const keys = new Set();
let started = false;
const camera = {
  position: v3(0, 12, -20),
  target: v3(0, 3, 0),
  fov: (58 * Math.PI) / 180,
  yaw: 0,
  pitch: 0.32,
  distance: 26,
  mode: 'follow',
};
let manualCam = 0;

function begin() {
  if (started) return;
  started = true;
  audio.start();
  audio.resume();
  hud.overlay.classList.add('hidden');
}

window.addEventListener('keydown', (e) => {
  keys.add(e.code);
  begin();
  if (e.code === 'KeyM') minimap.toggle();
  if (e.code === 'KeyV') camera.mode = camera.mode === 'follow' ? 'ball' : 'follow';
  if (e.code === 'KeyN') audio.toggleMute();
  if (e.code === 'KeyC') callCrew();
  if (['Space', 'KeyZ', 'KeyX', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
});
window.addEventListener('keyup', (e) => keys.delete(e.code));
window.addEventListener('blur', () => keys.clear());

let dragging = false;
canvas.addEventListener('mousedown', (e) => { dragging = true; begin(); e.preventDefault(); });
window.addEventListener('mouseup', () => { dragging = false; });
window.addEventListener('mousemove', (e) => {
  if (!dragging) return;
  camera.yaw = wrapAngle(camera.yaw - e.movementX * 0.0042);
  camera.pitch = clamp(camera.pitch + e.movementY * 0.0035, -0.15, 1.15);
  manualCam = 2.5;
});
window.addEventListener('wheel', (e) => {
  camera.distance = clamp(camera.distance + e.deltaY * 0.02, 10, 70);
}, { passive: true });
canvas.addEventListener('click', begin);
hud.modeTauan.addEventListener('click', () => selectMode('tauan'));
hud.modeContratos.addEventListener('click', () => selectMode('contratos'));
hud.crewBtn.addEventListener('click', callCrew);

const minimap = new Minimap(mapCanvas);

function readInput() {
  const k = (c) => (keys.has(c) ? 1 : 0);
  return {
    throttle: k('KeyW') + k('ArrowUp') - k('KeyS') - k('ArrowDown'),
    steer: k('KeyD') + k('ArrowRight') - k('KeyA') - k('ArrowLeft'),
    brake: keys.has('Space') && keys.has('ControlLeft'),
    slew: k('KeyE') - k('KeyQ'),
    pitch: k('KeyR') - k('KeyF'),
    rope: k('KeyX') - k('KeyZ'),
    pump: k('Space') - (keys.has('ShiftLeft') || keys.has('ShiftRight') ? 1 : 0),
  };
}

// ---------------------------------------------------------------- camera
function updateCamera(dt) {
  manualCam = Math.max(0, manualCam - dt);
  if (manualCam <= 0 && camera.mode === 'follow') {
    // Ease back behind the machine when the player stops steering the camera.
    const desired = rig.yaw + Math.PI;
    camera.yaw = wrapAngle(camera.yaw + wrapAngle(desired - camera.yaw) * Math.min(1, 1.6 * dt));
  }

  const focus = camera.mode === 'ball'
    ? vadd(vscale(vadd(rig.ball.pos, rig.pos), 0.5), v3(0, 2.5, 0))
    : vadd(rig.pos, v3(0, 3.4, 0));

  const dist = camera.mode === 'ball' ? camera.distance * 0.9 : camera.distance;
  const cp = Math.cos(camera.pitch);
  const offset = v3(
    Math.sin(camera.yaw) * cp * dist,
    Math.sin(camera.pitch) * dist + 2.5,
    Math.cos(camera.yaw) * cp * dist,
  );
  const wanted = vadd(focus, offset);
  camera.position = {
    x: lerp(camera.position.x, wanted.x, Math.min(1, 9 * dt)),
    y: Math.max(1.6, lerp(camera.position.y, wanted.y, Math.min(1, 9 * dt))),
    z: lerp(camera.position.z, wanted.z, Math.min(1, 9 * dt)),
  };
  camera.target = {
    x: lerp(camera.target.x, focus.x, Math.min(1, 12 * dt)),
    y: lerp(camera.target.y, focus.y, Math.min(1, 12 * dt)),
    z: lerp(camera.target.z, focus.z, Math.min(1, 12 * dt)),
  };
}

// ---------------------------------------------------------------- rendering helpers
const tmpCell = {};

function renderStructures() {
  const cam = camera.target;
  const viewDir = vnorm(vsub(camera.target, camera.position));
  for (const s of city.structures) {
    if (s.destroyed >= s.total) continue;
    const dx = s.center.x - cam.x, dz = s.center.z - cam.z;
    const dist = Math.hypot(dx, dz);
    if (dist > DRAW_MAX) continue;
    // Cheap frustum reject: anything well behind the camera is skipped.
    if (dist > 40) {
      const toS = vnorm(v3(s.center.x - camera.position.x, 0, s.center.z - camera.position.z));
      if (vdot(toS, v3(viewDir.x, 0, viewDir.z)) < -0.35) continue;
    }

    const rough = s.type === 'skyscraper' ? 0.28 : 0.72;

    // Far away and untouched: one box instead of hundreds of cells.
    if (dist > DRAW_DETAIL && s.destroyed === 0) {
      renderer.pushBox(
        v3(s.center.x, s.size.y / 2, s.center.z),
        v3(s.size.x / 2, s.size.y / 2, s.size.z / 2),
        { x: 0, y: 0, z: 0, w: 1 }, s.color, rough, 0, s.styleId,
      );
      continue;
    }

    if (s.dirty) s.rebuildShell();
    const halfCell = s.cell * 0.5;
    const half = v3(halfCell, halfCell, halfCell);
    for (const i of s.shell) {
      const c = s.cellCoords(i);
      s.cellCenter(c.x, c.y, c.z, tmpCell);
      const isRoof = c.y === s.ny - 1;
      renderer.pushBox(
        tmpCell, half, { x: 0, y: 0, z: 0, w: 1 },
        isRoof ? s.roofColor : s.color,
        isRoof ? 0.8 : rough,
        clamp(s.damage[i], 0, 1),
        isRoof ? 0 : s.styleId,
      );
    }
  }
}

const IQ = { x: 0, y: 0, z: 0, w: 1 };

function renderTree(p) {
  const v = p.variant || 0;
  if (v === 1) {
    // Conifer: stacked shrinking canopies.
    renderer.pushCylinder(v3(p.x, p.h * 0.28, p.z), 0.24, p.h * 0.28, IQ, [0.30, 0.21, 0.13], 0.9);
    for (let i = 0; i < 3; i++) {
      renderer.pushSphere(v3(p.x, p.h * (0.52 + 0.24 * i), p.z), p.h * (0.34 - 0.09 * i), IQ, [0.13, 0.30, 0.15], 0.9);
    }
  } else if (v === 2) {
    // Tall and slim: high trunk, small offset crowns.
    renderer.pushCylinder(v3(p.x, p.h * 0.5, p.z), 0.20, p.h * 0.5, IQ, [0.34, 0.26, 0.16], 0.9);
    renderer.pushSphere(v3(p.x, p.h * 1.04, p.z), p.h * 0.30, IQ, [0.24, 0.40, 0.17], 0.9);
    renderer.pushSphere(v3(p.x + p.h * 0.14, p.h * 0.90, p.z - p.h * 0.10), p.h * 0.20, IQ, [0.20, 0.35, 0.14], 0.9);
  } else {
    // Classic round crown.
    renderer.pushCylinder(v3(p.x, p.h * 0.35, p.z), 0.28, p.h * 0.35, IQ, [0.28, 0.20, 0.13], 0.9);
    renderer.pushSphere(v3(p.x, p.h * 0.82, p.z), p.h * 0.42, IQ, [0.20, 0.36, 0.16], 0.9);
  }
}

function renderProps() {
  const cam = camera.target;
  for (const p of city.props) {
    const d = Math.hypot(p.x - cam.x, p.z - cam.z);
    if (d > DRAW_DETAIL) continue;
    if (p.kind === 'tree') {
      renderTree(p);
    } else if (p.kind === 'flowerbed') {
      // Planter box + a spray of coloured flower dots (R-06).
      renderer.pushBox(v3(p.x, 0.42, p.z), v3(1.5, 0.32, 1.5), IQ, city.palette.planter, 0.85);
      renderer.pushBox(v3(p.x, 0.62, p.z), v3(1.3, 0.12, 1.3), IQ, [0.23, 0.16, 0.11], 0.95);
      for (const [ox, oz] of [[-0.7, -0.6], [0.6, -0.5], [-0.4, 0.7], [0.7, 0.6], [0.0, 0.05]]) {
        renderer.pushSphere(v3(p.x + ox, 0.86, p.z + oz), 0.20, IQ, p.color, 0.7);
      }
    } else {
      renderer.pushCylinder(v3(p.x, p.h / 2, p.z), 0.11, p.h / 2, IQ, [0.28, 0.29, 0.31], 0.5);
      renderer.pushBox(v3(p.x, p.h, p.z), v3(0.34, 0.14, 0.55), IQ, [0.85, 0.83, 0.7], 0.3);
    }
  }
}

let beaconPhase = 0;
function renderBeacon(dt) {
  const wp = missions.waypoint;
  if (!wp) return;
  beaconPhase += dt;
  const d = Math.hypot(wp.x - rig.pos.x, wp.z - rig.pos.z);
  const alphaBase = clamp((d - 12) / 40, 0, 1) * 0.5;
  for (let i = 0; i < 16; i++) {
    const y = 4 + i * 5.5;
    const wobble = 0.75 + 0.25 * Math.sin(beaconPhase * 3 - i * 0.4);
    renderer.pushParticle(v3(wp.x, y, wp.z), 2.6 * wobble, [1.0, 0.42, 0.18], alphaBase * (1 - i / 20));
  }
}

// ---------------------------------------------------------------- HUD
let hudClock = 0;
function updateHud(now, dt, fps) {
  hudClock += dt;
  const m = missions.current;
  if (m) {
    hud.mission.textContent = m.spec.title;
    hud.brief.textContent = m.spec.brief;
    const pct = Math.round(missions.progress * 100);
    hud.bar.style.width = `${pct}%`;
    hud.pct.textContent = `${pct}%`;
    const tl = missions.timeLeft(now);
    if (tl === null) {
      hud.timer.textContent = '--:--';
      hud.timer.classList.remove('urgent');
    } else {
      const mm = Math.floor(tl / 60);
      const ss = Math.floor(tl % 60);
      hud.timer.textContent = `${mm}:${String(ss).padStart(2, '0')}`;
      hud.timer.classList.toggle('urgent', tl < 30);
    }
    let list = '';
    for (const t of m.targets) {
      const p = Math.round(t.progress * 100);
      const ok = t.progress >= m.spec.threshold;
      list += `<li class="${ok ? 'ok' : ''}"><span>${t.name}</span><b>${p}%</b></li>`;
    }
    hud.targets.innerHTML = list;
  } else if (missions.allDone) {
    hud.mission.textContent = 'Serviço concluído';
    hud.brief.textContent = 'Nenhum contrato pendente.';
  }

  hud.money.textContent = `$${missions.money.toLocaleString('pt-BR')}`;
  hud.speed.textContent = `${Math.abs(rig.speed * 3.6).toFixed(0)} km/h`;
  hud.rope.textContent = `${rig.ropeLen.toFixed(1)} m`;
  const swing = vlen(rig.ball.vel);
  hud.swing.textContent = `${swing.toFixed(1)} m/s`;
  hud.swing.className = swing > 11 ? 'value hot' : 'value';

  // Crew button (R-11): big and friendly, only when the crew can actually come.
  hud.crewBtn.classList.toggle('hidden', !(started && crew.available(missions, rig)));

  if (missions.banner && now < missions.banner.until) {
    hud.banner.classList.add('show');
    hud.bannerText.textContent = missions.banner.text;
    hud.bannerSub.textContent = missions.banner.sub;
  } else {
    hud.banner.classList.remove('show');
  }

  if (hudClock > 0.25) {
    hudClock = 0;
    const st = renderer.stats();
    const dc = debris.counts;
    hud.stats.textContent =
      `${fps.toFixed(0)} fps · ${st.boxes} blocos · ${dc.chunks} escombros · ${dc.dust} partículas · ${st.drawCalls} draws`;
  }
}

// ---------------------------------------------------------------- loop
let last = performance.now();
let simTime = 0;
let fps = 60;
let frames = 0;

function frame(nowMs) {
  const rawDt = Math.min((nowMs - last) / 1000, 0.05);
  last = nowMs;
  const dt = rawDt;
  simTime += dt;
  frames++;
  fps = lerp(fps, 1 / Math.max(rawDt, 0.0001), 0.08);

  const input = started ? readInput() : { throttle: 0, steer: 0, brake: false, slew: 0, pitch: 0, rope: 0, pump: 0 };

  // Physics runs in fixed sub-steps: the pendulum constraint stays stable
  // regardless of frame rate.
  const steps = clamp(Math.ceil(dt / 0.0125), 1, 5);
  const sub = dt / steps;
  for (let i = 0; i < steps; i++) rig.update(sub, input, world);

  traffic.update(dt, rig, debris);
  pedestrians.update(dt, rig, world);
  crew.update(dt, missions, traffic);
  debris.update(dt);

  for (const ev of rig.drainImpacts()) {
    audio.impact(ev.energy, ev.killed);
    missions.registerDamage(ev.structure, ev.killed);
  }
  if (collapseEvents.length) {
    let total = 0;
    for (const c of collapseEvents) { total += c.cells; missions.registerDamage(c.structure, c.cells); }
    audio.collapse(total);
    collapseEvents = [];
  }

  const wasDone = missions.current ? missions.current.done : false;
  missions.update(simTime);
  if (missions.current && missions.current.done && !wasDone) {
    audio.chime(!missions.current.failed);
  }
  missions.tickChain(simTime);

  audio.setEngine(rig.speed, input.throttle);
  updateCamera(dt);

  renderer.env.time = simTime;
  renderer.beginFrame();
  renderStructures();
  renderProps();
  traffic.render(renderer);
  pedestrians.render(renderer, camera.target, DRAW_DETAIL);
  crew.render(renderer, camera.target, DRAW_MAX);
  rig.render(renderer, city.palette);
  debris.render(renderer);
  renderBeacon(dt);
  renderer.render(camera);

  minimap.draw(world, rig, missions, traffic, dt);
  updateHud(simTime, dt, fps);

  requestAnimationFrame(frame);
}

selectMode(DEFAULT_MODE);
requestAnimationFrame(frame);

// Test/debug surface: deterministic seed makes these values stable per build.
window.__demolition = {
  get frames() { return frames; },
  get simTime() { return simTime; },
  get mode() { return mode; },
  get missions() { return missions; },
  rig, world, city, debris, traffic, pedestrians, crew, renderer, camera, minimap,
  callCrew,
  press: (code) => keys.add(code),
  release: (code) => keys.delete(code),
  begin,
  selectMode: (id) => selectMode(id),
  totalProgress() {
    let t = 0, d = 0;
    for (const s of city.structures) { t += s.total; d += s.destroyed; }
    return d / t;
  },
  /**
   * Park the rig beside a structure, aim the boom at it and fling the ball into
   * the wall — a scripted swing, used by the automated tests. The ball is kept
   * inside the rope length, otherwise the constraint would just yank it back.
   */
  teleportBallTo(structure, offsetY = 6) {
    rig.pos.x = structure.center.x + structure.size.x / 2 + 13;
    rig.pos.z = structure.center.z;
    rig.yaw = -Math.PI / 2;          // forward = -X, i.e. facing the structure
    rig.turretYaw = 0;
    rig.boomPitch = 0.5;
    rig.ropeLen = 16;
    rig.computeTip();

    const wallX = structure.center.x + structure.size.x / 2 + rig.ball.radius * 0.8;
    const target = v3(wallX, Math.min(structure.size.y * 0.45 + offsetY, rig.tip.y - 1.5), structure.center.z);
    const rel = vsub(target, rig.tip);
    const d = vlen(rel);
    rig.ball.pos = safeBallPos(d > rig.ropeLen ? vaddScaled(rig.tip, vscale(rel, 1 / d), rig.ropeLen) : target, rig.ball.radius, world);
    rig.ball.vel = v3(-17, -3, 0);
  },
};

window.addEventListener('resize', () => renderer.resize());
export { rig, missions, city };
