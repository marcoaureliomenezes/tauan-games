import * as THREE from '../../vendor/three.module.min.js';
import { CONFIG, clampSensitivity } from './config.js';
import { MISSIONS } from './content/missions.js';
import { game, loadProgress, resetRun, saveProgress } from './state.js';
import { createPhysics } from './engine/physics.js';
import { createInput } from './engine/input.js';
import { createAudio } from './engine/audio.js';
import { createWorld, disposeWorld, hasLineOfSight } from './world.js';
import { createPlayer } from './player.js';
import { createGuards } from './ai/guards.js';
import { loadEnemyModels } from './ai/enemy-assets.js';
import { createCombat, createCombatLights } from './combat.js';
import { createFx } from './fx.js';
import { createMissionRules } from './gameplay/mission-rules.js';
import { createUi } from './ui.js';
import { createPerformanceController, detectWeakGpu } from './performance.js';
import { createAtmosphere, createFovController } from './atmosphere.js';

const viewport = document.querySelector('#viewport');
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(CONFIG.baseFov, innerWidth / innerHeight, 0.04, 220);
const renderer = new THREE.WebGLRenderer({ antialias: !detectWeakGpu(), powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;
renderer.outputColorSpace = THREE.SRGBColorSpace;
viewport.append(renderer.domElement);
scene.add(camera);

game.renderer = renderer;
game.camera = camera;
const performanceMode = createPerformanceController(renderer, scene, game);
const physics = await createPhysics();
const audio = createAudio();
const fx = createFx(scene);
const ui = createUi(game);
const input = createInput(camera, renderer.domElement, pauseFromUnlock);
const player = createPlayer(game, physics, camera, input, audio);
game.physics = physics;
game.controls = input.controls;
// PERF LAW (ver o comentário de topo de fx.js): flashlight + preenchimento da
// arma são criados UMA vez, aqui, na inicialização — nunca de novo a cada
// deploy(). `setActive` só alterna intensidade.
const combatLights = createCombatLights(camera);
// Inimigos animados são vendorizados localmente (~1,8 MB), então carregam antes
// do menu ficar interativo sem tela de loading. Se falhar, buildVisual cai no
// modelo procedural e o jogo segue.
const enemyModels = await loadEnemyModels();
game.telemetry.enemyModels = Object.keys(enemyModels).length;
game.telemetry.physicsReady = true;

let world, guards, combat, rules;
let selectedMission = 0, accumulator = 0, lastTime = performance.now();
let frames = 0, telemetryTime = performance.now();
const atmosphere = createAtmosphere(scene);
const fov = createFovController(camera, game);

loadProgress();
ui.refresh();
ui.syncSettings();
input.setKidsMode(game.kidsMode);
input.setSensitivity(game.sensitivity);
ui.setCallbacks({
  kidsMode: (enabled) => { input.setKidsMode(enabled); saveProgress(); },
  sensitivity: (value) => {
    game.sensitivity = clampSensitivity(value);
    input.setSensitivity(game.sensitivity);
    saveProgress();
    ui.syncSettings();
  },
  preview: (index) => loadPreview(index),
  deploy: (index) => deploy(index),
  resume: resume,
  abort: returnToMenu,
  menu: returnToMenu,
  next: nextMission,
  toggleMap: toggleMap,
});

// Sistemas com escopo de partida (inimigos, combate, regras). Vivem por
// deploy, não por mundo: redeployar a MESMA missão reaproveita o mundo mas
// precisa recriar estes — sem descartar antes, cada retry deixava a leva de
// inimigos anterior órfã na cena.
function disposeRun() {
  combat?.dispose();
  guards?.dispose();
  combat = null;
  guards = null;
  rules = null;
  // Nunca remove flashlight/fill da cena — só apaga (ver createCombatLights).
  combatLights.setActive(false);
}

function disposeMission() {
  disposeRun();
  disposeWorld(scene, world);
  world = null;
}

function buildMission(index) {
  disposeMission();
  game.telemetry.worldBuilds += 1;
  selectedMission = index;
  const mission = MISSIONS[index];
  atmosphere.apply(mission);
  world = createWorld(scene, physics, mission, fx, audio);
  performanceMode.apply(world.group);
  game.world = world;
  return mission;
}

function loadPreview(index, force = false) {
  if (game.phase !== 'menu') return;
  if (force || !world || selectedMission !== index) buildMission(index);
  fov.reset();
  camera.position.copy(world.start).add(new THREE.Vector3(7, 8, 10));
  camera.lookAt(world.start);
}

/**
 * Aquece TODO material/shader que pode aparecer em jogo antes do primeiro
 * frame jogável — é isto que elimina o travamento de "início de missão"
 * (achado CRITICAL #2 da revisão de performance). Chamado só depois que
 * mundo + inimigos + combate + o pool fixo de luzes já existem, com o
 * briefing ainda na tela (a Promise resolve por trás da transição).
 *
 * r165 suporta `compileAsync` (usa KHR_parallel_shader_compile quando
 * disponível). Como TODOS os pools de fx.js/explosives.js/guards.js ficam
 * permanentemente na cena desde a inicialização (mesmo invisíveis —
 * `WebGLRenderer.compile` percorre a cena com `traverse`, não
 * `traverseVisible`, então materiais de objetos ocultos SÃO compilados), uma
 * única chamada já aquece explosão/foguete/granada/tracer/partícula/decal/
 * poça/estilhaço/aura. O único material que só existe quando o jogador troca
 * de arma de verdade é o das armas NÃO equipadas no início — por isso
 * `combat.warmWeaponModels()` roda entre as duas chamadas.
 */
async function warmShaderPrograms() {
  await renderer.compileAsync(scene, camera);
  combat.warmWeaponModels();
  // As armas recém-montadas por `warmWeaponModels` nascem com material PBR
  // cheio; se o modo é 'compatibility' (GPU fraca), `apply()` teria de
  // convertê-las TAMBÉM, senão a arma escolhida no meio do jogo compila
  // Standard mesmo depois do "aquecimento". `apply()` é idempotente (cache
  // por WeakMap) — reaplicar sobre o que já é leve não custa nada.
  performanceMode.apply(scene);
  await renderer.compileAsync(scene, camera);
}

async function deploy(index) {
  audio.unlock();
  resetRun();
  game.missionIndex = index;
  // Reaproveita o mundo quando a missão é a mesma; ainda assim descarta a
  // partida anterior antes de montar a nova.
  const reuseWorld = Boolean(world) && selectedMission === index;
  if (reuseWorld) disposeRun();
  const mission = reuseWorld ? MISSIONS[index] : buildMission(index);
  game.telemetry.staticColliders = physics.staticColliderCount;
  player.spawn(world.start, world.spawnLook);
  guards = createGuards(scene, game, world, audio, damagePlayer, fx);
  combat = createCombat(scene, camera, game, input, audio, fx, world, guards, damagePlayer, ui);
  combatLights.setActive(true);
  // Modo de qualidade decidido UMA VEZ aqui, antes do pré-aquecimento — nunca
  // mais no meio da partida (item 6b da revisão: a troca de shadowMap +
  // material + framebuffer no meio do jogo era, sozinha, o maior travamento
  // único). `performanceMode.sample()` continua rodando durante o jogo, mas só
  // alimenta esta decisão no PRÓXIMO deploy. `apply(scene)` roda incondicional
  // (como sempre) — se o modo já é 'compatibility' (GPU fraca detectada no
  // arranque, ou virada numa partida anterior), os materiais NOVOS desta run
  // (guards, combate, armas) também precisam do tratamento leve.
  performanceMode.decideMode();
  performanceMode.apply(scene);
  rules = createMissionRules(game, mission, world, input, audio, {
    objective: () => ui.updateHud(),
    prompt: ui.prompt,
    complete: completeMission,
  });
  // O Pointer Lock precisa da ativação de usuário SÍNCRONA do clique que
  // disparou este deploy() — pedi-lo depois de um `await` perde essa janela
  // (Chrome rejeita com "A user gesture is required to request Pointer
  // Lock."). Por isso o lock é pedido AQUI, antes do aquecimento assíncrono
  // de shader, exatamente como no fluxo síncrono de antes; só a transição de
  // fase/HUD/música é que espera o aquecimento terminar.
  input.lock();
  // Shaders aquecidos com o briefing ainda na tela — o jogo só entra em
  // `playing` depois que o primeiro frame não tem mais nada para compilar.
  await warmShaderPrograms();
  game.phase = 'playing';
  hudTimer = 0;
  fov.reset();
  ui.screen(null);
  ui.updateHud();
  audio.startMusic();
}

let hudTimer = 0;
function fixedUpdate(dt) {
  game.time += dt;
  player.update(dt);
  combat.update(dt);
  guards.update(dt, game.time, camera.position);
  rules.update(dt);
  fx.update(dt);
  fov.update(dt);
  hudTimer -= dt;
  if (hudTimer <= 0) {
    hudTimer = CONFIG.hudRefresh;
    ui.updateHud();
    ui.drawRadar(world, camera);
  }
  camera.getWorldDirection(tempDirection);
  audio.setListener(camera.position, tempDirection);
}

const tempDirection = new THREE.Vector3();
function damagePlayer(amount) {
  if (game.phase !== 'playing') return;
  const absorbed = Math.min(game.armor, amount * 0.55);
  game.armor -= absorbed;
  game.health -= amount - absorbed;
  audio.hurt();
  const vignette = document.querySelector('#damage-vignette');
  vignette.style.opacity = '1';
  setTimeout(() => { vignette.style.opacity = '0'; }, 130);
  if (game.health <= 0) failMission();
}

function completeMission() {
  if (game.phase !== 'playing') return;
  game.phase = 'result';
  game.unlocked = Math.max(game.unlocked, Math.min(MISSIONS.length, game.missionIndex + 2));
  saveProgress();
  audio.stopMusic();
  input.controls.unlock();
  ui.refresh();
  ui.showResult(true);
}

function failMission() {
  game.phase = 'result';
  audio.stopMusic();
  input.controls.unlock();
  ui.showResult(false);
}

function pauseFromUnlock() {
  if (game.phase !== 'playing') return;
  game.phase = 'paused';
  ui.screen('pause');
}

function resume() {
  if (game.phase !== 'paused') return;
  game.phase = 'playing';
  ui.screen(null);
  input.lock();
}

function returnToMenu() {
  game.phase = 'menu';
  audio.stopMusic();
  if (input.controls.isLocked) input.controls.unlock();
  ui.screen('menu');
  loadPreview(ui.selected, true);
}

function nextMission() {
  const index = Math.min(MISSIONS.length - 1, game.missionIndex + 1);
  game.phase = 'menu';
  ui.selectMission(index);
  ui.showBriefing();
}

function toggleMap() {
  if (game.phase !== 'playing' || !world) return;
  ui.toggleMap(world, camera);
}

function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(CONFIG.maxFrameDelta, (now - lastTime) / 1000 || 0);
  lastTime = now;
  if (now - telemetryTime >= 1000) {
    game.telemetry.fps = Math.round(frames / ((now - telemetryTime) / 1000));
    game.telemetry.drawCalls = renderer.info.render.calls;
    performanceMode.sample(game.telemetry.fps);
    frames = 0;
    telemetryTime = now;
  }
  if (game.phase === 'playing') {
    if (input.consume('KeyM')) toggleMap();
    if (!ui.mapOpen) {
      accumulator += dt;
      while (accumulator >= CONFIG.fixedStep) { fixedUpdate(CONFIG.fixedStep); accumulator -= CONFIG.fixedStep; }
    }
  } else if (game.phase === 'menu' && world) {
    const angle = now * 0.00008;
    camera.position.set(world.start.x + Math.cos(angle) * 13, 8, world.start.z + Math.sin(angle) * 13);
    camera.lookAt(world.start.x, 1, world.start.z);
    fx.update(dt);
  }
  if (!performanceMode.shouldRender(now)) return;
  frames += 1;
  const shake = fx.shake;
  if (shake) camera.position.add(tempDirection.set((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake, 0));
  renderer.render(scene, camera);
  if (shake) camera.position.sub(tempDirection);
}

game.api = {
  deploy,
  completeObjective: (key) => rules?.complete(key),
  completeMission,
  damagePlayer,
  /**
   * Métrica de aceitação da remediação de performance (revisão
   * code-reviewer/software-architect 2026-08-10): `programs` tem de ficar
   * CONSTANTE antes/durante/depois de uma cadeia de explosões, e `lights`
   * NUNCA pode mudar durante o gameplay — é exatamente o que o pool fixo de
   * luzes (fx.js) e o rig de explosão pooled (fx.js) garantem.
   */
  rendererStats() {
    let lights = 0;
    scene.traverse((object) => { if (object.isLight) lights += 1; });
    return { programs: renderer.info.programs ? renderer.info.programs.length : 0, lights };
  },
  unlockAll() { game.unlocked = MISSIONS.length; saveProgress(); ui.refresh(); },
  setKidsMode(enabled) {
    game.kidsMode = Boolean(enabled);
    input.setKidsMode(game.kidsMode);
    saveProgress();
    ui.syncSettings();
  },
  // Espelha o callback da UI (F1): usado por testes e por qualquer chamador
  // que precise ajustar a sensibilidade sem depender do slider do DOM.
  setSensitivity(value) {
    game.sensitivity = clampSensitivity(value);
    input.setSensitivity(game.sensitivity);
    saveProgress();
    ui.syncSettings();
  },
  lookLimits: () => ({ min: input.controls.minPolarAngle, max: input.controls.maxPolarAngle, kids: input.kidsMode }),
  selectWeapon: (id) => combat?.switchWeapon(id),
  projectilesInFlight: () => combat?.inFlight ?? 0,
  // Gancho de teste: detona no ponto pedido, pela MESMA rota da granada
  // (efeito, som, dano, e a onda que desloca e destrói o cenário).
  explode: (x, z, radius = 6.5, y = 0.6) => combat?.explode(new THREE.Vector3(x, y, z), radius),
  debugRay: (range) => combat?.debugRay(range) ?? [],
  setFiring: (value) => input.setFiring(value),
  // Estatísticas do spawner de reforço (F3): usado por testes para provar a
  // cadência, o teto de vivos e o tamanho FIXO do pool (nenhum rig novo).
  spawnerStats: () => guards?.spawnerStats() ?? null,
  // Gancho de teste: mesma linha de visão que a IA usa para mirar/perseguir
  // (ai/guards.js) e que a explosão usa para ferir (gameplay/explosives.js) —
  // permite a um teste confirmar ANTES de atirar que não há parede/cobertura
  // no caminho, em vez de adivinhar geometria de mapa lendo o grid.
  hasLineOfSight: (x, y, z) => (world ? hasLineOfSight(world, camera.position, new THREE.Vector3(x, y, z)) : false),
  /**
   * Adianta o relógio FIXO do jogo `seconds` segundos, chamando o mesmo
   * `fixedUpdate` do loop real repetidas vezes — nunca `setTimeout`/relógio de
   * parede para a SIMULAÇÃO em si (o passo continua sempre `CONFIG.fixedStep`,
   * qualquer que seja o tempo real decorrido). Gancho de teste: prova o
   * spawner de reforço (F3) e o modelo de precisão de primeiro tiro (F2) num
   * "minuto simulado" sem depender de tempo real, que sob carga de máquina
   * compartilhada é não-determinístico (mesmo motivo documentado em vários
   * `waitForFunction` de smoke.spec.js).
   *
   * BUG (achado real, reproduzido no smoke de aceitação do spawner): rodar
   * milhares de `fixedUpdate` num laço 100% síncrono, sem nunca devolver o
   * controle ao event loop, faz o Chromium headless matar a aba por "página
   * sem resposta" antes de terminar um minuto simulado inteiro (~3600 passos).
   * A cessão periódica abaixo usa `setTimeout(0)` só como TÉCNICA de
   * escalonamento cooperativo — não é o relógio da simulação, que segue 100%
   * determinístico em `dt` fixo.
   */
  async fastForward(seconds = 1) {
    if (game.phase !== 'playing') return 0;
    const steps = Math.max(0, Math.min(20000, Math.round(seconds / CONFIG.fixedStep)));
    for (let i = 0; i < steps; i += 1) {
      fixedUpdate(CONFIG.fixedStep);
      if (i % 50 === 49) await new Promise((resolve) => setTimeout(resolve, 0));
    }
    return steps;
  },
  // Ganchos de teste: reposicionam o jogador e expõem o estado dos andares.
  teleport(x, z, y = 1) {
    physics.createPlayer({ x, y, z });
    camera.position.set(x, y + CONFIG.eyeHeight - 1, z);
  },
  /**
   * Auditoria do mapa carregado. Varre os DOIS andares em malha fina e usa a
   * física real (`physics.probe`, o mesmo teste do movimento) para responder
   * três perguntas, sem depender de inspeção visual:
   *
   *   inside  — o jogador ficaria DENTRO de geometria sólida neste ponto?
   *   trapped — parado aqui, ele conseguiria sair em alguma das 8 direções?
   *   stairs  — cada escadaria é subível andando e descível de volta?
   */
  /**
   * "Tudo que é sólido tem de ser visível e opaco."
   * Para cada volume de colisão, atira um raio de cima para baixo sobre o seu
   * topo e exige encontrar geometria VISÍVEL e OPACA ali. Colisor sem desenho
   * é parede invisível; desenho transparente sobre colisor é sólido fantasma.
   */
  auditSolids() {
    if (!world) return null;
    const { boxes, platforms } = physics.colliders();
    const raycaster = new THREE.Raycaster();
    const down = new THREE.Vector3(0, -1, 0);
    const origin = new THREE.Vector3();
    const invisible = [];
    const seeThrough = [];
    // Amostra pontos INTERNOS do volume. Mirar só no centro erra quando o
    // colisor é mesclado (paredes contíguas viram uma caixa só) e o centro cai
    // exatamente na aresta entre duas instâncias desenhadas.
    const samplePoints = (volume) => {
      const points = [];
      const spread = (center, half) => {
        const values = [];
        for (let v = center - half + 0.9; v <= center + half - 0.9 + 1e-6; v += 1.8) values.push(v);
        return values.length ? values : [center];
      };
      for (const x of spread(volume.x, volume.hx)) for (const z of spread(volume.z, volume.hz)) points.push([x, z]);
      return points;
    };
    const check = (volume, label) => {
      for (const [x, z] of samplePoints(volume)) {
        origin.set(x, volume.topY + 0.5, z);
        raycaster.set(origin, down);
        raycaster.far = 1.2;
        const hits = raycaster.intersectObject(world.group, true)
          .filter((hit) => hit.object.visible && hit.object.userData?.kind !== 'extraction');
        const solid = hits.find((hit) => {
          const material = Array.isArray(hit.object.material) ? hit.object.material[0] : hit.object.material;
          return material && (!material.transparent || material.opacity >= 0.99);
        });
        if (!solid) { invisible.push(`${label} @${x.toFixed(1)},${z.toFixed(1)}`); return; }
        if (solid !== hits[0]) { seeThrough.push(`${label} @${x.toFixed(1)},${z.toFixed(1)}`); return; }
      }
    };
    boxes.forEach((box, i) => check(box, `box#${i} @${box.x.toFixed(1)},${box.topY.toFixed(2)},${box.z.toFixed(1)}`));
    platforms.forEach((platform, i) => {
      // O piso térreo é o plano do mapa inteiro; o raio no centro basta.
      if (platform.hx > 20) return;
      check(platform, `platform#${i} @${platform.x.toFixed(1)},${platform.topY.toFixed(2)},${platform.z.toFixed(1)}`);
    });
    return { boxes: boxes.length, platforms: platforms.length, invisible, seeThrough };
  },
  auditMap() {
    if (!world) return null;
    const cell = CONFIG.cellSize;
    const directions = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    const offsets = [-1.15, 0, 1.15];

    // Um NÓ é (célula, nível). térreo/mezanino usam EXATAMENTE a mesma fórmula
    // de sempre (nada muda para eles); telhado/passagem/torre (M1/M2/M3)
    // entram como níveis adicionais no MESMO dispatch, cada um com o seu
    // predicado de andável (world.js) e a sua altura de pé.
    const levelWalkable = {
      ground: world.groundWalkable,
      upper: world.upperWalkable,
      roof: world.roofWalkable,
      underground: world.undergroundWalkable,
      tower: world.towerWalkable,
    };
    const levelFeet = {
      ground: 0,
      upper: CONFIG.floorHeight,
      roof: CONFIG.roofHeight,
      underground: -CONFIG.undergroundDepth,
      tower: CONFIG.towerHeight,
    };
    const nodeKey = (x, z, level) => `${level}:${x},${z}`;
    const isNode = (x, z, level) => Boolean(levelWalkable[level]?.(x, z));
    const feetOf = (level) => levelFeet[level] ?? 0;

    // Passagem entre dois nós vizinhos: varre o segmento entre os centros e
    // exige que o jogador caiba em todo ponto do caminho. Um vão fino demais
    // (parapeito, quina de parede) reprova aqui.
    const passable = (from, to, level) => {
      const a = world.toWorld(from);
      const b = world.toWorld(to);
      for (let i = 0; i <= 8; i += 1) {
        const t = i / 8;
        const x = a.x + (b.x - a.x) * t;
        const z = a.z + (b.z - a.z) * t;
        const y = physics.supportHeight(x, z, feetOf(level)) + 1;
        if (physics.probe(x, y, z)) return false;
      }
      return true;
    };

    const reach = (startCell, level) => {
      const seen = new Set([nodeKey(startCell.x, startCell.z, level)]);
      const queue = [startCell];
      while (queue.length) {
        const current = queue.shift();
        for (const [dx, dz] of directions) {
          const next = { x: current.x + dx, z: current.z + dz };
          const key = nodeKey(next.x, next.z, level);
          if (seen.has(key) || !isNode(next.x, next.z, level)) continue;
          if (!passable(current, next, level)) continue;
          seen.add(key);
          queue.push(next);
        }
      }
      return seen;
    };

    // --- Térreo: tudo que importa tem de ser alcançável a partir do spawn ---
    const startCell = world.toCell(world.start);
    const groundReach = reach(startCell, 'ground');
    const unreachable = [];
    for (const mesh of world.objectiveMeshes) {
      const c = world.toCell(mesh.position);
      if (!groundReach.has(nodeKey(c.x, c.z, 'ground'))) unreachable.push(`objetivo ${mesh.userData.key}`);
    }
    const exit = world.toCell(world.extraction);
    if (!groundReach.has(nodeKey(exit.x, exit.z, 'ground'))) unreachable.push('extração');

    // --- Escadarias: sobe andando, desce andando, e liga os dois níveis ------
    const stairs = (world.upper.stairs || []).map(({ cell: stairCell, position, direction: [dx, dz] }) => {
      const walk = (fromX, fromZ, sx, sz) => {
        physics.createPlayer({ x: fromX, y: 1 + physics.supportHeight(fromX, fromZ, 0), z: fromZ });
        for (let i = 0; i < 200; i += 1) physics.movePlayer({ x: sx, y: -0.12, z: sz });
        return physics.position();
      };
      const top = walk(position.x - dx * cell * 0.9, position.z - dz * cell * 0.9, dx * 0.05, dz * 0.05);
      const back = walk(position.x + dx * cell * 0.55, position.z + dz * cell * 0.55, -dx * 0.05, -dz * 0.05);
      const base = { x: stairCell.x - dx, z: stairCell.z - dz };
      return {
        cell: `${stairCell.x},${stairCell.z}`,
        climbed: top.y >= CONFIG.floorHeight + 1 - 0.05,
        descended: back.y <= 1.05,
        // O pé da escada tem de estar no mesmo mundo que o spawn, senão ela
        // existe mas ninguém chega nela.
        reachable: groundReach.has(nodeKey(base.x, base.z, 'ground')),
        top: top.y,
        bottom: back.y,
      };
    });

    // --- Mezanino: saindo da escada, toda a laje tem de ser transitável -----
    const upperIslands = [];
    const upperCells = new Set();
    for (const key of world.upper.cells) {
      const [x, z] = key.split(',').map(Number);
      if (world.upperWalkable(x, z)) upperCells.add(`${x},${z}`);
    }
    const upperSeen = new Set();
    for (const { cell: stairCell, direction: [dx, dz] } of world.upper.stairs || []) {
      const landing = { x: stairCell.x + dx, z: stairCell.z + dz };
      if (!isNode(landing.x, landing.z, 'upper')) { upperIslands.push(`saída da escada ${stairCell.x},${stairCell.z}`); continue; }
      for (const key of reach(landing, 'upper')) upperSeen.add(key.slice(6));
    }
    const orphanUpper = [...upperCells].filter((key) => !upperSeen.has(key));

    // --- Telhado (M1): saindo da escada do mezanino, toda a laje é transitável.
    // Mesmo critério do mezanino, um nível acima — a IA não entra aqui (ver
    // ai/nav-graph.js), só o jogador.
    const roofIslands = [];
    const roofCells = new Set(world.roof.cells);
    const roofSeen = new Set();
    for (const { cell: stairCell, direction: [dx, dz] } of world.roof.stairs || []) {
      const landing = { x: stairCell.x + dx, z: stairCell.z + dz };
      if (!isNode(landing.x, landing.z, 'roof')) { roofIslands.push(`saída da escada ${stairCell.x},${stairCell.z}`); continue; }
      for (const key of reach(landing, 'roof')) roofSeen.add(key.slice(5));
    }
    const orphanRoof = [...roofCells].filter((key) => !roofSeen.has(key));

    // --- Passagem subterrânea (M3): de cada boca de visita, toda a passagem é
    // transitável — mesmo critério, um nível abaixo do chão.
    const undergroundIslands = [];
    const undergroundCells = new Set(world.underground.cells);
    const undergroundSeen = new Set();
    for (const { cell: entranceCell, direction: [dx, dz] } of world.underground.entrances || []) {
      const landing = { x: entranceCell.x + dx, z: entranceCell.z + dz };
      if (!isNode(landing.x, landing.z, 'underground')) { undergroundIslands.push(`saída da boca ${entranceCell.x},${entranceCell.z}`); continue; }
      for (const key of reach(landing, 'underground')) undergroundSeen.add(key.slice(12));
    }
    const orphanUnderground = [...undergroundCells].filter((key) => !undergroundSeen.has(key));

    // --- Escadaria/boca ANDANDO, nos dois sentidos: mesma técnica das
    // escadarias do mezanino (passo automático + empurrão para baixo em Y),
    // que não distingue subir de descer — só o `feetOf` de origem/destino
    // muda. Reusado para telhado (mezanino->telhado) e passagem
    // (rua->passagem, aqui de fato DESCENDO).
    // 190 passos * 0.05 m = 9.5 m: cruza a célula de origem inteira + a
    // escada/boca + a célula de pouso, sem sair vagando até esbarrar em
    // outro relevo do mapa (uma calçada mais adiante, por exemplo, tem seu
    // próprio degrau de 0.13 m — andar 13 m longe o bastante para alcançá-la
    // faz o "chegou lá" oscilar por um relevo que nada tem a ver com ESTA
    // escada/boca).
    const walkLevel = (position, [dx, dz], fromFeet, toFeet) => {
      physics.createPlayer({ x: position.x - dx * cell * 0.9, y: fromFeet + 1, z: position.z - dz * cell * 0.9 });
      for (let i = 0; i < 190; i += 1) physics.movePlayer({ x: dx * 0.05, y: -0.12, z: dz * 0.05 });
      return physics.position();
    };
    const roofStairs = (world.roof.stairs || []).map(({ cell: stairCell, position, direction: [dx, dz] }) => {
      const forward = walkLevel(position, [dx, dz], CONFIG.floorHeight, CONFIG.roofHeight);
      const backward = walkLevel(position, [-dx, -dz], CONFIG.roofHeight, CONFIG.floorHeight);
      const base = { x: stairCell.x - dx, z: stairCell.z - dz };
      return {
        cell: `${stairCell.x},${stairCell.z}`,
        climbed: Math.abs(forward.y - (CONFIG.roofHeight + 1)) < 0.1,
        descended: Math.abs(backward.y - (CONFIG.floorHeight + 1)) < 0.1,
        reachable: upperSeen.has(`${base.x},${base.z}`),
        top: forward.y,
        bottom: backward.y,
      };
    });
    const undergroundStairs = (world.underground.entrances || []).map(({ cell: entranceCell, position, direction: [dx, dz] }) => {
      const forward = walkLevel(position, [dx, dz], 0, -CONFIG.undergroundDepth);
      const backward = walkLevel(position, [-dx, -dz], -CONFIG.undergroundDepth, 0);
      const base = { x: entranceCell.x - dx, z: entranceCell.z - dz };
      return {
        cell: `${entranceCell.x},${entranceCell.z}`,
        climbed: Math.abs(forward.y - (-CONFIG.undergroundDepth + 1)) < 0.1,
        // Faixa, não igualdade exata: a boca pode desembocar numa célula de
        // calçada (degrau de 0.13 m, ver world.js addCoverColliders) — 1.0
        // (asfalto) e 1.13 (calçada) são AMBOS "chegou na rua"; -2 (ainda na
        // passagem) ou qualquer coisa fora dessa faixa não é.
        descended: backward.y >= 0.95 && backward.y <= 1.2,
        reachable: groundReach.has(nodeKey(base.x, base.z, 'ground')),
        top: forward.y,
        bottom: backward.y,
      };
    });

    // --- Nenhum ponto ALCANÇÁVEL pode estar dentro de sólido ou sem saída ---
    const inside = [];
    const trapped = [];
    const escapes = [[1, 0], [-1, 0], [0, 1], [0, -1], [0.7, 0.7], [-0.7, 0.7], [0.7, -0.7], [-0.7, -0.7]];
    // Uma célula VEDADA é o defeito; uma célula com MOBÍLIA não é.
    //
    // A regra antiga reprovava a célula assim que UM ponto de amostra caísse
    // dentro de sólido. Isso passou a acusar todo canto onde há engradado,
    // tambor ou barril — que agora são obstáculos sólidos de propósito, e que
    // o jogador simplesmente contorna, como qualquer móvel. O que continua
    // sendo bug (e foi o que prendeu o operador dentro da escadaria) é a
    // célula em que NENHUM ponto é livre, ou um ponto livre sem saída.
    const checkNode = (x, z, level, label) => {
      const point = world.toWorld({ x, z });
      let free = 0;
      for (const ox of offsets) for (const oz of offsets) {
        const px = point.x + ox;
        const pz = point.z + oz;
        const y = physics.supportHeight(px, pz, feetOf(level)) + 1;
        if (physics.probe(px, y, pz)) continue;         // ponto ocupado por móvel
        free += 1;
        // A sonda de saída (8 direções) só roda no CENTRO da célula. Ela
        // pergunta "parado aqui, o jogador sai?", e o ponto representativo de
        // onde ele para é o centro. Rodá-la nos 9 pontos custava 9× e, com os
        // mapas em quarteirão (693 células contra as 375 antigas), a auditoria
        // das 6 missões passou a estourar o tempo do smoke.
        if (ox !== 0 || oz !== 0) continue;
        if (!escapes.some(([ex, ez]) => !physics.probe(px + ex * 0.4, y, pz + ez * 0.4))) trapped.push(`${label} ${x},${z}`);
      }
      if (!free) inside.push(`${label} ${x},${z}`);
    };
    for (const key of groundReach) {
      const [x, z] = key.slice(7).split(',').map(Number);
      checkNode(x, z, 'ground', 'térreo');
    }
    for (const key of upperSeen) {
      const [x, z] = key.split(',').map(Number);
      checkNode(x, z, 'upper', 'mezanino');
    }
    for (const key of roofSeen) {
      const [x, z] = key.split(',').map(Number);
      checkNode(x, z, 'roof', 'telhado');
    }
    for (const key of undergroundSeen) {
      const [x, z] = key.split(',').map(Number);
      checkNode(x, z, 'underground', 'passagem');
    }
    // Torre (M2): plataforma de UMA célula só — o mesmo teste de dentro/preso
    // do resto do mapa, aplicado ao topo. A subida em si (escada de mão) usa
    // um mecanismo diferente de "andar" (physics.onLadder/climbSpeed — ver
    // player.js) e é validada por teleporte no smoke, não aqui.
    if (world.tower) checkNode(world.tower.base.x, world.tower.base.z, 'tower', 'topo da torre');

    return {
      groundCells: groundReach.size,
      upperCells: upperCells.size,
      upperReached: upperSeen.size,
      roofCells: roofCells.size,
      roofReached: roofSeen.size,
      undergroundCells: undergroundCells.size,
      undergroundReached: undergroundSeen.size,
      unreachable,
      orphanUpper,
      upperIslands,
      orphanRoof,
      roofIslands,
      orphanUnderground,
      undergroundIslands,
      inside: [...new Set(inside)],
      trapped: [...new Set(trapped)],
      stairs: [...stairs, ...roofStairs, ...undergroundStairs],
    };
  },
  floors: () => ({
    stairs: (world?.upper?.stairs || []).map(({ position, direction }) => ({ x: position.x, z: position.z, direction })),
    slabCells: world?.upper?.cells?.size || 0,
    // Centro de uma célula de laje, para testar que o mezanino sustenta o jogador.
    slabPoint: (() => {
      const key = world?.upper?.cells?.values?.().next?.().value;
      if (!key) return null;
      const [x, z] = key.split(',').map(Number);
      const point = world.toWorld({ x, z });
      return { x: point.x, z: point.z };
    })(),
    platforms: physics.platformCount,
    ladderVolumes: physics.ladderCount,
    playerY: physics.position().y,
    onLadder: physics.onLadder(physics.position().x, physics.position().z, physics.position().y - 1),
    climbing: Boolean(game.player.climbing),
  }),
  snapshot: () => ({ phase: game.phase, mission: game.missionIndex, health: game.health, objectives: game.objectives.map((item) => ({ ...item })), enemies: game.enemies.filter((enemy) => enemy.alive).length, fps: game.telemetry.fps }),
};

addEventListener('resize', () => performanceMode.resize(camera));

loadPreview(0);
requestAnimationFrame(frame);
