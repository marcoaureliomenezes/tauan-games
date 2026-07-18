// textures.js — TEXTURAS procedurais estilo PS1/N64 (Cruis'n World): tudo
// canvas 2D — asfalto com faixas pintadas NA textura, terra com sulcos, grama,
// fachadas com janelas, estratos de mesa, céu com nuvens, árvores billboard.
// A estética N64 é low-poly + textura rica — a textura é quem faz o jogo.

import * as THREE from '../../vendor/three.module.min.js';

function rng(seed) {
  let x = seed | 0 || 88675123;
  return () => { x ^= x << 13; x ^= x >>> 17; x ^= x << 5; return ((x >>> 0) % 100000) / 100000; };
}

function canvas(w, h) {
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  return [cv, cv.getContext('2d')];
}

function tex(cv, repeatX = 1, repeatY = 1) {
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = THREE.RepeatWrapping; t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeatX, repeatY);
  t.anisotropy = 4;
  return t;
}

const hex = (c) => '#' + c.toString(16).padStart(6, '0');

// ── ASFALTO: agregado + trilhas de pneu + faixa central amarela tracejada +
// bordas brancas contínuas — tudo NA textura (u = largura da pista).
export function asphaltTexture() {
  const [cv, ctx] = canvas(256, 256);
  const rnd = rng(101);
  ctx.fillStyle = '#3c3f45'; ctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 2600; i++) {                     // agregado
    const g = 46 + rnd() * 40;
    ctx.fillStyle = `rgb(${g},${g + 2},${g + 6})`;
    ctx.fillRect(rnd() * 256, rnd() * 256, 1.6, 1.6);
  }
  // trilhas de pneu (mais escuras) nos 2 terços
  for (const u of [72, 184]) {
    const grad = ctx.createLinearGradient(u - 26, 0, u + 26, 0);
    grad.addColorStop(0, 'rgba(0,0,0,0)'); grad.addColorStop(0.5, 'rgba(10,10,14,0.35)'); grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad; ctx.fillRect(u - 26, 0, 52, 256);
  }
  // faixa central amarela tracejada
  ctx.fillStyle = '#d8b83c';
  for (let y = 0; y < 256; y += 64) ctx.fillRect(124, y, 8, 34);
  // bordas brancas
  ctx.fillStyle = '#d8d8d2';
  ctx.fillRect(6, 0, 5, 256); ctx.fillRect(245, 0, 5, 256);
  // rachaduras
  ctx.strokeStyle = 'rgba(16,16,20,0.5)'; ctx.lineWidth = 1;
  for (let i = 0; i < 10; i++) {
    ctx.beginPath();
    let x = rnd() * 256, y = rnd() * 256;
    ctx.moveTo(x, y);
    for (let k = 0; k < 5; k++) { x += (rnd() - 0.5) * 40; y += rnd() * 24; ctx.lineTo(x, y); }
    ctx.stroke();
  }
  return tex(cv, 1, 1);
}

// ── TERRA: barro com sulcos de roda longitudinais + pedras.
export function dirtTexture() {
  const [cv, ctx] = canvas(256, 256);
  const rnd = rng(202);
  ctx.fillStyle = '#7d5c38'; ctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 2000; i++) {
    const t0 = rnd();
    ctx.fillStyle = t0 < 0.5 ? 'rgba(96,68,40,0.5)' : 'rgba(150,116,76,0.45)';
    ctx.fillRect(rnd() * 256, rnd() * 256, 2 + rnd() * 3, 1.5 + rnd() * 2);
  }
  // sulcos de roda (2 pares escuros contínuos com ondulação)
  for (const u of [70, 96, 160, 186]) {
    ctx.strokeStyle = 'rgba(60,42,26,0.55)'; ctx.lineWidth = 9;
    ctx.beginPath();
    for (let y = 0; y <= 256; y += 16) {
      const x = u + Math.sin(y * 0.08) * 4 + (rnd() - 0.5) * 3;
      if (y === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  for (let i = 0; i < 60; i++) {                       // pedrinhas
    const g = 120 + rnd() * 60;
    ctx.fillStyle = `rgb(${g},${g * 0.9},${g * 0.75})`;
    ctx.beginPath(); ctx.arc(rnd() * 256, rnd() * 256, 1.5 + rnd() * 2.5, 0, 7); ctx.fill();
  }
  return tex(cv, 1, 1);
}

// ── GRAMA/AREIA do bioma (chão).
export function groundTexture(base, speck1, speck2) {
  const [cv, ctx] = canvas(256, 256);
  const rnd = rng(303);
  ctx.fillStyle = hex(base); ctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 4200; i++) {
    ctx.fillStyle = rnd() < 0.5 ? hex(speck1) : hex(speck2);
    ctx.globalAlpha = 0.25 + rnd() * 0.4;
    ctx.fillRect(rnd() * 256, rnd() * 256, 1.6 + rnd() * 2.4, 1.2 + rnd() * 2);
  }
  ctx.globalAlpha = 1;
  return tex(cv, 90, 90);
}

// ── ÁRVORE billboard (pinheiro ou folhosa) — o truque N64: 2 planos cruzados.
export function treeTexture(kind, seed = 7) {
  const [cv, ctx] = canvas(128, 192);
  const rnd = rng(seed);
  ctx.clearRect(0, 0, 128, 192);
  if (kind === 'pine') {
    ctx.fillStyle = '#5d4226'; ctx.fillRect(58, 148, 12, 44);       // tronco
    for (let layer = 0; layer < 5; layer++) {                        // camadas
      const y = 150 - layer * 30, w = 96 - layer * 16;
      const grad = ctx.createLinearGradient(0, y - 34, 0, y);
      grad.addColorStop(0, '#3f7434'); grad.addColorStop(1, '#1f4720');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(64 - w / 2, y); ctx.lineTo(64 + w / 2, y); ctx.lineTo(64, y - 44);
      ctx.closePath(); ctx.fill();
      // franjas
      ctx.fillStyle = '#2c5c28';
      for (let f = 0; f < 6; f++) {
        const fx = 64 - w / 2 + (w / 6) * f + rnd() * 6;
        ctx.fillRect(fx, y - 3, 5, 8);
      }
    }
  } else if (kind === 'leafy') {
    ctx.fillStyle = '#6a4a2c'; ctx.fillRect(56, 130, 16, 62);
    for (let i = 0; i < 22; i++) {                                   // copa em blobs
      const x = 64 + (rnd() - 0.5) * 76, y = 66 + (rnd() - 0.5) * 74;
      const r = 14 + rnd() * 20;
      const grad = ctx.createRadialGradient(x - 4, y - 5, 2, x, y, r);
      grad.addColorStop(0, '#63a13e'); grad.addColorStop(1, '#2e5c26');
      ctx.fillStyle = grad;
      ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
    }
  } else {                                                           // saguaro
    ctx.fillStyle = '#4a7a3c';
    ctx.fillRect(56, 40, 16, 152);
    ctx.fillRect(28, 80, 12, 60); ctx.fillRect(28, 80, 34, 12);
    ctx.fillRect(88, 60, 12, 74); ctx.fillRect(66, 60, 34, 12);
    ctx.strokeStyle = 'rgba(30,60,26,0.7)'; ctx.lineWidth = 2;
    for (const x of [59, 63, 67, 71]) { ctx.beginPath(); ctx.moveTo(x, 42); ctx.lineTo(x, 190); ctx.stroke(); }
  }
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// ── FACHADA de prédio: janelas iluminadas/apagadas, térreo com vitrine.
export function facadeTexture(seed) {
  const [cv, ctx] = canvas(128, 256);
  const rnd = rng(seed);
  const toneBase = 0.28 + rnd() * 0.34;
  const r = (toneBase * 255 * (0.9 + rnd() * 0.2)) | 0;
  ctx.fillStyle = `rgb(${r},${r + 6},${(r + 14)})`;
  ctx.fillRect(0, 0, 128, 256);
  const cols = 5 + (rnd() * 3 | 0), rows = 10 + (rnd() * 4 | 0);
  const cw = 128 / cols, rh = 236 / rows;
  for (let i = 0; i < cols; i++) {
    for (let j = 0; j < rows; j++) {
      const lit = rnd() < 0.24;
      ctx.fillStyle = lit ? (rnd() < 0.5 ? '#ffd98a' : '#cfe8ff') : '#141a24';
      ctx.fillRect(i * cw + cw * 0.18, j * rh + rh * 0.2, cw * 0.64, rh * 0.55);
    }
  }
  ctx.fillStyle = '#20262e'; ctx.fillRect(0, 236, 128, 20);          // térreo
  ctx.fillStyle = '#9ad0ff';
  for (let i = 0; i < 4; i++) ctx.fillRect(6 + i * 32, 240, 22, 12);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// ── MESA do Arizona: estratos horizontais de arenito.
export function mesaTexture() {
  const [cv, ctx] = canvas(128, 128);
  const rnd = rng(404);
  const bands = ['#b5643c', '#a05432', '#c47448', '#8a4a2e', '#ad5d38'];
  let y = 0;
  while (y < 128) {
    const h = 6 + rnd() * 14;
    ctx.fillStyle = bands[(rnd() * bands.length) | 0];
    ctx.fillRect(0, y, 128, h);
    y += h;
  }
  for (let i = 0; i < 500; i++) {                       // erosão vertical
    ctx.fillStyle = 'rgba(60,30,18,0.25)';
    ctx.fillRect(rnd() * 128, rnd() * 128, 1.4, 3 + rnd() * 9);
  }
  return tex(cv, 3, 1);
}

// ── CÉU: gradiente + sol + nuvens achatadas no horizonte (bem N64).
export function skyTexture(top, bottom) {
  const [cv, ctx] = canvas(1024, 512);
  const rnd = rng(505);
  const grad = ctx.createLinearGradient(0, 0, 0, 512);
  grad.addColorStop(0, hex(top));
  grad.addColorStop(0.72, hex(bottom));
  grad.addColorStop(1, hex(bottom));
  ctx.fillStyle = grad; ctx.fillRect(0, 0, 1024, 512);
  // sol com halo
  const sg = ctx.createRadialGradient(780, 130, 6, 780, 130, 70);
  sg.addColorStop(0, 'rgba(255,250,230,1)'); sg.addColorStop(0.25, 'rgba(255,240,190,0.85)');
  sg.addColorStop(1, 'rgba(255,240,190,0)');
  ctx.fillStyle = sg; ctx.beginPath(); ctx.arc(780, 130, 70, 0, 7); ctx.fill();
  // nuvens: elipses brancas empilhadas, achatadas perto do horizonte
  for (let i = 0; i < 34; i++) {
    const y = 90 + rnd() * 240;
    const flat = 0.25 + (y / 512) * 0.35;
    const x = rnd() * 1024, w = 40 + rnd() * 120;
    ctx.fillStyle = `rgba(255,255,255,${0.16 + rnd() * 0.22})`;
    for (let p = 0; p < 5; p++) {
      ctx.beginPath();
      ctx.ellipse(x + (rnd() - 0.5) * w, y + (rnd() - 0.5) * 10, w * (0.3 + rnd() * 0.4), w * flat * 0.16, 0, 0, 7);
      ctx.fill();
    }
  }
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// ── Cerca de madeira (billboard fino repetido) / guard-rail metálico.
export function fenceTexture(metal) {
  const [cv, ctx] = canvas(128, 64);
  const rnd = rng(606);
  ctx.clearRect(0, 0, 128, 64);
  if (metal) {
    const grad = ctx.createLinearGradient(0, 18, 0, 40);
    grad.addColorStop(0, '#d8dee4'); grad.addColorStop(0.5, '#8a949e'); grad.addColorStop(1, '#c8d0d8');
    ctx.fillStyle = grad; ctx.fillRect(0, 18, 128, 22);
    ctx.fillStyle = '#6a7480';
    for (let x = 0; x < 128; x += 32) ctx.fillRect(x + 14, 12, 6, 40);
  } else {
    ctx.fillStyle = '#8a6a44';
    for (let x = 0; x < 128; x += 32) ctx.fillRect(x + 12, 6, 8, 58);   // mourões
    for (const y of [16, 38]) {                                          // réguas
      ctx.fillStyle = `rgb(${150 + rnd() * 20},${112 + rnd() * 16},${70})`;
      ctx.fillRect(0, y, 128, 9);
    }
  }
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = THREE.RepeatWrapping;
  return t;
}
