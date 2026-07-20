const path = require('path');
const { test, expect } = require('@playwright/test');
const { PNG } = require('playwright-core/lib/utilsBundle');

const evidence = path.resolve(__dirname, '../../../../../../.dadaia/tmp/root/20260718/james-bond-qa');

test('boots offline, renders and plays the first operation', async ({ page }) => {
  const errors = [];
  const external = [];
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (!['127.0.0.1', 'localhost'].includes(url.hostname)) external.push(request.url());
  });

  await page.goto('/src/web-games/james-bond/');
  await page.waitForFunction(() => window.game?.telemetry?.physicsReady === true);
  await expect(page.locator('#menu')).toHaveClass(/screen-active/);
  await page.locator('.mission-tab').first().click({ force: true });
  expect(await page.evaluate(() => window.game.telemetry.worldBuilds)).toBe(1);

  const pixels = PNG.sync.read(await page.locator('#viewport canvas').screenshot({
    path: path.join(evidence, 'canvas-desktop.png'),
  }));
  let litPixels = 0;
  for (let index = 0; index < pixels.data.length; index += 4) {
    if (pixels.data[index] + pixels.data[index + 1] + pixels.data[index + 2] > 24) litPixels += 1;
  }
  expect(litPixels).toBeGreaterThan(pixels.width * pixels.height * 0.05);

  await page.click('#start-button');
  await expect(page.locator('#briefing')).toHaveClass(/screen-active/);
  await page.click('#deploy-button');
  await page.waitForFunction(() => window.game.phase === 'playing');
  expect(await page.evaluate(() => window.game.telemetry.worldBuilds)).toBe(1);
  expect(await page.evaluate(() => window.game.telemetry.staticColliders)).toBeLessThan(80);
  await page.screenshot({ path: path.join(evidence, 'mission-desktop.png') });
  const start = await page.evaluate(() => ({ ...window.game.player.position }));
  await page.keyboard.down('KeyW');
  await page.waitForTimeout(450);
  await page.keyboard.up('KeyW');
  const moved = await page.evaluate(() => ({ ...window.game.player.position }));
  expect(Math.hypot(moved.x - start.x, moved.z - start.z)).toBeGreaterThan(0.2);

  const beforeAmmo = await page.evaluate(() => window.game.ammo.p7.mag);
  await page.mouse.down();
  await page.waitForTimeout(80);
  await page.mouse.up();
  await page.waitForTimeout(120);
  expect(await page.evaluate(() => window.game.ammo.p7.mag)).toBeLessThan(beforeAmmo);
  await page.mouse.wheel(0, 120);
  await page.waitForTimeout(120);
  expect(await page.evaluate(() => window.game.currentWeapon)).toBe('p7s');

  await page.keyboard.press('KeyM');
  await expect(page.locator('#tactical-map')).not.toHaveClass(/is-hidden/);
  await page.evaluate(() => { ['A', 'B', 'C'].forEach((key) => window.game.api.completeObjective(key)); window.game.api.completeMission(); });
  await expect(page.locator('#result')).toHaveClass(/screen-active/);
  await expect(page.locator('#tactical-map')).toHaveClass(/is-hidden/);
  expect(external).toEqual([]);
  expect(errors).toEqual([]);
});

test('menu remains coherent on a narrow viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/src/web-games/james-bond/');
  await page.waitForFunction(() => window.game?.telemetry?.physicsReady === true);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  expect(overflow).toBe(false);
  await page.screenshot({ path: path.join(evidence, 'menu-mobile.png'), fullPage: true });
});

test('all six operations build and resolve in the browser', async ({ page }) => {
  const errors = [];
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/src/web-games/james-bond/');
  await page.waitForFunction(() => window.game?.telemetry?.physicsReady === true);

  for (let index = 0; index < 6; index += 1) {
    const snapshot = await page.evaluate((mission) => {
      window.game.api.deploy(mission);
      return window.game.api.snapshot();
    }, index);
    expect(snapshot.phase).toBe('playing');
    expect(snapshot.mission).toBe(index);
    expect(snapshot.objectives).toHaveLength(3);
    expect(snapshot.enemies).toBeGreaterThan(0);
    await page.evaluate(() => window.game.api.completeMission());
    expect(await page.evaluate(() => window.game.phase)).toBe('result');
  }
  expect(errors).toEqual([]);
});
