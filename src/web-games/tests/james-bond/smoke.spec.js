const { test, expect } = require('@playwright/test');
const { PNG } = require('playwright-core/lib/utilsBundle');

// waitForTimeout restantes (T-07) — legítimos por semântica, NÃO sleeps
// preguiçosos: pulsos de gatilho (80-120 ms) são a duração do clique atuado;
// 700 ms no mezanino é janela de ESTABILIDADE (prova que a laje NÃO deixa
// cair — polling não prova condição negativa); 400 ms é a cadência de 5 s do
// foguete (janela do comportamento testado); 2500 ms espera efeitos de 2.2 s
// morrerem (sem contador de efeitos ativos exposto); 300 ms pós-deploy são
// settle de frame de render (sem contador monotônico exposto — frames zera a
// cada segundo na telemetria de fps); 150 ms entre fatias de fastForward é
// pacing de loop. Convertidos a polling: movimento do jogador, registro do
// tiro, rigs na cena, contador de explosões, mortes no spawner.

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

  // S-23: a captura vira Buffer em memória só para a asserção de pixels
  // acesos — sem `path`, nada de PNG de caminho feliz sem consumidor vai
  // para disco (screenshots de FALHA continuam governadas pelo config).
  const pixels = PNG.sync.read(await page.locator('#viewport canvas').screenshot());
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
  const start = await page.evaluate(() => ({ ...window.game.player.position }));
  await page.keyboard.down('KeyW');
  // polling no estado real (T-07): espera o jogador SE MOVER — não um sleep
  // fixo (era waitForTimeout(450))
  await page.waitForFunction((s) => {
    const p = window.game.player.position;
    return Math.hypot(p.x - s.x, p.z - s.z) > 0.2;
  }, start, { timeout: 5000 });
  await page.keyboard.up('KeyW');
  const moved = await page.evaluate(() => ({ ...window.game.player.position }));
  expect(Math.hypot(moved.x - start.x, moved.z - start.z)).toBeGreaterThan(0.2);

  const beforeAmmo = await page.evaluate(() => window.game.ammo.deagle.mag);
  await page.mouse.down();
  await page.waitForTimeout(80);
  await page.mouse.up();
  // polling: espera o tiro REGISTRAR (munição cai) — era waitForTimeout(120)
  await page.waitForFunction((before) => window.game.ammo.deagle.mag < before, beforeAmmo, { timeout: 3000 });
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
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/src/web-games/james-bond/');
  await page.waitForFunction(() => window.game?.telemetry?.physicsReady === true);

  const off = await page.evaluate(() => window.game.api.lookLimits());
  expect(off.kids).toBe(false);

  await page.locator('#kids-mode').check();
  const on = await page.evaluate(() => window.game.api.lookLimits());
  expect(on.kids).toBe(true);
  // O cone em si (cone(kids) < cone(normal) < pi/2, centrado no horizonte) é
  // verificado sem browser em unit.mjs, sobre as constantes puras KIDS/LOOK
  // de config.js. O que só o browser prova é o que fica aqui: o checkbox
  // real ligando a flag no jogo e a persistência sobrevivendo a um reload
  // (localStorage).
  await page.reload();
  await page.waitForFunction(() => window.game?.telemetry?.physicsReady === true);
  expect(await page.locator('#kids-mode').isChecked()).toBe(true);
  expect(await page.evaluate(() => window.game.api.lookLimits().kids)).toBe(true);
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
  // polling no estado real (T-07): espera a guarnição EXISTIR (enemies vivos —
  // o rig SkinnedMesh é validado na asserção seguinte). Era waitForTimeout(300).
  await page.waitForFunction(() =>
    Boolean(window.game.enemies && window.game.enemies.some((e) => e.alive)),
  undefined, { timeout: 15000 });
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
  const explBefore = await page.evaluate(() => window.game.telemetry.explosions);
  for (let i = 0; i < 8; i += 1) {
    await page.evaluate(({ x, z, i: index }) => window.game.api.explode(x + index * 0.6, z + index * 0.35), { ...start, i });
  }
  // Registro da cadeia: explode() é SÍNCRONO (game.api.explode -> combat.
  // explode -> explosives.explode incrementa o contador antes de qualquer
  // efeito) — quando o evaluate retorna, o contador JÁ subiu. Asserção direta,
  // sem waitForFunction: polling de um efeito síncrono não testa nada e ainda
  // depende de timing do harness (bug latente da conversão T-07, que trocou
  // um waitForTimeout(150) por polling onde bastava ler o contador).
  const explDuring = await page.evaluate(() => window.game.telemetry.explosions);
  expect(explDuring, 'a cadeia de explosões tem de ter registrado no contador').toBeGreaterThan(explBefore);
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

// F1 — SENSIBILIDADE DO MOUSE: um slider real na tela do menu, aplicado ao
// pointerSpeed do PointerLockControls e persistido em localStorage.
test('mouse sensitivity setting persists and scales the look rate', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/src/web-games/james-bond/');
  await page.waitForFunction(() => window.game?.telemetry?.physicsReady === true);

  // Padrão = sensação atual do jogo, sem surpresa em quem nunca tocou o slider.
  expect(await page.evaluate(() => window.game.sensitivity)).toBeCloseTo(1, 5);
  const basePointerSpeed = await page.evaluate(() => window.game.controls.pointerSpeed);
  expect(await page.locator('#sensitivity').inputValue()).toBe('1');
  expect(await page.locator('#sensitivity-value').textContent()).toBe('1.0x');

  // Arrastar o slider de verdade — não um hook de API — é o idioma de UI pedido.
  await page.locator('#sensitivity').fill('2.5');
  await expect.poll(() => page.evaluate(() => window.game.sensitivity)).toBeCloseTo(2.5, 5);
  const scaledPointerSpeed = await page.evaluate(() => window.game.controls.pointerSpeed);
  expect(scaledPointerSpeed).toBeCloseTo(basePointerSpeed * 2.5, 4);
  expect(await page.locator('#sensitivity-value').textContent()).toBe('2.5x');

  // Persistência: sobrevive a um reload, igual ao modo criança.
  await page.reload();
  await page.waitForFunction(() => window.game?.telemetry?.physicsReady === true);
  expect(await page.evaluate(() => window.game.sensitivity)).toBeCloseTo(2.5, 5);
  expect(await page.locator('#sensitivity').inputValue()).toBe('2.5');
  expect(await page.evaluate(() => window.game.controls.pointerSpeed)).toBeCloseTo(basePointerSpeed * 2.5, 4);

  // A faixa é clampada nas duas pontas — nunca sensibilidade zero ou negativa.
  await page.evaluate(() => window.game.api.setSensitivity(999));
  expect(await page.evaluate(() => window.game.sensitivity)).toBeLessThanOrEqual(3);
  await page.evaluate(() => window.game.api.setSensitivity(-5));
  expect(await page.evaluate(() => window.game.sensitivity)).toBeGreaterThanOrEqual(0.3);
  expect(errors).toEqual([]);
});

// F2 — PRECISÃO DE PRIMEIRO TIRO: um tiro só, deliberado, tem de conectar num
// alvo distante quando a mira já está em cima dele. OP-01 tem guardas (G)
// espalhados pelas ruas do quarteirão — mas a rua tem carro/barril/barricada
// no meio (achado real: uma seleção por "mesma linha do grid" acertava
// cobertura antes do alvo). A escolha usa a MESMA checagem de linha de visão
// da IA (game.api.hasLineOfSight) e mira na ALTURA DA CABEÇA — acima de toda
// cobertura de rua (carro 1.42 m, barril, barricada 1.0 m) — para garantir um
// tiro genuinamente desobstruído em vez de supor a geometria do mapa.
//
// MANTIDO (correção de protocolo, T-04): o anexo de rebaixamento classificou
// este caso como AC citando "LOS em engine/physics" — falso. `hasLineOfSight`
// só existe em world.js (THREE.Raycaster contra a cena construída,
// gameplay/explosives.js importa de lá); engine/physics.js não tem raycast
// nenhum (só AABB: probe/solidAt/supportHeight). unit.mjs prova o MODELO de
// espalhamento (isPrecisionShot/computeSpread) isoladamente, nunca a seleção
// de alvo por LOS real nem o "um tiro mata" contra a vida/hitbox de um
// inimigo de verdade — isso segue exclusivo do browser.
test('a long-range single tap kills a distant target', async ({ page }) => {
  test.setTimeout(600000);
  const errors = [];
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/src/web-games/james-bond/');
  await page.waitForFunction(() => window.game?.telemetry?.physicsReady === true);

  // Entrar pelos botões (não api.deploy): Pointer Lock exige um gesto real do
  // usuário — mesmo idioma do teste "five-slot loadout" acima.
  await page.click('#start-button');
  await page.click('#deploy-button');
  await page.waitForFunction(() => window.game.phase === 'playing');
  await page.waitForFunction(() => window.game.controls.isLocked === true, undefined, { timeout: 45000 });
  expect(await page.evaluate(() => window.game.currentWeapon)).toBe('deagle'); // arma inicial

  const target = await page.evaluate(() => {
    let best = null;
    let bestDistance = -1;
    for (const enemy of window.game.enemies) {
      // Elite tem 1.6× de vida (112 > 82) — sobreviveria ao tap único por
      // DESIGN de balanceamento, não por imprecisão. Fora do alvo do teste.
      if (!enemy.alive || enemy.level !== 'ground' || enemy.elite) continue;
      // Mira no CENTRO DO TORSO (dano cheio, 82 > 70 de vida de um humano),
      // não na cabeça: a 0.88 da altura o primeiro hitbox na fila do raio é
      // um BRAÇO (limb, ×0.65 = 53 de dano — não mata), comprovado pela
      // telemetria lastShot. O contrato aqui é "tiro único preciso mata de
      // longe", não mecânica de headshot.
      const aimY = enemy.root.position.y + enemy.stats.height * 0.52;
      const distance = enemy.root.position.distanceTo(window.game.camera.position);
      if (distance <= bestDistance || distance <= 40) continue;
      if (!window.game.api.hasLineOfSight(enemy.root.position.x, aimY, enemy.root.position.z)) continue;
      bestDistance = distance;
      best = { id: enemy.id, x: enemy.root.position.x, y: aimY, z: enemy.root.position.z, distance };
    }
    return best;
  });
  expect(target, 'OP-01 tem de ter ao menos um guarda visível a mais de 40 m do spawn').not.toBeNull();
  expect(target.distance, `tiro tem de ser de mapa inteiro (alvo a ${target.distance}m)`).toBeGreaterThan(40);

  // Mira EXATA no ponto já validado como desobstruído — o que se testa é a
  // precisão do MODELO DE ESPALHAMENTO, não a pontaria do usuário.
  await page.evaluate(({ x, y, z }) => window.game.camera.lookAt(x, y, z), target);
  // Garante a janela de "primeiro tiro" mesmo que o smoke rode logo após o
  // deploy: adianta o relógio FIXO do jogo (nunca setTimeout) para além do
  // CONFIG.firstShotWindow.
  await page.evaluate(() => window.game.api.fastForward(0.7));

  const before = await page.evaluate(() => ({ shots: window.game.shots, kills: window.game.kills }));
  // Gatilho pelo seam de teste (api.setFiring), NÃO por page.mouse.down():
  // sob pointer lock o Chromium sintetiza um movementX/Y espúrio no próprio
  // evento do clique (salto até o centro travado), arrancando a mira ~30°
  // do alvo no mesmo frame do disparo — um mouse físico não faz isso. O seam
  // seta a MESMA flag `firing` do mousedown real; todo o resto do pipeline
  // (cooldown, spread, raycast, dano) é o executado em produção.
  // Sob SwiftShader o pointer lock pode cair sozinho e pausar o jogo — o
  // fastForward retornaria 0 e o tiro nunca sairia (timeout mudo). Recupera
  // via botão de resume (gesto real) e transforma o silêncio em asserção.
  const phasePre = await page.evaluate(() => window.game.phase);
  if (phasePre !== 'playing') {
    await page.click('#resume-button', { force: true });
    await page.waitForFunction(() => window.game.phase === 'playing');
    await page.evaluate(({ x, y, z }) => window.game.camera.lookAt(x, y, z), target);
    await page.evaluate(() => window.game.api.fastForward(0.7));
  }
  const fired = await page.evaluate(async () => {
    window.game.api.setFiring(true);
    const steps = await window.game.api.fastForward(0.1);
    window.game.api.setFiring(false);
    return { steps, phase: window.game.phase, trigger: window.game.telemetry.trigger || null };
  });
  expect(fired.steps, 'fastForward tem de ter avançado o relógio do disparo').toBeGreaterThan(0);
  expect(fired.phase, `jogo tem de estar jogando ao disparar (trigger: ${JSON.stringify(fired.trigger)})`).toBe('playing');
  await page.waitForFunction((prev) => window.game.shots > prev, before.shots, { timeout: 20000 });

  // Um tiro só (não segurou o gatilho) mata um alvo com menos vida que o dano
  // do Desert Eagle (82) mesmo na dificuldade padrão — a prova real é o alvo
  // parar de existir vivo, não uma contagem de acerto isolada.
  await page.waitForFunction((id) => !window.game.enemies.find((enemy) => enemy.id === id)?.alive, target.id, { timeout: 20000 });
  const after = await page.evaluate(() => ({ shots: window.game.shots, kills: window.game.kills, hits: window.game.hits }));
  expect(after.shots - before.shots).toBe(1);
  expect(after.kills).toBeGreaterThan(before.kills);
  expect(errors).toEqual([]);
});

// F3 — REFORÇO CONTÍNUO: mata parte da guarnição, acelera um minuto simulado
// no relógio fixo (fastForward — nunca setTimeout) e prova cadência + teto +
// pool fixo, TUDO enquanto o metric de performance (luzes/programas
// constantes) da remediação anterior continua valendo com o spawner ativo.
test('reinforcement spawner backfills kills up to the mission cap without leaking rigs', async ({ page }) => {
  test.setTimeout(600000);
  const errors = [];
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/src/web-games/james-bond/');
  await page.waitForFunction(() => window.game?.telemetry?.physicsReady === true);

  await page.evaluate(() => window.game.api.deploy(0));
  await page.waitForFunction(() => window.game.phase === 'playing');
  await page.waitForTimeout(300);

  const stats0 = await page.evaluate(() => window.game.api.spawnerStats());
  // A guarnição inicial de cada missão (16) já nasce NO teto padrão: o
  // spawner só existe para REPOR quem morre, nunca para elevar a contagem.
  expect(stats0.alive).toBe(stats0.maxAlive);
  // O pool tem folga além do teto — é a reserva pré-criada (rig/luz/hitbox já
  // existentes, ver ai/guards.js) que o spawner recicla sem nunca alocar de novo.
  expect(stats0.poolSize).toBeGreaterThan(stats0.maxAlive);

  // Abre espaço: mata metade da guarnição do térreo pela mesma rota da
  // granada real (game.api.explode -> combat.explode -> guards.damage).
  await page.evaluate(() => {
    const groundAlive = window.game.enemies.filter((enemy) => enemy.alive && enemy.level === 'ground');
    for (let i = 0; i < 4; i += 1) {
      const enemy = groundAlive[i];
      window.game.api.explode(enemy.root.position.x, enemy.root.position.z, 8, enemy.root.position.y + 0.5);
    }
  });
  // polling (T-07): espera o spawner REGISTRAR as mortes — era waitForTimeout(200)
  await page.waitForFunction((before) => window.game.api.spawnerStats().alive < before, stats0.alive, { timeout: 8000 });
  const afterKill = await page.evaluate(() => window.game.api.spawnerStats());
  expect(afterKill.alive).toBeLessThan(stats0.alive);

  const before = await page.evaluate(() => window.game.api.rendererStats());
  // Cadência 5/min = UM reforço a cada 12 s (provado por diagnóstico com
  // `schedulerRemaining`): >12 s simulados garantem ≥1 spawn. Avançamos 20 s
  // em fatias de 5 s com um respiro entre elas — o SwiftShader do Chrome de
  // teste crasha sob evaluates longos ininterruptos (morte em instante
  // VARIÁVEL, heap estável: ambiente, não jogo). Fatiar não afrouxa nenhuma
  // asserção; só encurta a exposição do renderer por evaluate.
  let steps = 0;
  for (let slice = 0; slice < 4; slice += 1) {
    steps += await page.evaluate(() => window.game.api.fastForward(5));
    await page.waitForTimeout(150);
  }
  expect(steps).toBeGreaterThan(0);

  const spawnStats = await page.evaluate(() => window.game.api.spawnerStats());
  expect(spawnStats.spawns, 'o spawner tem de ter produzido pelo menos um reforço').toBeGreaterThan(0);
  // Teto respeitado o tempo todo — nunca mais vivos que maxAlive.
  expect(spawnStats.alive).toBeLessThanOrEqual(spawnStats.maxAlive);
  // NENHUM rig novo foi criado: o pool continua do MESMO tamanho de antes.
  expect(spawnStats.poolSize).toBe(stats0.poolSize);

  // Metric de aceitação da remediação de performance (ver teste acima) segue
  // valendo com o spawner de reforço rodando por cima.
  const after = await page.evaluate(() => window.game.api.rendererStats());
  expect(after.lights).toBe(before.lights);
  expect(after.programs).toBe(before.programs);
  expect(errors).toEqual([]);
});

// BUG (relatado do operador): subiu na torre, ficou preso — o parapeito de
// 1,05 m cercava a plataforma dos 4 lados e a escada de mão não alcançava o
// topo. O pulo agora tem ápice real para vencer obstáculos baixos (parapeito,
// engradado, tambor): da torre se sai pulando o guarda-corpo.
test('watchtower parapet is jumpable: no way up without a way down', async ({ page }) => {
  test.setTimeout(600000);
  const errors = [];
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/src/web-games/james-bond/');
  await page.waitForFunction(() => window.game?.telemetry?.physicsReady === true);
  await page.evaluate(() => window.game.api.deploy(0));
  await page.waitForFunction(() => window.game.phase === 'playing');

  // Teleporta para o topo da torre e olha para fora (qualquer lado serve: o
  // parapeito tem a mesma altura nos 4 lados).
  await page.evaluate(() => {
    const top = window.game.world.tower.top;
    window.game.api.teleport(top.x, top.z, top.y + 1);
    window.game.camera.lookAt(top.x + 30, top.y + 1, top.z);
  });
  // Assenta na plataforma no relógio fixo antes de medir.
  await page.evaluate(() => window.game.api.fastForward(0.5));
  const before = await page.evaluate(() => window.game.api.floors().playerY);
  expect(before, 'o jogador tem de estar EM CIMA da torre (10,2 m)').toBeGreaterThan(10);

  // Anda para a borda e pula. 150 ms é pulso de tecla atuada (mesma convenção
  // dos pulsos de gatilho deste arquivo), não sleep preguiçoso.
  await page.keyboard.down('KeyW');
  await page.keyboard.down('Space');
  await page.waitForTimeout(150);
  await page.keyboard.up('Space');
  // A prova é o RESULTADO (caiu da torre e assentou na rua), com orçamento
  // folgado para o headless lento — nunca um tempo cravado.
  await page.waitForFunction(
    () => window.game.api.floors().playerY < 1.6 && window.game.player.grounded,
    undefined,
    { timeout: 60000 },
  );
  await page.keyboard.up('KeyW');
  expect(errors).toEqual([]);
});

// F3 (visual) — o reforço não APARECE mais numa célula escondida: ele entra
// no mapa VOANDO de asa-delta e pousa. O teste flagra a chegada em voo pelo
// contador `arriving` (o voo dura 5 s e as fatias de avanço são de 2 s, então
// a janela nunca passa despercebida) e depois prova o pouso.
//
// MANTIDO (correção de protocolo, T-04): o anexo marcou este caso como AC
// citando "unit.mjs:167 já importa hang-glider.js" — real, mas PARCIAL:
// unit.mjs prova a geometria da asa-delta (>=6 meshes, noRay) e a inequação
// GLIDER_DURATION < intervalo de spawn, nunca a integração com estado
// (`ai/guards.js` updateArrival + `spawnerStats().arriving` subindo e
// descendo de verdade durante um spawn real) — guards.js é poluído por rigs
// THREE presos à cena, fora do padrão "zero imports" deste rebaixamento.
// Cobertura node mais fraca que o E2E; o browser continua a única prova da
// integração.
test('reinforcements fly in on hang gliders before joining the fight', async ({ page }) => {
  test.setTimeout(600000);
  const errors = [];
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/src/web-games/james-bond/');
  await page.waitForFunction(() => window.game?.telemetry?.physicsReady === true);
  await page.evaluate(() => window.game.api.deploy(0));
  await page.waitForFunction(() => window.game.phase === 'playing');

  // Abre duas vagas na guarnição do térreo pela mesma rota da granada real.
  await page.evaluate(() => {
    const groundAlive = window.game.enemies.filter((enemy) => enemy.alive && enemy.level === 'ground');
    for (let i = 0; i < 2; i += 1) {
      const enemy = groundAlive[i];
      window.game.api.explode(enemy.root.position.x, enemy.root.position.z, 8, enemy.root.position.y + 0.5);
    }
  });

  // Avança o relógio fixo em fatias até o spawner disparar (cadência 5/min =
  // primeiro reforço aos ~12 s simulados). Quando o spawn registra, a asa
  // TEM de estar no ar: o voo dura mais que o dobro da fatia.
  let stats = null;
  for (let i = 0; i < 12; i += 1) {
    await page.evaluate(() => window.game.api.fastForward(2));
    await page.waitForTimeout(120); // pacing de loop (mesma convenção T-07)
    stats = await page.evaluate(() => window.game.api.spawnerStats());
    if (stats.spawns > 0) break;
  }
  expect(stats.spawns, 'o spawner tem de ter produzido um reforço').toBeGreaterThan(0);
  expect(stats.arriving, 'o reforço tem de CHEGAR VOANDO de asa-delta, não aparecer no chão').toBeGreaterThan(0);

  // Depois do planeio, pousa: nenhuma asa no ar e a contagem de vivos reposta
  // sem estourar o teto.
  await page.evaluate(() => window.game.api.fastForward(8));
  const landed = await page.evaluate(() => window.game.api.spawnerStats());
  expect(landed.arriving).toBe(0);
  expect(landed.alive).toBeGreaterThan(0);
  expect(landed.alive).toBeLessThanOrEqual(landed.maxAlive);
  expect(errors).toEqual([]);
});
