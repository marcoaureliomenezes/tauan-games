// splat.js — Procedural terrain texturing: 4 canvas textures (grass/dirt/rock/
// snow) generated offline at boot, blended in the shader by world height/slope
// via onBeforeCompile on MeshLambertMaterial. Exports: makeTerrainMaterial.
// Replaces the old flat vertex-color look; the heightAt contract is untouched.

import * as THREE from '../../vendor/three.module.min.js';
import { TERRAIN } from './config.js';

function canvasTexture(painter) {
  const cv = document.createElement('canvas');
  cv.width = 256; cv.height = 256;
  painter(cv.getContext('2d'));
  const tex = new THREE.CanvasTexture(cv);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function speckle(ctx, n, rMin, rMax, colors) {
  for (let i = 0; i < n; i++) {
    ctx.fillStyle = colors[(Math.random() * colors.length) | 0];
    const r = rMin + Math.random() * (rMax - rMin);
    ctx.beginPath();
    ctx.arc(Math.random() * 256, Math.random() * 256, r, 0, Math.PI * 2);
    ctx.fill();
  }
}

function makeGrassTex() {
  return canvasTexture((ctx) => {
    ctx.fillStyle = '#4d7a35';
    ctx.fillRect(0, 0, 256, 256);
    speckle(ctx, 900, 0.5, 2, ['#5a8a3c', '#426a2c', '#6a9a45', '#3c6028']);
    ctx.strokeStyle = 'rgba(60,96,40,0.5)';
    for (let i = 0; i < 160; i++) {
      const x = Math.random() * 256, y = Math.random() * 256;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + (Math.random() - 0.5) * 3, y - 2 - Math.random() * 4);
      ctx.stroke();
    }
  });
}

function makeDirtTex() {
  return canvasTexture((ctx) => {
    ctx.fillStyle = '#7a5f3d';
    ctx.fillRect(0, 0, 256, 256);
    speckle(ctx, 500, 0.5, 2.5, ['#8a6f48', '#6a4f30', '#907550']);
    speckle(ctx, 90, 1.5, 3.5, ['#8a8070', '#6a6558', '#9a9080']); // pebbles
  });
}

function makeRockTex() {
  return canvasTexture((ctx) => {
    ctx.fillStyle = '#6f6a63';
    ctx.fillRect(0, 0, 256, 256);
    speckle(ctx, 350, 1, 4, ['#7a756e', '#625d56', '#85807a']);
    ctx.strokeStyle = 'rgba(70,66,60,0.55)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 14; i++) { // strata lines
      const y = i * 19 + Math.random() * 8;
      ctx.beginPath();
      for (let x = 0; x <= 256; x += 16) {
        ctx.lineTo(x, y + Math.sin(x * 0.05 + i) * 4);
      }
      ctx.stroke();
    }
  });
}

function makeSnowTex() {
  return canvasTexture((ctx) => {
    ctx.fillStyle = '#e8ecf0';
    ctx.fillRect(0, 0, 256, 256);
    speckle(ctx, 400, 0.5, 2, ['#dce4ee', '#f4f6fa', '#ccd8e8']);
  });
}

/**
 * Terrain material: MeshLambert with 4-way splat injected into the shader.
 * Weights come from world height/slope (no vertex colors needed).
 */
export function makeTerrainMaterial() {
  const mat = new THREE.MeshLambertMaterial({ color: 0xffffff });
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.tGrass = { value: makeGrassTex() };
    shader.uniforms.tDirt = { value: makeDirtTex() };
    shader.uniforms.tRock = { value: makeRockTex() };
    shader.uniforms.tSnow = { value: makeSnowTex() };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWPos;\nvarying vec3 vNormW;')
      .replace('#include <worldpos_vertex>',
        '#include <worldpos_vertex>\nvWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;\nvNormW = normalize(mat3(modelMatrix) * objectNormal);');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWPos;\nvarying vec3 vNormW;\nuniform sampler2D tGrass;\nuniform sampler2D tDirt;\nuniform sampler2D tRock;\nuniform sampler2D tSnow;')
      .replace('#include <color_fragment>', `
        vec4 tG = texture2D(tGrass, vWPos.xz * 0.25);
        vec4 tD = texture2D(tDirt, vWPos.xz * 0.25);
        vec4 tR = texture2D(tRock, vWPos.xz * 0.125);
        vec4 tS = texture2D(tSnow, vWPos.xz * 0.25);
        float slope = 1.0 - vNormW.y;
        float rockW = smoothstep(0.22, 0.45, slope);
        float snowW = smoothstep(${TERRAIN.SNOW_LINE.toFixed(1)}, ${(TERRAIN.SNOW_LINE + 28).toFixed(1)}, vWPos.y) * (1.0 - rockW * 0.6);
        float dirtW = smoothstep(0.10, 0.28, slope) * (1.0 - rockW);
        float grassW = max(0.0, 1.0 - dirtW - rockW - snowW);
        float wSum = grassW + dirtW + rockW + snowW;
        diffuseColor *= (tG * grassW + tD * dirtW + tR * rockW + tS * snowW) / wSum;
      `);
  };
  return mat;
}
