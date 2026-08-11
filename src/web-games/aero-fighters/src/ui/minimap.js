// minimap.js — Canvas 2D tático (overlay DOM, não WebGL).
// Exporta: initMinimap, updateMinimap.
// Mostra ilhas, player e alvos em tempo real.

import { game } from '../state.js';
import { getAirportForMap } from '../airport.js';

let canvas, ctx;
const MAP_SIZE = 180;
const WORLD_HALF = 2000; // metade da área visível do mundo

/** Inicializa e anexa o canvas do mini-mapa ao DOM. */
export function initMinimap() {
  if (typeof document === 'undefined') return; // HEADLESS guard

  canvas = document.createElement('canvas');
  canvas.width = canvas.height = MAP_SIZE;
  canvas.style.cssText = [
    'position: fixed',
    'bottom: 16px',
    'right: 16px',
    `width: ${MAP_SIZE}px`,
    `height: ${MAP_SIZE}px`,
    'border: 1px solid rgba(255,255,255,0.4)',
    'border-radius: 4px',
    'background: rgba(0,20,40,0.75)',
    'z-index: 10',
    'pointer-events: none',
  ].join(';');
  document.body.appendChild(canvas);
  ctx = canvas.getContext('2d');
}

const mapScale = MAP_SIZE / (WORLD_HALF * 2);

function worldToMap(wx, wz) {
  return {
    x: (wx + WORLD_HALF) * mapScale,
    y: (wz + WORLD_HALF) * mapScale,
  };
}

/** Atualiza o mini-mapa — chamar a cada frame. */
export function updateMinimap() {
  if (!ctx) return;

  // Background oceânico
  ctx.fillStyle = '#001422';
  ctx.fillRect(0, 0, MAP_SIZE, MAP_SIZE);

  // Ilhas
  if (game.islands && game.islands.length) {
    ctx.fillStyle = '#2a4a18';
    for (const isl of game.islands) {
      const { x, y } = worldToMap(isl.cx, isl.cz);
      const r = Math.max(2, isl.radius * mapScale);
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Alvos
  if (game.targets && game.targets.length) {
    for (const t of game.targets) {
      if (t.dead || t.hp <= 0) continue;
      if (!t.mesh) continue;
      const { x, y } = worldToMap(t.mesh.position.x, t.mesh.position.z);
      if (t.type === 'aaGun' || t.type === 'aaGunHeavy') {
        ctx.fillStyle = '#ff3300';
        ctx.fillRect(x - 2, y - 2, 5, 5);
      } else if (t.type === 'warship') {
        ctx.fillStyle = '#5588ff';
        ctx.fillRect(x - 2, y - 2, 5, 5);
      } else {
        ctx.fillStyle = '#ffcc00';
        ctx.fillRect(x - 2, y - 2, 4, 4);
      }
    }
  }

  // Pista do aeroporto do mapa ativo (WS-4)
  {
    const r = getAirportForMap(game.activeMap).runway;
    const a = worldToMap(r.center.x - r.width / 2, r.center.z - r.length / 2);
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.fillRect(a.x, a.y, Math.max(2, r.width * mapScale), Math.max(4, r.length * mapScale));
  }

  // Player
  const px = (game.player.x + WORLD_HALF) * mapScale;
  const pz = ((game.player.pz !== undefined ? game.player.pz : 0) + WORLD_HALF) * mapScale;
  ctx.fillStyle = '#00ff44';
  ctx.beginPath();
  ctx.arc(px, pz, 4, 0, Math.PI * 2);
  ctx.fill();

  // Label Norte
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.font = '9px monospace';
  ctx.fillText('N', 4, 11);

  // Borda
  ctx.strokeStyle = 'rgba(255,255,255,0.3)';
  ctx.strokeRect(0, 0, MAP_SIZE, MAP_SIZE);
}
