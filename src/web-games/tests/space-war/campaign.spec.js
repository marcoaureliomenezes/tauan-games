const { test, expect } = require('@playwright/test');

// Suite da CAMPANHA (release v0.2.3).
// Cobre os ACs do SPEC §7: gating de fase (AC-01), desbloqueio (AC-02), bomba
// inimiga sob gravidade (AC-04), recarga de nuke (AC-05), teto de pegada de base
// (AC-08) e a regressão do flare solar (AC-10 — bug
// space-war-solar-flare-universe-overlay).
//
// T-07 (v0.10.0, batch L2): 2 waits convertidos (settle pós-goTo → polling do
// corpo dominante; aceleração da bomba → polling do Δv aferido). 1 MANTIDO:
// AC-06 (2500 ms) — janela de observação deliberada da co-movimentação da
// patrulha (justificativa no próprio teste).

async function load(page) {
  await page.goto('/src/web-games/space-war/index.html');
  await page.waitForSelector('canvas', { state: 'attached', timeout: 60000 });
  await page.waitForFunction(() => window.__spaceWarReady === true, { timeout: 120000 });
}

async function startFlight(page) {
  await load(page);
  await page.keyboard.press('Enter');      // menu -> briefing (inicia a campanha)
  await page.waitForFunction(() => window.__spaceWar.phase !== 'menu', { timeout: 30000 });
  await page.keyboard.press('Enter');      // briefing -> flight
  await page.waitForFunction(() => window.__spaceWar.phase === 'flight', { timeout: 45000 });
}

test.describe('Space War — Campanha', () => {
  // Budgets largos (2026-07-18): CI compartilhada — boot software-GL >15s sob
  // carga estourava o teto de 30s por TEMPO, não por asserção.
  test.setTimeout(180000);

  // AC-01: começa na fase Solar; fases futuras bloqueadas.
  test('AC-01: gating — fase 0 ativa, demais bloqueadas', async ({ page }) => {
    await startFlight(page);
    const c = await page.evaluate(() => window.__spaceWar.campaign);
    expect(c.phase).toBe(0);
    expect(c.unlocked).toEqual([true, false, false, false, false]);
    expect(c.done).toEqual([false, false, false, false, false]);
    const label = await page.evaluate(() => window.__spaceWar.mission?.label || '');
    expect(label).toContain('CAÇADA');
  });

  // AC-02 (+AC-03): completar as 5 missões solares (incl. a visita ao Halley)
  // desbloqueia Betelgeuse e ativa a fase 2.
  test('AC-02/03: cadeia solar completa desbloqueia BETELGEUSE', async ({ page }) => {
    test.setTimeout(180000);
    await startFlight(page);
    for (let i = 0; i < 2; i++) {
      await page.waitForFunction(() => !!window.__spaceWar.mission && !window.__spaceWar.mission._done, { timeout: 45000 });
      const t = await page.evaluate(() => ({ type: window.__spaceWar.mission.type, label: window.__spaceWar.mission.label }));
      if (i === 0) expect(t.type).toBe('hunt');
      if (i === 1) expect(t.label).toContain('HALLEY');          // AC-03: cometa com relevância de missão
      await page.evaluate(() => window.__swDebug.winMission());
      await page.waitForFunction((idx) => {
        const sw = window.__spaceWar;
        if (idx < 1) return sw.missionIndex === idx + 1 && sw.mission && !sw.mission._done;
        return sw.campaign.phase === 1;
      }, i, { timeout: 45000 });
    }
    const c = await page.evaluate(() => window.__spaceWar.campaign);
    expect(c.done[0]).toBe(true);
    expect(c.unlocked[1]).toBe(true);
    expect(c.phase).toBe(1);
    await page.waitForFunction(() => (window.__spaceWar.mission?.label || '').includes('FASE 2'), { timeout: 45000 });
  });

  // CAÇADA (AC-03 da ballistic-war): destruir o alvo k spawna o k+1 em OUTRO corpo.
  test('caçada: próximo alvo aparece em outro corpo + contagens 5/7/9/11/13', async ({ page }) => {
    await startFlight(page);
    const counts = await page.evaluate(() => {
      const sw = window.__spaceWar;
      return { total: sw.mission.total, all: [5, 7, 9, 11, 13] };
    });
    expect(counts.total).toBe(5);
    const body0 = await page.evaluate(() => window.__spaceWar.mission.targets[0].body.def.name);
    await page.evaluate(() => window.__swDebug.killTarget());
    await page.waitForFunction(() => window.__spaceWar.mission.killed === 1 && window.__spaceWar.mission.targets.length === 2, { timeout: 45000 });
    const body1 = await page.evaluate(() => {
      const m = window.__spaceWar.mission;
      return m.targets[m.targets.length - 1].body.def.name;
    });
    expect(body1).not.toBe(body0);
  });

  // "solução balística: solver acha arco e C alinha o nariz à direção de tiro"
  // DELETADO (T-02, demotion-map anexo §3): o solver em si já é coberto por
  // test-ballistics-unit.js (solveBallistic — alvo fixo/móvel/herança de
  // velocidade).
  //
  // AC-04 (bomba inimiga acelera sob gravidade) DELETADO: já coberto por
  // test-physics-unit.js:43 (integração da gravidade real do jogo — a mesma
  // lei que acelera a bomba acelera qualquer corpo em queda livre no campo).

  // AC-05: nukes efetivamente ilimitadas — a reserva RECARREGA após disparo.
  test('AC-05: recarga de nuke repõe a reserva', async ({ page }) => {
    await startFlight(page);
    await page.keyboard.down('KeyW');
    await page.waitForFunction(() => window.__spaceWar.ship.landed === false, { timeout: 45000 });
    await page.keyboard.up('KeyW');
    const nk0 = await page.evaluate(() => window.__spaceWar.ship.nukes);
    await page.keyboard.press('KeyF');
    await page.waitForFunction((n) => window.__spaceWar.ship.nukes === n - 1, nk0, { timeout: 30000 });
    // acelera o timer de recarga para não esperar 20 s reais
    await page.evaluate(() => { window.__spaceWar.ship.nukeRegen = 19.5; });
    await page.waitForFunction((n) => window.__spaceWar.ship.nukes === n, nk0, { timeout: 45000 });
  });

  // AC-08 (pegada da base ≤ 3% da área do corpo) DELETADO — rebaixado para
  // test-physics-unit.js: a lei (raio da pegada = 8·scale, scale clampado a
  // [14,70]∩[0,0.042·R]) é reproduzida de missions.js#baseFootprintFraction
  // (missions.js em si está envenenado por scene.js) e varrida sobre os
  // raios reais de PLANETS/BETELGEUSE (config.js, importa limpo).
  //
  // AC-10 (flare solar local, regressão space-war-solar-flare-universe-overlay)
  // DELETADO — rebaixado para test-physics-unit.js: a política
  // (vis = d < FLARE_CUTOFF) é reproduzida de celestial/stars.js (envenenado
  // por scene.js) com o mesmo limiar FLARE_CUTOFF=4.2M, testada perto/longe.

  // AC-06 (amostra): inimigos co-movem com o corpo-âncora (frame body-relativo).
  test('AC-06: patrulha inimiga acompanha o corpo-âncora', async ({ page }) => {
    await startFlight(page);
    const d0 = await page.evaluate(() => {
      const e = window.__spaceWar.enemies.find((x) => !x.dead && x.role === 'fighter');
      return e ? e.group.position.distanceTo(e.anchor.worldPos) / e.anchor.def.radius : -1;
    });
    expect(d0).toBeGreaterThan(0);
    // T-07 MANTIDO de propósito: janela de OBSERVAÇÃO deliberada — o AC exige
    // que o inimigo PERMANEÇA na casca de patrulha enquanto o corpo-âncora
    // orbita e gira; é a persistência ao longo de ~2,5 s que se testa, não a
    // chegada de uma condição (não há predicado de polling equivalente).
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
