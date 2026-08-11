const { test, expect } = require('@playwright/test');

test.setTimeout(60000);

async function openAndStart(page, map) {
  await page.goto(`/src/web-games/aero-fighters/index.html?testMode=1&map=${map}&seed=map-qa`);
  await page.waitForSelector('canvas', { state: 'attached', timeout: 15000 });
  await page.waitForFunction(() => window.__aeroDebug && window.game, { timeout: 15000 });
  await page.keyboard.press('Space');
  await page.waitForFunction(() => window.game.running === true && window.game.targets.length > 0, { timeout: 5000 });
}

for (const map of ['rio', 'desert', 'inhauma']) {
  test.describe(`Aero Fighters — ${map} map diagnostics`, () => {
    // T-C-14 (release v0.3.4 — SPEC §F): em Inhaúma os
    // "alvos iniciais" são as unidades de FORMAÇÃO da guarnição/campanha (tipos
    // 'f*', snap de altura por formation.js#placeMoving/createFormation sobre a
    // MESMA superfície renderizada que o debug amostra) — a asserção de grounded
    // vale igual; unidades aéreas (zepelim/helicóptero de patrulha) carregam
    // airborneAltitude e o debug as considera grounded na altitude de patrulha.
    // EXCEÇÃO documentada: os proxies 'mg060-military' (T-C-11) são veículos de
    // ESTRADA — a altura deles segue a DEM contínua (inhaumaContinuousHeight, a
    // mesma dos carros civis, inhauma-scene.js#updateInhaumaScene), não a grade
    // bilinear que o debug amostra; em trechos de rampa a diferença entre as duas
    // cadeias de altura ultrapassa 1 m. O contrato de altura deles é o do teste
    // de tráfego (inhauma-fidelity.spec.js: wheelHeightViolations/maxClearanceError);
    // aqui eles ficam com um teto frouxo anti-regressão (nunca voando/enterrados).
    test('initial targets are grounded within tolerance', async ({ page }) => {
      await openAndStart(page, map);
      const result = await page.evaluate(() => {
        const diag = window.__aeroDebug.getTargetDiagnostics();
        if (window.game.activeMap !== 'inhauma') {
          return { total: diag.length, bad: diag.filter((t) => !t.grounded), flying: [] };
        }
        const isMil = (t) => window.game.targets[t.id]?.formationId === 'mg060-military';
        return {
          total: diag.length,
          bad: diag.filter((t) => !isMil(t) && !t.grounded),
          flying: diag.filter((t) => isMil(t) && Math.abs(t.heightError) > 3),
        };
      });
      expect(result.total).toBeGreaterThan(0);
      expect(result.bad, JSON.stringify(result.bad, null, 2)).toEqual([]);
      expect(result.flying, JSON.stringify(result.flying, null, 2)).toEqual([]);
    });

    test('terrain samples are finite', async ({ page }) => {
      await openAndStart(page, map);
      const samples = await page.evaluate(() => {
        const points = [[0, 0], [100, 100], [-100, 100], [250, -250], [-250, 250]];
        return points.map(([x, z]) => window.__aeroDebug.getTerrainHeightAt(x, z));
      });
      expect(samples.every(Number.isFinite)).toBe(true);
    });

    test('map diagnostics identify current map', async ({ page }) => {
      await openAndStart(page, map);
      const diag = await page.evaluate(() => window.__aeroDebug.getMapDiagnostics());
      expect(diag.activeMap).toBe(map);
      expect(diag.mapsCovered).toEqual(expect.arrayContaining(['rio', 'desert', 'inhauma']));
    });
  });
}
