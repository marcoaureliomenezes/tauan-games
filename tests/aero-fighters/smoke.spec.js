const { test, expect } = require('@playwright/test');

// Helper: navigate, wait for canvas, start game
async function startGame(page) {
  await page.goto('/aero-fighters/index.html');
  // Timeout tolerante: shader compilation de PBR + shadow map demora no primeiro frame
  await page.waitForSelector('canvas', { timeout: 5000 });
  await page.waitForTimeout(800);
  await page.keyboard.press('Space');
  await page.waitForFunction(() => window.game && window.game.running === true, { timeout: 3000 });
  await page.waitForTimeout(400);
}

test.describe('Aero Fighters — Smoke Suite', () => {

  // AC-1: canvas renders
  test('AC-1: 3D canvas renders with visible pixels', async ({ page }) => {
    await page.goto('/aero-fighters/index.html');
    await page.waitForSelector('canvas', { timeout: 5000 });
    await page.waitForTimeout(800);
    const shot = await page.screenshot();
    const nonZero = shot.some((b, i) => i > 100 && b !== 0);
    expect(nonZero).toBe(true);
  });

  // AC-2: no JS errors on load
  test('AC-2: no console errors on load', async ({ page }) => {
    const errors = [];
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('pageerror', e => errors.push(e.message));
    await page.goto('/aero-fighters/index.html');
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

  // AC-3: starts with 100 missiles
  test('AC-3: starts with 100 missiles', async ({ page }) => {
    await page.goto('/aero-fighters/index.html');
    await page.waitForTimeout(600);
    const missiles = await page.evaluate(() => window.game?.player?.missiles);
    expect(missiles).toBe(100);
  });

  // AC-4: ArrowDown pitches nose UP — jet climbs (controles invertidos estilo simulador)
  test('AC-4: ArrowDown pitches nose UP — jet climbs', async ({ page }) => {
    await startGame(page);
    const yBefore = await page.evaluate(() => window.game.player.y);
    await page.keyboard.down('ArrowDown');
    await page.waitForTimeout(800);
    await page.keyboard.up('ArrowDown');
    const yAfter = await page.evaluate(() => window.game.player.y);
    expect(yAfter).toBeGreaterThan(yBefore);
  });

  // AC-5: ArrowUp pitches nose DOWN — jet descends
  test('AC-5: ArrowUp pitches nose DOWN — jet descends', async ({ page }) => {
    await startGame(page);
    const yBefore = await page.evaluate(() => window.game.player.y);
    await page.keyboard.down('ArrowUp');
    await page.waitForTimeout(800);
    await page.keyboard.up('ArrowUp');
    const yAfter = await page.evaluate(() => window.game.player.y);
    expect(yAfter).toBeLessThan(yBefore);
  });

  // AC-6: jet can sustain full 360° pitch loop (usa ArrowDown porque invertido = pull-back stick)
  test('AC-6: jet survives a full vertical loop (360° pitch)', async ({ page }) => {
    await startGame(page);
    await page.keyboard.down('KeyW');     // full throttle
    await page.waitForTimeout(500);
    await page.keyboard.down('ArrowDown'); // pull back hard for ~3s (nose up = climb)
    await page.waitForTimeout(3000);
    await page.keyboard.up('ArrowDown');
    await page.keyboard.up('KeyW');
    const alive = await page.evaluate(() => !window.game.player.dead && window.game.running);
    expect(alive).toBe(true);
    const alt = await page.evaluate(() => window.game.player.y);
    expect(alt).toBeGreaterThan(3);
  });

  // AC-7: ArrowLeft rolls jet and changes heading
  test('AC-7: ArrowLeft rolls and turns jet left', async ({ page }) => {
    await startGame(page);
    const xBefore = await page.evaluate(() => window.game.player.x);
    await page.keyboard.down('ArrowLeft');
    await page.waitForTimeout(1500);
    await page.keyboard.up('ArrowLeft');
    const xAfter = await page.evaluate(() => window.game.player.x);
    expect(xAfter).not.toBeCloseTo(xBefore, 0);
  });

  // AC-8: W key increases speed
  test('AC-8: W key increases throttle and speed', async ({ page }) => {
    await startGame(page);
    const spdBefore = await page.evaluate(() => window.game.player.speed);
    await page.keyboard.down('KeyW');
    await page.waitForTimeout(1200);
    await page.keyboard.up('KeyW');
    const spdAfter = await page.evaluate(() => window.game.player.speed);
    expect(spdAfter).toBeGreaterThan(spdBefore);
  });

  // AC-9: S key decreases speed
  test('AC-9: S key decreases throttle and speed', async ({ page }) => {
    await startGame(page);
    await page.waitForTimeout(300);
    const spdBefore = await page.evaluate(() => window.game.player.speed);
    await page.keyboard.down('KeyS');
    await page.waitForTimeout(1500);
    await page.keyboard.up('KeyS');
    const spdAfter = await page.evaluate(() => window.game.player.speed);
    expect(spdAfter).toBeLessThan(spdBefore);
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

  // AC-11: X fires missile com lock-on (espera ~500ms para travar o alvo)
  test('AC-11: X fires homing missile (após lock-on) e decrementa counter', async ({ page }) => {
    await startGame(page);
    await page.waitForTimeout(550);          // aguarda lock-on (0.35s)
    const before = await page.evaluate(() => window.game.player.missiles);
    await page.keyboard.press('KeyX');
    await page.waitForTimeout(200);
    const after = await page.evaluate(() => window.game.player.missiles);
    expect(after).toBe(before - 1);
  });

  // AC-12: mission spawns static military targets (AA guns, bases etc — substituiu ships)
  test('AC-12: mission spawns static military targets', async ({ page }) => {
    await startGame(page);
    await page.waitForFunction(() => window.game.targets.length > 0, { timeout: 4000 });
    await page.waitForTimeout(800);
    const hasMilitary = await page.evaluate(() =>
      window.game.targets.some(e => ['base', 'factory', 'building', 'convoy', 'aaGun'].includes(e.type))
    );
    expect(hasMilitary).toBe(true);
  });

  // AC-13: killing enemy increments score
  test('AC-13: killing enemy increments score', async ({ page }) => {
    await startGame(page);
    await page.waitForFunction(() => window.game.enemies.length > 0, { timeout: 4000 });
    const scoreBefore = await page.evaluate(() => window.game.score);
    await page.evaluate(() => { if (window.game.enemies[0]) window.game.enemies[0].hp = 0; });
    await page.waitForTimeout(400);
    const scoreAfter = await page.evaluate(() => window.game.score);
    expect(scoreAfter).toBeGreaterThan(scoreBefore);
  });

  // AC-14: low throttle leads to stall or very low speed
  test('AC-14: sustained S key causes stall or near-stall speed', async ({ page }) => {
    await startGame(page);
    await page.keyboard.down('KeyS');
    await page.waitForTimeout(3000);
    await page.keyboard.up('KeyS');
    const stalled = await page.evaluate(() => window.game.player.stalled);
    const spd     = await page.evaluate(() => window.game.player.speed);
    expect(stalled || spd < 15).toBe(true);
  });

  // AC-15: Shift triggers barrel roll without crashing
  test('AC-15: Shift barrel roll keeps jet alive', async ({ page }) => {
    await startGame(page);
    await page.keyboard.press('ShiftLeft');
    await page.waitForTimeout(600);
    const running = await page.evaluate(() => window.game.running && !window.game.player.dead);
    expect(running).toBe(true);
  });

  // AC-16: scene background is not black (ocean/sky rendering)
  test('AC-16: scene renders coloured background (sky + ocean)', async ({ page }) => {
    await page.goto('/aero-fighters/index.html');
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

  // AC-18: FPS >= 15 over 8s (browser real fica 60+; threshold tolerante para
  // headless chromium com software rendering + PBR + skybox + tracers)
  test('AC-18: FPS >= 15 over 8s', async ({ page }) => {
    await startGame(page);
    await page.evaluate(() => {
      window.__fps = { n: 0 };
      const orig = window.requestAnimationFrame.bind(window);
      window.requestAnimationFrame = cb => orig(ts => { window.__fps.n++; cb(ts); });
    });
    const t0 = Date.now();
    await page.waitForTimeout(8000);
    const elapsed = (Date.now() - t0) / 1000;
    const frames  = await page.evaluate(() => window.__fps.n);
    expect(frames / elapsed).toBeGreaterThanOrEqual(15);
  });
});
