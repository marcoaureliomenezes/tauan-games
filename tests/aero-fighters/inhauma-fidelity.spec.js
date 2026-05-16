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
    const mg238 = byId(diag.roads, 'mg-238');
    const amg0360 = byId(diag.roads, 'amg-0360');
    const rodMun = byId(diag.roads, 'rod-mun-inhauma');

    expect(inhauma).toBeTruthy();
    expect(cachoeira).toBeTruthy();
    expect(sete).toBeTruthy();
    expect(cachoeira.x).toBeLessThan(inhauma.x - 350);
    expect(cachoeira.z).toBeGreaterThan(inhauma.z + 150);
    expect(sete.x).toBeGreaterThan(inhauma.x + 600);
    expect(sete.z).toBeLessThan(inhauma.z - 150);

    expect(mg238?.points?.length).toBeGreaterThanOrEqual(4);
    expect(Math.min(...mg238.points.map((p) => p.x))).toBeLessThan(cachoeira.x + 120);
    expect(Math.max(...mg238.points.map((p) => p.x))).toBeGreaterThan(sete.x - 160);
    expect(mg238.points.some((p) => Math.abs(p.x - inhauma.x) < 240 && p.z > inhauma.z)).toBe(true);

    expect(amg0360.points.at(-1).z).toBeGreaterThan(inhauma.z + 200);
    expect(rodMun.points.at(-1).z).toBeLessThan(inhauma.z - 200);
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
});
