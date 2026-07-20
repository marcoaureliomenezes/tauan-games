const { test, expect } = require('@playwright/test');

// Aceitação da release space-war-three-states-v1 — O VOO COMPLETO (pedido do
// operador 2026-07-18): "ao final devo poder jogar e me mover de um sistema
// planetário a outro experienciando os 3 estados extensivamente".
//
// Num ÚNICO voo (um boot só):
//   1. ORBIT (Terra) — decolagem + visão orbital (Lua dentro do mesmo sistema)
//   2. ORBIT→CRUISE — sai do sistema Terra, cruzeiro interplanetário
//   3. CRUISE→ORBIT — acopla em Marte COM FREIO AUTOMÁTICO GRADUAL (chegando
//      a 2.000 u/s, o acoplamento desacelera a nave ao regime orbital)
//   4. JOURNEY — [Z] para Betelgeuse (outro sistema estelar), cruzeiro β~0.99
//   5. JOURNEY→CRUISE→ORBIT — chegada e acoplamento em Brasa (Betelgeuse):
//      sistema planetário alienígena com luas (Tição/Fagulha) + estação

async function startFlight(page) {
  await page.goto('/src/web-games/space-war/index.html');
  await page.waitForSelector('canvas', { state: 'attached', timeout: 30000 });
  await page.waitForFunction(() => window.__spaceWarReady === true, { timeout: 45000 });
  await page.keyboard.press('Enter');
  await page.waitForTimeout(150);
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => window.__spaceWar.phase === 'flight', { timeout: 10000 });
}



test.describe('Space War — O voo completo pelos 3 estados', () => {
  test.setTimeout(240000);

  test('Terra(ORBIT) → CRUISE → Marte(ORBIT c/ freio) → JOURNEY → Brasa(ORBIT)', async ({ page }) => {
    await startFlight(page);

    // ── 1. ORBIT (Terra): nasce acoplado; decolagem mantém o modo ──
    await page.waitForFunction(() => window.__spaceWar.mode === 'orbit' && window.__spaceWar.planetary?.key === 'earth', { timeout: 15000 });
    await page.keyboard.down('KeyW');
    await page.waitForFunction(() => window.__spaceWar.ship.landed === false, { timeout: 20000 });
    await page.keyboard.up('KeyW');
    // visão orbital: a Lua está DENTRO do mesmo sistema planetário
    await page.evaluate(() => window.__swDebug.goTo('lua', 3));
    await page.waitForTimeout(400);
    const earthSystem = await page.evaluate(() => ({
      mode: window.__spaceWar.mode, planetary: window.__spaceWar.planetary?.key,
      cruise: window.__spaceWar.planetary?.radius / 20,
    }));
    expect(earthSystem.mode).toBe('orbit');
    expect(earthSystem.planetary).toBe('earth');   // Terra–Lua = uma "fase" só

    // ── 2. ORBIT→CRUISE: longe de qualquer sistema planetário ──
    await page.evaluate(() => window.__swDebug.goTo('mars', 30));
    await page.waitForFunction(() => window.__spaceWar.mode === 'cruise', { timeout: 15000 });

    // ── 3. CRUISE→ORBIT com FREIO DE ACOPLAMENTO: chega a 2.000 u/s ──
    await page.evaluate(() => window.__swDebug.goTo('mars', 6));   // fora do sistema (R≈3.8k)
    await page.waitForFunction(() => window.__spaceWar.mode === 'cruise', { timeout: 15000 });
    await page.evaluate(() => {
      const g = window.__spaceWar;
      const mars = g.bodies.find((b) => b.def.key === 'mars');
      const d = mars.worldPos.clone().sub(g.ship.pos).normalize();
      g.ship.vel.copy(d).multiplyScalar(2000);      // mergulho a 2.000 u/s
    });
    await page.waitForFunction(
      () => window.__spaceWar.mode === 'orbit' && window.__spaceWar.planetary?.key === 'mars',
      { timeout: 30000 },
    );
    // após o blend, a velocidade relativa a Marte caiu ao regime orbital
    await page.waitForTimeout(3500);
    const rel = await page.evaluate(() => {
      const g = window.__spaceWar;
      const mars = g.bodies.find((b) => b.def.key === 'mars');
      const v = g.ship.vel.clone(); if (mars.worldVel) v.sub(mars.worldVel);
      return { rel: v.length(), localCruise: window.__spaceWar.planetary.radius / 20 };
    });
    expect(rel.rel).toBeLessThan(rel.localCruise * 3);   // freou de 2000 → regime orbital

    // ── 4. JOURNEY: [Z] para Betelgeuse ──
    await page.evaluate(() => window.__swDebug.target('betelgeuse'));
    await page.keyboard.press('KeyZ');
    await page.waitForFunction(() => window.__spaceWar.journey?.active, { timeout: 20000 });
    await page.waitForFunction(() => window.__spaceWar.mode === 'journey', { timeout: 15000 });
    await page.evaluate(() => window.__swDebug.journeyWarp(0.5));
    await page.waitForTimeout(300);
    const cruiseFx = await page.evaluate(() => ({
      beta: window.__spaceWar.journey.beta,
      fade: window.__spaceWar.starfieldFade,
    }));
    expect(cruiseFx.beta).toBeGreaterThan(0.9);          // relatividade plena no cruzeiro
    expect(cruiseFx.fade).toBeGreaterThan(0.5);          // corredor aceso FORA dos sistemas

    // ── 5. Chegada: JOURNEY→CRUISE → acopla em Brasa (Betelgeuse) ──
    await page.evaluate(() => window.__swDebug.journeyWarp(0.995));
    await page.waitForFunction(() => !window.__spaceWar.journey.active, { timeout: 30000 });
    await page.waitForFunction(() => window.__spaceWar.mode === 'cruise', { timeout: 20000 });
    await page.evaluate(() => window.__swDebug.goTo('brasa', 2));
    await page.waitForFunction(
      () => window.__spaceWar.mode === 'orbit' && window.__spaceWar.planetary?.key === 'brasa',
      { timeout: 20000 },
    );
    // sistema planetário alienígena completo: luas + estação no mapa
    const brasa = await page.evaluate(() => {
      const b = window.__spaceWar.bodies.find((x) => x.def.key === 'brasa');
      return b.moons.map((m) => m.def.name);
    });
    expect(brasa).toContain('Tição');
    expect(brasa).toContain('Fagulha');
    expect(brasa).toContain('Estação de Brasa');
  });
});
