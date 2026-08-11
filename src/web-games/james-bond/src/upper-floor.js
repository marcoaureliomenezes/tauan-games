import * as THREE from '../../vendor/three.module.min.js';
import { CONFIG } from './config.js';
import { isSolid } from './content/tiles.js';

// Segundo andar: mezaninos e passarelas sobre o mapa térreo, no espírito dos
// mapas de CS 1.6 (sacadas, catwalks, salas altas) em vez de um labirinto
// inteiro duplicado — assim o térreo continua legível por baixo.
//
// A missão descreve o andar por RETÂNGULOS, não por ASCII: uma laje é
// `[x0, z0, x1, z1]` em células, inclusive. Escadas e guardas de cima são
// listas de células. É bem mais difícil de errar do que desenhar 15 linhas de
// texto, e dá para validar por teste (ver tests/james-bond/unit.mjs).
//
//   upper: {
//     slabs:  [[2, 2, 8, 6]],   // laje pisável
//     stairs: [[9, 4]],         // célula da ESCADARIA sólida (rampa diagonal)
//     guards: [[4, 3]],         // spawn de inimigo no andar de cima
//     rails:  true,             // guarda-corpo na borda (padrão: true)
//   }
//
// A escadaria ocupa a célula inteira e sobe em degraus na direção da laje:
// entra-se pelo térreo no lado baixo e sai-se em cima no lado alto. Nada de
// escada vertical de marinheiro: é estrutura sólida, com espelhos fechados,
// que também bloqueia passagem por baixo — se dá para pisar, existe volume.

export const STAIR_STEPS = 7;
const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

/**
 * Células cobertas por laje. A laje fica ÍNTEIRA: a escadaria mora numa célula
 * de fora, encostada na borda. Vazar a laje na célula da escada (como na 1ª
 * versão) partia o mezanino em duas ilhas e deixava metade dele inacessível.
 */
export function slabCells(upper) {
  const cells = new Set();
  for (const [x0, z0, x1, z1] of upper.slabs || []) {
    for (let z = Math.min(z0, z1); z <= Math.max(z0, z1); z += 1) {
      for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x += 1) cells.add(`${x},${z}`);
    }
  }
  return cells;
}

/**
 * Direção de subida da escadaria em (x, z). A célula da escada é EXTERNA à
 * laje: sobe-se do térreo (célula oposta livre) para a célula de laje pisável
 * do outro lado. É a mesma regra validada em teste para todas as missões.
 */
export function stairDirection(cells, chars, x, z) {
  if (cells.has(`${x},${z}`)) return null;          // escada nunca fica sobre a laje
  if (!chars[z]?.[x] || isSolid(chars[z][x])) return null;
  const upperOk = (cx, cz) => cells.has(`${cx},${cz}`) && !isSolid(chars[cz]?.[cx]);
  const groundOk = (cx, cz) => Boolean(chars[cz]?.[cx]) && !isSolid(chars[cz][cx]);
  return DIRS.find(([dx, dz]) => upperOk(x + dx, z + dz) && groundOk(x - dx, z - dz)) || null;
}

/**
 * Constrói geometria + colisores do segundo andar.
 * @returns {{cells:Set<string>, stairs:Array, guards:Array<THREE.Vector3>}}
 */
export function addUpperFloor(group, physics, mission, world, materials) {
  const upper = mission.upper;
  const empty = { cells: new Set(), stairs: [], guards: [] };
  if (!upper?.slabs?.length) return empty;

  const cells = slabCells(upper);
  if (!cells.size) return empty;
  const top = CONFIG.floorHeight;
  const half = CONFIG.cellSize / 2;
  const stairCells = new Set((upper.stairs || []).map(([x, z]) => `${x},${z}`));

  // --- Laje ---------------------------------------------------------------
  // Uma caixa por célula, instanciada: o piso de cima é visto por baixo (como
  // teto) e por cima (como chão), então precisa de espessura real.
  const slabGeometry = new THREE.BoxGeometry(CONFIG.cellSize, CONFIG.slabThickness, CONFIG.cellSize);
  const slabMaterial = materials.floor.clone();
  const slabs = new THREE.InstancedMesh(slabGeometry, slabMaterial, cells.size);
  slabs.castShadow = true;
  slabs.receiveShadow = true;
  const matrix = new THREE.Matrix4();
  let index = 0;
  for (const key of cells) {
    const [x, z] = key.split(',').map(Number);
    const position = world.toWorld({ x, z });
    matrix.makeTranslation(position.x, top - CONFIG.slabThickness / 2, position.z);
    slabs.setMatrixAt(index, matrix);
    // Laje flutuante: base = topo - espessura, então dá para andar por baixo.
    physics.addPlatform(position.x, position.z, half, half, top, top - CONFIG.slabThickness);
    index += 1;
  }
  slabs.instanceMatrix.needsUpdate = true;
  group.add(slabs);

  // --- Parapeito ----------------------------------------------------------
  // Painel MACIÇO e OPACO nas bordas expostas — não uma barra fina com vão
  // invisível entre os montantes. Colisor e desenho têm exatamente o mesmo
  // volume: nada sólido é invisível, nada invisível é sólido.
  // Só a boca da escadaria fica aberta (é por onde se entra e sai).
  const mouths = new Set((upper.stairs || []).map(([x, z]) => {
    const direction = stairDirection(cells, world.chars, x, z) || [1, 0];
    // Aresta entre a célula de cima (x+d) e a escada: identificada pela célula
    // de laje e pela direção de volta para a escada.
    return `${x + direction[0]},${z + direction[1]}|${-direction[0]},${-direction[1]}`;
  }));
  if (upper.rails !== false) addParapets(group, physics, world, cells, mouths, materials.trim, top);

  // --- Paredes do andar de cima ------------------------------------------
  const upperWalls = [];
  for (const key of cells) {
    const [x, z] = key.split(',').map(Number);
    // A parede de cima acompanha a parede de baixo: mantém a leitura do mapa.
    if (isSolid(world.chars[z]?.[x])) upperWalls.push(world.toWorld({ x, z }));
  }
  if (upperWalls.length) {
    const wallGeometry = new THREE.BoxGeometry(CONFIG.cellSize, CONFIG.upperWallHeight, CONFIG.cellSize);
    const walls = new THREE.InstancedMesh(wallGeometry, materials.wall, upperWalls.length);
    walls.castShadow = true;
    walls.receiveShadow = true;
    upperWalls.forEach((position, i) => {
      matrix.makeTranslation(position.x, top + CONFIG.upperWallHeight / 2, position.z);
      walls.setMatrixAt(i, matrix);
      physics.addBox(position.x, top + CONFIG.upperWallHeight / 2, position.z,
        half, CONFIG.upperWallHeight / 2, half);
    });
    walls.instanceMatrix.needsUpdate = true;
    group.add(walls);
  }

  // --- Escadarias ----------------------------------------------------------
  const stairs = (upper.stairs || []).map(([x, z]) => {
    const direction = stairDirection(cells, world.chars, x, z) || [1, 0];
    const position = world.toWorld({ x, z });
    const mesh = buildStaircase(direction, top, materials);
    mesh.position.set(position.x, 0, position.z);
    group.add(mesh);
    addStairPhysics(physics, position, direction, top, half);
    return { cell: { x, z }, position, direction, mesh };
  });

  const guards = (upper.guards || []).map(([x, z]) => world.toWorld({ x, z }).setY(top));
  return { cells, stairs, guards };
}

/**
 * Colisores dos degraus. Cada degrau é MACIÇO: `baseY = 0`, do chão ao topo —
 * exatamente o bloco que se vê. Assim não há como entrar por dentro nem por
 * baixo da escadaria; só se sobe pisando degrau a degrau, e cada espelho
 * (0.507 m) cabe no passo automático de 0.62 m.
 */
function addStairPhysics(physics, position, [dx, dz], top, half) {
  const rise = top / STAIR_STEPS;
  const run = CONFIG.cellSize / STAIR_STEPS;
  for (let i = 0; i < STAIR_STEPS; i += 1) {
    const along = -half + (i + 0.5) * run;
    const cx = position.x + dx * along;
    const cz = position.z + dz * along;
    const hx = dx ? run / 2 : half;
    const hz = dz ? run / 2 : half;
    physics.addPlatform(cx, cz, hx, hz, rise * (i + 1), 0);
  }
}

/** Escadaria sólida: degraus fechados do chão ao topo, na largura da célula. */
function buildStaircase([dx, dz], top, materials) {
  const group = new THREE.Group();
  const material = materials.trim;
  const rise = top / STAIR_STEPS;
  const run = CONFIG.cellSize / STAIR_STEPS;
  const half = CONFIG.cellSize / 2;
  for (let i = 0; i < STAIR_STEPS; i += 1) {
    const height = rise * (i + 1);
    const width = dx ? run : CONFIG.cellSize;
    const depth = dz ? run : CONFIG.cellSize;
    const step = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), material);
    const along = -half + (i + 0.5) * run;
    step.position.set(dx * along, height / 2, dz * along);
    step.castShadow = true;
    step.receiveShadow = true;
    group.add(step);
  }
  return group;
}

/**
 * Parapeito maciço nas bordas expostas da laje. O painel desenhado e o volume
 * de colisão são o MESMO bloco (0.18 m de espessura, 1.05 m de altura): nada
 * sólido fica invisível e não há vão por onde escorregar para fora da laje.
 * A boca da escadaria — e só ela — fica aberta.
 * Altura escolhida abaixo da linha dos olhos (1.68 em pé, 1.25 agachado) para
 * o mezanino continuar servindo de ninho de sniper.
 */
const PARAPET_HEIGHT = 1.05;
const PARAPET_THICKNESS = 0.18;

function addParapets(group, physics, world, cells, mouths, material, top) {
  const neighbours = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  // Agrupa as arestas por lado e linha para MESCLAR trechos contíguos: uma
  // borda de 5 células vira um colisor só, como já é feito com as paredes.
  const runs = new Map();
  for (const key of cells) {
    const [x, z] = key.split(',').map(Number);
    for (const [dx, dz] of neighbours) {
      if (cells.has(`${x + dx},${z + dz}`)) continue;
      // Boca da escadaria: única aresta deliberadamente aberta.
      if (mouths.has(`${x},${z}|${dx},${dz}`)) continue;
      const line = dx !== 0 ? `${dx},0@${x}` : `0,${dz}@${z}`;
      if (!runs.has(line)) runs.set(line, { dx, dz, fixed: dx !== 0 ? x : z, along: [] });
      runs.get(line).along.push(dx !== 0 ? z : x);
    }
  }

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
      const edgeX = position.x + dx * (half - PARAPET_THICKNESS / 2);
      const edgeZ = position.z + dz * (half - PARAPET_THICKNESS / 2);
      const hx = dx !== 0 ? PARAPET_THICKNESS / 2 : count * half;
      const hz = dz !== 0 ? PARAPET_THICKNESS / 2 : count * half;
      panels.push({ x: edgeX, z: edgeZ, hx, hz });
      physics.addBox(edgeX, top + PARAPET_HEIGHT / 2, edgeZ, hx, PARAPET_HEIGHT / 2, hz);
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

  const geometry = new THREE.BoxGeometry(1, PARAPET_HEIGHT, 1);
  const mesh = new THREE.InstancedMesh(geometry, material, panels.length);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  const dummy = new THREE.Object3D();
  panels.forEach((panel, i) => {
    dummy.position.set(panel.x, top + PARAPET_HEIGHT / 2, panel.z);
    dummy.rotation.set(0, 0, 0);
    dummy.scale.set(panel.hx * 2, 1, panel.hz * 2);
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
  });
  mesh.instanceMatrix.needsUpdate = true;
  group.add(mesh);
}
