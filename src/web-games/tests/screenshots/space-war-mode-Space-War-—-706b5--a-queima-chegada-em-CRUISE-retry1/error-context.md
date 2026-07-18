# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: space-war/mode.spec.js >> Space War — 3 estados de voo (ORBIT/CRUISE/JOURNEY) >> AC-04: JOURNEY durante a queima; chegada em CRUISE
- Location: tests/space-war/mode.spec.js:93:3

# Error details

```
Test timeout of 60000ms exceeded.
```

```
Error: page.waitForFunction: Test timeout of 60000ms exceeded.
```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - generic:
    - generic: "CAÇADA FASE 1 — SISTEMA SOLAR: alvo 1/5 — base em Lua"
    - generic: ◎ ÓRBITA — SISTEMA TERRA
    - generic: "CAMPO: Terra"
    - generic: "ALT: 10.0k u"
    - generic: "VEL: 66 u/s"
    - generic: "🛟 THR: 0%"
    - generic: "G: 0.1 u/s²"
    - generic: v○ 57 u/s · tang 349 u/s · rad +1 u/s
    - generic: "FUGA: 80 u/s · 82% 🛰 ÓRBITA"
    - generic: "CASCO: 100%"
    - generic: "☢ NUKES: 4 · ✦[G] ∞ · Ħ[H] PRONTA"
    - generic: "SCORE: 000000"
    - generic: "ABATES: 0"
    - generic: "→ Betelgeuse: 23537.4k u"
  - generic: ⭒ VIAGEM INTERESTELAR → Betelgeuse · 3:33 de queima contínua
  - generic: "[W/S] velocidade · [X] parar · [setas] virar · [C] apontar · [N] auto-aproximação · [O] órbita · [V] observar · [T] alvo · [Shift] turbo · [M] mapa · [Z] assist · [P] pausa"
```

# Test source

```ts
  2   | 
  3   | // Suite da release space-war-three-states-v1 — a máquina de 3 estados de voo:
  4   | //   ORBIT (sistema planetário) · CRUISE (interplanetário) · JOURNEY (interestelar)
  5   | // AC-01 boot acoplado à Terra (ORBIT) · AC-02 transição ORBIT→CRUISE→ORBIT com
  6   | // histerese · AC-03 mapas planetários (estações/luas novas) · AC-04 JOURNEY
  7   | // espelha a queima · AC-05 corredor de estrelas APAGADO dentro do sistema
  8   | // planetário (regressão da aberração "estrelas antes de Júpiter").
  9   | 
  10  | async function load(page) {
  11  |   await page.goto('/src/web-games/space-war/index.html');
  12  |   await page.waitForSelector('canvas', { state: 'attached', timeout: 30000 });
  13  |   await page.waitForFunction(() => window.__spaceWarReady === true, { timeout: 45000 });
  14  | }
  15  | 
  16  | async function startFlight(page) {
  17  |   await load(page);
  18  |   await page.keyboard.press('Enter');
  19  |   await page.waitForTimeout(150);
  20  |   await page.keyboard.press('Enter');
  21  |   await page.waitForFunction(() => window.__spaceWar.phase === 'flight', { timeout: 10000 });
  22  | }
  23  | 
  24  | // Máquina compartilhada com outras suítes (load alto): budgets largos.
  25  | test.describe('Space War — 3 estados de voo (ORBIT/CRUISE/JOURNEY)', () => {
  26  |   test.setTimeout(150000);
  27  | 
  28  |   // AC-01: a nave nasce ACOPLADA ao sistema planetário da Terra.
  29  |   test('AC-01: boot em modo ORBIT no sistema Terra (regime orbital)', async ({ page }) => {
  30  |     await startFlight(page);
  31  |     await page.waitForFunction(() => window.__spaceWar.mode === 'orbit', { timeout: 15000 });
  32  |     const st = await page.evaluate(() => ({
  33  |       planetary: window.__spaceWar.planetary && window.__spaceWar.planetary.key,
  34  |       systems: window.__spaceWar.planetarySystems.map((s) => s.key),
  35  |       earthRadius: window.__spaceWar.planetarySystems.find((s) => s.key === 'earth')?.radius,
  36  |     }));
  37  |     expect(st.planetary).toBe('earth');
  38  |     // mapas planetários: 8 do solar + 3 de Betelgeuse (escopo da release)
  39  |     expect(st.systems.length).toBe(11);
  40  |     // regra do operador: raio = 1.5 × órbita do satélite mais distante
  41  |     const lua = await page.evaluate(() => {
  42  |       const l = window.__spaceWar.bodies.find((b) => b.def.name === 'Lua');
  43  |       return l ? l.orbit : 0;
  44  |     });
  45  |     expect(st.earthRadius).toBeCloseTo(lua * 1.5, 3);
  46  |   });
  47  | 
  48  |   // AC-02: cruza a borda → CRUISE; volta → ORBIT no sistema de Marte.
  49  |   test('AC-02: ORBIT→CRUISE ao sair do sistema; re-acopla em Marte', async ({ page }) => {
  50  |     await startFlight(page);
  51  |     await page.waitForFunction(() => window.__spaceWar.mode === 'orbit', { timeout: 15000 });
  52  |     // longe de qualquer sistema planetário → CRUISE
  53  |     await page.evaluate(() => window.__swDebug.goTo('mars', 30));
  54  |     await page.waitForFunction(() => window.__spaceWar.mode === 'cruise', { timeout: 15000 });
  55  |     const cruise = await page.evaluate(() => ({
  56  |       planetary: window.__spaceWar.planetary,
  57  |       blend: window.__spaceWar.modeBlend,
  58  |     }));
  59  |     expect(cruise.planetary).toBe(null);
  60  |     expect(cruise.blend).toBeLessThan(1);        // transição em curso (gradual)
  61  |     // perto de Marte → acopla no sistema planetário de Marte
  62  |     await page.evaluate(() => window.__swDebug.goTo('mars', 2.2));
  63  |     await page.waitForFunction(
  64  |       () => window.__spaceWar.mode === 'orbit' && window.__spaceWar.planetary?.key === 'mars',
  65  |       { timeout: 15000 },
  66  |     );
  67  |   });
  68  | 
  69  |   // AC-03: mapas planetários têm mobília orbital (estações/satélites + luas novas).
  70  |   test('AC-03: estações orbitais e luas de Betelgeuse existem como corpos', async ({ page }) => {
  71  |     await startFlight(page);
  72  |     const found = await page.evaluate(() => {
  73  |       const keys = ['iss', 'sat1', 'marsstation', 'jupstation', 'satstation', 'brasastation'];
  74  |       const out = {};
  75  |       for (const k of keys) {
  76  |         const b = window.__spaceWar.bodies.find((x) => x.def.key === k);
  77  |         out[k] = b ? { kind: b.def.kind, isMoon: b.isMoon, parent: b.parent?.def?.key } : null;
  78  |       }
  79  |       const moons = ['Bruxa', 'Tição', 'Fagulha', 'Carvão'].map((n) =>
  80  |         window.__spaceWar.bodies.some((x) => x.def.name === n));
  81  |       return { out, moons };
  82  |     });
  83  |     for (const k of Object.keys(found.out)) {
  84  |       expect(found.out[k], `estação ${k} existe`).not.toBe(null);
  85  |       expect(found.out[k].kind).toBe('station');
  86  |       expect(found.out[k].isMoon).toBe(true);      // rail em torno do planeta
  87  |     }
  88  |     expect(found.out.iss.parent).toBe('earth');
  89  |     expect(found.moons).toEqual([true, true, true, true]);
  90  |   });
  91  | 
  92  |   // AC-04: engatar a jornada promove a máquina a JOURNEY; chegada devolve CRUISE.
  93  |   test('AC-04: JOURNEY durante a queima; chegada em CRUISE', async ({ page }) => {
  94  |     test.setTimeout(60000);
  95  |     await startFlight(page);
  96  |     await page.evaluate(() => window.__swDebug.goTo('terra', 4));
  97  |     await page.evaluate(() => window.__swDebug.target('betelgeuse'));
  98  |     await page.keyboard.press('KeyZ');
  99  |     await page.waitForFunction(() => window.__spaceWar.journey?.active, { timeout: 20000 });
  100 |     await page.waitForFunction(() => window.__spaceWar.mode === 'journey', { timeout: 15000 });
  101 |     await page.evaluate(() => window.__swDebug.journeyWarp(0.995));
> 102 |     await page.waitForFunction(() => !window.__spaceWar.journey.active, { timeout: 15000 });
      |                ^ Error: page.waitForFunction: Test timeout of 60000ms exceeded.
  103 |     await page.waitForFunction(() => window.__spaceWar.mode === 'cruise', { timeout: 20000 });
  104 |   });
  105 | 
  106 |   // AC-05: regressão da aberração — o corredor de estrelas NÃO acende dentro
  107 |   // do sistema planetário (nada de cruzar estrelas antes de Júpiter).
  108 |   test('AC-05: corredor de estrelas apagado dentro do sistema planetário', async ({ page }) => {
  109 |     await startFlight(page);
  110 |     await page.waitForFunction(() => window.__spaceWar.mode === 'orbit', { timeout: 15000 });
  111 |     await page.waitForTimeout(400);   // alguns frames de starfield
  112 |     const fade = await page.evaluate(() => window.__spaceWar.starfieldFade);
  113 |     expect(fade).toBeLessThan(0.2);
  114 |   });
  115 | 
  116 |   // AC-06: FRAME LOCAL-NÍVEL — "o planeta é o chão" (aero-fighters): no modo
  117 |   // ORBIT o up da nave e da câmera alinham com o up local radial e o planeta
  118 |   // fica como arco na metade de baixo da tela.
  119 |   test('AC-06: planeta como referencial fixo embaixo (frame aero-fighters)', async ({ page }) => {
  120 |     await startFlight(page);
  121 |     await page.waitForFunction(() => window.__spaceWar.mode === 'orbit', { timeout: 15000 });
  122 |     // decola e deixa o nível automático assentar a atitude no frame local
  123 |     await page.keyboard.down('KeyW');
  124 |     await page.waitForFunction(() => window.__spaceWar.ship.landed === false, { timeout: 20000 });
  125 |     await page.keyboard.up('KeyW');
  126 |     await page.waitForTimeout(4000);
  127 |     const fr = await page.evaluate(() => window.__swDebug.frameReport());
  128 |     expect(fr).not.toBe(null);
  129 |     expect(fr.body).toBe('earth');
  130 |     expect(fr.shipUpDot).toBeGreaterThan(0.8);     // asas no horizonte local
  131 |     expect(fr.camUpDot).toBeGreaterThan(0.8);      // câmera no frame do planeta
  132 |     expect(fr.bodyNdcY).toBeLessThan(0.2);         // planeta na metade de baixo
  133 |   });
  134 | });
  135 | 
```