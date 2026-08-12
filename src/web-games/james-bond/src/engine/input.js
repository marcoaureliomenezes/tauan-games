import * as THREE from '../../../vendor/three.module.min.js';
import { PointerLockControls } from '../../../vendor/jsm/controls/PointerLockControls.js';
import { KIDS, LOOK, SENSITIVITY, clampSensitivity } from '../config.js';

const MOVEMENT_KEYS = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ShiftLeft', 'ShiftRight', 'KeyC', 'Space']);

export function createInput(camera, domElement, onPause) {
  const controls = new PointerLockControls(camera, domElement);
  const held = new Set();
  const pressed = new Set();
  let firing = false;
  let aiming = false;
  let lookX = 0;
  let lookY = 0;

  controls.minPolarAngle = LOOK.minPolarAngle;
  controls.maxPolarAngle = LOOK.maxPolarAngle;

  // O ângulo polar do PointerLockControls é medido a partir do +Y: a horizontal
  // é PI/2. O modo criança aperta esse intervalo em torno da horizontal e
  // deixa o mouse mais lento.
  let kidsMode = false;
  // Sensibilidade (F1): multiplicador do jogador POR CIMA do pointerSpeed base
  // de cada modo — nunca substitui o base, senão o modo criança perderia a
  // lentidão própria dele assim que o jogador tocasse o slider.
  let sensitivity = SENSITIVITY.default;
  function applyPointerSpeed() {
    controls.pointerSpeed = (kidsMode ? KIDS.pointerSpeed : LOOK.pointerSpeed) * sensitivity;
  }
  function setKidsMode(enabled) {
    kidsMode = Boolean(enabled);
    if (kidsMode) {
      controls.minPolarAngle = Math.PI / 2 - KIDS.pitchUpDeg * Math.PI / 180;
      controls.maxPolarAngle = Math.PI / 2 + KIDS.pitchDownDeg * Math.PI / 180;
    } else {
      controls.minPolarAngle = LOOK.minPolarAngle;
      controls.maxPolarAngle = LOOK.maxPolarAngle;
    }
    applyPointerSpeed();
    // Reaplica o clamp imediatamente, senão a câmera só volta ao cone no
    // próximo movimento do mouse (fica olhando para o céu até o jogador mexer).
    clampPitchNow();
  }
  function setSensitivity(value) {
    sensitivity = clampSensitivity(value);
    applyPointerSpeed();
  }
  applyPointerSpeed();

  const _euler = new THREE.Euler(0, 0, 0, 'YXZ');
  function clampPitchNow() {
    _euler.setFromQuaternion(camera.quaternion);
    const polar = Math.PI / 2 - _euler.x;
    const clamped = Math.min(controls.maxPolarAngle, Math.max(controls.minPolarAngle, polar));
    if (clamped === polar) return;
    _euler.x = Math.PI / 2 - clamped;
    camera.quaternion.setFromEuler(_euler);
  }

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
    // Seam de TESTE: puxa/solta o gatilho pela MESMA flag que o mousedown
    // real seta. Existe porque `page.mouse.down()` sob pointer lock injeta um
    // delta de movimento espúrio junto com o clique (Chromium sintetiza
    // movementX/Y do salto até o centro travado), arrancando a mira do alvo
    // no mesmo evento que dispara — um mouse físico não faz isso.
    setFiring(value) { firing = Boolean(value); },
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
    get kidsMode() { return kidsMode; },
    get sensitivity() { return sensitivity; },
    setKidsMode,
    setSensitivity,
    clampPitch: clampPitchNow,
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
