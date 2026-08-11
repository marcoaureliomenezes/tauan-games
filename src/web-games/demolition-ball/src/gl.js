// Thin WebGL2 wrapper. No engine, no framework — just the calls we need.

export function createContext(canvas) {
  const gl = canvas.getContext('webgl2', {
    antialias: true,
    alpha: false,
    depth: true,
    powerPreference: 'high-performance',
  });
  if (!gl) throw new Error('WebGL2 nao suportado neste navegador.');
  gl.getExtension('EXT_color_buffer_float');
  gl.enable(gl.DEPTH_TEST);
  gl.enable(gl.CULL_FACE);
  gl.cullFace(gl.BACK);
  return gl;
}

function compile(gl, type, source) {
  const sh = gl.createShader(type);
  gl.shaderSource(sh, source);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(sh);
    const numbered = source.split('\n').map((l, i) => `${i + 1}: ${l}`).join('\n');
    throw new Error(`Falha ao compilar shader:\n${log}\n${numbered}`);
  }
  return sh;
}

export function createProgram(gl, vsSrc, fsSrc) {
  const prog = gl.createProgram();
  gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, vsSrc));
  gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, fsSrc));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    throw new Error(`Falha ao linkar programa: ${gl.getProgramInfoLog(prog)}`);
  }
  const uniforms = {};
  const n = gl.getProgramParameter(prog, gl.ACTIVE_UNIFORMS);
  for (let i = 0; i < n; i++) {
    const info = gl.getActiveUniform(prog, i);
    const name = info.name.replace(/\[0\]$/, '');
    uniforms[name] = gl.getUniformLocation(prog, name);
  }
  return { prog, uniforms };
}

/**
 * Build a VAO for a static indexed mesh plus (optionally) a per-instance buffer.
 * `attribs` describes the vertex layout; `instanceStride` is in floats.
 */
export function createMeshVAO(gl, mesh, opts = {}) {
  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);

  const vbo = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
  gl.bufferData(gl.ARRAY_BUFFER, mesh.vertices, gl.STATIC_DRAW);

  const stride = mesh.stride * 4;
  let offset = 0;
  mesh.layout.forEach((size, i) => {
    gl.enableVertexAttribArray(i);
    gl.vertexAttribPointer(i, size, gl.FLOAT, false, stride, offset);
    offset += size * 4;
  });

  const ibo = gl.createBuffer();
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, mesh.indices, gl.STATIC_DRAW);

  let instanceBuffer = null;
  if (opts.instanceFloats) {
    instanceBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, instanceBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, opts.instanceFloats * 4 * (opts.maxInstances || 1), gl.DYNAMIC_DRAW);
    const base = mesh.layout.length;
    const istride = opts.instanceFloats * 4;
    for (let k = 0; k < opts.instanceFloats / 4; k++) {
      const loc = base + k;
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, 4, gl.FLOAT, false, istride, k * 16);
      gl.vertexAttribDivisor(loc, 1);
    }
  }

  gl.bindVertexArray(null);
  return { vao, vbo, ibo, instanceBuffer, count: mesh.indices.length };
}

export function createShadowTarget(gl, size) {
  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.DEPTH_COMPONENT32F, size, size, 0, gl.DEPTH_COMPONENT, gl.FLOAT, null);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_COMPARE_MODE, gl.COMPARE_REF_TO_TEXTURE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_COMPARE_FUNC, gl.LEQUAL);

  const fbo = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, tex, 0);
  gl.drawBuffers([gl.NONE]);
  gl.readBuffer(gl.NONE);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  return { fbo, tex, size };
}
