// GLSL ES 3.0 sources. One shared lighting model keeps every surface coherent.

import { SNOISE_2D } from './vendor/snoise.js';

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
layout(location = 3) in vec4 i_scale;  // xyz = half-extents, w = facade style id
layout(location = 4) in vec4 i_quat;   // orientation
layout(location = 5) in vec4 i_color;  // rgb = albedo, a = roughness

uniform mat4 u_viewProj;
uniform mat4 u_lightViewProj;

out vec3 v_normal;
out vec3 v_world;
out vec3 v_color;
out float v_rough;
out float v_damage;
out float v_style;
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
  v_style = i_scale.w;
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
in float v_style;
in vec3 v_local;
in vec4 v_lightSpace;
out vec4 outColor;

${COMMON_LIGHTING}

float hash(vec3 p) {
  return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453);
}

// Facade styles (SPEC v0.9.0 R-05), carried per-instance in i_scale.w:
// 0 none · 1 glass tower · 2 apartment · 3 house · 4 warehouse · 5 shop · 6 silo.
// Patterns are anchored in world space, so the per-cell voxel boxes of one
// building line up into a single continuous facade.
void facade(inout vec3 albedo, inout float rough, vec3 N, float style) {
  vec2 uv = abs(N.x) > 0.5 ? v_world.zy : v_world.xy;
  float ground = 1.0 - step(3.4, v_world.y);

  if (style == 1.0) {
    // Glass curtain wall: big glass cells split by mullions.
    vec2 g = uv * vec2(0.30, 0.27);
    vec2 f = fract(g);
    float mullion = step(f.x, 0.10) + step(f.y, 0.12);
    float litw = step(0.86, hash(vec3(floor(g), 7.0)));
    vec3 glass = mix(vec3(0.30, 0.44, 0.58), vec3(0.86, 0.78, 0.52), litw * 0.55);
    glass *= 0.92 + 0.16 * hash(vec3(floor(g), 2.0));
    albedo = mix(glass, v_color * 0.52, clamp(mullion, 0.0, 1.0));
    rough = mix(0.06, 0.5, clamp(mullion, 0.0, 1.0));
    if (ground > 0.5 && v_world.y < 3.0) {         // lobby: taller glass, dark frames
      float lob = step(fract(uv.x * 0.09), 0.06);
      albedo = mix(vec3(0.16, 0.22, 0.28), v_color * 0.4, lob);
      rough = 0.08;
    }
    return;
  }

  if (style == 4.0 || style == 6.0) {
    // Industrial: ribbed metal walls; the warehouse gets a wide gate.
    float rib = 0.92 + 0.08 * step(0.5, fract(uv.x * 0.9));
    albedo = v_color * rib;
    if (style == 4.0 && ground > 0.5) {
      float gate = step(abs(fract(uv.x * 0.055) - 0.5), 0.30) * step(v_world.y, 3.1);
      vec3 gateCol = vec3(0.30, 0.33, 0.36) * (0.85 + 0.15 * step(0.5, fract(v_world.y * 1.6)));
      albedo = mix(albedo, gateCol, gate);
      rough = mix(rough, 0.4, gate);
    }
    return;
  }

  // Punched windows (apartment / house / shop): frame + glass per lattice cell.
  vec2 g = uv * vec2(0.42, 0.40);
  vec2 f = fract(g);
  float win = step(0.22, f.x) * step(f.x, 0.80) * step(0.32, f.y) * step(f.y, 0.82);
  float glassArea = step(0.28, f.x) * step(f.x, 0.74) * step(0.40, f.y) * step(f.y, 0.76);
  float frame = win - glassArea;
  float litw = step(0.88, hash(vec3(floor(g), 3.0)));
  vec3 glass = mix(vec3(0.10, 0.13, 0.18), vec3(0.95, 0.82, 0.55), litw);

  if (ground > 0.5) {
    if (style == 5.0) {
      // Shop: storefront glass band with slim frames + awning stripe.
      float sf = step(0.6, v_world.y) * step(v_world.y, 2.6);
      float post = step(fract(uv.x * 0.14), 0.05);
      albedo = mix(albedo, mix(vec3(0.16, 0.20, 0.26), v_color * 0.5, post), sf);
      rough = mix(rough, 0.1, sf * (1.0 - post));
      float awning = step(2.6, v_world.y) * step(v_world.y, 3.2);
      vec3 awnCol = mix(vec3(0.75, 0.22, 0.18), vec3(0.16, 0.32, 0.55), step(0.5, hash(vec3(floor(v_world.xz * 0.02), 9.0))));
      albedo = mix(albedo, awnCol, awning);
      return;
    }
    // Door every ~7 m; the rest of the ground floor keeps sparse windows.
    float dcell = fract(uv.x * 0.14);
    float door = step(abs(dcell - 0.5), 0.11) * step(v_world.y, 2.5);
    float dframe = step(abs(dcell - 0.5), 0.14) * step(v_world.y, 2.7) - door;
    albedo = mix(albedo, vec3(0.30, 0.18, 0.10), door);
    albedo = mix(albedo, vec3(0.88, 0.86, 0.80), clamp(dframe, 0.0, 1.0));
    rough = mix(rough, 0.35, door);
    win *= step(0.5, 1.0 - door - clamp(dframe, 0.0, 1.0));
    glassArea *= step(0.5, 1.0 - door - clamp(dframe, 0.0, 1.0));
    frame = clamp(win - glassArea, 0.0, 1.0);
  }

  albedo = mix(albedo, vec3(0.90, 0.88, 0.82), frame);          // moldura
  albedo = mix(albedo, glass, glassArea);
  rough = mix(rough, 0.07, glassArea);
  if (style == 2.0) {
    // Apartment: light slab line at every floor (balcony hint).
    float slab = step(fract(g.y), 0.07);
    albedo = mix(albedo, v_color * 1.12, slab * (1.0 - win));
  }
}

void main() {
  vec3 N = normalize(v_normal);
  vec3 albedo = v_color;
  float rough = v_rough;

  float vertical = 1.0 - abs(N.y);
  float style = floor(v_style + 0.5);
  if (style > 0.5 && vertical > 0.5) facade(albedo, rough, N, style);

  // Damage: darkened, dusty, cracked-looking concrete.
  float grit = hash(floor(v_world * 3.0));
  albedo = mix(albedo, vec3(0.32, 0.29, 0.26) * (0.7 + 0.5 * grit), v_damage * 0.85);

  float ndl = max(dot(N, normalize(u_sunDir)), 0.0);
  float shadow = shadowFactor(v_lightSpace, ndl);
  vec3 color = shade(albedo, N, v_world, clamp(rough + v_damage * 0.3, 0.05, 1.0), shadow);
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
uniform float u_time;
uniform float u_cloudHq;   // 0 = one noise octave (?quality=low), 1 = three
out vec4 outColor;

${SNOISE_2D}

void main() {
  vec3 d = normalize(v_dir);
  vec3 S = normalize(u_sunDir);
  float h = clamp(d.y * 0.5 + 0.5, 0.0, 1.0);
  vec3 col = mix(u_skyHorizon, u_skyTop, pow(h, 0.85));

  // Sunny-morning warmth hugging the horizon on the sun's side (R-08).
  float toSun = max(dot(normalize(vec3(d.x, 0.0, d.z)), normalize(vec3(S.x, 0.0, S.z))), 0.0);
  col += vec3(0.28, 0.16, 0.05) * pow(toSun, 3.0) * (1.0 - smoothstep(0.0, 0.35, d.y));

  float sun = pow(max(dot(d, S), 0.0), 220.0);
  float glow = pow(max(dot(d, S), 0.0), 6.0) * 0.18;
  col += u_sunColor * (sun * 3.0 + glow);

  // Slow procedural clouds (R-08, ADR-5): 3 octaves of vendored snoise on a
  // sky plane, drifting with the wind; they thin out toward the horizon.
  if (d.y > 0.015) {
    vec2 p = d.xz / (d.y + 0.14) * 1.15;
    vec2 drift = vec2(u_time * 0.010, u_time * 0.0045);
    float n = snoise(p * 0.26 + drift) * 0.60;
    if (u_cloudHq > 0.5) {
      n += snoise(p * 0.72 + drift * 2.1) * 0.28
         + snoise(p * 1.90 + drift * 3.7) * 0.12;
    } else {
      n *= 1.35;
    }
    float cov = smoothstep(0.04, 0.52, n) * smoothstep(0.015, 0.14, d.y);
    // Puffy shading: dense cores dim slightly, sun side gets a silver lining.
    float dense = smoothstep(0.35, 0.95, n);
    vec3 cloud = mix(vec3(1.04, 1.02, 0.99), vec3(0.78, 0.80, 0.85), dense * 0.6);
    cloud += u_sunColor * 0.10 * pow(max(dot(d, S), 0.0), 3.0);
    col = mix(col, cloud, cov * 0.88);
  }

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
