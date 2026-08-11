import * as THREE from '../../vendor/three.module.min.js';

// Adaptive quality: starts high, degrades gracefully only when the GPU truly can't keep up.
// Step order: shadows off → simpler materials → frame cap. Resolution is never butchered.
export function createPerformanceController(renderer, scene, game) {
  const gpu = rendererName(renderer);
  const weakDevice = /swiftshader|llvmpipe|software|microsoft basic/i.test(gpu);
  const forced = new URLSearchParams(location.search).get('quality');
  let mode = forced === 'high' || forced === 'compatibility' ? forced : weakDevice ? 'compatibility' : 'high';
  let lowSamples = 0;
  let lastRender = 0;
  const materialCache = new WeakMap();
  game.telemetry.gpu = gpu;
  game.telemetry.quality = mode;
  configureRenderer();

  function configureRenderer() {
    if (mode !== 'compatibility') return;
    renderer.shadowMap.enabled = false;
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.25));
    renderer.setSize(innerWidth, innerHeight);
  }

  function apply(root = scene) {
    if (mode !== 'compatibility' || !root) return;
    root.traverse((object) => {
      if (!object.isMesh || !object.material) return;
      object.castShadow = false;
      object.receiveShadow = false;
      object.material = Array.isArray(object.material)
        ? object.material.map(lightweightMaterial)
        : lightweightMaterial(object.material);
    });
  }

  function lightweightMaterial(source) {
    if (source.isMeshBasicMaterial || source.isMeshLambertMaterial || source.isShaderMaterial) return source;
    if (materialCache.has(source)) return materialCache.get(source);
    const material = new THREE.MeshLambertMaterial({
      color: source.color || 0xffffff,
      map: source.map || null,
      emissive: source.emissive || 0x000000,
      emissiveMap: source.emissiveMap || null,
      transparent: source.transparent,
      opacity: source.opacity,
      side: source.side,
      depthWrite: source.depthWrite,
      vertexColors: source.vertexColors,
    });
    materialCache.set(source, material);
    source.dispose();
    return material;
  }

  // PERF LAW: `sample()` only ACCUMULATES a low-fps counter now — it never
  // again flips `shadowMap.enabled`, swaps every material in the scene, or
  // reallocates the drawing buffer mid-match. That cocktail (all three in one
  // frame) was, on its own, the single biggest stall in the game, and it fired
  // exactly when the game had already started stuttering — the worst possible
  // moment. The decision now happens exactly once, in `decideMode()`, called
  // from `deploy()` BEFORE the shader pre-warm and BEFORE `phase = 'playing'`.
  function sample(fps) {
    if (forced || mode === 'compatibility') return;
    lowSamples = fps < 30 ? lowSamples + 1 : Math.max(0, lowSamples - 1);
  }

  /**
   * Decide (uma vez, em deploy()) se este dispositivo ENTRA no modo leve —
   * a transição cara (shadowMap + framebuffer). Só dispara quando o modo
   * ainda é 'high' e a partida anterior amostrou fps baixo o bastante.
   *
   * BUG evitado aqui: um dispositivo já detectado fraco no arranque (GPU de
   * software) já nasce com `mode='compatibility'` — se `decideMode` saísse
   * cedo nesse caso, `apply()` NUNCA rodaria em deploy nenhum, e os
   * materiais de guards/combat/armas de CADA missão ficariam permanentemente
   * pesados (Standard/PBR) mesmo com o modo leve "ativo" só no nome. Por
   * isso quem decide "preciso migrar de modo" é só esta função; quem aplica
   * o resultado (`apply`, chamada por main.js logo depois, sempre) NÃO
   * depende de ter havido transição nesta chamada.
   */
  function decideMode() {
    if (forced || mode === 'compatibility' || lowSamples < 3) return;
    mode = 'compatibility';
    game.telemetry.quality = mode;
    lowSamples = 0;
    configureRenderer();
  }

  function shouldRender(now) {
    if (mode !== 'compatibility') return true;
    if (now - lastRender < 27) return false;
    lastRender = now;
    return true;
  }

  function resize(camera) {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
  }

  return { apply, sample, decideMode, shouldRender, resize, get mode() { return mode; } };
}

function rendererName(renderer) {
  const gl = renderer.getContext();
  const extension = gl.getExtension('WEBGL_debug_renderer_info');
  return extension ? gl.getParameter(extension.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER) || 'unknown';
}

// Probe the GPU before renderer creation (AA is a context-creation flag).
export function detectWeakGpu() {
  try {
    const probe = document.createElement('canvas').getContext('webgl2') || document.createElement('canvas').getContext('webgl');
    if (!probe) return true;
    const extension = probe.getExtension('WEBGL_debug_renderer_info');
    const name = extension ? probe.getParameter(extension.UNMASKED_RENDERER_WEBGL) : probe.getParameter(probe.RENDERER) || '';
    return /swiftshader|llvmpipe|software|microsoft basic/i.test(name);
  } catch {
    return true;
  }
}
