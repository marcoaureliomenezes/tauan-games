// Procedural city: street grid, destructible voxel structures, street props.
// Every structure is a lattice of cells; each cell has health and can be
// knocked out individually. Support is solved by flood-fill from the ground,
// so cutting a building's legs really does bring the top down.

import { mulberry32, clamp, v3 } from './math.js';
import { StaticMeshBuilder } from './geometry.js';

export const BLOCK = 62;      // block size in metres
export const ROAD = 16;       // road width
export const SPAN = BLOCK + ROAD;
export const GRID = 7;        // blocks per side
export const CITY_HALF = (GRID * SPAN) / 2;

const CELL = 2.5;             // voxel edge

const PALETTE = {
  concrete: [0.70, 0.69, 0.66],
  concreteDark: [0.55, 0.54, 0.52],
  brick: [0.55, 0.29, 0.22],
  sandstone: [0.78, 0.70, 0.55],
  glassTower: [0.42, 0.52, 0.60],
  warehouse: [0.48, 0.52, 0.55],
  roofTile: [0.42, 0.22, 0.17],
  roofFlat: [0.32, 0.32, 0.33],
  asphalt: [0.15, 0.155, 0.17],
  sidewalk: [0.56, 0.56, 0.54],
  grass: [0.24, 0.38, 0.18],
  paint: [0.85, 0.83, 0.55],
};

let nextStructureId = 1;

export class Structure {
  /**
   * @param {object} spec {x,z,w,d,h,type,name,color,roofColor}
   */
  constructor(spec) {
    this.id = nextStructureId++;
    this.type = spec.type;
    this.name = spec.name;
    this.color = spec.color;
    this.roofColor = spec.roofColor || PALETTE.roofFlat;

    this.nx = Math.max(2, Math.round(spec.w / CELL));
    this.nz = Math.max(2, Math.round(spec.d / CELL));
    this.ny = Math.max(1, Math.round(spec.h / CELL));

    this.cell = CELL;
    this.origin = v3(spec.x - (this.nx * CELL) / 2, 0, spec.z - (this.nz * CELL) / 2);
    this.center = v3(spec.x, (this.ny * CELL) / 2, spec.z);
    this.size = v3(this.nx * CELL, this.ny * CELL, this.nz * CELL);

    const n = this.nx * this.ny * this.nz;
    this.alive = new Uint8Array(n);
    this.health = new Float32Array(n);
    this.damage = new Float32Array(n);
    this.total = 0;

    // Hollow shell: keep the outer skin plus a structural core column so the
    // building is cheap to draw yet still collapses believably.
    const hollow = this.ny > 3 && this.nx > 3 && this.nz > 3;
    const baseHealth = spec.type === 'skyscraper' ? 165 : spec.type === 'warehouse' ? 85 : 110;
    for (let y = 0; y < this.ny; y++) {
      for (let z = 0; z < this.nz; z++) {
        for (let x = 0; x < this.nx; x++) {
          const shell = !hollow
            || x === 0 || x === this.nx - 1
            || z === 0 || z === this.nz - 1
            || y === 0 || y === this.ny - 1
            || (x === (this.nx >> 1) && z === (this.nz >> 1));
          if (!shell) continue;
          const i = this.index(x, y, z);
          this.alive[i] = 1;
          // Lower floors are beefier — the base resists, the top shatters.
          this.health[i] = baseHealth * (1.35 - 0.5 * (y / this.ny));
          this.total++;
        }
      }
    }
    this.destroyed = 0;
    this.dirty = true;
    this.shell = [];
    this.rebuildShell();
    this.isTarget = false;
  }

  index(x, y, z) { return (y * this.nz + z) * this.nx + x; }

  inBounds(x, y, z) {
    return x >= 0 && y >= 0 && z >= 0 && x < this.nx && y < this.ny && z < this.nz;
  }

  isAlive(x, y, z) {
    return this.inBounds(x, y, z) && this.alive[this.index(x, y, z)] === 1;
  }

  cellCenter(x, y, z, out = {}) {
    out.x = this.origin.x + (x + 0.5) * this.cell;
    out.y = this.origin.y + (y + 0.5) * this.cell;
    out.z = this.origin.z + (z + 0.5) * this.cell;
    return out;
  }

  /** Cells with at least one exposed face — the only ones worth drawing. */
  rebuildShell() {
    const out = [];
    for (let y = 0; y < this.ny; y++) {
      for (let z = 0; z < this.nz; z++) {
        for (let x = 0; x < this.nx; x++) {
          const i = this.index(x, y, z);
          if (!this.alive[i]) continue;
          const buried = this.isAlive(x + 1, y, z) && this.isAlive(x - 1, y, z)
            && this.isAlive(x, y + 1, z) && this.isAlive(x, y - 1, z)
            && this.isAlive(x, y, z + 1) && this.isAlive(x, y, z - 1);
          if (!buried) out.push(i);
        }
      }
    }
    this.shell = out;
    this.dirty = false;
  }

  get progress() {
    return this.total === 0 ? 1 : this.destroyed / this.total;
  }

  get isFlattened() { return this.progress >= 0.995; }

  /** Cells whose centre lies inside the sphere, nearest first. */
  cellsInSphere(px, py, pz, radius) {
    const c = this.cell;
    const x0 = Math.max(0, Math.floor((px - radius - this.origin.x) / c));
    const x1 = Math.min(this.nx - 1, Math.floor((px + radius - this.origin.x) / c));
    const y0 = Math.max(0, Math.floor((py - radius - this.origin.y) / c));
    const y1 = Math.min(this.ny - 1, Math.floor((py + radius - this.origin.y) / c));
    const z0 = Math.max(0, Math.floor((pz - radius - this.origin.z) / c));
    const z1 = Math.min(this.nz - 1, Math.floor((pz + radius - this.origin.z) / c));
    const found = [];
    const r2 = radius * radius;
    const tmp = {};
    for (let y = y0; y <= y1; y++) {
      for (let z = z0; z <= z1; z++) {
        for (let x = x0; x <= x1; x++) {
          const i = this.index(x, y, z);
          if (!this.alive[i]) continue;
          this.cellCenter(x, y, z, tmp);
          const dx = tmp.x - px, dy = tmp.y - py, dz = tmp.z - pz;
          const d2 = dx * dx + dy * dy + dz * dz;
          if (d2 <= r2) found.push({ x, y, z, i, d: Math.sqrt(d2) });
        }
      }
    }
    found.sort((a, b) => a.d - b.d);
    return found;
  }

  kill(i) {
    if (!this.alive[i]) return false;
    this.alive[i] = 0;
    this.destroyed++;
    this.dirty = true;
    return true;
  }

  /**
   * Flood-fill support from the ground layer. Returns the list of cell indices
   * that lost their load path and must fall.
   */
  findUnsupported() {
    const n = this.alive.length;
    const seen = new Uint8Array(n);
    const stack = [];
    for (let z = 0; z < this.nz; z++) {
      for (let x = 0; x < this.nx; x++) {
        const i = this.index(x, 0, z);
        if (this.alive[i]) { seen[i] = 1; stack.push([x, 0, z]); }
      }
    }
    while (stack.length) {
      const [x, y, z] = stack.pop();
      const neigh = [
        [x + 1, y, z], [x - 1, y, z], [x, y + 1, z],
        [x, y - 1, z], [x, y, z + 1], [x, y, z - 1],
      ];
      for (const [nx2, ny2, nz2] of neigh) {
        if (!this.inBounds(nx2, ny2, nz2)) continue;
        const j = this.index(nx2, ny2, nz2);
        if (this.alive[j] && !seen[j]) { seen[j] = 1; stack.push([nx2, ny2, nz2]); }
      }
    }
    const floating = [];
    for (let i = 0; i < n; i++) if (this.alive[i] && !seen[i]) floating.push(i);
    return floating;
  }

  cellCoords(i) {
    const x = i % this.nx;
    const z = Math.floor(i / this.nx) % this.nz;
    const y = Math.floor(i / (this.nx * this.nz));
    return { x, y, z };
  }

  /** Axis-aligned footprint test used by vehicle collision and traffic. */
  footprintOverlap(px, pz, radius) {
    const hx = this.size.x / 2 + radius;
    const hz = this.size.z / 2 + radius;
    return Math.abs(px - this.center.x) < hx && Math.abs(pz - this.center.z) < hz;
  }
}

const STREET_NAMES = [
  'Rua das Caçambas', 'Av. do Concreto', 'Rua Marreta', 'Av. Escombros',
  'Rua do Guindaste', 'Alameda Britadeira', 'Rua Pó de Pedra', 'Av. Estrutural',
];

function structureName(rand, type, gx, gz) {
  const street = STREET_NAMES[(gx * 3 + gz * 5) % STREET_NAMES.length];
  const number = 100 + Math.floor(rand() * 800);
  const label = {
    skyscraper: 'Torre Comercial',
    apartment: 'Edifício Residencial',
    house: 'Casa',
    warehouse: 'Galpão',
    shop: 'Loja',
    silo: 'Silo',
  }[type] || 'Estrutura';
  return `${label} — ${street}, ${number}`;
}

export function buildCity(seed = 20260725) {
  const rand = mulberry32(seed);
  const structures = [];
  const props = [];
  const builder = new StaticMeshBuilder();
  const parks = [];

  const half = CITY_HALF;
  // Ground plane (grass belt around the city + asphalt everywhere inside).
  builder.addFlatQuad(-half - 400, -half - 400, half + 400, half + 400, -0.06, PALETTE.grass, 0.95);
  builder.addFlatQuad(-half, -half, half, half, 0, PALETTE.asphalt, 0.82);

  const blockOrigin = (g) => -half + g * SPAN + ROAD / 2;

  // Lane markings down the middle of every road.
  for (let g = 0; g <= GRID; g++) {
    const c = -half + g * SPAN + ROAD / 2 - ROAD / 2 + ROAD / 2 - ROAD / 2;
    const roadCentre = -half + g * SPAN;
    for (let t = -half; t < half; t += 8) {
      builder.addFlatQuad(roadCentre - 0.22, t, roadCentre + 0.22, t + 4.2, 0.02, PALETTE.paint, 0.7);
      builder.addFlatQuad(t, roadCentre - 0.22, t + 4.2, roadCentre + 0.22, 0.02, PALETTE.paint, 0.7);
    }
    void c;
  }

  for (let gz = 0; gz < GRID; gz++) {
    for (let gx = 0; gx < GRID; gx++) {
      const bx = blockOrigin(gx) + BLOCK / 2;
      const bz = blockOrigin(gz) + BLOCK / 2;

      // Sidewalk slab + kerb for the whole block.
      builder.addBox(bx, 0.09, bz, BLOCK / 2 + 3, 0.09, BLOCK / 2 + 3, PALETTE.sidewalk, 0.9);

      const roll = rand();
      const isPark = roll < 0.13;
      const isDowntown = Math.abs(gx - (GRID - 1) / 2) + Math.abs(gz - (GRID - 1) / 2) <= 1;

      if (isPark) {
        builder.addFlatQuad(bx - BLOCK / 2, bz - BLOCK / 2, bx + BLOCK / 2, bz + BLOCK / 2, 0.2, PALETTE.grass, 0.95);
        parks.push({ x: bx, z: bz });
        for (let i = 0; i < 9; i++) {
          props.push({
            kind: 'tree',
            x: bx + (rand() - 0.5) * (BLOCK - 8),
            z: bz + (rand() - 0.5) * (BLOCK - 8),
            h: 4 + rand() * 3.5,
          });
        }
        continue;
      }

      // Split the block into 1..4 lots.
      const lots = [];
      if (isDowntown && rand() < 0.75) {
        lots.push({ x: bx, z: bz, w: BLOCK - 14, d: BLOCK - 14, type: 'skyscraper' });
      } else {
        const cols = rand() < 0.45 ? 1 : 2;
        const rows = rand() < 0.45 ? 1 : 2;
        const lw = (BLOCK - 10) / cols;
        const ld = (BLOCK - 10) / rows;
        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < cols; c++) {
            const t = rand();
            const type = t < 0.3 ? 'house' : t < 0.55 ? 'apartment' : t < 0.75 ? 'warehouse' : t < 0.9 ? 'shop' : 'silo';
            lots.push({
              x: bx - (BLOCK - 10) / 2 + lw * (c + 0.5),
              z: bz - (BLOCK - 10) / 2 + ld * (r + 0.5),
              w: lw - 5,
              d: ld - 5,
              type,
            });
          }
        }
      }

      for (const lot of lots) {
        let h, color, roofColor;
        switch (lot.type) {
          case 'skyscraper':
            h = 46 + rand() * 44; color = PALETTE.glassTower; roofColor = PALETTE.concreteDark; break;
          case 'apartment':
            h = 18 + rand() * 16; color = rand() < 0.5 ? PALETTE.concrete : PALETTE.sandstone; roofColor = PALETTE.roofFlat; break;
          case 'house':
            h = 6 + rand() * 3; color = rand() < 0.5 ? PALETTE.brick : PALETTE.sandstone; roofColor = PALETTE.roofTile; break;
          case 'warehouse':
            h = 9 + rand() * 4; color = PALETTE.warehouse; roofColor = PALETTE.roofFlat; break;
          case 'shop':
            h = 7 + rand() * 4; color = PALETTE.concrete; roofColor = PALETTE.roofFlat; break;
          default:
            h = 13 + rand() * 8; color = PALETTE.concreteDark; roofColor = PALETTE.concreteDark; break;
        }
        const w = clamp(lot.w * (0.72 + rand() * 0.2), 7, BLOCK);
        const d = clamp(lot.d * (0.72 + rand() * 0.2), 7, BLOCK);
        const s = new Structure({
          x: lot.x, z: lot.z, w, d, h,
          type: lot.type,
          color,
          roofColor,
          name: structureName(rand, lot.type, gx, gz),
        });
        structures.push(s);
      }

      // Street furniture along the kerb.
      for (let i = 0; i < 4; i++) {
        const side = i % 4;
        const off = BLOCK / 2 + 1.6;
        const jitter = (rand() - 0.5) * BLOCK * 0.7;
        const p = side === 0 ? { x: bx + jitter, z: bz - off }
          : side === 1 ? { x: bx + jitter, z: bz + off }
            : side === 2 ? { x: bx - off, z: bz + jitter }
              : { x: bx + off, z: bz + jitter };
        props.push({ kind: 'lamp', x: p.x, z: p.z, h: 6.5 });
      }
    }
  }

  return {
    structures,
    props,
    parks,
    staticMesh: builder.build(),
    palette: PALETTE,
    bounds: { half },
  };
}

/**
 * Uniform grid over the city so ball/vehicle queries touch a handful of
 * structures instead of all ~120.
 */
export class StructureIndex {
  constructor(structures, cellSize = SPAN) {
    this.cellSize = cellSize;
    this.map = new Map();
    this.structures = structures;
    for (const s of structures) this.insert(s);
  }

  key(cx, cz) { return `${cx}|${cz}`; }

  insert(s) {
    const x0 = Math.floor((s.center.x - s.size.x / 2) / this.cellSize);
    const x1 = Math.floor((s.center.x + s.size.x / 2) / this.cellSize);
    const z0 = Math.floor((s.center.z - s.size.z / 2) / this.cellSize);
    const z1 = Math.floor((s.center.z + s.size.z / 2) / this.cellSize);
    for (let cz = z0; cz <= z1; cz++) {
      for (let cx = x0; cx <= x1; cx++) {
        const k = this.key(cx, cz);
        if (!this.map.has(k)) this.map.set(k, []);
        this.map.get(k).push(s);
      }
    }
  }

  query(px, pz, radius) {
    const x0 = Math.floor((px - radius) / this.cellSize);
    const x1 = Math.floor((px + radius) / this.cellSize);
    const z0 = Math.floor((pz - radius) / this.cellSize);
    const z1 = Math.floor((pz + radius) / this.cellSize);
    const out = new Set();
    for (let cz = z0; cz <= z1; cz++) {
      for (let cx = x0; cx <= x1; cx++) {
        const list = this.map.get(this.key(cx, cz));
        if (list) for (const s of list) out.add(s);
      }
    }
    return out;
  }
}
