const { test, expect } = require('@playwright/test');

// Loop de solo AUTOMÁTICO: depois de pousar, o avião é taxiado até o serviço,
// reabastecido e recolocado para decolagem SOZINHO — sem o jogador taxiar na mão.
// Este teste arma o auto-taxi (como faz o toque na pista) e prova que a surtida
// avança LANDING_ROLL → SERVICE_SCENE → reabastecimento → decolagem → AIRBORNE
// sem nenhum input do jogador depois do setup.
// T-C-14 (release v0.3.4 — SPEC §C/F): (1) o serviço
// recarrega SÓ heavy/nuke/rod — o míssil leve é infinito (T-C-08), então a prova
// de reabastecimento passa a ser heavyMissiles (o leve fica no valor fixo de
// exibição que tinha); (2) o "completed-gate" do auto-taxi chama spawnMission
// quando targetsDestroyed >= targetsTotal (auto-taxi.js#await_service), mas em
// Inhaúma spawnMission é NO-OP (missions.js) — o diretor é a campanha
// (campaign.js): a surtida decola sem wave nova e o mundo segue vivo.
// Timeouts generosos (2026-07-02): o loop de solo completo (taxi → serviço →
// taxi à cabeceira → line_up → decolagem) leva ~25 s de tempo SIMULADO; sob
// carga o rAF desacelera e o tempo de parede estoura os budgets antigos (45 s
// total) — o teste flakava sem nenhum bug no jogo. As ASSERÇÕES não mudam.
test('auto-sortie: pousou → taxi + reabastecimento + decolagem automáticos', async ({ page }) => {
  test.setTimeout(300000); // cenário ~60 s de game time; sob load alto o game time anda ~3-4x mais lento que o wall clock (2026-07-21)
  await page.goto('/src/web-games/aero-fighters/index.html?testMode=1&map=inhauma&seed=auto-sortie');
  await page.waitForSelector('canvas', { state: 'attached', timeout: 120000 });
  await page.waitForFunction(() => window.__aeroDebug && window.game, { timeout: 120000 });

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

  // Reabastece sozinho — heavy/nuke/rod voltam a encher (T-C-08: o leve é
  // infinito e NÃO é recarregado — a prova do rearme é o heavy).
  await page.waitForFunction(
    () => window.__aeroDebug.getSnapshot().weaponInventory.heavyMissiles === 10,
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
    heavyMissiles: window.game.player.heavyMissiles,
    // T-C-14: o gate da surtida seguinte é da CAMPANHA — sem wave nova em Inhaúma;
    // targetsTotal segue espelhando o objetivo do ATO (não uma contagem de layout).
    campaignAct: window.game.campaign?.act,
    actObjectiveTotal: window.game.campaign?.actTargetsTotal,
    mirroredTotal: window.game.targetsTotal,
    targetsAlive: window.game.targets.filter((t) => !t.dead).length,
  }));
  expect(final.state).toBe('AIRBORNE');
  expect(final.autoActive).toBe(false); // loop encerra ao decolar
  expect(final.heavyMissiles).toBe(10); // T-C-08: heavy recarregado no serviço
  expect(final.missiles).toBe(0);       // T-C-08: leve infinito — nunca reposto
  expect(final.y).toBeGreaterThan(4); // está no ar
  // Mundo da campanha segue vivo após o loop de solo (guarnição/formações intactas,
  // sem spawnMission/wave — o objetivo espelhado é o do ato corrente).
  expect(final.campaignAct).toBeGreaterThanOrEqual(1);
  expect(final.mirroredTotal).toBe(final.actObjectiveTotal);
  expect(final.targetsAlive).toBeGreaterThan(0);
});
