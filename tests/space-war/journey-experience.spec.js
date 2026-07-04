const { test, expect } = require('@playwright/test');

// Suite da release space-war-interstellar-experience-v1 (bug operator-reported
// space-war-interstellar-experience-flat): perfil 30/40/30, headlight forte,
// crescimento na passagem + riscos (diagnósticos), imunidade a colisão.

async function startFlight(page) {
  await page.goto('/space-war/index.html');
  await page.waitForSelector('canvas', { state: 'attached', timeout: 15000 });
  await page.waitForFunction(() => window.__spaceWarReady === true, { timeout: 15000 });
  await page.keyboard.press('Enter');
  await page.waitForTimeout(150);
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => window.__spaceWar.phase === 'flight', { timeout: 4000 });
}

async function engageJourney(page) {
  await page.evaluate(() => window.__swDebug.goTo('terra', 4));
  await page.waitForTimeout(120);
  await page.evaluate(() => window.__swDebug.target('betelgeuse'));
  await page.evaluate(() => window.__swDebug.journeyToggle());
  await page.waitForFunction(() => window.__spaceWar.journey && window.__spaceWar.journey.active, { timeout: 5000 });
}

test.describe('Space War — Experiência Interestelar', () => {

  // AC-01: perfil 30/40/30 AO VIVO — fases nos pontos certos, cruzeiro em v_max.
  test('AC-01: 30% acelera, 40% em v_max (CRUZEIRO), 30% freia', async ({ page }) => {
    test.setTimeout(90000);
    await startFlight(page);
    await engageJourney(page);
    const probe = async (sNorm) => {
      await page.evaluate((sn) => window.__swDebug.journeyWarp(sn), sNorm);
      await page.waitForTimeout(350);
      return page.evaluate(() => {
        const j = window.__spaceWar.journey;
        return { phase: j.phase, v: j.v, vMax: j.vMax, beta: j.beta };
      });
    };
    const accel = await probe(0.15);
    expect(accel.phase).toBe('accel');
    expect(accel.v).toBeLessThan(accel.vMax * 0.75);
    const coast = await probe(0.5);
    expect(coast.phase).toBe('coast');
    expect(Math.abs(coast.v - coast.vMax) / coast.vMax).toBeLessThan(0.01);
    // AC-03: headlight FORTE no cruzeiro — β ≥ 0.98 (a 90° o céu cai p/ ~5.7°)
    expect(coast.beta).toBeGreaterThanOrEqual(0.98);
    const decel = await probe(0.85);
    expect(decel.phase).toBe('decel');
    expect(decel.v).toBeLessThan(decel.vMax * 0.75);
  });

  // AC-02/04: os mecanismos de passagem existem e estão armados — crescimento
  // rasante (teto ~48px) e riscos tangenciais (ganho > 0) no diag do starfield.
  test('AC-02/04: crescimento na passagem + riscos tangenciais armados', async ({ page }) => {
    test.setTimeout(90000);
    await startFlight(page);
    await engageJourney(page);
    await page.evaluate(() => window.__swDebug.journeyWarp(0.5));
    await page.waitForTimeout(350);
    const fx = await page.evaluate(() => ({
      fx: window.__spaceWar.starfieldFx,
      field: window.__spaceWar.starfield,
      beta: window.__spaceWar.starfieldBeta,
    }));
    expect(fx.field.mode).toBe('instanced-quads');
    expect(fx.fx.closeMaxPx).toBeGreaterThanOrEqual(40);   // passagens CRESCEM até ~48px
    expect(fx.fx.streakK).toBeGreaterThan(0);              // riscos ∝ ω = v·senθ/d
    expect(fx.beta).toBeGreaterThanOrEqual(0.98);          // relatividade plena no cruzeiro
  });

  // AC-05: IMUNIDADE — a queima atravessa o corredor inteiro sem abortar
  // (reverte o abort-por-impacto do rc-1 por ordem do operador).
  test('AC-05: sem colisão durante a viagem — queima nunca aborta no corredor', async ({ page }) => {
    test.setTimeout(120000);
    await startFlight(page);
    await engageJourney(page);
    const immune = await page.evaluate(() => window.__spaceWar.journey.immune);
    expect(immune).toBe(true);
    // varre o corredor inteiro: a queima segue ativa em todos os pontos
    for (const sn of [0.1, 0.3, 0.5, 0.7, 0.9, 0.97]) {
      await page.evaluate((x) => window.__swDebug.journeyWarp(x), sn);
      await page.waitForTimeout(250);
      const alive = await page.evaluate(() => ({
        active: window.__spaceWar.journey.active,
        hp: window.__spaceWar.ship.hp,
      }));
      expect(alive.active).toBe(true);
      expect(alive.hp).toBeGreaterThan(0);
    }
    // e a CHEGADA continua normal
    await page.evaluate(() => window.__swDebug.journeyWarp(0.999));
    await page.waitForFunction(() => !window.__spaceWar.journey.active, { timeout: 15000 });
    const speed = await page.evaluate(() => window.__spaceWar.ship.speed);
    expect(speed).toBeLessThanOrEqual(1600);
  });
});
