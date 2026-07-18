import * as THREE from '../../vendor/three.module.min.js';
import { createRandom, hashSeed } from './random.js';

const TEXTURE_SIZE = 512;

export function createMissionMaterials(mission, width, height) {
  const wallMap = wallTexture(mission.palette.wall, `${mission.code}-wall`);
  const floorMap = floorTexture(mission.palette.floor, `${mission.code}-floor`);
  wallMap.repeat.set(1, 1);
  floorMap.repeat.set(width / 2, height / 2);
  return {
    wall: new THREE.MeshStandardMaterial({
      color: 0xffffff, map: wallMap, roughness: 0.86, metalness: mission.code === 'OP-05' ? 0.32 : 0.06,
    }),
    floor: new THREE.MeshStandardMaterial({ color: 0xffffff, map: floorMap, roughness: 0.9, metalness: 0.05 }),
    trim: new THREE.MeshStandardMaterial({ color: 0x242825, roughness: 0.5, metalness: 0.6 }),
    accent: new THREE.MeshStandardMaterial({
      color: mission.palette.accent, emissive: mission.palette.accent, emissiveIntensity: 0.18, roughness: 0.28, metalness: 0.68,
    }),
    textures: [wallMap, floorMap],
  };
}

function baseCanvas(color, seed) {
  const canvas = document.createElement('canvas');
  canvas.width = TEXTURE_SIZE;
  canvas.height = TEXTURE_SIZE;
  const context = canvas.getContext('2d');
  // raw sRGB bytes: THREE.Color would convert to linear working space, and the
  // sRGB-tagged CanvasTexture would then darken everything a second time
  const red = (color >> 16) & 255;
  const green = (color >> 8) & 255;
  const blue = color & 255;
  const random = createRandom(hashSeed(seed));
  const image = context.createImageData(TEXTURE_SIZE, TEXTURE_SIZE);
  for (let index = 0; index < image.data.length; index += 4) {
    const grain = 0.84 + random() * 0.24;
    image.data[index] = Math.min(255, red * grain);
    image.data[index + 1] = Math.min(255, green * grain);
    image.data[index + 2] = Math.min(255, blue * grain);
    image.data[index + 3] = 255;
  }
  context.putImageData(image, 0, 0);
  return { canvas, context, random };
}

function blotch(context, random, count, alpha) {
  for (let index = 0; index < count; index += 1) {
    const x = random() * TEXTURE_SIZE;
    const y = random() * TEXTURE_SIZE;
    const radius = 30 + random() * 130;
    const dark = random() > 0.45;
    const gradient = context.createRadialGradient(x, y, 0, x, y, radius);
    gradient.addColorStop(0, dark ? `rgba(18,16,12,${alpha})` : `rgba(228,222,206,${alpha * 0.7})`);
    gradient.addColorStop(1, 'rgba(0,0,0,0)');
    context.fillStyle = gradient;
    context.fillRect(x - radius, y - radius, radius * 2, radius * 2);
  }
}

function grimeStreaks(context, random, count) {
  for (let index = 0; index < count; index += 1) {
    const x = random() * TEXTURE_SIZE;
    const length = 60 + random() * 240;
    const width = 3 + random() * 14;
    const gradient = context.createLinearGradient(x, 0, x, length);
    gradient.addColorStop(0, `rgba(15,14,10,${0.05 + random() * 0.1})`);
    gradient.addColorStop(1, 'rgba(0,0,0,0)');
    context.fillStyle = gradient;
    context.fillRect(x - width / 2, 0, width, length);
  }
}

function wallTexture(color, seed) {
  const { context, random } = baseCanvas(color, seed);
  blotch(context, random, 16, 0.16);
  grimeStreaks(context, random, 22);
  // panel seams with highlight/shadow pair
  for (let x = 0; x <= TEXTURE_SIZE; x += 128) {
    context.fillStyle = 'rgba(10,10,8,.4)';
    context.fillRect(x - 1, 0, 2, TEXTURE_SIZE);
    context.fillStyle = 'rgba(235,230,215,.12)';
    context.fillRect(x + 1, 0, 1, TEXTURE_SIZE);
  }
  context.fillStyle = 'rgba(10,10,8,.32)';
  context.fillRect(0, 126, TEXTURE_SIZE, 2);
  context.fillStyle = 'rgba(235,230,215,.1)';
  context.fillRect(0, 128, TEXTURE_SIZE, 1);
  // baseboard — darker scuffed strip along the floor line
  const base = context.createLinearGradient(0, TEXTURE_SIZE - 92, 0, TEXTURE_SIZE);
  base.addColorStop(0, 'rgba(0,0,0,0)');
  base.addColorStop(0.35, 'rgba(14,13,10,.34)');
  base.addColorStop(1, 'rgba(10,9,7,.62)');
  context.fillStyle = base;
  context.fillRect(0, TEXTURE_SIZE - 92, TEXTURE_SIZE, 92);
  context.fillStyle = 'rgba(0,0,0,.5)';
  context.fillRect(0, TEXTURE_SIZE - 94, TEXTURE_SIZE, 2);
  // scuffs and scratches
  context.strokeStyle = 'rgba(12,12,10,.22)';
  context.lineWidth = 1;
  for (let index = 0; index < 14; index += 1) {
    const x = random() * TEXTURE_SIZE;
    const y = random() * TEXTURE_SIZE;
    context.beginPath();
    context.moveTo(x, y);
    context.lineTo(x + random() * 40 - 20, y + random() * 60);
    context.stroke();
  }
  return toTexture(context.canvas);
}

function floorTexture(color, seed) {
  const { context, random } = baseCanvas(color, seed);
  blotch(context, random, 20, 0.2);
  // concrete tiles with beveled edges (2x2 tiles per texture)
  const tile = TEXTURE_SIZE / 2;
  for (let line = 0; line <= TEXTURE_SIZE; line += tile) {
    context.fillStyle = 'rgba(8,8,6,.5)';
    context.fillRect(line - 2, 0, 3, TEXTURE_SIZE);
    context.fillRect(0, line - 2, TEXTURE_SIZE, 3);
    context.fillStyle = 'rgba(230,226,212,.1)';
    context.fillRect(line + 1, 0, 1, TEXTURE_SIZE);
    context.fillRect(0, line + 1, TEXTURE_SIZE, 1);
  }
  // oil stains
  for (let index = 0; index < 7; index += 1) {
    const x = random() * TEXTURE_SIZE;
    const y = random() * TEXTURE_SIZE;
    const radius = 14 + random() * 46;
    const gradient = context.createRadialGradient(x, y, 0, x, y, radius);
    gradient.addColorStop(0, `rgba(10,10,8,${0.14 + random() * 0.16})`);
    gradient.addColorStop(1, 'rgba(0,0,0,0)');
    context.fillStyle = gradient;
    context.fillRect(x - radius, y - radius, radius * 2, radius * 2);
  }
  // hairline cracks — short random walks
  context.strokeStyle = 'rgba(10,10,8,.3)';
  context.lineWidth = 1;
  for (let index = 0; index < 6; index += 1) {
    let x = random() * TEXTURE_SIZE;
    let y = random() * TEXTURE_SIZE;
    context.beginPath();
    context.moveTo(x, y);
    for (let step = 0; step < 8; step += 1) {
      x += random() * 30 - 15;
      y += random() * 30 - 6;
      context.lineTo(x, y);
    }
    context.stroke();
  }
  return toTexture(context.canvas);
}

function toTexture(canvas) {
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}
