const { test, expect } = require('@playwright/test');

test.setTimeout(120000); // teto de wall clock p/ game time lento sob load alto (2026-07-21)

// T-C-14 (release v0.3.4 — SPEC §C): o serviço recarrega
// SÓ heavy/nuke/rod — o míssil leve é infinito (T-C-08): não é consumido nem
// reposto (service-scene.js#updateService). player.missiles fica no valor fixo de
// exibição que tinha (o ∞ é do HUD).
//
// T-07 (v0.10.0): único waitForTimeout mantido de propósito (justificativa inline):
//   1200ms no teste 'keeps aircraft grounded' — janela de estabilidade: prova que
//   o estado/y NÃO muda após NEXT_SORTIE_READY (o before/after É a asserção).
//
// T-01 (v0.11.0, test lifecycle demotion): "MR service scene debug path refills
// heavy/nuke/rod — NOT light" deleted — the real refill behavior is proven by
// tools/test-aero-sortie-sim.js:66 ("service refills full current armament only
// at completion") + tools/test-aero-weapons-sim.js:265 ("rod ammo refills to
// MISSILES_ROD.MAX at service completion"), both driving the real
// service-scene.js#updateService function this E2E only re-checked indirectly.

test('MR service complete keeps aircraft grounded and tells player how to restart', async ({ page }) => {
  // T-C-14 (campaign-v1 — SPEC §F): em Inhaúma o "completed-gate" da surtida
  // seguinte passa pela CAMPANHA — spawnMission é no-op (missions.js), a surtida
  // reinicia sem wave nova e o mundo segue vivo (campaign.js). A UX de solo
  // (NEXT_SORTIE_READY + instruções) é inalterada.
  await page.goto('/src/web-games/aero-fighters/index.html?testMode=1&map=inhauma&seed=mr-service-next');
  await page.waitForFunction(() => window.__aeroDebug && window.game, { timeout: 120000 });
  await page.evaluate(() => {
    window.game.missionRealism.sortie.state = 'SERVICE_SCENE';
    window.game.running = true;
  });
  // 20 s: sob carga o rAF desacelera e o serviço (duração em dt SIMULADO) leva
  // mais tempo de parede — flakava sem bug (2026-07-02). Asserções inalteradas.
  await page.waitForFunction(() => window.__aeroDebug.getSnapshot().serviceState === 'complete', { timeout: 20000 });
  const before = await page.evaluate(() => ({
    y: window.game.player.y,
    state: window.game.missionRealism.sortie.state,
    mission: document.getElementById('mission')?.textContent || '',
    guide: document.getElementById('approach')?.textContent || '',
  }));
  // T-07 KEPT: janela de estabilidade — prova que, completo o serviço, o estado
  // (NEXT_SORTIE_READY) e o y NÃO mudam: o par before/after sobre a janela fixa
  // é o dado da asserção (condição negativa, não espera por estado).
  await page.waitForTimeout(1200);
  const after = await page.evaluate(() => ({
    y: window.game.player.y,
    state: window.game.missionRealism.sortie.state,
    mission: document.getElementById('mission')?.textContent || '',
    guide: document.getElementById('approach')?.textContent || '',
  }));
  expect(before.state).toBe('NEXT_SORTIE_READY');
  expect(after.state).toBe('NEXT_SORTIE_READY');
  expect(Math.abs(after.y - before.y)).toBeLessThan(0.2);
  expect(after.mission).toContain('PRÓXIMA MISSÃO');
  expect(after.guide).toContain('ESPAÇO');
});
