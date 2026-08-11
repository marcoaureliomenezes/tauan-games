// Forward renderer: sky -> shadow map -> opaque instanced solids + static ground
// -> alpha-blended particles. Everything the city draws goes through three
// instanced primitives, so a whole block of buildings costs three draw calls.

import { createContext, createProgram, createMeshVAO, createShadowTarget } from './gl.js';
import {
  INSTANCED_VS, INSTANCED_FS, INSTANCED_DEPTH_VS, DEPTH_FS,
  STATIC_VS, STATIC_FS, SKY_VS, SKY_FS, PARTICLE_VS, PARTICLE_FS,
} from './shaders.js';
import { boxMesh, sphereMesh, cylinderMesh, fullscreenQuad, quadMesh } from './geometry.js';
import {
  m4, m4mul, m4perspective, m4lookAt, m4ortho, v3, vadd, vscale, vsub, vnorm, vcross, vdot,
} from './math.js';

const INSTANCE_FLOATS = 16;
const MAX_INSTANCES = { box: 60000, sphere: 4000, cylinder: 4000 };
const MAX_PARTICLES = 6000;
let SHADOW_SIZE = 2048;
const SHADOW_EXTENT = 150;

function invertMat4(m, o = m4()) {
  const a = m;
  const b00 = a[0] * a[5] - a[1] * a[4], b01 = a[0] * a[6] - a[2] * a[4];
  const b02 = a[0] * a[7] - a[3] * a[4], b03 = a[1] * a[6] - a[2] * a[5];
  const b04 = a[1] * a[7] - a[3] * a[5], b05 = a[2] * a[7] - a[3] * a[6];
  const b06 = a[8] * a[13] - a[9] * a[12], b07 = a[8] * a[14] - a[10] * a[12];
  const b08 = a[8] * a[15] - a[11] * a[12], b09 = a[9] * a[14] - a[10] * a[13];
  const b10 = a[9] * a[15] - a[11] * a[13], b11 = a[10] * a[15] - a[11] * a[14];
  let det = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;
  if (!det) return m4identityFallback(o);
  det = 1 / det;
  o[0] = (a[5] * b11 - a[6] * b10 + a[7] * b09) * det;
  o[1] = (a[2] * b10 - a[1] * b11 - a[3] * b09) * det;
  o[2] = (a[13] * b05 - a[14] * b04 + a[15] * b03) * det;
  o[3] = (a[10] * b04 - a[9] * b05 - a[11] * b03) * det;
  o[4] = (a[6] * b08 - a[4] * b11 - a[7] * b07) * det;
  o[5] = (a[0] * b11 - a[2] * b08 + a[3] * b07) * det;
  o[6] = (a[14] * b02 - a[12] * b05 - a[15] * b01) * det;
  o[7] = (a[8] * b05 - a[10] * b02 + a[11] * b01) * det;
  o[8] = (a[4] * b10 - a[5] * b08 + a[7] * b06) * det;
  o[9] = (a[1] * b08 - a[0] * b10 - a[3] * b06) * det;
  o[10] = (a[12] * b04 - a[13] * b02 + a[15] * b00) * det;
  o[11] = (a[9] * b02 - a[8] * b04 - a[11] * b00) * det;
  o[12] = (a[5] * b07 - a[4] * b09 - a[6] * b06) * det;
  o[13] = (a[0] * b09 - a[1] * b07 + a[2] * b06) * det;
  o[14] = (a[13] * b01 - a[12] * b03 - a[14] * b00) * det;
  o[15] = (a[8] * b03 - a[9] * b01 + a[10] * b00) * det;
  return o;
}
function m4identityFallback(o) { o.fill(0); o[0] = o[5] = o[10] = o[15] = 1; return o; }

class InstanceBatch {
  constructor(gl, mesh, max) {
    this.gl = gl;
    this.max = max;
    this.data = new Float32Array(max * INSTANCE_FLOATS);
    this.count = 0;
    this.gpu = createMeshVAO(gl, mesh, { instanceFloats: INSTANCE_FLOATS, maxInstances: max });
  }

  reset() { this.count = 0; }

  push(px, py, pz, damage, sx, sy, sz, qx, qy, qz, qw, r, g, b, rough) {
    if (this.count >= this.max) return;
    const o = this.count * INSTANCE_FLOATS;
    const d = this.data;
    d[o] = px; d[o + 1] = py; d[o + 2] = pz; d[o + 3] = damage;
    d[o + 4] = sx; d[o + 5] = sy; d[o + 6] = sz; d[o + 7] = 0;
    d[o + 8] = qx; d[o + 9] = qy; d[o + 10] = qz; d[o + 11] = qw;
    d[o + 12] = r; d[o + 13] = g; d[o + 14] = b; d[o + 15] = rough;
    this.count++;
  }

  upload() {
    if (!this.count) return;
    const gl = this.gl;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.gpu.instanceBuffer);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.data, 0, this.count * INSTANCE_FLOATS);
  }

  draw() {
    if (!this.count) return;
    const gl = this.gl;
    gl.bindVertexArray(this.gpu.vao);
    gl.drawElementsInstanced(gl.TRIANGLES, this.gpu.count, gl.UNSIGNED_INT, 0, this.count);
  }
}

export class Renderer {
  /** @param {object} opts {shadowSize, maxPixelRatio} — lowered by ?quality=low. */
  constructor(canvas, opts = {}) {
    const gl = createContext(canvas);
    this.gl = gl;
    this.canvas = canvas;
    SHADOW_SIZE = opts.shadowSize || SHADOW_SIZE;
    this.maxPixelRatio = opts.maxPixelRatio || 1.75;

    this.solid = createProgram(gl, INSTANCED_VS, INSTANCED_FS);
    this.depth = createProgram(gl, INSTANCED_DEPTH_VS, DEPTH_FS);
    this.staticProg = createProgram(gl, STATIC_VS, STATIC_FS);
    this.skyProg = createProgram(gl, SKY_VS, SKY_FS);
    this.particleProg = createProgram(gl, PARTICLE_VS, PARTICLE_FS);

    this.batches = {
      box: new InstanceBatch(gl, boxMesh(), MAX_INSTANCES.box),
      sphere: new InstanceBatch(gl, sphereMesh(), MAX_INSTANCES.sphere),
      cylinder: new InstanceBatch(gl, cylinderMesh(), MAX_INSTANCES.cylinder),
    };

    this.sky = createMeshVAO(gl, fullscreenQuad());
    this.shadow = createShadowTarget(gl, SHADOW_SIZE);

    this.particleData = new Float32Array(MAX_PARTICLES * 8);
    this.particleCount = 0;
    this.particleGpu = createMeshVAO(gl, quadMesh(), { instanceFloats: 8, maxInstances: MAX_PARTICLES });

    this.staticMesh = null;
    this.viewProj = m4();
    this.lightViewProj = m4();
    this.invViewProj = m4();
    this.proj = m4();
    this.view = m4();

    this.env = {
      sunDir: vnorm(v3(0.42, 0.72, 0.31)),
      sunColor: [1.55, 1.36, 1.06],
      skyAmbient: [0.30, 0.36, 0.46],
      groundAmbient: [0.16, 0.15, 0.13],
      fogColor: [0.66, 0.72, 0.80],
      fogDensity: 0.0022,
      skyTop: [0.20, 0.42, 0.82],
      skyHorizon: [0.78, 0.85, 0.93],
    };
    this.drawCalls = 0;
  }

  setStaticMesh(meshData) {
    this.staticMesh = createMeshVAO(this.gl, meshData);
  }

  beginFrame() {
    for (const k in this.batches) this.batches[k].reset();
    this.particleCount = 0;
  }

  /** pos/half/quat are objects; color is [r,g,b]. */
  pushBox(pos, half, quat, color, rough = 0.7, damage = 0) {
    this.batches.box.push(pos.x, pos.y, pos.z, damage, half.x, half.y, half.z,
      quat.x, quat.y, quat.z, quat.w, color[0], color[1], color[2], rough);
  }

  pushSphere(pos, radius, quat, color, rough = 0.4, damage = 0) {
    this.batches.sphere.push(pos.x, pos.y, pos.z, damage, radius, radius, radius,
      quat.x, quat.y, quat.z, quat.w, color[0], color[1], color[2], rough);
  }

  pushCylinder(pos, radius, halfHeight, quat, color, rough = 0.5) {
    this.batches.cylinder.push(pos.x, pos.y, pos.z, 0, radius, halfHeight, radius,
      quat.x, quat.y, quat.z, quat.w, color[0], color[1], color[2], rough);
  }

  pushParticle(pos, size, color, alpha) {
    if (this.particleCount >= MAX_PARTICLES) return;
    const o = this.particleCount * 8;
    const d = this.particleData;
    d[o] = pos.x; d[o + 1] = pos.y; d[o + 2] = pos.z; d[o + 3] = size;
    d[o + 4] = color[0]; d[o + 5] = color[1]; d[o + 6] = color[2]; d[o + 7] = alpha;
    this.particleCount++;
  }

  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, this.maxPixelRatio);
    const w = Math.floor(this.canvas.clientWidth * dpr);
    const h = Math.floor(this.canvas.clientHeight * dpr);
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }
  }

  computeMatrices(camera) {
    const aspect = this.canvas.width / Math.max(this.canvas.height, 1);
    m4perspective(camera.fov, aspect, 0.35, 1400, this.proj);
    m4lookAt(camera.position, camera.target, v3(0, 1, 0), this.view);
    m4mul(this.proj, this.view, this.viewProj);
    invertMat4(this.viewProj, this.invViewProj);

    // Directional light framed on the camera target, snapped to texel grid to
    // keep shadow edges from crawling as the tractor drives.
    const s = this.env.sunDir;
    const focus = camera.target;
    const eye = vadd(focus, vscale(s, 260));
    const lview = m4lookAt(eye, focus, v3(0, 1, 0));
    const texel = (SHADOW_EXTENT * 2) / SHADOW_SIZE;
    const snap = (v) => Math.round(v / texel) * texel;
    const lproj = m4ortho(-SHADOW_EXTENT, SHADOW_EXTENT, -SHADOW_EXTENT, SHADOW_EXTENT, 1, 620);
    m4mul(lproj, lview, this.lightViewProj);
    // Texel snapping in light space.
    const t = this.lightViewProj;
    t[12] = snap(t[12] * SHADOW_SIZE * 0.5) / (SHADOW_SIZE * 0.5);
    t[13] = snap(t[13] * SHADOW_SIZE * 0.5) / (SHADOW_SIZE * 0.5);
  }

  setLightingUniforms(u, camera) {
    const gl = this.gl;
    const e = this.env;
    if (u.u_sunDir) gl.uniform3f(u.u_sunDir, e.sunDir.x, e.sunDir.y, e.sunDir.z);
    if (u.u_sunColor) gl.uniform3fv(u.u_sunColor, e.sunColor);
    if (u.u_skyColor) gl.uniform3fv(u.u_skyColor, e.skyAmbient);
    if (u.u_groundColor) gl.uniform3fv(u.u_groundColor, e.groundAmbient);
    if (u.u_fogColor) gl.uniform3fv(u.u_fogColor, e.fogColor);
    if (u.u_fogDensity) gl.uniform1f(u.u_fogDensity, e.fogDensity);
    if (u.u_camPos) gl.uniform3f(u.u_camPos, camera.position.x, camera.position.y, camera.position.z);
    if (u.u_shadowTexel) gl.uniform1f(u.u_shadowTexel, 1 / SHADOW_SIZE);
    if (u.u_shadowMap) {
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this.shadow.tex);
      gl.uniform1i(u.u_shadowMap, 0);
    }
  }

  render(camera) {
    const gl = this.gl;
    this.resize();
    this.computeMatrices(camera);
    this.drawCalls = 0;

    for (const k in this.batches) this.batches[k].upload();

    // ---- shadow pass
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.shadow.fbo);
    gl.viewport(0, 0, this.shadow.size, this.shadow.size);
    gl.clear(gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST);
    gl.depthMask(true);
    gl.useProgram(this.depth.prog);
    gl.uniformMatrix4fv(this.depth.uniforms.u_lightViewProj, false, this.lightViewProj);
    gl.cullFace(gl.FRONT);
    for (const k in this.batches) { this.batches[k].draw(); this.drawCalls++; }
    gl.cullFace(gl.BACK);

    // ---- main pass
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.clearColor(this.env.fogColor[0], this.env.fogColor[1], this.env.fogColor[2], 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    // sky
    gl.depthMask(false);
    gl.disable(gl.CULL_FACE);
    gl.useProgram(this.skyProg.prog);
    const su = this.skyProg.uniforms;
    gl.uniformMatrix4fv(su.u_invViewProj, false, this.invViewProj);
    gl.uniform3f(su.u_camPos, camera.position.x, camera.position.y, camera.position.z);
    gl.uniform3f(su.u_sunDir, this.env.sunDir.x, this.env.sunDir.y, this.env.sunDir.z);
    gl.uniform3fv(su.u_skyTop, this.env.skyTop);
    gl.uniform3fv(su.u_skyHorizon, this.env.skyHorizon);
    gl.uniform3fv(su.u_sunColor, this.env.sunColor);
    gl.bindVertexArray(this.sky.vao);
    gl.drawElements(gl.TRIANGLES, this.sky.count, gl.UNSIGNED_INT, 0);
    gl.enable(gl.CULL_FACE);
    gl.depthMask(true);

    // static ground
    if (this.staticMesh) {
      gl.useProgram(this.staticProg.prog);
      const u = this.staticProg.uniforms;
      gl.uniformMatrix4fv(u.u_viewProj, false, this.viewProj);
      gl.uniformMatrix4fv(u.u_lightViewProj, false, this.lightViewProj);
      this.setLightingUniforms(u, camera);
      gl.bindVertexArray(this.staticMesh.vao);
      gl.drawElements(gl.TRIANGLES, this.staticMesh.count, gl.UNSIGNED_INT, 0);
      this.drawCalls++;
    }

    // instanced solids
    gl.useProgram(this.solid.prog);
    const u = this.solid.uniforms;
    gl.uniformMatrix4fv(u.u_viewProj, false, this.viewProj);
    gl.uniformMatrix4fv(u.u_lightViewProj, false, this.lightViewProj);
    this.setLightingUniforms(u, camera);
    for (const k in this.batches) { this.batches[k].draw(); this.drawCalls++; }

    // particles
    if (this.particleCount) {
      const fwd = vnorm(vsub(camera.target, camera.position));
      const right = vnorm(vcross(fwd, v3(0, 1, 0)));
      const up = vcross(right, fwd);
      gl.useProgram(this.particleProg.prog);
      const pu = this.particleProg.uniforms;
      gl.uniformMatrix4fv(pu.u_viewProj, false, this.viewProj);
      gl.uniform3f(pu.u_right, right.x, right.y, right.z);
      gl.uniform3f(pu.u_up, up.x, up.y, up.z);
      gl.uniform3f(pu.u_camPos, camera.position.x, camera.position.y, camera.position.z);
      gl.uniform3fv(pu.u_fogColor, this.env.fogColor);
      gl.uniform1f(pu.u_fogDensity, this.env.fogDensity);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.particleGpu.instanceBuffer);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.particleData, 0, this.particleCount * 8);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      gl.depthMask(false);
      gl.disable(gl.CULL_FACE);
      gl.bindVertexArray(this.particleGpu.vao);
      gl.drawElementsInstanced(gl.TRIANGLES, this.particleGpu.count, gl.UNSIGNED_INT, 0, this.particleCount);
      gl.enable(gl.CULL_FACE);
      gl.depthMask(true);
      gl.disable(gl.BLEND);
      this.drawCalls++;
    }

    gl.bindVertexArray(null);
  }

  stats() {
    return {
      boxes: this.batches.box.count,
      spheres: this.batches.sphere.count,
      cylinders: this.batches.cylinder.count,
      particles: this.particleCount,
      drawCalls: this.drawCalls,
    };
  }
}

export { vdot };
