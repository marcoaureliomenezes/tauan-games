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
    // Relativo à PÁGINA (/src/web-games/aero-fighters/): sobe três níveis até
    // /vendor — funciona na raiz do dev server E sob o subpath /tauan-games/
    // do GitHub Pages.
    _normalsTex = new THREE.TextureLoader().load('../vendor/textures/waternormals.jpg', (t) => {
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
    });
    _normalsTex.wrapS = _normalsTex.wrapT = THREE.RepeatWrapping;
  }
  return _normalsTex;
}

// ── Shader raso compartilhado (rios, e fallback headless) ─────────────────────
// T-V-15: o shader ganhou (a) espuma de margem (uFoam) e (b) DOIS cuidados de
// distância que só passaram a importar quando o rio virou um ribbon contínuo longo:
// a espuma some com a distância (minificada, as duas faixas de borda cobriam o ribbon
// inteiro a >1 km e liam como uma faixa branca contínua) e o material passou a
// respeitar o scene.fog (ShaderMaterial sem fog ficava saturado/brilhante contra o
// terreno enevoado — a "linha branca" no horizonte dos shots de altitude).
const FLOW_VERT = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vWorldPos;
  varying float vFogDepth;
  void main() {
    vUv = uv;
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorldPos = wp.xyz;
    vFogDepth = -(viewMatrix * wp).z;
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
  uniform float uFoam;     // T-V-15: 1 liga a espuma de margem (gradiente de alpha em uv.x)
  uniform vec3 fogColor;   // populados pelo renderer (material.fog = true)
  uniform float fogNear;
  uniform float fogFar;
  varying vec2 vUv;
  varying vec3 vWorldPos;
  varying float vFogDepth;
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

    // T-V-15 (inhauma-visual-uplift-v1): espuma de margem para o ribbon contínuo do
    // rio — faixa branca com alpha-gradiente perto das bordas (uv.x → 0/1), modulada
    // pela própria textura de normais (sem textura nova) e DESVANECIDA com a
    // distância (minificada ela cobriria o ribbon inteiro longe). uFoam = 0 nos
    // demais usos (lagos/fallback headless), comportamento anterior intacto.
    float camDist = length(cameraPosition - vWorldPos);
    float edgeDist = min(vUv.x, 1.0 - vUv.x);
    float foamNoise = texture2D(uNormals, vUv * uRepeat * 2.3 + uFlow * uTime * 1.7).x;
    float foam = uFoam
      * smoothstep(0.16, 0.03, edgeDist)
      * smoothstep(0.32, 0.72, foamNoise)
      * (1.0 - smoothstep(500.0, 1400.0, camDist));
    c = mix(c, vec3(0.90, 0.94, 0.93), foam);

    // Fog linear manual (mesma forma de THREE.Fog) — o ribbon longo do rio cruza a
    // zona de neblina; sem isso a água distante fica saturada contra o terreno fogado.
    float fogFactor = clamp((fogFar - vFogDepth) / (fogFar - fogNear), 0.0, 1.0);
    c = mix(fogColor, c, fogFactor);
    gl_FragColor = vec4(c, max(uOpacity, foam));
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
      uFoam: { value: opts.foam ?? 0 }, // T-V-15: 1 só no ribbon do rio
      // T-V-15: fog uniforms — o renderer sobrescreve por frame (material.fog=true)
      fogColor: { value: new THREE.Color(0x000000) },
      fogNear: { value: 1 },
      fogFar: { value: 1000 },
    },
    transparent: true,
    depthWrite: false,
    fog: true, // T-V-15: respeita o scene.fog (ribbon do rio cruza a zona de neblina)
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
  // PERF (2026-07-01): o passe de reflexo do jsm Water RE-RENDERIZA A CENA INTEIRA
  // (terreno + florestas instanciadas) num render-target a cada frame — em GPU
  // integrada isso era boa parte do lag de voo. O reflexo agora atualiza a 30 Hz
  // (frames alternados; o target guarda o último reflexo) e é PULADO por completo
  // quando a câmera está longe do lago (a distorção + fresnel dominam de longe;
  // ninguém distingue um reflexo de meio segundo atrás).
  const origOnBeforeRender = water.onBeforeRender;
  const maxReflectDist = opts.maxReflectDist ?? 2400;
  let reflFrame = 0;
  water.onBeforeRender = function (renderer, scene, cam, ...rest) {
    reflFrame++;
    if (reflFrame % 2 === 0) return;
    if (cam?.position && this.position.distanceTo(cam.position) > maxReflectDist) return;
    origOnBeforeRender.call(this, renderer, scene, cam, ...rest);
  };
  _registry.push({ kind: 'reflective', mesh: water });
  return water;
}

/** Água rasa de fluxo (rios) — material compartilhado, sem passe de reflexão.
 *  `opts.rotate === false` (T-V-15) pula o rotate -90°: o ribbon contínuo do rio já
 *  é construído em coordenadas de mundo (XZ com Y para cima), diferente do
 *  PlaneGeometry em XY que o padrão espera. */
export function createFlowingWater(geometry, opts = {}) {
  const mesh = new THREE.Mesh(geometry, makeFlowMaterial(opts));
  if (opts.rotate !== false) mesh.rotation.x = -Math.PI / 2;
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
