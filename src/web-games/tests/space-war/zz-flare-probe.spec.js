// PROBE TEMPORÁRIO (diagnóstico CI — deletar após uso): reproduz a sequência
// do AC-10 e loga o estado que a política do flare enxerga em cada perna.
const { test } = require('@playwright/test');

async function startFlight(page) {
  await page.goto('/src/web-games/space-war/index.html');
  await page.waitForSelector('canvas', { state: 'attached', timeout: 60000 });
  await page.waitForFunction(() => window.__spaceWarReady === true, { timeout: 60000 });
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => window.__spaceWar.phase !== 'menu', undefined, { timeout: 30000 });
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => window.__spaceWar.phase === 'flight', { timeout: 45000 });
}

test('probe flare', async ({ page }) => {
  test.setTimeout(300000);
  await startFlight(page);
  const probe = async (label) => {
    await page.waitForTimeout(5000);   // alguns frames p/ a política rodar
    const s = await page.evaluate(() => {
      const G = window.__spaceWar;
      const sun = G.bodies.find((b) => b.isSun);
      const ship = G.ship;
      const d = sun && ship ? Math.round(ship.pos.distanceTo(sun.worldPos)) : null;
      return {
        flareVis: G.sunFlareVisible, factor: G.sunFlareFactor,
        mode: G.mode, phase: G.phase,
        shipVsSun: d, sunR: sun && sun.def.radius,
        dominant: ship && ship.dominant ? (ship.dominant.def.key || ship.dominant.def.name) : null,
        landed: ship && !!ship.landed, dead: ship && !!ship.dead,
      };
    });
    console.log('QA-FLARE', label, JSON.stringify(s));
  };
  await probe('boot-earth');
  await page.evaluate(() => window.__swDebug.goTo('blackhole'));
  await probe('blackhole');
  await page.evaluate(() => window.__swDebug.goTo('sol'));
  await probe('sol');
  await page.waitForTimeout(10000);
  await probe('sol+10s');
  await page.evaluate(() => window.__swDebug.goTo('earth'));
  await probe('earth-volta');
});
