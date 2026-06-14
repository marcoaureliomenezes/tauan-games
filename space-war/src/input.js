// input.js — Teclado + mouse (pointer-lock) para voo 6-DOF.

import { renderer } from './scene.js';

export const input = {
  throttleUp: false, throttleDown: false, boost: false,
  pitchUp: false, pitchDown: false, yawLeft: false, yawRight: false,
  rollLeft: false, rollRight: false,
  fire: false, brake: false,
  mouseDX: 0, mouseDY: 0, pointerLocked: false,
};

const listeners = { nuke: [], map: [], pause: [], start: [], target: [], align: [], targetPrev: [] };
export function onAction(name, fn) { listeners[name]?.push(fn); }
function emit(name) { for (const fn of (listeners[name] || [])) fn(); }

const DOWN = {
  KeyW: 'throttleUp', KeyS: 'throttleDown',
  ArrowUp: 'pitchUp', ArrowDown: 'pitchDown',
  ArrowLeft: 'yawLeft', ArrowRight: 'yawRight',
  KeyA: 'rollLeft', KeyD: 'rollRight',
  ShiftLeft: 'boost', ShiftRight: 'boost',
  Space: 'fire',
  KeyX: 'brake',
};

export function installListeners() {
  window.addEventListener('keydown', (e) => {
    if (DOWN[e.code]) { input[DOWN[e.code]] = true; if (e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault(); }
    if (e.code === 'KeyF') emit('nuke');
    if (e.code === 'KeyM') emit('map');
    if (e.code === 'KeyP') emit('pause');
    if (e.code === 'KeyT') emit(e.shiftKey ? 'targetPrev' : 'target');
    if (e.code === 'KeyC') emit('align');
    if (e.code === 'Enter') emit('start');
  });
  window.addEventListener('keyup', (e) => { if (DOWN[e.code]) input[DOWN[e.code]] = false; });

  // Pointer lock para pilotar com o mouse.
  const cv = renderer.domElement;
  cv.addEventListener('click', () => { if (!input.pointerLocked) cv.requestPointerLock?.(); });
  document.addEventListener('pointerlockchange', () => { input.pointerLocked = document.pointerLockElement === cv; });
  document.addEventListener('mousemove', (e) => {
    if (!input.pointerLocked) return;
    input.mouseDX += e.movementX; input.mouseDY += e.movementY;
  });
  document.addEventListener('mousedown', (e) => { if (input.pointerLocked && e.button === 0) input.fire = true; });
  document.addEventListener('mouseup', (e) => { if (e.button === 0) input.fire = false; });
}

// Consome (zera) o delta do mouse acumulado no frame.
export function consumeMouse() {
  const dx = input.mouseDX, dy = input.mouseDY;
  input.mouseDX = 0; input.mouseDY = 0;
  return { dx, dy };
}
