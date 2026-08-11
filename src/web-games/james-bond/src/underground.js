import * as THREE from '../../vendor/three.module.min.js';
import { CONFIG } from './config.js';
import { slabCells, stairDirection, STAIR_STEPS } from './upper-floor.js';

// M3 — esgoto/passagem subterrânea: nível ABAIXO da rua, ligado por 2-3 bocas
// de visita (escada descendo). O TETO da passagem é o próprio piso da rua —
// inalterado, exceto exatamente nas células de entrada, que perdem a laje
// térrea (ver `undergroundEntranceCells`/world.js) e ganham uma escadaria
// DESCENDENTE em seu lugar. Inimigos NÃO patrulham aqui (nav-graph.js
// continua só térreo+mezanino) — a passagem é 100% opcional para o jogador.
//
//   underground: {
//     slabs:     [[x0, z0, x1, z1], ...],  // footprint da passagem (mesmo
//                                          // sistema de coordenadas do chão)
//     entrances: [[x, z], ...],            // boca de visita — célula do
//                                          // TÉRREO, fora de `slabs`, com
//                                          // saída livre nos dois lados
//   }
//
// `stairDirection`/`slabCells` do mezanino são reaproveitados tal-e-qual: a
// regra "célula externa, chão livre, saída pisável de um lado" é idêntica —
// só o "andar de cima" delas é, aqui, a própria passagem subterrânea.

/** Conjunto de células que a passagem PUNCIONA no piso térreo (bocas de
 * visita) — usado por world.js para excluir essas células da laje única do
 * chão ANTES de construir o piso (ver `buildGroundFloor`). */
export function undergroundEntranceCells(mission) {
  const holes = new Set();
  for (const [x, z] of mission.underground?.entrances || []) holes.add(`${x},${z}`);
  return holes;
}

/**
 * Colisores dos degraus DESCENDENTES: mesmo princípio maciço dos degraus do
 * mezanino (nada de vão por baixo/dentro), só espelhado — o bloco vai do
 * FUNDO da escavação (`-depth`, constante) até o degrau em si, que fica cada
 * vez mais FUNDO conforme `i` cresce (o oposto da subida, que fica mais ALTA).
 */
function addDescentPhysics(physics, position, [dx, dz], depth, half) {
  const rise = depth / STAIR_STEPS;
  const run = CONFIG.cellSize / STAIR_STEPS;
  for (let i = 0; i < STAIR_STEPS; i += 1) {
    const along = -half + (i + 0.5) * run;
    const cx = position.x + dx * along;
    const cz = position.z + dz * along;
    const hx = dx ? run / 2 : half;
    const hz = dz ? run / 2 : half;
    const topY = -rise * (i + 1);
    physics.addPlatform(cx, cz, hx, hz, topY, -depth);
  }
}

/** Escadaria descendente sólida — desenho espelhado de `buildStaircase`. */
function buildDescent([dx, dz], depth, materials) {
  const group = new THREE.Group();
  const material = materials.trim;
  const rise = depth / STAIR_STEPS;
  const run = CONFIG.cellSize / STAIR_STEPS;
  const half = CONFIG.cellSize / 2;
  for (let i = 0; i < STAIR_STEPS; i += 1) {
    const topY = -rise * (i + 1);
    const height = topY + depth; // = depth - rise*(i+1)
    const width = dx ? run : CONFIG.cellSize;
    const depthDim = dz ? run : CONFIG.cellSize;
    const step = new THREE.Mesh(new THREE.BoxGeometry(width, height, depthDim), material);
    const along = -half + (i + 0.5) * run;
    step.position.set(dx * along, topY - height / 2, dz * along);
    step.castShadow = true;
    step.receiveShadow = true;
    group.add(step);
  }
  return group;
}

/** Painéis de contenção MACIÇOS (baseY..topY) nas bordas expostas de `cells`,
 * exceto as arestas em `mouths` (bocas de visita). Mesma técnica de
 * run-merge de `addParapets`, generalizada para altura total — a passagem
 * pode ter vários metros de parede, não um guarda-corpo curto. */
function addRetainingWalls(group, physics, world, cells, mouths, material, baseY, topY) {
  const neighbours = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  const runs = new Map();
  for (const key of cells) {
    const [x, z] = key.split(',').map(Number);
    for (const [dx, dz] of neighbours) {
      if (cells.has(`${x + dx},${z + dz}`)) continue;
      if (mouths.has(`${x},${z}|${dx},${dz}`)) continue;
      const line = dx !== 0 ? `${dx},0@${x}` : `0,${dz}@${z}`;
      if (!runs.has(line)) runs.set(line, { dx, dz, fixed: dx !== 0 ? x : z, along: [] });
      runs.get(line).along.push(dx !== 0 ? z : x);
    }
  }
  const height = topY - baseY;
  const thickness = 0.22;
  const panels = [];
  const half = CONFIG.cellSize / 2;
  for (const { dx, dz, fixed, along } of runs.values()) {
    along.sort((a, b) => a - b);
    let start = along[0];
    let previous = along[0];
    const flush = (from, to) => {
      const count = to - from + 1;
      const centreAlong = (from + to) / 2;
      const cell = dx !== 0 ? { x: fixed, z: centreAlong } : { x: centreAlong, z: fixed };
      const position = world.toWorld(cell);
      const edgeX = position.x + dx * (half - thickness / 2);
      const edgeZ = position.z + dz * (half - thickness / 2);
      const hx = dx !== 0 ? thickness / 2 : count * half;
      const hz = dz !== 0 ? thickness / 2 : count * half;
      panels.push({ x: edgeX, z: edgeZ, hx, hz });
      physics.addBox(edgeX, baseY + height / 2, edgeZ, hx, height / 2, hz);
    };
    for (let i = 1; i < along.length; i += 1) {
      if (along[i] === previous + 1) { previous = along[i]; continue; }
      flush(start, previous);
      start = along[i];
      previous = along[i];
    }
    flush(start, previous);
  }
  if (!panels.length) return;
  const geometry = new THREE.BoxGeometry(1, height, 1);
  const mesh = new THREE.InstancedMesh(geometry, material, panels.length);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  const dummy = new THREE.Object3D();
  panels.forEach((panel, i) => {
    dummy.position.set(panel.x, baseY + height / 2, panel.z);
    dummy.rotation.set(0, 0, 0);
    dummy.scale.set(panel.hx * 2, 1, panel.hz * 2);
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
  });
  mesh.instanceMatrix.needsUpdate = true;
  group.add(mesh);
}

/**
 * Constrói a passagem: piso afundado, paredes de contenção, tiras emissivas
 * (dentro do orçamento fixo de luz — NENHUMA THREE.Light nova, ver fx.js) e
 * as escadarias descendentes de cada boca de visita.
 * @returns {{cells:Set<string>, entrances:Array}}
 */
export function addUndergroundLevel(group, physics, mission, world, materials) {
  const underground = mission.underground;
  const empty = { cells: new Set(), entrances: [] };
  if (!underground?.slabs?.length) return empty;

  const cells = slabCells(underground);
  if (!cells.size) return empty;
  const depth = CONFIG.undergroundDepth;
  const half = CONFIG.cellSize / 2;
  const floorY = -depth;

  // --- Piso da passagem ------------------------------------------------------
  const floorGeometry = new THREE.BoxGeometry(CONFIG.cellSize, 0.1, CONFIG.cellSize);
  const floorMesh = new THREE.InstancedMesh(floorGeometry, materials.trim, cells.size);
  floorMesh.receiveShadow = true;
  const matrix = new THREE.Matrix4();
  let index = 0;
  for (const key of cells) {
    const [x, z] = key.split(',').map(Number);
    const position = world.toWorld({ x, z });
    matrix.makeTranslation(position.x, floorY - 0.05, position.z);
    floorMesh.setMatrixAt(index, matrix);
    physics.addPlatform(position.x, position.z, half, half, floorY);
    index += 1;
  }
  floorMesh.instanceMatrix.needsUpdate = true;
  group.add(floorMesh);

  // --- Paredes de contenção (a boca de cada entrada fica aberta) ------------
  const entranceCoords = (underground.entrances || []).map(([x, z]) => {
    const direction = stairDirection(cells, world.chars, x, z) || [1, 0];
    return { x, z, direction };
  });
  const mouths = new Set(entranceCoords.map(({ x, z, direction }) => {
    const [dx, dz] = direction;
    return `${x + dx},${z + dz}|${-dx},${-dz}`;
  }));
  addRetainingWalls(group, physics, world, cells, mouths, materials.trim, floorY, 0);

  // --- Iluminação dentro do orçamento fixo: tiras EMISSIVAS, nenhuma luz nova.
  // `materials.accent` já existe (materials.js) e já é emissiva — reaproveitado
  // sem clone, então nenhum material/programa novo entra na cena.
  const stripCells = [...cells].filter((_, i) => i % 3 === 0);
  if (stripCells.length) {
    const stripGeometry = new THREE.BoxGeometry(CONFIG.cellSize * 0.7, 0.05, 0.12);
    const strips = new THREE.InstancedMesh(stripGeometry, materials.accent, stripCells.length);
    stripCells.forEach((key, i) => {
      const [x, z] = key.split(',').map(Number);
      const position = world.toWorld({ x, z });
      matrix.makeTranslation(position.x, floorY + 2.15, position.z);
      strips.setMatrixAt(i, matrix);
    });
    strips.instanceMatrix.needsUpdate = true;
    group.add(strips);
  }

  // --- Escadarias descendentes (boca de visita) ------------------------------
  const entrances = entranceCoords.map(({ x, z, direction }) => {
    const position = world.toWorld({ x, z });
    const mesh = buildDescent(direction, depth, materials);
    mesh.position.set(position.x, 0, position.z);
    group.add(mesh);
    addDescentPhysics(physics, position, direction, depth, half);
    return { cell: { x, z }, position, direction, mesh };
  });

  return { cells, entrances };
}
