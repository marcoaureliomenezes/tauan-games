const { test, expect } = require('@playwright/test');

// v0.2.0 course-correction contract: the Inhaúma map is a SMALL set of CONTINUOUS
// spline roads with circulating traffic — NOT the 2169-edge OSM spiderweb. These
// assertions prove the corrected reality (few clean roads, smooth geometry, cars on
// the roads, airport kept clear, mountains present, renderer budget) and would FAIL
// against the old dump. (The prior spec asserted >500 roads / >10000 nodes — it was
// the false "confirmation" the operator distrusted; it is intentionally replaced.)

test.setTimeout(60000);

async function openInhauma(page, seed = 'inhauma-fidelity') {
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(e.message));

  await page.goto(`/src/web-games/aero-fighters/index.html?testMode=1&map=inhauma&seed=${seed}`);
  await page.waitForSelector('canvas', { state: 'attached', timeout: 15000 });
  await page.waitForFunction(() => window.__aeroDebug && window.game, { timeout: 15000 });
  await page.keyboard.press('Space');
  await page.waitForFunction(() => window.game.running === true, { timeout: 5000 });
  return errors;
}

function byId(items, id) {
  return items.find((item) => item.id === id);
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

  test('roads are FEW, continuous splines — not the OSM spiderweb', async ({ page }) => {
    await openInhauma(page, 'inhauma-roads');
    const diag = await page.evaluate(() => window.__aeroDebug.getMapDiagnostics());
    const rg = diag.roadGraph;

    // Few continuous roads (course-correction): a small authored set, NOT 500+ OSM ways.
    expect(diag.roads.length).toBeGreaterThanOrEqual(3);
    expect(diag.roads.length).toBeLessThanOrEqual(12);
    expect(rg.source).toBe('inhauma-authored-continuous-v2');
    expect(rg.edgeCount).toBe(diag.roads.length);

    // Anti-spiderweb guard: the whole network is a few hundred points, not ~18k segments.
    const totalPoints = diag.roads.reduce((sum, road) => sum + road.points.length, 0);
    expect(totalPoints).toBeLessThan(2000);

    // Each road is a single CONTINUOUS polyline (dense, no jumps between samples).
    for (const road of diag.roads) {
      expect(road.points.length).toBeGreaterThanOrEqual(10);
      let maxGap = 0;
      for (let i = 1; i < road.points.length; i++) {
        maxGap = Math.max(maxGap, Math.hypot(road.points[i].x - road.points[i - 1].x, road.points[i].z - road.points[i - 1].z));
      }
      expect(maxGap, `road ${road.id} has a gap`).toBeLessThan(25);
    }

    // Clean geometry that follows the terrain smoothly (no cliffs / zero-length spikes).
    expect(rg.renderClasses?.highway).toBeGreaterThanOrEqual(1);
    expect(rg.renderClasses?.regional).toBeGreaterThanOrEqual(1);
    expect(rg.renderClasses?.street).toBeGreaterThanOrEqual(1);
    expect(rg.geometry?.zeroLengthSegments).toBe(0);
    expect(rg.geometry?.maxSegmentLength).toBeLessThan(30);
    expect(rg.geometry?.roadBedSmoothness?.sampleCount).toBeGreaterThan(100);
    expect(rg.geometry?.roadBedSmoothness?.p99AdjacentHeightDelta).toBeLessThan(8);
    expect(rg.roadBed?.segmentCount).toBeGreaterThan(diag.roads.length);
    expect(rg.roadBed?.segmentCount).toBeGreaterThan(100);
    expect(rg.roadBed?.bucketCount).toBeGreaterThan(20);

    // A handful of real intersections — not thousands of OSM junction patches.
    expect(rg.intersections?.candidateCount).toBeLessThanOrEqual(20);
    expect(rg.intersections?.renderedCount).toBe(rg.intersections.candidateCount);
    expect(rg.intersections?.omittedCount).toBe(0);

    // Road furniture + named-route signage still present.
    expect(rg.renderDetails?.routeLabelSignCount).toBeGreaterThanOrEqual(4);
    expect(rg.namedRoutes?.['mg-238']?.pointCount).toBeGreaterThan(30);

    // NO road touches the runway, safety area, or approach corridors.
    const airportConflicts = [];
    for (const road of diag.roads) {
      for (const p of road.points) {
        const zone = rg.airportExclusionZones.find((c) =>
          Math.abs(p.x - c.cx) <= c.halfW && Math.abs(p.z - c.cz) <= c.halfL);
        if (zone) airportConflicts.push({ road: road.id, zone: zone.id, ...p });
      }
    }
    expect(airportConflicts).toEqual([]);
  });

  test('keeps regional city orientation faithful to the reference route', async ({ page }) => {
    await openInhauma(page, 'inhauma-orientation');
    const diag = await page.evaluate(() => window.__aeroDebug.getMapDiagnostics());
    const inhauma = byId(diag.cities, 'inhauma');
    const cachoeira = byId(diag.cities, 'cachoeira-da-prata');
    const sete = byId(diag.cities, 'sete-lagoas');

    expect(inhauma).toBeTruthy();
    expect(cachoeira).toBeTruthy();
    expect(sete).toBeTruthy();
    expect(cachoeira.x).toBeLessThan(inhauma.x - 350);
    expect(cachoeira.z).toBeGreaterThan(inhauma.z + 150);
    expect(sete.x).toBeGreaterThan(inhauma.x + 600);
    expect(sete.z).toBeLessThan(inhauma.z - 150);
  });

  // T-10 (aero-fighters-inhauma-serra-v1), round 2: this test used to measure each
  // landmark's distance against the INHAUMA_CITIES 'inhauma' diagnostic circle
  // (x:0, z:0, radius:260 in inhauma.js). That circle is hand-authored, diagnostics-only
  // metadata -- grepped for every consumer: it is exposed by debug.js and read only here
  // and by the "keeps regional city orientation" test above, whose assertions are
  // relative offsets between OTHER cities and never depend on this circle's exact value.
  // T-09 (commit a0fc356) relocated the whole terraced downtown onto the valley shelf
  // near the airport (buildTown's DOWNTOWN_CENTER = {x:-370,z:-20} in
  // inhauma-scene.js) but this unrelated 'inhauma' city circle was never repositioned to
  // match, so 2 of the 4 civil landmarks (campo-inhauma measured 414m, praca-central
  // measured 390m from (0,0)) now fall outside the old radius+120=380m threshold -- a
  // stale-diagnostic-fixture failure, not a product bug: PLAZA={x:-390,z:0} and
  // FIELDS=[{x:-410,z:-60},{x:-250,z:-40}] in inhauma-scene.js match INHAUMA_LANDMARKS
  // exactly, i.e. the landmarks themselves ARE at their real, correct production
  // positions (confirmed by the same PLAZA/FIELDS constants that gate the paved-ground
  // material there); only the unrelated 'inhauma' city circle is stale.
  //
  // Replaced the city-circle proxy with a direct clustering assertion against the
  // landmarks' own centroid -- this measures the actual invariant under test ("the civil
  // landmarks form a real, walkable downtown"), independent of the untracked city-circle
  // metadata, and is materially STRONGER than the original bound (measured max 95m from
  // centroid today vs. the old 380m city-circle threshold).
  test('contains the required Inhauma landmarks inside the central city area', async ({ page }) => {
    await openInhauma(page, 'inhauma-landmarks');
    const diag = await page.evaluate(() => window.__aeroDebug.getMapDiagnostics());
    const required = [
      'igreja-inhauma',
      'campo-inhauma',
      'area-lazer-manga',
      'praca-central-inhauma',
      'aerodromo-inhauma',
    ];

    for (const id of required) {
      expect(byId(diag.landmarks, id), `${id} missing`).toBeTruthy();
    }

    const civilIds = ['igreja-inhauma', 'campo-inhauma', 'area-lazer-manga', 'praca-central-inhauma'];
    const civil = civilIds.map((id) => byId(diag.landmarks, id));
    const centroid = {
      x: civil.reduce((sum, l) => sum + l.x, 0) / civil.length,
      z: civil.reduce((sum, l) => sum + l.z, 0) / civil.length,
    };
    for (const landmark of civil) {
      const d = Math.hypot(landmark.x - centroid.x, landmark.z - centroid.z);
      expect(d, `${landmark.id} not clustered with the rest of downtown`).toBeLessThan(160);
    }

    // The airport stays well clear of the civilian downtown cluster (measured ~415m).
    const airport = byId(diag.landmarks, 'aerodromo-inhauma');
    const airportDistance = Math.hypot(airport.x - centroid.x, airport.z - centroid.z);
    expect(airportDistance, 'airport too close to the civilian downtown cluster').toBeGreaterThan(300);
  });

  test('traffic circulates ON the roads, grounded, never on the airport', async ({ page }) => {
    await openInhauma(page, 'inhauma-traffic-grounded');
    const timeline = [];
    for (let i = 0; i < 4; i++) {
      await page.waitForTimeout(450);
      timeline.push(await page.evaluate(() => window.__aeroDebug.getMapDiagnostics().traffic));
    }
    const traffic = timeline[timeline.length - 1];
    expect(traffic?.routeCount).toBeGreaterThanOrEqual(3);
    expect(traffic?.carCount).toBeGreaterThanOrEqual(20);
    expect(traffic?.active?.classSpeedBands?.['3'] || traffic?.active?.classSpeedBands?.['4']).toBeTruthy();

    // Cars actually move (circulate) across the timeline.
    const firstSamples = timeline.map((t) => t?.active?.samples?.[0]).filter(Boolean);
    expect(firstSamples.length).toBe(timeline.length);
    expect(Math.hypot(firstSamples.at(-1).x - firstSamples[0].x, firstSamples.at(-1).z - firstSamples[0].z)).toBeGreaterThan(6);

    for (const snapshot of timeline) {
      expect(snapshot?.active?.checkedCars).toBeGreaterThanOrEqual(25);
      expect(snapshot?.active?.samples?.length).toBeGreaterThan(0);
      expect(snapshot?.active?.airportSurfaceSamples).toBe(0);
      expect(snapshot?.active?.airportExclusionSamples).toBe(0);
      expect(snapshot?.active?.offRoadSamples).toBe(0);
      expect(snapshot?.active?.wheelHeightViolations).toBe(0);
      expect(snapshot?.active?.maxClearanceError).toBeLessThanOrEqual(0.02);
      expect(snapshot?.active?.pitchAlignedCars).toBe(snapshot.active.checkedCars);
      expect(snapshot?.active?.maxBodyPitchDeg).toBeLessThanOrEqual(19);
    }
  });

  // T-10 (aero-fighters-inhauma-serra-v1): this test used to key its sample points off
  // diag.terrainRegions (serra-sete-lagoas / morros-oeste-inhauma / morro-norte-inhauma /
  // vale-cachoeira-prata), which are positions from the v0.2.0 FBM-era INHAUMA_FEATURES
  // list. T-03 replaced the FBM base with the real DEM and explicitly neutralized
  // INHAUMA_FEATURES's height contribution (see the comment above that export in
  // inhauma-scene.js: "esses nomes/posições apontavam para morros autorais que já não
  // existem" — those names/positions no longer correspond to real terrain). This is a
  // STALE EXPECTATION, not a product bug: terrainRegions is diagnostics-only metadata,
  // consumed nowhere in gameplay, only by this test. Replaced with coordinates
  // independently verified against the live DEM (node probe against
  // inhaumaContinuousHeight, 2026-07-15 — matches the same production height chain this
  // page reads via getTerrainHeightAt), reusing the exact two points and the +400 m
  // margin already established by the Node sim test's AC-01 assertion
  // ('mountain chains reach well above the valley floor', test-aero-sim.js) — an EQUALLY
  // STRONG invariant against the new terrain, now proven end-to-end through the live
  // rendered page instead of Node math alone, plus a third chain on a distinct flank and
  // a genuine second valley-floor sample (the DEM-drainage river's own polyline
  // midpoint, T-05/AC-03) to keep the "hills, ridge AND valley" breadth of the original
  // assertion.
  test('terrain samples prove hills, ridge and Cachoeira valley are represented', async ({ page }) => {
    await openInhauma(page, 'inhauma-terrain');
    const samples = await page.evaluate(() => {
      const h = window.__aeroDebug.getTerrainHeightAt;
      return {
        city: h(0, 0),               // low valley/city floor near the airport (measured ~5.7 m)
        eastChain: h(9000, 0),        // DEM chain east of the valley (measured ~857 m)
        southMassif: h(0, 8000),      // DEM massif south of the valley (measured ~1168 m)
        northChain: h(-1500, -9000),  // DEM chain north-west of the valley (measured ~634 m)
        riverValley: h(800, -1200),   // real DEM-drainage river polyline midpoint (T-05/AC-03) — a
                                       // second, distinct valley-floor location (measured ~8.8 m)
      };
    });

    expect(Object.values(samples).every(Number.isFinite)).toBe(true);
    // Valley/city floor stays low (same 20 m bound the Node AC-01 sim test uses for its
    // own valley-floor sample at the origin).
    expect(samples.city).toBeLessThan(20);
    expect(samples.riverValley).toBeLessThan(20);
    // Chains on 3 distinct flanks all rise well above the valley floor — same 400 m
    // margin as the Node AC-01 sim assertion (real DEM peaks reach ~1281 m; the old FBM
    // terrain topped out at ~140 m, so 400 m is only meaningful post-T-03).
    expect(samples.eastChain).toBeGreaterThan(samples.city + 400);
    expect(samples.southMassif).toBeGreaterThan(samples.city + 400);
    expect(samples.northChain).toBeGreaterThan(samples.city + 400);
  });

  test('airport runway is flat and mission targets are grounded away from civil landmarks', async ({ page }) => {
    await openInhauma(page, 'inhauma-airport-targets');
    await page.waitForFunction(() => window.game.targets.length > 0, { timeout: 5000 });
    const result = await page.evaluate(() => {
      const diag = window.__aeroDebug.getMapDiagnostics();
      const airport = diag.airport;
      const runway = airport.runwayBounds;
      const heights = [];
      for (let dz = -runway.length / 2; dz <= runway.length / 2; dz += 80) {
        for (let dx = -runway.width / 2; dx <= runway.width / 2; dx += 12) {
          heights.push(window.__aeroDebug.getTerrainHeightAt(runway.center.x + dx, runway.center.z + dz));
        }
      }
      const targets = window.__aeroDebug.getTargetDiagnostics();
      const landmarks = diag.landmarks.filter((l) => ['igreja-inhauma', 'campo-inhauma', 'area-lazer-manga', 'praca-central-inhauma'].includes(l.id));
      const onCivil = targets.filter((target) => landmarks.some((landmark) =>
        Math.hypot(target.x - landmark.x, target.z - landmark.z) < landmark.radius + 18,
      ));
      return {
        flat: heights.every((h) => Math.abs(h - airport.elevation) < 0.001),
        grounded: targets.filter((target) => !target.grounded),
        onCivil,
        targetCount: targets.length,
      };
    });

    expect(result.flat).toBe(true);
    expect(result.targetCount).toBeGreaterThan(0);
    expect(result.grounded).toEqual([]);
    expect(result.onCivil).toEqual([]);
  });

  // AC-09 (aero-fighters-inhauma-serra-v1, T-10): the Tilezen/joerd (AWS Terrain Tiles)
  // attribution required by the DEM's attribution-only license must be visible in-game,
  // not just recorded in the vendored asset's JSON metadata. It is shown in the start
  // overlay (main.js#selectMap -> hud.js#showOverlay) BEFORE the player presses Space —
  // i.e. before openInhauma()'s helper would dismiss it — so this test intentionally
  // does NOT reuse openInhauma() and inspects the overlay first.
  test('DEM attribution credit is visible in-game before takeoff (AC-09)', async ({ page }) => {
    const errors = [];
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('pageerror', (e) => errors.push(e.message));

    await page.goto('/src/web-games/aero-fighters/index.html?testMode=1&map=inhauma&seed=inhauma-attribution');
    await page.waitForSelector('canvas', { state: 'attached', timeout: 15000 });
    await page.waitForFunction(() => window.__aeroDebug && window.game, { timeout: 15000 });

    const overlay = page.locator('#overlay');
    await expect(overlay).toBeVisible();
    await expect(overlay).toContainText('Terrain data © Tilezen/joerd — AWS Terrain Tiles');

    // The credit is Inhaúma-specific (the other 3 maps have no DEM asset, no
    // attribution owed) — assert it does NOT leak into another map's start overlay.
    await page.keyboard.press('Space');
    await page.waitForFunction(() => window.game.running === true, { timeout: 5000 });
    expect(errors).toEqual([]);
  });

  test('DEM attribution credit does not leak into a non-DEM map (islands)', async ({ page }) => {
    await page.goto('/src/web-games/aero-fighters/index.html?testMode=1&map=islands&seed=inhauma-attribution-negative');
    await page.waitForSelector('canvas', { state: 'attached', timeout: 15000 });
    await page.waitForFunction(() => window.__aeroDebug && window.game, { timeout: 15000 });
    const overlay = page.locator('#overlay');
    await expect(overlay).toBeVisible();
    await expect(overlay).not.toContainText('Tilezen');
  });

  test('player can taxi straight from Inhauma aerodrome and take off', async ({ page }) => {
    await openInhauma(page, 'inhauma-takeoff');
    await page.keyboard.down('KeyW');
    await page.waitForFunction(() => window.game.player.speed >= 38, { timeout: 15000 });
    await page.keyboard.down('ArrowDown');
    await page.waitForFunction(() => window.game.missionRealism.sortie.state === 'AIRBORNE', { timeout: 10000 });
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
    // T-10 (aero-fighters-inhauma-serra-v1) recalibration: this budget was set at 220
    // calls / 200000 triangles against the OLD FBM-era map (~140 m peaks, 185 trees —
    // see the T-08 handoff finding: pre-T-08 code was accidentally starving tree count
    // with a stale height cutoff). The new DEM map legitimately renders more — T-06
    // added 3 bridge InstancedMesh, T-08 restored the intended ~2000-tree density
    // (still fully instanced, same draw-call cost per species) — and this is NOT an
    // instancing regression (verified: buildForests still contributes exactly 7 draw
    // calls regardless of instance count).
    //
    // Measured 2026-07-15 (8 fresh headless runs, this commit): calls ranged 223-233;
    // an earlier `npx playwright test` pass (with retries, same commit) additionally
    // hit 234-240. Combined with the T-08 handoff's own bisection notes (baseline
    // already ranged 206-217 at T-04, 210-228 at T-07, i.e. draw-call count is
    // inherently noisy run-to-run even at a fixed commit/seed — texture/geometry upload
    // ordering, not instance count), the realistic observed range across this release's
    // commits is ~206-243. 300 keeps ~25% headroom above the highest observed value
    // while still catching a real regression (e.g. losing InstancedMesh batching, which
    // would jump calls into the thousands). A forthcoming T-07 visual-polish follow-up
    // (biome color tuning + altitude-scaled ridged detail noise, same seg=54 grid, same
    // instancing) is expected to leave this count materially unchanged, which is why the
    // budget is calibrated with headroom rather than to the exact current count.
    //
    // Triangles: measured 146276-147860 (stable/deterministic across runs, unlike
    // calls — driven by tree instance count, not upload timing). T-V-01
    // (aero-fighters-inhauma-visual-uplift-v1, operator decision 2026-07-18): the
    // 200000 cap was the self-imposed ceiling the map audit identified as blocking
    // visual upgrades (backdrop mountains, richer city geometry, finer terrain).
    // Raised to 800000 — still far inside Iris Xe budget at 1080p — while remaining
    // a real regression guard (e.g. an accidentally un-instanced building batch
    // would blow past it).
    expect(stats.calls).toBeLessThan(300);
    expect(stats.triangles).toBeLessThan(800000);
    expect(buckets.size).toBeGreaterThan(12);
  });
});
