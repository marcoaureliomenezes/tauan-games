const { test, expect } = require('@playwright/test');

test.describe('Tauan T-Rex — Smoke Suite', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/tauan-trex/index.html');
  });

  test('AC-1: canvas renders on load', async ({ page }) => {
    const canvas = await page.waitForSelector('#game-canvas', { timeout: 500 });
    const width = await canvas.evaluate(el => el.width);
    expect(width).toBeGreaterThan(0);
  });

  test('AC-2: no console errors on load', async ({ page }) => {
    const errors = [];
    page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
    page.on('pageerror', err => errors.push(err.message));
    await page.waitForTimeout(5000);
    expect(errors).toHaveLength(0);
  });

  test('AC-3: Space starts game', async ({ page }) => {
    await page.waitForTimeout(300);
    await page.keyboard.press('Space');
    await page.waitForFunction(() => window.game && window.game.running === true, { timeout: 500 });
    const running = await page.evaluate(() => window.game.running);
    expect(running).toBe(true);
  });

  test('AC-4: Space triggers jump during gameplay', async ({ page }) => {
    await page.waitForTimeout(300);
    await page.keyboard.press('Space');
    await page.waitForFunction(() => window.game && window.game.running === true, { timeout: 500 });
    const yBefore = await page.evaluate(() => window.game.player.y);
    await page.keyboard.press('Space');
    await page.waitForTimeout(200);
    const yAfter = await page.evaluate(() => window.game.player.y);
    expect(Math.abs(yAfter - yBefore)).toBeGreaterThanOrEqual(20);
  });

  test('AC-5: score increments after 3s of gameplay', async ({ page }) => {
    await page.waitForTimeout(300);
    await page.keyboard.press('Space');
    await page.waitForFunction(() => window.game && window.game.running === true, { timeout: 500 });
    await page.waitForTimeout(3000);
    const score = await page.evaluate(() => window.game.score);
    expect(score).toBeGreaterThan(0);
  });

  test('AC-6: injecting player.dead shows GAME OVER overlay', async ({ page }) => {
    await page.waitForTimeout(300);
    await page.keyboard.press('Space');
    await page.waitForFunction(() => window.game && window.game.running === true, { timeout: 500 });
    await page.waitForTimeout(500);
    await page.evaluate(() => { window.game.player.dead = true; });
    await page.waitForTimeout(300);
    const bodyText = await page.evaluate(() => document.body.innerText);
    expect(bodyText).toContain('GAME OVER');
  });

  test('AC-7: high score persists across reload', async ({ page }) => {
    await page.waitForTimeout(300);
    await page.keyboard.press('Space');
    await page.waitForFunction(() => window.game && window.game.running === true, { timeout: 500 });
    await page.waitForTimeout(3000);
    const score = await page.evaluate(() => window.game.score);
    await page.evaluate(() => { window.game.player.dead = true; });
    await page.waitForTimeout(500);
    await page.reload();
    await page.waitForTimeout(500);
    const hiScoreEl = await page.$('#hi-score');
    const hiText = hiScoreEl ? await hiScoreEl.innerText() : '';
    expect(hiText).toMatch(/[1-9]/);
  });

  test('AC-8: FPS >= 55 over 10s', async ({ page }) => {
    await page.waitForTimeout(300);
    await page.keyboard.press('Space');
    await page.waitForFunction(() => window.game && window.game.running === true, { timeout: 500 });
    await page.evaluate(() => {
      window.__fpsData = { count: 0, last: performance.now() };
      const orig = window.requestAnimationFrame.bind(window);
      window.requestAnimationFrame = (cb) => orig((ts) => {
        window.__fpsData.count++;
        window.__fpsData.last = ts;
        cb(ts);
      });
    });
    const start = Date.now();
    await page.waitForTimeout(10000);
    const elapsed = (Date.now() - start) / 1000;
    const frames = await page.evaluate(() => window.__fpsData.count);
    const fps = frames / elapsed;
    expect(fps).toBeGreaterThanOrEqual(55);
  });
});
