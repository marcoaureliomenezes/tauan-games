// Minimal linear-algebra kit for the Demolition Ball engine.
// Vectors are plain {x,y,z}; matrices are Float32Array(16), column-major (GL order).

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const smoothstep = (t) => t * t * (3 - 2 * t);
export const TAU = Math.PI * 2;

export function wrapAngle(a) {
  while (a > Math.PI) a -= TAU;
  while (a < -Math.PI) a += TAU;
  return a;
}

// ---------------------------------------------------------------- vec3
export const v3 = (x = 0, y = 0, z = 0) => ({ x, y, z });
export const vclone = (a) => ({ x: a.x, y: a.y, z: a.z });
export const vset = (o, x, y, z) => { o.x = x; o.y = y; o.z = z; return o; };
export const vcopy = (o, a) => { o.x = a.x; o.y = a.y; o.z = a.z; return o; };
export const vadd = (a, b) => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });
export const vsub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
export const vscale = (a, s) => ({ x: a.x * s, y: a.y * s, z: a.z * s });
export const vaddScaled = (a, b, s) => ({ x: a.x + b.x * s, y: a.y + b.y * s, z: a.z + b.z * s });
export const vdot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
export const vlen = (a) => Math.hypot(a.x, a.y, a.z);
export const vlen2 = (a) => a.x * a.x + a.y * a.y + a.z * a.z;
export const vdist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
export const vcross = (a, b) => ({
  x: a.y * b.z - a.z * b.y,
  y: a.z * b.x - a.x * b.z,
  z: a.x * b.y - a.y * b.x,
});
export function vnorm(a) {
  const l = vlen(a);
  return l > 1e-9 ? { x: a.x / l, y: a.y / l, z: a.z / l } : { x: 0, y: 0, z: 0 };
}
export const vlerp = (a, b, t) => ({
  x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t), z: lerp(a.z, b.z, t),
});

// ---------------------------------------------------------------- quat
// Quaternions are {x,y,z,w}.
export const qidentity = () => ({ x: 0, y: 0, z: 0, w: 1 });

export function qFromAxisAngle(axis, angle) {
  const n = vnorm(axis);
  const h = angle * 0.5;
  const s = Math.sin(h);
  return { x: n.x * s, y: n.y * s, z: n.z * s, w: Math.cos(h) };
}

export function qFromEuler(pitch, yaw, roll) {
  const cy = Math.cos(yaw * 0.5), sy = Math.sin(yaw * 0.5);
  const cp = Math.cos(pitch * 0.5), sp = Math.sin(pitch * 0.5);
  const cr = Math.cos(roll * 0.5), sr = Math.sin(roll * 0.5);
  return {
    x: sp * cy * cr + cp * sy * sr,
    y: cp * sy * cr - sp * cy * sr,
    z: cp * cy * sr - sp * sy * cr,
    w: cp * cy * cr + sp * sy * sr,
  };
}

export function qmul(a, b) {
  return {
    x: a.w * b.x + a.x * b.w + a.y * b.z - a.z * b.y,
    y: a.w * b.y - a.x * b.z + a.y * b.w + a.z * b.x,
    z: a.w * b.z + a.x * b.y - a.y * b.x + a.z * b.w,
    w: a.w * b.w - a.x * b.x - a.y * b.y - a.z * b.z,
  };
}

export function qnorm(q) {
  const l = Math.hypot(q.x, q.y, q.z, q.w) || 1;
  return { x: q.x / l, y: q.y / l, z: q.z / l, w: q.w / l };
}

/** Integrate a quaternion by an angular velocity (rad/s) over dt. */
export function qIntegrate(q, omega, dt) {
  const half = { x: omega.x * dt * 0.5, y: omega.y * dt * 0.5, z: omega.z * dt * 0.5, w: 0 };
  const d = qmul(half, q);
  return qnorm({ x: q.x + d.x, y: q.y + d.y, z: q.z + d.z, w: q.w + d.w });
}

export function qRotate(q, v) {
  // v' = v + 2 * cross(q.xyz, cross(q.xyz, v) + q.w * v)
  const t = vcross({ x: q.x, y: q.y, z: q.z }, vaddScaled(vcross({ x: q.x, y: q.y, z: q.z }, v), v, q.w));
  return vaddScaled(v, t, 2);
}

// ---------------------------------------------------------------- mat4
export const m4 = () => new Float32Array(16);

export function m4identity(o = m4()) {
  o.fill(0); o[0] = o[5] = o[10] = o[15] = 1; return o;
}

export function m4perspective(fovy, aspect, near, far, o = m4()) {
  const f = 1 / Math.tan(fovy / 2);
  o.fill(0);
  o[0] = f / aspect; o[5] = f; o[11] = -1;
  o[10] = (far + near) / (near - far);
  o[14] = (2 * far * near) / (near - far);
  return o;
}

export function m4ortho(l, r, b, t, n, f, o = m4()) {
  o.fill(0);
  o[0] = 2 / (r - l); o[5] = 2 / (t - b); o[10] = -2 / (f - n);
  o[12] = -(r + l) / (r - l); o[13] = -(t + b) / (t - b); o[14] = -(f + n) / (f - n);
  o[15] = 1;
  return o;
}

export function m4lookAt(eye, target, up, o = m4()) {
  const z = vnorm(vsub(eye, target));
  let x = vcross(up, z);
  if (vlen2(x) < 1e-12) x = vcross({ x: 0, y: 0, z: 1 }, z);
  x = vnorm(x);
  const y = vcross(z, x);
  o[0] = x.x; o[1] = y.x; o[2] = z.x; o[3] = 0;
  o[4] = x.y; o[5] = y.y; o[6] = z.y; o[7] = 0;
  o[8] = x.z; o[9] = y.z; o[10] = z.z; o[11] = 0;
  o[12] = -vdot(x, eye); o[13] = -vdot(y, eye); o[14] = -vdot(z, eye); o[15] = 1;
  return o;
}

export function m4mul(a, b, o = m4()) {
  for (let c = 0; c < 4; c++) {
    const b0 = b[c * 4], b1 = b[c * 4 + 1], b2 = b[c * 4 + 2], b3 = b[c * 4 + 3];
    o[c * 4] = a[0] * b0 + a[4] * b1 + a[8] * b2 + a[12] * b3;
    o[c * 4 + 1] = a[1] * b0 + a[5] * b1 + a[9] * b2 + a[13] * b3;
    o[c * 4 + 2] = a[2] * b0 + a[6] * b1 + a[10] * b2 + a[14] * b3;
    o[c * 4 + 3] = a[3] * b0 + a[7] * b1 + a[11] * b2 + a[15] * b3;
  }
  return o;
}

/** Axis-aligned box overlap test against a sphere. Returns penetration info or null. */
export function sphereVsBox(center, radius, boxCenter, boxHalf) {
  const cx = clamp(center.x, boxCenter.x - boxHalf.x, boxCenter.x + boxHalf.x);
  const cy = clamp(center.y, boxCenter.y - boxHalf.y, boxCenter.y + boxHalf.y);
  const cz = clamp(center.z, boxCenter.z - boxHalf.z, boxCenter.z + boxHalf.z);
  const dx = center.x - cx, dy = center.y - cy, dz = center.z - cz;
  const d2 = dx * dx + dy * dy + dz * dz;
  if (d2 > radius * radius) return null;
  const d = Math.sqrt(d2);
  if (d > 1e-6) {
    return { depth: radius - d, normal: { x: dx / d, y: dy / d, z: dz / d }, point: { x: cx, y: cy, z: cz } };
  }
  // Deep centre overlap: push out along the shallowest axis.
  const ox = boxHalf.x - Math.abs(center.x - boxCenter.x);
  const oy = boxHalf.y - Math.abs(center.y - boxCenter.y);
  const oz = boxHalf.z - Math.abs(center.z - boxCenter.z);
  if (ox <= oy && ox <= oz) {
    return { depth: ox + radius, normal: { x: Math.sign(center.x - boxCenter.x) || 1, y: 0, z: 0 }, point: { x: cx, y: cy, z: cz } };
  }
  if (oy <= oz) {
    return { depth: oy + radius, normal: { x: 0, y: Math.sign(center.y - boxCenter.y) || 1, z: 0 }, point: { x: cx, y: cy, z: cz } };
  }
  return { depth: oz + radius, normal: { x: 0, y: 0, z: Math.sign(center.z - boxCenter.z) || 1 }, point: { x: cx, y: cy, z: cz } };
}

/** Deterministic PRNG so the city is reproducible between runs and in tests. */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function rand() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
