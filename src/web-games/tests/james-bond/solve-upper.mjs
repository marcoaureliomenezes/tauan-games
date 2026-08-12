// Solver de andares: escolhe, por busca exaustiva, um par (laje, escadaria) por
// mezanino que satisfaça TODAS as invariantes de mapa ao mesmo tempo.
//
// Não faz parte da suíte — é a ferramenta que gerou os dados de `missions.js`.
// As mesmas invariantes viram assert permanente em unit.mjs.
import { MISSIONS } from '../../james-bond/src/content/missions.js';

const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const MARKERS = '#SABCEXG';

const find = (grid, marker) => {
  const z = grid.findIndex((row) => row.includes(marker));
  return [grid[z].indexOf(marker), z];
};

function flood(grid, start, blocked = new Set()) {
  const seen = new Set([start.join(',')]);
  const queue = [start];
  while (queue.length) {
    const [x, z] = queue.shift();
    for (const [dx, dz] of DIRS) {
      const next = [x + dx, z + dz];
      const key = next.join(',');
      if (grid[next[1]]?.[next[0]] !== '#' && !seen.has(key) && !blocked.has(key)) { seen.add(key); queue.push(next); }
    }
  }
  return seen;
}

const rectCells = ([x0, z0, x1, z1]) => {
  const cells = new Set();
  for (let z = z0; z <= z1; z += 1) for (let x = x0; x <= x1; x += 1) cells.add(`${x},${z}`);
  return cells;
};

/** A laje é transitável de ponta a ponta (paredes internas não a partem)? */
function slabConnected(rect, chars, landing) {
  const cells = rectCells(rect);
  const walkable = (x, z) => cells.has(`${x},${z}`) && chars[z]?.[x] !== '#';
  if (!walkable(landing.x, landing.z)) return null;
  const seen = new Set([`${landing.x},${landing.z}`]);
  const queue = [landing];
  while (queue.length) {
    const current = queue.shift();
    for (const [dx, dz] of DIRS) {
      const next = { x: current.x + dx, z: current.z + dz };
      const key = `${next.x},${next.z}`;
      if (seen.has(key) || !walkable(next.x, next.z)) continue;
      seen.add(key);
      queue.push(next);
    }
  }
  const total = [...cells].filter((key) => { const [x, z] = key.split(',').map(Number); return chars[z]?.[x] !== '#'; });
  return seen.size === total.length ? total.length : null;
}

/** Candidatos de escadaria para uma laje: célula externa encostada na borda. */
function stairOptions(rect, chars, grid, mustReach, start) {
  const cells = rectCells(rect);
  const options = [];
  const [x0, z0, x1, z1] = rect;
  for (let z = z0 - 1; z <= z1 + 1; z += 1) {
    for (let x = x0 - 1; x <= x1 + 1; x += 1) {
      if (cells.has(`${x},${z}`)) continue;
      const char = chars[z]?.[x];
      if (!char || MARKERS.includes(char)) continue;
      const direction = DIRS.find(([dx, dz]) => cells.has(`${x + dx},${z + dz}`) && chars[z + dz]?.[x + dx] !== '#'
        && chars[z - dz]?.[x - dx] && chars[z - dz][x - dx] !== '#');
      if (!direction) continue;
      // Bloquear a célula da escada não pode isolar nada no térreo.
      const reach = flood(grid, start, new Set([`${x},${z}`]));
      if (!mustReach.every((goal) => reach.has(goal))) continue;
      // O pé da escada tem de continuar acessível a partir do spawn.
      const foot = `${x - direction[0]},${z - direction[1]}`;
      if (!reach.has(foot)) continue;
      const landing = { x: x + direction[0], z: z + direction[1] };
      const slabSize = slabConnected(rect, chars, landing);
      if (!slabSize) continue;
      options.push({ stair: [x, z], direction, landing, slabSize });
    }
  }
  return options;
}

for (const mission of MISSIONS) {
  const chars = mission.grid.map((row) => row.split(''));
  const start = find(mission.grid, 'S');
  const mustReach = ['A', 'B', 'C', 'E'].map((marker) => find(mission.grid, marker).join(','));
  const report = [];
  for (const rect of mission.upper.slabs) {
    const options = stairOptions(rect, chars, mission.grid, mustReach, start);
    report.push({ rect, options });
  }
  console.log(`\n${mission.code}`);
  for (const { rect, options } of report) {
    const best = options[0];
    console.log('  laje', JSON.stringify(rect), best
      ? `escada ${JSON.stringify(best.stair)} dir ${JSON.stringify(best.direction)} laje-conectada ${best.slabSize} células (${options.length} opções)`
      : `SEM ESCADA VÁLIDA (${options.length} opções)`);
  }
}

// --- Varredura de retângulos alternativos para lajes sem escada válida -----
const SIZES = [[5, 3], [4, 3], [3, 3], [5, 2], [4, 2]];
for (const mission of MISSIONS) {
  const chars = mission.grid.map((row) => row.split(''));
  const start = find(mission.grid, 'S');
  const mustReach = ['A', 'B', 'C', 'E'].map((marker) => find(mission.grid, marker).join(','));
  const height = mission.grid.length;
  const width = mission.grid[0].length;
  for (const [index, rect] of mission.upper.slabs.entries()) {
    if (stairOptions(rect, chars, mission.grid, mustReach, start).length) continue;
    const other = mission.upper.slabs[1 - index];
    const found = [];
    for (const [w, h] of SIZES) {
      for (let z0 = 1; z0 + h - 1 < height - 1; z0 += 1) {
        for (let x0 = 1; x0 + w - 1 < width - 1; x0 += 1) {
          const candidate = [x0, z0, x0 + w - 1, z0 + h - 1];
          // não pode encostar/sobrepor a outra laje
          if (!(candidate[2] < other[0] - 1 || candidate[0] > other[2] + 1
             || candidate[3] < other[1] - 1 || candidate[1] > other[3] + 1)) continue;
          const walk = [...rectCells(candidate)].filter((k) => { const [x, z] = k.split(',').map(Number); return chars[z]?.[x] !== '#'; });
          if (walk.length < 8) continue;
          const options = stairOptions(candidate, chars, mission.grid, mustReach, start);
          if (options.length) found.push({ candidate, walk: walk.length, best: options[0] });
        }
      }
    }
    found.sort((a, b) => b.walk - a.walk);
    console.log(`\n${mission.code} laje ${JSON.stringify(rect)} → ${found.length} substitutas; melhores:`);
    for (const item of found.slice(0, 4)) {
      console.log('   ', JSON.stringify(item.candidate), 'células', item.walk, 'escada', JSON.stringify(item.best.stair), 'dir', JSON.stringify(item.best.direction));
    }
  }
}

// --- Busca CONJUNTA: as duas escadas bloqueiam o térreo ao mesmo tempo -----
// Validar cada escada isoladamente é insuficiente — foi o erro que deixou
// OP-04 com o spawn preso em 35 células.
console.log('\n=== PARES CONJUNTOS ===');
for (const mission of MISSIONS) {
  const chars = mission.grid.map((row) => row.split(''));
  const start = find(mission.grid, 'S');
  const mustReach = ['A', 'B', 'C', 'E'].map((marker) => find(mission.grid, marker).join(','));
  const perSlab = mission.upper.slabs.map((rect) => stairOptions(rect, chars, mission.grid, mustReach, start));
  let chosen = null;
  for (const a of perSlab[0]) {
    for (const b of perSlab[1]) {
      if (a.stair.join() === b.stair.join()) continue;
      const blocked = new Set([a.stair.join(','), b.stair.join(',')]);
      const reach = flood(mission.grid, start, blocked);
      if (!mustReach.every((goal) => reach.has(goal))) continue;
      const footA = `${a.stair[0] - a.direction[0]},${a.stair[1] - a.direction[1]}`;
      const footB = `${b.stair[0] - b.direction[0]},${b.stair[1] - b.direction[1]}`;
      if (!reach.has(footA) || !reach.has(footB)) continue;
      chosen = { a, b, ground: reach.size };
      break;
    }
    if (chosen) break;
  }
  console.log(mission.code, chosen
    ? `stairs: [[${chosen.a.stair}], [${chosen.b.stair}]]  térreo ${chosen.ground} células`
    : `SEM PAR VÁLIDO (${perSlab.map((o) => o.length).join('+')} opções)`);
}

// --- Busca conjunta COMPLETA (retângulos + escadas) para quem não fechou ---
console.log('\n=== BUSCA COMPLETA ===');
const SHAPES = [[5, 3], [4, 3], [3, 3], [5, 2], [3, 4]];
for (const mission of MISSIONS) {
  const chars = mission.grid.map((row) => row.split(''));
  const start = find(mission.grid, 'S');
  const mustReach = ['A', 'B', 'C', 'E'].map((marker) => find(mission.grid, marker).join(','));
  const perSlab = mission.upper.slabs.map((rect) => stairOptions(rect, chars, mission.grid, mustReach, start));
  const jointOk = perSlab[0].some((a) => perSlab[1].some((b) => {
    const reach = flood(mission.grid, start, new Set([a.stair.join(','), b.stair.join(',')]));
    return mustReach.every((g) => reach.has(g))
      && reach.has(`${a.stair[0] - a.direction[0]},${a.stair[1] - a.direction[1]}`)
      && reach.has(`${b.stair[0] - b.direction[0]},${b.stair[1] - b.direction[1]}`);
  }));
  if (jointOk) continue;

  const height = mission.grid.length;
  const width = mission.grid[0].length;
  const candidates = [];
  for (const [w, h] of SHAPES) {
    for (let z0 = 1; z0 + h - 1 < height - 1; z0 += 1) {
      for (let x0 = 1; x0 + w - 1 < width - 1; x0 += 1) {
        const rect = [x0, z0, x0 + w - 1, z0 + h - 1];
        const free = [...rectCells(rect)].filter((k) => { const [x, z] = k.split(',').map(Number); return chars[z]?.[x] !== '#'; });
        if (free.length < 9) continue;
        const options = stairOptions(rect, chars, mission.grid, mustReach, start);
        if (options.length) candidates.push({ rect, free: free.length, options });
      }
    }
  }
  candidates.sort((a, b) => b.free - a.free);
  let best = null;
  for (let i = 0; i < candidates.length && !best; i += 1) {
    for (let j = 0; j < candidates.length && !best; j += 1) {
      const A = candidates[i];
      const B = candidates[j];
      // lajes disjuntas e sem encostar
      if (!(A.rect[2] < B.rect[0] - 1 || A.rect[0] > B.rect[2] + 1 || A.rect[3] < B.rect[1] - 1 || A.rect[1] > B.rect[3] + 1)) continue;
      for (const a of A.options) {
        for (const b of B.options) {
          if (a.stair.join() === b.stair.join()) continue;
          const reach = flood(mission.grid, start, new Set([a.stair.join(','), b.stair.join(',')]));
          if (!mustReach.every((g) => reach.has(g))) continue;
          if (!reach.has(`${a.stair[0] - a.direction[0]},${a.stair[1] - a.direction[1]}`)) continue;
          if (!reach.has(`${b.stair[0] - b.direction[0]},${b.stair[1] - b.direction[1]}`)) continue;
          best = { A, B, a, b, ground: reach.size };
          break;
        }
        if (best) break;
      }
    }
  }
  console.log(mission.code, best
    ? `slabs: [[${best.A.rect}], [${best.B.rect}]], stairs: [[${best.a.stair}], [${best.b.stair}]] — laje ${best.A.free}+${best.B.free}, térreo ${best.ground}`
    : 'SEM SOLUÇÃO EM NENHUM RETÂNGULO');
}
