const { test, expect } = require('@playwright/test');

// Suite da release space-war-interstellar-journey-v1.
// AC-01 fluxo T/O/Z + abort · AC-03 corredor galáctico · AC-04 relatividade
// · AC-05 bulbo galáctico · AC-06 nave visível. (AC-02 perfil = unit node.)

async function load(page) {
  await page.goto('/src/web-games/space-war/index.html');
  await page.waitForSelector('canvas', { state: 'attached', timeout: 30000 });
  await page.waitForFunction(() => window.__spaceWarReady === true, { timeout: 45000 });
}

async function startFlight(page) {
  await load(page);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(150);
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => window.__spaceWar.phase === 'flight', { timeout: 10000 });
}

// decola e mira Betelgeuse (outro sistema) — o pré-requisito do fluxo T/O/Z
async function airborneWithCrossTarget(page) {
  await page.evaluate(() => window.__swDebug.goTo('terra', 4));
  await page.waitForTimeout(120);
  const ok = await page.evaluate(() => window.__swDebug.target('betelgeuse'));
  expect(ok).toBe(true);
}

test.describe('Space War — Viagem Interestelar', () => {

  // AC-01: alvo de OUTRO sistema + [Z] → engata; T no range 3:00–6:00; [Z] aborta.
  test('AC-01: T/O/Z engata a queima; Z de novo aborta com residual seguro', async ({ page }) => {
    test.setTimeout(90000);
    await startFlight(page);
    await airborneWithCrossTarget(page);
    await page.keyboard.press('KeyZ');
    await page.waitForFunction(() => window.__spaceWar.journey && window.__spaceWar.journey.active, { timeout: 5000 });
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
    await page.waitForFunction(() => !window.__spaceWar.journey.active, { timeout: 5000 });
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
    await page.waitForTimeout(300);
    const after = await page.evaluate(() => ({
      assist: window.__spaceWar.ship.flightAssist,
      journey: !!(window.__spaceWar.journey && window.__spaceWar.journey.active),
    }));
    expect(after.journey).toBe(false);
    expect(after.assist).toBe(!before);
  });

  // AC-03/AC-04 (adaptado ao TRAPEZOIDE 30/40/30 da experience-v1): corredor
  // vivo no meio — fade alto, β≈0.995 no CRUZEIRO, caindo na frenagem (s>0.7);
  // chegada desliga a queima.
  test('AC-03/04: starfield + relatividade sobem até o meio e desfazem na chegada', async ({ page }) => {
    test.setTimeout(120000);
    await startFlight(page);
    const field = await page.evaluate(() => window.__spaceWar.starfield);
    expect(field.stars).toBeGreaterThanOrEqual(2000);
    expect(field.layers).toBe(2);
    await airborneWithCrossTarget(page);
    const fadeHome = await page.evaluate(() => window.__spaceWar.starfieldFade);
    expect(fadeHome).toBeLessThanOrEqual(0.05);          // dentro do sistema: céu limpo
    await page.evaluate(() => window.__swDebug.journeyToggle());
    await page.waitForFunction(() => window.__spaceWar.journey.active, { timeout: 5000 });
    // meio da viagem = CRUZEIRO: β máximo (~0.995) e corredor pleno
    await page.evaluate(() => window.__swDebug.journeyWarp(0.5));
    await page.waitForTimeout(500);
    const mid = await page.evaluate(() => ({
      beta: window.__spaceWar.starfieldBeta, fade: window.__spaceWar.starfieldFade,
      s: window.__spaceWar.journey.s, phase: window.__spaceWar.journey.phase,
    }));
    expect(mid.phase).toBe('coast');
    expect(mid.beta).toBeGreaterThan(0.9);
    expect(mid.fade).toBeGreaterThanOrEqual(0.8);
    // 90% do caminho: FREANDO fundo — β caiu p/ ~⅓ do cruzeiro
    await page.evaluate(() => window.__swDebug.journeyWarp(0.9));
    await page.waitForTimeout(400);
    const late = await page.evaluate(() => window.__spaceWar.starfieldBeta);
    expect(late).toBeLessThan(mid.beta * 0.6);
    // chegada: queima desliga, velocidade residual, perto do sistema alvo
    await page.evaluate(() => window.__swDebug.journeyWarp(0.999));
    await page.waitForFunction(() => !window.__spaceWar.journey.active, { timeout: 15000 });
    const arrive = await page.evaluate(() => {
      const sw = window.__spaceWar;
      const bet = sw.bodies.find((b) => b.def.key === 'betelgeuse');
      return { d: sw.ship.pos.distanceTo(bet.worldPos), speed: sw.ship.speed };
    });
    expect(arrive.d).toBeLessThan(2_000_000);            // chegou à vizinhança
    expect(arrive.speed).toBeLessThanOrEqual(1600);      // residual de chegada
  });

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
