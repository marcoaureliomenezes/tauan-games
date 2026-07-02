// postfx.js — Pós-processamento (bloom) via examples/jsm do three r165 (vendorado).
// Reuso de terceiros (2026-07-01): EffectComposer + UnrealBloomPass + OutputPass —
// não reimplementamos bloom. O bloom é o que faz Sol, estrela de nêutrons, disco de
// acreção e lasers BRILHAREM de verdade em vez de parecerem adesivos chapados.
//
// RESOLUÇÃO ADAPTATIVA (fix de lag 2026-07-01): perto de um corpo os shaders FBM
// (estrela/disco/remanescente) dominam o custo POR FRAGMENTO — a única alavanca
// honesta em GPU integrada é renderizar menos fragmentos. Medimos a média móvel do
// frame-time e degrauamos o pixel-ratio (1.0×…0.55× do teto) para manter fluidez;
// quando sobra fôlego, sobe de volta. O bloom (que é um borrão) roda a MEIA resolução.
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
let _basePixelRatio = 1;

export function initPostFx(renderer, scene, camera) {
  _renderer = renderer; _scene = scene; _camera = camera;
  _basePixelRatio = renderer.getPixelRatio();
  if (HEADLESS) return null;
  _composer = new EffectComposer(renderer);
  _composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(
    // (o UnrealBloomPass já divide por 2 internamente e re-divide por mip —
    // o bloom acompanha a resolução adaptativa via composer.setPixelRatio)
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

// ── Resolução adaptativa ──────────────────────────────────────────────────────
const RES_STEPS = [1.0, 0.85, 0.7, 0.55];   // × do pixel-ratio base
let _stepIdx = 0;
let _ema = 1 / 60;          // média exponencial do frame-time
let _cooldown = 0;          // s até a próxima decisão (evita oscilar)

function _applyStep() {
  const pr = _basePixelRatio * RES_STEPS[_stepIdx];
  _renderer.setPixelRatio(pr);
  _renderer.setSize(window.innerWidth, window.innerHeight);
  // setPixelRatio do composer redimensiona TODOS os passes (bloom incluso).
  if (_composer) { _composer.setPixelRatio(pr); _composer.setSize(window.innerWidth, window.innerHeight); }
}

/** Chamar 1× por frame com o dt REAL (antes do clamp de física). */
export function updateAdaptiveRes(dt) {
  if (HEADLESS || !_renderer) return;
  _ema += (dt - _ema) * 0.08;
  _cooldown -= dt;
  if (_cooldown > 0) return;
  if (_ema > 0.026 && _stepIdx < RES_STEPS.length - 1) {
    _stepIdx++; _applyStep(); _cooldown = 1.5;
  } else if (_ema < 0.015 && _stepIdx > 0) {
    _stepIdx--; _applyStep(); _cooldown = 2.5;
  }
}

export function renderFrame() {
  if (_composer) _composer.render();
  else _renderer.render(_scene, _camera);
}
