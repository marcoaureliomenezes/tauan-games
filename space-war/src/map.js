// map.js — Mapa do Sistema Solar (overlay 2D top-down) com a posição da nave.

import { game } from './state.js';

let canvas, ctx;

export function initMap() {
  canvas = document.getElementById('mapCanvas');
  if (!canvas) return;
  ctx = canvas.getContext('2d');
  resize();
  window.addEventListener('resize', resize);
}
function resize() {
  if (!canvas) return;
  canvas.width = window.innerWidth; canvas.height = window.innerHeight;
}

export function toggleMap() {
  game.mapOpen = !game.mapOpen;
  if (canvas) canvas.style.display = game.mapOpen ? 'block' : 'none';
}

export function drawMap() {
  if (!game.mapOpen || !ctx) return;
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = 'rgba(2,4,12,0.82)';
  ctx.fillRect(0, 0, W, H);

  const cx = W / 2, cy = H / 2;
  // Escala: Netuno (~320000) cabe na tela.
  const maxR = 340000;
  const scale = (Math.min(W, H) * 0.46) / maxR;

  ctx.font = '12px monospace'; ctx.textAlign = 'center';
  ctx.fillStyle = '#7df'; ctx.fillText('MAPA DO SISTEMA SOLAR  —  [M] fecha', cx, 28);

  // Sol
  ctx.fillStyle = '#ffd24d';
  ctx.beginPath(); ctx.arc(cx, cy, 7, 0, Math.PI * 2); ctx.fill();

  for (const b of game.bodies) {
    if (b.isSun || b.isMoon || b.system === 'binary') continue;
    // órbita
    ctx.strokeStyle = 'rgba(120,150,200,0.25)';
    ctx.beginPath(); ctx.arc(cx, cy, b.orbit * scale, 0, Math.PI * 2); ctx.stroke();
    // planeta
    const px = cx + b.worldPos.x * scale;
    const py = cy + b.worldPos.z * scale;
    ctx.fillStyle = colorHex(b.def.color);
    ctx.beginPath(); ctx.arc(px, py, Math.max(2.5, Math.min(11, b.def.radius * scale * 3)), 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#9ab'; ctx.fillText(b.def.name, px, py - 10);
  }

  // Nave
  const s = game.ship;
  if (s.pos) {
    const sx = cx + s.pos.x * scale, sy = cy + s.pos.z * scale;
    ctx.fillStyle = '#66ffcc';
    ctx.beginPath();
    ctx.moveTo(sx, sy - 7); ctx.lineTo(sx - 5, sy + 5); ctx.lineTo(sx + 5, sy + 5); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(102,255,204,0.6)';
    ctx.beginPath(); ctx.arc(sx, sy, 12, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = '#cef';
    ctx.fillText('VOCÊ', sx, sy + 22);
  }
}

function colorHex(c) { return '#' + c.toString(16).padStart(6, '0'); }
