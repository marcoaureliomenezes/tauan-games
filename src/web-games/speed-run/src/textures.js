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

// ── GRAMA/AREIA do bioma (chão). 512px MULTI-ESCALA: manchas macro (quebram o
// tiling a distância) + grão fino de alto contraste (nítido junto ao carro).
export function groundTexture(base, speck1, speck2) {
  const [cv, ctx] = canvas(512, 512);
  const rnd = rng(303);
  ctx.fillStyle = hex(base); ctx.fillRect(0, 0, 512, 512);
  // manchas macro suaves (claras/escuras) — variação de grande escala
  for (let i = 0; i < 46; i++) {
    const x = rnd() * 512, y = rnd() * 512, r = 30 + rnd() * 90;
    const dark = rnd() < 0.5;
    const grad = ctx.createRadialGradient(x, y, 2, x, y, r);
    grad.addColorStop(0, dark ? 'rgba(0,0,0,0.16)' : 'rgba(255,255,255,0.10)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
  }
  // grão médio (o antigo 256px inteiro virou o "miolo")
  for (let i = 0; i < 9000; i++) {
    ctx.fillStyle = rnd() < 0.5 ? hex(speck1) : hex(speck2);
    ctx.globalAlpha = 0.3 + rnd() * 0.5;                 // contraste maior (era 0.25–0.65)
    ctx.fillRect(rnd() * 512, rnd() * 512, 2.5 + rnd() * 4, 2 + rnd() * 3.4);
  }
  // grão FINO 1–2 px — o que fica nítido debaixo do carro
  for (let i = 0; i < 14000; i++) {
    ctx.fillStyle = rnd() < 0.5 ? hex(speck1) : hex(speck2);
    ctx.globalAlpha = 0.35 + rnd() * 0.45;
    ctx.fillRect(rnd() * 512, rnd() * 512, 1 + rnd(), 1 + rnd());
  }
  ctx.globalAlpha = 1;
  return tex(cv, 90, 90);
}

// ── DETALHE fino do chão (overlay transparente): segunda camada repetida 360×
// — texel ~9 cm junto ao carro, onde a camada base (90×) ainda borraria.
export function groundDetailTexture() {
  const [cv, ctx] = canvas(128, 128);
  const rnd = rng(307);
  ctx.clearRect(0, 0, 128, 128);
  for (let i = 0; i < 1500; i++) {
    const dark = rnd() < 0.55;
    ctx.fillStyle = dark ? 'rgba(20,24,16,0.5)' : 'rgba(255,255,240,0.4)';
    ctx.globalAlpha = 0.12 + rnd() * 0.3;
    ctx.fillRect(rnd() * 128, rnd() * 128, 1 + rnd() * 1.6, 1 + rnd() * 1.4);
  }
  // tufinhos/risquinhos ocasionais p/ quebrar a uniformidade
  for (let i = 0; i < 90; i++) {
    ctx.strokeStyle = rnd() < 0.5 ? 'rgba(14,20,10,0.5)' : 'rgba(235,235,210,0.4)';
    ctx.globalAlpha = 0.2 + rnd() * 0.25;
    ctx.lineWidth = 1;
    const x = rnd() * 128, y = rnd() * 128;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + (rnd() - 0.5) * 5, y - 2 - rnd() * 3); ctx.stroke();
  }
  ctx.globalAlpha = 1;
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = THREE.RepeatWrapping; t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(360, 360);
  t.anisotropy = 8;
  return t;
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
// rows (opcional): nº de andares de janelas — o pool de fachadas compartilhadas
// (world.js) assa torres com mais linhas p/ as janelas não esticarem.
export function facadeTexture(seed, rows) {
  const [cv, ctx] = canvas(128, 256);
  const rnd = rng(seed);
  const toneBase = 0.28 + rnd() * 0.34;
  const r = (toneBase * 255 * (0.9 + rnd() * 0.2)) | 0;
  ctx.fillStyle = `rgb(${r},${r + 6},${(r + 14)})`;
  ctx.fillRect(0, 0, 128, 256);
  // faixas de painel vertical (ritmo de fachada real)
  ctx.fillStyle = 'rgba(255,255,255,0.06)';
  for (let x = 0; x < 128; x += 32) if (rnd() < 0.6) ctx.fillRect(x, 0, 3, 236);
  const cols = 5 + (rnd() * 3 | 0);
  const nRows = rows || (10 + (rnd() * 4 | 0));
  const cw = 128 / cols, rh = 236 / nRows;
  const litRatio = 0.14 + rnd() * 0.22;                  // entardecer: varia por prédio
  for (let i = 0; i < cols; i++) {
    for (let j = 0; j < nRows; j++) {
      const lit = rnd() < litRatio;
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

// ── MONTANHA p/ anéis de horizonte: gradiente vertical + banda de rocha/neve.
// mode 'snow' (cordilheira fria), 'strata' (mesas do deserto) ou 'ridge'
// (morros de mata). v=1 é o TOPO do pico; o serrilhado da neve usa soma de
// senos p/ a textura TILEAR perfeito na emenda do anel.
export function mountainTexture(colorHex, seed, mode = 'snow') {
  const [cv, ctx] = canvas(512, 128);
  const rnd = rng(seed);
  const base = new THREE.Color(colorHex);
  const cTop = base.clone().lerp(new THREE.Color(0xe8f0f8), 0.28);
  const cBot = base.clone().multiplyScalar(0.55);
  const grad = ctx.createLinearGradient(0, 0, 0, 128);
  grad.addColorStop(0, '#' + cTop.getHexString());
  grad.addColorStop(0.45, '#' + base.getHexString());
  grad.addColorStop(1, '#' + cBot.getHexString());
  ctx.fillStyle = grad; ctx.fillRect(0, 0, 512, 128);
  if (mode === 'strata') {
    // estratos de arenito com ondulação senoidal (tileável)
    for (let b = 0; b < 9; b++) {
      const y0 = 18 + b * 12 + rnd() * 4;
      const dark = rnd() < 0.55;
      ctx.fillStyle = dark ? 'rgba(50,22,12,0.28)' : 'rgba(255,210,170,0.20)';
      ctx.beginPath(); ctx.moveTo(0, y0);
      for (let x = 0; x <= 512; x += 16) {
        ctx.lineTo(x, y0 + Math.sin(x * 0.02 + b * 1.7) * 3 + Math.sin(x * 0.049 + b) * 1.5);
      }
      for (let x = 512; x >= 0; x -= 16) {
        ctx.lineTo(x, y0 + 7 + Math.sin(x * 0.02 + b * 1.7) * 3 + Math.sin(x * 0.049 + b) * 1.5);
      }
      ctx.closePath(); ctx.fill();
    }
  } else {
    // veios de rocha/sombra nos vales
    for (let i = 0; i < 130; i++) {
      ctx.fillStyle = rnd() < 0.6 ? 'rgba(20,26,34,0.22)' : 'rgba(240,246,252,0.12)';
      const x = rnd() * 512, y = 20 + rnd() * 100;
      ctx.fillRect(x, y, 1.5 + rnd() * 2.5, 6 + rnd() * 18);
    }
    if (mode === 'snow') {
      // faixa de neve no topo com borda serrilhada (senos → emenda perfeita)
      ctx.fillStyle = 'rgba(244,248,252,0.95)';
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(512, 0);
      for (let x = 512; x >= 0; x -= 8) {
        ctx.lineTo(x, 26 + Math.sin(x * 0.031 + seed) * 8 + Math.sin(x * 0.083 + seed * 2) * 5);
      }
      ctx.closePath(); ctx.fill();
      // salpicos de neve descendo pelas cristas
      for (let i = 0; i < 260; i++) {
        ctx.fillStyle = `rgba(244,248,252,${0.25 + rnd() * 0.5})`;
        ctx.fillRect(rnd() * 512, 24 + rnd() * 26, 1.5 + rnd() * 2, 1.5 + rnd() * 3);
      }
    } else {
      // 'ridge': salpico de copas (mata vista de longe)
      for (let i = 0; i < 1600; i++) {
        ctx.fillStyle = rnd() < 0.5 ? 'rgba(16,40,22,0.35)' : 'rgba(90,140,90,0.25)';
        ctx.fillRect(rnd() * 512, 6 + rnd() * 116, 2 + rnd() * 3, 1.5 + rnd() * 2.5);
      }
    }
  }
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = THREE.RepeatWrapping;               // anel: u repete N× na volta
  return t;
}

// ── ARQUIBANCADA/torcida: fileiras de pontos coloridos (camisas) + rostos.
export function crowdTexture(seed = 88) {
  const [cv, ctx] = canvas(256, 96);
  const rnd = rng(seed);
  ctx.fillStyle = '#3a3f4a'; ctx.fillRect(0, 0, 256, 96);            // arquibancada
  const shirts = ['#d84a3c', '#e8d84a', '#4a7ad8', '#e8e8e0', '#4ad87a', '#d84ad8', '#ff8a3c'];
  for (let row = 0; row < 4; row++) {
    const y = 12 + row * 22;
    ctx.fillStyle = row % 2 ? '#2e333c' : '#343a44';
    ctx.fillRect(0, y + 8, 256, 14);                                  // degrau
    for (let x = 4; x < 252; x += 8) {
      if (rnd() < 0.12) continue;                                     // cadeira vazia
      const jx = x + (rnd() - 0.5) * 3;
      ctx.fillStyle = shirts[(rnd() * shirts.length) | 0];
      ctx.fillRect(jx, y + 4, 6, 9);                                  // camisa
      ctx.fillStyle = ['#e8c49a', '#c4936a', '#8a5f3f'][(rnd() * 3) | 0];
      ctx.fillRect(jx + 1, y, 4, 4);                                  // rosto
    }
  }
  // faixa de torcida
  ctx.fillStyle = '#ffd24a'; ctx.fillRect(30, 84, 196, 10);
  ctx.fillStyle = '#1a1a2e'; ctx.font = 'bold 10px monospace'; ctx.textAlign = 'center';
  ctx.fillText('VAI TAUAN!', 128, 92);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// ── XADREZ de largada (pórtico).
export function checkerTexture() {
  const [cv, ctx] = canvas(64, 64);
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
    ctx.fillStyle = (x + y) % 2 ? '#16161c' : '#f0f0e8';
    ctx.fillRect(x * 8, y * 8, 8, 8);
  }
  return tex(cv, 6, 1);
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

// ── ATLAS de SINALIZAÇÃO de corrida (WS-6): 8 tiles de 256×128 num canvas
// 1024×256 — UM upload de GPU p/ TODAS as placas geradas por dados (chevrons
// de curva, LOMBADA, VADO, tábuas de distância 300/200/100, placa de
// publicidade). signage.js (world) mapeia cada quad p/ o UV do seu tile.
//   tile: 0 chevron → | 1 chevron ← | 2 LOMBADA | 3 VADO
//         4 "300"     | 5 "200"     | 6 "100"   | 7 AD (listras)
export function roadSignAtlas() {
  const [cv, ctx] = canvas(1024, 256);
  const T = (i) => [(i % 4) * 256, ((i / 4) | 0) * 128];   // [x, y] do tile
  const board = (i, bg, border) => {
    const [x, y] = T(i);
    ctx.fillStyle = bg; ctx.fillRect(x, y, 256, 128);
    ctx.strokeStyle = border; ctx.lineWidth = 10;
    ctx.strokeRect(x + 7, y + 7, 242, 114);
  };
  // chevrons (estilo placa de seta amarela/preta): 3 setas grossas
  for (const [tile, flip] of [[0, false], [1, true]]) {
    board(tile, '#f2c414', '#1a1a1a');
    const [x, y] = T(tile);
    ctx.fillStyle = '#141414';
    for (let k = 0; k < 3; k++) {
      const cx = x + (flip ? 196 - k * 60 : 60 + k * 60);
      ctx.beginPath();
      ctx.moveTo(cx + (flip ? 22 : -22), y + 24);
      ctx.lineTo(cx + (flip ? -18 : 18), y + 64);   // ponta
      ctx.lineTo(cx + (flip ? 22 : -22), y + 104);
      ctx.lineTo(cx + (flip ? 44 : -44), y + 104);
      ctx.lineTo(cx + (flip ? 4 : -4), y + 64);     // ponta interna
      ctx.lineTo(cx + (flip ? 44 : -44), y + 24);
      ctx.closePath();
      ctx.fill();
    }
  }
  // avisos amarelos BR (LOMBADA / VADO)
  for (const [tile, text] of [[2, 'LOMBADA'], [3, 'VADO']]) {
    board(tile, '#f2c414', '#1a1a1a');
    const [x, y] = T(tile);
    ctx.fillStyle = '#141414'; ctx.font = 'bold 40px monospace';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(text, x + 128, y + 66, 220);
  }
  // tábuas de distância (fundo branco, algarismos pretos, barra vermelha)
  for (const [tile, text] of [[4, '300'], [5, '200'], [6, '100']]) {
    board(tile, '#f4f2ea', '#1a1a1a');
    const [x, y] = T(tile);
    ctx.fillStyle = '#c03028';
    ctx.fillRect(x + 24, y + 20, 208, 12);
    ctx.fillStyle = '#141414'; ctx.font = 'bold 64px monospace';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(text, x + 128, y + 74, 220);
  }
  // AD: listras diagonais + marca (variedade dos letreiros de beira de pista)
  {
    const [x, y] = T(7);
    ctx.fillStyle = '#1a4a8a'; ctx.fillRect(x, y, 256, 128);
    ctx.fillStyle = '#ffd24a';
    for (let s = -128; s < 256; s += 42) {
      ctx.beginPath();
      ctx.moveTo(x + s, y + 128); ctx.lineTo(x + s + 22, y + 128);
      ctx.lineTo(x + s + 86, y); ctx.lineTo(x + s + 64, y);
      ctx.closePath(); ctx.fill();
    }
    ctx.fillStyle = 'rgba(26,26,46,0.82)'; ctx.fillRect(x + 18, y + 40, 220, 48);
    ctx.fillStyle = '#ffd24a'; ctx.font = 'bold 30px monospace';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('TAUAN ENERGY', x + 128, y + 65, 210);
  }
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

// UV do tile i do atlas (flipY: linha 0 do canvas = topo = v alto).
export function signTileUV(i) {
  const c = i % 4, r = (i / 4) | 0;
  return { u0: c / 4, u1: (c + 1) / 4, v1: 1 - r / 2, v0: 1 - (r + 1) / 2 };
}

// ── SOL (WS-6): glow radial p/ Sprite aditivo — disco quente + halo suave.
export function sunGlowTexture() {
  const [cv, ctx] = canvas(256, 256);
  ctx.clearRect(0, 0, 256, 256);
  const g = ctx.createRadialGradient(128, 128, 4, 128, 128, 128);
  g.addColorStop(0, 'rgba(255,252,238,1)');
  g.addColorStop(0.12, 'rgba(255,246,205,0.95)');
  g.addColorStop(0.35, 'rgba(255,226,150,0.38)');
  g.addColorStop(1, 'rgba(255,220,140,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, 256, 256);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// ── Fantasma de LENS FLARE (WS-6): anel/disco bokeh suave p/ ghosts aditivos.
export function flareGhostTexture() {
  const [cv, ctx] = canvas(128, 128);
  ctx.clearRect(0, 0, 128, 128);
  const g = ctx.createRadialGradient(64, 64, 8, 64, 64, 62);
  g.addColorStop(0, 'rgba(255,255,255,0.0)');
  g.addColorStop(0.55, 'rgba(255,255,255,0.10)');
  g.addColorStop(0.8, 'rgba(255,255,255,0.5)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, 128, 128);
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
    const grad = ctx.createLinearGradient(0, 16, 0, 44);
    grad.addColorStop(0, '#d8dee4'); grad.addColorStop(0.5, '#8a949e'); grad.addColorStop(1, '#c8d0d8');
    ctx.fillStyle = grad; ctx.fillRect(0, 16, 128, 28);
    ctx.fillStyle = '#6a7480';
    for (let x = 0; x < 128; x += 32) ctx.fillRect(x + 12, 10, 8, 44);
  } else {
    // bug M2 (cerca invisível): réguas/mourões ENGROSSADOS — com alphaTest +
    // mipmap os traços finos antigos (réguas 9px, mourões 8px) sumiam a
    // distância e o colisor ficava "batendo no ar".
    ctx.fillStyle = '#8a6a44';
    for (let x = 0; x < 128; x += 32) ctx.fillRect(x + 9, 3, 14, 61);   // mourões
    for (const y of [13, 35]) {                                          // réguas
      ctx.fillStyle = `rgb(${150 + rnd() * 20},${112 + rnd() * 16},${70})`;
      ctx.fillRect(0, y, 128, 14);
    }
  }
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = THREE.RepeatWrapping;
  return t;
}
