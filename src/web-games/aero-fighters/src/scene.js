// scene.js — Setup do mundo 3D (Three.js): cena, câmera, renderer, luzes, fog, resize.
// Exporta: scene, camera, renderer, dirLight, ambLight, fillLight, HEADLESS,
//   initComposer(), renderFrame(), attachToBody().
// Céu dinâmico em sky.js (dome Preetham — T-V-05); bloom sutil via composer (T-V-06).

import * as THREE from '../../../../vendor/three.module.min.js';
import { EffectComposer } from '../../../../vendor/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from '../../../../vendor/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from '../../../../vendor/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from '../../../../vendor/jsm/postprocessing/OutputPass.js';
import { WORLD } from './config.js';

export const scene = new THREE.Scene();
scene.fog = new THREE.Fog(WORLD.SKY_COLOR, WORLD.FOG_NEAR, WORLD.FOG_FAR);

// T-V-07 (inhauma-visual-uplift-v1): near 0.1 → 1.0 — a razão 60000:1 de profundidade
// causava z-fighting distante; 1.0 sobra (câmera fica a ~5 u do jato).
export const camera = new THREE.PerspectiveCamera(80, window.innerWidth / window.innerHeight, 1.0, 6000);
camera.position.set(0, 90, 20);

// Detecta ambiente automatizado (Playwright/headless) — desliga shadow map nesses casos
export const HEADLESS = typeof navigator !== 'undefined' && navigator.webdriver === true;

export const renderer = new THREE.WebGLRenderer({ antialias: !HEADLESS, powerPreference: 'high-performance' });
renderer.setPixelRatio(HEADLESS ? 1 : Math.min(window.devicePixelRatio || 1, 1.5));
renderer.setClearColor(WORLD.SKY_COLOR);
renderer.shadowMap.enabled = !HEADLESS;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
// T-V-06: o tone mapping do renderer NÃO é aplicado ao renderizar em render target
// (regra interna do r165) — o EffectComposer renderiza linear e o OutputPass aplica
// ACES + sRGB lendo renderer.toneMapping. Por isso ele permanece ACESFilmic aqui:
// NoToneMapping faria o OutputPass pular o ACES (só sRGB), contra a intenção da task.
renderer.toneMapping = HEADLESS ? THREE.NoToneMapping : THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;

// T-V-02 (inhauma-visual-uplift-v1): browser renderiza em resolução cheia — o
// framebuffer a 0.75 esticado por CSS deixava a imagem permanentemente borrada.
// Headless (Playwright/CI) segue a 0.35 por velocidade da suíte.
const RENDER_SCALE = HEADLESS ? 0.35 : 1.0;
function applyRendererSize() {
  const w = Math.floor(window.innerWidth * RENDER_SCALE);
  const h = Math.floor(window.innerHeight * RENDER_SCALE);
  renderer.setSize(w, h, false);
  // T-V-06: o composer precisa acompanhar o mesmo render scale
  if (_composer) _composer.setSize(w, h);
  renderer.domElement.style.width = window.innerWidth + 'px';
  renderer.domElement.style.height = window.innerHeight + 'px';
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  applyRendererSize();
});

// Luzes — referências exportadas para main.js poder atualizar via getSunData()/getAmbientData()
// T-V-07: HemisphereLight (céu/solo) no lugar do AmbientLight flat — mantém o nome
// `ambLight` e o caminho de update em main.js (main.js agora também escreve groundColor).
export const ambLight = new THREE.HemisphereLight(0xbfd8ff, 0x4a4438, 0.55);
scene.add(ambLight);

export const dirLight = new THREE.DirectionalLight(0xfff4cc, 1.15);
dirLight.position.set(200, 300, -150);
dirLight.castShadow = true;
// Frustum da câmera de sombra: dimensionado para a área ao redor do player
dirLight.shadow.camera.left   = -200;
dirLight.shadow.camera.right  =  200;
dirLight.shadow.camera.top    =  200;
dirLight.shadow.camera.bottom = -200;
dirLight.shadow.camera.near   =  10;
dirLight.shadow.camera.far    =  900;
dirLight.shadow.mapSize.set(1024, 1024);
dirLight.shadow.bias = -0.0008;
scene.add(dirLight);
scene.add(dirLight.target);

// T-V-07: intensidade modulada por frame em main.js (era 0.5 fixo até de noite)
export const fillLight = new THREE.DirectionalLight(0xaaccff, 0.5);
fillLight.position.set(-100, 50, 200);
scene.add(fillLight);

// ─── Pós-processamento (T-V-06) ──────────────────────────────────────────────
// Bloom sutil (força 0.2, raio 0.4, limiar 1.0) via addons vendored.
// T-V-18 (verificação final): limiar 0.9→1.0 — a banda de fog/neve em dia claro
// (~0.9 de luminância) estava florescendo e estourando as vistas de altitude.
// Headless NÃO usa composer — render direto mantém a suíte Playwright rápida.
let _composer = null;

/** Cria o EffectComposer (bloom + output). Não-op em headless. Chamar uma vez no boot. */
export function initComposer() {
  if (HEADLESS || _composer) return;
  _composer = new EffectComposer(renderer);
  _composer.addPass(new RenderPass(scene, camera));
  _composer.addPass(new UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight), 0.2, 0.4, 1.0,
  ));
  _composer.addPass(new OutputPass());
  applyRendererSize(); // alinha os buffers do composer ao render scale atual
}

/** Renderiza um frame — composer quando disponível, render direto em headless. */
export function renderFrame() {
  if (_composer) _composer.render();
  else renderer.render(scene, camera);
}

/** Anexa o canvas no DOM. Chamar uma vez no boot. */
export function attachToBody() {
  applyRendererSize();
  document.body.appendChild(renderer.domElement);
}
