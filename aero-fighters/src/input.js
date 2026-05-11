// input.js — Traduz teclado em flags semânticas. Não conhece áudio, HUD ou three.js.
// Exporta: input (objeto com flags), installListeners, onAction (registrar handler de evento discreto).
// Para adicionar uma tecla: adicione no mapa KEY_FLAGS (contínuo) ou KEY_ACTIONS (evento).

/** Flags contínuas atualizadas a cada frame (lidas por updatePlayer). */
export const input = {
  pitchUp: false,
  pitchDown: false,
  rollLeft: false,
  rollRight: false,
  yawLeft: false,
  yawRight: false,
  throttleUp: false,
  throttleDown: false,
  fireHeld: false,        // tiro contínuo (Space/Z segurado)
};

/** Mapa código de tecla → nome da flag em `input`. */
const KEY_FLAGS = {
  ArrowUp:    'pitchUp',
  KeyI:       'pitchUp',
  ArrowDown:  'pitchDown',
  KeyK:       'pitchDown',
  ArrowLeft:  'rollLeft',
  KeyA:       'rollLeft',
  ArrowRight: 'rollRight',
  KeyD:       'rollRight',
  KeyQ:       'yawLeft',
  KeyE:       'yawRight',
  KeyW:       'throttleUp',
  KeyS:       'throttleDown',
  Space:      'fireHeld',
  KeyZ:       'fireHeld',
};

/** Mapa código de tecla → nome de ação discreta (disparada uma vez por keydown). */
const KEY_ACTIONS = {
  Space:        'fire',
  KeyZ:         'fire',
  KeyX:         'missile',
  KeyB:         'heavyMissile',
  KeyN:         'nuclearMissile',
  ShiftLeft:    'roll',
  ShiftRight:   'roll',
  Enter:        'start',
  Escape:       'pause',
  KeyP:         'pause',
  KeyM:         'mute',
};

const actionHandlers = Object.create(null);

/** Registra um callback para uma ação discreta. */
export function onAction(name, fn) {
  if (!actionHandlers[name]) actionHandlers[name] = [];
  actionHandlers[name].push(fn);
}

/** Instala listeners de keyboard. Chamar uma vez no boot. */
export function installListeners() {
  window.addEventListener('keydown', (e) => {
    const flag = KEY_FLAGS[e.code];
    if (flag) input[flag] = true;
    const action = KEY_ACTIONS[e.code];
    if (action && actionHandlers[action]) {
      for (const h of actionHandlers[action]) h(e);
    }
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
  });
  window.addEventListener('keyup', (e) => {
    const flag = KEY_FLAGS[e.code];
    if (flag) input[flag] = false;
  });
}
