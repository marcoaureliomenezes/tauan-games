const { test, expect } = require('@playwright/test');

test('MR nuclear FX diagnostics are present and finite', async ({ page }) => {
  await page.goto('/aero-fighters/index.html?testMode=1&map=desert&seed=mr-nuke');
  await page.waitForFunction(() => window.__aeroDebug && window.game, { timeout: 15000 });
  const fx = await page.evaluate(() => window.__aeroDebug.getSnapshot().nuclearFxState);
  expect(fx).toHaveProperty('stage');
  expect(Number.isFinite(fx.fireballRadius)).toBe(true);
  expect(Number.isFinite(fx.shockwaveRadius)).toBe(true);
});
