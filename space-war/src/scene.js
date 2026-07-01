// scene.js — scene / camera / renderer / luzes. Singletons partilhados.

import * as THREE from '../../vendor/three.module.min.js';
import { RENDER } from './config.js';

export const scene = new THREE.Scene();

// Câmera com far ENORME (sistema solar em escala real-ish). O logarithmicDepthBuffer
// (no renderer) evita z-fighting entre a nave (perto) e planetas a centenas de milhares de u.
export const camera = new THREE.PerspectiveCamera(
  62,
  window.innerWidth / window.innerHeight,
  RENDER.near,
  RENDER.far,
);
camera.position.set(0, 6, 18);

export const renderer = new THREE.WebGLRenderer({
  antialias: true,
  powerPreference: 'high-performance',
  logarithmicDepthBuffer: true,
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0x000007, 1);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;
document.body.appendChild(renderer.domElement);

// Luz do Sol (PointLight criada em bodies.js e anexada ao Sol).
// Luz ambiente fraca para o lado escuro dos planetas não ficar 100% preto.
export const ambLight = new THREE.AmbientLight(0x223044, 0.55);
scene.add(ambLight);

// Estrela-luz de preenchimento muito sutil (luz das galáxias de fundo).
export const fillLight = new THREE.HemisphereLight(0x334466, 0x110814, 0.25);
scene.add(fillLight);

export function onResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}
window.addEventListener('resize', onResize);
