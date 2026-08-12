// NITRO (v0.8.0) — input REAL de teclado (page.keyboard): Shift queima a carga
// (33/s), dá boost de aceleração (×1,8) e teto +25%; soltando, regenera 8/s
// (×2 após 3 s limpo em velocidade); seco = sem boost + flash "SEM NITRO" 1×
// por apertada. window.__corrida só em ASSERÇÕES/leitura — nunca para dirigir.
//
// waitForTimeout restantes (T-07) — legítimos por semântica: as janelas de
// 1000 ms do teste de dreno MEDEM taxa (33/s) e os 250 ms antes de re-apertar
// Shift são setup de estado de carga; os pulsos de 40-200 ms do servo são
// largura de atuação. As janelas de dv (boost) e de regen medem por raceT
// (relógio da sim, amostrado na página) — wall-clock misturava latência de
// protocolo e sim mais lenta/rápida que a parede no CI.
// Convertidos a polling: a queima até charge ≤ 20 (era 2500 ms fixos).
import { test, expect } from '@playwright/test';

const URL = '/src/web-games/speed-run/';

// menu → corrida, tudo por teclado real (mesma convenção do input.spec.js)
async function start(page, { trackArrows = 0 } = {}) {
  await page.goto(URL);
  await page.waitForFunction(() => window.__corridaReady === true, { timeout: 40000 });
  for (let i = 0; i < trackArrows; i++) await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => window.__corrida.phase === 'race', { timeout: 25000 });
}

const snap = (page) => page.evaluate(() => {
  const G = window.__corrida;
  return { v: G.player.st.v, charge: G.nitro.charge, active: G.nitro.active, regenT: G.nitro.regenT };
});

// segura W até v >= vMin (teclado real; leitura só p/ saber quando medir)
async function holdWUntilV(page, vMin, timeout = 45000) {
  await page.keyboard.down('KeyW');
  await page.waitForFunction((v) => window.__corrida.player.st.v >= v, vMin, { timeout });
}

// SERVO de direção (mesmo padrão do input.spec): segura W e corrige a guinada
// com TOQUES de A/D proporcionais ao erro vs a tangente da pista. Roda até
// `doneFn` (avaliada na página) ser verdade ou estourar o timeout.
async function servoDrive(page, doneFn, timeoutMs) {
  await page.keyboard.down('KeyW');
  const t0 = Date.now();
  try {
    while (Date.now() - t0 < timeoutMs) {
      const s = await page.evaluate(() => {
        const G = window.__corrida, p = G.player.st;
        const tr = G.world.track, N = tr.samples.length;
        const i = Math.min(N - 1, Math.round(p.sHint * tr.M));
        const sm = tr.samples[i];
        const want = Math.atan2(-sm.tan.x, -sm.tan.z);
        let err = want - p.heading;
        while (err > Math.PI) err -= 2 * Math.PI;
        while (err < -Math.PI) err += 2 * Math.PI;
        const lat = (p.pos.x - sm.pos.x) * sm.side.x + (p.pos.z - sm.pos.z) * sm.side.z;
        return { err: err - Math.max(-0.15, Math.min(0.15, lat * 0.02)), v: p.v };
      });
      if (await page.evaluate(doneFn)) return true;
      if (Math.abs(s.err) > 0.06) {
        const key = s.err > 0 ? 'KeyA' : 'KeyD';
        await page.keyboard.down(key);
        await page.waitForTimeout(Math.min(200, Math.abs(s.err) * 450));
        await page.keyboard.up(key);
      } else {
        await page.waitForTimeout(40);
      }
    }
    return false;
  } finally {
    await page.keyboard.up('KeyW');
  }
}

test.describe('Cruis\'n Tauan — NITRO (v0.8.0)', () => {
  test('Shift dá boost real de aceleração (dv em 1 s, com vs sem)', async ({ page }) => {
    test.setTimeout(240000);
    await start(page);                                   // pista 0 (city), carro 0
    // dv medido por 1,0 s de raceT (relógio da SIM, não da parede) com o
    // servo mantendo o carro NA PISTA. No CI o gate de ativação do boost
    // atrasava e o carro saía p/ a terra (teto offroad ~41) antes/durante
    // a janela — dvNitro caía p/ metade do esperado; e wall-clock mistura
    // latência de protocolo com tempo de sim. As duas janelas partem de
    // v≈15 com o carro servoado, mesma régua nas duas pernas.
    async function measureDv(nitro) {
      // acelera servoado até v≈15 (mesmo ponto de partida nas duas janelas)
      const reached = await servoDrive(page,
        () => window.__corrida.player.st.v >= 15, 45000);
      expect(reached).toBe(true);
      await page.evaluate(() => {
        const G = window.__corrida;
        window.__m = { v0: G.player.st.v, t0: G.raceT, dv: 0, done: false };
      });
      if (nitro) await page.keyboard.down('ShiftLeft');
      const done = await servoDrive(page, () => {
        const G = window.__corrida, m = window.__m;
        if (!m.done && G.raceT - m.t0 >= 1.0) { m.dv = G.player.st.v - m.v0; m.done = true; }
        return m.done;
      }, 20000);
      if (nitro) await page.keyboard.up('ShiftLeft');
      expect(done).toBe(true);
      return page.evaluate(() => window.__m.dv);
    }
    const dvBase = await measureDv(false);
    // R reinicia (carga volta a 100) e repete a janela COM Shift
    await page.keyboard.press('KeyR');
    await page.waitForFunction(() => window.__corrida.phase === 'race', { timeout: 25000 });
    const dvNitro = await measureDv(true);
    // ×1,8 de acel menos o falloff de velocidade: folga p/ ruído do servo
    expect(dvNitro).toBeGreaterThan(dvBase * 1.35);
  });

  test('barra drena segurando Shift (~33/s) e o HUD reflete', async ({ page }) => {
    test.setTimeout(240000);
    await start(page);
    await holdWUntilV(page, 15);
    await page.keyboard.down('ShiftLeft');
    await page.waitForTimeout(1000);
    const s1 = await snap(page);
    await page.keyboard.up('ShiftLeft');
    await page.keyboard.up('KeyW');
    expect(s1.active || s1.charge < 80).toBe(true);      // queimou durante a janela
    expect(s1.charge).toBeLessThan(80);                  // 100 − ~33
    expect(s1.charge).toBeGreaterThan(40);               // mas não esvaziou
    const w = await page.evaluate(() =>
      parseFloat(document.getElementById('nitroFill').style.width));
    expect(w).toBeLessThan(90);                          // barra do HUD desceu
  });

  test('soltar → regen 8/s; 3 s limpo em velocidade → regen DOBRA', async ({ page }) => {
    test.setTimeout(300000);
    // Serra do Tauan (pista 3): reta longa p/ ficar limpo de colisões no servo
    await start(page, { trackArrows: 3 });
    // queima até a carga cair sob ~20 p/ ter HEADROOM: o regen a 16/s
    // encheria o tanque antes da dobra ser visível se a queima fosse curta
    // demais. polling no estado real (T-07) — era waitForTimeout(2500).
    await holdWUntilV(page, 15);
    await page.keyboard.down('ShiftLeft');
    await page.waitForFunction(() => window.__corrida.nitro.charge <= 20, { timeout: 10000 });
    await page.keyboard.up('ShiftLeft');
    await page.keyboard.up('KeyW');
    // regen base: 1,0 s de raceT (relógio da sim — wall-clock no CI mistura
    // latência de protocolo e sim mais lenta que a parede) já recupera ~8
    const r1 = await page.evaluate(() => new Promise((resolve) => {
      const G = window.__corrida;
      const c0 = G.nitro.charge, t0 = G.raceT;
      const iv = setInterval(() => {
        if (G.raceT - t0 >= 1.0) { clearInterval(iv); resolve({ c0, c1: G.nitro.charge }); }
      }, 8);
    }));
    expect(r1.c1).toBeGreaterThan(r1.c0 + 3);
    expect(r1.c1).toBeLessThan(70);
    // servo limpo (W segurado, sem bater): regenT ≥ 3,2 s → taxa dobra p/
    // 16/s; o ganho é medido DENTRO do servo por 1,0 s de raceT — medir
    // DEPOIS de soltar o servo deixava o carro bater na janela, o regenT
    // resetava e a taxa caía p/ 8/s (falha intermitente no CI)
    await page.evaluate(() => {
      window.__regen = { armed: false, c2: 0, t2: 0, c3: 0, done: false };
    });
    const got = await servoDrive(page, () => {
      const G = window.__corrida, m = window.__regen;
      if (!m.armed) {
        if (G.nitro.regenT >= 3.2) { m.armed = true; m.c2 = G.nitro.charge; m.t2 = G.raceT; }
        return false;
      }
      if (G.raceT - m.t2 >= 1.0) { m.c3 = G.nitro.charge; m.done = true; }
      return m.done;
    }, 45000);
    expect(got).toBe(true);
    const m = await page.evaluate(() => window.__regen);
    // ~16/s (margem p/ jitter); se o tanque encheu (cap 100), o ganho
    // achatado no teto também prova o regen
    expect(m.c3 - m.c2 > 11 || m.c3 >= 99.5).toBe(true);
  });

  test('seco: SEM boost, flash "SEM NITRO" 1× por apertada', async ({ page }) => {
    test.setTimeout(420000);
    await start(page);
    await holdWUntilV(page, 15);
    await page.keyboard.down('ShiftLeft');
    // drena até secar (100/33 ≈ 3,1 s; exige v > 1 — reta da cidade comporta)
    await page.waitForFunction(() => window.__corrida.nitro.charge <= 0.5, { timeout: 10000 });
    // seco E segurando Shift: o input que chega na física tem nitro DESLIGADO
    // — captura ATÔMICA dentro do polling (ler depois do polling corria o
    // regen: o tanque volta a ≥5 e o gate liga de novo em <1 s de sim).
    const dry = await (await page.waitForFunction(() => {
      const G = window.__corrida;
      if (G.player.input.nitro === 0 && G.nitro.active === false) {
        return { inNitro: G.player.input.nitro, active: G.nitro.active, v: G.player.st.v };
      }
      return false;
    }, { timeout: 4000 })).jsonValue();
    expect(dry.inNitro).toBe(0);
    expect(dry.active).toBe(false);
    // flash: solta e REAPERTA com o tanque ainda seco (< 5) → "SEM NITRO" 1×
    await page.keyboard.up('ShiftLeft');
    await page.waitForTimeout(250);                        // regen: ~2 de carga
    await page.keyboard.down('ShiftLeft');
    await page.waitForFunction(() =>
      document.getElementById('nitroMsg').style.display === 'block', { timeout: 2000 });
    // sem boost: dv da janela seguinte é o de motor normal a v≈40+ (com nitro
    // pleno seria ~2×; a histerese segura o boost até a carga ≥ 5)
    await page.waitForTimeout(1000);
    const v1 = (await snap(page)).v;
    expect(v1 - dry.v).toBeLessThan(12);
    // segurando NÃO repete: após o flash (0,9 s) a msg some com a tecla apertada
    const still = await page.evaluate(() =>
      document.getElementById('nitroMsg').style.display);
    expect(still).toBe('none');
    await page.keyboard.up('ShiftLeft');
    await page.keyboard.up('KeyW');
  });
});
