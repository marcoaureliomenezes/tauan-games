const { test, expect } = require('@playwright/test');

test.setTimeout(60000);

async function openAero(page, map = 'rio', seed = 'qa-001') {
  await page.goto(`/aero-fighters/index.html?testMode=1&map=${map}&seed=${seed}`);
  await page.waitForSelector('canvas', { state: 'attached', timeout: 15000 });
  await page.waitForFunction(() => window.__aeroDebug && window.game, { timeout: 15000 });
}

async function startGame(page) {
  await page.keyboard.press('Space');
  await page.waitForFunction(() => window.game.running === true, { timeout: 3000 });
}

test.describe('Aero Fighters — QA Diagnostics', () => {
  test('debug API exposes required snapshot fields', async ({ page }) => {
    await openAero(page);
    const snapshot = await page.evaluate(() => window.__aeroDebug.getSnapshot());
    expect(snapshot.runtime.testMode).toBe(true);
    expect(snapshot.map.activeMap).toBe('rio');
    expect(snapshot.player).toHaveProperty('speed');
    expect(snapshot.renderer).toHaveProperty('calls');
    expect(snapshot.frames).toHaveProperty('worstFrameMs');
  });

  test('seeded target layout is stable across reloads', async ({ page }) => {
    await openAero(page, 'rio', 'stable-seed');
    await startGame(page);
    await page.waitForFunction(() => window.game.targets.length > 0, { timeout: 4000 });
    const first = await page.evaluate(() =>
      window.__aeroDebug.getTargetDiagnostics().map((t) => [t.type, t.spawnX, t.spawnY, t.spawnZ, Number(t.heightError.toFixed(3))])
    );
    await page.reload();
    await page.waitForFunction(() => window.__aeroDebug && window.game, { timeout: 5000 });
    await startGame(page);
    await page.waitForFunction(() => window.game.targets.length > 0, { timeout: 4000 });
    const second = await page.evaluate(() =>
      window.__aeroDebug.getTargetDiagnostics().map((t) => [t.type, t.spawnX, t.spawnY, t.spawnZ, Number(t.heightError.toFixed(3))])
    );
    expect(second).toEqual(first);
  });

  test('renderer and frame metrics are finite', async ({ page }) => {
    await openAero(page, 'desert', 'metrics-seed');
    await startGame(page);
    await page.waitForTimeout(1000);
    const snapshot = await page.evaluate(() => window.__aeroDebug.getSnapshot());
    expect(Number.isFinite(snapshot.renderer.calls)).toBe(true);
    expect(Number.isFinite(snapshot.renderer.triangles)).toBe(true);
    expect(Number.isFinite(snapshot.frames.averageFps)).toBe(true);
    expect(Number.isFinite(snapshot.frames.worstFrameMs)).toBe(true);
  });

  test('no console errors during deterministic scenario', async ({ page }) => {
    const errors = [];
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('pageerror', (e) => errors.push(e.message));
    await openAero(page, 'rio', 'quiet-seed');
    await startGame(page);
    await page.keyboard.down('KeyW');
    await page.waitForTimeout(15000);
    await page.keyboard.up('KeyW');
    expect(errors).toEqual([]);
  });
});
