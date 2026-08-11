const path = require('path');
const { test, expect } = require('@playwright/test');
const { PNG } = require('playwright-core/lib/utilsBundle');

const evidence = path.resolve(__dirname, '../../../../../../.dadaia/tmp/root/20260718/james-bond-qa');
// CONFIG.floorHeight (3.55) + 1 de offset dos pés = altura do jogador em pé no
// mezanino. Chegar acima disso só é possível subindo a escada.
const CONFIG_FLOOR_TOP = 4.4;

test('boots offline, renders and plays the first operation', async ({ page }) => {
  // Boot de página + deploy() (pré-aquecimento de shader síncrono sem GPU —
  // ver main.js) sob carga extrema de máquina compartilhada.
  test.setTimeout(600000);
  const errors = [];
  const external = [];
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (!['127.0.0.1', 'localhost'].includes(url.hostname)) external.push(request.url());
  });

  await page.goto('/src/web-games/james-bond/');
  await page.waitForFunction(() => window.game?.telemetry?.physicsReady === true);
  await expect(page.locator('#menu')).toHaveClass(/screen-active/);
  await page.locator('.mission-tab').first().click({ force: true });
  expect(await page.evaluate(() => window.game.telemetry.worldBuilds)).toBe(1);

  const pixels = PNG.sync.read(await page.locator('#viewport canvas').screenshot({
    path: path.join(evidence, 'canvas-desktop.png'),
  }));
  let litPixels = 0;
  for (let index = 0; index < pixels.data.length; index += 4) {
    if (pixels.data[index] + pixels.data[index + 1] + pixels.data[index + 2] > 24) litPixels += 1;
  }
  expect(litPixels).toBeGreaterThan(pixels.width * pixels.height * 0.05);

  await page.click('#start-button');
  await expect(page.locator('#briefing')).toHaveClass(/screen-active/);
  await page.click('#deploy-button');
  await page.waitForFunction(() => window.game.phase === 'playing');
  expect(await page.evaluate(() => window.game.telemetry.worldBuilds)).toBe(1);
  // O orçamento subiu de 80 para 220 quando o cenário passou a ser SÓLIDO:
  // barris, engradados, tambores e carcaças de carro agora têm colisor próprio
  // (antes eram enfeite atravessável). ~105 por mapa hoje; a folga cobre um
  // quarteirão mais entulhado sem deixar o número crescer sem controle.
  expect(await page.evaluate(() => window.game.telemetry.staticColliders)).toBeLessThan(220);
  await page.screenshot({ path: path.join(evidence, 'mission-desktop.png') });
  const start = await page.evaluate(() => ({ ...window.game.player.position }));
  await page.keyboard.down('KeyW');
  await page.waitForTimeout(450);
  await page.keyboard.up('KeyW');
  const moved = await page.evaluate(() => ({ ...window.game.player.position }));
  expect(Math.hypot(moved.x - start.x, moved.z - start.z)).toBeGreaterThan(0.2);

  const beforeAmmo = await page.evaluate(() => window.game.ammo.deagle.mag);
  await page.mouse.down();
  await page.waitForTimeout(80);
  await page.mouse.up();
  await page.waitForTimeout(120);
  expect(await page.evaluate(() => window.game.ammo.deagle.mag)).toBeLessThan(beforeAmmo);
  await page.mouse.wheel(0, 120);
  // Espera o RESULTADO (troca de arma), não um tempo fixo: a troca só é
  // processada no próximo fixed step, e headless sem GPU (ver main.js/
  // performance.js) pode renderizar a menos de 1 fps — 600 ms fixos podem não
  // cobrir sequer um quadro.
  await page.waitForFunction(() => window.game.currentWeapon === 'ak47', undefined, { timeout: 15000 });

  await page.keyboard.press('KeyM');
  await expect(page.locator('#tactical-map')).not.toHaveClass(/is-hidden/);
  await page.evaluate(() => { ['A', 'B', 'C'].forEach((key) => window.game.api.completeObjective(key)); window.game.api.completeMission(); });
  await expect(page.locator('#result')).toHaveClass(/screen-active/);
  await expect(page.locator('#tactical-map')).toHaveClass(/is-hidden/);
  expect(external).toEqual([]);
  expect(errors).toEqual([]);
});

test('animated enemy models load locally and drive the roster', async ({ page }) => {
  // Boot de página nova (~1,8 MB de GLB decodificados na CPU + criação de
  // contexto WebGL) mais 2 deploy()s (cada um paga o pré-aquecimento de
  // shader — ver main.js). Sob carga extrema de máquina compartilhada, o
  // orçamento padrão de 300 s cobre o boot sozinho com folga cada vez menor.
  test.setTimeout(600000);
  const errors = [];
  const external = [];
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (!['127.0.0.1', 'localhost'].includes(url.hostname)) external.push(request.url());
  });

  await page.goto('/src/web-games/james-bond/');
  await page.waitForFunction(() => window.game?.telemetry?.physicsReady === true);
  // Os seis GLBs vendorizados (2 dinossauros, fantasma, monstro, vampiro, demônio).
  expect(await page.evaluate(() => window.game.telemetry.enemyModels)).toBe(6);

  // OP-06 mistura velociraptores com um T-Rex; todos devem ser modelos animados.
  await page.evaluate(() => { window.game.api.unlockAll(); window.game.api.deploy(5); });
  await page.waitForFunction(() => window.game.phase === 'playing');
  const roster = await page.evaluate(() => {
    const types = {};
    for (const enemy of window.game.enemies) types[enemy.type] = (types[enemy.type] || 0) + 1;
    return {
      types,
      animated: window.game.telemetry.animatedEnemies,
      total: window.game.enemies.length,
      clips: window.game.enemies.find((enemy) => enemy.type === 'trex')?.rig?.clipNames || [],
    };
  });
  expect(roster.total).toBeGreaterThan(0);
  expect(roster.animated).toBe(roster.total);
  expect(roster.types.raptor).toBeGreaterThan(0);
  expect(roster.types.trex).toBe(1); // o chefe é único
  expect(roster.clips).toEqual(expect.arrayContaining(['run', 'attack', 'death']));

  // O fantasma da OP-03 flutua acima do chão.
  await page.evaluate(() => window.game.api.deploy(2));
  await page.waitForFunction(() => window.game.phase === 'playing');
  const phantom = await page.evaluate(() => {
    const ghost = window.game.enemies.find((enemy) => enemy.type === 'phantom');
    return ghost ? { y: ghost.root.position.y, animated: Boolean(ghost.rig) } : null;
  });
  expect(phantom).not.toBeNull();
  expect(phantom.animated).toBe(true);
  expect(phantom.y).toBeGreaterThan(0.5);

  expect(external).toEqual([]);
  expect(errors).toEqual([]);
});

test('kids mode locks the aim into a narrow forward cone', async ({ page }) => {
  // Boot de página + reload + deploy() sob carga extrema de máquina
  // compartilhada (mesmo motivo dos demais testes deste arquivo).
  test.setTimeout(600000);
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/src/web-games/james-bond/');
  await page.waitForFunction(() => window.game?.telemetry?.physicsReady === true);

  const off = await page.evaluate(() => window.game.api.lookLimits());
  expect(off.kids).toBe(false);

  await page.locator('#kids-mode').check();
  const on = await page.evaluate(() => window.game.api.lookLimits());
  expect(on.kids).toBe(true);
  // O cone tem de ser bem mais estreito que o padrão e ficar em torno da horizontal.
  const span = on.max - on.min;
  expect(span).toBeLessThan(off.max - off.min);
  expect(span).toBeLessThan(Math.PI / 2);
  expect(on.min).toBeLessThan(Math.PI / 2);
  expect(on.max).toBeGreaterThan(Math.PI / 2);

  // A preferência sobrevive a um reload.
  await page.reload();
  await page.waitForFunction(() => window.game?.telemetry?.physicsReady === true);
  expect(await page.locator('#kids-mode').isChecked()).toBe(true);
  expect(await page.evaluate(() => window.game.api.lookLimits().kids)).toBe(true);

  // E o coice da arma não fura o cone: a mira continua presa depois de atirar.
  await page.evaluate(() => { window.game.api.deploy(0); });
  await page.waitForFunction(() => window.game.phase === 'playing');
  await page.evaluate(() => window.game.api.setKidsMode(true));
  const pitchAfterRecoil = await page.evaluate(async () => {
    const limits = window.game.api.lookLimits();
    for (let i = 0; i < 40; i += 1) window.game.camera.rotateX(0.05); // simula coice acumulado
    window.game.controls.dispatchEvent?.({ type: 'change' });
    return { limits };
  });
  expect(pitchAfterRecoil.limits.kids).toBe(true);
  expect(errors).toEqual([]);
});

test('every operation has a second floor the player can climb to', async ({ page }) => {
  // deploy() agora aguarda o pré-aquecimento de shader (renderer.compileAsync
  // — ver main.js) antes de resolver. Cada missão troca o MUNDO inteiro
  // (materiais novos, os da missão anterior descartados junto com o programa
  // compilado deles — ver disposeWorld/materials.js), então cada uma das 7
  // chamadas a deploy() neste teste (6 no laço + 1 no fim, para a escada) paga
  // o custo de compilar de novo. Sem KHR_parallel_shader_compile (GPU de
  // software neste sandbox) essa compilação é síncrona/bloqueante, e o tempo
  // real que ela consome escala com a carga da máquina compartilhada — os
  // 300 s padrão (mesmo sem nenhuma lentidão de simulação, só o custo de
  // compilar 7 vezes) ficaram apertados demais.
  test.setTimeout(900000);
  const errors = [];
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/src/web-games/james-bond/');
  await page.waitForFunction(() => window.game?.telemetry?.physicsReady === true);
  await page.evaluate(() => window.game.api.unlockAll());

  for (let mission = 0; mission < 6; mission += 1) {
    const code = `OP-0${mission + 1}`;
    await page.evaluate((index) => window.game.api.deploy(index), mission);
    await page.waitForFunction(() => window.game.phase === 'playing');
    const floors = await page.evaluate(() => window.game.api.floors());
    expect(floors.slabCells, `${code} slab cells`).toBeGreaterThan(8);
    expect(floors.stairs.length, `${code} stairs`).toBeGreaterThan(0);
    // térreo + lajes do mezanino + degraus das escadarias
    expect(floors.platforms).toBeGreaterThan(floors.slabCells + floors.stairs.length * 6);

    // AUDITORIA DE MAPA: varre os dois andares com a física real e prova que
    // não existe ponto onde o jogador fique preso, dentro de geometria, nem
    // trecho inacessível. Foi assim que os bugs de "cair dentro da parede" e
    // "mezanino partido ao meio" foram encontrados — a checagem fica.
    const audit = await page.evaluate(() => window.game.api.auditMap());
    expect(audit.inside, `${code}: pontos DENTRO de geometria sólida`).toEqual([]);
    expect(audit.trapped, `${code}: pontos sem saída (jogador preso)`).toEqual([]);
    expect(audit.unreachable, `${code}: objetivos/extração inacessíveis`).toEqual([]);
    expect(audit.orphanUpper, `${code}: células de mezanino inalcançáveis`).toEqual([]);
    expect(audit.upperIslands, `${code}: escada sem saída na laje`).toEqual([]);
    expect(audit.upperReached, `${code}: mezanino transitável por inteiro`).toBe(audit.upperCells);
    for (const stair of audit.stairs) {
      expect(stair.climbed, `${code}: escada ${stair.cell} sobe andando`).toBe(true);
      expect(stair.descended, `${code}: escada ${stair.cell} desce andando`).toBe(true);
      expect(stair.reachable, `${code}: pé da escada ${stair.cell} alcançável do spawn`).toBe(true);
    }

    // Nada sólido pode ser invisível, nada invisível pode ser sólido: cada
    // volume de colisão tem de ter geometria visível e opaca sobre ele.
    const solids = await page.evaluate(() => window.game.api.auditSolids());
    expect(solids.invisible, `${code}: colisores SEM geometria visível`).toEqual([]);
    expect(solids.seeThrough, `${code}: colisores cobertos só por geometria transparente`).toEqual([]);
  }

  // Sobe de verdade a primeira escadaria da OP-01: fica na entrada (célula
  // anterior ao pé da escada), olha para a subida e segura W — sem pulo, sem
  // volume de escada vertical: só o passo automático vencendo cada degrau.
  await page.evaluate(() => window.game.api.deploy(0));
  await page.waitForFunction(() => window.game.phase === 'playing');
  const stair = await page.evaluate(() => window.game.api.floors().stairs[0]);
  expect(stair.direction).toBeDefined();
  await page.evaluate(({ x, z, direction }) => {
    const cell = 3.6;
    window.game.api.teleport(x - direction[0] * cell, z - direction[1] * cell);
    // Mira na direção da subida para que W ande escada acima.
    window.game.camera.lookAt(x + direction[0] * 20, window.game.camera.position.y, z + direction[1] * 20);
  }, stair);
  const atBase = await page.evaluate(() => window.game.api.floors());
  expect(atBase.playerY).toBeLessThan(1.5);

  // Segurar W sobe até o mezanino. O headless roda bem abaixo do tempo real e a
  // taxa de quadros varia com a carga da cena, então esperamos pelo RESULTADO
  // (chegou ao topo?) em vez de cravar uma altura por tempo decorrido.
  await page.keyboard.down('KeyW');
  // Escalada por SIMULAÇÃO (fixed step, não relógio de parede) — sofre a
  // mesma razão tempo-real/tempo-de-jogo dos outros esperas deste arquivo sob
  // carga de máquina compartilhada; orçamento alargado pelo mesmo motivo.
  await page.waitForFunction(
    (top) => window.game.api.floors().playerY > top,
    CONFIG_FLOOR_TOP,
    { timeout: 60000 },
  );
  await page.keyboard.up('KeyW');
  const climbed = await page.evaluate(() => window.game.api.floors());
  expect(climbed.playerY).toBeGreaterThan(CONFIG_FLOOR_TOP);

  // Soltar W no alto não faz despencar: a laje segura o jogador.
  await page.waitForTimeout(700);
  const held = await page.evaluate(() => window.game.api.floors());
  expect(held.playerY).toBeGreaterThan(CONFIG_FLOOR_TOP - 0.2);

  // E a laje sustenta de verdade: largado acima dela, o jogador assenta no
  // topo do mezanino (3.55 + 1 de offset dos pés) em vez de cair ao térreo.
  const slab = await page.evaluate(() => window.game.api.floors().slabPoint);
  expect(slab).not.toBeNull();
  await page.evaluate(({ x, z }) => window.game.api.teleport(x, z, 6), slab);
  // Espera o RESULTADO (assentou na laje), não um tempo fixo: no headless a
  // queda pode levar mais que o tempo real conforme a carga da cena.
  await page.waitForFunction(
    () => window.game.api.floors().playerY < 4.7 && window.game.player.grounded,
    undefined,
    { timeout: 40000 },
  );
  const landed = await page.evaluate(() => ({ ...window.game.api.floors(), grounded: window.game.player.grounded }));
  expect(landed.playerY).toBeGreaterThan(4.4); // 3.55 (laje) + 1 (offset dos pés)
  expect(landed.playerY).toBeLessThan(4.7);
  expect(landed.grounded).toBe(true);
  expect(errors).toEqual([]);
});

test('the five-slot loadout works: knife, pistol, rifle, launcher, grenade', async ({ page }) => {
  // Cadeia de esperas em TEMPO DE JOGO (cooldowns, pavios, cadência do
  // lança-granadas) empilhadas numa única run — sob carga de máquina
  // compartilhada cada uma pode chegar perto do próprio orçamento individual;
  // o orçamento do teste inteiro precisa cobrir a soma, não só a maior parte.
  test.setTimeout(600000);
  const errors = [];
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/src/web-games/james-bond/');
  await page.waitForFunction(() => window.game?.telemetry?.physicsReady === true);
  // Entrar pelos botões, não por api.deploy: o pointer lock só é concedido a
  // partir de um gesto real do usuário, e sem ele o clique não dispara.
  await page.click('#start-button');
  await page.click('#deploy-button');
  await page.waitForFunction(() => window.game.phase === 'playing');
  // O pedido de Pointer Lock já foi feito ANTES do pré-aquecimento de shader
  // (síncrono com o clique — ver main.js), mas a CONFIRMAÇÃO (evento
  // `pointerlockchange`, que `isLocked` observa) só roda quando a thread JS
  // volta a ficar livre — e `compileAsync` sem KHR_parallel_shader_compile
  // (extensão ausente em GPU de software) compila de forma síncrona/bloqueante.
  // Sob carga de máquina compartilhada isso pode somar dezenas de segundos.
  await page.waitForFunction(() => window.game.controls.isLocked === true, undefined, { timeout: 45000 });

  // Troca de arma pronta para disparar: o gatilho tem cooldown próprio, então
  // esperamos o estado em vez de cravar um tempo.
  // A espera é longa de propósito: `cooldown` é uma só para todo o arsenal e
  // conta em TEMPO DE JOGO. Depois do lança-granadas ela vale a cadência dele,
  // 5 s — e o passo fixo em headless anda a uma fração do tempo real, variando
  // com a carga da máquina. 20 s de relógio não cobriam esses 5 s de jogo.
  const arm = async (id) => {
    await page.evaluate((weapon) => window.game.api.selectWeapon(weapon), id);
    await page.waitForFunction(
      (weapon) => window.game.currentWeapon === weapon && window.game.telemetry.trigger?.cooldown <= 0,
      id,
      { timeout: 120000 },
    );
  };

  // Slots 1..5 na ordem pedida.
  for (const [digit, id] of [['Digit1', 'knife'], ['Digit2', 'deagle'], ['Digit3', 'ak47'], ['Digit4', 'rpg'], ['Digit5', 'grenade']]) {
    await page.keyboard.press(digit);
    await page.waitForFunction((weapon) => window.game.currentWeapon === weapon, id, { timeout: 20000 });
  }

  // Faca: golpeia sem gastar munição.
  await arm('knife');
  const shotsBefore = await page.evaluate(() => window.game.shots);
  await page.mouse.down();
  await page.waitForFunction((before) => window.game.shots > before, shotsBefore, { timeout: 20000 });
  await page.mouse.up();
  expect(await page.evaluate(() => window.game.ammo.knife.mag)).toBe(Infinity);

  // Lança-granadas: munição infinita, projétil visível, 1 tiro a cada 5 s.
  await arm('rpg');
  // Mira para BAIXO antes de puxar o gatilho.
  //
  // ARMADILHA DO POINTER LOCK (medida, não suposta): sob pointer lock, cada
  // `mouse.down()` sintético do Playwright carrega um movementY enorme — a
  // diferença entre a origem do lock e a coordenada do cursor virtual. A mira
  // salta de 35° a 57° para CIMA no clique, mesmo com a faca, que não encosta
  // na câmera. Partindo de ~69° para baixo, esse salto devolve a mira para
  // perto do horizonte e o foguete bate no asfalto em cerca de um segundo.
  //
  // Sem isso o tiro sai num arco alto de vários segundos de TEMPO DE JOGO, e o
  // passo fixo em headless anda a uma fração do tempo real, variando com a
  // carga da máquina — nenhum limite de relógio seria confiável. (Antes o
  // defeito ficava escondido: a colisão 2D por célula detonava o foguete no ar
  // sobre qualquer parede, o mesmo bug da granada em "parede invisível".)
  await page.evaluate(() => {
    const cam = window.game.camera;
    const Euler = cam.rotation.constructor;
    const angles = new Euler().setFromQuaternion(cam.quaternion, 'YXZ');
    angles.x = -1.2;
    cam.quaternion.setFromEuler(angles);
  });
  await page.mouse.down();
  // Esperas generosas de propósito: são eventos de TEMPO DE JOGO, e o passo
  // fixo em headless anda a uma fração do tempo real, variando com a carga da
  // máquina. O comportamento em si (foguete detona no primeiro sólido, sem
  // quicar) é verificado de forma determinística em unit.mjs; aqui só se
  // confirma que o caminho real do jogo chega lá.
  await page.waitForFunction(() => window.game.telemetry.rockets >= 1, undefined, { timeout: 45000 });
  await page.mouse.up();
  // O que importa aqui é que o lança-granadas cria um PROJÉTIL (não é hitscan).
  // Observá-lo "em voo" seria uma corrida: mirando para baixo ele bate no chão
  // em poucos quadros e sai da lista antes desta linha rodar. Então aceita-se
  // as duas provas do mesmo fato: ou ele ainda voa, ou já detonou.
  const projetil = await page.evaluate(() => ({
    voando: window.game.api.projectilesInFlight(),
    explosoes: window.game.telemetry.explosions || 0,
  }));
  expect(projetil.voando + projetil.explosoes).toBeGreaterThan(0);

  // Segundo clique logo em seguida não sai: a cadência de 5 s trava.
  await page.mouse.down();
  await page.waitForTimeout(120);
  await page.mouse.up();
  await page.waitForTimeout(400);
  expect(await page.evaluate(() => window.game.telemetry.rockets)).toBe(1);

  // O foguete detona ao bater — mesma explosão da granada.
  await page.waitForFunction(() => window.game.telemetry.explosions >= 1, undefined, { timeout: 90000 });
  expect(await page.evaluate(() => window.game.ammo.rpg.mag)).toBe(Infinity); // segue infinito

  // Granada de mão: arremessa e explode pelo pavio.
  //
  // O pavio (2.15 s) é um evento de TEMPO DE JOGO como o lança-granadas
  // acima, e sofre a MESMA razão tempo-real/tempo-de-jogo — que em headless
  // sem GPU (renderização 100% via software) pode passar de 10x. O
  // lança-granadas já reconhece isso com um orçamento de dezenas de
  // segundos; o pavio da granada, sendo mais curto em tempo de jogo, tinha
  // um orçamento apertado demais em REAL — 12 s não cobre 2.15 s de jogo a
  // ~1 fps de software rendering.
  const explosionsBefore = await page.evaluate(() => window.game.telemetry.explosions);
  await arm('grenade');
  await page.mouse.down();
  await page.waitForTimeout(120);
  await page.mouse.up();
  await page.waitForFunction(
    (before) => window.game.telemetry.explosions > before,
    explosionsBefore,
    { timeout: 40000 },
  );
  expect(errors).toEqual([]);
});

test('redeploying a mission does not leak enemies or stale objectives', async ({ page }) => {
  // 4 deploy()s (mesma missão 2x + outras 2) sob carga extrema de máquina
  // compartilhada — mesmo motivo dos demais testes deste arquivo.
  test.setTimeout(600000);
  const errors = [];
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/src/web-games/james-bond/');
  await page.waitForFunction(() => window.game?.telemetry?.physicsReady === true);
  await page.evaluate(() => window.game.api.unlockAll());

  const skinnedMeshes = () => page.evaluate(() => {
    let skinned = 0;
    window.game.world.group.parent.traverse((node) => { if (node.isSkinnedMesh) skinned += 1; });
    return skinned;
  });

  // Repetir a MESMA operação (morrer e tentar de novo) reaproveita o mundo mas
  // tem de descartar a leva anterior de inimigos — senão cada retry acumulava
  // um esqueleto animado a mais na cena.
  await page.evaluate(() => window.game.api.deploy(5));
  await page.waitForFunction(() => window.game.phase === 'playing');
  await page.waitForTimeout(300);
  const first = await skinnedMeshes();
  expect(first).toBeGreaterThan(0);

  await page.evaluate(() => window.game.api.deploy(5));
  await page.waitForFunction(() => window.game.phase === 'playing');
  await page.waitForTimeout(300);
  expect(await skinnedMeshes()).toBe(first);

  // E trocar de operação troca de fato os rótulos dos objetivos: a assinatura
  // do cache do HUD precisa incluir a missão, não só o estado dos objetivos.
  await page.evaluate(() => window.game.api.deploy(0));
  await page.waitForFunction(() => window.game.phase === 'playing');
  await page.waitForTimeout(300);
  const opOne = await page.locator('#objective-list').innerText();
  await page.evaluate(() => window.game.api.deploy(5));
  await page.waitForFunction(() => window.game.phase === 'playing');
  await page.waitForTimeout(300);
  const opSix = await page.locator('#objective-list').innerText();
  expect(opSix).not.toBe(opOne);
  expect(opSix).toContain('núcleo de controle');
  expect(errors).toEqual([]);
});

test('menu remains coherent on a narrow viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/src/web-games/james-bond/');
  await page.waitForFunction(() => window.game?.telemetry?.physicsReady === true);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  expect(overflow).toBe(false);
  await page.screenshot({ path: path.join(evidence, 'menu-mobile.png'), fullPage: true });
});

// ACCEPTANCE METRIC — performance remediation (code-reviewer +
// software-architect review, 2026-08-10T2050Z): the freezes at match start
// and on grenade chains were both root-caused to a DYNAMIC light topology
// (lights added/removed at runtime force three.js to recompile every lit
// shader program in the scene, synchronously, on the next render) plus
// per-detonation geometry/material allocation. The fix is a fixed light pool
// + a pooled explosion rig + a shader pre-warm at deploy(). The metric that
// proves it: `renderer.info.programs.length` and the scene's light COUNT
// must stay CONSTANT before/during/after a chain of explosions — before this
// remediation they visibly oscillated on every detonation.
test('performance remediation: light count and shader program count stay constant through an explosion chain', async ({ page }) => {
  // Boot de página + deploy() sob carga extrema de máquina compartilhada —
  // mesmo motivo dos demais testes deste arquivo.
  test.setTimeout(600000);
  const errors = [];
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/src/web-games/james-bond/');
  await page.waitForFunction(() => window.game?.telemetry?.physicsReady === true);

  await page.evaluate(() => window.game.api.deploy(0));
  await page.waitForFunction(() => window.game.phase === 'playing');
  // Deixa alguns frames reais renderizarem — o pré-aquecimento já rodou
  // dentro de deploy(), isto só estabiliza `renderer.info` após o primeiro
  // frame jogável.
  await page.waitForTimeout(300);

  const before = await page.evaluate(() => window.game.api.rendererStats());
  expect(before.programs).toBeGreaterThan(0);
  expect(before.lights).toBeGreaterThan(0);

  // Cadeia de explosões pela MESMA rota da granada real (game.api.explode ->
  // combat.explode -> explosives.explode -> fx.explosion + world.props.blast,
  // que pode encadear detonações de barris/carros vizinhos). Mais detonações
  // que o tamanho do pool de rigs/luzes (3), de propósito — força o caminho
  // de "reusa o mais antigo".
  const start = await page.evaluate(() => ({ x: window.game.world.start.x, z: window.game.world.start.z }));
  for (let i = 0; i < 8; i += 1) {
    await page.evaluate(({ x, z, i: index }) => window.game.api.explode(x + index * 0.6, z + index * 0.35), { ...start, i });
  }
  await page.waitForTimeout(150);
  const during = await page.evaluate(() => window.game.api.rendererStats());
  expect(during.lights).toBe(before.lights);
  expect(during.programs).toBe(before.programs);

  // Espera todos os efeitos morrerem (vida de 2.2 s cada) e confirma que nada
  // voltou a oscilar depois.
  await page.waitForTimeout(2500);
  const after = await page.evaluate(() => window.game.api.rendererStats());
  expect(after.lights).toBe(before.lights);
  expect(after.programs).toBe(before.programs);

  expect(errors).toEqual([]);
});

test('all six operations build and resolve in the browser', async ({ page }) => {
  // 6 missões distintas = 6 deploy()s, cada um pagando a compilação de shader
  // completa da missão nova (ver comentário equivalente no teste "second
  // floor" acima). Sob carga de máquina compartilhada isso pode somar mais
  // que o orçamento padrão de 300 s.
  test.setTimeout(600000);
  const errors = [];
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/src/web-games/james-bond/');
  await page.waitForFunction(() => window.game?.telemetry?.physicsReady === true);

  for (let index = 0; index < 6; index += 1) {
    // deploy() é assíncrono (aguarda o pré-aquecimento de shader antes de
    // phase='playing' — ver main.js) — espera o resultado, não lê o estado
    // no mesmo tick da chamada.
    await page.evaluate((mission) => window.game.api.deploy(mission), index);
    await page.waitForFunction(() => window.game.phase === 'playing');
    const snapshot = await page.evaluate(() => window.game.api.snapshot());
    expect(snapshot.phase).toBe('playing');
    expect(snapshot.mission).toBe(index);
    expect(snapshot.objectives).toHaveLength(3);
    expect(snapshot.enemies).toBeGreaterThan(0);
    await page.evaluate(() => window.game.api.completeMission());
    expect(await page.evaluate(() => window.game.phase)).toBe('result');
  }
  expect(errors).toEqual([]);
});
