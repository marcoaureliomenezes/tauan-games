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
  // 20 s: sob carga o rAF desacelera e o serviço (duração em dt SIMULADO) leva
  // mais tempo de parede — flakava sem bug (2026-07-02). Asserções inalteradas.
  await page.waitForFunction(() => window.__aeroDebug.getSnapshot().serviceState === 'complete', { timeout: 20000 });
  const inv = await page.evaluate(() => window.__aeroDebug.getSnapshot().weaponInventory);
  expect(inv.missiles).toBe(100);
  expect(inv.heavyMissiles).toBe(10);
  expect(inv.nuclearMissiles).toBe(3);
});

test('MR service complete keeps aircraft grounded and tells player how to restart', async ({ page }) => {
  await page.goto('/aero-fighters/index.html?testMode=1&map=inhauma&seed=mr-service-next');
  await page.waitForFunction(() => window.__aeroDebug && window.game, { timeout: 15000 });
  await page.evaluate(() => {
    window.game.missionRealism.sortie.state = 'SERVICE_SCENE';
    window.game.running = true;
  });
  // 20 s: sob carga o rAF desacelera e o serviço (duração em dt SIMULADO) leva
  // mais tempo de parede — flakava sem bug (2026-07-02). Asserções inalteradas.
  await page.waitForFunction(() => window.__aeroDebug.getSnapshot().serviceState === 'complete', { timeout: 20000 });
  const before = await page.evaluate(() => ({
    y: window.game.player.y,
    state: window.game.missionRealism.sortie.state,
    mission: document.getElementById('mission')?.textContent || '',
    guide: document.getElementById('approach')?.textContent || '',
  }));
  await page.waitForTimeout(1200);
  const after = await page.evaluate(() => ({
    y: window.game.player.y,
    state: window.game.missionRealism.sortie.state,
    mission: document.getElementById('mission')?.textContent || '',
    guide: document.getElementById('approach')?.textContent || '',
  }));
  expect(before.state).toBe('NEXT_SORTIE_READY');
  expect(after.state).toBe('NEXT_SORTIE_READY');
  expect(Math.abs(after.y - before.y)).toBeLessThan(0.2);
  expect(after.mission).toContain('PRÓXIMA MISSÃO');
  expect(after.guide).toContain('ESPAÇO');
});
