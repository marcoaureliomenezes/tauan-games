// scene.js — Setup do mundo 3D (Three.js): cena, câmera, renderer, luzes, sol, fog, resize.
// Exporta: `scene`, `camera`, `renderer`, `attachToBody()`.
// Para mudar a paleta do céu/fog: edite WORLD em config.js.

import * as THREE from '../../vendor/three.module.min.js';
import { WORLD } from './config.js';

export const scene = new THREE.Scene();
scene.fog = new THREE.Fog(WORLD.SKY_COLOR, WORLD.FOG_NEAR, WORLD.FOG_FAR);

/** Pinta uma face do cubemap (gradiente vertical + nuvens difusas). */
function paintSkyFace(side) {
  const cv = document.createElement('canvas');
  cv.width = 512; cv.height = 512;
  const ctx = cv.getContext('2d');
  if (side === 'top') {
    // topo: azul claro uniforme
    ctx.fillStyle = '#5fa9d8'; ctx.fillRect(0, 0, 512, 512);
  } else if (side === 'bottom') {
    // base: azul mais escuro (reflexo do mar)
    ctx.fillStyle = '#2a5575'; ctx.fillRect(0, 0, 512, 512);
  } else {
    // laterais: gradiente do horizonte (claro embaixo) para cima (azul)
    const grad = ctx.createLinearGradient(0, 0, 0, 512);
    grad.addColorStop(0,    '#6fb5e0');
    grad.addColorStop(0.55, '#9ed3eb');
    grad.addColorStop(1.0,  '#dceaf1');
    ctx.fillStyle = grad; ctx.fillRect(0, 0, 512, 512);
    // Nuvens difusas (apenas na parte superior das faces laterais)
    if (side !== 'bottom') {
      for (let i = 0; i < 40; i++) {
        const x = Math.random() * 512;
        const y = Math.random() * 220;
        const r = 30 + Math.random() * 70;
        const g = ctx.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0,   'rgba(255,255,255,0.55)');
        g.addColorStop(0.6, 'rgba(255,255,255,0.18)');
        g.addColorStop(1,   'rgba(255,255,255,0)');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
      }
    }
  }
  return cv;
}

const skyboxTex = new THREE.CubeTexture([
  paintSkyFace('px'), paintSkyFace('nx'),
  paintSkyFace('top'), paintSkyFace('bottom'),
  paintSkyFace('pz'), paintSkyFace('nz'),
]);
skyboxTex.needsUpdate = true;
scene.background = skyboxTex;

export const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 2000);
camera.position.set(0, 90, 20);

export const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(1);
// Detecta ambiente automatizado (Playwright/headless) — desliga shadow map nesses casos
const HEADLESS = typeof navigator !== 'undefined' && navigator.webdriver === true;
renderer.shadowMap.enabled = !HEADLESS;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

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

// Luzes
scene.add(new THREE.AmbientLight(0xffffff, 0.55));
const dirLight = new THREE.DirectionalLight(0xfff4cc, 1.15);
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
// Exporta para que main.js possa atualizar o frustum seguindo o player
export { dirLight };
const fillLight = new THREE.DirectionalLight(0xaaccff, 0.3);
fillLight.position.set(-100, 50, 200); scene.add(fillLight);

// Sol
const sunMesh = new THREE.Mesh(
  new THREE.SphereGeometry(20, 12, 12),
  new THREE.MeshBasicMaterial({ color: 0xfffaaa }),
);
sunMesh.position.set(400, 280, -900); scene.add(sunMesh);
const sunGlow = new THREE.Mesh(
  new THREE.SphereGeometry(36, 12, 12),
  new THREE.MeshBasicMaterial({ color: 0xffee88, transparent: true, opacity: 0.22 }),
);
sunGlow.position.copy(sunMesh.position); scene.add(sunGlow);

/** Anexa o canvas no DOM. Chamar uma vez no boot. */
export function attachToBody() {
  applyRendererSize();
  document.body.appendChild(renderer.domElement);
}
