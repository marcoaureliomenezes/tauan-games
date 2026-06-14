// skybox.js — Fundo galáctico procedural pintado em canvas e mapeado numa esfera.
// Aqui mora o pedido de "cores muito bonitas": Via Láctea, Andrômeda, Nuvens de
// Magalhães, nebulosas famosas, buracos negros, supernova e quasares com redshift.
// Tudo é pintado UMA vez numa textura — custo zero por frame.

import * as THREE from '../../vendor/three.module.min.js';
import { RENDER } from './config.js';

// PRNG seeded (mulberry32) para um céu estável e testável.
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Mancha de gás suave (nebulosa) com cores vibrantes via gradiente radial aditivo.
function nebula(ctx, x, y, r, colors, rnd, blobs = 26) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < blobs; i++) {
    const a = rnd() * Math.PI * 2;
    const d = Math.pow(rnd(), 0.6) * r;
    const bx = x + Math.cos(a) * d;
    const by = y + Math.sin(a) * d * 0.7;
    const br = r * (0.25 + rnd() * 0.55);
    const c = colors[(rnd() * colors.length) | 0];
    const g = ctx.createRadialGradient(bx, by, 0, bx, by, br);
    g.addColorStop(0, c.replace('ALPHA', (0.10 + rnd() * 0.16).toFixed(3)));
    g.addColorStop(0.5, c.replace('ALPHA', (0.04 + rnd() * 0.06).toFixed(3)));
    g.addColorStop(1, c.replace('ALPHA', '0'));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(bx, by, br, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function star(ctx, x, y, r, color, alpha) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, color.replace('ALPHA', alpha.toFixed(3)));
  g.addColorStop(0.4, color.replace('ALPHA', (alpha * 0.5).toFixed(3)));
  g.addColorStop(1, color.replace('ALPHA', '0'));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

// Cruz de difração para estrelas brilhantes / supernovas.
function diffraction(ctx, x, y, len, color, alpha) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.strokeStyle = color.replace('ALPHA', alpha.toFixed(3));
  ctx.lineWidth = 1.2;
  for (const ang of [0, Math.PI / 2, Math.PI / 4, -Math.PI / 4]) {
    const l = ang % (Math.PI / 2) === 0 ? len : len * 0.5;
    ctx.beginPath();
    ctx.moveTo(x - Math.cos(ang) * l, y - Math.sin(ang) * l);
    ctx.lineTo(x + Math.cos(ang) * l, y + Math.sin(ang) * l);
    ctx.stroke();
  }
  ctx.restore();
}

// Estrela como ponto minúsculo e nítido (real). fillRect é barato e não "incha".
function dot(ctx, x, y, size, rgb, alpha) {
  ctx.globalAlpha = alpha;
  ctx.fillStyle = rgb;
  ctx.fillRect(x | 0, y | 0, size, size);
  ctx.globalAlpha = 1;
}

function paintSky() {
  const W = 4096, H = 2048;
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');
  const rnd = mulberry32(7777);

  // 1. Fundo: preto-azulado profundo com leve gradiente.
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#03020a');
  bg.addColorStop(0.5, '#050310');
  bg.addColorStop(1, '#02030c');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // 2. Campo de estrelas distante — classes espectrais (cor = temperatura).
  // Azul/branco quentes, amarelo solar, laranja, e vermelhas (frias/distantes).
  const starColors = [
    'rgba(170,200,255,ALPHA)', // O/B azul
    'rgba(220,230,255,ALPHA)', // A branco-azulado
    'rgba(255,250,235,ALPHA)', // F/G branco-amarelo
    'rgba(255,225,170,ALPHA)', // K laranja
    'rgba(255,180,150,ALPHA)', // M vermelho-alaranjado
  ];
  const dotColors = ['#aac8ff', '#dce6ff', '#fffaeb', '#ffe1aa', '#ffb496'];
  // Maioria: pontos minúsculos e nítidos (1px). Espaço é assim.
  for (let i = 0; i < 20000; i++) {
    const x = rnd() * W, y = rnd() * H;
    const ci = (Math.pow(rnd(), 1.6) * dotColors.length) | 0;
    const mag = Math.pow(rnd(), 5);
    dot(ctx, x, y, mag > 0.7 ? 2 : 1, dotColors[ci], 0.35 + mag * 0.6);
  }
  // Poucas estrelas brilhantes com leve glow; raríssimas com cruz de difração.
  for (let i = 0; i < 260; i++) {
    const x = rnd() * W, y = rnd() * H;
    const c = starColors[(rnd() * starColors.length) | 0];
    const mag = 0.6 + rnd() * 0.4;
    star(ctx, x, y, 1.6 + mag * 2.2, c, 0.6);
    if (mag > 0.9) diffraction(ctx, x, y, 10 + mag * 14, c, 0.3);
  }

  // 3. QUASARES — pontos avermelhados muito distantes (redshift forte).
  for (let i = 0; i < 40; i++) {
    const x = rnd() * W, y = rnd() * H;
    star(ctx, x, y, 1.2 + rnd() * 1.5, 'rgba(255,90,70,ALPHA)', 0.7);
    star(ctx, x, y, 6 + rnd() * 8, 'rgba(180,40,40,ALPHA)', 0.10); // halo redshift
  }
  // Galáxias distantes de fundo (manchinhas elípticas avermelhadas/douradas).
  for (let i = 0; i < 120; i++) {
    const x = rnd() * W, y = rnd() * H;
    const r = 4 + rnd() * 14;
    const tint = rnd() < 0.5 ? 'rgba(210,120,90,ALPHA)' : 'rgba(200,180,140,ALPHA)';
    ctx.save();
    ctx.translate(x, y); ctx.rotate(rnd() * Math.PI); ctx.scale(1, 0.4 + rnd() * 0.3);
    star(ctx, 0, 0, r, tint, 0.18);
    ctx.restore();
  }

  // 4. VIA LÁCTEA — banda larga diagonal, densa em estrelas + nebulosidade colorida,
  //    com faixas escuras de poeira e um bojo central dourado brilhante.
  ctx.save();
  ctx.translate(W * 0.5, H * 0.52);
  ctx.rotate(-0.32);
  const bandH = H * 0.34;
  // Brilho difuso da banda
  const mwGrad = ctx.createLinearGradient(0, -bandH / 2, 0, bandH / 2);
  mwGrad.addColorStop(0, 'rgba(40,40,80,0)');
  mwGrad.addColorStop(0.5, 'rgba(150,140,170,0.10)');
  mwGrad.addColorStop(1, 'rgba(40,40,80,0)');
  ctx.fillStyle = mwGrad;
  ctx.fillRect(-W, -bandH / 2, W * 2, bandH);
  // Estrelas densas da banda (pontos minúsculos = poeira de estrelas)
  for (let i = 0; i < 26000; i++) {
    const x = (rnd() - 0.5) * W * 1.6;
    const gy = (rnd() - 0.5) + (rnd() - 0.5);     // concentra no centro
    const y = gy * bandH * 0.5;
    const fade = 1 - Math.abs(y) / (bandH * 0.5);
    const c = dotColors[(rnd() * dotColors.length) | 0];
    dot(ctx, x, y, 1, c, (0.2 + 0.45 * fade) * (0.5 + rnd() * 0.5));
  }
  // Nebulosidade colorida ao longo da banda (rosa/azul/turquesa)
  nebula(ctx, -W * 0.30, 0, bandH * 0.8, ['rgba(200,70,150,ALPHA)', 'rgba(80,120,220,ALPHA)'], rnd, 30);
  nebula(ctx, W * 0.18, bandH * 0.1, bandH * 0.9, ['rgba(70,180,180,ALPHA)', 'rgba(160,90,200,ALPHA)'], rnd, 30);
  // Bojo central dourado
  const bulge = ctx.createRadialGradient(0, 0, 0, 0, 0, bandH * 0.9);
  bulge.addColorStop(0, 'rgba(255,225,160,0.30)');
  bulge.addColorStop(0.4, 'rgba(255,190,120,0.12)');
  bulge.addColorStop(1, 'rgba(255,190,120,0)');
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = bulge; ctx.beginPath(); ctx.ellipse(0, 0, bandH * 0.9, bandH * 0.5, 0, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  // Faixas escuras de poeira (dust lanes)
  ctx.globalCompositeOperation = 'source-over';
  for (let i = 0; i < 7; i++) {
    const y = (rnd() - 0.5) * bandH * 0.4;
    const dg = ctx.createLinearGradient(0, y - 14, 0, y + 14);
    dg.addColorStop(0, 'rgba(5,3,12,0)');
    dg.addColorStop(0.5, `rgba(5,3,12,${0.45 + rnd() * 0.3})`);
    dg.addColorStop(1, 'rgba(5,3,12,0)');
    ctx.fillStyle = dg;
    ctx.fillRect(-W, y - 16, W * 2, 32);
  }
  ctx.restore();

  // 5. NEBULOSAS FAMOSAS, nomeadas, espalhadas e bem coloridas.
  // Órion (azul + rosa H-alfa)
  nebula(ctx, W * 0.16, H * 0.30, 230, ['rgba(120,150,255,ALPHA)', 'rgba(255,90,140,ALPHA)', 'rgba(220,220,255,ALPHA)'], rnd, 34);
  // Carina (laranja/vermelho intenso)
  nebula(ctx, W * 0.74, H * 0.66, 260, ['rgba(255,120,40,ALPHA)', 'rgba(255,60,60,ALPHA)', 'rgba(255,200,120,ALPHA)'], rnd, 36);
  // Águia / Eagle (verde-teal + dourado)
  nebula(ctx, W * 0.40, H * 0.78, 180, ['rgba(60,220,170,ALPHA)', 'rgba(220,200,90,ALPHA)'], rnd, 28);
  // Hélix (anel ciano/magenta — "olho de deus")
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const hx = W * 0.88, hy = H * 0.22, hr = 90;
  for (let i = 0; i < 60; i++) {
    const a = rnd() * Math.PI * 2;
    star(ctx, hx + Math.cos(a) * hr, hy + Math.sin(a) * hr * 0.92, 26 + rnd() * 18,
      rnd() < 0.5 ? 'rgba(60,220,230,ALPHA)' : 'rgba(220,80,180,ALPHA)', 0.08);
  }
  star(ctx, hx, hy, 40, 'rgba(120,255,230,ALPHA)', 0.10);
  ctx.restore();
  // Laguna (rosa difuso)
  nebula(ctx, W * 0.06, H * 0.70, 150, ['rgba(255,80,150,ALPHA)', 'rgba(120,80,220,ALPHA)'], rnd, 24);

  // 6. ANDRÔMEDA — galáxia espiral grande e inclinada, com núcleo brilhante.
  drawGalaxy(ctx, W * 0.30, H * 0.16, 220, 0.42, -0.5, rnd, 'rgba(220,210,255,ALPHA)', 'rgba(120,150,255,ALPHA)');
  // Galáxia do Triângulo (menor, perto de Andrômeda)
  drawGalaxy(ctx, W * 0.40, H * 0.10, 90, 0.6, 0.3, rnd, 'rgba(200,220,255,ALPHA)', 'rgba(100,200,200,ALPHA)');

  // 7. NUVENS DE MAGALHÃES — duas galáxias irregulares satélite.
  nebula(ctx, W * 0.60, H * 0.90, 120, ['rgba(200,210,255,ALPHA)', 'rgba(150,170,255,ALPHA)'], rnd, 22);
  nebula(ctx, W * 0.68, H * 0.94, 70, ['rgba(210,220,255,ALPHA)', 'rgba(170,190,255,ALPHA)'], rnd, 16);

  // 8. SUPERNOVA — estrela super-brilhante com casca em expansão e raios de difração.
  const sx = W * 0.55, sy = H * 0.40;
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  star(ctx, sx, sy, 70, 'rgba(180,220,255,ALPHA)', 0.12);   // casca externa
  star(ctx, sx, sy, 34, 'rgba(255,240,210,ALPHA)', 0.30);
  star(ctx, sx, sy, 10, 'rgba(255,255,255,ALPHA)', 0.95);   // núcleo
  diffraction(ctx, sx, sy, 130, 'rgba(255,255,255,ALPHA)', 0.6);
  ctx.restore();

  // 9. BURACOS NEGROS — disco escuro, anel de acreção brilhante e lente gravitacional.
  drawBlackHole(ctx, W * 0.84, H * 0.46, 36, rnd);
  drawBlackHole(ctx, W * 0.10, H * 0.50, 22, rnd);

  return canvas;
}

// Galáxia espiral simples: núcleo + braços de estrelas em log-spiral.
function drawGalaxy(ctx, x, y, r, flatten, rot, rnd, coreColor, armColor) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.scale(1, flatten);
  ctx.globalCompositeOperation = 'lighter';
  // halo
  star(ctx, 0, 0, r, coreColor, 0.10);
  // braços espirais
  for (let arm = 0; arm < 2; arm++) {
    const base = arm * Math.PI;
    for (let i = 0; i < 1400; i++) {
      const t = i / 1400;
      const ang = base + t * 6.0;
      const rad = t * r;
      const jitter = (rnd() - 0.5) * r * 0.10;
      const px = Math.cos(ang) * rad + Math.cos(ang + 1.5) * jitter;
      const py = Math.sin(ang) * rad + Math.sin(ang + 1.5) * jitter;
      star(ctx, px, py, 0.6 + rnd() * 1.6, rnd() < 0.3 ? coreColor : armColor, 0.18 + rnd() * 0.18);
    }
  }
  // núcleo brilhante
  star(ctx, 0, 0, r * 0.28, 'rgba(255,245,220,ALPHA)', 0.5);
  star(ctx, 0, 0, r * 0.10, 'rgba(255,255,255,ALPHA)', 0.9);
  ctx.restore();
}

// Buraco negro: sombra central + anel de acreção quente + lente.
function drawBlackHole(ctx, x, y, r, rnd) {
  ctx.save();
  ctx.translate(x, y);
  ctx.globalCompositeOperation = 'lighter';
  // lente / glow externo
  star(ctx, 0, 0, r * 3.2, 'rgba(120,90,255,ALPHA)', 0.05);
  // anel de acreção (laranja-branco quente), elíptico
  for (let i = 0; i < 220; i++) {
    const a = rnd() * Math.PI * 2;
    const rr = r * (1.25 + rnd() * 0.5);
    const px = Math.cos(a) * rr * 1.7;
    const py = Math.sin(a) * rr * 0.5;
    const hot = rnd();
    const c = hot > 0.6 ? 'rgba(255,240,200,ALPHA)' : hot > 0.3 ? 'rgba(255,160,60,ALPHA)' : 'rgba(255,90,40,ALPHA)';
    star(ctx, px, py, 1 + rnd() * 2.5, c, 0.5);
  }
  // sombra central (event horizon) — pinta por cima
  ctx.globalCompositeOperation = 'source-over';
  const sh = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
  sh.addColorStop(0, 'rgba(0,0,0,1)');
  sh.addColorStop(0.7, 'rgba(0,0,0,1)');
  sh.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = sh;
  ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

export function createSkybox() {
  const canvas = paintSky();
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  const geo = new THREE.SphereGeometry(RENDER.skyboxRadius, 32, 20);
  const mat = new THREE.MeshBasicMaterial({ map: tex, side: THREE.BackSide, depthWrite: false, fog: false });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.renderOrder = -1;
  return mesh;
}
