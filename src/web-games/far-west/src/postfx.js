// postfx.js — Post-processing: EffectComposer with subtle UnrealBloomPass
// (strength 0.25, threshold 0.85, half-res). Skipped entirely in test mode.
// Exports: initPostfx. Used only by main.js.

import * as THREE from '../../vendor/three.module.min.js';
import { EffectComposer } from '../../vendor/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from '../../vendor/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from '../../vendor/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from '../../vendor/jsm/postprocessing/OutputPass.js';

/**
 * Builds the composer. @returns {{render: function, setSize: function}}
 */
export function initPostfx(renderer, scene, camera) {
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(
    new THREE.Vector2(window.innerWidth / 2, window.innerHeight / 2),
    0.25,  // strength
    0.4,   // radius
    0.9,   // threshold
  );
  composer.addPass(bloom);
  composer.addPass(new OutputPass());
  return {
    render() { composer.render(); },
    setSize(w, h) { composer.setSize(w, h); },
  };
}
