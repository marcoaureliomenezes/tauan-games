const { test, expect } = require('@playwright/test');

test('MR ejection action enters parachute state from mayday', async ({ page }) => {
  await page.goto('/aero-fighters/index.html?testMode=1&map=desert&seed=mr-ejection');
  await page.waitForFunction(() => window.__aeroDebug && window.game, { timeout: 15000 });
  await page.keyboard.press('Space');
  await page.evaluate(() => {
    window.game.flags.mayday = true;
    window.game.missionRealism.sortie.state = 'MAYDAY';
  });
  await page.keyboard.press('KeyJ');
  await page.waitForFunction(() => window.__aeroDebug.getSnapshot().ejectionState === 'ACTIVE', { timeout: 3000 });
  const s = await page.evaluate(() => window.__aeroDebug.getSnapshot());
  expect(s.pilotState).toBe('PARACHUTE');
});
