// input.js — Central key state + action mapping. Exports: initInput, isDown,
// onPress. To add a key, add it to KEYMAP and bind with onPress in main.js.

const KEYMAP = {
  KeyW: 'forward',
  ArrowUp: 'forward',
  KeyS: 'back',
  ArrowDown: 'back',
  KeyA: 'left',
  ArrowLeft: 'left',
  KeyD: 'right',
  ArrowRight: 'right',
  ShiftLeft: 'gallop',
  ShiftRight: 'gallop',
  KeyV: 'camera',
  KeyF: 'aim',
  Space: 'jump',
  KeyR: 'reload',
  KeyM: 'map',
  KeyE: 'interact',
};

const down = new Set();          // actions currently held
const pressCbs = new Map();      // action -> [callbacks] (keydown edge, no repeat)

function firePress(action, e) {
  down.add(action);
  const cbs = pressCbs.get(action);
  if (cbs) for (const cb of cbs) cb(e);
}

/**
 * Installs global keyboard + mouse listeners. Call once from main.js.
 * LMB = 'shoot' (edge); clicks on UI overlays/buttons never shoot.
 * @param {Window|HTMLElement} [target]
 */
export function initInput(target = window) {
  target.addEventListener('keydown', (e) => {
    const action = KEYMAP[e.code];
    if (!action) return;
    if (e.code === 'Space') e.preventDefault(); // keep page from scrolling
    if (e.repeat) return;
    firePress(action, e);
  });
  target.addEventListener('keyup', (e) => {
    const action = KEYMAP[e.code];
    if (action) down.delete(action);
  });
  window.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return;
    if (e.target.closest && e.target.closest('#start-overlay, #sound-toggle, #map-overlay')) return;
    firePress('shoot', e);
  });
  window.addEventListener('mouseup', (e) => {
    if (e.button === 0) down.delete('shoot');
  });
  // Lose focus -> release everything (avoids stuck keys)
  window.addEventListener('blur', () => down.clear());
}

/** True while the action's key is held. @param {string} action */
export function isDown(action) {
  return down.has(action);
}

/** Registers a keydown-edge callback. @param {string} action @param {Function} cb */
export function onPress(action, cb) {
  if (!pressCbs.has(action)) pressCbs.set(action, []);
  pressCbs.get(action).push(cb);
}
