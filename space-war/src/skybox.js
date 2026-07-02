// skybox.js — Fundo galáctico procedural pintado em canvas e mapeado numa esfera.
// Aqui mora o pedido de "cores muito bonitas": Via Láctea dramática, nebulosas com
// estrutura filamentar, galáxias (Andrômeda + galáxias distantes com redshift), nuvens
// de gás de grande escala, buracos negros, supernova e quasares.
// Tudo é pintado UMA vez numa textura equiretangular 4096×2048 — custo zero por frame.

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

// ---------------------------------------------------------------------------
// Helpers de cor e pincéis
// ---------------------------------------------------------------------------

// rgb como array [r,g,b] + alpha → string canvas.
function rgba(c, a) {
  return `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
}
// interpola duas cores.
function mix(a, b, t) {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

// Sopro de gás luminoso: gradiente radial macio que some nas bordas. Bloco básico
// de nebulosas e halos. Deve ser usado sob composição 'lighter' (emissão aditiva).
function puff(ctx, x, y, r, c, a) {
  if (r <= 0) return;
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, rgba(c, a));
  g.addColorStop(0.45, rgba(c, a * 0.5));
  g.addColorStop(1, rgba(c, 0));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

// Mancha ESCURA de absorção (poeira dentro da nebulosa). Pintada em 'source-over'
// para realmente subtrair luz do que já foi pintado embaixo.
function darkPuff(ctx, x, y, r, a) {
  if (r <= 0) return;
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, `rgba(3,2,9,${a})`);
  g.addColorStop(0.6, `rgba(3,2,9,${a * 0.65})`);
  g.addColorStop(1, 'rgba(3,2,9,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

// Sopro elíptico e inclinado (halos/núcleos de galáxia). Composição herdada do caller.
function ellipseBlob(ctx, x, y, rx, ry, rot, c, a) {
  if (rx <= 0) return;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.scale(1, ry / rx);
  puff(ctx, 0, 0, rx, c, a);
  ctx.restore();
}

// Ponto de estrela nítido (1–2px). fillRect é barato e não "incha" como um glow.
function dot(ctx, x, y, size, rgb, alpha) {
  ctx.globalAlpha = alpha;
  ctx.fillStyle = rgb;
  ctx.fillRect(x | 0, y | 0, size, size);
  ctx.globalAlpha = 1;
}

// Estrela com glow suave (gradiente radial). rgb como array; alpha explícito.
function star(ctx, x, y, r, c, alpha) {
  if (r <= 0) return;
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, rgba(c, alpha));
  g.addColorStop(0.4, rgba(c, alpha * 0.5));
  g.addColorStop(1, rgba(c, 0));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

// Cruz de difração curta (apenas para as pouquíssimas estrelas mais brilhantes).
function diffraction(ctx, x, y, len, c, alpha) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.strokeStyle = rgba(c, alpha);
  ctx.lineWidth = 1;
  for (const ang of [0, Math.PI / 2]) {
    const l = len;
    ctx.beginPath();
    ctx.moveTo(x - Math.cos(ang) * l, y - Math.sin(ang) * l);
    ctx.lineTo(x + Math.cos(ang) * l, y + Math.sin(ang) * l);
    ctx.stroke();
  }
  ctx.restore();
}

// Ponto ao longo de uma bezier cúbica (esqueleto dos filamentos de nebulosa).
function bezier(p0, p1, p2, p3, t) {
  const u = 1 - t;
  const a = u * u * u, b = 3 * u * u * t, c = 3 * u * t * t, d = t * t * t;
  return [
    a * p0[0] + b * p1[0] + c * p2[0] + d * p3[0],
    a * p0[1] + b * p1[1] + c * p2[1] + d * p3[1],
  ];
}

// ---------------------------------------------------------------------------
// NEBULOSA com estrutura: não é uma bolha radial única, e sim dezenas/centenas de
// sopros pequenos distribuídos ao longo de curvas bezier (filamentos), em 2–3 camadas
// de matiz, com núcleos SATURADOS (nunca estouram pra branco) e manchas de poeira.
// ---------------------------------------------------------------------------
function paintNebula(ctx, cx, cy, R, layers, rnd, opts = {}) {
  const rot = opts.rot !== undefined ? opts.rot : rnd() * Math.PI;

  // Emissão (aditiva) — as camadas coloridas.
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(rot);
  ctx.globalCompositeOperation = 'lighter';
  for (const layer of layers) {
    const filaments = layer.filaments || 4;
    const per = Math.max(1, Math.floor((layer.puffs || 100) / filaments));
    const spread = layer.spread !== undefined ? layer.spread : 0.22;
    const baseA = layer.alpha !== undefined ? layer.alpha : 0.045;
    for (let f = 0; f < filaments; f++) {
      // Filamento = bezier curva com pontos de controle espalhados na região.
      const p0 = [(rnd() - 0.5) * R * 1.1, (rnd() - 0.5) * R * 0.85];
      const p1 = [(rnd() - 0.5) * R * 1.5, (rnd() - 0.5) * R * 1.1];
      const p2 = [(rnd() - 0.5) * R * 1.5, (rnd() - 0.5) * R * 1.1];
      const p3 = [(rnd() - 0.5) * R * 1.1, (rnd() - 0.5) * R * 0.85];
      for (let i = 0; i < per; i++) {
        const t = i / per;
        const b = bezier(p0, p1, p2, p3, t);
        const px = b[0] + (rnd() - 0.5) * R * spread;
        const py = b[1] + (rnd() - 0.5) * R * spread;
        // Suaviza nas bordas: o gás afina longe do centro (núcleo saturado, halo tênue).
        const dist = Math.hypot(px, py) / R;
        const edge = Math.max(0, 1 - dist * dist * 0.75);
        const pr = R * (0.09 + rnd() * 0.20);
        const a = baseA * (0.45 + rnd() * 0.95) * edge;
        if (a > 0.004) puff(ctx, px, py, pr, layer.rgb, a);
      }
    }
  }
  // Acentos branco-quentes: poucos nós minúsculos e brilhantes perto do núcleo
  // (não uma lavagem branca no centro inteiro).
  const accents = opts.accents || 0;
  for (let i = 0; i < accents; i++) {
    const a = rnd() * Math.PI * 2;
    const d = rnd() * R * 0.32;
    puff(ctx, Math.cos(a) * d, Math.sin(a) * d, R * (0.025 + rnd() * 0.045),
      [255, 250, 242], 0.10 + rnd() * 0.12);
  }
  ctx.restore();

  // Poeira interna (absorção) — POR CIMA da emissão, subtraindo luz.
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(rot);
  const darks = opts.darks !== undefined ? opts.darks : 4;
  for (let i = 0; i < darks; i++) {
    const a = rnd() * Math.PI * 2;
    const d = rnd() * R * 0.55;
    darkPuff(ctx, Math.cos(a) * d, Math.sin(a) * d * 0.8,
      R * (0.10 + rnd() * 0.22), 0.22 + rnd() * 0.34);
  }
  ctx.restore();
}

// ---------------------------------------------------------------------------
// GALÁXIA ESPIRAL inclinada (tipo Andrômeda): elipse achatada (axis ratio ~0.35),
// núcleo pequeno e quente, braços sugeridos por aglomerados de estrelas pontilhados,
// faixa de poeira cruzando o disco, halo externo tênue.
// ---------------------------------------------------------------------------
function drawSpiralGalaxy(ctx, x, y, R, ratio, rot, rnd, coreRgb, armRgb) {
  const cos = Math.cos(rot), sin = Math.sin(rot);
  // projeta um ponto do plano do disco (px,py) para a tela, com inclinação + rotação.
  const proj = (px, py) => {
    const fy = py * ratio;
    return [x + px * cos - fy * sin, y + px * sin + fy * cos];
  };

  // Halo externo tênue (elipse macia).
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ellipseBlob(ctx, x, y, R * 1.15, R * 1.15 * ratio, rot, mix(coreRgb, [90, 100, 160], 0.5), 0.05);
  ellipseBlob(ctx, x, y, R * 0.8, R * 0.8 * ratio, rot, coreRgb, 0.05);

  // Braços espirais como aglomerados pontilhados (estrelas não resolvidas), com bastante
  // jitter para não parecer uma espiral geométrica "de régua".
  const arms = 2;
  for (let arm = 0; arm < arms; arm++) {
    const base = arm * Math.PI + (rnd() - 0.5) * 0.4;
    const n = 900;
    for (let i = 0; i < n; i++) {
      const t = Math.pow(i / n, 0.92);
      const ang = base + t * 5.4;
      const rad = t * R;
      const jit = (rnd() - 0.5) * R * 0.09 * (0.35 + t);
      const dx = Math.cos(ang) * rad + Math.cos(ang + 1.5) * jit + (rnd() - 0.5) * R * 0.03;
      const dy = Math.sin(ang) * rad + Math.sin(ang + 1.5) * jit + (rnd() - 0.5) * R * 0.03;
      const p = proj(dx, dy);
      const bright = (1 - t) * 0.45 + 0.14;
      const rgb = rnd() < 0.28 ? [255, 236, 205] : armRgb;
      if (rnd() < 0.10) {
        puff(ctx, p[0], p[1], 1.4 + rnd() * 3, rgb, bright * 0.4);
      } else {
        dot(ctx, p[0], p[1], 1, rgba(rgb, 1), bright * (0.4 + rnd() * 0.5));
      }
    }
  }
  ctx.restore();

  // Faixa de poeira cruzando o disco (arco elíptico escuro, subtrai luz).
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.scale(1, ratio);
  ctx.globalCompositeOperation = 'source-over';
  ctx.strokeStyle = 'rgba(3,2,9,0.55)';
  ctx.lineWidth = R * 0.05;
  ctx.beginPath();
  ctx.ellipse(0, R * 0.06, R * 0.9, R * 0.95, 0, Math.PI * 0.12, Math.PI * 0.9);
  ctx.stroke();
  ctx.lineWidth = R * 0.03;
  ctx.strokeStyle = 'rgba(3,2,9,0.4)';
  ctx.beginPath();
  ctx.ellipse(0, -R * 0.1, R * 0.7, R * 0.8, 0, Math.PI * 1.1, Math.PI * 1.85);
  ctx.stroke();
  ctx.restore();

  // Núcleo pequeno, quente e brilhante.
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ellipseBlob(ctx, x, y, R * 0.30, R * 0.30 * (ratio + 0.15), rot, [255, 226, 180], 0.35);
  ellipseBlob(ctx, x, y, R * 0.13, R * 0.13, rot, [255, 240, 210], 0.6);
  puff(ctx, x, y, R * 0.05, [255, 252, 240], 0.9);
  ctx.restore();
}

// Galáxia distante e AVERMELHADA (redshift): mancha elíptica minúscula, ruborizada e
// esmaecida. O operador pediu explicitamente galáxias com redshift no fundo.
function drawRedshiftGalaxy(ctx, x, y, R, rnd) {
  const rot = rnd() * Math.PI;
  const ratio = 0.30 + rnd() * 0.4;
  const z = 0.6 + rnd() * 0.4;                 // "força" do redshift
  const halo = [150 + 40 * (1 - z), 60 * (1 - z) + 30, 40 * (1 - z) + 20];
  const core = [230, 120 - 40 * z, 80 - 40 * z];
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ellipseBlob(ctx, x, y, R * 1.2, R * 1.2 * ratio, rot, halo, 0.08 + rnd() * 0.05);
  ellipseBlob(ctx, x, y, R * 0.7, R * 0.7 * ratio, rot, core, 0.12);
  // esfrega alguns sopros minúsculos para dar textura de "mancha".
  for (let i = 0; i < 5; i++) {
    const a = rnd() * Math.PI * 2, d = rnd() * R * 0.5;
    puff(ctx, x + Math.cos(a) * d, y + Math.sin(a) * d * ratio, R * (0.15 + rnd() * 0.2), core, 0.08);
  }
  puff(ctx, x, y, R * 0.18, [255, 170, 130], 0.22);   // núcleo tênue quente
  ctx.restore();
}

// Galáxia irregular satélite (Nuvens de Magalhães): scatter compacto de estrelas + brilho.
function drawIrregularGalaxy(ctx, x, y, R, rnd, tint) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  puff(ctx, x, y, R * 1.1, tint, 0.06);
  const n = (R * 6) | 0;
  for (let i = 0; i < n; i++) {
    const a = rnd() * Math.PI * 2;
    const d = Math.pow(rnd(), 0.6) * R;
    const px = x + Math.cos(a) * d * (0.9 + rnd() * 0.4);
    const py = y + Math.sin(a) * d * 0.7;
    dot(ctx, px, py, 1, rgba(rnd() < 0.3 ? [255, 240, 220] : tint, 1), 0.25 + rnd() * 0.4);
  }
  // duas–três knots brilhantes de formação estelar.
  for (let i = 0; i < 3; i++) {
    const a = rnd() * Math.PI * 2, d = rnd() * R * 0.7;
    puff(ctx, x + Math.cos(a) * d, y + Math.sin(a) * d * 0.7, R * 0.12, [255, 180, 200], 0.12);
  }
  ctx.restore();
}

// Faixa de poeira da Via Láctea: fita ESCURA ondulada com bordas nítidas e irregulares.
// Preenchimento sólido (sem gradiente) → borda crisp que bloqueia estrelas de verdade.
function dustLane(ctx, x0, x1, yBase, ampl, thick, alpha, rnd) {
  const steps = 46;
  const top = [], bot = [];
  const freq = 0.6 + rnd() * 1.6;
  const phase = rnd() * Math.PI * 2;
  const freq2 = 2.5 + rnd() * 3;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const x = x0 + (x1 - x0) * t;
    const wob = Math.sin(t * Math.PI * 2 * freq + phase) * ampl
      + Math.sin(t * Math.PI * 2 * freq2 + phase) * ampl * 0.35
      + (rnd() - 0.5) * ampl * 0.6;
    const cy = yBase + wob;
    // espessura varia e afina nas pontas → borda irregular e crível.
    const th = thick * (0.35 + Math.sin(t * Math.PI) * 0.9) * (0.6 + rnd() * 0.7);
    top.push([x, cy - th]);
    bot.push([x, cy + th]);
  }
  ctx.beginPath();
  ctx.moveTo(top[0][0], top[0][1]);
  for (let i = 1; i < top.length; i++) ctx.lineTo(top[i][0], top[i][1]);
  for (let i = bot.length - 1; i >= 0; i--) ctx.lineTo(bot[i][0], bot[i][1]);
  ctx.closePath();
  // MULTIPLY: a poeira só ESCURECE o que está por baixo — some sobre o espaço
  // escuro e bloqueia a faixa brilhante (sem virar fita preta atravessando o céu).
  const prevOp = ctx.globalCompositeOperation;
  ctx.globalCompositeOperation = 'multiply';
  ctx.fillStyle = `rgba(52,40,34,${Math.min(0.45, alpha * 0.6)})`;
  ctx.fill();
  ctx.globalCompositeOperation = prevOp;
}

// Buraco negro: sombra central + anel de acreção quente + lente/glow externo.
// Anel = elipse CONTÍNUA suave (gradientes sobrepostos), não pontilhismo de dots.
function drawBlackHole(ctx, x, y, r, rnd) {
  ctx.save();
  ctx.translate(x, y);
  ctx.globalCompositeOperation = 'lighter';
  star(ctx, 0, 0, r * 2.2, [120, 90, 255], 0.05);          // lente / glow externo
  for (let i = 0; i < 140; i++) {                          // anel de acreção elíptico contínuo
    const a = rnd() * Math.PI * 2;
    const rr = r * (1.30 + rnd() * 0.30);
    const px = Math.cos(a) * rr * 1.7;
    const py = Math.sin(a) * rr * 0.5;
    const hot = rnd();
    const c = hot > 0.6 ? [255, 240, 200] : hot > 0.3 ? [255, 160, 60] : [255, 90, 40];
    // blobs macios sobrepostos → faixa contínua com brilho variável
    puff(ctx, px, py, r * (0.14 + rnd() * 0.18), c, 0.10 + rnd() * 0.10);
  }
  ctx.globalCompositeOperation = 'source-over';           // horizonte de eventos por cima
  const sh = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
  sh.addColorStop(0, 'rgba(0,0,0,1)');
  sh.addColorStop(0.7, 'rgba(0,0,0,1)');
  sh.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = sh;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function paintSky() {
  const W = 4096, H = 2048;
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');
  const rnd = mulberry32(7777);

  // -------------------------------------------------------------------------
  // 1. Fundo: preto-azulado muito profundo com leve gradiente vertical.
  // -------------------------------------------------------------------------
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#03020a');
  bg.addColorStop(0.5, '#050311');
  bg.addColorStop(1, '#02020b');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // -------------------------------------------------------------------------
  // 2. NUVENS DE GÁS de grande escala — lavagens de cor MUITO tênues (alpha 0.02–0.05)
  //    para o espaço "preto" ter variação de profundidade em vez de preto chapado.
  //    Wrap horizontal para não deixar costura no meridiano 0/W.
  // -------------------------------------------------------------------------
  const washTints = [[26, 46, 88], [18, 66, 68], [70, 24, 42], [44, 30, 78], [60, 50, 30]];
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 9; i++) {
    const x = rnd() * W, y = rnd() * H;
    const r = W * (0.16 + rnd() * 0.22);
    const c = washTints[(rnd() * washTints.length) | 0];
    const a = 0.02 + rnd() * 0.03;
    puff(ctx, x, y, r, c, a);
    if (x - r < 0) puff(ctx, x + W, y, r, c, a);
    if (x + r > W) puff(ctx, x - W, y, r, c, a);
  }
  ctx.restore();

  // -------------------------------------------------------------------------
  // 3. CAMPO DE ESTRELAS profundo (~18k) — classes espectrais (cor = temperatura).
  //    Maioria são pontos nítidos de 1px. É assim que o espaço é.
  // -------------------------------------------------------------------------
  const dotColors = ['#aac8ff', '#cfe0ff', '#eef2ff', '#fffaeb', '#ffe1aa', '#ffb496'];
  for (let i = 0; i < 18000; i++) {
    const x = rnd() * W, y = rnd() * H;
    const ci = (Math.pow(rnd(), 1.5) * dotColors.length) | 0;
    const mag = Math.pow(rnd(), 5);
    dot(ctx, x, y, mag > 0.75 ? 2 : 1, dotColors[ci], 0.3 + mag * 0.6);
  }

  // -------------------------------------------------------------------------
  // 4. VIA LÁCTEA — banda larga diagonal, densa e dramática: halo quente difuso,
  //    froth azul-branco de estrelas, bojo central dourado, VÁRIAS faixas de poeira
  //    escuras com bordas nítidas (pintadas DEPOIS das estrelas para bloquear luz).
  // -------------------------------------------------------------------------
  ctx.save();
  ctx.translate(W * 0.5, H * 0.52);
  ctx.rotate(-0.32);
  const bandH = H * 0.36;

  // Halo quente difuso ao redor da banda.
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const halo = ctx.createLinearGradient(0, -bandH * 0.75, 0, bandH * 0.75);
  halo.addColorStop(0, 'rgba(60,50,80,0)');
  halo.addColorStop(0.5, 'rgba(120,100,120,0.08)');
  halo.addColorStop(1, 'rgba(60,50,80,0)');
  ctx.fillStyle = halo;
  ctx.fillRect(-W, -bandH * 0.75, W * 2, bandH * 1.5);
  ctx.restore();

  // Froth de estrelas — concentração gaussiana no centro da banda. Azul-branco fora,
  // dourado perto do núcleo.
  const frothCold = ['#cfe0ff', '#dfeaff', '#ffffff', '#b9d0ff'];
  const frothWarm = ['#fff0cc', '#ffe6b0', '#ffdca0'];
  for (let i = 0; i < 24000; i++) {
    const x = (rnd() - 0.5) * W * 1.7;
    const gy = (rnd() - 0.5) + (rnd() - 0.5);     // triangular → concentra no centro
    const y = gy * bandH * 0.5;
    const fade = 1 - Math.abs(y) / (bandH * 0.5);
    const nearCore = Math.abs(x) < W * 0.28 && fade > 0.45;
    const warm = nearCore && rnd() < 0.55;
    const pal = warm ? frothWarm : frothCold;
    const c = pal[(rnd() * pal.length) | 0];
    dot(ctx, x, y, 1, c, (0.18 + 0.5 * fade) * (0.5 + rnd() * 0.5));
  }

  // Nebulosidade colorida embutida na banda (aditiva).
  paintNebula(ctx, -W * 0.30, bandH * 0.05, bandH * 0.7,
    [{ rgb: [200, 70, 150], puffs: 70, alpha: 0.04 },
     { rgb: [80, 120, 220], puffs: 60, alpha: 0.035 }], rnd, { darks: 3 });
  paintNebula(ctx, W * 0.20, -bandH * 0.05, bandH * 0.8,
    [{ rgb: [70, 190, 190], puffs: 70, alpha: 0.038 },
     { rgb: [180, 90, 200], puffs: 55, alpha: 0.03 }], rnd, { darks: 3 });

  // Bojo central dourado brilhante (várias camadas aditivas).
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const bulge = ctx.createRadialGradient(0, 0, 0, 0, 0, bandH * 0.95);
  bulge.addColorStop(0, 'rgba(255,228,165,0.34)');
  bulge.addColorStop(0.35, 'rgba(255,200,130,0.15)');
  bulge.addColorStop(1, 'rgba(255,190,120,0)');
  ctx.fillStyle = bulge;
  ctx.beginPath();
  ctx.ellipse(0, 0, bandH * 0.95, bandH * 0.5, 0, 0, Math.PI * 2);
  ctx.fill();
  puff(ctx, 0, 0, bandH * 0.22, [255, 245, 215], 0.35);   // núcleo quente compacto
  ctx.restore();

  // Faixas de poeira ESCURAS — depois das estrelas, com bordas nítidas e irregulares.
  ctx.globalCompositeOperation = 'source-over';
  const laneYs = [-0.16, -0.05, 0.02, 0.10, 0.20];
  for (const ly of laneYs) {
    dustLane(ctx, -W * 0.95, W * 0.95, ly * bandH, bandH * 0.05,
      bandH * (0.03 + rnd() * 0.03), 0.5 + rnd() * 0.25, rnd);
  }
  // duas faixas curtas de poeira ramificada perto do bojo.
  for (let i = 0; i < 2; i++) {
    dustLane(ctx, -W * 0.25, W * 0.35, (rnd() - 0.5) * bandH * 0.25,
      bandH * 0.06, bandH * 0.025, 0.55, rnd);
  }
  ctx.restore();

  // -------------------------------------------------------------------------
  // 5. NEBULOSAS famosas (6) — estruturadas, saturadas, com poeira interna.
  //    Uma dominante (Órion), as outras menores. Nunca com centro lavado de branco.
  // -------------------------------------------------------------------------
  // Órion — DOMINANTE: magenta profundo + ciano elétrico + acentos branco-quentes.
  paintNebula(ctx, W * 0.15, H * 0.32, 320,
    [{ rgb: [190, 40, 130], puffs: 150, alpha: 0.05, filaments: 6, spread: 0.28 },
     { rgb: [40, 150, 220], puffs: 120, alpha: 0.045, filaments: 5, spread: 0.24 },
     { rgb: [120, 60, 200], puffs: 90, alpha: 0.035, filaments: 4, spread: 0.3 }],
    rnd, { accents: 7, darks: 6, rot: -0.4 });

  // Carina — laranja/vermelho queimado, densa.
  paintNebula(ctx, W * 0.76, H * 0.64, 250,
    [{ rgb: [230, 90, 30], puffs: 120, alpha: 0.05, filaments: 5, spread: 0.26 },
     { rgb: [200, 40, 40], puffs: 90, alpha: 0.045, filaments: 4, spread: 0.28 },
     { rgb: [255, 180, 90], puffs: 60, alpha: 0.03, filaments: 3, spread: 0.2 }],
    rnd, { accents: 4, darks: 6, rot: 0.5 });

  // Águia / Eagle — teal-verde + dourado (os "Pilares").
  paintNebula(ctx, W * 0.42, H * 0.80, 200,
    [{ rgb: [40, 200, 150], puffs: 100, alpha: 0.045, filaments: 5, spread: 0.24 },
     { rgb: [210, 190, 80], puffs: 70, alpha: 0.035, filaments: 3, spread: 0.22 }],
    rnd, { accents: 3, darks: 7, rot: 0.2 });

  // Laguna — rosa H-alfa difuso com toque violeta.
  paintNebula(ctx, W * 0.05, H * 0.72, 175,
    [{ rgb: [230, 70, 140], puffs: 90, alpha: 0.045, filaments: 4, spread: 0.26 },
     { rgb: [110, 70, 210], puffs: 60, alpha: 0.03, filaments: 3, spread: 0.24 }],
    rnd, { accents: 3, darks: 4, rot: -0.2 });

  // Trífida — azul reflexão + magenta emissão, pequena.
  paintNebula(ctx, W * 0.60, H * 0.14, 150,
    [{ rgb: [60, 110, 230], puffs: 70, alpha: 0.04, filaments: 4, spread: 0.24 },
     { rgb: [210, 60, 150], puffs: 55, alpha: 0.038, filaments: 3, spread: 0.22 }],
    rnd, { accents: 2, darks: 4, rot: 0.8 });

  // Hélix — anel ciano/magenta ("olho de deus"), estrutura anular explícita.
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const hx = W * 0.90, hy = H * 0.24, hr = 95;
  for (let i = 0; i < 90; i++) {
    const a = rnd() * Math.PI * 2;
    const rr = hr * (0.85 + rnd() * 0.3);
    puff(ctx, hx + Math.cos(a) * rr, hy + Math.sin(a) * rr * 0.9, 22 + rnd() * 16,
      rnd() < 0.5 ? [50, 210, 225] : [215, 70, 175], 0.06 + rnd() * 0.04);
  }
  puff(ctx, hx, hy, 46, [120, 250, 225], 0.07);
  puff(ctx, hx, hy, 12, [255, 255, 255], 0.3);            // estrela central
  ctx.restore();

  // -------------------------------------------------------------------------
  // 6. GALÁXIAS — Andrômeda inclinada + Triângulo, e nuvens de Magalhães satélite.
  // -------------------------------------------------------------------------
  drawSpiralGalaxy(ctx, W * 0.30, H * 0.15, 250, 0.34, -0.5, rnd, [220, 210, 255], [130, 160, 255]);
  drawSpiralGalaxy(ctx, W * 0.415, H * 0.085, 95, 0.5, 0.4, rnd, [210, 220, 255], [110, 200, 200]);
  drawIrregularGalaxy(ctx, W * 0.60, H * 0.90, 90, rnd, [190, 200, 255]);
  drawIrregularGalaxy(ctx, W * 0.685, H * 0.945, 55, rnd, [200, 210, 255]);

  // -------------------------------------------------------------------------
  // 7. GALÁXIAS DE FUNDO distantes — manchinhas elípticas; e GALÁXIAS COM REDSHIFT
  //    (avermelhadas/esmaecidas), como o operador pediu explicitamente.
  // -------------------------------------------------------------------------
  for (let i = 0; i < 80; i++) {
    const x = rnd() * W, y = rnd() * H;
    const r = 3 + rnd() * 9;
    const red = rnd() < 0.45;
    const tint = red ? [200, 110, 85] : [200, 190, 160];
    const rot = rnd() * Math.PI;
    ellipseBlob(ctx, x, y, r, r * (0.35 + rnd() * 0.3), rot, tint, 0.14 + rnd() * 0.08);
  }
  // 3 galáxias com redshift forte, um pouco maiores e nitidamente vermelhas.
  drawRedshiftGalaxy(ctx, W * 0.22, H * 0.62, 16, rnd);
  drawRedshiftGalaxy(ctx, W * 0.83, H * 0.30, 13, rnd);
  drawRedshiftGalaxy(ctx, W * 0.52, H * 0.86, 15, rnd);

  // QUASARES — sutis: ponto vermelho pequeno e fraco com halo minúsculo.
  for (let i = 0; i < 24; i++) {
    const x = rnd() * W, y = rnd() * H;
    star(ctx, x, y, 3 + rnd() * 3, [170, 50, 45], 0.07);   // halo redshift minúsculo
    star(ctx, x, y, 1 + rnd() * 1.2, [255, 110, 90], 0.5); // núcleo pontual
  }

  // -------------------------------------------------------------------------
  // 8. Foreground: aglomerados abertos + poucas estrelas brilhantes (glow reduzido)
  //    + cruzes de difração raríssimas e curtas.
  // -------------------------------------------------------------------------
  const clusterCols = ['#cfe0ff', '#eef2ff', '#ffffff', '#ffe6b8'];
  for (let k = 0; k < 8; k++) {
    const cx = rnd() * W, cy = rnd() * H;
    const spread = 26 + rnd() * 40;
    const count = 40 + (rnd() * 60 | 0);
    for (let i = 0; i < count; i++) {
      const a = rnd() * Math.PI * 2;
      const d = Math.pow(rnd(), 0.5) * spread;
      const c = clusterCols[(rnd() * clusterCols.length) | 0];
      dot(ctx, cx + Math.cos(a) * d, cy + Math.sin(a) * d, rnd() < 0.15 ? 2 : 1, c, 0.4 + rnd() * 0.5);
    }
    puff(ctx, cx, cy, spread * 0.6, [200, 215, 255], 0.03);   // brilho leve do aglomerado
  }
  const brightCols = [[170, 200, 255], [220, 230, 255], [255, 250, 235], [255, 225, 170]];
  for (let i = 0; i < 170; i++) {
    const x = rnd() * W, y = rnd() * H;
    const c = brightCols[(rnd() * brightCols.length) | 0];
    const mag = 0.6 + rnd() * 0.4;
    star(ctx, x, y, 1.4 + mag * 1.8, c, 0.6);              // glow menor que antes
    if (mag > 0.94) diffraction(ctx, x, y, 6 + mag * 8, c, 0.22);   // cruz curta e rara
  }

  // -------------------------------------------------------------------------
  // 9. SUPERNOVA — ponto compacto e brilhante com casca fina em expansão.
  // -------------------------------------------------------------------------
  const sx = W * 0.55, sy = H * 0.40;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  star(ctx, sx, sy, 16, [200, 225, 255], 0.16);           // glow apertado
  star(ctx, sx, sy, 6, [255, 250, 235], 0.6);
  puff(ctx, sx, sy, 3, [255, 255, 255], 0.95);            // núcleo
  ctx.strokeStyle = 'rgba(150,200,255,0.28)';             // casca fina
  ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.arc(sx, sy, 42, 0, Math.PI * 2); ctx.stroke();
  ctx.strokeStyle = 'rgba(255,180,150,0.14)';
  ctx.beginPath(); ctx.arc(sx, sy, 60, 0, Math.PI * 2); ctx.stroke();
  diffraction(ctx, sx, sy, 26, [255, 255, 255], 0.5);
  ctx.restore();

  // -------------------------------------------------------------------------
  // 10. BURACOS NEGROS — disco escuro + anel de acreção + lente gravitacional.
  // -------------------------------------------------------------------------
  drawBlackHole(ctx, W * 0.85, H * 0.46, 34, rnd);
  drawBlackHole(ctx, W * 0.10, H * 0.50, 22, rnd);

  return canvas;
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
