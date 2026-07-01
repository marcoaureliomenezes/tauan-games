// environment/water-surface.js — Superfícies de água REUTILIZÁVEIS entre mapas.
// Reuso de terceiros (decisão do operador 2026-07-01): a água reflexiva é o
// examples/jsm/objects/Water.js do próprio three r165 (MIT, vendorado em
// /vendor/jsm/), com a textura oficial waternormals.jpg — não reimplementamos
// água do zero. Para RIOS (muitos segmentos) usamos um shader raso compartilhado
// com a MESMA textura de normais, sem passe de reflexão (custo por segmento ~zero).
//
// API:
//   createReflectiveWater(geometry, opts) → Mesh  (lagos/reservatórios/mar — 1 por mapa)
//   createFlowingWater(geometry, opts)   → Mesh  (segmentos de rio — material compartilhado)
//   updateWaterSurfaces(dt, sunDir)              (tick global; chamar no update do mapa)
//   disposeWaterSurfaces()                       (troca de mapa)
//
// Headless/CI: cai para o shader raso também no lago (sem render-to-texture).

import * as THREE from '../../../vendor/three.module.min.js';
import { Water } from '../../../vendor/jsm/objects/Water.js';

// Sem import de scene.js: este módulo precisa carregar também em Node (validador de
// mapa). Detecção de headless local, mesmo padrão de nuclear-fx.js.
const HEADLESS = typeof navigator !== 'undefined' && navigator.webdriver === true;

const _registry = [];
let _normalsTex = null;

function waterNormals() {
  if (!_normalsTex) {
    // Relativo à PÁGINA (/aero-fighters/): sobe um nível até /vendor — funciona
    // na raiz do dev server E sob o subpath /tauan-games/ do GitHub Pages.
    _normalsTex = new THREE.TextureLoader().load('../vendor/textures/waternormals.jpg', (t) => {
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
    });
    _normalsTex.wrapS = _normalsTex.wrapT = THREE.RepeatWrapping;
  }
  return _normalsTex;
}

// ── Shader raso compartilhado (rios, e fallback headless) ─────────────────────
const FLOW_VERT = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vWorldPos;
  void main() {
    vUv = uv;
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorldPos = wp.xyz;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;
const FLOW_FRAG = /* glsl */ `
  uniform sampler2D uNormals;
  uniform float uTime;
  uniform vec3 uColor;
  uniform vec3 uDeepColor;
  uniform vec3 uSunDir;
  uniform vec2 uFlow;      // direção/velocidade do fluxo em uv/s
  uniform float uRepeat;
  uniform float uOpacity;
  varying vec2 vUv;
  varying vec3 vWorldPos;
  void main() {
    // Duas amostras de normal-map deslizando em velocidades diferentes = ondulação viva
    vec2 uv1 = vUv * uRepeat + uFlow * uTime;
    vec2 uv2 = vUv * uRepeat * 1.7 - uFlow * uTime * 0.62 + vec2(0.35, 0.11);
    vec3 n1 = texture2D(uNormals, uv1).xyz * 2.0 - 1.0;
    vec3 n2 = texture2D(uNormals, uv2).xyz * 2.0 - 1.0;
    vec3 n = normalize(vec3(n1.xy + n2.xy, n1.z * n2.z + 1.5));
    n = normalize(vec3(n.x, n.z, n.y)); // normal-map tangente-plano XZ

    vec3 viewDir = normalize(cameraPosition - vWorldPos);
    float fresnel = pow(1.0 - max(0.0, dot(viewDir, vec3(0.0, 1.0, 0.0))), 2.2);
    vec3 base = mix(uDeepColor, uColor, 0.35 + 0.65 * fresnel);

    // Especular do sol nas ondulações
    vec3 sun = normalize(uSunDir);
    vec3 h = normalize(viewDir + sun);
    float spec = pow(max(0.0, dot(n, h)), 90.0) * 0.9;
    // "Sparkle" barato de segunda ordem
    float glint = pow(max(0.0, dot(n, h)), 480.0) * 1.4;

    vec3 c = base + (spec + glint) * vec3(1.0, 0.97, 0.85) * max(0.15, sun.y);
    gl_FragColor = vec4(c, uOpacity);
  }
`;

function makeFlowMaterial(opts = {}) {
  return new THREE.ShaderMaterial({
    vertexShader: FLOW_VERT,
    fragmentShader: FLOW_FRAG,
    uniforms: {
      uNormals: { value: waterNormals() },
      uTime: { value: 0 },
      uColor: { value: new THREE.Color(opts.color ?? 0x3d7fa3) },
      uDeepColor: { value: new THREE.Color(opts.deepColor ?? 0x16405c) },
      uSunDir: { value: new THREE.Vector3(0.5, 0.8, 0.3) },
      uFlow: { value: new THREE.Vector2(...(opts.flow ?? [0.015, 0.05])) },
      uRepeat: { value: opts.repeat ?? 6 },
      uOpacity: { value: opts.opacity ?? 0.9 },
    },
    transparent: true,
    depthWrite: false,
  });
}

/** Água reflexiva (jsm Water) para lago/reservatório/mar — usar 1 por mapa. */
export function createReflectiveWater(geometry, opts = {}) {
  if (HEADLESS) return createFlowingWater(geometry, { ...opts, flow: [0.008, 0.012] });
  const water = new Water(geometry, {
    textureWidth: 256,
    textureHeight: 256,
    waterNormals: waterNormals(),
    sunDirection: new THREE.Vector3(0.5, 0.8, 0.3),
    sunColor: 0xfff4d6,
    waterColor: opts.color ?? 0x2a6d94,
    distortionScale: opts.distortionScale ?? 2.6,
    fog: true,
    alpha: opts.opacity ?? 0.96,
  });
  water.rotation.x = -Math.PI / 2;
  water.material.transparent = true;
  _registry.push({ kind: 'reflective', mesh: water });
  return water;
}

/** Água rasa de fluxo (rios) — material compartilhado, sem passe de reflexão. */
export function createFlowingWater(geometry, opts = {}) {
  const mesh = new THREE.Mesh(geometry, makeFlowMaterial(opts));
  mesh.rotation.x = -Math.PI / 2;
  _registry.push({ kind: 'flow', mesh });
  return mesh;
}

const _sunFallback = new THREE.Vector3(0.5, 0.8, 0.3);

/** Tick global de todas as superfícies vivas. sunDir opcional (Vector3 normalizado). */
export function updateWaterSurfaces(dt, sunDir) {
  const sun = sunDir ?? _sunFallback;
  for (const w of _registry) {
    if (w.kind === 'reflective') {
      w.mesh.material.uniforms.time.value += dt * 0.6;
      w.mesh.material.uniforms.sunDirection.value.copy(sun);
    } else {
      w.mesh.material.uniforms.uTime.value += dt;
      w.mesh.material.uniforms.uSunDir.value.copy(sun);
    }
  }
}

/** Libera geometrias/materiais registrados (troca de mapa). */
export function disposeWaterSurfaces() {
  for (const w of _registry) {
    w.mesh.geometry?.dispose?.();
    w.mesh.material?.dispose?.();
  }
  _registry.length = 0;
}
