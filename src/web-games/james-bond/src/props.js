import * as THREE from '../../vendor/three.module.min.js';
import { CONFIG } from './config.js';
import { createRandom, hashSeed } from './random.js';

// Mobiliário dos mapas: engradados, tambores, prateleiras, terminais, luminárias
// e quadros de parede. Tudo procedural e instanciado — uma InstancedMesh por
// tipo de prop, então o custo de draw call não cresce com a quantidade.
//
// Engradados e tambores são CENÁRIO DESTRUTÍVEL: registram-se em world.props
// (gameplay/destructibles.js), ganham colisor próprio, tomam dano de tiro e são
// arremessados pela onda de choque. Mobília encostada na parede (prateleira,
// terminal, quadro, luminária, cano) segue sendo enfeite sem colisor.

const dummy = new THREE.Object3D();

/** Células abertas com a contagem de paredes vizinhas (props gostam de canto). */
function openCells(world) {
  const cells = [];
  for (let z = 1; z < world.height - 1; z += 1) {
    for (let x = 1; x < world.width - 1; x += 1) {
      if (!world.walkable(x, z)) continue;
      // Mobiliário é de INTERIOR: engradado, prateleira e terminal só entram em
      // piso de construção (`.`). Rua, calçada e vão de porta recebem o
      // mobiliário urbano de city.js — pôr estante no meio do asfalto foi o
      // tipo de coisa que fazia o mapa parecer um labirinto genérico.
      const char = world.chars[z][x];
      if (char !== '.') continue;
      let walls = 0;
      const sides = [];
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        if (!world.walkable(x + dx, z + dz)) { walls += 1; sides.push([dx, dz]); }
      }
      cells.push({ x, z, walls, sides });
    }
  }
  return cells;
}

export function addProps(group, mission, world, materials) {
  const random = createRandom(hashSeed(`${mission.code}-props`));
  const stairCells = new Set((mission.upper?.stairs || []).map(([x, z]) => `${x},${z}`));
  const cells = openCells(world).filter((cell) => !stairCells.has(`${cell.x},${cell.z}`));
  const cornered = cells.filter((cell) => cell.walls >= 1);
  shuffle(cornered, random);

  const budget = { crates: 18, barrels: 10, shelves: 8, terminals: 6, cables: 12 };
  const taken = new Set();
  const pick = (count) => {
    const chosen = [];
    for (const cell of cornered) {
      if (chosen.length >= count) break;
      if (taken.has(`${cell.x},${cell.z}`)) continue;
      taken.add(`${cell.x},${cell.z}`);
      chosen.push(cell);
    }
    return chosen;
  };

  addCrates(group, world, pick(budget.crates), random, mission);
  addBarrels(group, world, pick(budget.barrels), random);
  addShelves(group, world, pick(budget.shelves), random);
  addTerminals(group, world, pick(budget.terminals), random, mission);
  addWallArt(group, world, cells, random, mission);
  addCeilingLamps(group, world, cells, random, mission);
  addPipesAndCables(group, world, pick(budget.cables), random);
}

/** Engradados de madeira, às vezes empilhados. */
function addCrates(group, world, cells, random, mission) {
  if (!cells.length) return;
  const plan = [];
  for (const cell of cells) {
    const base = world.toWorld(cell);
    const size = 0.72 + random() * 0.3;
    const offset = edgeOffset(cell, random);
    plan.push({ x: base.x + offset.x, z: base.z + offset.z, y: size / 2, size, rot: random() * Math.PI });
    if (random() > 0.55) {
      const small = size * (0.6 + random() * 0.22);
      plan.push({ x: base.x + offset.x + (random() - 0.5) * 0.2, z: base.z + offset.z + (random() - 0.5) * 0.2, y: size + small / 2, size: small, rot: random() * Math.PI });
    }
  }
  const wood = new THREE.MeshStandardMaterial({ color: mission.code === 'OP-03' ? 0x6d7377 : 0x6b5433, roughness: 0.88, metalness: 0.05 });
  const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), wood, plan.length);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  const tint = new THREE.Color();
  plan.forEach((item, index) => {
    place(mesh, index, [item.x, item.y, item.z], [0, item.rot, 0], [item.size, item.size, item.size]);
    mesh.setColorAt(index, tint.setScalar(0.82 + random() * 0.34));
  });
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  mesh.instanceMatrix.needsUpdate = true;
  group.add(mesh);
  // Engradado é obstáculo de verdade: sólido, atingível a tiro e leve o
  // bastante para a explosão o mandar longe. Não explode — estilhaça.
  world.props?.registerInstanced(mesh, plan.map((item, index) => ({
    kind: 'crate', index, position: { x: item.x, y: item.y, z: item.z },
    groundY: item.y, yaw: item.rot, scale: item.size,
    health: 70, mass: 1.1, hitHalf: item.size / 2, debrisColor: 0x6b5433,
  })));
}

/** Tambores metálicos decorativos (os explosivos são os 'X' do grid). */
function addBarrels(group, world, cells, random) {
  if (!cells.length) return;
  const material = new THREE.MeshStandardMaterial({ color: 0x4a5750, roughness: 0.62, metalness: 0.55 });
  const mesh = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.4, 0.4, 1.2, 12), material, cells.length);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  const tint = new THREE.Color();
  const plan = [];
  cells.forEach((cell, index) => {
    const base = world.toWorld(cell);
    const offset = edgeOffset(cell, random);
    const spot = { x: base.x + offset.x, y: 0.6, z: base.z + offset.z, rot: random() * Math.PI };
    plan.push(spot);
    place(mesh, index, [spot.x, spot.y, spot.z], [0, spot.rot, 0]);
    mesh.setColorAt(index, tint.setHSL(0.08 + random() * 0.5, 0.18, 0.34 + random() * 0.16));
  });
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  mesh.instanceMatrix.needsUpdate = true;
  group.add(mesh);
  // Tambor de metal: sólido, amassa a tiro e rola longe na onda de choque.
  world.props?.registerInstanced(mesh, plan.map((spot, index) => ({
    kind: 'drum', index, position: { x: spot.x, y: spot.y, z: spot.z },
    groundY: spot.y, yaw: spot.rot,
    health: 95, mass: 1.3, hitHalf: 0.42, debrisColor: 0x4a5750,
  })));
}

/** Estantes/armários encostados na parede. */
function addShelves(group, world, cells, random) {
  const wallSided = cells.filter((cell) => cell.sides.length);
  if (!wallSided.length) return;
  const frame = new THREE.MeshStandardMaterial({ color: 0x39413c, roughness: 0.72, metalness: 0.42 });
  const shelfGeometry = new THREE.BoxGeometry(1.5, 2.05, 0.46);
  const mesh = new THREE.InstancedMesh(shelfGeometry, frame, wallSided.length);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  // Prateleiras internas: uma instância por bandeja, coladas ao mesmo lugar.
  const trayGeometry = new THREE.BoxGeometry(1.42, 0.05, 0.42);
  const trays = new THREE.InstancedMesh(trayGeometry, frame, wallSided.length * 3);
  wallSided.forEach((cell, index) => {
    const base = world.toWorld(cell);
    const [dx, dz] = cell.sides[0];
    const angle = Math.atan2(dx, dz);
    const x = base.x + dx * CONFIG.cellSize * 0.31;
    const z = base.z + dz * CONFIG.cellSize * 0.31;
    place(mesh, index, [x, 1.02, z], [0, angle, 0]);
    [0.5, 1.05, 1.6].forEach((height, row) => {
      place(trays, index * 3 + row, [x, height, z], [0, angle, 0]);
    });
  });
  mesh.instanceMatrix.needsUpdate = true;
  trays.instanceMatrix.needsUpdate = true;
  group.add(mesh, trays);
}

/** Terminais de computador com tela acesa — dão vida e leem como "instalação". */
function addTerminals(group, world, cells, random, mission) {
  const wallSided = cells.filter((cell) => cell.sides.length);
  if (!wallSided.length) return;
  const body = new THREE.MeshStandardMaterial({ color: 0x2b322f, roughness: 0.66, metalness: 0.44 });
  const screenMaterial = new THREE.MeshBasicMaterial({ color: mission.palette.accent, toneMapped: false });
  const desks = new THREE.InstancedMesh(new THREE.BoxGeometry(1.35, 0.75, 0.6), body, wallSided.length);
  const monitors = new THREE.InstancedMesh(new THREE.BoxGeometry(0.62, 0.44, 0.08), body, wallSided.length);
  const screens = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.52, 0.34), screenMaterial, wallSided.length);
  wallSided.forEach((cell, index) => {
    const base = world.toWorld(cell);
    const [dx, dz] = cell.sides[0];
    const angle = Math.atan2(dx, dz);
    const x = base.x + dx * CONFIG.cellSize * 0.3;
    const z = base.z + dz * CONFIG.cellSize * 0.3;
    place(desks, index, [x, 0.38, z], [0, angle, 0]);
    place(monitors, index, [x, 0.98, z], [0, angle, 0]);
    // A tela olha para dentro da sala (sentido oposto à parede).
    place(screens, index, [x - dx * 0.05, 0.98, z - dz * 0.05], [0, angle + Math.PI, 0]);
  });
  [desks, monitors, screens].forEach((mesh) => { mesh.instanceMatrix.needsUpdate = true; });
  screens.userData.noRay = true;
  group.add(desks, monitors, screens);
}

/**
 * Quadros e cartazes nas paredes. Seis texturas procedurais são compartilhadas
 * por InstancedMesh (uma malha por textura) — assim dá para ter dezenas de
 * quadros sem uma textura por moldura.
 */
function addWallArt(group, world, cells, random, mission) {
  const spots = cells.filter((cell) => cell.sides.length && random() > 0.62).slice(0, 34);
  if (!spots.length) return;
  const buckets = Array.from({ length: 6 }, () => []);
  spots.forEach((cell, index) => buckets[index % 6].push(cell));

  const frameMaterial = new THREE.MeshStandardMaterial({ color: 0x1d211f, roughness: 0.7, metalness: 0.3 });
  const frames = new THREE.InstancedMesh(new THREE.BoxGeometry(1.06, 0.8, 0.06), frameMaterial, spots.length);
  let frameIndex = 0;

  buckets.forEach((bucket, kind) => {
    if (!bucket.length) return;
    const texture = artTexture(kind, mission, `${mission.code}-art-${kind}`);
    const material = new THREE.MeshBasicMaterial({ map: texture, toneMapped: false });
    const art = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.92, 0.66), material, bucket.length);
    bucket.forEach((cell, index) => {
      const base = world.toWorld(cell);
      const [dx, dz] = cell.sides[Math.floor(random() * cell.sides.length)] || cell.sides[0];
      const angle = Math.atan2(dx, dz);
      const height = 1.6 + random() * 0.35;
      const x = base.x + dx * CONFIG.cellSize * 0.47;
      const z = base.z + dz * CONFIG.cellSize * 0.47;
      place(frames, frameIndex, [x, height, z], [0, angle, 0]);
      frameIndex += 1;
      // A arte fica um dedo à frente da moldura, virada para a sala.
      place(art, index, [x - dx * 0.045, height, z - dz * 0.045], [0, angle + Math.PI, 0]);
    });
    art.instanceMatrix.needsUpdate = true;
    art.userData.noRay = true;
    art.userData.artTexture = texture;
    group.add(art);
  });
  frames.count = frameIndex;
  frames.instanceMatrix.needsUpdate = true;
  group.add(frames);
}

/** Luminárias suspensas espalhadas pelos corredores. */
function addCeilingLamps(group, world, cells, random, mission) {
  const spots = cells.filter((cell) => (cell.x * 5 + cell.z * 7) % 11 === 0).slice(0, 22);
  if (!spots.length) return;
  const shade = new THREE.MeshStandardMaterial({ color: 0x22282a, roughness: 0.6, metalness: 0.5, side: THREE.DoubleSide });
  const bulb = new THREE.MeshBasicMaterial({ color: 0xfff0cf, toneMapped: false });
  const shades = new THREE.InstancedMesh(new THREE.ConeGeometry(0.34, 0.28, 12, 1, true), shade, spots.length);
  const bulbs = new THREE.InstancedMesh(new THREE.SphereGeometry(0.09, 8, 6), bulb, spots.length);
  const stems = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.02, 0.02, 0.4, 6), shade, spots.length);
  spots.forEach((cell, index) => {
    const base = world.toWorld(cell);
    const y = CONFIG.wallHeight - 0.42;
    place(shades, index, [base.x, y, base.z], [Math.PI, 0, 0]);
    place(bulbs, index, [base.x, y - 0.12, base.z]);
    place(stems, index, [base.x, y + 0.28, base.z]);
  });
  [shades, bulbs, stems].forEach((mesh) => { mesh.instanceMatrix.needsUpdate = true; mesh.userData.noRay = true; });
  group.add(shades, bulbs, stems);
}

/** Canos e feixes de cabos correndo rente ao teto. */
function addPipesAndCables(group, world, cells, random) {
  const wallSided = cells.filter((cell) => cell.sides.length);
  if (!wallSided.length) return;
  const material = new THREE.MeshStandardMaterial({ color: 0x4b524d, roughness: 0.55, metalness: 0.62 });
  const pipes = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.09, 0.09, CONFIG.cellSize, 8), material, wallSided.length * 2);
  wallSided.forEach((cell, index) => {
    const base = world.toWorld(cell);
    const [dx, dz] = cell.sides[0];
    const along = dx !== 0 ? [0, 0, Math.PI / 2] : [Math.PI / 2, 0, 0];
    const x = base.x + dx * CONFIG.cellSize * 0.42;
    const z = base.z + dz * CONFIG.cellSize * 0.42;
    place(pipes, index * 2, [x, CONFIG.wallHeight - 0.3, z], along);
    place(pipes, index * 2 + 1, [x, CONFIG.wallHeight - 0.52, z], along);
  });
  pipes.instanceMatrix.needsUpdate = true;
  pipes.userData.noRay = true;
  group.add(pipes);
}

/**
 * Seis estilos de quadro gerados em canvas: mapa de operação, retrato
 * institucional, cartaz de aviso, esquema técnico, foto de satélite e
 * bandeirola. Nenhuma imagem externa é carregada.
 */
function artTexture(kind, mission, seed) {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = Math.round(size * 0.72);
  const context = canvas.getContext('2d');
  const random = createRandom(hashSeed(seed));
  const accent = `#${new THREE.Color(mission.palette.accent).getHexString()}`;
  const height = canvas.height;

  context.fillStyle = '#0f1412';
  context.fillRect(0, 0, size, height);

  if (kind === 0) { // mapa de operação
    context.fillStyle = '#16241d';
    context.fillRect(0, 0, size, height);
    context.strokeStyle = accent;
    context.lineWidth = 1;
    for (let i = 0; i < 7; i += 1) {
      context.strokeRect(random() * size * 0.7, random() * height * 0.7, 16 + random() * 40, 12 + random() * 28);
    }
    context.fillStyle = accent;
    context.fillRect(size * 0.62, height * 0.6, 10, 10);
  } else if (kind === 1) { // retrato institucional
    context.fillStyle = '#20262b';
    context.fillRect(0, 0, size, height);
    context.fillStyle = '#39424a';
    context.beginPath();
    context.arc(size / 2, height * 0.44, height * 0.2, 0, Math.PI * 2);
    context.fill();
    context.fillRect(size / 2 - height * 0.26, height * 0.66, height * 0.52, height * 0.34);
    context.fillStyle = '#0d1113';
    context.fillRect(0, height - 12, size, 12);
  } else if (kind === 2) { // cartaz de aviso
    context.fillStyle = '#c8a52e';
    context.fillRect(0, 0, size, height);
    context.fillStyle = '#101010';
    for (let i = -height; i < size; i += 22) {
      context.beginPath();
      context.moveTo(i, 0);
      context.lineTo(i + 11, 0);
      context.lineTo(i + 11 + height, height);
      context.lineTo(i + height, height);
      context.fill();
    }
    context.fillStyle = '#101010';
    context.fillRect(size * 0.2, height * 0.36, size * 0.6, height * 0.28);
  } else if (kind === 3) { // esquema técnico
    context.strokeStyle = '#5f8fa8';
    context.lineWidth = 1;
    for (let i = 0; i < 9; i += 1) {
      context.beginPath();
      const y = height * (i + 1) / 10;
      context.moveTo(6, y);
      context.lineTo(size - 6, y);
      context.stroke();
    }
    context.strokeStyle = accent;
    context.strokeRect(size * 0.18, height * 0.2, size * 0.4, height * 0.5);
    context.beginPath();
    context.arc(size * 0.74, height * 0.46, height * 0.17, 0, Math.PI * 2);
    context.stroke();
  } else if (kind === 4) { // foto de satélite
    for (let i = 0; i < 220; i += 1) {
      const shade = 30 + random() * 90;
      context.fillStyle = `rgb(${shade},${shade + 8},${shade - 6})`;
      context.fillRect(random() * size, random() * height, 5 + random() * 12, 4 + random() * 10);
    }
    context.strokeStyle = accent;
    context.lineWidth = 1;
    context.strokeRect(size * 0.4, height * 0.34, 22, 18);
  } else { // bandeirola / brasão
    context.fillStyle = '#2a1c1c';
    context.fillRect(0, 0, size, height);
    context.fillStyle = accent;
    context.beginPath();
    context.moveTo(size / 2, height * 0.16);
    context.lineTo(size * 0.76, height * 0.5);
    context.lineTo(size / 2, height * 0.86);
    context.lineTo(size * 0.24, height * 0.5);
    context.closePath();
    context.fill();
  }

  // Vidro: um brilho diagonal fraco por cima de tudo.
  const gloss = context.createLinearGradient(0, 0, size, height);
  gloss.addColorStop(0, 'rgba(255,255,255,.12)');
  gloss.addColorStop(0.5, 'rgba(255,255,255,0)');
  context.fillStyle = gloss;
  context.fillRect(0, 0, size, height);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/** Desloca o prop para junto da parede vizinha, em vez do centro da célula. */
function edgeOffset(cell, random) {
  const side = cell.sides[Math.floor(random() * cell.sides.length)] || [0, 0];
  const distance = CONFIG.cellSize * 0.28;
  return { x: side[0] * distance, z: side[1] * distance };
}

function shuffle(list, random) {
  for (let i = list.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
}

function place(mesh, index, position, rotation = [0, 0, 0], scale = [1, 1, 1]) {
  dummy.position.set(...position);
  dummy.rotation.set(...rotation);
  dummy.scale.set(...scale);
  dummy.updateMatrix();
  mesh.setMatrixAt(index, dummy.matrix);
}
