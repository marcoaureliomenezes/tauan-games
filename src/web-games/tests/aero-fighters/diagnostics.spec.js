const { test, expect } = require('@playwright/test');

test.setTimeout(60000);

// T-07 (v0.10.0) — sleeps fixos convertidos em waitForFunction sobre estado real.
// Mantido de propósito (justificativa inline):
//   'no console errors' 15000ms — janela de soak: prova que NÃO há erros durante
//   15 s de voo contínuo sob W (condição negativa sobre duração fixa de relógio).

async function openAero(page, map = 'rio', seed = 'qa-001') {
  await page.goto(`/src/web-games/aero-fighters/index.html?testMode=1&map=${map}&seed=${seed}`);
  await page.waitForSelector('canvas', { state: 'attached', timeout: 15000 });
  await page.waitForFunction(() => window.__aeroDebug && window.game, { timeout: 15000 });
}

async function startGame(page) {
  await page.keyboard.press('Space');
  await page.waitForFunction(() => window.game.running === true, { timeout: 3000 });
}

test.describe('Aero Fighters — QA Diagnostics', () => {
  test('debug API exposes required snapshot fields', async ({ page }) => {
    await openAero(page);
    const snapshot = await page.evaluate(() => window.__aeroDebug.getSnapshot());
    expect(snapshot.runtime.testMode).toBe(true);
    expect(snapshot.map.activeMap).toBe('rio');
    expect(snapshot.player).toHaveProperty('speed');
    expect(snapshot.renderer).toHaveProperty('calls');
    expect(snapshot.frames).toHaveProperty('worstFrameMs');
  });

  // T-C-14 (release v0.3.4 — SPEC §F): em Inhaúma o
  // "layout seedado" deixou de existir — os alvos são a GUARNIÇÃO de Cachoeira
  // (spawn no create do mapa, rng derivado seed+':cachoeira-garrison') + a agenda
  // da CAMPANHA (rng derivado seed+':campaign'). O contrato de determinismo passa
  // a ser: mesma seed ⇒ mesma guarnição, bit-a-bit, entre reloads. (Filtra por
  // formationId 'cachoeira-*' para não depender do relógio de parede — os spawns
  // do Ato 1 são escalonados por tempo de campanha e variam com o wall-clock.)
  // SENTINEL: reload-identity
  test('seeded campaign garrison is stable across reloads (inhauma)', async ({ page }) => {
    const garrisonSnapshot = () =>
      window.game.targets
        .filter((t) => typeof t.formationId === 'string' && t.formationId.startsWith('cachoeira-'))
        .map((t) => [t.formationId, t.memberIndex, t.type, t.spawnX, t.spawnY, t.spawnZ]);
    await openAero(page, 'inhauma', 'stable-seed');
    await startGame(page);
    await page.waitForFunction(() =>
      window.game.targets.some((t) => String(t.formationId || '').startsWith('cachoeira-')), { timeout: 4000 });
    const first = await page.evaluate(garrisonSnapshot);
    expect(first.length).toBeGreaterThan(0);
    await page.reload();
    await page.waitForFunction(() => window.__aeroDebug && window.game, { timeout: 5000 });
    await startGame(page);
    await page.waitForFunction(() =>
      window.game.targets.some((t) => String(t.formationId || '').startsWith('cachoeira-')), { timeout: 4000 });
    const second = await page.evaluate(garrisonSnapshot);
    expect(second).toEqual(first);
  });

  // T-01 (v0.11.0, test lifecycle demotion): "seeded target layout is stable
  // across reloads (legacy map)" deleted — determinism for the legacy layout
  // (rio/desert/islands) is proven by tools/test-aero-cachoeira.mjs:196 (seed
  // determinism pattern) + tools/test-aero-sim.js:111 ("mission spawn validation
  // across deterministic seeds remains stable"). The reload-identity SENTINEL
  // above stays as the one browser-boot check for this class.

  test('renderer and frame metrics are finite', async ({ page }) => {
    await openAero(page, 'desert', 'metrics-seed');
    await startGame(page);
    // T-07: polling do primeiro frame renderizado (stats acumuladas) em vez de sleep fixo
    await page.waitForFunction(() => window.__aeroDebug.getSnapshot().renderer.calls > 0, { timeout: 4000 });
    const snapshot = await page.evaluate(() => window.__aeroDebug.getSnapshot());
    expect(Number.isFinite(snapshot.renderer.calls)).toBe(true);
    expect(Number.isFinite(snapshot.renderer.triangles)).toBe(true);
    expect(Number.isFinite(snapshot.frames.averageFps)).toBe(true);
    expect(Number.isFinite(snapshot.frames.worstFrameMs)).toBe(true);
  });

  test('no console errors during deterministic scenario', async ({ page }) => {
    const errors = [];
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('pageerror', (e) => errors.push(e.message));
    await openAero(page, 'rio', 'quiet-seed');
    await startGame(page);
    await page.keyboard.down('KeyW');
    // T-07 KEPT: janela de soak — a asserção é NEGATIVA (zero erros de console
    // durante 15 s de voo contínuo sob W); a duração fixa é o próprio cenário.
    await page.waitForTimeout(15000);
    await page.keyboard.up('KeyW');
    expect(errors).toEqual([]);
  });
});
