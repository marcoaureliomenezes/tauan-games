// crosshair.js — Mira do canhão (fixa) + reticle do míssil (móvel) + lock-on.
// Exporta: createCrosshair(), updateCrosshair(dt), missileLockedTarget().
// Visual: SVG overlay sobre o canvas. Lock-on usa cone frontal ±15° + beep escalando.

import * as THREE from '../../vendor/three.module.min.js';
import { game } from './state.js';
import { audio } from './audio.js';

const LOCK_HALF_ANGLE_DEG = 15;                                    // ±15° cone
const LOCK_HALF_ANGLE_COS = Math.cos((LOCK_HALF_ANGLE_DEG * Math.PI) / 180);
const LOCK_MAX_RANGE = 1600;                                       // m
const LOCK_REQUIRED_TIME = 0.35;                                   // s segurando no cone p/ travar
const BEEP_INTERVAL_SEEK = 0.45;
const BEEP_INTERVAL_LOCKED = 0.12;

let svgRoot = null;
let cannonReticle = null;
let missileReticle = null;
let lockedTargetIndicator = null;
let cannonGroup = null;            // <g> centralizado via translate(cx, cy)
let lockTextEl = null;

const lock = {
  target: null,
  inConeTime: 0,
  beepTimer: 0,
  locked: false,
};

const _fwd = new THREE.Vector3();
const _toTarget = new THREE.Vector3();

/** Cria a sobreposição SVG na DOM. Chamar uma vez no boot. */
export function createCrosshair() {
  const ns = 'http://www.w3.org/2000/svg';
  svgRoot = document.createElementNS(ns, 'svg');
  svgRoot.setAttribute('id', 'crosshair');
  svgRoot.style.position = 'fixed';
  svgRoot.style.top = '0';
  svgRoot.style.left = '0';
  svgRoot.style.width = '100%';
  svgRoot.style.height = '100%';
  svgRoot.style.pointerEvents = 'none';
  svgRoot.style.zIndex = '5';

  // Mira do canhão: <g> centralizado por translate (atualizado em resize)
  cannonGroup = document.createElementNS(ns, 'g');
  cannonGroup.setAttribute('id', 'cannon-reticle');
  cannonGroup.innerHTML = `
    <circle cx="0" cy="0" r="14" fill="none" stroke="#ffffff" stroke-width="1.5" stroke-opacity="0.85" />
    <circle cx="0" cy="0" r="3" fill="#ffffff" fill-opacity="0.9" />
    <line x1="0" y1="-22" x2="0" y2="-14" stroke="#ffffff" stroke-width="1.5" stroke-opacity="0.85" />
    <line x1="0" y1="14"  x2="0" y2="22"  stroke="#ffffff" stroke-width="1.5" stroke-opacity="0.85" />
    <line x1="-22" y1="0" x2="-14" y2="0" stroke="#ffffff" stroke-width="1.5" stroke-opacity="0.85" />
    <line x1="14"  y1="0" x2="22"  y2="0" stroke="#ffffff" stroke-width="1.5" stroke-opacity="0.85" />
  `;
  svgRoot.appendChild(cannonGroup);
  cannonReticle = cannonGroup;

  // Reticle do míssil (móvel, segue alvo no cone)
  missileReticle = document.createElementNS(ns, 'g');
  missileReticle.setAttribute('id', 'missile-reticle');
  missileReticle.style.display = 'none';
  missileReticle.innerHTML = `
    <g id="missile-target-box">
      <rect x="-26" y="-26" width="52" height="52" fill="none" stroke="#ffcc44" stroke-width="2" stroke-dasharray="8 4"/>
      <line x1="-32" y1="0" x2="-22" y2="0" stroke="#ffcc44" stroke-width="2"/>
      <line x1="22" y1="0" x2="32" y2="0" stroke="#ffcc44" stroke-width="2"/>
      <line x1="0" y1="-32" x2="0" y2="-22" stroke="#ffcc44" stroke-width="2"/>
      <line x1="0" y1="22" x2="0" y2="32" stroke="#ffcc44" stroke-width="2"/>
    </g>
  `;
  svgRoot.appendChild(missileReticle);

  // Indicador LOCKED — texto posicionado dinamicamente via JS
  lockTextEl = document.createElementNS(ns, 'text');
  lockTextEl.setAttribute('id', 'lock-status');
  lockTextEl.setAttribute('text-anchor', 'middle');
  lockTextEl.setAttribute('fill', '#ffcc44');
  lockTextEl.setAttribute('font-family', 'monospace');
  lockTextEl.setAttribute('font-size', '14');
  lockTextEl.setAttribute('font-weight', 'bold');
  lockTextEl.style.display = 'none';
  svgRoot.appendChild(lockTextEl);
  lockedTargetIndicator = lockTextEl;

  document.body.appendChild(svgRoot);
  recenter();
  window.addEventListener('resize', recenter);
}

function recenter() {
  const cx = window.innerWidth / 2;
  const cy = window.innerHeight / 2;
  if (cannonGroup) cannonGroup.setAttribute('transform', `translate(${cx}, ${cy})`);
  if (lockTextEl) { lockTextEl.setAttribute('x', cx); lockTextEl.setAttribute('y', cy + 60); }
}

/** Retorna o alvo travado (ou null). Chamado por fireMissile(). */
export function missileLockedTarget() {
  return lock.locked && lock.target && !lock.target.dead ? lock.target : null;
}

/** Atualiza o reticle a cada frame. @param dt segundos @param camera @param jetPos @param jetQuat */
export function updateCrosshair(dt, camera, jetPos, jetQuat) {
  if (!game.running) {
    missileReticle.style.display = 'none';
    lockedTargetIndicator.style.display = 'none';
    lock.target = null; lock.inConeTime = 0; lock.locked = false;
    return;
  }

  // Encontra o alvo mais próximo+central dentro do cone frontal ±15°
  _fwd.set(0, 0, -1).applyQuaternion(jetQuat);
  let best = null;
  let bestScore = Infinity;
  const maxR2 = LOCK_MAX_RANGE * LOCK_MAX_RANGE;
  for (const t of game.targets) {
    if (t.dead) continue;
    _toTarget.subVectors(t.mesh.position, jetPos);
    const d2 = _toTarget.lengthSq();
    if (d2 > maxR2) continue;
    _toTarget.normalize();
    const cosAngle = _toTarget.dot(_fwd);
    if (cosAngle < LOCK_HALF_ANGLE_COS) continue;
    // score: menor = melhor; combina proximidade com centralidade
    const score = d2 / cosAngle;
    if (score < bestScore) { bestScore = score; best = t; }
  }

  if (best !== lock.target) {
    lock.target = best;
    lock.inConeTime = 0;
    lock.locked = false;
  }

  if (lock.target) {
    lock.inConeTime += dt;
    if (lock.inConeTime >= LOCK_REQUIRED_TIME) lock.locked = true;

    // Projeta posição 3D do alvo em coordenadas de tela
    _toTarget.copy(lock.target.mesh.position).project(camera);
    const visible = _toTarget.z < 1;
    const screenX = (_toTarget.x * 0.5 + 0.5) * window.innerWidth;
    const screenY = (-_toTarget.y * 0.5 + 0.5) * window.innerHeight;

    if (visible) {
      missileReticle.style.display = '';
      missileReticle.setAttribute('transform', `translate(${screenX}, ${screenY})`);
      const box = missileReticle.querySelector('#missile-target-box');
      if (box) {
        box.querySelector('rect').setAttribute('stroke', lock.locked ? '#ff3333' : '#ffcc44');
        box.querySelector('rect').setAttribute('stroke-dasharray', lock.locked ? '' : '8 4');
        box.querySelectorAll('line').forEach((ln) => ln.setAttribute('stroke', lock.locked ? '#ff3333' : '#ffcc44'));
      }
      lockedTargetIndicator.style.display = '';
      lockedTargetIndicator.textContent = lock.locked ? '◉ LOCKED' : `◌ ${Math.round((LOCK_REQUIRED_TIME - lock.inConeTime) * 100) / 100}s`;
      lockedTargetIndicator.setAttribute('fill', lock.locked ? '#ff3333' : '#ffcc44');
    } else {
      missileReticle.style.display = 'none';
      lockedTargetIndicator.style.display = 'none';
    }

    // Beep
    lock.beepTimer -= dt;
    if (lock.beepTimer <= 0) {
      lock.beepTimer = lock.locked ? BEEP_INTERVAL_LOCKED : BEEP_INTERVAL_SEEK;
      audio.lockBeep(lock.locked);
    }
  } else {
    missileReticle.style.display = 'none';
    lockedTargetIndicator.style.display = 'none';
    lock.inConeTime = 0;
    lock.locked = false;
  }
}
