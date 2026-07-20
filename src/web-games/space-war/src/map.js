// map.js — Mapa do Sistema Solar (overlay 2D top-down) com a posição da nave.

import { game } from './state.js';
import { SYSTEMS } from './config.js';
import { phaseStatus } from './campaign.js';

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

// Projeção RADIAL-LOG centrada no Sol: o sistema interno E o sistema binário
// (a ~820k) cabem no mesmo mapa; órbitas circulares continuam círculos.
const LOG_R0 = 6000;      // u — raio de referência (até aqui o mapa é ~linear)
const MAX_R = 940000;     // u — alcance do mapa (binário + margem)
function projRadius(r, k) { return k * Math.log10(1 + r / LOG_R0); }

export function drawMap() {
  if (!game.mapOpen || !ctx) return;
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = 'rgba(2,4,12,0.82)';
  ctx.fillRect(0, 0, W, H);

  // MODO ORBIT (three-states-v1): mapa LOCAL do sistema planetário acoplado —
  // planeta no centro, escala linear, órbitas das luas/estações desenhadas.
  if (game.mode === 'orbit' && game.planetary) { drawLocalMap(game.planetary, W, H); return; }

  const cx = W / 2, cy = H / 2;
  const k = (Math.min(W, H) * 0.46) / Math.log10(1 + MAX_R / LOG_R0);
  const project = (x, z) => {
    const r = Math.hypot(x, z);
    if (r < 1e-6) return [cx, cy];
    const pr = projRadius(r, k);
    return [cx + (x / r) * pr, cy + (z / r) * pr];
  };

  ctx.font = '12px monospace'; ctx.textAlign = 'center';
  ctx.fillStyle = '#7df'; ctx.fillText('MAPA GALÁCTICO — 5 SISTEMAS (escala log)  —  [M] fecha', cx, 28);

  // Marcadores dos sistemas: anel + nome + ESTADO DE CAMPANHA (✔ vencido /
  // ▶ fase atual / 🔒 bloqueado / LIVRE = fora da campanha, ex.: Véu).
  for (const sys of SYSTEMS) {
    if (sys.key === 'solar') continue;
    const [mx, my] = project(sys.center[0], sys.center[2]);
    const st = phaseStatus(sys.key);
    const ringCol = st === 'done' ? 'rgba(110,255,140,0.55)'
      : st === 'active' ? 'rgba(122,214,255,0.7)'
      : st === 'locked' ? 'rgba(150,150,170,0.35)'
      : 'rgba(255,210,122,0.45)';
    ctx.strokeStyle = ringCol;
    ctx.setLineDash([4, 4]);
    ctx.beginPath(); ctx.arc(mx, my, 16, 0, Math.PI * 2); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = st === 'locked' ? '#99a' : '#ffd27a';
    const badge = st === 'done' ? '✔ ' : st === 'active' ? '▶ ' : st === 'locked' ? '🔒 ' : '';
    ctx.fillText(`${badge}${sys.name}${st === null ? ' (livre)' : ''}`, mx, my - 22);
  }

  // Estado da fase solar (o centro do mapa é o Sol — sem marcador próprio).
  const solarSt = phaseStatus('solar');
  if (solarSt) {
    ctx.fillStyle = solarSt === 'done' ? '#6f8' : '#7df';
    ctx.textAlign = 'left';
    ctx.fillText(`${solarSt === 'done' ? '✔' : '▶'} SISTEMA SOLAR — fase ${solarSt === 'done' ? 'vencida' : 'atual'}`, 18, 52);
    ctx.textAlign = 'center';
  }

  // Anéis de distância (escala log legível)
  for (const r of [50000, 200000, 820000]) {
    ctx.strokeStyle = 'rgba(90,110,150,0.14)';
    ctx.beginPath(); ctx.arc(cx, cy, projRadius(r, k), 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = 'rgba(120,140,180,0.5)';
    ctx.fillText(`${(r / 1000) | 0}k`, cx + projRadius(r, k) * 0.7071, cy - projRadius(r, k) * 0.7071 - 4);
  }

  // Sol
  ctx.fillStyle = '#ffd24d';
  ctx.beginPath(); ctx.arc(cx, cy, 7, 0, Math.PI * 2); ctx.fill();

  for (const b of game.bodies) {
    if (b.isSun || b.isMoon) continue;
    const [px, py] = project(b.worldPos.x, b.worldPos.z);
    if (b.def.kind === 'blackhole' || b.def.kind === 'neutron') {
      // Buraco negro (binário OU supermassivo) / estrela de nêutrons — ícones dedicados
      if (b.def.kind === 'blackhole') {
        const rr = b.def.rs > 500 ? 10 : 7;   // SMBH maior no mapa
        ctx.strokeStyle = '#ff9a3c'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(px, py, rr, 0, Math.PI * 2); ctx.stroke();
        ctx.fillStyle = '#000';
        ctx.beginPath(); ctx.arc(px, py, rr * 0.65, 0, Math.PI * 2); ctx.fill();
      } else {
        ctx.fillStyle = '#cfe4ff';
        ctx.beginPath(); ctx.arc(px, py, 4, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = 'rgba(160,200,255,0.55)';
        ctx.beginPath(); ctx.arc(px, py, 8, 0, Math.PI * 2); ctx.stroke();
      }
      ctx.fillStyle = '#b18cff'; ctx.fillText(b.def.name, px, py - 12);
      continue;
    }
    // órbita (círculo em torno do centro do sistema do corpo)
    if (b.orbit && b.system !== 'binary') {
      ctx.strokeStyle = 'rgba(120,150,200,0.25)';
      ctx.beginPath(); ctx.arc(cx, cy, projRadius(b.orbit, k), 0, Math.PI * 2); ctx.stroke();
    }
    const dotR = b.system === 'binary' ? 2.5 : Math.max(2.5, Math.min(9, projRadius(b.def.radius * 3, k) * 0.05 + 2.5));
    ctx.fillStyle = colorHex(b.def.color);
    ctx.beginPath(); ctx.arc(px, py, dotR, 0, Math.PI * 2); ctx.fill();
    // rótulo: só sistema solar + betelgeuse (os enxames caóticos viram pontos — sem poluição)
    if (b.system === 'solar' || b.system === 'betelgeuse') {
      ctx.fillStyle = '#9ab'; ctx.fillText(b.def.name, px, py - 10);
    }
  }

  // Nave + linha até o alvo de navegação
  const s = game.ship;
  if (s.pos) {
    const [sx, sy] = project(s.pos.x, s.pos.z);
    const t = game.nav?.target;
    if (t && t.pos) {
      const [tx, ty] = project(t.pos.x, t.pos.z);
      ctx.setLineDash([6, 6]);
      ctx.strokeStyle = 'rgba(102,221,255,0.5)'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(tx, ty); ctx.stroke();
      ctx.setLineDash([]);
    }
    ctx.fillStyle = '#66ffcc';
    ctx.beginPath();
    ctx.moveTo(sx, sy - 7); ctx.lineTo(sx - 5, sy + 5); ctx.lineTo(sx + 5, sy + 5); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(102,255,204,0.6)';
    ctx.beginPath(); ctx.arc(sx, sy, 12, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = '#cef';
    ctx.fillText('VOCÊ', sx, sy + 22);
  }
}

function colorHex(c) { return '#' + (c ?? 0x9aa8bb).toString(16).padStart(6, '0'); }

// ── Mapa LOCAL do sistema planetário (modo ORBIT) ───────────────────────────
// Escala LINEAR centrada no planeta: cabe o raio do sistema (1.5× lua mais
// distante). Lua/estações como pontos nas suas órbitas; nave + alvo como no
// mapa galáctico. É a "planta da fase" planetária.
function drawLocalMap(ps, W, H) {
  const cx = W / 2, cy = H / 2;
  const k = (Math.min(W, H) * 0.44) / ps.radius;
  const C = ps.body.worldPos;
  const project = (x, z) => [cx + (x - C.x) * k, cy + (z - C.z) * k];

  ctx.font = '12px monospace'; ctx.textAlign = 'center';
  ctx.fillStyle = '#8fd6ff';
  ctx.fillText(`SISTEMA PLANETÁRIO — ${ps.name.toUpperCase()} (escala linear)  —  [M] fecha`, cx, 28);

  // borda do sistema planetário (raio de acoplamento)
  ctx.strokeStyle = 'rgba(122,214,255,0.30)';
  ctx.setLineDash([6, 6]);
  ctx.beginPath(); ctx.arc(cx, cy, ps.radius * k, 0, Math.PI * 2); ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = 'rgba(122,214,255,0.55)';
  ctx.fillText('borda de acoplamento (1.5× satélite mais distante)', cx, cy - ps.radius * k + 16);

  // órbitas das luas/estações + corpos
  for (const m of ps.body.moons) {
    ctx.strokeStyle = 'rgba(120,150,200,0.22)';
    ctx.beginPath(); ctx.arc(cx, cy, m.orbit * k, 0, Math.PI * 2); ctx.stroke();
    const [mx, my] = project(m.worldPos.x, m.worldPos.z);
    const isStation = m.def.kind === 'station';
    ctx.fillStyle = isStation ? '#ffd27a' : colorHex(m.def.color);
    ctx.beginPath(); ctx.arc(mx, my, isStation ? 3 : 4.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#9ab';
    ctx.fillText(m.def.name, mx, my - 9);
  }

  // planeta central (raio em escala, com piso de legibilidade)
  ctx.fillStyle = colorHex(ps.body.def.color);
  ctx.beginPath(); ctx.arc(cx, cy, Math.max(10, ps.body.def.radius * k), 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#cfe8ff';
  ctx.fillText(ps.name, cx, cy - Math.max(14, ps.body.def.radius * k + 6));

  // nave + linha até o alvo
  const s = game.ship;
  if (s.pos) {
    const [sx, sy] = project(s.pos.x, s.pos.z);
    const t = game.nav?.target;
    if (t && t.pos) {
      const [tx, ty] = project(t.pos.x, t.pos.z);
      ctx.setLineDash([6, 6]);
      ctx.strokeStyle = 'rgba(102,221,255,0.5)'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(tx, ty); ctx.stroke();
      ctx.setLineDash([]);
    }
    ctx.fillStyle = '#66ffcc';
    ctx.beginPath();
    ctx.moveTo(sx, sy - 7); ctx.lineTo(sx - 5, sy + 5); ctx.lineTo(sx + 5, sy + 5); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(102,255,204,0.6)';
    ctx.beginPath(); ctx.arc(sx, sy, 12, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = '#cef';
    ctx.fillText('VOCÊ', sx, sy + 22);
  }
}
