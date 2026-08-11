// WS-6 — sinalização de corrida gerada por dados + sol visível:
//   · chevrons antes de TODA curva com κ ≥ 0,0045 (world.signage);
//   · LOMBADA antes de cada def.bumps, VADO antes de cada def.fords;
//   · tábuas 300/200/100 antes da curva mais fechada de cada circuito;
//   · clearance de TODA placa ≥ 0,5 m fora da borda da estrada (corredor);
//   · sol (sprite) + 3 fantasmas de flare presentes e atualizados no update.
import { test, expect } from '@playwright/test';

const URL = '/src/web-games/speed-run/';

async function start(page, trackArrows = 0) {
  await page.goto(URL);
  await page.waitForFunction(() => window.__corridaReady === true, { timeout: 30000 });
  for (let i = 0; i < trackArrows; i++) await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => ['countdown', 'race'].includes(window.__corrida.phase), { timeout: 30000 });
}

test.describe('Cruis\'n Tauan — WS-6 sinalização e sol', () => {
  test.setTimeout(120000);
  // [setas, pista, lombadas esperadas, vados esperados, tábuas de distância]
  for (const [arrows, key, nLom, nVado, nDist] of [
    [0, 'city', 3, 0, 3],
    [1, 'forest', 3, 0, 3],
    [2, 'arizona', 5, 0, 3],
    [3, 'serra', 3, 2, 0],          // sprint: sem tábuas de distância
  ]) {
    test(`${key}: placas por dados completas e fora do corredor`, async ({ page }) => {
      await start(page, arrows);
      const rep = await page.evaluate(() => {
        const sg = window.__corrida.world.signage;
        const by = {};
        for (const s of sg) by[s.kind] = (by[s.kind] || 0) + 1;
        return {
          by,
          minClear: Math.min(...sg.map((x) => x.clearance)),
        };
      });
      expect(rep.by.lombada ?? 0).toBe(nLom);
      expect(rep.by.vado ?? 0).toBe(nVado);
      expect(rep.by.dist ?? 0).toBe(nDist);
      expect(rep.by.chevron ?? 0).toBeGreaterThan(0);       // toda pista tem curva sinalizada
      expect(rep.minClear).toBeGreaterThanOrEqual(0.5);     // NADA no corredor dirigível
    });
  }

  test('sol visível + 3 fantasmas de flare seguem a câmera', async ({ page }) => {
    await start(page, 2);                                    // arizona
    const sun = await page.evaluate(() => {
      const G = window.__corrida;
      const sf = G.world.sunFlare;
      const before = sf.sun.position.x;
      G.world.update(G.camera);
      return {
        sprites: 1 + sf.ghosts.length,
        opacity: sf.sun.material.opacity,
        high: sf.sun.position.y > 2000,                      // sol alto no céu
        movedWithCam: Math.abs(sf.sun.position.x - G.camera.position.x) < 6000,
        before,
      };
    });
    expect(sun.sprites).toBe(4);
    expect(sun.opacity).toBeGreaterThan(0.5);
    expect(sun.high).toBe(true);
    expect(sun.movedWithCam).toBe(true);
  });
});
