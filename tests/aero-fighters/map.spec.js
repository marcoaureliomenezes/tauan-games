const { test, expect } = require('@playwright/test');

test.setTimeout(60000);

async function openAndStart(page, map) {
  await page.goto(`/aero-fighters/index.html?testMode=1&map=${map}&seed=map-qa`);
  await page.waitForSelector('canvas', { state: 'attached', timeout: 15000 });
  await page.waitForFunction(() => window.__aeroDebug && window.game, { timeout: 15000 });
  await page.keyboard.press('Space');
  await page.waitForFunction(() => window.game.running === true && window.game.targets.length > 0, { timeout: 5000 });
}

for (const map of ['rio', 'desert', 'inhauma']) {
  test.describe(`Aero Fighters — ${map} map diagnostics`, () => {
    test('initial targets are grounded within tolerance', async ({ page }) => {
      await openAndStart(page, map);
      const diagnostics = await page.evaluate(() => window.__aeroDebug.getTargetDiagnostics());
      expect(diagnostics.length).toBeGreaterThan(0);
      const bad = diagnostics.filter((t) => !t.grounded);
      expect(bad, JSON.stringify(bad, null, 2)).toEqual([]);
    });

    test('terrain samples are finite', async ({ page }) => {
      await openAndStart(page, map);
      const samples = await page.evaluate(() => {
        const points = [[0, 0], [100, 100], [-100, 100], [250, -250], [-250, 250]];
        return points.map(([x, z]) => window.__aeroDebug.getTerrainHeightAt(x, z));
      });
      expect(samples.every(Number.isFinite)).toBe(true);
    });

    test('map diagnostics identify current map', async ({ page }) => {
      await openAndStart(page, map);
      const diag = await page.evaluate(() => window.__aeroDebug.getMapDiagnostics());
      expect(diag.activeMap).toBe(map);
      expect(diag.mapsCovered).toEqual(expect.arrayContaining(['rio', 'desert', 'inhauma']));
    });
  });
}
