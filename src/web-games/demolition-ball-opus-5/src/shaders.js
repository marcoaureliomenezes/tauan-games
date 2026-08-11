// GLSL ES 3.0 sources. One shared lighting model keeps every surface coherent.

const COMMON_LIGHTING = /* glsl */`
precision highp sampler2DShadow;   // GLSL ES 3.0 has no default precision for samplers

uniform vec3 u_sunDir;        // pointing FROM the surface TOWARDS the sun
uniform vec3 u_sunColor;
uniform vec3 u_skyColor;
uniform vec3 u_groundColor;
uniform vec3 u_camPos;
uniform vec3 u_fogColor;
uniform float u_fogDensity;
uniform sampler2DShadow u_shadowMap;
uniform float u_shadowTexel;

float shadowFactor(vec4 lightSpace, float ndl) {
  vec3 proj = lightSpace.xyz / lightSpace.w;
  proj = proj * 0.5 + 0.5;
  if (proj.z > 1.0 || proj.x < 0.0 || proj.x > 1.0 || proj.y < 0.0 || proj.y > 1.0) return 1.0;
  // Slope-scaled bias removes acne on near-grazing faces without peter-panning.
  float bias = mix(0.0016, 0.0004, ndl);
  proj.z -= bias;
  float sum = 0.0;
  for (int y = -1; y <= 1; y++) {
    for (int x = -1; x <= 1; x++) {
      vec2 off = vec2(float(x), float(y)) * u_shadowTexel;
      sum += texture(u_shadowMap, vec3(proj.xy + off, proj.z));
    }
  }
  return sum / 9.0;
}

vec3 shade(vec3 albedo, vec3 N, vec3 P, float roughness, float shadow) {
  vec3 V = normalize(u_camPos - P);
  vec3 L = normalize(u_sunDir);
  vec3 H = normalize(V + L);
  float ndl = max(dot(N, L), 0.0);
  float ndh = max(dot(N, H), 0.0);
  float ndv = max(dot(N, V), 0.0001);

  // GGX specular, cheap Schlick fresnel, dielectric F0.
  float a = max(roughness * roughness, 0.002);
  float a2 = a * a;
  float denom = ndh * ndh * (a2 - 1.0) + 1.0;
  float D = a2 / (3.14159265 * denom * denom);
  float k = a * 0.5;
  float G = (ndv / (ndv * (1.0 - k) + k)) * (ndl / (ndl * (1.0 - k) + k));
  float F = 0.04 + 0.96 * pow(1.0 - max(dot(H, V), 0.0), 5.0);
  float spec = D * G * F / (4.0 * ndv * max(ndl, 0.0001) + 0.001);

  vec3 direct = u_sunColor * ndl * shadow * (albedo / 3.14159265 + vec3(spec) * 0.6);
  // Hemispheric ambient: sky above, bounce from the street below.
  float hemi = N.y * 0.5 + 0.5;
  vec3 ambient = albedo * mix(u_groundColor, u_skyColor, hemi);
  return direct + ambient;
}

vec3 applyFog(vec3 color, vec3 P) {
  float d = length(P - u_camPos);
  float f = 1.0 - exp(-pow(d * u_fogDensity, 2.0));
  return mix(color, u_fogColor, clamp(f, 0.0, 1.0));
}

vec3 tonemap(vec3 c) {
  // Filmic ACES approximation + gamma.
  c *= 0.85;
  vec3 x = (c * (2.51 * c + 0.03)) / (c * (2.43 * c + 0.59) + 0.14);
  return pow(clamp(x, 0.0, 1.0), vec3(1.0 / 2.2));
}

vec3 rotateByQuat(vec3 v, vec4 q) {
  return v + 2.0 * cross(q.xyz, cross(q.xyz, v) + q.w * v);
}
`;

// ---------------------------------------------------------------- instanced solids
export const INSTANCED_VS = /* glsl */`#version 300 es
precision highp float;
layout(location = 0) in vec3 a_pos;
layout(location = 1) in vec3 a_normal;
layout(location = 2) in vec4 i_pos;    // xyz = world position, w = damage 0..1
layout(location = 3) in vec4 i_scale;  // xyz = half-extents, w = unused
layout(location = 4) in vec4 i_quat;   // orientation
layout(location = 5) in vec4 i_color;  // rgb = albedo, a = roughness

uniform mat4 u_viewProj;
uniform mat4 u_lightViewProj;

out vec3 v_normal;
out vec3 v_world;
out vec3 v_color;
out float v_rough;
out float v_damage;
out vec3 v_local;
out vec4 v_lightSpace;

vec3 rotQ(vec3 v, vec4 q) { return v + 2.0 * cross(q.xyz, cross(q.xyz, v) + q.w * v); }

void main() {
  vec3 local = a_pos * i_scale.xyz;
  vec3 world = rotQ(local, i_quat) + i_pos.xyz;
  v_world = world;
  v_normal = normalize(rotQ(a_normal / max(i_scale.xyz, vec3(0.0001)), i_quat));
  v_color = i_color.rgb;
  v_rough = i_color.a;
  v_damage = i_pos.w;
  v_local = a_pos;
  v_lightSpace = u_lightViewProj * vec4(world, 1.0);
  gl_Position = u_viewProj * vec4(world, 1.0);
}`;

export const INSTANCED_FS = /* glsl */`#version 300 es
precision highp float;
in vec3 v_normal;
in vec3 v_world;
in vec3 v_color;
in float v_rough;
in float v_damage;
in vec3 v_local;
in vec4 v_lightSpace;
out vec4 outColor;

${COMMON_LIGHTING}

float hash(vec3 p) {
  return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453);
}

void main() {
  vec3 N = normalize(v_normal);
  vec3 albedo = v_color;

  // Facade detail: window bands on the vertical faces of building blocks.
  float vertical = 1.0 - abs(N.y);
  if (vertical > 0.5 && v_rough < 0.85) {
    vec2 uv = abs(N.x) > 0.5 ? v_world.zy : v_world.xy;
    vec2 cell = floor(uv * 0.55);
    float win = step(0.35, fract(uv.x * 0.55)) * step(0.4, fract(uv.y * 0.55));
    float lit = step(0.82, hash(vec3(cell, 3.0)));
    albedo = mix(albedo, mix(vec3(0.09, 0.12, 0.17), vec3(0.95, 0.82, 0.55), lit), win * 0.75 * vertical);
  }

  // Damage: darkened, dusty, cracked-looking concrete.
  float grit = hash(floor(v_world * 3.0));
  albedo = mix(albedo, vec3(0.32, 0.29, 0.26) * (0.7 + 0.5 * grit), v_damage * 0.85);

  float ndl = max(dot(N, normalize(u_sunDir)), 0.0);
  float shadow = shadowFactor(v_lightSpace, ndl);
  vec3 color = shade(albedo, N, v_world, clamp(v_rough + v_damage * 0.3, 0.05, 1.0), shadow);
  outColor = vec4(tonemap(applyFog(color, v_world)), 1.0);
}`;

export const INSTANCED_DEPTH_VS = /* glsl */`#version 300 es
precision highp float;
layout(location = 0) in vec3 a_pos;
layout(location = 1) in vec3 a_normal;
layout(location = 2) in vec4 i_pos;
layout(location = 3) in vec4 i_scale;
layout(location = 4) in vec4 i_quat;
layout(location = 5) in vec4 i_color;
uniform mat4 u_lightViewProj;
vec3 rotQ(vec3 v, vec4 q) { return v + 2.0 * cross(q.xyz, cross(q.xyz, v) + q.w * v); }
void main() {
  vec3 world = rotQ(a_pos * i_scale.xyz, i_quat) + i_pos.xyz;
  gl_Position = u_lightViewProj * vec4(world, 1.0);
}`;

export const DEPTH_FS = /* glsl */`#version 300 es
precision highp float;
void main() {}`;

// ---------------------------------------------------------------- static terrain
export const STATIC_VS = /* glsl */`#version 300 es
precision highp float;
layout(location = 0) in vec3 a_pos;
layout(location = 1) in vec3 a_normal;
layout(location = 2) in vec4 a_color; // rgb albedo, a roughness
uniform mat4 u_viewProj;
uniform mat4 u_lightViewProj;
out vec3 v_normal;
out vec3 v_world;
out vec4 v_color;
out vec4 v_lightSpace;
void main() {
  v_world = a_pos;
  v_normal = a_normal;
  v_color = a_color;
  v_lightSpace = u_lightViewProj * vec4(a_pos, 1.0);
  gl_Position = u_viewProj * vec4(a_pos, 1.0);
}`;

export const STATIC_FS = /* glsl */`#version 300 es
precision highp float;
in vec3 v_normal;
in vec3 v_world;
in vec4 v_color;
in vec4 v_lightSpace;
out vec4 outColor;

${COMMON_LIGHTING}

float hash2(vec2 p) { return fract(sin(dot(p, vec2(41.3, 289.1))) * 24634.6345); }

void main() {
  vec3 N = normalize(v_normal);
  // Asphalt speckle so the ground is not a flat plastic sheet.
  float n = hash2(floor(v_world.xz * 2.0)) * 0.12 - 0.06;
  vec3 albedo = clamp(v_color.rgb * (1.0 + n), 0.0, 1.0);
  float ndl = max(dot(N, normalize(u_sunDir)), 0.0);
  float shadow = shadowFactor(v_lightSpace, ndl);
  vec3 color = shade(albedo, N, v_world, v_color.a, shadow);
  outColor = vec4(tonemap(applyFog(color, v_world)), 1.0);
}`;

// ---------------------------------------------------------------- sky dome
export const SKY_VS = /* glsl */`#version 300 es
precision highp float;
layout(location = 0) in vec2 a_pos;
uniform mat4 u_invViewProj;
uniform vec3 u_camPos;
out vec3 v_dir;
void main() {
  vec4 far = u_invViewProj * vec4(a_pos, 1.0, 1.0);
  v_dir = normalize(far.xyz / far.w - u_camPos);
  gl_Position = vec4(a_pos, 1.0, 1.0);
}`;

export const SKY_FS = /* glsl */`#version 300 es
precision highp float;
in vec3 v_dir;
uniform vec3 u_sunDir;
uniform vec3 u_skyTop;
uniform vec3 u_skyHorizon;
uniform vec3 u_sunColor;
out vec4 outColor;
void main() {
  vec3 d = normalize(v_dir);
  float h = clamp(d.y * 0.5 + 0.5, 0.0, 1.0);
  vec3 col = mix(u_skyHorizon, u_skyTop, pow(h, 0.85));
  float sun = pow(max(dot(d, normalize(u_sunDir)), 0.0), 220.0);
  float glow = pow(max(dot(d, normalize(u_sunDir)), 0.0), 6.0) * 0.18;
  col += u_sunColor * (sun * 3.0 + glow);
  col = pow(clamp(col, 0.0, 1.0), vec3(1.0 / 2.2));
  outColor = vec4(col, 1.0);
}`;

// ---------------------------------------------------------------- particles (dust / smoke / sparks)
export const PARTICLE_VS = /* glsl */`#version 300 es
precision highp float;
layout(location = 0) in vec2 a_corner;
layout(location = 1) in vec4 i_pos;    // xyz world, w size
layout(location = 2) in vec4 i_color;  // rgba
uniform mat4 u_viewProj;
uniform vec3 u_right;
uniform vec3 u_up;
out vec2 v_uv;
out vec4 v_color;
out vec3 v_world;
void main() {
  vec3 world = i_pos.xyz + (u_right * a_corner.x + u_up * a_corner.y) * i_pos.w;
  v_uv = a_corner;
  v_color = i_color;
  v_world = world;
  gl_Position = u_viewProj * vec4(world, 1.0);
}`;

export const PARTICLE_FS = /* glsl */`#version 300 es
precision highp float;
in vec2 v_uv;
in vec4 v_color;
in vec3 v_world;
uniform vec3 u_camPos;
uniform vec3 u_fogColor;
uniform float u_fogDensity;
out vec4 outColor;
void main() {
  float r = length(v_uv);
  if (r > 1.0) discard;
  float alpha = v_color.a * (1.0 - smoothstep(0.35, 1.0, r));
  float d = length(v_world - u_camPos);
  float f = clamp(1.0 - exp(-pow(d * u_fogDensity, 2.0)), 0.0, 1.0);
  outColor = vec4(mix(v_color.rgb, u_fogColor, f), alpha);
}`;
