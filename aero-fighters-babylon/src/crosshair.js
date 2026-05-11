// crosshair.js — Mira SVG + lock-on de missil.
// Exporta: createCrosshair, updateCrosshair, missileLockedTarget.

/* global BABYLON */

import { game } from './state.js';
import { audio } from './audio.js';

const LOCK_HALF_ANGLE_DEG = 15;
const LOCK_HALF_ANGLE_COS = Math.cos((LOCK_HALF_ANGLE_DEG * Math.PI) / 180);
const LOCK_MAX_RANGE = 1600;
const LOCK_REQUIRED_TIME = 0.35;
const BEEP_INTERVAL_SEEK = 0.45;
const BEEP_INTERVAL_LOCKED = 0.12;

let svgRoot = null;
let missileReticle = null;
let lockTextEl = null;
let cannonGroup = null;

const lock = {
  target: null,
  inConeTime: 0,
  beepTimer: 0,
  locked: false,
};

const _fwd = new BABYLON.Vector3();
const _toTarget = new BABYLON.Vector3();

export function createCrosshair() {
  const ns = 'http://www.w3.org/2000/svg';
  svgRoot = document.createElementNS(ns, 'svg');
  svgRoot.setAttribute('id', 'crosshair');
  svgRoot.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:5;';

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

  lockTextEl = document.createElementNS(ns, 'text');
  lockTextEl.setAttribute('text-anchor', 'middle');
  lockTextEl.setAttribute('fill', '#ffcc44');
  lockTextEl.setAttribute('font-family', 'monospace');
  lockTextEl.setAttribute('font-size', '14');
  lockTextEl.setAttribute('font-weight', 'bold');
  lockTextEl.style.display = 'none';
  svgRoot.appendChild(lockTextEl);

  document.body.appendChild(svgRoot);
  recenter();
  window.addEventListener('resize', recenter);
}

function recenter() {
  const cx = window.innerWidth / 2;
  const cy = window.innerHeight / 2;
  if (cannonGroup) cannonGroup.setAttribute('transform', 'translate(' + cx + ', ' + cy + ')');
  if (lockTextEl) { lockTextEl.setAttribute('x', cx); lockTextEl.setAttribute('y', cy + 60); }
}

export function missileLockedTarget() {
  return lock.locked && lock.target && !lock.target.dead ? lock.target : null;
}

export function updateCrosshair(dt, babylonCamera, jetPos, jetQuat) {
  if (!game.running) {
    if (missileReticle) missileReticle.style.display = 'none';
    if (lockTextEl) lockTextEl.style.display = 'none';
    lock.target = null; lock.inConeTime = 0; lock.locked = false;
    return;
  }

  // Forward do jato
  const _fwdNew = new BABYLON.Vector3(0, 0, -1).applyRotationQuaternion(jetQuat);
  _fwd.copyFrom(_fwdNew);

  let best = null;
  let bestScore = Infinity;
  const maxR2 = LOCK_MAX_RANGE * LOCK_MAX_RANGE;
  for (const t of game.targets) {
    if (t.dead) continue;
    _toTarget.copyFrom(t.mesh.position).subtractInPlace(jetPos);
    const d2 = _toTarget.lengthSquared();
    if (d2 > maxR2) continue;
    _toTarget.normalize();
    const cosAngle = BABYLON.Vector3.Dot(_toTarget, _fwd);
    if (cosAngle < LOCK_HALF_ANGLE_COS) continue;
    const score = d2 / cosAngle;
    if (score < bestScore) { bestScore = score; best = t; }
  }

  if (best !== lock.target) {
    lock.target = best; lock.inConeTime = 0; lock.locked = false;
  }

  if (lock.target) {
    lock.inConeTime += dt;
    if (lock.inConeTime >= LOCK_REQUIRED_TIME) lock.locked = true;

    // Projetar posicao 3D em coordenadas de tela
    const targetPos3D = lock.target.mesh.position;
    // Projecao: world -> view -> clip -> NDC -> screen
    const viewMatrix = babylonCamera.getViewMatrix();
    const projMatrix = babylonCamera.getProjectionMatrix();
    const vp = BABYLON.Vector3.TransformCoordinates(targetPos3D, viewMatrix);
    // vp.z < 0 significa na frente da camera (view space z-negativo = frente)
    const visible = vp.z < 0;

    let screenX = 0, screenY = 0;
    if (visible) {
      const clip = BABYLON.Vector3.TransformCoordinates(vp, projMatrix);
      screenX = (clip.x * 0.5 + 0.5) * window.innerWidth;
      screenY = (-clip.y * 0.5 + 0.5) * window.innerHeight;
    }

    if (visible) {
      if (missileReticle) {
        missileReticle.style.display = '';
        missileReticle.setAttribute('transform', 'translate(' + screenX + ', ' + screenY + ')');
        const box = missileReticle.querySelector('#missile-target-box');
        if (box) {
          const col = lock.locked ? '#ff3333' : '#ffcc44';
          box.querySelector('rect').setAttribute('stroke', col);
          box.querySelector('rect').setAttribute('stroke-dasharray', lock.locked ? '' : '8 4');
          box.querySelectorAll('line').forEach(ln => ln.setAttribute('stroke', col));
        }
      }
      if (lockTextEl) {
        lockTextEl.style.display = '';
        lockTextEl.textContent = lock.locked ? '◉ LOCKED' : '◌ ' + (Math.round((LOCK_REQUIRED_TIME - lock.inConeTime) * 100) / 100) + 's';
        lockTextEl.setAttribute('fill', lock.locked ? '#ff3333' : '#ffcc44');
      }
    } else {
      if (missileReticle) missileReticle.style.display = 'none';
      if (lockTextEl) lockTextEl.style.display = 'none';
    }

    lock.beepTimer -= dt;
    if (lock.beepTimer <= 0) {
      lock.beepTimer = lock.locked ? BEEP_INTERVAL_LOCKED : BEEP_INTERVAL_SEEK;
      audio.lockBeep(lock.locked);
    }
  } else {
    if (missileReticle) missileReticle.style.display = 'none';
    if (lockTextEl) lockTextEl.style.display = 'none';
    lock.inConeTime = 0; lock.locked = false;
  }
}
