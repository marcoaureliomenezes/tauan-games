// minimap.js — Circular minimap (bottom-right), rotating with player heading:
// cropped region of the prerendered relief map + nearby markers. Always visible.
// Exports: initMinimap, updateMinimap. To tune, edit MAP.MINI_* in config.js.

import { WORLD, MAP } from './config.js';
import { game } from './state.js';
import { getBaseMap, worldToMap } from './map.js';

let canvas = null;
let ctx = null;

/** Grabs the minimap canvas. Call once from main.js. */
export function initMinimap() {
  canvas = document.getElementById('minimap');
  if (canvas) ctx = canvas.getContext('2d');
}

/** Draws a marker in player-relative rotated space. */
function marker(x, z, color, size) {
  const p = game.player;
  const h = p.heading;
  const dx = x - p.position.x, dz = z - p.position.z;
  const range = MAP.MINI_RANGE;
  if (Math.hypot(dx, dz) > range) return;
  // rotate so the player's forward is screen-up
  const fwdX = Math.sin(h), fwdZ = Math.cos(h);
  const rightX = Math.cos(h), rightZ = -Math.sin(h);
  const rx = dx * rightX + dz * rightZ;
  const rz = dx * fwdX + dz * fwdZ;
  const scale = MAP.MINI_RADIUS / range;
  const sx = MAP.MINI_RADIUS + rx * scale;
  const sy = MAP.MINI_RADIUS - rz * scale;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(sx, sy, size, 0, Math.PI * 2);
  ctx.fill();
}

/** Per-frame minimap redraw. */
export function updateMinimap() {
  if (!ctx) return;
  const base = getBaseMap();
  const R = MAP.MINI_RADIUS;
  const p = game.player;
  const range = MAP.MINI_RANGE;

  ctx.clearRect(0, 0, R * 2, R * 2);
  ctx.save();
  ctx.beginPath();
  ctx.arc(R, R, R, 0, Math.PI * 2);
  ctx.clip();

  // Rotated crop of the prerendered relief around the player
  const [bx, by] = worldToMap(p.position.x, p.position.z, base.width);
  const crop = (range / WORLD.SIZE) * base.width;
  ctx.translate(R, R);
  ctx.rotate(p.heading - Math.PI); // player's forward -> screen-up
  ctx.drawImage(base, bx - crop, by - crop, crop * 2, crop * 2, -R, -R, R * 2, R * 2);
  ctx.restore();

  ctx.save();
  ctx.beginPath();
  ctx.arc(R, R, R, 0, Math.PI * 2);
  ctx.clip();
  for (const b of game.entities.bandits) {
    if (b.state !== 'captured') marker(b.position.x, b.position.z, MAP.BANDIT_COLOR, 3.5);
  }
  for (const t of game.entities.towns) marker(t.position.x, t.position.z, '#e0c060', 4);
  for (const v of game.entities.villages) marker(v.position.x, v.position.z, '#c06030', 4);
  const camp = game.entities.camp;
  if (camp) marker(camp.position.x, camp.position.z, '#60c060', 4);
  const train = game.entities.train;
  if (train) marker(train.position.x, train.position.z, '#404040', 3.5);

  // Player arrow, fixed center-up
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(R, R - 8);
  ctx.lineTo(R - 5, R + 6);
  ctx.lineTo(R, R + 2);
  ctx.lineTo(R + 5, R + 6);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // Ring border
  ctx.strokeStyle = 'rgba(232,178,90,0.8)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(R, R, R - 1, 0, Math.PI * 2);
  ctx.stroke();
}
