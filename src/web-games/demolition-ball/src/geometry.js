// Procedural primitives. Every instanced primitive is unit-sized so the
// per-instance `scale` attribute doubles as the half-extent / radius.

function mesh(vertices, indices, layout) {
  return {
    vertices: new Float32Array(vertices),
    indices: new Uint32Array(indices),
    layout,
    stride: layout.reduce((a, b) => a + b, 0),
  };
}

/** Unit cube spanning [-1,1]^3, flat normals. */
export function boxMesh() {
  const faces = [
    { n: [0, 0, 1], u: [1, 0, 0], v: [0, 1, 0] },
    { n: [0, 0, -1], u: [-1, 0, 0], v: [0, 1, 0] },
    { n: [1, 0, 0], u: [0, 0, -1], v: [0, 1, 0] },
    { n: [-1, 0, 0], u: [0, 0, 1], v: [0, 1, 0] },
    { n: [0, 1, 0], u: [1, 0, 0], v: [0, 0, -1] },
    { n: [0, -1, 0], u: [1, 0, 0], v: [0, 0, 1] },
  ];
  const verts = [];
  const idx = [];
  faces.forEach((f, fi) => {
    const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
    for (const [cu, cv] of corners) {
      verts.push(
        f.n[0] + f.u[0] * cu + f.v[0] * cv,
        f.n[1] + f.u[1] * cu + f.v[1] * cv,
        f.n[2] + f.u[2] * cu + f.v[2] * cv,
        f.n[0], f.n[1], f.n[2],
      );
    }
    const b = fi * 4;
    idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
  });
  return mesh(verts, idx, [3, 3]);
}

/** Unit sphere, radius 1. */
export function sphereMesh(segments = 20, rings = 14) {
  const verts = [];
  const idx = [];
  for (let y = 0; y <= rings; y++) {
    const phi = (y / rings) * Math.PI;
    for (let x = 0; x <= segments; x++) {
      const theta = (x / segments) * Math.PI * 2;
      const nx = Math.sin(phi) * Math.cos(theta);
      const ny = Math.cos(phi);
      const nz = Math.sin(phi) * Math.sin(theta);
      verts.push(nx, ny, nz, nx, ny, nz);
    }
  }
  for (let y = 0; y < rings; y++) {
    for (let x = 0; x < segments; x++) {
      const a = y * (segments + 1) + x;
      const b = a + segments + 1;
      idx.push(a, b, a + 1, a + 1, b, b + 1);
    }
  }
  return mesh(verts, idx, [3, 3]);
}

/** Unit cylinder: radius 1 on XZ, height 2 along Y (from -1 to 1). */
export function cylinderMesh(segments = 18) {
  const verts = [];
  const idx = [];
  // Side
  for (let i = 0; i <= segments; i++) {
    const t = (i / segments) * Math.PI * 2;
    const nx = Math.cos(t), nz = Math.sin(t);
    verts.push(nx, -1, nz, nx, 0, nz);
    verts.push(nx, 1, nz, nx, 0, nz);
  }
  for (let i = 0; i < segments; i++) {
    const a = i * 2;
    idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
  }
  // Caps
  for (const dir of [1, -1]) {
    const base = verts.length / 6;
    verts.push(0, dir, 0, 0, dir, 0);
    for (let i = 0; i <= segments; i++) {
      const t = (i / segments) * Math.PI * 2;
      verts.push(Math.cos(t), dir, Math.sin(t), 0, dir, 0);
    }
    for (let i = 0; i < segments; i++) {
      if (dir > 0) idx.push(base, base + 1 + i, base + 2 + i);
      else idx.push(base, base + 2 + i, base + 1 + i);
    }
  }
  return mesh(verts, idx, [3, 3]);
}

/** Screen-space quad used by the sky pass (two triangles at the far plane). */
export function fullscreenQuad() {
  return {
    vertices: new Float32Array([-1, -1, 3, -1, -1, 3]),
    indices: new Uint32Array([0, 1, 2]),
    layout: [2],
    stride: 2,
  };
}

/** Unit billboard quad for particles. */
export function quadMesh() {
  return mesh(
    [-1, -1, 1, -1, 1, 1, -1, 1],
    [0, 1, 2, 0, 2, 3],
    [2],
  );
}

/** Accumulates arbitrary static geometry (streets, sidewalks, parks). */
export class StaticMeshBuilder {
  constructor() {
    this.verts = [];
    this.idx = [];
  }

  /** Horizontal quad (facing +Y) from x0,z0 to x1,z1 at height y. */
  addFlatQuad(x0, z0, x1, z1, y, color, roughness) {
    const b = this.verts.length / 10;
    const pts = [[x0, z0], [x1, z0], [x1, z1], [x0, z1]];
    for (const [x, z] of pts) {
      this.verts.push(x, y, z, 0, 1, 0, color[0], color[1], color[2], roughness);
    }
    this.idx.push(b, b + 2, b + 1, b, b + 3, b + 2);
  }

  /** Axis-aligned box (kerbs, medians, plinths). */
  addBox(cx, cy, cz, hx, hy, hz, color, roughness) {
    const box = boxMesh();
    const b = this.verts.length / 10;
    for (let i = 0; i < box.vertices.length; i += 6) {
      this.verts.push(
        cx + box.vertices[i] * hx,
        cy + box.vertices[i + 1] * hy,
        cz + box.vertices[i + 2] * hz,
        box.vertices[i + 3], box.vertices[i + 4], box.vertices[i + 5],
        color[0], color[1], color[2], roughness,
      );
    }
    for (let i = 0; i < box.indices.length; i++) this.idx.push(b + box.indices[i]);
  }

  build() {
    return {
      vertices: new Float32Array(this.verts),
      indices: new Uint32Array(this.idx),
      layout: [3, 3, 4],
      stride: 10,
    };
  }
}
