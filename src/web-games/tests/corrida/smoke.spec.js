// Smoke do Cruis'n Tauan: menu carrega, corrida inicia, carro anda.
//
// T-03 (2026-08-12, map de rebaixamento 2026-08-12T160030Z §4): 2 dos 3 boots
// de pista ("pista X constrói e a corrida anda") viraram sampleTrack()
// finito+len>0 em tools/test-corrida-unit.mjs — só "Centro Urbano" continua
// como boot de browser real (sentinela: prova que o jogo INTEIRO, não só a
// amostragem, constrói e o carro se move). O teste de SURFACES (grip por
// superfície) foi DELETADO — era um import de constante congelada atrás de
// um boot de browser inteiro (tautologia sem valor E2E); a mesma asserção
// (asphalt > dirt > offroad) roda em Node em test-corrida-unit.mjs.
import { test, expect } from '@playwright/test';

const URL = '/src/web-games/speed-run/';

async function start(page, trackArrows = 0) {
  await page.goto(URL);
  await page.waitForFunction(() => window.__corridaReady === true, { timeout: 15000 });
  for (let i = 0; i < trackArrows; i++) await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => ['countdown', 'race'].includes(window.__corrida.phase), { timeout: 5000 });
}

test.describe('Cruis\'n Tauan — smoke', () => {
  test('menu: 4 pistas e 5 carros, Idea Adventure presente', async ({ page }) => {
    await page.goto(URL);
    await page.waitForFunction(() => window.__corridaReady === true, { timeout: 15000 });
    await expect(page.locator('#menuTracks .opt')).toHaveCount(4);
    await expect(page.locator('#menuTracks')).toContainText('Serra do Tauan');
    await expect(page.locator('#menuCars .opt')).toHaveCount(5);
    await expect(page.locator('#menuCars')).toContainText('Idea Adventure 2013 Dual Logic');
  });

  test('pista "Centro Urbano" constrói e a corrida anda', async ({ page }) => {
    test.setTimeout(60000);
    await start(page, 0);
    await expect(page.locator('#trackName')).toHaveText('Centro Urbano');
    // headless pula a contagem (countdown 0.1s) — IA guia o jogador p/ provar movimento
    await page.evaluate(() => {
      const G = window.__corrida;
      G.player.isPlayer = false;
      G.player.st.ai = { laneOffset: 0, skill: 0.85, lookAhead: 0.014 };
    });
    await page.waitForFunction(() => window.__corrida.player.st.v > 8, { timeout: 15000 });
    const st = await page.evaluate(() => {
      const G = window.__corrida;
      const q = G.world.surfaceAt(G.player.st.pos.x, G.player.st.pos.z, G.player.st.sHint);
      return {
        v: G.player.st.v, surface: q.surface,
        racers: G.cars.filter((c) => !c.isTraffic).length,
        traffic: G.cars.filter((c) => c.isTraffic).length,
      };
    });
    expect(st.v).toBeGreaterThan(8);
    expect(st.racers).toBe(6);
    expect(st.traffic).toBe(4);          // tráfego civil circulando
    expect(['asphalt', 'dirt', 'offroad']).toContain(st.surface);
  });
});
