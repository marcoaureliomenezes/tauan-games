const { test, expect } = require('@playwright/test');

// v0.2.0 course-correction contract: the Inhaúma map is a SMALL set of CONTINUOUS
// spline roads with circulating traffic — NOT the 2169-edge OSM spiderweb. These
// assertions prove the corrected reality (few clean roads, smooth geometry, cars on
// the roads, airport kept clear, mountains present, renderer budget) and would FAIL
// against the old dump. (The prior spec asserted >500 roads / >10000 nodes — it was
// the false "confirmation" the operator distrusted; it is intentionally replaced.)
//
// T-01 (v0.11.0, test lifecycle demotion): "roads are FEW, continuous splines"
// deleted — proven by tools/validate-aero-map.js (INHAUMA_ROADS +
// getRoadGraphDiagnostics, same source the E2E read via getMapDiagnostics().roadGraph).
// "keeps regional city orientation" and "contains the required Inhauma landmarks"
// deleted — rebaixados para tools/test-aero-map-constants.mjs. "traffic circulates
// ON the roads" deleted — proven by tools/test-aero-citywar.mjs:229 (military
// traffic on-road/off-shelf/off-airport, 300s sim). "terrain samples prove hills,
// ridge and valley" deleted — proven by tools/test-aero-sim.js:397 ("AC-01:
// mountain chains reach well above the valley floor"). "airport runway is flat and
// campaign targets are grounded" deleted — proven by tools/test-aero-sim.js:436
// ("airport clearing stays operational") + tools/test-aero-formations.mjs:188
// (exclusion/grounding invariants over 600s sim). The two DEM-attribution tests
// (:312/:332) were merged into one below.

test.setTimeout(180000); // boot da cena Inhaúma passa de 60 s sob load alto (2026-07-21)

async function openInhauma(page, seed = 'inhauma-fidelity') {
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(e.message));

  await page.goto(`/src/web-games/aero-fighters/index.html?testMode=1&map=inhauma&seed=${seed}`);
  // Timeouts de CARGA (não são asserções de comportamento): em máquina
  // compartilhada/carregada o boot da cena Inhaúma (DEM + cidade + estradas)
  // passa de 15 s (observado >45 s com load ~20 em 8 cores, 2026-07-21) e o
  // teste morria antes de qualquer assert.
  await page.waitForSelector('canvas', { state: 'attached', timeout: 120000 });
  await page.waitForFunction(() => window.__aeroDebug && window.game, { timeout: 120000 });
  await page.keyboard.press('Space');
  await page.waitForFunction(() => window.game.running === true, { timeout: 5000 });
  return errors;
}

test.describe('Aero Fighters — Inhauma fidelity', () => {
  test('loads the inhauma map with the required diagnostic contract', async ({ page }) => {
    const errors = await openInhauma(page);
    const diag = await page.evaluate(() => window.__aeroDebug.getMapDiagnostics());

    expect(errors).toEqual([]);
    expect(diag.activeMap).toBe('inhauma');
    expect(diag.mapsCovered).toContain('inhauma');
    expect(Array.isArray(diag.cities)).toBe(true);
    expect(Array.isArray(diag.landmarks)).toBe(true);
    expect(Array.isArray(diag.roads)).toBe(true);
    expect(Array.isArray(diag.terrainRegions)).toBe(true);
    expect(diag.airport?.id).toBe('aerodromo-inhauma');
  });

  // AC-09 (v0.2.11, T-10) — merged (T-01, v0.11.0): the Tilezen/joerd (AWS Terrain
  // Tiles) attribution required by the DEM's attribution-only license must be
  // visible in-game (start overlay) for the Inhaúma map, AND must not leak into a
  // non-DEM map's overlay (islands). Both halves of the same AC-09 contract, one test.
  test('DEM attribution credit is visible for Inhauma, and does not leak into a non-DEM map (islands) (AC-09)', async ({ page }) => {
    const errors = [];
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('pageerror', (e) => errors.push(e.message));

    await page.goto('/src/web-games/aero-fighters/index.html?testMode=1&map=inhauma&seed=inhauma-attribution');
    await page.waitForSelector('canvas', { state: 'attached', timeout: 120000 });
    await page.waitForFunction(() => window.__aeroDebug && window.game, { timeout: 120000 });
    const inhaumaOverlay = page.locator('#overlay');
    await expect(inhaumaOverlay).toBeVisible();
    await expect(inhaumaOverlay).toContainText('Terrain data © Tilezen/joerd — AWS Terrain Tiles');
    await page.keyboard.press('Space');
    await page.waitForFunction(() => window.game.running === true, { timeout: 5000 });
    expect(errors).toEqual([]);

    await page.goto('/src/web-games/aero-fighters/index.html?testMode=1&map=islands&seed=inhauma-attribution-negative');
    await page.waitForSelector('canvas', { state: 'attached', timeout: 15000 });
    await page.waitForFunction(() => window.__aeroDebug && window.game, { timeout: 15000 });
    const islandsOverlay = page.locator('#overlay');
    await expect(islandsOverlay).toBeVisible();
    await expect(islandsOverlay).not.toContainText('Tilezen');
  });

  test('player can taxi straight from Inhauma aerodrome and take off', async ({ page }) => {
    // Budgets em tempo de parede num sim frame-a-frame: em runner lento a
    // aceleração real leva múltiplos do tempo interativo (flake 1ª tentativa).
    test.slow();
    await openInhauma(page, 'inhauma-takeoff');
    await page.keyboard.down('KeyW');
    await page.waitForFunction(() => window.game.player.speed >= 38, { timeout: 45000 });
    await page.keyboard.down('ArrowDown');
    await page.waitForFunction(() => window.game.missionRealism.sortie.state === 'AIRBORNE', { timeout: 30000 });
    await page.keyboard.up('ArrowDown');
    await page.keyboard.up('KeyW');

    const state = await page.evaluate(() => ({
      sortieState: window.game.missionRealism.sortie.state,
      y: window.game.player.y,
      z: window.game.player.pz,
      speed: window.game.player.speed,
      dead: window.game.player.dead,
      contact: window.game.missionRealism.groundContact,
    }));

    expect(state.dead).toBe(false);
    expect(state.sortieState).toBe('AIRBORNE');
    expect(state.y).toBeGreaterThan(8);
    expect(state.speed).toBeGreaterThan(40);
    expect(state.contact.type).toBe('runway');
  });

  test('visual smoke shows a non-empty varied Inhauma scene within renderer budget', async ({ page }) => {
    const errors = await openInhauma(page, 'inhauma-visual-smoke');
    // T-07 KEPT: ponto de amostragem CALIBRADO — o orçamento de draw calls (<450)
    // foi medido neste instante (~1 s, meio da transição de câmera, pior caso com
    // o mapa inteiro no frustum; ~385 calls aos 2.5 s, ~247 com a câmera assentada).
    // Trocar por polling de "estabilizou" amostraria uma cena mais leve e mudaria
    // o significado da asserção.
    await page.waitForTimeout(1000);
    const stats = await page.evaluate(() => {
      const snapshot = window.__aeroDebug.getSnapshot();
      return {
        calls: snapshot.renderer.calls,
        triangles: snapshot.renderer.triangles,
        averageFps: snapshot.frames.averageFps,
      };
    });
    const shot = await page.screenshot({ fullPage: false });
    const buckets = new Set();
    for (let i = 0; i < shot.length - 3; i += 97) {
      buckets.add(`${shot[i] >> 5},${shot[i + 1] >> 5},${shot[i + 2] >> 5}`);
    }

    expect(errors).toEqual([]);
    expect(Number.isFinite(stats.calls)).toBe(true);
    expect(Number.isFinite(stats.triangles)).toBe(true);
    expect(Number.isFinite(stats.averageFps)).toBe(true);
    // T-10 (v0.2.11) recalibrated this budget to 300 calls
    // against the PRE-CAMPAIGN map (measured range ~206-243; forest batching was
    // verified to contribute exactly 7 calls regardless of instance count).
    //
    // T-C-14/T-C-15 (v0.3.4 — SPEC §Restrições):
    // the campaign made this view legitimately heavier — the Cachoeira garrison
    // (~44 units), Act-1 formations, MG-060 military trucks and the occupied-town
    // geometry all sit in the boot frustum during the camera transition. The C5
    // wave's per-member Group rendering measured ~900 calls here (and 644 in a
    // realistic Act-1 battle view); T-C-15 routed formation rendering through
    // per-type InstancedMesh batches (formation.js, >5 members — the
    // inhauma-traffic pattern), which brought the same views down to ~408/368.
    //
    // Measured 2026-07-19 post-fix (fresh headless runs, this view): 409 calls
    // at the test's own 1 s sample point (385 at 2.5 s, 247 once the camera
    // settles behind the jet — the 1 s sample is mid-transition with the whole
    // map in frustum; draw-call count is inherently noisy run-to-run, see the
    // T-08 handoff notes). 450 = the SPEC's own campaign ceiling (≤450 calls /
    // ≤800k tris in a full battle) and still catches a real regression (losing
    // the formation batching jumps this back into the ~900 range).
    //
    // Triangles: measured ~125k-158k post-campaign (stable/deterministic across
    // runs, unlike calls — driven by tree instance count, not upload timing).
    // The 800000 cap (T-V-01, operator decision 2026-07-18) is unchanged.
    expect(stats.calls).toBeLessThan(450);
    expect(stats.triangles).toBeLessThan(800000);
    expect(buckets.size).toBeGreaterThan(12);
  });
});
