import * as THREE from '../../vendor/three.module.min.js';
import { CONFIG } from './config.js';
import {
  slabCells, buildStaircase, addStairPhysics, addParapets, STAIR_STEPS,
} from './upper-floor.js';

// M1 — telhado/cobertura: TERCEIRO nível pisável, direto em cima das paredes
// do mezanino (que já fecham o cômodo até `CONFIG.roofHeight`, exatamente o
// topo de `upperWallHeight` — ver world.js/upper-floor.js). Sem inimigo: a
// IA continua só térreo+mezanino (ver ai/nav-graph.js), então o telhado não
// precisa de parede própria — só a laje pisável + o mesmo parapeito curto do
// mezanino (guarda-corpo, não estrutura) e uma escada externa vinda do
// mezanino.
//
//   roof: {
//     slabs:  [[x0, z0, x1, z1]],  // sub-retângulo DENTRO de upper.cells
//     stairs: [[x, z]],            // célula de laje do MEZANINO (fora do
//                                  // retângulo do telhado) — sobe para o telhado
//   }
//
// `roof.slabs` tem de ser um SUBCONJUNTO da laje do mezanino que o serve:
// a escada do telhado nasce numa célula do PRÓPRIO mezanino (não do chão),
// então precisa de "moat" — pelo menos uma faixa de laje do mezanino fora do
// retângulo do telhado — para ter onde ficar.
const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

/**
 * Direção de subida da escadaria do telhado. Espelha `stairDirection` do
 * mezanino, mas o "chão" desta escada é o PRÓPRIO mezanino (não o térreo):
 * a célula da escada tem de estar FORA do telhado, mas DENTRO da laje do
 * mezanino que a serve.
 */
export function roofStairDirection(roofCells, upperCells, x, z) {
  if (roofCells.has(`${x},${z}`)) return null;
  if (!upperCells.has(`${x},${z}`)) return null;
  const roofOk = (cx, cz) => roofCells.has(`${cx},${cz}`);
  const upperOk = (cx, cz) => upperCells.has(`${cx},${cz}`) && !roofCells.has(`${cx},${cz}`);
  return DIRS.find(([dx, dz]) => roofOk(x + dx, z + dz) && upperOk(x - dx, z - dz)) || null;
}

/**
 * Constrói geometria + colisores do telhado.
 * @returns {{cells:Set<string>, stairs:Array}}
 */
export function addRoofLevel(group, physics, mission, world, materials) {
  const roof = mission.roof;
  const empty = { cells: new Set(), stairs: [] };
  if (!roof?.slabs?.length || !world.upper?.cells?.size) return empty;

  const cells = slabCells(roof);
  if (!cells.size) return empty;
  const top = CONFIG.roofHeight;
  const half = CONFIG.cellSize / 2;

  // --- Laje do telhado ------------------------------------------------------
  const slabGeometry = new THREE.BoxGeometry(CONFIG.cellSize, CONFIG.roofSlabThickness, CONFIG.cellSize);
  const slabMaterial = materials.floor.clone();
  const slabs = new THREE.InstancedMesh(slabGeometry, slabMaterial, cells.size);
  slabs.castShadow = true;
  slabs.receiveShadow = true;
  const matrix = new THREE.Matrix4();
  let index = 0;
  for (const key of cells) {
    const [x, z] = key.split(',').map(Number);
    const position = world.toWorld({ x, z });
    matrix.makeTranslation(position.x, top - CONFIG.roofSlabThickness / 2, position.z);
    slabs.setMatrixAt(index, matrix);
    // Base logo abaixo do topo: dá para andar por baixo, no mezanino — o
    // telhado é o TETO do cômodo de cima, nunca um bloco maciço até o chão.
    physics.addPlatform(position.x, position.z, half, half, top, top - CONFIG.roofSlabThickness);
    index += 1;
  }
  slabs.instanceMatrix.needsUpdate = true;
  group.add(slabs);

  // --- Guarda-corpo (mesmo painel maciço do mezanino) ------------------------
  const mouths = new Set((roof.stairs || []).map(([x, z]) => {
    const direction = roofStairDirection(cells, world.upper.cells, x, z) || [1, 0];
    return `${x + direction[0]},${z + direction[1]}|${-direction[0]},${-direction[1]}`;
  }));
  addParapets(group, physics, world, cells, mouths, materials.trim, top);

  // --- Escadaria (mezanino -> telhado) --------------------------------------
  const stairs = (roof.stairs || []).map(([x, z]) => {
    const direction = roofStairDirection(cells, world.upper.cells, x, z) || [1, 0];
    const position = world.toWorld({ x, z });
    const mesh = buildStaircase(direction, top, materials, CONFIG.floorHeight);
    mesh.position.set(position.x, CONFIG.floorHeight, position.z);
    group.add(mesh);
    addStairPhysics(physics, position, direction, top, half, CONFIG.floorHeight);
    return { cell: { x, z }, position, direction, mesh };
  });

  return { cells, stairs };
}

export { STAIR_STEPS };
