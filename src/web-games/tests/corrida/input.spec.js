// Input REAL de teclado (page.keyboard): prova que as TECLAS dirigem o carro —
// o smoke dirige o jogador via hook st.ai (isPlayer=false) e nunca exercita o
// caminho playerInput(). window.__corrida aparece aqui SÓ em asserções/leitura,
// NUNCA para dirigir. Convenções do harness: globalSetup serve a raiz do repo.
//
// waitForTimeout restantes (T-07) — NÃO são sleeps preguiçosos, ficam por
// semântica de controle/medição: (a) segurar W 3 s é a AÇÃO testada
// ("segurar W 3 s"); (b) os 500 ms após toques A/D são janelas de medição de
// guinada. Waits convertidos a polling: arranque do teste de R.
import { test, expect } from '@playwright/test';

const URL = '/src/web-games/speed-run/';

// menu → corrida, tudo por teclado real. trackArrows/carArrows navegam o menu
// (linha 0 = pista, linha 1 = carro). Headless: countdown 0,1 s → phase 'race'.
async function start(page, { trackArrows = 0, carArrows = 0 } = {}) {
  await page.goto(URL);
  await page.waitForFunction(() => window.__corridaReady === true, { timeout: 15000 });
  for (let i = 0; i < trackArrows; i++) await page.keyboard.press('ArrowRight');
  if (carArrows) {
    await page.keyboard.press('ArrowDown');                 // linha CARRO
    for (let i = 0; i < carArrows; i++) await page.keyboard.press('ArrowRight');
  }
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => window.__corrida.phase === 'race', { timeout: 8000 });
}

// leitura p/ ASSERÇÕES (nunca para dirigir)
const snap = (page) => page.evaluate(() => {
  const G = window.__corrida, p = G.player.st;
  return { phase: G.phase, raceT: G.raceT, v: p.v, heading: p.heading, x: p.pos.x, z: p.pos.z, airborne: p.airborne };
});

test.describe('Cruis\'n Tauan — input real de teclado', () => {
  test('segurar W 3 s: velocidade > 0 e posição avança', async ({ page }) => {
    await start(page);
    const p0 = await snap(page);
    await page.keyboard.down('KeyW');
    await page.waitForTimeout(3000);
    await page.keyboard.up('KeyW');
    const p1 = await snap(page);
    expect(p1.v).toBeGreaterThan(5);
    expect(Math.hypot(p1.x - p0.x, p1.z - p0.z)).toBeGreaterThan(10);
  });

  test('A/D em velocidade: guinada com o sinal certo (A = +heading, D = −heading)', async ({ page }) => {
    test.setTimeout(60000);
    await start(page);
    await page.keyboard.down('KeyW');
    await page.waitForFunction(() => window.__corrida.player.st.v > 25, { timeout: 15000 });
    const h0 = (await snap(page)).heading;
    await page.keyboard.down('KeyA');
    await page.waitForTimeout(500);
    await page.keyboard.up('KeyA');
    const h1 = (await snap(page)).heading;
    await page.keyboard.down('KeyD');
    await page.waitForTimeout(500);
    await page.keyboard.up('KeyD');
    await page.keyboard.up('KeyW');
    const h2 = (await snap(page)).heading;
    // playerInput: A/esquerda → steer +1 → yawRate + (vira p/ a esquerda da
    // tela); D → −1. O mapeamento antigo estava INVERTIDO (bug 2026-07-18) —
    // este teste trava a regressão com input real.
    expect(h1 - h0).toBeGreaterThan(0.05);
    expect(h2 - h1).toBeLessThan(-0.05);
  });

  // "ArrowUp atravessando crista de salto (Serra do Tauan): episódio AÉREO"
  // DEMOVIDO (T-03, map 2026-08-12T160030Z §4): a mecânica de decolagem na
  // crista é 100% de physics.js/world.js (sem UI) — coberta por um laço
  // stepCar() puro em tools/test-corrida-physics.mjs ("crista de lombada ⇒
  // decolagem + pouso"). O orçamento de browser eliminado era de até 90 s.

  test('R reseta a corrida: carro volta ao grid, v≈0 e raceT≈0', async ({ page }) => {
    test.setTimeout(60000);
    await start(page);
    const p0 = await snap(page);
    await page.keyboard.down('KeyW');
    // polling no estado real (T-07): espera o carro SE MOVER de verdade —
    // não um sleep fixo (era waitForTimeout(1500))
    await page.waitForFunction((p) => {
      const G = window.__corrida.player.st;
      return Math.hypot(G.pos.x - p.x, G.pos.z - p.z) > 5;
    }, { x: p0.x, z: p0.z }, { timeout: 8000 });
    await page.keyboard.up('KeyW');
    const p1 = await snap(page);
    expect(Math.hypot(p1.x - p0.x, p1.z - p0.z)).toBeGreaterThan(5);   // dirigiu de verdade
    const t0 = p1.raceT;
    await page.keyboard.press('KeyR');
    // Captura ATÔMICA no predicado: raceT NUNCA decresce em corrida, então
    // raceT < t0 prova o reset — sem gate apertado de janela nem espera fixa
    // (ambiente lento: roundtrips de 1-3 s perdiam a janela de 0,6 s pós-reset;
    // a IA do grid empurra o jogador parado a partir de ~0,7 s de corrida,
    // então as asserções físicas usam limites que absorvem o empurrão inicial).
    const handle = await page.waitForFunction((t) => {
      const G = window.__corrida;
      if (G.raceT >= t) return false;
      const p = G.player.st;
      return { phase: G.phase, raceT: G.raceT, v: p.v, x: p.pos.x, z: p.pos.z };
    }, t0 - 0.5, { timeout: 15000, polling: 25 });
    const p2 = await handle.jsonValue();
    expect(p2.raceT).toBeLessThan(t0 - 0.5);                  // cronômetro zerou
    expect(p2.v).toBeLessThan(15);                            // parado (± empurrão da IA)
    expect(Math.hypot(p2.x - p0.x, p2.z - p0.z)).toBeLessThan(15);   // de volta ao grid
  });
});
