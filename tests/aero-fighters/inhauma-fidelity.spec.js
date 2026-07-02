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

  await page.goto(`/aero-fighters/index.html?testMode=1&map=inhauma&seed=${seed}`);
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

  test('contains the required Inhauma landmarks inside the central city area', async ({ page }) => {
    await openInhauma(page, 'inhauma-landmarks');
    const diag = await page.evaluate(() => window.__aeroDebug.getMapDiagnostics());
    const city = byId(diag.cities, 'inhauma');
    const required = [
      'igreja-inhauma',
      'campo-inhauma',
      'area-lazer-manga',
      'praca-central-inhauma',
      'aerodromo-inhauma',
    ];

    for (const id of required) {
      const landmark = byId(diag.landmarks, id);
      expect(landmark, `${id} missing`).toBeTruthy();
      if (id !== 'aerodromo-inhauma') {
        const d = Math.hypot(landmark.x - city.x, landmark.z - city.z);
        expect(d, `${id} too far from Inhauma`).toBeLessThan(city.radius + 120);
      }
    }

    const airport = byId(diag.landmarks, 'aerodromo-inhauma');
    expect(Math.hypot(airport.x - city.x, airport.z - city.z)).toBeGreaterThan(city.radius + 80);
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

  test('terrain samples prove hills, ridge and Cachoeira valley are represented', async ({ page }) => {
    await openInhauma(page, 'inhauma-terrain');
    const samples = await page.evaluate(() => {
      const diag = window.__aeroDebug.getMapDiagnostics();
      const byId = (items, id) => items.find((item) => item.id === id);
      const city = byId(diag.cities, 'inhauma');
      const ridge = byId(diag.terrainRegions, 'serra-sete-lagoas');
      const west = byId(diag.terrainRegions, 'morros-oeste-inhauma');
      const north = byId(diag.terrainRegions, 'morro-norte-inhauma');
      const valley = byId(diag.terrainRegions, 'vale-cachoeira-prata');
      return {
        city: window.__aeroDebug.getTerrainHeightAt(city.x, city.z),
        ridge: window.__aeroDebug.getTerrainHeightAt(ridge.cx, ridge.cz),
        west: window.__aeroDebug.getTerrainHeightAt(west.cx, west.cz),
        north: window.__aeroDebug.getTerrainHeightAt(north.cx, north.cz),
        valley: window.__aeroDebug.getTerrainHeightAt(valley.cx, valley.cz),
      };
    });

    expect(Object.values(samples).every(Number.isFinite)).toBe(true);
    expect(samples.ridge).toBeGreaterThan(samples.city + 20);
    expect(samples.west).toBeGreaterThan(samples.city + 12);
    expect(samples.north).toBeGreaterThan(samples.city + 10);
    expect(samples.valley).toBeLessThan(samples.west);
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
    // Fewer draw calls / triangles than the old spiderweb — budget stays comfortable.
    expect(stats.calls).toBeLessThan(220);
    expect(stats.triangles).toBeLessThan(200000);
    expect(buckets.size).toBeGreaterThan(12);
  });
});
