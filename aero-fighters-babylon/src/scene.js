// scene.js — Engine, Scene, Camera, Luzes, Fog.
// Exporta: engine, scene, camera, dirLight, ambLight, attachToBody.

/* global BABYLON */

const canvas = document.createElement('canvas');
canvas.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;display:block;';
document.body.appendChild(canvas);

export const engine = new BABYLON.Engine(canvas, true, {
  preserveDrawingBuffer: false,
  stencil: false,
});

export const scene = new BABYLON.Scene(engine);
scene.clearColor = new BABYLON.Color4(0.1, 0.4, 0.9, 1.0);

// Fog exponencial — mesma sensacao que Three.js LinearFog(FOG_NEAR, FOG_FAR)
scene.fogMode = BABYLON.Scene.FOGMODE_LINEAR;
scene.fogStart = 300;
scene.fogEnd = 700;
scene.fogColor = new BABYLON.Color3(0.56, 0.78, 0.94);

// Camera de seguimento — sera atualizada manualmente pelo main.js
export const camera = new BABYLON.FreeCamera('cam', new BABYLON.Vector3(0, 85, 10), scene);
camera.minZ = 0.5;
camera.maxZ = 5000;
// Nao attach ao canvas — controle manual via quaternion no main loop
// camera.attachControl(canvas, false);

// Luz direcional (sol)
export const dirLight = new BABYLON.DirectionalLight('sun', new BABYLON.Vector3(-0.3, -1, -0.2), scene);
dirLight.position = new BABYLON.Vector3(0, 300, 0);
dirLight.diffuse = new BABYLON.Color3(1.0, 0.98, 0.85);
dirLight.intensity = 1.15;

// Luz hemisferica (ambiente)
export const ambLight = new BABYLON.HemisphericLight('amb', new BABYLON.Vector3(0, 1, 0), scene);
ambLight.diffuse = new BABYLON.Color3(1.0, 1.0, 1.0);
ambLight.groundColor = new BABYLON.Color3(0.4, 0.45, 0.5);
ambLight.intensity = 0.55;

// Resize handler
window.addEventListener('resize', () => engine.resize());
