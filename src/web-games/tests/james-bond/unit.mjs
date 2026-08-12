import assert from 'node:assert/strict';
import * as THREE from '../../vendor/three.module.min.js';
import { MISSIONS } from '../../james-bond/src/content/missions.js';
import { WEAPONS, freshAmmo } from '../../james-bond/src/content/weapons.js';
import { createRandom, hashSeed } from '../../james-bond/src/random.js';
import { createPhysics } from '../../james-bond/src/engine/physics.js';
import { CONFIG, SENSITIVITY, clampSensitivity, KIDS, LOOK } from '../../james-bond/src/config.js';
import { slabCells, stairDirection, addUpperFloor, STAIR_STEPS } from '../../james-bond/src/upper-floor.js';
import { addTower } from '../../james-bond/src/tower.js';
import { isSolid, SOLID_TILES, GROUND_TILES, MARKERS } from '../../james-bond/src/content/tiles.js';
import { stepProjectile } from '../../james-bond/src/gameplay/ballistics.js';
import { isPrecisionShot, computeSpread } from '../../james-bond/src/gameplay/spread.js';
import {
  spawnIntervalSeconds, createSpawnScheduler, pickSpawnCell, groundPoolSize, validateSpawnConfig,
  DEFAULT_SPAWN_RATE, DEFAULT_MAX_ALIVE, SPAWN_MIN_DISTANCE,
} from '../../james-bond/src/gameplay/spawner.js';
import { game, resetRun, STARTING_WEAPON } from '../../james-bond/src/state.js';

/** Fabrica um `world` mínimo para chamar addUpperFloor()/addTower() em Node:
 * ambas as funções só precisam de `chars` (grade de tiles) e `toWorld` (célula
 * -> posição), nunca de cena THREE de verdade — a mesma razão pela qual são
 * DEMOTABLE-NEW no anexo de rebaixamento (upper-floor.js e tower.js importam
 * só THREE + config + tiles, zero DOM). THREE em si roda em Node sem GPU:
 * Group/Mesh/InstancedMesh/Material são dados puros até um WebGLRenderer
 * entrar em cena (ver a asa-delta importada acima). */
function buildFloorWorld(mission) {
  const height = mission.grid.length;
  const width = mission.grid[0].length;
  const chars = mission.grid.map((row) => row.split(''));
  const toWorld = ({ x, z }) => new THREE.Vector3((x - width / 2) * CONFIG.cellSize, 0, (z - height / 2) * CONFIG.cellSize);
  return { chars, toWorld };
}
const floorMaterials = () => ({
  floor: new THREE.MeshStandardMaterial(),
  trim: new THREE.MeshStandardMaterial(),
  wall: new THREE.MeshStandardMaterial(),
});

assert.equal(MISSIONS.length, 6, 'campaign must have six missions');
for (const mission of MISSIONS) {
  // Quarteirão, não corredor: o mapa é retangular e grande o bastante para
  // caber rua, calçada e prédios em que se entra dos dois lados dela.
  assert.ok(mission.grid.length >= 15, `${mission.code} height`);
  assert.equal(new Set(mission.grid.map((row) => row.length)).size, 1, `${mission.code} width`);
  assert.ok(mission.grid[0].length >= 25, `${mission.code} width >= 25`);

  // Todo caractere do mapa pertence ao vocabulário de tile — um símbolo solto
  // vira chão invisível (nem sólido, nem desenhado).
  const known = new Set([...Object.keys(SOLID_TILES), ...Object.keys(GROUND_TILES), ...MARKERS]);
  for (const char of new Set(mission.grid.join(''))) {
    assert.ok(known.has(char), `${mission.code} tile desconhecido '${char}'`);
  }
  // Cenário urbano de verdade: rua, calçada, porta e ao menos um tipo de
  // entulho. Sem isto o mapa recai no labirinto liso que o operador rejeitou.
  const all = mission.grid.join('');
  for (const char of ['=', ',', '+', 'n']) {
    assert.ok(all.includes(char), `${mission.code} precisa de tile '${char}'`);
  }
  assert.ok(['c', 'u', 'b'].some((char) => all.includes(char)),
    `${mission.code} precisa de carcaça, escombro ou barricada na rua`);
  // Duas espécies distintas de inimigo por fase.
  assert.ok(Object.keys(mission.enemyMix || {}).length >= 2,
    `${mission.code} precisa de pelo menos dois tipos de inimigo`);
  for (const marker of ['S', 'A', 'B', 'C', 'E']) {
    assert.ok(mission.grid.join('').includes(marker), `${mission.code} missing ${marker}`);
  }
  const start = findMarker(mission.grid, 'S');
  const reachable = floodFill(mission.grid, start);
  for (const marker of ['A', 'B', 'C', 'E']) {
    assert.ok(reachable.has(findMarker(mission.grid, marker).join(',')), `${mission.code} cannot reach ${marker}`);
  }
  assert.equal(Object.keys(mission.objectives).length, 3, `${mission.code} objectives`);
  // Orçamento de inimigos da missão: o teto de vivos simultâneos é o que
  // efetivamente "orça" quantos inimigos existem em cena — sem ele nenhuma
  // guarnição/reforço nasce.
  assert.ok(mission.maxAlive > 0, `${mission.code} enemyBudget (maxAlive) must be positive`);

  // --- F3: config de reforço contínuo ---------------------------------------
  assert.deepEqual(validateSpawnConfig(mission), [], `${mission.code} spawner config`);
  // A guarnição inicial (tiles G + upper.guards) nunca pode já estourar o
  // teto de vivos — senão o "reforço" nasceria morto: sem folga nenhuma para
  // repor quem morre.
  const groundGuardCount = mission.grid.join('').split('').filter((char) => char === 'G').length;
  const initialGarrison = groundGuardCount + (mission.upper.guards || []).length;
  assert.ok(initialGarrison <= mission.maxAlive,
    `${mission.code} guarnição inicial (${initialGarrison}) não pode passar do teto maxAlive (${mission.maxAlive})`);

  // --- Invariantes de andar (o operador ficou preso: nunca mais) -----------
  const chars = mission.grid.map((row) => row.split(''));
  const cells = slabCells(mission.upper);
  assert.equal(mission.upper.stairs.length, mission.upper.slabs.length, `${mission.code} one stair per slab`);

  // 1. Cada escadaria é EXTERNA à laje, em chão vazio, com saída em laje
  //    pisável e entrada livre no térreo.
  const landings = [];
  for (const [x, z] of mission.upper.stairs) {
    assert.ok(!isSolid(chars[z][x]) && !'SABCEXG'.includes(chars[z][x]),
      `${mission.code} stair (${x},${z}) must sit on empty ground (no wall, marker or spawn)`);
    assert.ok(!cells.has(`${x},${z}`),
      `${mission.code} stair (${x},${z}) must sit OUTSIDE the slab — a stair inside it splits the mezzanine`);
    const direction = stairDirection(cells, chars, x, z);
    assert.ok(direction, `${mission.code} stair (${x},${z}) needs a walkable exit above and entry below`);
    landings.push({ x: x + direction[0], z: z + direction[1] });
  }

  // 2. Cada laje tem a sua escada e é transitável de ponta a ponta.
  mission.upper.slabs.forEach((slab, index) => {
    const [x0, z0, x1, z1] = slab;
    const landing = landings[index];
    assert.ok(landing.x >= x0 && landing.x <= x1 && landing.z >= z0 && landing.z <= z1,
      `${mission.code} slab ${JSON.stringify(slab)} must be served by its own stair`);
    const free = [];
    for (let z = z0; z <= z1; z += 1) for (let x = x0; x <= x1; x += 1) if (!isSolid(chars[z][x])) free.push(`${x},${z}`);
    const reached = floodCells(new Set(free), landing);
    assert.equal(reached.size, free.length,
      `${mission.code} slab ${JSON.stringify(slab)} must be fully walkable from its stair landing (${reached.size}/${free.length})`);
  });

  // 3. As escadarias são maciças e bloqueiam a própria célula — TODAS ao mesmo
  //    tempo. Validar uma a uma esconde o corte que só aparece em conjunto.
  const stairKeys = new Set(mission.upper.stairs.map(([x, z]) => `${x},${z}`));
  const groundReach = floodFill(mission.grid, findMarker(mission.grid, 'S'), stairKeys);
  for (const marker of ['A', 'B', 'C', 'E']) {
    assert.ok(groundReach.has(findMarker(mission.grid, marker).join(',')),
      `${mission.code} ground route to ${marker} must survive ALL staircases blocking their cells`);
  }
  // 4. O pé de cada escada continua acessível — escada que ninguém alcança é
  //    escada que não existe.
  mission.upper.stairs.forEach(([x, z], index) => {
    const direction = stairDirection(cells, chars, x, z);
    const foot = `${x - direction[0]},${z - direction[1]}`;
    assert.ok(groundReach.has(foot),
      `${mission.code} stair ${index} foot ${foot} must stay reachable from the spawn`);
  });
  // 5. Guardas de cima nascem em célula de laje pisável.
  for (const [x, z] of mission.upper.guards) {
    assert.ok(cells.has(`${x},${z}`) && !isSolid(chars[z][x]),
      `${mission.code} upper guard (${x},${z}) must spawn on a slab cell`);
  }
}

// ---------------------------------------------------------------------------
// FLOOR-AUDIT (rebaixado do E2E "every operation has a second floor", 900s):
// para cada missão, constrói a física REAL do mezanino (addUpperFloor — a
// mesma função que o jogo chama) e prova, com a MESMA sonda de auditoria do
// jogo (physics.probe), que nenhuma célula do mezanino é ilha (orphanUpper)
// e nenhuma deixa o jogador sem saída (trapped). upper-floor.js e
// engine/physics.js já estão importados acima; nenhum módulo novo entra.
// ---------------------------------------------------------------------------
for (const mission of MISSIONS) {
  const world = buildFloorWorld(mission);
  const materials = floorMaterials();
  const floorPhysics = await createPhysics();
  const group = new THREE.Group();
  const upper = addUpperFloor(group, floorPhysics, mission, world, materials);
  assert.ok(upper.cells.size > 8, `${mission.code} slab cells > 8`);

  const feetY = CONFIG.floorHeight;
  const passable = (from, to) => {
    const a = world.toWorld(from);
    const b = world.toWorld(to);
    for (let i = 0; i <= 8; i += 1) {
      const t = i / 8;
      const x = a.x + (b.x - a.x) * t;
      const z = a.z + (b.z - a.z) * t;
      const y = floorPhysics.supportHeight(x, z, feetY) + 1;
      if (floorPhysics.probe(x, y, z)) return false;
    }
    return true;
  };
  const NEIGHBOURS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  const reach = (start) => {
    const seen = new Set([`${start.x},${start.z}`]);
    const queue = [start];
    while (queue.length) {
      const current = queue.shift();
      for (const [dx, dz] of NEIGHBOURS) {
        const next = { x: current.x + dx, z: current.z + dz };
        const key = `${next.x},${next.z}`;
        if (seen.has(key) || !upper.cells.has(key) || isSolid(world.chars[next.z]?.[next.x])) continue;
        if (!passable(current, next)) continue;
        seen.add(key);
        queue.push(next);
      }
    }
    return seen;
  };

  const upperSeen = new Set();
  for (const stair of upper.stairs) {
    const [dx, dz] = stair.direction;
    const landing = { x: stair.cell.x + dx, z: stair.cell.z + dz };
    assert.ok(upper.cells.has(`${landing.x},${landing.z}`),
      `${mission.code}: stair ${stair.cell.x},${stair.cell.z} must land on a slab cell`);
    for (const key of reach(landing)) upperSeen.add(key);
  }
  const walkableUpper = [...upper.cells].filter((key) => {
    const [x, z] = key.split(',').map(Number);
    return !isSolid(world.chars[z]?.[x]);
  });
  const orphanUpper = walkableUpper.filter((key) => !upperSeen.has(key));
  assert.deepEqual(orphanUpper, [], `${mission.code}: mezzanine cells unreachable from any stair`);

  // "Parado aqui, o jogador consegue sair em alguma das 8 direções?" — a
  // mesma sonda que flagrou o bug que prendeu o operador.
  const ESCAPES = [[1, 0], [-1, 0], [0, 1], [0, -1], [0.7, 0.7], [-0.7, 0.7], [0.7, -0.7], [-0.7, -0.7]];
  const trapped = [];
  for (const key of upperSeen) {
    const [x, z] = key.split(',').map(Number);
    const point = world.toWorld({ x, z });
    const y = floorPhysics.supportHeight(point.x, point.z, feetY) + 1;
    if (!ESCAPES.some(([ex, ez]) => !floorPhysics.probe(point.x + ex * 0.4, y, point.z + ez * 0.4))) {
      trapped.push(`${x},${z}`);
    }
  }
  assert.deepEqual(trapped, [], `${mission.code}: mezzanine cell with no escape direction (player trap)`);
}

// O degrau da escadaria tem de ser vencível pelo passo automático do jogador.
assert.ok(CONFIG.floorHeight / STAIR_STEPS < 0.62,
  'stair rise must stay below the auto step-up threshold');

// Loadout de 5 slots: 1 faca · 2 Desert Eagle · 3 AK-47 · 4 lança-granadas · 5 granada.
const EXPECTED_SLOTS = { knife: 1, deagle: 2, ak47: 3, rpg: 4, grenade: 5 };
assert.deepEqual(
  Object.fromEntries(Object.entries(WEAPONS).map(([id, weapon]) => [id, weapon.slot])),
  EXPECTED_SLOTS,
  'weapon slots must match the 5-slot loadout',
);
const ammo = freshAmmo();
for (const [id, weapon] of Object.entries(WEAPONS)) {
  assert.equal(ammo[id].mag, weapon.mag, `${id} starting mag`);
  assert.ok(weapon.cadence > 0 && weapon.noise > 0, `${id} cadence/noise`);
  // Armas explosivas não causam dano direto: o estrago vem do raio da explosão.
  if (weapon.kind === 'launcher' || weapon.kind === 'throwable') {
    assert.ok(weapon.blastRadius > 0, `${id} must define a blast radius`);
    assert.equal(weapon.mag, Infinity, `${id} must have unlimited ammo`);
  } else {
    assert.ok(weapon.damage > 0, `${id} must deal direct damage`);
  }
}
// O lança-granadas é limitado só pela cadência de 2 s.
assert.equal(WEAPONS.rpg.cadence, 2, 'launcher fires once every 2s');
assert.equal(WEAPONS.knife.kind, 'melee', 'knife is a melee weapon');
assert.ok(WEAPONS.knife.range > 0 && WEAPONS.knife.range < 4, 'knife is short range');

// Assinatura sonora por classe (engine/audio.js): pistola e rifle têm timbres
// distintos — estalo agudo + boom seco vs. soco médio + clack de ferrolho.
assert.equal(WEAPONS.deagle.sound, 'pistol', 'Desert Eagle usa o perfil de pistola');
assert.equal(WEAPONS.ak47.sound, 'rifle', 'AK-47 usa o perfil de rifle');

// --- Pulo vence obstáculo baixo (relatado do operador) ----------------------
// O parapeito de 1,05 m (mezanino/telhado/torre) e engradados baixos viravam
// jaula — na torre não havia como descer. O ápice do pulo tem de cobrir a
// folga que o teste de coluna de physics.collides exige (pés >= topo - 0,08).
const JUMP_APEX = CONFIG.jumpSpeed ** 2 / (2 * CONFIG.gravity);
assert.ok(JUMP_APEX >= 1.05 + 0.1, `pulo tem de vencer o parapeito de 1,05 m (ápice ${JUMP_APEX.toFixed(2)} m)`);
// E a física tem de deixar a coluna do obstáculo ser atravessada no ápice:
const jumpPhysics = await createPhysics();
jumpPhysics.addBox(0, 0.525, 0, 0.09, 0.525, 1.8); // parapeito de 1,05 m
jumpPhysics.addPlatform(0, 0, 6, 6, 0); // chão
jumpPhysics.createPlayer({ x: -0.9, y: 1, z: 0 });
for (let i = 0; i < 40; i += 1) jumpPhysics.movePlayer({ x: 0.05, y: -0.12, z: 0 });
assert.ok(jumpPhysics.position().x < -0.3, 'sem pulo o parapeito segura o jogador');
jumpPhysics.createPlayer({ x: -0.9, y: 2.1, z: 0 }); // pés a 1,1 m = dentro do ápice
for (let i = 0; i < 60; i += 1) jumpPhysics.movePlayer({ x: 0.05, y: -0.005, z: 0 });
assert.ok(jumpPhysics.position().x > 0.3, 'no ápice do pulo o jogador cruza o parapeito');

// --- Reforço de asa-delta (F3 visual) ---------------------------------------
const { buildHangGlider, GLIDER_DURATION } = await import('../../james-bond/src/ai/hang-glider.js');
const glider = buildHangGlider();
let gliderMeshes = 0;
glider.traverse((part) => {
  if (!part.isMesh) return;
  gliderMeshes += 1;
  assert.ok(part.userData.noRay, 'pedaço da asa-delta fora do raycast de tiro');
});
assert.ok(gliderMeshes >= 6, 'asa-delta tem vela + armação');
// A chegada não pode se sobrepor à próxima: pousa antes do intervalo de spawn.
assert.ok(GLIDER_DURATION < spawnIntervalSeconds(DEFAULT_SPAWN_RATE), 'asa pousa antes do próximo reforço');

// F2 — alcance de mapa inteiro: o raycast do tiro (combat.js fireRay) usa
// `weapon.range`, não mais um corte fixo de 90 m que truncava a rua principal
// (diagonal do maior quarteirão medida em ~139 m) antes de alcançar a outra
// ponta. Só as duas armas hitscan (pistola/rifle) precisam disso.
for (const id of ['deagle', 'ak47']) {
  assert.ok(WEAPONS[id].range >= 140, `${id} precisa de alcance de mapa inteiro (>=140m), tem ${WEAPONS[id].range}`);
}

// BUG (relatado): mudar de fase portando a AK-47 deixava o jogador com
// APARÊNCIA de pistola e COMPORTAMENTO de metralhadora — `resetRun` zerava
// tudo menos a arma, enquanto o view-model era reconstruído sempre na pistola.
game.currentWeapon = 'ak47';
resetRun();
assert.equal(game.currentWeapon, STARTING_WEAPON,
  'começar uma missão tem de repor a arma inicial, senão aparência e comportamento divergem');
assert.ok(WEAPONS[STARTING_WEAPON], 'a arma inicial existe no arsenal');

const first = createRandom(hashSeed('OP-01'));
const second = createRandom(hashSeed('OP-01'));
for (let i = 0; i < 20; i += 1) assert.equal(first(), second(), 'seeded random is deterministic');

const physics = await createPhysics();
physics.addBox(2, 1.5, 0, 0.5, 1.5, 2);
physics.createPlayer({ x: 0, y: 1, z: 0 });
physics.movePlayer({ x: 2, y: 0, z: 0 });
assert.equal(physics.position().x, 0, 'player must not cross a wall');
physics.movePlayer({ x: 0, y: 0, z: 1 });
assert.equal(physics.position().z, 1, 'player must move along a free axis');

// Andares: uma laje elevada sustenta o jogador em vez de deixá-lo cair ao chão.
const floors = await createPhysics();
floors.addPlatform(0, 0, 6, 6, 0);
floors.addPlatform(0, 0, 3, 3, 3.4);
assert.equal(floors.supportHeight(0, 0, 4), 3.4, 'upper slab supports a player above it');
assert.equal(floors.supportHeight(0, 0, 0), 0, 'a slab far overhead is a ceiling, not a floor');
assert.equal(floors.supportHeight(5, 5, 0), 0, 'outside the upper slab the ground carries');
floors.createPlayer({ x: 0, y: 4.4, z: 0 });
floors.movePlayer({ x: 0, y: -8, z: 0 });
assert.equal(floors.position().y, 4.4, 'player lands on the upper slab, not the ground');

// Regressão do bug "caí dentro da parede": quem sai da laje sobre uma parede
// aterrissa NO TOPO dela (estrutura sólida é pisável), nunca dentro do volume.
const wallTop = await createPhysics();
wallTop.addPlatform(0, 0, 1.8, 1.8, 3.55);            // laje
wallTop.addBox(3.6, 1.575, 0, 1.8, 1.575, 1.8);       // parede vizinha, topo 3.15
wallTop.createPlayer({ x: 1.5, y: 4.55, z: 0 });
for (let i = 0; i < 100; i += 1) wallTop.movePlayer({ x: 0.03, y: -0.12, z: 0 });
assert.ok(Math.abs(wallTop.position().y - 4.15) < 0.01,
  `player must land on the wall top (feet 3.15), got y=${wallTop.position().y}`);
assert.ok(wallTop.position().x > 3.0, 'player keeps walking on top of the wall');

// Escadaria diagonal: degraus-plataforma vencidos pelo passo automático — o
// jogador ANDA até o topo, sem pulo e sem volume de escada vertical.
// Os degraus são MACIÇOS (`baseY = 0`), como no jogo.
const stairs = await createPhysics();
const rise = CONFIG.floorHeight / STAIR_STEPS;
const run = CONFIG.cellSize / STAIR_STEPS;
for (let i = 0; i < STAIR_STEPS; i += 1) {
  stairs.addPlatform(-1.8 + (i + 0.5) * run, 0, run / 2, 1.8, rise * (i + 1), 0);
}
stairs.addPlatform(0, 0, 60, 60, 0);                  // térreo
assert.ok(rise < 0.62, 'stair rise must fit the auto step-up');
stairs.createPlayer({ x: -2.6, y: 1, z: 0 });
for (let i = 0; i < 170; i += 1) stairs.movePlayer({ x: 0.025, y: -0.12, z: 0 });
assert.ok(Math.abs(stairs.position().y - (CONFIG.floorHeight + 1)) < 0.01,
  `walking up the staircase must reach the top (got y=${stairs.position().y})`);

// REGRESSÃO DO BUG QUE PRENDEU O OPERADOR: vindo do lado alto, o jogador tem
// de parar ANTES da escadaria (footprint -1.8..1.8) — não penetrar nela.
// A versão anterior deste teste aceitava x > 0.9, ou seja, ASSUMIA o jogador
// já dentro do maciço: passava com o bug presente.
stairs.createPlayer({ x: 3.2, y: 1, z: 0 });
for (let i = 0; i < 200; i += 1) stairs.movePlayer({ x: -0.03, y: -0.12, z: 0 });
assert.ok(stairs.position().x > 2.1,
  `solid staircase must block entry from the tall side — player must not penetrate the footprint (got x=${stairs.position().x})`);
assert.ok(Math.abs(stairs.position().y - 1) < 0.01,
  `blocked player stays on the ground, never wedged inside the stair (got y=${stairs.position().y})`);

// Laje FLUTUANTE (base alta) continua deixando passar por baixo — é o que
// distingue um mezanino de um maciço.
const under = await createPhysics();
under.addPlatform(0, 0, 60, 60, 0);
under.addPlatform(0, 0, 5.4, 5.4, CONFIG.floorHeight, CONFIG.floorHeight - CONFIG.slabThickness);
under.createPlayer({ x: -7, y: 1, z: 0 });
for (let i = 0; i < 200; i += 1) under.movePlayer({ x: 0.05, y: -0.12, z: 0 });
assert.ok(under.position().x > 2, `player must walk under a floating slab (got x=${under.position().x})`);
assert.equal(under.position().y, 1, 'walking under a slab keeps the player on the ground');

// ---------------------------------------------------------------------------
// BUGS DE GRANADA NO SEGUNDO ANDAR (relatados pelo operador)
//
// Todos os três nascem da mesma causa: a colisão do projétil era um teste de
// CÉLULA em 2D (`world.walkable`), que não enxerga altura nenhuma.
// ---------------------------------------------------------------------------
const ballistic = await createPhysics();
ballistic.addPlatform(0, 0, 60, 60, 0);                                   // térreo
// Mezanino em x ∈ [-5.4, 5.4], z ∈ [-5.4, 5.4] — laje flutuante como no jogo.
ballistic.addPlatform(0, 0, 5.4, 5.4, CONFIG.floorHeight, CONFIG.floorHeight - CONFIG.slabThickness);
// Parede do TÉRREO ao lado da laje: topo em 3.15, bem abaixo do mezanino.
ballistic.addBox(9, CONFIG.wallHeight / 2, 0, 1.8, CONFIG.wallHeight / 2, 1.8);

assert.equal(ballistic.solidAt(9, 1.5, 0, 0.14), true, 'a parede é sólida na altura dela');
assert.equal(ballistic.solidAt(9, 5, 0, 0.14), false,
  'BUG "parede invisível": acima do topo da parede (3.15 m) NÃO pode haver sólido');
assert.equal(ballistic.surfaceBelow(0, 0, 6), CONFIG.floorHeight,
  'caindo de cima, a laje do mezanino é o chão');
assert.equal(ballistic.surfaceBelow(0, 0, 2), 0,
  'caindo por baixo da laje, o chão é o térreo');

const drop = (start, velocity, steps = 400) => {
  const projectile = { position: { ...start }, velocity: { ...velocity }, radius: 0.14, gravity: 12 };
  let hits = 0;
  for (let i = 0; i < steps; i += 1) {
    if (stepProjectile(projectile, 1 / 60, ballistic).hitSolid) hits += 1;
  }
  return { ...projectile.position, hits };
};

// 1. Granada largada SOBRE o mezanino tem de PARAR nele, não atravessar o piso.
const onSlab = drop({ x: 0, y: CONFIG.floorHeight + 1.6, z: 0 }, { x: 0, y: 0, z: 0 });
assert.ok(Math.abs(onSlab.y - (CONFIG.floorHeight + 0.14)) < 0.02,
  `granada tem de repousar SOBRE a laje do segundo andar (y=${onSlab.y})`);

// 2. Arremessada do mezanino por cima da parede do térreo, ela passa por cima:
//    nada de quicar numa parede invisível a 5 m de altura.
const overWall = drop({ x: 0, y: CONFIG.floorHeight + 1.6, z: 0 }, { x: 14, y: 1.2, z: 0 });
assert.equal(overWall.hits, 0, 'granada acima do topo da parede não pode colidir com ela');
assert.ok(overWall.x > 9, `granada tem de passar POR CIMA da parede do térreo (x=${overWall.x})`);
assert.ok(overWall.y < 1, `e cair no térreo do outro lado (y=${overWall.y})`);

// 3. Do mezanino, arremessar para FORA da laje bombardeia o térreo lá embaixo.
const downstairs = drop({ x: 0, y: CONFIG.floorHeight + 1.6, z: 0 }, { x: 7, y: -1, z: 0 });
assert.ok(downstairs.y < 0.3, `granada arremessada para fora da laje cai no térreo (y=${downstairs.y})`);

// 4. FOGUETE do lança-granadas: ao contrário da granada, ele não quica — o
//    primeiro contato (parede ou chão) é a detonação. Aqui isso é verificado
//    de forma DETERMINÍSTICA, sem navegador: no browser o mesmo cenário
//    depende do relógio, e o tempo de jogo em headless varia com a carga da
//    máquina (foi o que tornou o smoke do foguete instável).
const fireRocket = (start, velocity) => {
  const projectile = {
    position: { ...start }, velocity: { ...velocity },
    radius: 0.09, gravity: 3.4, restitution: 0, friction: 0.82,
  };
  for (let i = 0; i < 600; i += 1) {
    const step = stepProjectile(projectile, 1 / 60, ballistic);
    // Mesma condição de explosives.js: parede OU chão detonam o foguete.
    if (step.hitSolid || step.landed) {
      return { passos: i + 1, motivo: step.hitSolid ? 'parede' : 'chao', ...projectile.position };
    }
  }
  return null;
};

// Disparado na horizontal contra a parede do térreo: detona NELA.
const naParede = fireRocket({ x: 0, y: 1.6, z: 0 }, { x: 34, y: 0, z: 0 });
assert.ok(naParede, 'foguete horizontal tem de detonar');
assert.equal(naParede.motivo, 'parede', `foguete detona na parede (foi: ${naParede?.motivo})`);
assert.ok(naParede.x < 9, `e do lado de FORA dela, não dentro (x=${naParede.x})`);

// Disparado para baixo: detona no chão, e depressa.
const noChao = fireRocket({ x: 0, y: 1.6, z: 0 }, { x: 12, y: -18, z: 0 });
assert.ok(noChao && noChao.motivo === 'chao', 'foguete apontado para baixo detona no chão');
assert.ok(noChao.passos < 20, `e em poucos quadros (foram ${noChao?.passos})`);

// 5. Andando por baixo do mezanino, a granada NÃO pode grudar no teto: ela
//    sobe, bate na base da laje e volta para o chão.
const belowSlab = drop({ x: 0, y: 1.2, z: 0 }, { x: 0, y: 6, z: 0 });
assert.ok(belowSlab.y < 0.3, `granada lançada para cima sob a laje volta ao chão (y=${belowSlab.y})`);

// ---------------------------------------------------------------------------
// F1 — SENSIBILIDADE DO MOUSE
// ---------------------------------------------------------------------------
assert.equal(clampSensitivity(1), 1, 'valor dentro da faixa passa direto');
assert.equal(clampSensitivity(SENSITIVITY.min - 1), SENSITIVITY.min, 'abaixo do mínimo trava no mínimo');
assert.equal(clampSensitivity(SENSITIVITY.max + 5), SENSITIVITY.max, 'acima do máximo trava no máximo');
assert.equal(clampSensitivity(NaN), SENSITIVITY.default, 'NaN cai no padrão');
assert.equal(clampSensitivity(undefined), SENSITIVITY.default, 'ausente (save antigo) cai no padrão');
assert.equal(clampSensitivity('2.5'), 2.5, 'string numérica (valor de <input type=range>) é aceita');
assert.ok(SENSITIVITY.default >= SENSITIVITY.min && SENSITIVITY.default <= SENSITIVITY.max,
  'o padrão tem de estar dentro da própria faixa');

// ---------------------------------------------------------------------------
// MODO CRIANÇA — cone de mira (rebaixado do E2E "kids mode locks the aim
// into a narrow forward cone"). A fórmula é a mesma de engine/input.js
// setKidsMode(), reproduzida aqui sobre as constantes puras de config.js
// (KIDS/LOOK) — input.js não entra porque abre PointerLockControls sobre
// `document` no próprio construtor.
// ---------------------------------------------------------------------------
const kidsMin = Math.PI / 2 - (KIDS.pitchUpDeg * Math.PI) / 180;
const kidsMax = Math.PI / 2 + (KIDS.pitchDownDeg * Math.PI) / 180;
const kidsSpan = kidsMax - kidsMin;
const normalSpan = LOOK.maxPolarAngle - LOOK.minPolarAngle;
assert.ok(kidsSpan < normalSpan, 'kids cone must be narrower than the normal look range');
assert.ok(kidsSpan < Math.PI / 2, 'kids cone must stay under a quarter turn total');
assert.ok(kidsMin < Math.PI / 2 && kidsMax > Math.PI / 2, 'kids cone stays centered on the horizon');

// ---------------------------------------------------------------------------
// F2 — PRECISÃO DE PRIMEIRO TIRO (modelo de espalhamento)
// ---------------------------------------------------------------------------
const gun = { spread: 0.01 };
assert.equal(isPrecisionShot(Infinity, gun), true, 'primeiro tiro de uma missão nova é sempre preciso');
assert.equal(isPrecisionShot(0, gun), false, 'tiro imediatamente em seguida do anterior não é preciso');
assert.equal(isPrecisionShot(CONFIG.firstShotWindow, gun), true, 'no limiar exato já conta como preciso');
assert.equal(isPrecisionShot(CONFIG.firstShotWindow - 0.01, gun), false, 'um instante antes do limiar ainda não conta');
assert.equal(isPrecisionShot(1, { spread: 0.01, firstShotWindow: 2 }), false,
  'arma pode declarar sua própria janela, sobrepondo o padrão global');

const bloomedSpread = computeSpread(gun, { bloom: 2, moveFactor: 1, crouchFactor: 1, adsFactor: 1, precise: false });
const preciseSpread = computeSpread(gun, { bloom: 2, moveFactor: 1, crouchFactor: 1, adsFactor: 1, precise: true });
assert.ok(preciseSpread < bloomedSpread * 0.2,
  `tiro preciso tem de espalhar bem menos que rajada aquecida (preciso=${preciseSpread}, aquecido=${bloomedSpread})`);
assert.ok(preciseSpread < gun.spread,
  'mesmo o espalhamento BASE da arma (bloom=0) é maior que o do tiro preciso');
assert.equal(computeSpread(gun, {}), gun.spread, 'sem estado nenhum informado, cai no espalhamento base da arma');
// Movimento/agachamento/ADS continuam valendo por cima do bônus de precisão —
// só o multiplicador de aquecimento (bloom) é ignorado.
const preciseMoving = computeSpread(gun, { precise: true, moveFactor: 2 });
const preciseStill = computeSpread(gun, { precise: true, moveFactor: 1 });
assert.ok(preciseMoving > preciseStill, 'tiro preciso em movimento ainda espalha mais que parado');

// ---------------------------------------------------------------------------
// F3 — REFORÇO CONTÍNUO (agendamento + escolha de célula, puro)
// ---------------------------------------------------------------------------
assert.equal(spawnIntervalSeconds(5), 12, '5 reforços/minuto = um a cada 12s');
assert.equal(spawnIntervalSeconds(60), 1, '60/min = um por segundo');
assert.equal(spawnIntervalSeconds(0), Infinity, 'taxa zero nunca dispara');
assert.equal(spawnIntervalSeconds(-3), Infinity, 'taxa negativa nunca dispara');
assert.equal(spawnIntervalSeconds(undefined), Infinity, 'taxa ausente nunca dispara');

const scheduler = createSpawnScheduler(60); // 1 por segundo — fácil de raciocinar
assert.equal(scheduler.tick(0.5), false, 'meio segundo não completa o intervalo de 1s');
assert.equal(scheduler.tick(0.5), true, 'somado, 1s completa o intervalo');
scheduler.schedule(60);
assert.ok(scheduler.remaining > 0.99 && scheduler.remaining <= 1, 'schedule() reagenda o intervalo cheio');
scheduler.retry(0.25);
assert.equal(scheduler.remaining, 0.25, 'retry() agenda uma nova tentativa curta, não o intervalo cheio');
// Relógio de JOGO: nunca setTimeout — a única forma de o tempo passar aqui é
// chamando tick(dt) explicitamente, exatamente como main.js chama fixedUpdate.
assert.equal(typeof scheduler.tick, 'function');

const farVisible = { x: 0, z: 0, interior: false, edgeDistance: 10, distanceToPlayer: 50, visible: true };
const farHidden = { x: 1, z: 1, interior: false, edgeDistance: 10, distanceToPlayer: 50, visible: false };
const nearHidden = { x: 2, z: 2, interior: false, edgeDistance: 10, distanceToPlayer: 5, visible: false };
const interiorHidden = { x: 3, z: 3, interior: true, edgeDistance: 1, distanceToPlayer: 40, visible: false };
assert.equal(pickSpawnCell([], () => 0), null, 'sem candidatas, não há onde nascer');
assert.equal(pickSpawnCell([farVisible], () => 0), farVisible,
  'única candidata, mesmo visível: o spawner nunca trava por falta de opção perfeita');
const picked = pickSpawnCell([farVisible, nearHidden, interiorHidden], () => 0);
assert.notEqual(picked, farVisible, 'candidata VISÍVEL nunca é escolhida quando há alternativa fora de LOS');
assert.ok(picked === nearHidden || picked === interiorHidden, 'a escolha fica entre as candidatas fora de LOS');
// Interior de construção pontua mais que borda simples a igual distância —
// prefere nascer "dentro" quando as demais condições empatam.
const edgeHidden = { x: 4, z: 4, interior: false, edgeDistance: 0, distanceToPlayer: 40, visible: false };
const insideHidden = { x: 5, z: 5, interior: true, edgeDistance: 10, distanceToPlayer: 40, visible: false };
assert.equal(pickSpawnCell([edgeHidden, insideHidden], () => 0), insideHidden,
  'a preferência por interior de construção pesa na pontuação');
assert.ok(SPAWN_MIN_DISTANCE > 0, 'distância mínima do jogador é positiva');

assert.equal(groundPoolSize(12, 16), 16 + 3, 'pool cobre o maior entre guarnição e teto, mais a folga de margem');
assert.equal(groundPoolSize(20, 16), 20 + 3, 'guarnição maior que o teto ainda dá folga de margem');

assert.deepEqual(validateSpawnConfig({ spawnRate: 5, maxAlive: 16 }), [], 'config válida não reporta erro');
assert.ok(validateSpawnConfig({ spawnRate: 0, maxAlive: 16 }).length > 0, 'taxa zero é inválida');
assert.ok(validateSpawnConfig({ spawnRate: 5, maxAlive: 0 }).length > 0, 'teto zero é inválido');
assert.ok(validateSpawnConfig({ spawnRate: 5, maxAlive: 3.5 }).length > 0, 'teto tem de ser inteiro');
assert.ok(validateSpawnConfig({ spawnRate: -1, maxAlive: 16 }).length > 0, 'taxa negativa é inválida');
assert.ok(DEFAULT_SPAWN_RATE > 0 && DEFAULT_MAX_ALIVE > 0, 'os padrões (usados quando a missão omite o campo) são válidos');

// ---------------------------------------------------------------------------
// F3 — INVARIANTES DO POOL DO SPAWNER (rebaixado do E2E "reinforcement
// spawner backfills kills up to the mission cap without leaking rigs"):
// mata metade da guarnição, avança o relógio de reforço e prova que o teto
// nunca é furado e que o pool (guarnição + margem) nunca CRESCE — apenas os
// primitivos puros de gameplay/spawner.js entram, sem ai/guards.js (que
// depende da cena THREE dos rigs).
// ---------------------------------------------------------------------------
{
  const mission = MISSIONS[0];
  const groundGuardCount = mission.grid.join('').split('').filter((char) => char === 'G').length;
  const initialGroundCount = groundGuardCount; // reforço só nasce no térreo (ai/guards.js)
  const poolSize = groundPoolSize(initialGroundCount, mission.maxAlive);
  let alive = Math.min(mission.maxAlive, groundGuardCount + (mission.upper.guards || []).length);
  let spawns = 0;
  const scheduler = createSpawnScheduler(mission.spawnRate);

  // Mata metade da guarnição: abre espaço para o spawner repor.
  const killed = Math.floor(alive / 2);
  alive -= killed;

  const step = spawnIntervalSeconds(mission.spawnRate) / 4;
  for (let i = 0; i < 400; i += 1) {
    if (scheduler.tick(step)) {
      if (alive < mission.maxAlive) { alive += 1; spawns += 1; scheduler.schedule(mission.spawnRate); } else scheduler.retry();
    }
    assert.ok(alive <= mission.maxAlive, `${mission.code}: alive must never exceed maxAlive while stepping`);
  }
  assert.ok(spawns > 0, `${mission.code}: the spawner must have produced at least one reinforcement`);
  assert.equal(groundPoolSize(initialGroundCount, mission.maxAlive), poolSize,
    `${mission.code}: pool size is a fixed function of garrison+cap — it never grows with spawns`);
}

// ---------------------------------------------------------------------------
// M2 — TORRE DE VIGIA: queda do parapeito (rebaixado do E2E "watchtower
// parapet is jumpable"). O pulo por cima de um obstáculo de 1,05 m (mesma
// altura do parapeito — PARAPET_HEIGHT em upper-floor.js) já foi provado
// genericamente acima (JUMP_APEX); este teste isola o que resta puramente
// físico: caindo do alto da torre, a gravidade tem de assentar o jogador no
// térreo — nunca preso a meio caminho por uma superfície fantasma.
// ---------------------------------------------------------------------------
{
  const mission = MISSIONS[0];
  const world = buildFloorWorld(mission);
  const materials = floorMaterials();
  const towerPhysics = await createPhysics();
  towerPhysics.addPlatform(0, 0, 400, 400, 0); // térreo — o piso que buildGroundFloor cobriria
  const group = new THREE.Group();
  const tower = addTower(group, towerPhysics, mission, world, materials);
  assert.ok(tower, `${mission.code} must declare a watchtower`);

  // Posição já além do parapeito (o "depois de pular"), na altura do topo.
  towerPhysics.createPlayer({ x: tower.top.x + CONFIG.cellSize, y: tower.top.y + 1, z: tower.top.z });
  for (let i = 0; i < 300; i += 1) towerPhysics.movePlayer({ x: 0, y: -0.12, z: 0 });
  const landed = towerPhysics.position();
  assert.ok(Math.abs(landed.y - 1) < 0.01, `player must land at street level, got y=${landed.y}`);
  // "Grounded" na física deste jogo é repousar EXATAMENTE sobre o suporte
  // calculado, não flutuar em queda ainda não resolvida.
  assert.equal(towerPhysics.supportHeight(landed.x, landed.z, landed.y - 1) + 1, landed.y,
    'landed position must rest exactly on the computed ground support');
}

console.log(`James Bond unit checks passed: ${MISSIONS.length} missions, ${Object.keys(WEAPONS).length} weapons`);

function findMarker(grid, marker) {
  const z = grid.findIndex((row) => row.includes(marker));
  return [grid[z].indexOf(marker), z];
}

/** Flood fill dentro de um conjunto de células (usado para a laje). */
function floodCells(cells, start) {
  const seen = new Set([`${start.x},${start.z}`]);
  const queue = [start];
  while (queue.length) {
    const current = queue.shift();
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const key = `${current.x + dx},${current.z + dz}`;
      if (seen.has(key) || !cells.has(key)) continue;
      seen.add(key);
      queue.push({ x: current.x + dx, z: current.z + dz });
    }
  }
  return seen;
}

function floodFill(grid, start, blocked = new Set()) {
  const seen = new Set([start.join(',')]);
  const queue = [start];
  while (queue.length) {
    const [x, z] = queue.shift();
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const next = [x + dx, z + dz];
      const key = next.join(',');
      const tile = grid[next[1]]?.[next[0]];
      if (tile && !isSolid(tile) && !seen.has(key) && !blocked.has(key)) { seen.add(key); queue.push(next); }
    }
  }
  return seen;
}
