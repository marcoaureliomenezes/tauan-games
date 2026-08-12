// WS-6 — sol visível sobre a sinalização de corrida gerada por dados:
//   · sol (sprite) + 3 fantasmas de flare presentes e atualizados no update.
//
// T-03 (2026-08-12, map de rebaixamento 2026-08-12T160030Z §4): o laço das 4
// pistas (chevrons/lombada/vado/tábuas de distância + clearance ≥ 0,5 m) foi
// DELETADO daqui — signage.js#planSigns é "dados puros — testável sem
// render" (comentário do próprio arquivo) e measureClearance foi EXTRAÍDO
// (pure move refactor) para ser chamável fora de buildSignsWS6. A mesma
// cobertura roda em Node: tools/test-corrida-signage.mjs.
import { test, expect } from '@playwright/test';

const URL = '/src/web-games/speed-run/';

async function start(page, trackArrows = 0) {
  await page.goto(URL);
  await page.waitForFunction(() => window.__corridaReady === true, { timeout: 30000 });
  for (let i = 0; i < trackArrows; i++) await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => ['countdown', 'race'].includes(window.__corrida.phase), { timeout: 30000 });
}

test.describe('Cruis\'n Tauan — WS-6 sol', () => {
  test.setTimeout(120000);

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
