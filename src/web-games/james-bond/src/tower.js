import * as THREE from '../../vendor/three.module.min.js';
import { CONFIG } from './config.js';
import { addParapets } from './upper-floor.js';

// M2 — torre de vigia: landmark alto de UMA célula, com subida interna por
// escada de mão (physics.addLadder — mecanismo já existente, nunca usado até
// aqui) e uma plataforma de observação no topo, mais alta que qualquer
// telhado — o ninho de sniper que combina com o tiro de precisão de longo
// alcance (F2). Paredes finas nas bordas da célula (mesma técnica dos
// parapeitos do mezanino), com UM lado aberto (a porta).
//
//   tower: { base: [x, z], door: [dx, dz] }
//
// A célula base continua uma célula NORMAL do térreo (andável, com colisor
// próprio nas 3 bordas fechadas) — não muda o vocabulário de tile nem o grid.

/** Painéis maciços de altura TOTAL (baseY..topY) nas bordas de uma célula
 * única, exceto a(s) aresta(s) listada(s) em `openDirs`. Mesma mecânica de
 * `addParapets`, mas para uma parede alta (não um guarda-corpo curto) — por
 * isso vive aqui, não em upper-floor.js. */
function buildCellWalls(group, physics, world, cell, openDirs, material, baseY, topY) {
  const half = CONFIG.cellSize / 2;
  const height = topY - baseY;
  const thickness = 0.22;
  const position = world.toWorld(cell);
  const panels = [];
  const neighbours = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  for (const [dx, dz] of neighbours) {
    if (openDirs.some(([ox, oz]) => ox === dx && oz === dz)) continue;
    const edgeX = position.x + dx * (half - thickness / 2);
    const edgeZ = position.z + dz * (half - thickness / 2);
    const hx = dx !== 0 ? thickness / 2 : half;
    const hz = dz !== 0 ? thickness / 2 : half;
    panels.push({ x: edgeX, z: edgeZ, hx, hz });
    physics.addBox(edgeX, baseY + height / 2, edgeZ, hx, height / 2, hz);
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
 * Constrói a torre: casca de 3 paredes + porta, escada de mão interna, laje
 * de observação no topo com guarda-corpo nos 4 lados.
 * @returns {{baseKey:string, base:{x:number,z:number}, top:THREE.Vector3, ladder:object}|null}
 */
export function addTower(group, physics, mission, world, materials) {
  const tower = mission.tower;
  if (!tower?.base) return null;
  const [bx, bz] = tower.base;
  const door = tower.door || [1, 0];
  const cell = { x: bx, z: bz };
  const position = world.toWorld(cell);
  const half = CONFIG.cellSize / 2;
  const platformTop = CONFIG.towerHeight;
  const shellTop = platformTop - CONFIG.towerSlabThickness;

  // --- Casca: 3 paredes maciças (a porta fica aberta) -----------------------
  buildCellWalls(group, physics, world, cell, [door], materials.wall, 0, shellTop);

  // --- Escada de mão interna: mecanismo já existente (physics.addLadder), até
  // hoje nunca usado por nenhuma missão. Fica um pouco menor que a célula
  // inteira para não tocar as paredes finas das bordas.
  const ladderHalf = half * 0.4;
  const ladder = physics.addLadder(position.x, position.z, ladderHalf, ladderHalf, 0, shellTop - 0.4);
  // Visual: pequenos trilhos verticais + degraus, só decorativo (a física é o
  // volume acima). InstancedMesh, material já em cache — nenhum material novo.
  const rungCount = 9;
  const rungGeometry = new THREE.BoxGeometry(ladderHalf * 1.7, 0.05, 0.08);
  const rungs = new THREE.InstancedMesh(rungGeometry, materials.trim, rungCount);
  const matrix = new THREE.Matrix4();
  for (let i = 0; i < rungCount; i += 1) {
    const y = 0.4 + (i / (rungCount - 1)) * (shellTop - 0.8);
    matrix.makeTranslation(position.x, y, position.z + ladderHalf * 0.9);
    rungs.setMatrixAt(i, matrix);
  }
  rungs.instanceMatrix.needsUpdate = true;
  group.add(rungs);

  // --- Plataforma de observação no topo -------------------------------------
  const slabGeometry = new THREE.BoxGeometry(CONFIG.cellSize * 1.15, CONFIG.towerSlabThickness, CONFIG.cellSize * 1.15);
  const platform = new THREE.Mesh(slabGeometry, materials.floor);
  platform.position.set(position.x, platformTop - CONFIG.towerSlabThickness / 2, position.z);
  platform.castShadow = true;
  platform.receiveShadow = true;
  group.add(platform);
  physics.addPlatform(position.x, position.z, half * 1.15, half * 1.15, platformTop, shellTop);

  // Guarda-corpo nos 4 lados do topo — reusa a mesma mecânica do mezanino
  // (cells de 1 célula, sem boca: totalmente cercado, a escada emerge no
  // centro, longe das bordas).
  const topCells = new Set([`${bx},${bz}`]);
  addParapets(group, physics, world, topCells, new Set(), materials.trim, platformTop);

  const top = new THREE.Vector3(position.x, platformTop, position.z);
  return { baseKey: `${bx},${bz}`, base: cell, top, ladder };
}
