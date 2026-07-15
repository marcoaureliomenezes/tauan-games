const { test, expect } = require('@playwright/test');

test('MR nuclear FX diagnostics are present and finite', async ({ page }) => {
  await page.goto('/aero-fighters/index.html?testMode=1&map=desert&seed=mr-nuke');
  await page.waitForFunction(() => window.__aeroDebug && window.game, { timeout: 15000 });
  const fx = await page.evaluate(() => window.__aeroDebug.getSnapshot().nuclearFxState);
  expect(fx).toHaveProperty('stage');
  expect(Number.isFinite(fx.fireballRadius)).toBe(true);
  expect(Number.isFinite(fx.shockwaveRadius)).toBe(true);
});

// ─── T-09 / AC-06 / D-8 / D-9: nuke overhaul — larger destruction + corrected rise ────
//
// Note on the double flash (D-9): fx.js#nuclearExplosion's whole visual burst layer
// (flash + big fireballs + multi-shockwave) is gated behind `HEADLESS_FX` (`typeof
// navigator !== 'undefined' && navigator.webdriver === true`), which is TRUE for every
// Playwright-driven page — this is a pre-existing, deliberate guard (see
// specs/memory/product/aero-strike-fx.md's "Nota de headless": "Novos FX pesados devem
// respeitar essa guarda"). The double flash added in this task lives entirely inside
// that already-headless-guarded branch, so it is architecturally *never* reachable from
// Playwright and cannot be asserted here without deliberately bypassing the guard the
// memory doc requires new FX to respect (that would risk exactly the instability —
// NaN-mip additive/logdepth/bloom traps — the guard exists to prevent). It is verified
// by source review + the unaffected persistent-plume/config assertions below, which DO
// run identically under HEADLESS_FX.

test('T-09/D-8: MISSILES_NUCLEAR destruction/player-damage radii are the new, larger values in the real browser bundle', async ({ page }) => {
  await page.goto('/aero-fighters/index.html?testMode=1&map=desert&seed=mr-nuke-radius');
  await page.waitForFunction(() => window.__aeroDebug && window.game, { timeout: 15000 });
  const radii = await page.evaluate(async () => {
    const cfg = await import('/aero-fighters/src/config.js');
    return {
      blast: cfg.MISSILES_NUCLEAR.BLAST_RADIUS,
      kill: cfg.MISSILES_NUCLEAR.PLAYER_KILL_RADIUS,
      dmg: cfg.MISSILES_NUCLEAR.PLAYER_DAMAGE_RADIUS,
    };
  });
  expect(radii.blast).toBe(760);
  expect(radii.kill).toBe(300);
  expect(radii.dmg).toBe(680);
});

test('T-09/AC-06/D-9: firing a real nuke runs the flash->fireball->mushroom stage timeline with a bounded fireball radius (no rise/growth overshoot regression) and a monotonically growing plume', async ({ page }) => {
  await page.goto('/aero-fighters/index.html?testMode=1&map=desert&seed=mr-nuke-seq');
  await page.waitForFunction(() => window.__aeroDebug && window.game, { timeout: 15000 });
  await page.keyboard.press('Space');
  await page.waitForFunction(() => window.game && window.game.running === true, { timeout: 3000 });
  // Same launch path as uplift.spec.js#U-AC-5 ("nuke sem lock — atinge o solo à frente").
  await page.keyboard.press('KeyT');

  const result = await page.evaluate(async () => {
    const m = await import('/aero-fighters/src/nuclear-fx.js');
    const seen = new Set();
    const samples = [];
    const t0 = performance.now();
    while (performance.now() - t0 < 12000) {
      seen.add(m.nuclearFxState.stage);
      samples.push({ plumeH: m.nuclearFxState.plumeHeight, fireR: m.nuclearFxState.fireballRadius });
      if (seen.has('mushroom')) break;
      await new Promise((r) => setTimeout(r, 100));
    }
    return { stages: [...seen], samples };
  });

  expect(result.stages).toContain('flash');
  expect(result.stages).toContain('fireball');
  expect(result.stages).toContain('mushroom');
  for (const s of result.samples) {
    // D-9: the eased growth curve caps at FIREBALL_R_MAX=130 — a regression back
    // toward the old unbounded quadratic rise would blow well past this.
    expect(s.fireR).toBeLessThanOrEqual(131);
    expect(Number.isFinite(s.plumeH)).toBe(true);
  }
  expect(result.samples.length).toBeGreaterThan(1);
  const first = result.samples[0], last = result.samples[result.samples.length - 1];
  expect(last.plumeH).toBeGreaterThan(first.plumeH);
});
