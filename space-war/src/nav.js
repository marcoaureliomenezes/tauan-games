// nav.js — Sistema de navegação: alvo selecionável + mira/seta na tela que sempre
// aponta para onde você quer ir. Resolve o problema de "não consigo navegar".

import * as THREE from '../../vendor/three.module.min.js';
import { camera } from './scene.js';
import { game } from './state.js';
import { SYSTEMS } from './config.js';

let canvas, ctx;
const _v = new THREE.Vector3();
const _camDir = new THREE.Vector3();
const _to = new THREE.Vector3();
const _c = new THREE.Vector3();

// Sistema onde a nave está (ou null = espaço interestelar).
export function currentSystem() {
  if (!game.ship?.pos) return SYSTEMS[0];
  for (const sys of SYSTEMS) {
    _c.set(...sys.center);
    if (game.ship.pos.distanceTo(_c) < sys.radius * 1.1) return sys;
  }
  return null;
}

// Itens de destino: missão + PRIMÁRIAS dos 5 sistemas + corpos do sistema atual.
let primaryTargets = [];

export function buildNav() {
  primaryTargets = [];
  for (const sys of SYSTEMS) {
    const b = game.bodies.find((x) => x.def.key === sys.primary);
    if (b) primaryTargets.push(wrapBody(b));
  }
  const earth = game.bodies.find((b) => b.def.key === 'earth');
  game.nav.target = earth ? wrapBody(earth) : primaryTargets[0];
}

function localTargets() {
  const sys = currentSystem();
  if (!sys) return [];
  const list = [];
  for (const b of game.bodies) {
    const sysKey = sys.key === 'solar' ? 'home' : sys.key;
    if (b.system !== sysKey || b.isMoon) continue;
    if (b.def.key === sys.primary) continue;   // primária já está na lista global
    list.push(wrapBody(b));
  }
  return list;
}

function wrapBody(b) {
  return { key: b.def.key, name: b.def.name, radius: b.def.radius, body: b, get pos() { return b.worldPos; } };
}

// Pseudo-alvo "OBJETIVO": a base alienígena ativa mais próxima.
function missionTarget() {
  if (!game.mission) return null;
  const live = game.mission.targets.filter((t) => !t.destroyed);
  if (!live.length) return null;
  const best = () => {
    let b = live[0], bd = Infinity;
    for (const t of live) { const d = t.obj.position.distanceTo(game.ship.pos); if (d < bd) { bd = d; b = t; } }
    return b;
  };
  return {
    key: '__mission', name: '◎ OBJETIVO', radius: 8, isMission: true,
    get pos() { return best().obj.position; },
    // corpo que HOSPEDA a base: a Lua/planeta SE MOVE — a auto-aproximação
    // precisa chegar CO-MÓVEL (senão a velocidade relativa nunca zera e a
    // chegada nunca conclui) e engatar a órbita em volta do corpo certo.
    get body() { return best().body; },
  };
}

function navList() {
  const m = missionTarget();
  const list = [...primaryTargets, ...localTargets()];
  return m ? [m, ...list] : list;
}

export function cycleTarget(dir = 1) {
  const list = navList();
  const cur = game.nav.target;
  let i = list.findIndex((t) => t.key === (cur && cur.key));
  if (i < 0) i = 0;
  i = (i + dir + list.length) % list.length;
  game.nav.target = list[i];
}

// Aponta o nav para o objetivo da missão (chamado quando uma missão começa).
export function targetMission() {
  const m = missionTarget();
  if (m) game.nav.target = m;
}

export function currentTarget() {
  // re-resolve pelo key para acompanhar alvos dinâmicos (missão)
  const list = navList();
  const t = list.find((x) => x.key === (game.nav.target && game.nav.target.key));
  if (t) game.nav.target = t;
  return game.nav.target;
}

export function targetDistance() {
  const t = currentTarget();
  if (!t) return 0;
  return t.pos.distanceTo(game.ship.pos);
}

export function initNavHUD() {
  canvas = document.getElementById('navCanvas');
  if (!canvas) return;
  ctx = canvas.getContext('2d');
  resize();
  window.addEventListener('resize', resize);
}
function resize() { if (canvas) { canvas.width = window.innerWidth; canvas.height = window.innerHeight; } }

export function drawNav() {
  if (!ctx || game.phase !== 'flight' || game.mapOpen) { if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height); return; }
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);

  // Indicador de PUXÃO gravitacional — seta que aponta para o corpo que te puxa,
  // do tamanho da força. Vermelho quando a fuga é impossível.
  drawPullIndicator(ctx, W, H);

  const t = currentTarget();
  if (!t) return;

  const pos = t.pos;
  const dist = pos.distanceTo(game.ship.pos);
  camera.getWorldDirection(_camDir);
  _to.copy(pos).sub(camera.position);
  const front = _to.dot(_camDir) > 0;

  _v.copy(pos).project(camera);
  let sx = (_v.x * 0.5 + 0.5) * W;
  let sy = (-_v.y * 0.5 + 0.5) * H;

  const onScreen = front && _v.x >= -1 && _v.x <= 1 && _v.y >= -1 && _v.y <= 1;
  const color = t.isMission ? '#66ff88' : '#66ddff';

  // Velocidade de APROXIMAÇÃO (componente da velocidade na direção do alvo) + ETA —
  // é isto que torna a navegação legível: estou chegando ou me afastando, e em quanto tempo.
  let approachTxt = '';
  if (game.ship.vel) {
    _to.copy(pos).sub(game.ship.pos).normalize();
    const closing = game.ship.vel.dot(_to);            // >0 = aproximando
    const eta = closing > 1 ? dist / closing : Infinity;
    const arrow = closing > 0.5 ? '▶' : closing < -0.5 ? '◀' : '·';
    approachTxt = `  ${arrow}${fmtDist(Math.abs(closing))}/s${Number.isFinite(eta) && eta < 3600 ? `  ETA ${fmtEta(eta)}` : ''}`;
  }
  const auto = game.nav.approach ? '⏵AUTO  ' : '';
  const text = `${auto}${t.name}  ${fmtDist(dist)}${approachTxt}`;

  if (onScreen) {
    // mira (brackets) + ponto + rótulo
    bracket(ctx, sx, sy, 26, color);
    ctx.fillStyle = color; ctx.beginPath(); ctx.arc(sx, sy, 2.5, 0, Math.PI * 2); ctx.fill();
    label(ctx, text, sx, sy - 38, color);
  } else {
    // seta no bordo apontando para o alvo + linha-guia do centro
    if (!front) { sx = W - sx; sy = H - sy; }
    const ang = Math.atan2(sy - H / 2, sx - W / 2);
    const mx = W / 2 - 60, my = H / 2 - 60;
    const rr = Math.min(Math.abs(mx / Math.cos(ang)), Math.abs(my / Math.sin(ang)));
    const ex = W / 2 + Math.cos(ang) * rr, ey = H / 2 + Math.sin(ang) * rr;
    // linha-guia sutil do centro até a seta
    ctx.strokeStyle = 'rgba(120,200,255,0.18)'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(W / 2, H / 2); ctx.lineTo(ex, ey); ctx.stroke();
    arrow(ctx, ex, ey, ang, color);
    label(ctx, text, ex - Math.cos(ang) * 40, ey - Math.sin(ang) * 40, color);
  }
}
function fmtEta(s) { return s >= 60 ? `${(s / 60) | 0}m${(s % 60) | 0}s` : `${s | 0}s`; }

function bracket(ctx, x, y, s, color) {
  ctx.strokeStyle = color; ctx.lineWidth = 2.5; ctx.lineCap = 'round';
  ctx.beginPath();
  for (const [cx, cy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
    ctx.moveTo(x + cx * s, y + cy * s - cy * 10); ctx.lineTo(x + cx * s, y + cy * s); ctx.lineTo(x + cx * s - cx * 10, y + cy * s);
  }
  ctx.stroke();
}
function arrow(ctx, x, y, ang, color) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(ang);
  // contorno escuro p/ contraste + seta preenchida maior
  ctx.beginPath();
  ctx.moveTo(26, 0); ctx.lineTo(-14, -16); ctx.lineTo(-4, 0); ctx.lineTo(-14, 16); ctx.closePath();
  ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fill();
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(20, 0); ctx.lineTo(-9, -11); ctx.lineTo(-2, 0); ctx.lineTo(-9, 11); ctx.closePath();
  ctx.fillStyle = color; ctx.fill();
  ctx.restore();
}
function label(ctx, text, x, y, color) {
  ctx.font = 'bold 13px monospace'; ctx.textAlign = 'center';
  const w = ctx.measureText(text).width + 12;
  ctx.fillStyle = 'rgba(2,8,18,0.7)'; ctx.fillRect(x - w / 2, y - 11, w, 17);
  ctx.fillStyle = color; ctx.fillText(text, x, y + 2);
}
function fmtDist(d) { return d > 1000 ? `${(d / 1000).toFixed(1)}k` : `${d | 0}`; }

// Seta de gravidade: aponta (do indicador central-inferior) para o corpo dominante,
// com comprimento proporcional à força. Cor escala: lilás → laranja → vermelho (sem fuga).
function drawPullIndicator(ctx, W, H) {
  const s = game.ship;
  if (!s.dominant || s.gravMag < 25) return;

  _v.copy(s.dominant.worldPos).project(camera);
  let sx = (_v.x * 0.5 + 0.5) * W, sy = (-_v.y * 0.5 + 0.5) * H;
  camera.getWorldDirection(_camDir);
  _to.copy(s.dominant.worldPos).sub(camera.position);
  if (_to.dot(_camDir) <= 0) { sx = W - sx; sy = H - sy; }   // atrás → espelha

  const cx = W / 2, cy = H - 110;
  const ang = Math.atan2(sy - cy, sx - cx);
  const danger = !s.canEscape;
  const color = danger ? '#ff4060' : s.gravMag > 200 ? '#ffaa44' : '#b18cff';
  const len = 34 + Math.min(110, s.gravMag * 0.12);

  ctx.save();
  ctx.translate(cx, cy); ctx.rotate(ang);
  ctx.globalAlpha = danger ? 1 : 0.85;
  ctx.strokeStyle = color; ctx.lineWidth = 3.5; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(len, 0); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(len, 0); ctx.lineTo(len - 14, -8); ctx.lineTo(len - 14, 8); ctx.closePath();
  ctx.fillStyle = color; ctx.fill();
  ctx.restore();

  ctx.globalAlpha = 1;
  ctx.font = 'bold 12px monospace'; ctx.textAlign = 'center'; ctx.fillStyle = color;
  ctx.fillText(`PUXÃO → ${s.dominant.def.name}  ${s.gravMag.toFixed(0)} u/s²`, cx, cy + 32);
}
