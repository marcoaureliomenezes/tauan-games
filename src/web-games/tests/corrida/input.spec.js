// Input REAL de teclado (page.keyboard): prova que as TECLAS dirigem o carro —
// o smoke dirige o jogador via hook st.ai (isPlayer=false) e nunca exercita o
// caminho playerInput(). window.__corrida aparece aqui SÓ em asserções/leitura,
// NUNCA para dirigir. Convenções do harness: globalSetup serve a raiz do repo.
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

// PILOTO de teclado p/ o salto: segura ArrowUp e corrige a guinada com TOQUES
// de A/D proporcionais ao erro (heading vs tangente da pista + correção
// lateral p/ recentralizar). TODA a entrada é teclado real — um humano também
// esterça; __corrida só LÊ estado (nunca injeta IA/posição). Toques em vez de
// segurar: a latência do evaluate (200 ms+ em CI lento) torna bang-bang
// INSTÁVEL — o carro atravessava a pista de cerca em cerca (probe ws-input).
async function driveArrowUpUntilAirborne(page, timeoutMs) {
  await page.keyboard.down('ArrowUp');
  const t0 = Date.now();
  try {
    while (Date.now() - t0 < timeoutMs) {
      const s = await page.evaluate(() => {
        const G = window.__corrida, p = G.player.st;
        if (p.airborne) return { airborne: true };
        if (G.phase === 'finished') return { finished: true };   // cruzou o fim sem voar
        const tr = G.world.track, N = tr.samples.length;
        const sm = tr.samples[Math.round(p.sHint * tr.M) % N];
        const want = Math.atan2(-sm.tan.x, -sm.tan.z);
        let err = want - p.heading;
        while (err > Math.PI) err -= 2 * Math.PI;
        while (err < -Math.PI) err += 2 * Math.PI;
        // side = up×tan: lat > 0 = ESQUERDA da centerline → precisa D (−heading)
        const lat = (p.pos.x - sm.pos.x) * sm.side.x + (p.pos.z - sm.pos.z) * sm.side.z;
        return { airborne: false, s: p.sHint, v: p.v, err: err - Math.max(-0.15, Math.min(0.15, lat * 0.02)) };
      });
      if (s.airborne) return { flew: true };
      if (s.finished) return { flew: false };
      // err > 0 → precisa +heading → A (sinal travado no teste de guinada)
      if (Math.abs(s.err) > 0.06) {
        const key = s.err > 0 ? 'KeyA' : 'KeyD';
        await page.keyboard.down(key);
        await page.waitForTimeout(Math.min(200, Math.abs(s.err) * 450));
        await page.keyboard.up(key);
      } else {
        await page.waitForTimeout(40);
      }
    }
    return { flew: false };
  } finally {
    await page.keyboard.up('ArrowUp');
  }
}

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

  test('ArrowUp atravessando crista de salto (Serra do Tauan): episódio AÉREO', async ({ page }) => {
    test.setTimeout(90000);
    // Sprint (pista 4): cristas de salto PROJETADAS em s=0.34/0.58/0.78, amp
    // 6,5·exp(−(d/26)²) — slope 0,21 → decolagem garantida com v > ~42 u/s.
    // (A lombada da city, amp 1,7, exige > 43,7 u/s logo após a largada —
    // marginal demais p/ input real; a reta de ~700 m da serra dá margem.)
    // Velocità GT (carro 3, acel 32/top 76). O servo decola na crista 1 ou 2.
    await start(page, { trackArrows: 3, carArrows: 2 });
    await expect(page.locator('#trackName')).toHaveText('Serra do Tauan');
    const flew = await driveArrowUpUntilAirborne(page, 75000);
    expect(flew.flew).toBe(true);
  });

  test('R reseta a corrida: carro volta ao grid, v≈0 e raceT≈0', async ({ page }) => {
    test.setTimeout(60000);
    await start(page);
    const p0 = await snap(page);
    await page.keyboard.down('KeyW');
    await page.waitForTimeout(1500);
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
