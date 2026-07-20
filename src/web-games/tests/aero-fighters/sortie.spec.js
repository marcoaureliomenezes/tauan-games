const { test, expect } = require('@playwright/test');
const path = require('path');

// NOTE: GROUND_STATES is kept as a local Set here intentionally.
// Playwright specs run in a browser context via page.evaluate(); they cannot import
// Node/ES-module source files directly. The canonical definition lives in
// src/web-games/aero-fighters/src/sortie-state.js — keep both in sync if states ever change.
const GROUND_STATES = new Set(['TAXI_OUT', 'TAKEOFF_ROLL', 'LANDING_ROLL', 'TAXI_IN']);
const AIRPORT_ELEVATION = 0; // desertAirport.elevation

async function openAero(page) {
  await page.goto('/src/web-games/aero-fighters/index.html?testMode=1&map=desert&seed=mr-sortie');
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
  await page.goto('/src/web-games/aero-fighters/index.html?testMode=1&map=desert&seed=mr-takeoff');
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

// ─── Task B — Visual smoke: desert runway must be flat (no terrain height > 0) ─
// Loads map=desert in testMode, samples terrain height at a grid covering the
// runway + taxiway + service footprint at 10 m resolution using the runtime
// __aeroDebug.getTerrainHeightAt(x, z) hook (same function the map validator uses).
// Any sample > 0 means a terrain feature (mesa/noise) is intruding into the airport,
// which is the exact defect the airport-flatten fix (Step 1) was meant to prevent.
// A runway-camera screenshot is saved for operator eyeball verification.
//
// Desert airport geometry (from src/airport.js):
//   Runway:      center (-160, 120), length 760, width 58   → x ∈ [-189,−131], z ∈ [−260, 500]
//   Taxiway:     center (-160, 260), length 180, width 34   → x ∈ [-177,−143], z ∈ [ 170, 350]
//   ServiceZone: center (-160, 350), length  86, width 70   → x ∈ [-195,−125], z ∈ [ 307, 393]
test('Visual smoke: desert runway terrain height is 0 everywhere in airport footprint', async ({ page }) => {
  await page.goto('/src/web-games/aero-fighters/index.html?map=desert&testMode=1');
  await page.waitForFunction(() => window.__aeroDebug && window.game, { timeout: 15000 });

  // Sample the combined footprint at 10 m resolution.
  // Returns an array of { x, z, height } for any sample where height > 0.
  const intrusions = await page.evaluate(() => {
    const STEP = 10;
    const zones = [
      // [xMin, xMax, zMin, zMax] — all inclusive
      [-189, -131, -260, 500],   // runway
      [-177, -143,  170, 350],   // taxiway
      [-195, -125,  307, 393],   // service zone
    ];
    const found = [];
    for (const [xMin, xMax, zMin, zMax] of zones) {
      for (let x = xMin; x <= xMax; x += STEP) {
        for (let z = zMin; z <= zMax; z += STEP) {
          const h = window.__aeroDebug.getTerrainHeightAt(x, z);
          if (h > 0) found.push({ x, z, height: h });
        }
      }
    }
    return found;
  });

  // Save screenshot for operator eyeball check regardless of result.
  // The image path is relative to the spec file so it stays under version control.
  const screenshotPath = path.join(__dirname, 'screenshots', 'desert-runway-clean.png');
  await page.screenshot({ path: screenshotPath, fullPage: false });

  // Assert: zero terrain intrusions into airport footprint.
  expect(intrusions.length).toBe(0,
    `Terrain height > 0 detected inside desert airport footprint at ${intrusions.length} sample(s):\n` +
    JSON.stringify(intrusions.slice(0, 5), null, 2)
  );
});
