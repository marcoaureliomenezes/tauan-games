const { test, expect } = require('@playwright/test');

test('MR camera mode cycles through debug-visible camera modes', async ({ page }) => {
  await page.goto('/src/web-games/aero-fighters/index.html?testMode=1&map=desert&seed=mr-camera');
  await page.waitForFunction(() => window.__aeroDebug && window.game, { timeout: 15000 });
  const before = await page.evaluate(() => window.__aeroDebug.getSnapshot().cameraMode);
  await page.keyboard.press('KeyC');
  const after = await page.evaluate(() => window.__aeroDebug.getSnapshot().cameraMode);
  expect(after).not.toBe(before);
});
