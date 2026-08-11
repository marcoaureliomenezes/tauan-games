import * as THREE from '../../vendor/three.module.min.js';
import { CONFIG } from './config.js';
import { createRandom, hashSeed } from './random.js';

const INDOOR = new Set(['OP-02', 'OP-04', 'OP-05']);
const dummy = new THREE.Object3D();

export function addEnvironment(group, mission, world, materials) {
  addWallTrim(group, world.walls, materials.trim);
  addFloorGuides(group, mission, world);
  if (INDOOR.has(mission.code)) addInterior(group, mission, world, materials);
  else addExterior(group, mission, world, materials);
  addMissionProps(group, mission, world, materials);
}

function addFloorGuides(group, mission, world) {
  const cells = openCells(world).filter(({ x, z }) => (x * 3 + z * 5) % 13 === 0);
  const material = new THREE.MeshBasicMaterial({ color: mission.palette.accent, transparent: true, opacity: 0.48 });
  const guides = new THREE.InstancedMesh(new THREE.PlaneGeometry(1.2, 0.07), material, cells.length);
  const matrix = new THREE.Matrix4().makeRotationX(-Math.PI / 2);
  const transform = new THREE.Matrix4();
  cells.forEach((cell, index) => {
    const position = world.toWorld(cell);
    transform.makeTranslation(position.x, 0.012, position.z);
    guides.setMatrixAt(index, transform.multiply(matrix));
  });
  guides.instanceMatrix.needsUpdate = true;
  guides.userData.noRay = true;
  group.add(guides);
}

function addWallTrim(group, walls, material) {
  const geometry = new THREE.BoxGeometry(CONFIG.cellSize * 1.01, 0.22, CONFIG.cellSize * 1.01);
  const trim = new THREE.InstancedMesh(geometry, material, walls.length);
  const matrix = new THREE.Matrix4();
  walls.forEach((position, index) => {
    matrix.makeTranslation(position.x, 0.22, position.z);
    trim.setMatrixAt(index, matrix);
  });
  trim.instanceMatrix.needsUpdate = true;
  trim.userData.noRay = true;
  group.add(trim);
}

function addInterior(group, mission, world, materials) {
  const ceiling = new THREE.Mesh(
    new THREE.PlaneGeometry(world.width * CONFIG.cellSize, world.height * CONFIG.cellSize),
    new THREE.MeshStandardMaterial({ color: 0x202825, roughness: 0.72, metalness: 0.32, side: THREE.DoubleSide }),
  );
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.y = CONFIG.wallHeight + 0.04;
  group.add(ceiling);
  const cells = openCells(world).filter(({ x, z }) => x % 5 === 2 && z % 4 === 1).slice(0, 14);
  const lightMaterial = new THREE.MeshStandardMaterial({ color: 0xdff7e8, emissive: 0xcfffe3, emissiveIntensity: 3 });
  const fixtures = new THREE.InstancedMesh(new THREE.BoxGeometry(1.8, 0.06, 0.28), lightMaterial, cells.length);
  const matrix = new THREE.Matrix4();
  cells.forEach((cell, index) => {
    const position = world.toWorld(cell);
    matrix.makeTranslation(position.x, CONFIG.wallHeight - 0.08, position.z);
    fixtures.setMatrixAt(index, matrix);
    if (index % 4 === 0) {
      const light = new THREE.PointLight(mission.palette.accent, 110, 19, 2);
      light.position.set(position.x, CONFIG.wallHeight - 0.3, position.z);
      group.add(light);
    }
  });
  fixtures.instanceMatrix.needsUpdate = true;
  group.add(fixtures);
}

function addExterior(group, mission, world, materials) {
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(world.width * CONFIG.cellSize * 2.6, world.height * CONFIG.cellSize * 2.6),
    materials.floor.clone(),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.08;
  ground.userData.noRay = true;
  group.add(ground);
  addSky(group, mission);
  const random = createRandom(hashSeed(`${mission.code}-landscape`));
  const geometry = new THREE.DodecahedronGeometry(8, 1);
  const material = new THREE.MeshStandardMaterial({ color: mission.code === 'OP-06' ? 0x1d3927 : 0x59696c, roughness: 1 });
  const mountains = new THREE.InstancedMesh(geometry, material, 18);
  for (let index = 0; index < 18; index += 1) {
    const angle = index / 18 * Math.PI * 2;
    const radius = Math.max(world.width, world.height) * CONFIG.cellSize * (0.62 + random() * 0.3);
    place(mountains, index, [Math.cos(angle) * radius, 4 + random() * 5, Math.sin(angle) * radius], [0, random() * Math.PI, 0], [0.7 + random(), 1.3 + random() * 1.5, 0.7 + random()]);
  }
  mountains.instanceMatrix.needsUpdate = true;
  mountains.userData.noRay = true;
  group.add(mountains);
}

function addSky(group, mission) {
  const top = new THREE.Color(mission.palette.sky).offsetHSL(0, 0.04, 0.13);
  const bottom = new THREE.Color(mission.palette.fog).offsetHSL(0, -0.02, -0.08);
  const material = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: { top: { value: top }, bottom: { value: bottom } },
    vertexShader: 'varying vec3 worldPos; void main(){vec4 p=modelMatrix*vec4(position,1.0);worldPos=p.xyz;gl_Position=projectionMatrix*viewMatrix*p;}',
    fragmentShader: 'uniform vec3 top;uniform vec3 bottom;varying vec3 worldPos;void main(){float h=clamp(normalize(worldPos).y*.7+.35,0.,1.);gl_FragColor=vec4(mix(bottom,top,h),1.);}',
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(180, 24, 12), material);
  sky.userData.noRay = true;
  group.add(sky);
}

function addMissionProps(group, mission, world, materials) {
  if (mission.code === 'OP-01') addWater(group, world);
  if (mission.code === 'OP-02' || mission.code === 'OP-05') addPipes(group, world, materials.trim);
  if (mission.code === 'OP-03') addSnowBanks(group, world);
  if (mission.code === 'OP-04') addMissiles(group, materials.accent);
  if (mission.code === 'OP-06') addTrees(group, world);
}

function addWater(group, world) {
  const water = new THREE.Mesh(new THREE.PlaneGeometry(world.width * CONFIG.cellSize * 1.7, 48), new THREE.MeshStandardMaterial({ color: 0x294c59, roughness: 0.16, metalness: 0.45, transparent: true, opacity: 0.86 }));
  water.userData.noRay = true;
  water.rotation.x = -Math.PI / 2;
  water.position.set(0, -0.45, -world.height * CONFIG.cellSize * 0.75);
  group.add(water);
}

function addPipes(group, world, material) {
  const pipes = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.12, 0.12, 18, 10), material, 7);
  for (let index = 0; index < 7; index += 1) {
    place(pipes, index, [(index - 3) * 13, CONFIG.wallHeight - 0.48, -world.height * CONFIG.cellSize * 0.39], [0, 0, Math.PI / 2]);
  }
  pipes.instanceMatrix.needsUpdate = true;
  pipes.userData.noRay = true;
  group.add(pipes);
}

function addSnowBanks(group, world) {
  const material = new THREE.MeshStandardMaterial({ color: 0xdbe7e9, roughness: 0.92 });
  const banks = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(2.4, 1), material, 12);
  for (let index = 0; index < 12; index += 1) {
    place(banks, index, [(index - 6) * 9, 0.4, -world.height * CONFIG.cellSize * 0.58], [0, index * 0.7, 0], [1 + index % 3 * 0.3, 0.32, 1]);
  }
  banks.instanceMatrix.needsUpdate = true;
  banks.userData.noRay = true;
  group.add(banks);
}

function addMissiles(group, material) {
  const bodies = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.72, 0.72, 6.8, 18), material, 5);
  const noses = new THREE.InstancedMesh(new THREE.ConeGeometry(0.72, 1.8, 18), material, 5);
  for (let index = 0; index < 5; index += 1) {
    place(bodies, index, [(index - 2) * 8, 3.4, -10]);
    place(noses, index, [(index - 2) * 8, 7.7, -10]);
  }
  bodies.instanceMatrix.needsUpdate = true; noses.instanceMatrix.needsUpdate = true;
  bodies.userData.noRay = true;
  noses.userData.noRay = true;
  group.add(bodies, noses);
}

function addTrees(group, world) {
  const trunk = new THREE.MeshStandardMaterial({ color: 0x3b2c20, roughness: 1 });
  const leaves = new THREE.MeshStandardMaterial({ color: 0x214c2b, roughness: 0.92 });
  const stems = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.18, 0.28, 4.5, 7), trunk, 28);
  const crowns = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1.8, 1), leaves, 28);
  for (let index = 0; index < 28; index += 1) {
    const angle = index / 28 * Math.PI * 2;
    const radius = Math.max(world.width, world.height) * CONFIG.cellSize * 0.58;
    const x = Math.cos(angle) * radius; const z = Math.sin(angle) * radius;
    place(stems, index, [x, 2.25, z], [0, angle, 0]);
    const size = 1 + index % 3 * 0.13;
    place(crowns, index, [x, 5.45, z], [0, angle, 0], [size, size, size]);
  }
  stems.instanceMatrix.needsUpdate = true; crowns.instanceMatrix.needsUpdate = true;
  stems.userData.noRay = true;
  crowns.userData.noRay = true;
  group.add(stems, crowns);
}

function openCells(world) {
  const cells = [];
  for (let z = 1; z < world.height - 1; z += 1) for (let x = 1; x < world.width - 1; x += 1) {
    if (world.walkable(x, z)) cells.push({ x, z });
  }
  return cells;
}

function place(mesh, index, position, rotation = [0, 0, 0], scale = [1, 1, 1]) {
  dummy.position.set(...position); dummy.rotation.set(...rotation); dummy.scale.set(...scale);
  dummy.updateMatrix(); mesh.setMatrixAt(index, dummy.matrix);
}
