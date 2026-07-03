const { test, expect } = require('@playwright/test');

// Suite da CAMPANHA (release space-war-campaign-v1).
// Cobre os ACs do SPEC §7: gating de fase (AC-01), desbloqueio (AC-02), bomba
// inimiga sob gravidade (AC-04), recarga de nuke (AC-05), teto de pegada de base
// (AC-08) e a regressão do flare solar (AC-10 — bug
// space-war-solar-flare-universe-overlay).

async function load(page) {
  await page.goto('/space-war/index.html');
  await page.waitForSelector('canvas', { state: 'attached', timeout: 15000 });
  await page.waitForFunction(() => window.__spaceWarReady === true, { timeout: 15000 });
}

async function startFlight(page) {
  await load(page);
  await page.keyboard.press('Enter');      // menu -> briefing (inicia a campanha)
  await page.waitForTimeout(150);
  await page.keyboard.press('Enter');      // briefing -> flight
  await page.waitForFunction(() => window.__spaceWar.phase === 'flight', { timeout: 4000 });
}

test.describe('Space War — Campanha', () => {

  // AC-01: começa na fase Solar; fases futuras bloqueadas.
  test('AC-01: gating — fase 0 ativa, demais bloqueadas', async ({ page }) => {
    await startFlight(page);
    const c = await page.evaluate(() => window.__spaceWar.campaign);
    expect(c.phase).toBe(0);
    expect(c.unlocked).toEqual([true, false, false, false, false]);
    expect(c.done).toEqual([false, false, false, false, false]);
    const label = await page.evaluate(() => window.__spaceWar.mission?.label || '');
    expect(label).toContain('MISSÃO 1');
  });

  // AC-02 (+AC-03): completar as 5 missões solares (incl. a visita ao Halley)
  // desbloqueia Betelgeuse e ativa a fase 2.
  test('AC-02/03: cadeia solar completa desbloqueia BETELGEUSE', async ({ page }) => {
    test.setTimeout(90000);
    await startFlight(page);
    for (let i = 0; i < 5; i++) {
      await page.waitForFunction(() => !!window.__spaceWar.mission && !window.__spaceWar.mission._done, { timeout: 15000 });
      const t = await page.evaluate(() => ({ type: window.__spaceWar.mission.type, label: window.__spaceWar.mission.label }));
      if (i === 4) expect(t.label).toContain('HALLEY');          // AC-03: cometa com relevância de missão
      await page.evaluate(() => window.__swDebug.winMission());
      // espera avançar (próxima missão da fase, ou a fase 2 inteira no fim)
      await page.waitForFunction((idx) => {
        const sw = window.__spaceWar;
        if (idx < 4) return sw.missionIndex === idx + 1 && sw.mission && !sw.mission._done;
        return sw.campaign.phase === 1;
      }, i, { timeout: 15000 });
    }
    const c = await page.evaluate(() => window.__spaceWar.campaign);
    expect(c.done[0]).toBe(true);
    expect(c.unlocked[1]).toBe(true);
    expect(c.phase).toBe(1);
    await page.waitForFunction(() => (window.__spaceWar.mission?.label || '').includes('FASE 2'), { timeout: 8000 });
  });

  // AC-04: bomba inimiga é BALÍSTICA — a gravidade muda a velocidade dela.
  test('AC-04: bomba inimiga acelera sob gravidade', async ({ page }) => {
    await startFlight(page);
    // alto sobre Júpiter: gravidade mensurável e SEM risco de contato de
    // superfície no intervalo da amostra (a bomba nasce em repouso e cai)
    await page.evaluate(() => window.__swDebug.goTo('jupiter'));
    await page.waitForTimeout(150);
    const n = await page.evaluate(() => window.__swDebug.dropBomb());
    expect(n).toBeGreaterThan(0);
    const v0 = await page.evaluate(() => {
      const b = window.__spaceWar.projectiles.find((p) => p.isBomb);
      return Math.hypot(b.vel.x, b.vel.y, b.vel.z);
    });
    await page.waitForTimeout(900);
    const v1 = await page.evaluate(() => {
      const b = window.__spaceWar.projectiles.find((p) => p.isBomb);
      return b ? Math.hypot(b.vel.x, b.vel.y, b.vel.z) : -1;
    });
    // solta em repouso → só a gravidade pode tê-la acelerado
    expect(v1).toBeGreaterThan(v0 + 5);
  });

  // AC-05: nukes efetivamente ilimitadas — a reserva RECARREGA após disparo.
  test('AC-05: recarga de nuke repõe a reserva', async ({ page }) => {
    await startFlight(page);
    await page.keyboard.down('KeyW');
    await page.waitForFunction(() => window.__spaceWar.ship.landed === false, { timeout: 12000 });
    await page.keyboard.up('KeyW');
    const nk0 = await page.evaluate(() => window.__spaceWar.ship.nukes);
    await page.keyboard.press('KeyF');
    await page.waitForFunction((n) => window.__spaceWar.ship.nukes === n - 1, nk0, { timeout: 3000 });
    // acelera o timer de recarga para não esperar 20 s reais
    await page.evaluate(() => { window.__spaceWar.ship.nukeRegen = 19.5; });
    await page.waitForFunction((n) => window.__spaceWar.ship.nukes === n, nk0, { timeout: 6000 });
  });

  // AC-08: TODA base de missão respeita o teto de 3% da área de superfície.
  test('AC-08: pegada da base ≤ 3% da área do corpo', async ({ page }) => {
    await startFlight(page);
    const fracs = await page.evaluate(() => {
      const m = window.__spaceWar.mission;
      return (m.targets || []).map((t) => {
        const s = t.obj.scale.x;
        const rf = 5.8 * s;                       // raio da pegada (cúpula+torres)
        const R = t.body.def.radius;
        return (rf * rf) / (4 * R * R);           // πrf² / 4πR²
      });
    });
    expect(fracs.length).toBeGreaterThan(0);
    for (const f of fracs) expect(f).toBeLessThanOrEqual(0.03);
  });

  // AC-10 (bug space-war-solar-flare-universe-overlay): flare do Sol é LOCAL —
  // visível na vizinhança solar, invisível de outro sistema.
  test('AC-10: flare solar local (regressão do bug)', async ({ page }) => {
    await startFlight(page);
    // perto da Terra (região solar): política de flare = visível
    await page.waitForFunction(() => window.__spaceWar.sunFlareVisible === true, { timeout: 5000 });
    // teleporta para o binário (≈2.7M u do Sol): flare precisa SUMIR
    await page.evaluate(() => window.__swDebug.goTo('blackhole'));
    await page.waitForFunction(() => window.__spaceWar.sunFlareVisible === false, { timeout: 5000 });
    // e voltar perto do Sol religa
    await page.evaluate(() => window.__swDebug.goTo('earth'));
    await page.waitForFunction(() => window.__spaceWar.sunFlareVisible === true, { timeout: 5000 });
  });

  // AC-06 (amostra): inimigos co-movem com o corpo-âncora (frame body-relativo).
  test('AC-06: patrulha inimiga acompanha o corpo-âncora', async ({ page }) => {
    await startFlight(page);
    const d0 = await page.evaluate(() => {
      const e = window.__spaceWar.enemies.find((x) => !x.dead && x.role === 'fighter');
      return e ? e.group.position.distanceTo(e.anchor.worldPos) / e.anchor.def.radius : -1;
    });
    expect(d0).toBeGreaterThan(0);
    await page.waitForTimeout(2500);
    const d1 = await page.evaluate(() => {
      const e = window.__spaceWar.enemies.find((x) => !x.dead && x.role === 'fighter');
      return e ? e.group.position.distanceTo(e.anchor.worldPos) / e.anchor.def.radius : -1;
    });
    // o corpo orbita e gira, mas o inimigo permanece na CASCA de patrulha
    // (1.3–2.2 raios) do próprio corpo — frame relativo, não posição absoluta
    expect(d1).toBeGreaterThan(1.0);
    expect(d1).toBeLessThan(3.0);
  });
});
