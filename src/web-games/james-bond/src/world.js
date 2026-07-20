import * as THREE from '../../vendor/three.module.min.js';
import { CONFIG } from './config.js';
import { createMissionMaterials } from './materials.js';
import { addEnvironment } from './environment.js';

function worldPosition(x, z, width, height) {
  return new THREE.Vector3((x - width / 2) * CONFIG.cellSize, 0, (z - height / 2) * CONFIG.cellSize);
}

export function createWorld(scene, physics, mission) {
  const group = new THREE.Group();
  group.name = `world-${mission.code}`;
  scene.add(group);
  physics.reset();

  const height = mission.grid.length;
  const width = Math.max(...mission.grid.map((row) => row.length));
  const chars = mission.grid.map((row) => row.padEnd(width, '#').split(''));
  const materials = createMissionMaterials(mission, width, height);
  group.userData.textures = materials.textures;
  const walls = [];
  const guards = [];
  const objectives = [];
  const barrels = [];
  let start = new THREE.Vector3();
  let extraction = new THREE.Vector3();

  chars.forEach((row, z) => row.forEach((char, x) => {
    const position = worldPosition(x, z, width, height);
    if (char === '#') walls.push(position);
    if (char === 'S') start = position.clone().setY(1);
    if (char === 'E') extraction = position.clone();
    if (char === 'G') guards.push(position.clone());
    if ('ABC'.includes(char)) objectives.push({ key: char, position: position.clone() });
    if (char === 'X') barrels.push(position.clone());
  }));

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(width * CONFIG.cellSize, height * CONFIG.cellSize),
    materials.floor,
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  group.add(floor);
  physics.addBox(0, -0.2, 0, width * CONFIG.cellSize / 2, 0.2, height * CONFIG.cellSize / 2);

  const wallGeometry = new THREE.BoxGeometry(CONFIG.cellSize, CONFIG.wallHeight, CONFIG.cellSize);
  const wallMesh = new THREE.InstancedMesh(wallGeometry, materials.wall, walls.length);
  wallMesh.castShadow = true;
  wallMesh.receiveShadow = true;
  const matrix = new THREE.Matrix4();
  const tint = new THREE.Color();
  walls.forEach((position, index) => {
    matrix.makeTranslation(position.x, CONFIG.wallHeight / 2, position.z);
    wallMesh.setMatrixAt(index, matrix);
    const shade = 0.9 + ((position.x * 7 + position.z * 13) % 10) / 50;
    wallMesh.setColorAt(index, tint.setScalar(shade));
  });
  if (wallMesh.instanceColor) wallMesh.instanceColor.needsUpdate = true;
  addWallColliders(chars, physics, width, height);
  wallMesh.instanceMatrix.needsUpdate = true;
  group.add(wallMesh);

  const objectiveMeshes = objectives.map(({ key, position }) => {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(1.2, 1.65, 0.55),
      materials.accent.clone(),
    );
    mesh.position.copy(position).setY(0.83);
    mesh.userData = { kind: 'objective', key, active: true };
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.78, 0.5), new THREE.MeshBasicMaterial({ color: 0x8fffc1, toneMapped: false }));
    screen.position.set(0, 0.24, 0.281);
    const keypad = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.06, 0.34), materials.trim);
    keypad.position.set(0, -0.34, 0.34);
    keypad.rotation.x = -0.42;
    mesh.add(screen, keypad);
    group.add(mesh);
    return mesh;
  });

  const barrelMeshes = barrels.map((position) => {
    const mesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.42, 0.42, 1.25, 12),
      new THREE.MeshStandardMaterial({ color: 0x9d382f, roughness: 0.55, metalness: 0.6 }),
    );
    mesh.position.copy(position).setY(0.63);
    mesh.castShadow = true;
    mesh.userData = { kind: 'barrel', health: 22, exploded: false };
    group.add(mesh);
    return mesh;
  });

  const extractionMesh = new THREE.Mesh(
    new THREE.CylinderGeometry(1.5, 1.5, 0.05, 32),
    new THREE.MeshBasicMaterial({ color: 0x50e29a, transparent: true, opacity: 0.38 }),
  );
  extractionMesh.position.copy(extraction).setY(0.04);
  extractionMesh.userData = { kind: 'extraction', noRay: true };
  group.add(extractionMesh);

  const walkable = (x, z) => chars[z]?.[x] && chars[z][x] !== '#';
  const toCell = (position) => ({
    x: Math.max(0, Math.min(width - 1, Math.round(position.x / CONFIG.cellSize + width / 2))),
    z: Math.max(0, Math.min(height - 1, Math.round(position.z / CONFIG.cellSize + height / 2))),
  });
  const toWorld = (cell) => worldPosition(cell.x, cell.z, width, height);
  const startCell = toCell(start);
  const exitDirection = [[1, 0], [0, 1], [-1, 0], [0, -1]]
    .find(([x, z]) => walkable(startCell.x + x, startCell.z + z)) || [1, 0];
  const spawnLook = toWorld({ x: startCell.x + exitDirection[0], z: startCell.z + exitDirection[1] }).setY(start.y + 0.68);

  const world = { group, width, height, chars, walls, guards, objectiveMeshes, barrelMeshes, start, spawnLook, extraction, extractionMesh, walkable, toCell, toWorld };
  addEnvironment(group, mission, world, materials);
  return world;
}

function addWallColliders(chars, physics, width, height) {
  const used = chars.map((row) => row.map(() => false));
  for (let z = 0; z < height; z += 1) for (let x = 0; x < width; x += 1) {
    if (chars[z][x] !== '#' || used[z][x]) continue;
    let runWidth = 1;
    while (x + runWidth < width && chars[z][x + runWidth] === '#' && !used[z][x + runWidth]) runWidth += 1;
    let runHeight = 1;
    while (z + runHeight < height) {
      const complete = Array.from({ length: runWidth }, (_, offset) => chars[z + runHeight][x + offset] === '#' && !used[z + runHeight][x + offset]).every(Boolean);
      if (!complete) break;
      runHeight += 1;
    }
    for (let dz = 0; dz < runHeight; dz += 1) for (let dx = 0; dx < runWidth; dx += 1) used[z + dz][x + dx] = true;
    const first = worldPosition(x, z, width, height);
    const last = worldPosition(x + runWidth - 1, z + runHeight - 1, width, height);
    physics.addBox((first.x + last.x) / 2, CONFIG.wallHeight / 2, (first.z + last.z) / 2,
      runWidth * CONFIG.cellSize / 2, CONFIG.wallHeight / 2, runHeight * CONFIG.cellSize / 2);
  }
}

export function disposeWorld(scene, world) {
  if (!world) return;
  scene.remove(world.group);
  world.group.traverse((object) => {
    object.geometry?.dispose();
    if (Array.isArray(object.material)) object.material.forEach((material) => material.dispose());
    else object.material?.dispose();
  });
  world.group.userData.textures?.forEach((texture) => texture.dispose());
}

const losTemp = new THREE.Vector3();
export function hasLineOfSight(world, from, to) {
  const distance = from.distanceTo(to);
  const steps = Math.max(2, Math.ceil(distance / (CONFIG.cellSize * 0.35)));
  for (let i = 1; i < steps; i += 1) {
    losTemp.copy(from).lerp(to, i / steps);
    const cell = world.toCell(losTemp);
    if (!world.walkable(cell.x, cell.z)) return false;
  }
  return true;
}
