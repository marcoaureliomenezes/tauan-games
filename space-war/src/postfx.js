// postfx.js — Pós-processamento (bloom) via examples/jsm do three r165 (vendorado).
// Reuso de terceiros (2026-07-01): EffectComposer + UnrealBloomPass + OutputPass —
// não reimplementamos bloom. O bloom é o que faz Sol, estrela de nêutrons, disco de
// acreção e lasers BRILHAREM de verdade em vez de parecerem adesivos chapados.
//
// Headless/CI: composer desligado (renderer.render direto) — swiftshader estável.

import * as THREE from '../../vendor/three.module.min.js';
import { EffectComposer } from '../../vendor/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from '../../vendor/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from '../../vendor/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from '../../vendor/jsm/postprocessing/OutputPass.js';

const HEADLESS = typeof navigator !== 'undefined' && navigator.webdriver === true;

let _composer = null;
let _renderer = null, _scene = null, _camera = null;

export function initPostFx(renderer, scene, camera) {
  _renderer = renderer; _scene = scene; _camera = camera;
  if (HEADLESS) return null;
  _composer = new EffectComposer(renderer);
  _composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight),
    0.55,   // strength — brilho dos emissores (sol/pulsar/disco/lasers)
    0.45,   // radius — espalhamento suave
    0.88,   // threshold — só o que é realmente brilhante floresce
  );
  _composer.addPass(bloom);
  _composer.addPass(new OutputPass());
  window.addEventListener('resize', () => {
    _composer.setSize(window.innerWidth, window.innerHeight);
  });
  return _composer;
}

export function renderFrame() {
  if (_composer) _composer.render();
  else _renderer.render(_scene, _camera);
}
