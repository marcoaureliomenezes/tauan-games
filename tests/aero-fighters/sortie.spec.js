const { test, expect } = require('@playwright/test');

// NOTE: GROUND_STATES is kept as a local Set here intentionally.
// Playwright specs run in a browser context via page.evaluate(); they cannot import
// Node/ES-module source files directly. The canonical definition lives in
// aero-fighters/src/sortie-state.js — keep both in sync if states ever change.
const GROUND_STATES = new Set(['TAXI_OUT', 'TAKEOFF_ROLL', 'LANDING_ROLL', 'TAXI_IN']);
const AIRPORT_ELEVATION = 0; // desertAirport.elevation

async function openAero(page) {
  await page.goto('/aero-fighters/index.html?testMode=1&map=desert&seed=mr-sortie');
  await page.waitForFunction(() => window.__aeroDebug && window.game, { timeout: 15000 });
}

test('MR sortie debug contract starts at Tauan desert airport', async ({ page }) => {
  await openAero(page);
  const s = await page.evaluate(() => window.__aeroDebug.getSnapshot());
  expect(s.selectedMap).toBe('desert');
  expect(s.sortieState).toBe('MENU');
  expect(s.airportText.value).toBe('AEROPORTO DO TAUAN E DO PAPAI');
  expect(s.runwayBounds.length).toBeGreaterThan(700);
});

test('MR start enters taxi sortie state', async ({ page }) => {
  await openAero(page);
  await page.keyboard.press('Space');
  await page.waitForFunction(() => window.game.running === true);
  const s = await page.evaluate(() => window.__aeroDebug.getSnapshot());
  expect(['TAXI_OUT', 'TAKEOFF_ROLL']).toContain(s.sortieState);
  expect(s.gearState).toBe('DEPLOYED');
});

// ─── Step 5 E2E: takeoff floor invariant + smooth liftoff delta ───────────────
// Uses seed=mr-takeoff. Polls snapshots for ~5 s of simulated takeoff.
// Invariant A: player.y >= airportElevation (0) every frame in ground states.
// Invariant B: no single-frame Δy > 1 m during LIFTOFF transition.
test('E2E takeoff: y stays above airport elevation and liftoff delta <= 1m', async ({ page }) => {
  await page.goto('/aero-fighters/index.html?testMode=1&map=desert&seed=mr-takeoff');
  await page.waitForFunction(() => window.__aeroDebug && window.game, { timeout: 15000 });

  // Start the sortie
  await page.keyboard.press('Space');
  await page.waitForFunction(() => window.game.running === true, { timeout: 5000 });

  // Hold throttle up (W key) for the entire takeoff run
  await page.keyboard.down('KeyW');

  const SAMPLE_MS = 100;         // poll every 100 ms
  const TOTAL_SAMPLES = 50;      // 5 seconds total

  const violations = [];
  const liftoffDeltas = [];
  let prevY = null;
  let prevState = null;

  for (let i = 0; i < TOTAL_SAMPLES; i++) {
    await page.waitForTimeout(SAMPLE_MS);

    const snap = await page.evaluate(() => ({
      y: window.__aeroDebug.getSnapshot().player.y,
      state: window.__aeroDebug.getSnapshot().sortieState,
    }));

    const { y, state } = snap;

    // Invariant A: y >= airportElevation during ground states
    if (GROUND_STATES.has(state) && y < AIRPORT_ELEVATION) {
      violations.push({ i, state, y });
    }

    // Invariant B: no single-frame Δy > 1 m during LIFTOFF transition
    // We detect the LIFTOFF transition as the frame where state changes from
    // TAKEOFF_ROLL to something else, or as any frame where we were in TAKEOFF_ROLL.
    if (prevState === 'TAKEOFF_ROLL' && prevY !== null) {
      const deltaY = Math.abs(y - prevY);
      if (deltaY > 0.01) {
        liftoffDeltas.push({ i, deltaY, from: prevY, to: y });
        if (deltaY > 1) {
          violations.push({ i, state, y, deltaY, msg: 'single-frame Δy > 1 m during TAKEOFF_ROLL' });
        }
      }
    }

    prevY = y;
    prevState = state;

    // Stop early if airborne
    if (state === 'AIRBORNE') break;
  }

  await page.keyboard.up('KeyW');

  // Report Invariant A violations
  expect(violations.filter(v => !v.deltaY).length).toBe(0,
    `Player went underground during ground states: ${JSON.stringify(violations.filter(v => !v.deltaY).slice(0, 3))}`
  );

  // Report Invariant B violations
  const bigDeltas = violations.filter(v => v.deltaY);
  expect(bigDeltas.length).toBe(0,
    `Single-frame liftoff Δy > 1 m detected: ${JSON.stringify(bigDeltas.slice(0, 3))}`
  );
});
