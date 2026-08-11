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

  function sample(fps) {
    if (mode === 'compatibility' || forced) return;
    lowSamples = fps < 30 ? lowSamples + 1 : Math.max(0, lowSamples - 1);
    if (lowSamples < 3) return;
    mode = 'compatibility';
    game.telemetry.quality = mode;
    configureRenderer();
    apply(scene);
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

  return { apply, sample, shouldRender, resize, get mode() { return mode; } };
}

function rendererName(renderer) {
  const gl = renderer.getContext();
  const extension = gl.getExtension('WEBGL_debug_renderer_info');
  return extension ? gl.getParameter(extension.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER) || 'unknown';
}
