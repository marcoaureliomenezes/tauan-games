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
  // T-W-08 (inhauma-defense): X segurado = auto-fogo do míssil na cadência
  // (o disparo discreto continua no KEY_ACTIONS; segurar não enfileira).
  missileHeld: false,
  // T-D-02 (inhauma-defense-v1): flags semânticas de MOUSE, mesmo padrão das
  // de teclado — quem consome (turret-camera/defense-mode) lê aqui; o módulo
  // é o único que toca em eventos DOM de mouse. dx/dy/wheel são DELTAS
  // acumulados desde o último consumeMouseDeltas().
  mouse: { dx: 0, dy: 0, left: false, right: false, wheel: 0 },
  pointerLocked: false,   // true enquanto o pointer lock está ativo
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
  KeyX:       'missileHeld', // T-W-08: segurar X = auto-fogo na cadência (defesa)
};

/** Mapa código de tecla → nome de ação discreta (disparada uma vez por keydown). */
const KEY_ACTIONS = {
  Space:        'fire',
  KeyZ:         'fire',
  KeyX:         'missile',
  KeyB:         'heavyMissile',
  KeyT:         'nuclearMissile',
  KeyR:         'rodMissile',
  KeyC:         'cameraMode',
  KeyJ:         'eject',
  // WEAPONS-V1 (inhauma-defense): slots de arma 1-5 (mg · X · B · T · R) —
  // mesma ordem do scroll; consumidos pelo defense-mode (inerte fora do modo)
  Digit1:       'slot1',
  Digit2:       'slot2',
  Digit3:       'slot3',
  Digit4:       'slot4',
  Digit5:       'slot5',
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

// ─── Mouse (T-D-02) ──────────────────────────────────────────────────────────
// Esc handling: com pointer lock ativo o browser consome o Esc para SAIR do
// lock (a página recebe 'pointerlockchange', não o keydown) — o defense-mode
// pausa nesse evento. Sem lock, Esc cai no KEY_ACTIONS normal ('pause').

/** Pede pointer lock num elemento (gesto do usuário necessário). */
export function requestPointerLock(el) {
  el?.requestPointerLock?.();
}

/** Sai do pointer lock (se ativo). */
export function exitPointerLock() {
  if (typeof document !== 'undefined' && document.pointerLockElement) {
    document.exitPointerLock?.();
  }
}

/** Lê e ZERA os deltas de mouse do frame (chamado 1x por frame pelo consumidor). */
export function consumeMouseDeltas() {
  const d = { dx: input.mouse.dx, dy: input.mouse.dy, wheel: input.mouse.wheel };
  input.mouse.dx = 0;
  input.mouse.dy = 0;
  input.mouse.wheel = 0;
  return d;
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

  // ── Mouse (flags semânticas; movimento só conta com pointer lock) ──
  document.addEventListener('mousemove', (e) => {
    if (!input.pointerLocked) return;
    input.mouse.dx += e.movementX || 0;
    input.mouse.dy += e.movementY || 0;
  });
  document.addEventListener('mousedown', (e) => {
    if (e.button === 0) input.mouse.left = true;
    if (e.button === 2) input.mouse.right = true;
  });
  document.addEventListener('mouseup', (e) => {
    if (e.button === 0) input.mouse.left = false;
    if (e.button === 2) input.mouse.right = false;
  });
  document.addEventListener('wheel', (e) => {
    if (input.pointerLocked) input.mouse.wheel += Math.sign(e.deltaY);
  }, { passive: true });
  document.addEventListener('pointerlockchange', () => {
    input.pointerLocked = document.pointerLockElement != null;
    if (!input.pointerLocked) {
      // soltou o lock: limpa botões segurados e deltas residuais
      input.mouse.left = false;
      input.mouse.right = false;
      input.mouse.dx = 0;
      input.mouse.dy = 0;
      input.mouse.wheel = 0;
    }
  });
  // Menu de contexto atrapalha o zoom RMB quando o lock está ativo
  document.addEventListener('contextmenu', (e) => {
    if (input.pointerLocked) e.preventDefault();
  });
}
