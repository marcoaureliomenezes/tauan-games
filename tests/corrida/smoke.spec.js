// Smoke do Cruis'n Tauan: menu carrega, corrida inicia, carro anda, superfícies
// e lombadas respondem, os 3 mapas constroem sem erro.
import { test, expect } from '@playwright/test';

const URL = '/corrida/';

async function start(page, trackArrows = 0) {
  await page.goto(URL);
  await page.waitForFunction(() => window.__corridaReady === true, { timeout: 15000 });
  for (let i = 0; i < trackArrows; i++) await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => ['countdown', 'race'].includes(window.__corrida.phase), { timeout: 5000 });
}

test.describe('Cruis\'n Tauan — smoke', () => {
  test('menu: 3 pistas e 5 carros, Idea Adventure presente', async ({ page }) => {
    await page.goto(URL);
    await page.waitForFunction(() => window.__corridaReady === true, { timeout: 15000 });
    await expect(page.locator('#menuTracks .opt')).toHaveCount(3);
    await expect(page.locator('#menuCars .opt')).toHaveCount(5);
    await expect(page.locator('#menuCars')).toContainText('Idea Adventure 2013 Dual Logic');
  });

  for (const [arrows, name] of [[0, 'Centro Urbano'], [1, 'Floresta Temperada'], [2, 'Deserto do Arizona']]) {
    test(`pista "${name}" constrói e a corrida anda`, async ({ page }) => {
      test.setTimeout(60000);
      await start(page, arrows);
      await expect(page.locator('#trackName')).toHaveText(name);
      // headless pula a contagem (countdown 0.1s) — IA guia o jogador p/ provar movimento
      await page.evaluate(() => {
        const G = window.__corrida;
        G.player.isPlayer = false;
        G.player.st.ai = { laneOffset: 0, skill: 0.85, lookAhead: 0.014 };
      });
      await page.waitForFunction(() => window.__corrida.player.st.v > 8, { timeout: 15000 });
      const st = await page.evaluate(() => {
        const G = window.__corrida;
        const q = G.world.surfaceAt(G.player.st.pos.x, G.player.st.pos.z, G.player.st.sHint);
        return {
          v: G.player.st.v, surface: q.surface,
          racers: G.cars.filter((c) => !c.isTraffic).length,
          traffic: G.cars.filter((c) => c.isTraffic).length,
        };
      });
      expect(st.v).toBeGreaterThan(8);
      expect(st.racers).toBe(6);
      expect(st.traffic).toBe(4);          // tráfego civil circulando
      expect(['asphalt', 'dirt', 'offroad']).toContain(st.surface);
    });
  }

  test('física: atrito por superfície definido para asfalto/terra/fora', async ({ page }) => {
    await start(page, 1);
    const surf = await page.evaluate(async () => {
      const { SURFACES } = await import('/corrida/src/tracks.js');
      return SURFACES;
    });
    expect(surf.asphalt.grip).toBeGreaterThan(surf.dirt.grip);
    expect(surf.dirt.grip).toBeGreaterThan(surf.offroad.grip);
    expect(surf.dirt.rumble).toBeGreaterThan(0);
  });
});
