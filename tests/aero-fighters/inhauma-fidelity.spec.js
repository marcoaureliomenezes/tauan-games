const { test, expect } = require('@playwright/test');

test.setTimeout(60000);

async function openInhauma(page, seed = 'inhauma-fidelity') {
  const errors = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
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

    expect(diag.roads.length).toBeGreaterThan(500);
    expect(diag.roadGraph?.source).toBe('inhauma-osm-pbf-web-export-v1');
    expect(diag.roadGraph?.inputSha256).toMatch(/^[0-9a-f]{64}$/);
    expect(diag.roadGraph?.rawRoadFeatureCount).toBeGreaterThan(5000);
    expect(diag.roadGraph?.edgeCount).toBe(diag.roads.length);
    expect(diag.roadGraph?.nodeCount).toBeGreaterThan(10000);
    expect(diag.roadGraph?.largestComponentNodeCount).toBeGreaterThan(1000);
    expect(diag.roadGraph?.airportExclusionZones?.length).toBeGreaterThanOrEqual(5);
    expect(diag.roadGraph?.namedRoutes?.['mg-238']?.pointCount).toBeGreaterThan(100);
    expect(diag.roadGraph?.namedRoutes?.['mg-238-mg-424']?.pointCount).toBeGreaterThan(20);
    expect(diag.roadGraph?.roadBed?.segmentCount).toBeGreaterThan(diag.roadGraph.edgeCount);
    expect(diag.roadGraph?.roadBed?.bucketCount).toBeGreaterThan(100);
    for (const key of ['highway', 'regional', 'street', 'service']) {
      expect(diag.roadGraph?.renderClasses?.[key]).toBeGreaterThan(0);
    }
    expect(diag.roadGraph?.renderLayers?.length).toBeGreaterThanOrEqual(4);
    expect(diag.roadGraph?.renderDetails?.centerDashCount).toBeGreaterThan(300);
    expect(diag.roadGraph?.renderDetails?.edgeMarkerCount).toBeGreaterThan(600);
    expect(diag.roadGraph?.renderDetails?.roadsidePostCount).toBeGreaterThan(300);
    expect(diag.roadGraph?.renderDetails?.roadSignCount).toBeGreaterThan(30);
    expect(diag.roadGraph?.renderDetails?.routeLabelSignCount).toBeGreaterThanOrEqual(6);
    expect(diag.roadGraph?.geometry?.zeroLengthSegments).toBe(0);
    expect(diag.roadGraph?.geometry?.p99SegmentLength).toBeLessThan(35);
    expect(diag.roadGraph?.geometry?.maxSegmentLength).toBeLessThan(160);
    expect(diag.roadGraph?.geometry?.roadBedSmoothness?.sampleCount).toBeGreaterThan(10000);
    expect(diag.roadGraph?.geometry?.roadBedSmoothness?.p99AdjacentHeightDelta).toBeLessThan(6);
    expect(diag.roadGraph?.intersections?.candidateCount).toBeGreaterThan(2500);
    expect(diag.roadGraph?.intersections?.trueIntersectionCount).toBeGreaterThan(2000);
    expect(diag.roadGraph?.intersections?.seamCandidateCount).toBeGreaterThan(300);
    expect(diag.roadGraph?.intersections?.renderedCount).toBe(diag.roadGraph.intersections.candidateCount);
    expect(diag.roadGraph?.intersections?.omittedCount).toBe(0);
    expect(diag.roadGraph?.intersections?.coverageRatio).toBe(1);
    expect(diag.roadGraph?.intersections?.degreeBuckets?.['4']).toBeGreaterThan(100);
    expect(diag.traffic?.routeCount).toBeGreaterThanOrEqual(4);
    expect(diag.traffic?.graphRouteSegments).toBeGreaterThan(40);
    expect(diag.traffic?.routes.every((route) => route.graphEdgeCount >= 3)).toBe(true);
    expect(diag.traffic?.routes.some((route) => route.classRank >= 3)).toBe(true);

    // NENHUMA rodovia OSM gerada passa por pista, safety area ou aproximações.
    const airportConflicts = [];
    for (const road of diag.roads) {
      for (let i = 0; i < road.points.length - 1; i++) {
        const a = road.points[i], b = road.points[i + 1];
        for (let s = 0; s <= 10; s++) {
          const t = s / 10;
          const x = a.x + (b.x - a.x) * t;
          const z = a.z + (b.z - a.z) * t;
          const zone = diag.roadGraph.airportExclusionZones.find((candidate) =>
            Math.abs(x - candidate.cx) <= candidate.halfW &&
            Math.abs(z - candidate.cz) <= candidate.halfL);
          if (zone) {
            airportConflicts.push({ road: road.id, zone: zone.id, x, z });
          }
        }
      }
    }
    expect(airportConflicts).toEqual([]);
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

  test('keeps traffic grounded on the road graph', async ({ page }) => {
    await openInhauma(page, 'inhauma-traffic-grounded');
    const timeline = [];
    for (let i = 0; i < 4; i++) {
      await page.waitForTimeout(450);
      timeline.push(await page.evaluate(() => window.__aeroDebug.getMapDiagnostics().traffic));
    }
    const traffic = timeline[timeline.length - 1];
    expect(traffic?.routeCount).toBeGreaterThanOrEqual(4);
    expect(traffic?.graphRouteSegments).toBeGreaterThan(40);
    expect(traffic?.active?.classSpeedBands?.['3'] || traffic?.active?.classSpeedBands?.['4']).toBeTruthy();
    const firstSamples = timeline.map((t) => t?.active?.samples?.[0]).filter(Boolean);
    expect(firstSamples.length).toBe(timeline.length);
    expect(Math.hypot(firstSamples.at(-1).x - firstSamples[0].x, firstSamples.at(-1).z - firstSamples[0].z)).toBeGreaterThan(8);
    for (const snapshot of timeline) {
      expect(snapshot?.active?.checkedCars).toBeGreaterThanOrEqual(30);
      expect(snapshot?.active?.samples?.length).toBeGreaterThan(0);
      expect(snapshot?.active?.airportSurfaceSamples).toBe(0);
      expect(snapshot?.active?.airportExclusionSamples).toBe(0);
      expect(snapshot?.active?.offRoadSamples).toBe(0);
      expect(snapshot?.active?.wheelHeightViolations).toBe(0);
      expect(snapshot?.active?.maxClearanceError).toBeLessThanOrEqual(0.02);
      expect(snapshot?.active?.pitchAlignedCars).toBe(snapshot.active.checkedCars);
      expect(snapshot?.active?.maxBodyPitchDeg).toBeLessThanOrEqual(18.5);
      const floating = snapshot.active.samples.filter((car) =>
        car.onAirportSurface || !Number.isFinite(car.bodyPitchDeg) ||
        Math.abs(car.clearance - 0.88) > 0.02 || car.wheelCenterY < car.groundY + 0.25 || car.wheelCenterY > car.groundY + 0.45);
      expect(floating).toEqual([]);
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
    expect(stats.calls).toBeLessThan(260);
    expect(stats.triangles).toBeLessThan(250000);
    expect(buckets.size).toBeGreaterThan(12);
  });
});
