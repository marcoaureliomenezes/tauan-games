const { test, expect } = require('@playwright/test');

// Loop de solo AUTOMÁTICO: depois de pousar, o avião é taxiado até o serviço,
// reabastecido e recolocado para decolagem SOZINHO — sem o jogador taxiar na mão.
// Este teste arma o auto-taxi (como faz o toque na pista) e prova que a surtida
// avança LANDING_ROLL → SERVICE_SCENE → reabastecimento → decolagem → AIRBORNE
// sem nenhum input do jogador depois do setup.
// Timeouts generosos (2026-07-02): o loop de solo completo (taxi → serviço →
// taxi à cabeceira → line_up → decolagem) leva ~25 s de tempo SIMULADO; sob
// carga o rAF desacelera e o tempo de parede estoura os budgets antigos (45 s
// total) — o teste flakava sem nenhum bug no jogo. As ASSERÇÕES não mudam.
test('auto-sortie: pousou → taxi + reabastecimento + decolagem automáticos', async ({ page }) => {
  test.setTimeout(90000);
  await page.goto('/src/web-games/aero-fighters/index.html?testMode=1&map=inhauma&seed=auto-sortie');
  await page.waitForSelector('canvas', { state: 'attached', timeout: 15000 });
  await page.waitForFunction(() => window.__aeroDebug && window.game, { timeout: 15000 });

  // Inicia a surtida (sai do menu) e arma o loop de solo como se tivesse pousado.
  await page.keyboard.press('Space');
  await page.waitForFunction(() => window.game.running === true, { timeout: 5000 });
  await page.evaluate(() => {
    window.game.player.missiles = 0;
    window.game.player.heavyMissiles = 0;
    window.game.player.nuclearMissiles = 0;
    window.game.missionRealism.sortie.state = 'LANDING_ROLL';
    window.game.missionRealism.autoTaxi.active = true;
    window.game.missionRealism.autoTaxi.phase = 'taxi_service';
  });

  // O avião taxia sozinho até o serviço (cena de reabastecimento).
  await page.waitForFunction(
    () => window.game.missionRealism.sortie.state === 'SERVICE_SCENE',
    { timeout: 20000 },
  );

  // Reabastece sozinho — munição volta a encher (sem input).
  await page.waitForFunction(
    () => window.__aeroDebug.getSnapshot().weaponInventory.missiles === 100,
    { timeout: 20000 },
  );

  // E, sem o jogador apertar nada, é recolocado para decolagem e levanta voo.
  await page.waitForFunction(
    () => window.game.missionRealism.sortie.state === 'AIRBORNE',
    { timeout: 40000 },
  );

  const final = await page.evaluate(() => ({
    state: window.game.missionRealism.sortie.state,
    autoActive: window.game.missionRealism.autoTaxi.active,
    y: window.game.player.y,
    missiles: window.game.player.missiles,
  }));
  expect(final.state).toBe('AIRBORNE');
  expect(final.autoActive).toBe(false); // loop encerra ao decolar
  expect(final.missiles).toBe(100);
  expect(final.y).toBeGreaterThan(4); // está no ar
});
