// map.js — Fullscreen map ([M]): relief prerendered ONCE from world data
// (hypsometric tints + hillshade, rivers/lake in blue, bridges), dynamic
// markers per frame (player arrow, camp, towns, villages, free bandits, train).
// Exports: initMap, updateMap, getBaseMap, worldToMap. Minimap reuses getBaseMap.

import { WORLD, MAP, TERRAIN } from './config.js';
import { game } from './state.js';

let base = null;      // offscreen prerendered canvas
let canvas = null;    // fullscreen map canvas
let ctx2d = null;

/** Hypsometric tint by height + slope. */
function tint(h, slope) {
  if (h > TERRAIN.SNOW_LINE) return [232, 236, 240];
  if (slope > TERRAIN.ROCK_SLOPE * 1.2) return [110, 105, 98];
  if (h > 60) return [150, 125, 90];   // brown highlands
  if (h > 30) return [120, 130, 75];   // dry hills
  return [88, 122, 60];                // green valleys
}

/** Prerenders the relief + rivers + lake + bridges to an offscreen canvas. */
function prerender() {
  const R = MAP.RES;
  base = document.createElement('canvas');
  base.width = R; base.height = R;
  const c = base.getContext('2d');
  const img = c.createImageData(R, R);
  const step = WORLD.SIZE / R;
  for (let py = 0; py < R; py++) {
    for (let px = 0; px < R; px++) {
      const x = -WORLD.HALF + px * step;
      const z = -WORLD.HALF + py * step;
      const h = game.world.heightAt(x, z);
      const s = game.world.slopeAt(x, z);
      const [r, g, b] = tint(h, s);
      // Hillshade: light from the NW
      const dhx = game.world.heightAt(x + step, z) - h;
      const dhz = game.world.heightAt(x, z + step) - h;
      const shade = Math.max(-0.35, Math.min(0.35, (dhx + dhz) * 0.12));
      const k = 1 - shade;
      const i = (py * R + px) * 4;
      img.data[i] = r * k;
      img.data[i + 1] = g * k;
      img.data[i + 2] = b * k;
      img.data[i + 3] = 255;
    }
  }
  c.putImageData(img, 0, 0);

  // Rivers in blue
  c.strokeStyle = '#2e6f9e';
  c.lineCap = 'round';
  for (const rv of game.world.rivers) {
    c.lineWidth = Math.max(2, (rv.width / WORLD.SIZE) * R);
    c.beginPath();
    rv.points.forEach((p, i) => {
      const [mx, my] = worldToMap(p.x, p.z, R);
      if (i === 0) c.moveTo(mx, my);
      else c.lineTo(mx, my);
    });
    c.stroke();
  }
  const lake = game.world.lake;
  c.fillStyle = '#2a6484';
  c.beginPath();
  const [lx, ly] = worldToMap(lake.x, lake.z, R);
  c.arc(lx, ly, (lake.radius / WORLD.SIZE) * R, 0, Math.PI * 2);
  c.fill();
  // Bridges
  c.fillStyle = '#d8b060';
  for (const b of game.world.bridges) {
    const [bx, by] = worldToMap(b.cx, b.cz, R);
    c.fillRect(bx - 3, by - 3, 6, 6);
  }
}

/** World (x,z) -> map px (px, py) for a canvas of `size` px. North (-Z) is up. */
export function worldToMap(x, z, size) {
  return [((x + WORLD.HALF) / WORLD.SIZE) * size, ((z + WORLD.HALF) / WORLD.SIZE) * size];
}

/** Prerendered relief canvas (shared with the minimap). */
export function getBaseMap() {
  return base;
}

/** Builds the prerender and grabs the fullscreen canvas. Call once after buildWorld. */
export function initMap() {
  prerender();
  canvas = document.getElementById('map-canvas');
  if (canvas) ctx2d = canvas.getContext('2d');
}

function dot(c, x, y, r, color) {
  c.fillStyle = color;
  c.beginPath();
  c.arc(x, y, r, 0, Math.PI * 2);
  c.fill();
}

function markerShape(c, x, y, size, color, shape) {
  c.fillStyle = color;
  if (shape === 'square') c.fillRect(x - size / 2, y - size / 2, size, size);
  else if (shape === 'triangle') {
    c.beginPath();
    c.moveTo(x, y - size / 1.6);
    c.lineTo(x - size / 1.6, y + size / 2);
    c.lineTo(x + size / 1.6, y + size / 2);
    c.closePath();
    c.fill();
  }
}

/** Per-frame map redraw (only while open). */
export function updateMap() {
  if (!game.ui.mapOpen || !ctx2d) return;
  const size = Math.min(window.innerWidth, window.innerHeight) - MAP.MARGIN * 2;
  if (canvas.width !== size) { canvas.width = size; canvas.height = size; }
  ctx2d.imageSmoothingEnabled = true;
  ctx2d.drawImage(base, 0, 0, size, size);

  // Towns / villages / camp
  for (const t of game.entities.towns) {
    const [x, y] = worldToMap(t.position.x, t.position.z, size);
    markerShape(ctx2d, x, y, 10, '#e0c060', 'square');
  }
  for (const v of game.entities.villages) {
    const [x, y] = worldToMap(v.position.x, v.position.z, size);
    markerShape(ctx2d, x, y, 10, '#c06030', 'triangle');
  }
  const camp = game.entities.camp;
  if (camp) {
    const [x, y] = worldToMap(camp.position.x, camp.position.z, size);
    markerShape(ctx2d, x, y, 9, '#60c060', 'triangle');
  }
  // Bandits: only free (wander/flee) or surrendered — never captured
  let banditCount = 0;
  for (const b of game.entities.bandits) {
    if (b.state === 'captured') continue;
    banditCount++;
    const [x, y] = worldToMap(b.position.x, b.position.z, size);
    dot(ctx2d, x, y, 4, MAP.BANDIT_COLOR);
  }
  // CONTRACT: writer of game.ui.mapMarkers.bandits
  game.ui.mapMarkers.bandits = banditCount;
  // Train
  const train = game.entities.train;
  if (train) {
    const [x, y] = worldToMap(train.position.x, train.position.z, size);
    dot(ctx2d, x, y, 4, '#404040');
  }
  // Player arrow (heading)
  const p = game.player;
  const [px, py] = worldToMap(p.position.x, p.position.z, size);
  ctx2d.save();
  ctx2d.translate(px, py);
  ctx2d.rotate(Math.PI - p.heading); // canvas y-down: map world forward to screen
  ctx2d.fillStyle = '#ffffff';
  ctx2d.beginPath();
  ctx2d.moveTo(0, -9);
  ctx2d.lineTo(-6, 7);
  ctx2d.lineTo(0, 3);
  ctx2d.lineTo(6, 7);
  ctx2d.closePath();
  ctx2d.fill();
  ctx2d.restore();

  // Legend + hint
  ctx2d.fillStyle = 'rgba(0,0,0,0.55)';
  ctx2d.fillRect(8, size - 66, 250, 58);
  ctx2d.fillStyle = '#e8b25a';
  ctx2d.font = '12px monospace';
  ctx2d.fillText('■ cidade   ▲ aldeia/acamp.   ● bandido', 16, size - 44);
  ctx2d.fillText('● trem (preto)   ▲ você (branco)', 16, size - 28);
  ctx2d.fillText('[M] fecha', 16, size - 12);
}
