const { test, expect } = require('@playwright/test');

// Bug space-war-gravbomb-higgs-keys-dead (operator-reported): [G]/[H] nunca
// dispararam pelo TECLADO — o mapa de listeners engolia handlers em silêncio e
// os testes/verificações usavam __swDebug.* (chamada direta). LIÇÃO: cobertura
// por debug-call NÃO é cobertura de input. Esta suíte usa TECLAS REAIS.

async function startAirborne(page) {
  await page.goto('/src/web-games/space-war/index.html');
  await page.waitForSelector('canvas', { state: 'attached', timeout: 30000 });
  await page.waitForFunction(() => window.__spaceWarReady === true, { timeout: 45000 });
  await page.keyboard.press('Enter');
  await page.waitForTimeout(150);
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => window.__spaceWar.phase === 'flight', { timeout: 10000 });
  await page.evaluate(() => window.__swDebug.goTo('terra', 4));   // no ar (landed=false)
  await page.waitForTimeout(200);
}

test.describe('Space War — Arsenal por TECLAS REAIS', () => {

  test('KeyG lança a traçadora e o POÇO de Higgs a ATRAI (bug do operador)', async ({ page }) => {
    test.setTimeout(90000);
    await startAirborne(page);
    // traçadora por TECLA REAL
    await page.keyboard.press('KeyG');
    await page.waitForFunction(
      () => window.__spaceWar.projectiles.some((p) => p.isTracer),
      undefined, { timeout: 5000 },
    );
    // bomba de Higgs por TECLA REAL na mesma linha de tiro: o poço nasce e
    // deve ARRASTAR a traçadora (cap 600 u/s² — "projéteis atraídos pelos
    // poços gravitacionais", a queixa literal do operador).
    await page.keyboard.press('KeyH');
    await page.waitForFunction(
      () => window.__spaceWar.wells.length >= 1,
      undefined, { timeout: 60000 },
    );
    const v0ok = await page.evaluate(() => {
      const t = window.__spaceWar.projectiles.find((p) => p.isTracer);
      if (!t) return false;
      window.__arsenalV0 = { x: t.vel.x, y: t.vel.y, z: t.vel.z };
      return true;
    });
    expect(v0ok).toBe(true);
    // espera a CONDIÇÃO (não um relógio de parede — runner 2-core encolhe o
    // tempo de sim): o poço vive 8s de sim, a curvatura CHEGA; dot<0.99 ou dv>30
    await page.waitForFunction(() => {
      const t = window.__spaceWar.projectiles.find((p) => p.isTracer);
      const a = window.__arsenalV0;
      if (!t || !a) return false;
      const b = t.vel;
      const ma = Math.hypot(a.x, a.y, a.z), mb = Math.hypot(b.x, b.y, b.z);
      const dot = (a.x * b.x + a.y * b.y + a.z * b.z) / (ma * mb);
      return dot < 0.99 || Math.abs(mb - ma) > 30;
    }, undefined, { timeout: 30000 });
  });

  test('KeyH lança a bomba de Higgs e o POÇO gravitacional nasce', async ({ page }) => {
    test.setTimeout(90000);
    await startAirborne(page);
    await page.keyboard.press('KeyH');
    await page.waitForFunction(
      () => window.__spaceWar.projectiles.some((p) => p.isHiggs),
      undefined, { timeout: 5000 },
    );
    // pulso ~8s após armar (~1.2s) — slow-mo do headless ≈ 3:1 de parede
    await page.waitForFunction(
      () => window.__spaceWar.wells.length >= 1,
      undefined, { timeout: 60000 },
    );
    const well = await page.evaluate(() => window.__spaceWar.wells[0].mu);
    expect(well).toBeGreaterThanOrEqual(1e11);
  });

  test('KeyF continua disparando a nuke (regressão)', async ({ page }) => {
    test.setTimeout(60000);
    await startAirborne(page);
    const before = await page.evaluate(() => window.__spaceWar.ship.nukes);
    await page.keyboard.press('KeyF');
    await page.waitForFunction(
      (n) => window.__spaceWar.ship.nukes === n - 1,
      before, { timeout: 5000 },
    );
    const proj = await page.evaluate(() => window.__spaceWar.projectiles.filter((p) => p.isNuke).length);
    expect(proj).toBeGreaterThanOrEqual(1);
  });
});
