import { PointerLockControls } from '../../../vendor/jsm/controls/PointerLockControls.js';

const MOVEMENT_KEYS = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ShiftLeft', 'ShiftRight', 'KeyC']);

export function createInput(camera, domElement, onPause) {
  const controls = new PointerLockControls(camera, domElement);
  const held = new Set();
  const pressed = new Set();
  let firing = false;
  let aiming = false;
  let lookX = 0;
  let lookY = 0;

  controls.pointerSpeed = 0.78;
  controls.minPolarAngle = Math.PI * 0.08;
  controls.maxPolarAngle = Math.PI * 0.92;

  function clearAll() {
    held.clear();
    firing = false;
    aiming = false;
  }

  const keyDown = (event) => {
    if (MOVEMENT_KEYS.has(event.code)) event.preventDefault();
    if (!held.has(event.code)) pressed.add(event.code);
    held.add(event.code);
  };
  const keyUp = (event) => held.delete(event.code);
  const mouseDown = (event) => {
    if (!controls.isLocked) return;
    if (event.button === 0) firing = true;
    if (event.button === 2) aiming = true;
  };
  const mouseUp = (event) => {
    if (event.button === 0) firing = false;
    if (event.button === 2) aiming = false;
  };
  const mouseMove = (event) => {
    if (!controls.isLocked) return;
    lookX += event.movementX || 0;
    lookY += event.movementY || 0;
  };
  const wheel = (event) => pressed.add(event.deltaY > 0 ? 'WheelDown' : 'WheelUp');

  document.addEventListener('keydown', keyDown);
  document.addEventListener('keyup', keyUp);
  document.addEventListener('mousedown', mouseDown);
  document.addEventListener('mouseup', mouseUp);
  document.addEventListener('mousemove', mouseMove);
  document.addEventListener('wheel', wheel, { passive: true });
  document.addEventListener('contextmenu', (event) => event.preventDefault());
  addEventListener('blur', clearAll);
  document.addEventListener('visibilitychange', () => { if (document.hidden) clearAll(); });
  controls.addEventListener('unlock', () => {
    clearAll();
    onPause();
  });

  return {
    controls,
    held: (code) => held.has(code),
    consume(code) {
      if (!pressed.has(code)) return false;
      pressed.delete(code);
      return true;
    },
    consumeLook() {
      const delta = { x: lookX, y: lookY };
      lookX = 0;
      lookY = 0;
      return delta;
    },
    get firing() { return firing; },
    get aiming() { return aiming; },
    lock: () => controls.lock(),
    dispose() {
      controls.dispose();
      document.removeEventListener('keydown', keyDown);
      document.removeEventListener('keyup', keyUp);
      document.removeEventListener('mousedown', mouseDown);
      document.removeEventListener('mouseup', mouseUp);
      document.removeEventListener('mousemove', mouseMove);
      document.removeEventListener('wheel', wheel);
      removeEventListener('blur', clearAll);
    },
  };
}
