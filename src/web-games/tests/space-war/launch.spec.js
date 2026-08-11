const { test, expect } = require('@playwright/test');

// Aceitação do backport da DECOLAGEM PILOTADA do space-war Godot (launch.js):
// o começo do jogo é a plataforma de lançamento; W MANTIDO conduz a subida
// pelo programa de arfagem (ASCENT → GRAVITY_TURN) até a INSERÇÃO na órbita
// de entrada (R/3, v_tan ≈ v_circ) — física real o tempo todo, sem cutscene
// e sem o antigo chute instantâneo de v_esc.
//
// O headless roda a ~1 fps (SwiftShader): o tempo de jogo avança via
// __swDebug.launchWarp(s) — simulação síncrona determinística a 1/60 s,
// mesmo padrão do journeyWarp.

async function startFlight(page) {
  await page.goto('/src/web-games/space-war/index.html');
  await page.waitForSelector('canvas', { state: 'attached', timeout: 60000 });
  await page.waitForFunction(() => window.__spaceWarReady === true, { timeout: 60000 });
  await page.keyboard.press('Enter');
  await page.waitForTimeout(150);
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => window.__spaceWar.phase === 'flight', { timeout: 45000 });
}

// Espera uma condição sobre o launchReport avançando a simulação em warp.
// `step` pequeno (0,25 s) quando o estado logo APÓS o gatilho importa — um
// chunk de 1 s com W seguro deixa a nave voar 1 s além da inserção antes da
// amostra (tempo bastante p/ o overdrive lunar distorcer a leitura).
async function warpUntil(page, predSrc, maxGameSeconds, step = 1) {
  return page.evaluate(([src, maxS, st]) => {
    const pred = new Function('r', `return (${src});`);
    let r = window.__swDebug.launchReport();
    let t = 0;
    while (!pred(r) && t < maxS) { r = window.__swDebug.launchWarp(st); t += st; }
    return { report: r, warped: t, ok: pred(r) };
  }, [predSrc, maxGameSeconds, step]);
}

test.describe('Space War — decolagem pilotada (backport Godot)', () => {
  test.setTimeout(300000);

  test('plataforma → W mantido → gravity turn → órbita de entrada', async ({ page }) => {
    await startFlight(page);
    const earth = await page.evaluate(() => {
      const e = window.__spaceWar.bodies.find((b) => b.def.key === 'earth');
      return { radius: e.def.radius, mu: e.mu };
    });
    const altT = earth.radius / 3;

    // ── começo: pousada na plataforma, girando com a Terra ──
    const before = await page.evaluate(() => window.__swDebug.launchReport());
    expect(before.stage).toBe('LANDED');
    expect(before.landed).toBe(true);
    expect(before.mode).toBe('orbit');            // nasce acoplada ao sistema Terra

    // ── W MANTIDO: liftoff → subida (ainda na atmosfera baixa nos primeiros 2 s) ──
    await page.evaluate(() => window.__swDebug.holdW(true));
    const lift = await warpUntil(page, 'r.stage !== "LANDED"', 10);
    expect(lift.ok).toBe(true);
    const early = await page.evaluate(() => window.__swDebug.launchWarp(2));
    expect(['ASCENT', 'GRAVITY_TURN']).toContain(early.stage);
    expect(early.altitude).toBeLessThan(earth.radius * 0.28);   // dentro da atmosfera

    // ── curva gravitacional e inserção ──
    const turn = await warpUntil(page, 'r.stage === "GRAVITY_TURN" || r.stage === "INSERTED"', 60);
    expect(turn.ok).toBe(true);
    const ins = await warpUntil(page, 'r.stage === "INSERTED"', 120, 0.25);
    expect(ins.ok).toBe(true);
    // corta o motor (o resto do chunk de warp com W seguro sobe o throttle):
    // órbita = coast — a lei do jogo
    await page.evaluate(() => { window.__swDebug.holdW(false); window.__spaceWar.ship.throttle = 0; });

    // ── inserção: órbita de entrada honrada — o snapshot TERRA-relativo
    // congelado no gatilho (depois dele a Lua pode dominar o campo e os
    // vTan/vRad do HUD mudam de referência) ──
    const r = ins.report;
    const snap = r.insert;
    expect(snap).toBeTruthy();
    expect(r.boostersDropped).toBe(2);                       // 2 estágios separados
    expect(snap.alt).toBeGreaterThan(altT * 0.75);
    expect(snap.alt).toBeLessThan(altT * 1.4);
    expect(Math.abs(snap.vTan - snap.vCirc)).toBeLessThan(snap.vCirc * 0.02);
    expect(Math.abs(snap.vRad)).toBeLessThan(snap.vCirc * 0.02);
    expect(snap.t).toBeGreaterThanOrEqual(18);               // nunca instantâneo
    expect(r.mode).toBe('orbit');                            // segue acoplada à Terra

    // ── a órbita se sustenta: 30 s de coast (~1/9 de volta). A Lua do jogo
    // perturba DE VERDADE (SOI 7200 varre a órbita de entrada; um flyby pode
    // bombear a altitude) — o invariante honesto é: continua PRESA ao sistema
    // Terra (modo orbit), sem reentrar na atmosfera e sem pousar ──
    const after = await page.evaluate(() => window.__swDebug.launchWarp(30));
    expect(after.stage).toBe('INSERTED');
    expect(after.landed).toBe(false);
    expect(after.mode).toBe('orbit');                        // não escapou do sistema
    expect(after.altitude).toBeGreaterThan(altT * 0.3);      // não reentrou
  });

  test('W solto cedo aborta: a nave volta à plataforma e pode relançar', async ({ page }) => {
    await startFlight(page);
    await page.evaluate(() => window.__swDebug.holdW(true));
    const lift = await warpUntil(page, 'r.stage !== "LANDED"', 10);
    expect(lift.ok).toBe(true);
    await page.evaluate(() => window.__swDebug.launchWarp(4));   // ainda baixo, subsônico
    await page.evaluate(() => window.__swDebug.holdW(false));
    // sem empuxo a subida cai de volta e RE-POUSA (nunca afunda/trava)
    const back = await warpUntil(page, 'r.landed === true', 120);
    expect(back.ok).toBe(true);
    expect(back.report.stage).toBe('LANDED');
    // relançamento funciona
    await page.evaluate(() => window.__swDebug.holdW(true));
    const again = await warpUntil(page, 'r.stage !== "LANDED"', 10);
    expect(again.ok).toBe(true);
    await page.evaluate(() => window.__swDebug.holdW(false));
  });
});
