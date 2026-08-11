import * as THREE from '../../vendor/three.module.min.js';
import { CONFIG } from './config.js';
import { createMissionMaterials } from './materials.js';
import { addEnvironment } from './environment.js';
import { addUpperFloor } from './upper-floor.js';
import { isSolid, tileHeight, tileInset } from './content/tiles.js';
import { addCity } from './city.js';
import { createDestructibles } from './gameplay/destructibles.js';

function worldPosition(x, z, width, height) {
  return new THREE.Vector3((x - width / 2) * CONFIG.cellSize, 0, (z - height / 2) * CONFIG.cellSize);
}

export function createWorld(scene, physics, mission, fx, audio) {
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

  // Cada tile sólido entra na lista do seu tipo: as fachadas (`#`, `n`) viram
  // parede de altura cheia; carros, escombros, barricadas e postes viram
  // COBERTURA, sólida mas baixa — dá para ver e atirar por cima.
  const cover = [];
  chars.forEach((row, z) => row.forEach((char, x) => {
    const position = worldPosition(x, z, width, height);
    if (char === '#' || char === 'n') walls.push(position);
    else if (isSolid(char)) cover.push({ char, position, x, z });
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
  physics.addPlatform(0, 0, width * CONFIG.cellSize / 2, height * CONFIG.cellSize / 2, 0);

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

  // Registro de cenário destrutível: barris, carros, engradados e tambores.
  // Sólidos, atingíveis a tiro e deslocáveis pela onda de choque.
  const props = createDestructibles(scene, physics, fx, audio);

  const barrelMeshes = barrels.map((position) => {
    const mesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.42, 0.42, 1.25, 12),
      new THREE.MeshStandardMaterial({ color: 0x9d382f, roughness: 0.55, metalness: 0.6 }),
    );
    mesh.position.copy(position).setY(0.63);
    mesh.castShadow = true;
    mesh.userData = { kind: 'barrel' };
    group.add(mesh);
    // O barril de combustível é o explosivo do mapa: pouca vida, muito estrago,
    // e leve o bastante para a explosão vizinha o arremessar antes de detonar.
    props.register({
      kind: 'barrel', node: mesh, position: mesh.position, health: 22, mass: 1.4,
      explosive: true, radius: 5.5, hitHalf: 0.45,
    });
    return mesh;
  });

  const extractionMesh = new THREE.Mesh(
    new THREE.CylinderGeometry(1.5, 1.5, 0.05, 32),
    new THREE.MeshBasicMaterial({ color: 0x50e29a, transparent: true, opacity: 0.38 }),
  );
  extractionMesh.position.copy(extraction).setY(0.04);
  extractionMesh.userData = { kind: 'extraction', noRay: true };
  group.add(extractionMesh);

  const walkable = (x, z) => Boolean(chars[z]?.[x]) && !isSolid(chars[z][x]);
  // Altura sólida da célula: parede cheia, cobertura baixa ou 0 (passagem).
  // A linha de visão e os projéteis consultam ISTO, nunca só "é parede?" —
  // é o que permite atirar e arremessar granada por cima de um carro.
  const solidHeight = (x, z) => tileHeight(chars[z]?.[x]);
  const toCell = (position) => ({
    x: Math.max(0, Math.min(width - 1, Math.round(position.x / CONFIG.cellSize + width / 2))),
    z: Math.max(0, Math.min(height - 1, Math.round(position.z / CONFIG.cellSize + height / 2))),
  });
  const toWorld = (cell) => worldPosition(cell.x, cell.z, width, height);
  const startCell = toCell(start);
  const exitDirection = [[1, 0], [0, 1], [-1, 0], [0, -1]]
    .find(([x, z]) => walkable(startCell.x + x, startCell.z + z)) || [1, 0];
  const spawnLook = toWorld({ x: startCell.x + exitDirection[0], z: startCell.z + exitDirection[1] }).setY(start.y + 0.68);

  const world = { group, width, height, chars, walls, cover, props, guards, objectiveMeshes, barrelMeshes, start, spawnLook, extraction, extractionMesh, walkable, solidHeight, toCell, toWorld };
  addCoverColliders(cover, physics, world);
  world.upper = addUpperFloor(group, physics, mission, world, materials);
  // Navegação por nível: inimigo de cima só pisa em laje, inimigo do térreo
  // não entra na célula da escadaria (ele não sabe subir — e atravessá-la
  // seria atravessar estrutura sólida).
  world.stairCells = new Set(world.upper.stairs.map(({ cell }) => `${cell.x},${cell.z}`));
  world.upperWalkable = (x, z) => world.upper.cells.has(`${x},${z}`) && !isSolid(chars[z]?.[x]);
  world.groundWalkable = (x, z) => walkable(x, z) && !world.stairCells.has(`${x},${z}`);
  // Guardas do mezanino entram na mesma lista: createGuards já usa a posição y
  // de cada spawn, então um inimigo de cima nasce e patrulha lá em cima.
  world.upper.guards.forEach((position) => guards.push(position.clone()));
  addEnvironment(group, mission, world, materials);
  // Camada urbana: asfalto, calçada, fachadas detalhadas, carcaças de carro,
  // escombros, barricadas e postes. Depois do ambiente para assentar por cima.
  addCity(group, mission, world, materials);
  return world;
}

/**
 * Colisores da cobertura baixa. Cada peça é uma caixa com a ALTURA do tile —
 * a mesma que o desenho usa e a mesma que a linha de visão consulta. O poste é
 * fino: ocupa um quarto da célula, senão vira um pilar intransponível.
 */
function addCoverColliders(cover, physics, world) {
  const half = CONFIG.cellSize / 2;
  // Calçada: plataforma de 0.13 m. Degrau, não obstáculo — o passo automático
  // do jogador (0.62 m) sobe nela sem pulo, e a granada repousa em cima.
  for (let z = 0; z < world.height; z += 1) {
    for (let x = 0; x < world.width; x += 1) {
      if (world.chars[z][x] !== ',') continue;
      const point = world.toWorld({ x, z });
      physics.addPlatform(point.x, point.z, half, half, 0.13);
    }
  }
  for (const entry of cover) {
    const height = tileHeight(entry.char);
    const inset = tileInset(entry.char);
    // Guardado na entrada: a carcaça de carro assume ESTE colisor ao virar peça
    // destrutível, e o remove quando explode — senão sobraria parede invisível
    // onde o carro deixou de existir.
    entry.collider = physics.addBox(entry.position.x, height / 2, entry.position.z,
      half * inset, height / 2, half * inset);
  }
}

// Fachadas de altura cheia: `#` e `n` (a de janela é sólida — a janela é só o
// desenho). São mescladas em corridas retangulares para poupar colisores.
const isFacade = (char) => char === '#' || char === 'n';

function addWallColliders(chars, physics, width, height) {
  const used = chars.map((row) => row.map(() => false));
  for (let z = 0; z < height; z += 1) for (let x = 0; x < width; x += 1) {
    if (!isFacade(chars[z][x]) || used[z][x]) continue;
    let runWidth = 1;
    while (x + runWidth < width && isFacade(chars[z][x + runWidth]) && !used[z][x + runWidth]) runWidth += 1;
    let runHeight = 1;
    while (z + runHeight < height) {
      const complete = Array.from({ length: runWidth }, (_, offset) => isFacade(chars[z + runHeight][x + offset]) && !used[z + runHeight][x + offset]).every(Boolean);
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
  // A laje do mezanino bloqueia visão entre andares: se o segmento cruza o
  // plano do piso de cima sobre uma célula com laje, não há linha de visão.
  // Cruzar sobre a boca da escada (célula vazada) continua enxergando.
  const plane = CONFIG.floorHeight - CONFIG.slabThickness / 2;
  if (world.upper?.cells?.size && (from.y - plane) * (to.y - plane) < 0) {
    const t = (plane - from.y) / (to.y - from.y);
    losTemp.copy(from).lerp(to, t);
    const crossing = world.toCell(losTemp);
    if (world.upper.cells.has(`${crossing.x},${crossing.z}`)) return false;
  }
  const distance = from.distanceTo(to);
  const steps = Math.max(2, Math.ceil(distance / (CONFIG.cellSize * 0.35)));
  for (let i = 1; i < steps; i += 1) {
    losTemp.copy(from).lerp(to, i / steps);
    const cell = world.toCell(losTemp);
    // Cada tile sólido bloqueia até a SUA altura, e só até ela: a fachada vai a
    // 3.15 m, o carro a 1.42 m. Sem esta checagem, quem está no mezanino não
    // enxergava nada além de qualquer parede do térreo (e a explosão lançada de
    // cima não feria ninguém lá embaixo), e ninguém atirava por cima de um carro.
    if (losTemp.y < (world.solidHeight?.(cell.x, cell.z) ?? (world.walkable(cell.x, cell.z) ? 0 : CONFIG.wallHeight))) return false;
    // Acima da laje do mezanino, a parede DE CIMA é que bloqueia.
    if (losTemp.y >= CONFIG.floorHeight && world.upper?.cells?.has(`${cell.x},${cell.z}`)
      && world.chars[cell.z]?.[cell.x] === '#') return false;
  }
  return true;
}
