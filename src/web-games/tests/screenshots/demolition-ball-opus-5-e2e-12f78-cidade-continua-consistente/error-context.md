# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: demolition-ball-opus-5/e2e.spec.js >> o trator dirige e a cidade continua consistente
- Location: tests/demolition-ball-opus-5/e2e.spec.js:38:1

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: page.waitForFunction: Test timeout of 30000ms exceeded.
```

# Test source

```ts
  1   | const { test, expect } = require('@playwright/test');
  2   | 
  3   | const URL = '/src/web-games/demolition-ball-opus-5/index.html?quality=low';
  4   | 
  5   | async function boot(page) {
  6   |   const errors = [];
  7   |   page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  8   |   page.on('pageerror', (e) => errors.push(String(e)));
  9   |   await page.goto(URL);
> 10  |   await page.waitForFunction(() => window.__demolition && window.__demolition.frames > 3, null, { timeout: 60000 });
      |              ^ Error: page.waitForFunction: Test timeout of 30000ms exceeded.
  11  |   return errors;
  12  | }
  13  | 
  14  | test('carrega, renderiza em WebGL2 e roda sem erros de console', async ({ page }) => {
  15  |   const errors = await boot(page);
  16  |   const info = await page.evaluate(() => {
  17  |     const d = window.__demolition;
  18  |     return {
  19  |       frames: d.frames,
  20  |       structures: d.city.structures.length,
  21  |       cars: d.traffic.cars.length,
  22  |       mission: d.missions.current.spec.title,
  23  |       targets: d.missions.current.targets.length,
  24  |       gl: !!document.getElementById('scene').getContext('webgl2'),
  25  |       stats: d.renderer.stats(),
  26  |     };
  27  |   });
  28  |   expect(info.gl).toBe(true);
  29  |   expect(info.structures).toBeGreaterThan(40);
  30  |   expect(info.cars).toBe(34);
  31  |   expect(info.targets).toBeGreaterThan(0);
  32  |   expect(info.mission).toContain('Contrato 1');
  33  |   expect(info.stats.boxes).toBeGreaterThan(200);
  34  |   expect(info.stats.drawCalls).toBeGreaterThan(3);
  35  |   expect(errors).toEqual([]);
  36  | });
  37  | 
  38  | test('o trator dirige e a cidade continua consistente', async ({ page }) => {
  39  |   await boot(page);
  40  |   const start = await page.evaluate(() => ({ x: window.__demolition.rig.pos.x, z: window.__demolition.rig.pos.z }));
  41  |   await page.evaluate(() => window.__demolition.begin());
  42  |   await page.keyboard.down('w');
  43  |   await page.waitForTimeout(1600);
  44  |   await page.keyboard.up('w');
  45  |   const end = await page.evaluate(() => ({
  46  |     x: window.__demolition.rig.pos.x,
  47  |     z: window.__demolition.rig.pos.z,
  48  |     speed: window.__demolition.rig.speed,
  49  |   }));
  50  |   const moved = Math.hypot(end.x - start.x, end.z - start.z);
  51  |   expect(moved).toBeGreaterThan(3);
  52  |   expect(Number.isFinite(end.speed)).toBe(true);
  53  | });
  54  | 
  55  | test('a bola pendula: fica presa ao cabo e nunca escapa do comprimento', async ({ page }) => {
  56  |   await boot(page);
  57  |   const samples = await page.evaluate(async () => {
  58  |     const d = window.__demolition;
  59  |     d.begin();
  60  |     d.press('Space');
  61  |     const out = [];
  62  |     for (let i = 0; i < 90; i++) {
  63  |       await new Promise((r) => requestAnimationFrame(r));
  64  |       const t = d.rig.tip, b = d.rig.ball.pos;
  65  |       out.push({
  66  |         dist: Math.hypot(b.x - t.x, b.y - t.y, b.z - t.z),
  67  |         rope: d.rig.ropeLen,
  68  |         speed: Math.hypot(d.rig.ball.vel.x, d.rig.ball.vel.y, d.rig.ball.vel.z),
  69  |       });
  70  |     }
  71  |     d.release('Space');
  72  |     return out;
  73  |   });
  74  |   for (const s of samples) {
  75  |     expect(Number.isFinite(s.dist)).toBe(true);
  76  |     // Inextensible rope: never longer than the drum length (tiny solver slack allowed).
  77  |     expect(s.dist).toBeLessThan(s.rope + 0.15);
  78  |   }
  79  |   // The pump must actually build swing energy.
  80  |   expect(Math.max(...samples.map((s) => s.speed))).toBeGreaterThan(2);
  81  | });
  82  | 
  83  | test('impacto da bola demole a estrutura alvo e gera escombros', async ({ page }) => {
  84  |   await boot(page);
  85  |   const result = await page.evaluate(async () => {
  86  |     const d = window.__demolition;
  87  |     d.begin();
  88  |     const target = d.missions.current.targets[0];
  89  |     const before = target.progress;
  90  |     for (let hit = 0; hit < 26; hit++) {
  91  |       d.teleportBallTo(target, 5);
  92  |       for (let i = 0; i < 22; i++) await new Promise((r) => requestAnimationFrame(r));
  93  |     }
  94  |     return {
  95  |       before,
  96  |       after: target.progress,
  97  |       chunks: d.debris.chunks.length,
  98  |       dust: d.debris.dust.length,
  99  |       name: target.name,
  100 |     };
  101 |   });
  102 |   expect(result.before).toBe(0);
  103 |   expect(result.after).toBeGreaterThan(0.05);
  104 |   expect(result.chunks).toBeGreaterThan(0);
  105 |   expect(result.dust).toBeGreaterThan(0);
  106 | });
  107 | 
  108 | test('mapa expande e recolhe com M', async ({ page }) => {
  109 |   await boot(page);
  110 |   await page.evaluate(() => window.__demolition.begin());
```