const { test, expect } = require('@playwright/test');

// T-07 (v0.10.0) — todos os sleeps fixos deste spec viraram waitForFunction sobre
// estado real (jogo rodando + velocidade, velocidade de rotação, liftoff).
//
// T-01 (v0.11.0, test lifecycle demotion): "MR landing diagnostics expose envelope
// and surface classification" deleted — the debug-contract field shape it checked
// is the same semantic tools/test-aero-sortie-sim.js:52 ("takeoff and landing
// envelopes enforce runway constraints") already exercises against the real
// evaluateLandingEnvelope/evaluateTakeoffEnvelope. Kept only the :38 real-input
// BI test below, which the file's own header explains cannot move to Node
// (jet.position lives in THREE.js, not exposed on window) — and removed its
// duplicated waitForFunction block (the reachedAirborne re-poll below repeated
// the same condition the earlier waitForFunction had already confirmed).

// ─── Step 5 E2E: landing contract + flight reachability ──────────────────────
// The numerical invariants of the landing cycle (single TOUCHDOWN_SAFE, no state
// revert, bounce ≤ 0.3 m, monotone decay) are gated by the headless sim test
// `tests/aero-fighters/tools/test-aero-sortie-sim.js` ("full landing cycle") which
// runs the deterministic physics directly. Browser E2E cannot teleport the jet
// because `jet.position` lives in THREE.js and is not exposed on `window` — and
// `window.game.player.{x,y,pz}` are read-only projections written FROM `jet.position`
// each frame, not back to it.
//
// This E2E therefore validates what the sim cannot:
//   1. The debug contract surfaces all landing fields (`touchdownReady`, `unsafe`,
//      `lastTouchdownTime`) in the running browser build.
//   2. The in-browser takeoff path reaches AIRBORNE under real keyboard input,
//      proving Step 2 (smooth liftoff + floor clamp) works end-to-end against
//      the actual scene/renderer/physics tick (not just the headless sim).
test('E2E landing contract: debug fields present + takeoff reaches AIRBORNE', async ({ page }) => {
  test.setTimeout(45000);
  await page.goto('/src/web-games/aero-fighters/index.html?testMode=1&map=desert&seed=mr-landing');
  await page.waitForFunction(() => window.__aeroDebug && window.game, { timeout: 120000 });

  // Contract assertion: snapshot exposes the new landing fields (Step 3 + Hotfix).
  const initialSnap = await page.evaluate(() => window.__aeroDebug.getSnapshot());
  expect(initialSnap.landingEnvelope).toHaveProperty('safe');
  expect(initialSnap.landingEnvelope).toHaveProperty('touchdownReady');
  expect(initialSnap.landingEnvelope).toHaveProperty('unsafe');
  // lastTouchdownTime is null before any touchdown fires.
  const td0 = await page.evaluate(
    () => window.game.missionRealism?.sortie?.lastTouchdownTime ?? null
  );
  expect(td0).toBeNull();

  // Drive a real-input takeoff to prove the in-browser physics path works.
  // The full landing cycle (touchdown + bounce + state) is gated by the
  // headless sim test — this E2E proves the scene/renderer/physics tick reach
  // AIRBORNE under user input, which is what only the browser can verify.
  await page.keyboard.press('Space');
  await page.waitForFunction(() => window.game.running === true, { timeout: 5000 });
  await page.keyboard.down('KeyW');
  // T-07: polling da velocidade de rotação (ROTATION_SPEED=38, ground-physics.js)
  await page.waitForFunction(() => window.game.player.speed >= 38, { timeout: 14000 });
  await page.keyboard.down('ArrowDown');
  // T-07: polling do liftoff real — segura ↓ até AIRBORNE em vez de tempo fixo.
  await page.waitForFunction(
    () => {
      const state = window.game.missionRealism?.sortie?.state;
      return state === 'AIRBORNE' || state === 'MISSION_ACTIVE' || state === 'RETURN_TO_BASE';
    },
    { timeout: 12000 }
  );
  await page.keyboard.up('ArrowDown');
  await page.keyboard.up('KeyW');

  // After AIRBORNE, the snapshot must still expose the landing contract.
  const airborneSnap = await page.evaluate(() => window.__aeroDebug.getSnapshot());
  expect(airborneSnap.landingEnvelope).toHaveProperty('touchdownReady');
  expect(airborneSnap.landingEnvelope.touchdownReady).toBe(false); // not on final
});
