const { test, expect } = require('@playwright/test');

test('MR service scene debug path refills armament after test duration', async ({ page }) => {
  await page.goto('/aero-fighters/index.html?testMode=1&map=desert&seed=mr-service');
  await page.waitForFunction(() => window.__aeroDebug && window.game, { timeout: 15000 });
  await page.evaluate(() => {
    window.game.player.missiles = 0;
    window.game.player.heavyMissiles = 0;
    window.game.player.nuclearMissiles = 0;
    window.game.missionRealism.sortie.state = 'SERVICE_SCENE';
    window.game.running = true;
  });
  await page.waitForFunction(() => window.__aeroDebug.getSnapshot().serviceProgress > 0, { timeout: 3000 });
  await page.waitForFunction(() => window.__aeroDebug.getSnapshot().serviceState === 'complete', { timeout: 8000 });
  const inv = await page.evaluate(() => window.__aeroDebug.getSnapshot().weaponInventory);
  expect(inv.missiles).toBe(100);
  expect(inv.heavyMissiles).toBe(10);
  expect(inv.nuclearMissiles).toBe(3);
});
