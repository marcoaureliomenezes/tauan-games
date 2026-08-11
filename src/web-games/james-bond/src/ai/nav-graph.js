import * as YUKA from '../../../vendor/james-bond/yuka-0.7.8.module.js';

// Grid navigation graph for guard pathfinding: one node per walkable cell.
// `walkable` é o predicado do NÍVEL do guarda: térreo (corredores, sem a
// célula da escadaria) ou mezanino (só células de laje) — um inimigo nunca
// caminha onde não existe piso sólido no andar dele.
export function buildNavGraph(world, walkable = world.walkable) {
  const graph = new YUKA.Graph();
  const index = (x, z) => z * world.width + x;
  for (let z = 0; z < world.height; z += 1) {
    for (let x = 0; x < world.width; x += 1) {
      if (!walkable(x, z)) continue;
      graph.addNode(new YUKA.NavNode(index(x, z), world.toWorld({ x, z })));
    }
  }
  for (let z = 0; z < world.height; z += 1) {
    for (let x = 0; x < world.width; x += 1) {
      if (!walkable(x, z)) continue;
      [[1, 0], [0, 1]].forEach(([dx, dz]) => {
        if (walkable(x + dx, z + dz)) graph.addEdge(new YUKA.Edge(index(x, z), index(x + dx, z + dz), 1));
      });
    }
  }
  return { graph, index, walkable };
}

// A* crashes when the goal cell is a wall (e.g. player hugging a wall): snap to the
// nearest walkable cell in an expanding ring before searching. O raio maior serve o
// mezanino: o alvo (jogador no térreo) pode estar longe de qualquer célula de laje.
export function nearestWalkableCell(world, cell, walkable = world.walkable, maxRadius = 3) {
  if (walkable(cell.x, cell.z)) return cell;
  for (let radius = 1; radius <= maxRadius; radius += 1) {
    for (let dz = -radius; dz <= radius; dz += 1) {
      for (let dx = -radius; dx <= radius; dx += 1) {
        if (Math.max(Math.abs(dx), Math.abs(dz)) !== radius) continue;
        if (walkable(cell.x + dx, cell.z + dz)) return { x: cell.x + dx, z: cell.z + dz };
      }
    }
  }
  return null;
}
