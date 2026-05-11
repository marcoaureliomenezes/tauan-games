// scene.js — Setup do mundo 3D (Three.js): cena, câmera, renderer, luzes, fog, resize.
// Exporta: scene, camera, renderer, dirLight, ambLight, fillLight, attachToBody().
// Skybox estático foi substituído pelo sky dome dinâmico em sky.js.

import * as THREE from '../../vendor/three.module.min.js';
import { WORLD } from './config.js';

export const scene = new THREE.Scene();
scene.fog = new THREE.Fog(WORLD.SKY_COLOR, WORLD.FOG_NEAR, WORLD.FOG_FAR);

export const camera = new THREE.PerspectiveCamera(80, window.innerWidth / window.innerHeight, 0.1, 2000);
camera.position.set(0, 90, 20);

// Detecta ambiente automatizado (Playwright/headless) — desliga shadow map nesses casos
const HEADLESS = typeof navigator !== 'undefined' && navigator.webdriver === true;

export const renderer = new THREE.WebGLRenderer({ antialias: !HEADLESS, powerPreference: 'high-performance' });
renderer.setPixelRatio(1);
renderer.shadowMap.enabled = !HEADLESS;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;

const RENDER_SCALE = 0.75;
function applyRendererSize() {
  const w = Math.floor(window.innerWidth * RENDER_SCALE);
  const h = Math.floor(window.innerHeight * RENDER_SCALE);
  renderer.setSize(w, h, false);
  renderer.domElement.style.width = window.innerWidth + 'px';
  renderer.domElement.style.height = window.innerHeight + 'px';
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  applyRendererSize();
});

// Luzes — referências exportadas para main.js poder atualizar via getSunData()/getAmbientData()
export const ambLight = new THREE.AmbientLight(0xffffff, 0.55);
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

export const fillLight = new THREE.DirectionalLight(0xaaccff, 0.3);
fillLight.position.set(-100, 50, 200);
scene.add(fillLight);

/** Anexa o canvas no DOM. Chamar uma vez no boot. */
export function attachToBody() {
  applyRendererSize();
  document.body.appendChild(renderer.domElement);
}
