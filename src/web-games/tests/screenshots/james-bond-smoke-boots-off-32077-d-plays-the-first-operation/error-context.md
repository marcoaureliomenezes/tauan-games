# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: james-bond/smoke.spec.js >> boots offline, renders and plays the first operation
- Location: tests/james-bond/smoke.spec.js:15:1

# Error details

```
Error: page.click: Target page, context or browser has been closed
Call log:
  - waiting for locator('#start-button')
    - locator resolved to <button type="button" id="start-button">INICIAR OPERAÇÃO</button>
  - attempting click action
    - waiting for element to be visible, enabled and stable
    - element is visible, enabled and stable
    - scrolling into view if needed

```

```
Error: write EPIPE
```

# Test source

```ts
  1   | const path = require('path');
  2   | const { test, expect } = require('@playwright/test');
  3   | const { PNG } = require('playwright-core/lib/utilsBundle');
  4   | 
  5   | const evidence = path.resolve(__dirname, '../../../../../../.dadaia/tmp/root/20260718/james-bond-qa');
  6   | // CONFIG.floorHeight (3.55) + 1 de offset dos pés = altura do jogador em pé no
  7   | // mezanino. Chegar acima disso só é possível subindo a escada.
  8   | const CONFIG_FLOOR_TOP = 4.4;
  9   | // M1/M2/M3 — mesmo padrão de espelhar CONFIG aqui (ver CONFIG_FLOOR_TOP
  10  | // acima): config.js não é importável no browser a partir do teste Node.
  11  | const CONFIG_ROOF_HEIGHT = 6.55; // floorHeight (3.55) + upperWallHeight (3.0)
  12  | const CONFIG_TOWER_HEIGHT = 10.2;
  13  | const CONFIG_UNDERGROUND_DEPTH = 3.0;
  14  | 
  15  | test('boots offline, renders and plays the first operation', async ({ page }) => {
  16  |   // Boot de página + deploy() (pré-aquecimento de shader síncrono sem GPU —
  17  |   // ver main.js) sob carga extrema de máquina compartilhada.
  18  |   test.setTimeout(600000);
  19  |   const errors = [];
  20  |   const external = [];
  21  |   page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  22  |   page.on('pageerror', (error) => errors.push(error.message));
  23  |   page.on('request', (request) => {
  24  |     const url = new URL(request.url());
  25  |     if (!['127.0.0.1', 'localhost'].includes(url.hostname)) external.push(request.url());
  26  |   });
  27  | 
  28  |   await page.goto('/src/web-games/james-bond/');
  29  |   await page.waitForFunction(() => window.game?.telemetry?.physicsReady === true);
  30  |   await expect(page.locator('#menu')).toHaveClass(/screen-active/);
  31  |   await page.locator('.mission-tab').first().click({ force: true });
  32  |   expect(await page.evaluate(() => window.game.telemetry.worldBuilds)).toBe(1);
  33  | 
  34  |   const pixels = PNG.sync.read(await page.locator('#viewport canvas').screenshot({
  35  |     path: path.join(evidence, 'canvas-desktop.png'),
  36  |   }));
  37  |   let litPixels = 0;
  38  |   for (let index = 0; index < pixels.data.length; index += 4) {
  39  |     if (pixels.data[index] + pixels.data[index + 1] + pixels.data[index + 2] > 24) litPixels += 1;
  40  |   }
  41  |   expect(litPixels).toBeGreaterThan(pixels.width * pixels.height * 0.05);
  42  | 
> 43  |   await page.click('#start-button');
      |   ^ Error: write EPIPE
  44  |   await expect(page.locator('#briefing')).toHaveClass(/screen-active/);
  45  |   await page.click('#deploy-button');
  46  |   await page.waitForFunction(() => window.game.phase === 'playing');
  47  |   expect(await page.evaluate(() => window.game.telemetry.worldBuilds)).toBe(1);
  48  |   // O orçamento subiu de 80 para 220 quando o cenário passou a ser SÓLIDO:
  49  |   // barris, engradados, tambores e carcaças de carro agora têm colisor próprio
  50  |   // (antes eram enfeite atravessável). ~105 por mapa hoje; a folga cobre um
  51  |   // quarteirão mais entulhado sem deixar o número crescer sem controle.
  52  |   expect(await page.evaluate(() => window.game.telemetry.staticColliders)).toBeLessThan(220);
  53  |   await page.screenshot({ path: path.join(evidence, 'mission-desktop.png') });
  54  |   const start = await page.evaluate(() => ({ ...window.game.player.position }));
  55  |   await page.keyboard.down('KeyW');
  56  |   await page.waitForTimeout(450);
  57  |   await page.keyboard.up('KeyW');
  58  |   const moved = await page.evaluate(() => ({ ...window.game.player.position }));
  59  |   expect(Math.hypot(moved.x - start.x, moved.z - start.z)).toBeGreaterThan(0.2);
  60  | 
  61  |   const beforeAmmo = await page.evaluate(() => window.game.ammo.deagle.mag);
  62  |   await page.mouse.down();
  63  |   await page.waitForTimeout(80);
  64  |   await page.mouse.up();
  65  |   await page.waitForTimeout(120);
  66  |   expect(await page.evaluate(() => window.game.ammo.deagle.mag)).toBeLessThan(beforeAmmo);
  67  |   await page.mouse.wheel(0, 120);
  68  |   // Espera o RESULTADO (troca de arma), não um tempo fixo: a troca só é
  69  |   // processada no próximo fixed step, e headless sem GPU (ver main.js/
  70  |   // performance.js) pode renderizar a menos de 1 fps — 600 ms fixos podem não
  71  |   // cobrir sequer um quadro.
  72  |   await page.waitForFunction(() => window.game.currentWeapon === 'ak47', undefined, { timeout: 15000 });
  73  | 
  74  |   await page.keyboard.press('KeyM');
  75  |   await expect(page.locator('#tactical-map')).not.toHaveClass(/is-hidden/);
  76  |   await page.evaluate(() => { ['A', 'B', 'C'].forEach((key) => window.game.api.completeObjective(key)); window.game.api.completeMission(); });
  77  |   await expect(page.locator('#result')).toHaveClass(/screen-active/);
  78  |   await expect(page.locator('#tactical-map')).toHaveClass(/is-hidden/);
  79  |   expect(external).toEqual([]);
  80  |   expect(errors).toEqual([]);
  81  | });
  82  | 
  83  | test('animated enemy models load locally and drive the roster', async ({ page }) => {
  84  |   // Boot de página nova (~1,8 MB de GLB decodificados na CPU + criação de
  85  |   // contexto WebGL) mais 2 deploy()s (cada um paga o pré-aquecimento de
  86  |   // shader — ver main.js). Sob carga extrema de máquina compartilhada, o
  87  |   // orçamento padrão de 300 s cobre o boot sozinho com folga cada vez menor.
  88  |   test.setTimeout(600000);
  89  |   const errors = [];
  90  |   const external = [];
  91  |   page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  92  |   page.on('pageerror', (error) => errors.push(error.message));
  93  |   page.on('request', (request) => {
  94  |     const url = new URL(request.url());
  95  |     if (!['127.0.0.1', 'localhost'].includes(url.hostname)) external.push(request.url());
  96  |   });
  97  | 
  98  |   await page.goto('/src/web-games/james-bond/');
  99  |   await page.waitForFunction(() => window.game?.telemetry?.physicsReady === true);
  100 |   // Os seis GLBs vendorizados (2 dinossauros, fantasma, monstro, vampiro, demônio).
  101 |   expect(await page.evaluate(() => window.game.telemetry.enemyModels)).toBe(6);
  102 | 
  103 |   // OP-06 mistura velociraptores com um T-Rex; todos devem ser modelos animados.
  104 |   await page.evaluate(() => { window.game.api.unlockAll(); window.game.api.deploy(5); });
  105 |   await page.waitForFunction(() => window.game.phase === 'playing');
  106 |   const roster = await page.evaluate(() => {
  107 |     const types = {};
  108 |     for (const enemy of window.game.enemies) types[enemy.type] = (types[enemy.type] || 0) + 1;
  109 |     return {
  110 |       types,
  111 |       animated: window.game.telemetry.animatedEnemies,
  112 |       total: window.game.enemies.length,
  113 |       clips: window.game.enemies.find((enemy) => enemy.type === 'trex')?.rig?.clipNames || [],
  114 |     };
  115 |   });
  116 |   expect(roster.total).toBeGreaterThan(0);
  117 |   expect(roster.animated).toBe(roster.total);
  118 |   expect(roster.types.raptor).toBeGreaterThan(0);
  119 |   expect(roster.types.trex).toBe(1); // o chefe é único
  120 |   expect(roster.clips).toEqual(expect.arrayContaining(['run', 'attack', 'death']));
  121 | 
  122 |   // O fantasma da OP-03 flutua acima do chão.
  123 |   await page.evaluate(() => window.game.api.deploy(2));
  124 |   await page.waitForFunction(() => window.game.phase === 'playing');
  125 |   const phantom = await page.evaluate(() => {
  126 |     const ghost = window.game.enemies.find((enemy) => enemy.type === 'phantom');
  127 |     return ghost ? { y: ghost.root.position.y, animated: Boolean(ghost.rig) } : null;
  128 |   });
  129 |   expect(phantom).not.toBeNull();
  130 |   expect(phantom.animated).toBe(true);
  131 |   expect(phantom.y).toBeGreaterThan(0.5);
  132 | 
  133 |   expect(external).toEqual([]);
  134 |   expect(errors).toEqual([]);
  135 | });
  136 | 
  137 | test('kids mode locks the aim into a narrow forward cone', async ({ page }) => {
  138 |   // Boot de página + reload + deploy() sob carga extrema de máquina
  139 |   // compartilhada (mesmo motivo dos demais testes deste arquivo).
  140 |   test.setTimeout(600000);
  141 |   const errors = [];
  142 |   page.on('pageerror', (error) => errors.push(error.message));
  143 |   await page.goto('/src/web-games/james-bond/');
```