const { test, expect } = require('@playwright/test');

// Suite da release v0.2.6.
// AC-01 fluxo T/O/Z + abort · AC-03 corredor galáctico · AC-04 relatividade
// · AC-05 bulbo galáctico · AC-06 nave visível. (AC-02 perfil = unit node.)
//
// T-07 (v0.10.0, batch L2): 4 waits convertidos (settle pós-goTo/warp → ticks
// de sim; toggle do Z contextual e gauge do cruzeiro → polling das condições
// aferidas); nenhum sleep fixo mantido neste spec.

// T-07: polling sobre o relógio de SIMULAÇÃO em vez de sleep de parede.
// game.time avança a cada frame (dt clampado a 0,05 s): time >= t0 + n·0,05
// garante ≥ n frames renderizados — robusto ao slow-mo do headless.
async function waitSimTicks(page, n = 2, timeout = 30000) {
  const t0 = await page.evaluate(() => window.__spaceWar.time);
  await page.waitForFunction(([t, d]) => window.__spaceWar.time >= t + d, [t0, n * 0.05 - 1e-9], { timeout });
}

async function load(page) {
  await page.goto('/src/web-games/space-war/index.html');
  await page.waitForSelector('canvas', { state: 'attached', timeout: 60000 });
  await page.waitForFunction(() => window.__spaceWarReady === true, { timeout: 120000 });
}

async function startFlight(page) {
  await load(page);
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => window.__spaceWar.phase !== 'menu', { timeout: 30000 });
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => window.__spaceWar.phase === 'flight', { timeout: 45000 });
}

// decola e mira Betelgeuse (outro sistema) — o pré-requisito do fluxo T/O/Z
async function airborneWithCrossTarget(page) {
  await page.evaluate(() => window.__swDebug.goTo('terra', 4));
  await waitSimTicks(page, 2);   // T-07: era sleep fixo de 120 ms — settle pós-teleporte
  const ok = await page.evaluate(() => window.__swDebug.target('betelgeuse'));
  expect(ok).toBe(true);
}

test.describe('Space War — Viagem Interestelar', () => {

  // AC-01: alvo de OUTRO sistema + [Z] → engata; T no range 3:00–6:00; [Z] aborta.
  test('AC-01: T/O/Z engata a queima; Z de novo aborta com residual seguro', async ({ page }) => {
    test.setTimeout(180000);
    await startFlight(page);
    await airborneWithCrossTarget(page);
    await page.keyboard.press('KeyZ');
    await page.waitForFunction(() => window.__spaceWar.journey && window.__spaceWar.journey.active, { timeout: 45000 });
    const j = await page.evaluate(() => {
      const jj = window.__spaceWar.journey;
      return { T: jj.T, target: jj.targetKey, D: jj.D };
    });
    expect(j.T).toBeGreaterThanOrEqual(180);
    expect(j.T).toBeLessThanOrEqual(360);
    expect(j.target).toBe('betelgeuse');
    expect(j.D).toBeGreaterThan(1_000_000);
    // [Z] de novo → aborta; velocidade residual clampada (≤ 9000)
    await page.keyboard.press('KeyZ');
    await page.waitForFunction(() => !window.__spaceWar.journey.active, { timeout: 45000 });
    const speed = await page.evaluate(() => window.__spaceWar.ship.speed);
    expect(speed).toBeLessThanOrEqual(9200);
  });

  // AC-01b: [Z] com alvo LOCAL segue sendo o toggle de assist (Z contextual).
  test('AC-01b: Z contextual — alvo local mantém o toggle de assist', async ({ page }) => {
    await startFlight(page);
    await page.evaluate(() => window.__swDebug.goTo('terra', 4));
    await page.evaluate(() => window.__swDebug.target('lua'));      // mesmo sistema
    const before = await page.evaluate(() => window.__spaceWar.ship.flightAssist);
    await page.keyboard.press('KeyZ');
    // T-07: era sleep fixo de 300 ms — espera o toggle processar (a própria
    // condição aferida: flightAssist inverte).
    await page.waitForFunction((b) => window.__spaceWar.ship.flightAssist !== b, before, { timeout: 30000 });
    const after = await page.evaluate(() => ({
      assist: window.__spaceWar.ship.flightAssist,
      journey: !!(window.__spaceWar.journey && window.__spaceWar.journey.active),
    }));
    expect(after.journey).toBe(false);
    expect(after.assist).toBe(!before);
  });

  // AC-03/04 (rampa de relatividade — β sobe no cruzeiro, cai na frenagem,
  // chegada desliga a queima) DELETADO (T-02, demotion-map anexo §3): já
  // coberto por test-physics-unit.js:146 (brachistochrone flip-and-burn) e
  // :168 (aberração/Doppler — AC-04).

  // AC-05: bulbo galáctico pintado na direção do core — pixels QUENTES (r>b).
  test('AC-05: bulbo galáctico quente pintado na direção de Sagitário A✦', async ({ page }) => {
    await startFlight(page);
    const probe = await page.evaluate(() => window.__spaceWar.bulgeProbe);
    expect(probe).toBeTruthy();
    expect(probe.r).toBeGreaterThan(110);                // quente e brilhante
    expect(probe.r).toBeGreaterThan(probe.b);            // amarelo-laranja (não azul)
    expect(probe.g).toBeGreaterThan(probe.b * 0.9);      // rampa térmica
  });

  // AC-06: nave legível — jato de plasma (cones), wingtips vermelhas, luz de reflexo.
  test('AC-06: nave visível — plasma, wingtips vermelhas e reflexo presentes', async ({ page }) => {
    await startFlight(page);
    const r = await page.evaluate(() => window.__swDebug.shipReport());
    expect(r.cones).toBeGreaterThanOrEqual(2);           // bainha + núcleo do jato
    expect(r.redLamps).toBeGreaterThanOrEqual(2);        // wingtips
    expect(r.pointLights).toBeGreaterThanOrEqual(1);     // reflexo do casco
  });
});
