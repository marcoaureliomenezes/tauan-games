const { test, expect } = require('@playwright/test');

// T-07 (v0.10.0) — sleeps fixos convertidos em waitForFunction sobre estado real do
// jogo. Mantido de propósito (justificativa inline):
//   AC-17 300ms — settle curto do loop/HUD antes de forçar lives=0
//
// T-01 (v0.11.0, test lifecycle demotion) — AC-6/AC-15 (andaime/tautologia) e todo
// AC-classificado com cobertura Node equivalente foram deletados; AC-6b foi
// rebaixado para tools/test-aero-sim.js; AC-4/AC-5 foram fundidos num único teste
// parametrizado; AC-18 trocou a janela fixa de 8s por um poll de frame-counter.
// Ver o mapa de rebaixamento (2026-08-12T160030Z-...-demotion-map.html §2.1).

// Init real dos módulos ES (mesmo contrato do AC-2): substitui sleeps de "load settle".
function modulesLoaded(page, timeout = 15000) {
  return page.waitForFunction(
    () => typeof window.game !== 'undefined'
       && typeof window.game.flags?.rollTimer === 'number'
       && typeof window.game.running === 'boolean',
    { timeout },
  );
}

// Helper: navigate, wait for canvas, start game
async function startGame(page) {
  await page.goto('/src/web-games/aero-fighters/index.html');
  // Timeout tolerante: shader compilation de PBR + shadow map demora no primeiro frame
  await page.waitForSelector('canvas', { state: 'attached', timeout: 15000 });
  await modulesLoaded(page);
  await page.keyboard.press('Space');
  await page.waitForFunction(() => window.game && window.game.running === true, { timeout: 3000 });
  // Polling da máquina de surtida engatada (MENU -> TAXI_OUT, missions.js#startMission)
  await page.waitForFunction(
    () => window.game.missionRealism && window.game.missionRealism.sortie.state !== 'MENU',
    { timeout: 4000 },
  );
}

// Polling da velocidade de rotação (ROTATION_SPEED=38, ground-physics.js) — substitui
// as esperas fixas de "ganhar velocidade" antes de puxar ↓/↑.
function waitRotationSpeed(page, timeout = 15000) {
  return page.waitForFunction(() => window.game.player.speed >= 38, { timeout });
}

test.describe('Aero Fighters — Smoke Suite', () => {

  // AC-1: canvas renders
  test('AC-1: 3D canvas renders with visible pixels', async ({ page }) => {
    await page.goto('/src/web-games/aero-fighters/index.html');
    await page.waitForSelector('canvas', { state: 'attached', timeout: 15000 });
    await modulesLoaded(page);
    const shot = await page.screenshot();
    const nonZero = shot.some((b, i) => i > 100 && b !== 0);
    expect(nonZero).toBe(true);
  });

  // AC-2: no JS errors on load
  test('AC-2: no console errors on load', async ({ page }) => {
    const errors = [];
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('pageerror', e => errors.push(e.message));
    await page.goto('/src/web-games/aero-fighters/index.html');
    // Wait until all ES modules have initialized:
    //   - window.game defined (state.js)
    //   - game.flags.rollTimer defined (player.js, last game module to import)
    //   - game.running is a boolean (main.js fully executed and tick() started)
    // This replaces the unconditional waitForTimeout(4000).
    // Timeout 15000ms to detect real load failures without masking them.
    await page.waitForFunction(
      () => typeof window.game !== 'undefined'
         && typeof window.game.flags?.rollTimer === 'number'
         && typeof window.game.running === 'boolean',
      { timeout: 15000 },
    );
    expect(errors).toHaveLength(0);
  });

  // AC-3 (T-01 demotion): the infinite-light-missile invariant + the cooldown-init
  // state are now proven by tools/test-aero-weapon-cooldowns.mjs:27/:34 and
  // tools/test-aero-unit.js — this residual keeps only the observable the Node
  // suite CANNOT reach: the real HUD text in a running browser build.
  test('AC-3: HUD shows the light-missile cooldown label', async ({ page }) => {
    await page.goto('/src/web-games/aero-fighters/index.html');
    await page.waitForFunction(() => window.game?.player?.weaponCooldowns, { timeout: 8000 });
    const hud = await page.evaluate(() => document.getElementById('missiles').textContent);
    expect(hud).toContain('X MSL:');
  });

  // AC-4/AC-5 (merged, T-01 demotion): ADR-U1 — on the GROUND, either arrow key
  // rotates and lifts the jet off the runway (the unambiguous "climb intent" the
  // real production target audience needs). Both directions share this one
  // production invariant; the merge keeps exactly that shared assertion.
  for (const key of ['ArrowDown', 'ArrowUp']) {
    test(`AC-4/AC-5: ${key} rotates after takeoff speed — jet lifts from runway (ADR-U1)`, async ({ page }) => {
      await startGame(page);
      const yBefore = await page.evaluate(() => window.game.player.y);
      await page.keyboard.down('KeyW');
      await waitRotationSpeed(page);
      await page.keyboard.down(key);
      await page.waitForFunction(
        () => window.game.missionRealism.sortie.state === 'AIRBORNE',
        { timeout: 7000 },
      );
      await page.keyboard.up(key);
      await page.keyboard.up('KeyW');
      const yAfter = await page.evaluate(() => window.game.player.y);
      expect(yAfter).toBeGreaterThan(yBefore);
    });
  }

  // AC-7: ArrowLeft steers on ground / rolls in flight and changes heading
  test('AC-7: ArrowLeft steers and changes x position', async ({ page }) => {
    await startGame(page);
    const xBefore = await page.evaluate(() => window.game.player.x);
    await page.keyboard.down('KeyW');
    await page.keyboard.down('ArrowLeft');
    // T-07: polling do deslocamento lateral real em vez de janela fixa
    await page.waitForFunction((x0) => Math.abs(window.game.player.x - x0) > 0.5, xBefore, { timeout: 6000 });
    await page.keyboard.up('ArrowLeft');
    await page.keyboard.up('KeyW');
    const xAfter = await page.evaluate(() => window.game.player.x);
    expect(xAfter).not.toBeCloseTo(xBefore, 0);
  });

  // AC-10: Space fires cannon
  test('AC-10: Space fires cannon projectile', async ({ page }) => {
    await startGame(page);
    const before = await page.evaluate(() => window.game.projectiles.length);
    await page.keyboard.press('Space');
    await page.waitForTimeout(200);
    const after = await page.evaluate(() => window.game.projectiles.length);
    expect(after).toBeGreaterThan(before);
  });

  // AC-13 (DN ⚠ — BLOCKED, left untouched): targets.js#killTarget imports scene.js
  // transitively (targets.js:7) and cannot be moved to Node without that decoupling.
  test('AC-13: killing enemy increments score', async ({ page }) => {
    await startGame(page);
    await page.waitForFunction(() => window.game.enemies.length > 0, { timeout: 4000 });
    const scoreBefore = await page.evaluate(() => window.game.score);
    await page.evaluate(() => { if (window.game.enemies[0]) window.game.enemies[0].hp = 0; });
    await page.waitForTimeout(400);
    const scoreAfter = await page.evaluate(() => window.game.score);
    expect(scoreAfter).toBeGreaterThan(scoreBefore);
  });

  // AC-16: scene background is not black (ocean/sky rendering)
  test('AC-16: scene renders coloured background (sky + ocean)', async ({ page }) => {
    await page.goto('/src/web-games/aero-fighters/index.html');
    await page.waitForTimeout(1000);
    const shot = await page.screenshot();
    let nonBlack = 0;
    for (let i = 54; i < Math.min(shot.length, 54 + 4000 * 4); i += 4) {
      if (shot[i] > 20 || shot[i+1] > 20 || shot[i+2] > 20) nonBlack++;
    }
    expect(nonBlack).toBeGreaterThan(500);
  });

  // AC-17: lives=0 shows mission failed
  test('AC-17: setting player lives to 0 shows MISSÃO FALHOU', async ({ page }) => {
    await startGame(page);
    await page.waitForTimeout(300);
    await page.evaluate(() => { window.game.player.lives = 0; });
    await page.waitForTimeout(600);
    const text = await page.evaluate(() => document.body.innerText);
    expect(text).toContain('MISSÃO FALHOU');
  });

  // AC-18 (T-01 demotion): FPS >= 7, now measured via a frame-counter poll instead
  // of an unconditional 8s sleep — waitForFunction exits the instant enough frames
  // have actually rendered (typically <1s at a healthy frame rate), then the real
  // FPS is computed from the ACTUAL elapsed time between the first and Nth frame.
  test('AC-18: FPS >= 7, measured via frame-counter poll (no fixed sleep)', async ({ page }) => {
    await startGame(page);
    await page.evaluate(() => {
      window.__fps = { n: 0, t0: null };
      const orig = window.requestAnimationFrame.bind(window);
      window.requestAnimationFrame = cb => orig(ts => {
        if (window.__fps.t0 === null) window.__fps.t0 = ts;
        window.__fps.n++;
        cb(ts);
      });
    });
    const MIN_FRAMES = 56; // >= 7 fps sustained over an 8s-equivalent window
    await page.waitForFunction((n) => window.__fps.n >= n, MIN_FRAMES, { timeout: 20000 });
    const { n, elapsedMs } = await page.evaluate(() => ({
      n: window.__fps.n,
      elapsedMs: performance.now() - window.__fps.t0,
    }));
    const fps = n / (elapsedMs / 1000);
    expect(fps).toBeGreaterThanOrEqual(7);
  });
});
