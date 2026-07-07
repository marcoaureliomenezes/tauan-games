// environment/textures.js — Texturas procedurais (CanvasTexture) compartilhadas
// pelos mapas (T-AR-04, anti-Lego). Sem assets externos: fachadas com janelas,
// telhados, detalhe de solo, nuvem billboard e chapa industrial corrugada.
// Todas geradas UMA vez e cacheadas — custo zero por frame.

import * as THREE from '../../../vendor/three.module.min.js';

const _cache = new Map();
function cached(key, make) {
  if (!_cache.has(key)) _cache.set(key, make());
  return _cache.get(key);
}

function canvas(w, h) {
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  return cv;
}

// xorshift local (determinístico — texturas idênticas a cada boot/teste)
function rng(seed) {
  let x = seed | 0 || 1234567;
  return () => {
    x ^= x << 13; x ^= x >>> 17; x ^= x << 5;
    return ((x >>> 0) % 100000) / 100000;
  };
}

/** FACHADA de prédio com JANELAS (grade lit/unlit) + faixa de TELHADO.
 *  Layout: [0..1]×[0..0.72] = fachada com janelas; [0..1]×[0.72..1] = telhado
 *  (laje de concreto com caixas d'água/casa de máquinas). Os UVs do box da
 *  cidade são remapeados p/ estas regiões (ver facadeBoxGeometry). */
export function facadeTexture() {
  return cached('facade', () => {
    const cv = canvas(512, 512);
    const c = cv.getContext('2d');
    const r = rng(97531);
    const ROOF_Y = Math.floor(512 * (1 - 0.28));           // topo do telhado no eixo Y do canvas
    // fachada: reboco neutro (a cor real vem do instanceColor)
    c.fillStyle = '#cfcac2'; c.fillRect(0, 0, 512, 512);
    // variação sutil de reboco
    for (let i = 0; i < 260; i++) {
      c.fillStyle = `rgba(${120 + r() * 60 | 0},${115 + r() * 55 | 0},${105 + r() * 50 | 0},0.08)`;
      c.fillRect(r() * 512, r() * ROOF_Y, 24 + r() * 60, 10 + r() * 30);
    }
    // grade de janelas — colunas x linhas, algumas acesas
    const COLS = 9, ROWS = 11;
    const cw = 512 / COLS, ch = ROOF_Y / ROWS;
    for (let ix = 0; ix < COLS; ix++) {
      for (let iy = 0; iy < ROWS; iy++) {
        const wx = ix * cw + cw * 0.22, wy = iy * ch + ch * 0.2;
        const ww = cw * 0.56, wh = ch * 0.58;
        const lit = r() < 0.16;
        c.fillStyle = lit
          ? `rgb(${230 + r() * 25 | 0},${200 + r() * 30 | 0},${120 + r() * 40 | 0})`
          : `rgb(${38 + r() * 30 | 0},${48 + r() * 34 | 0},${60 + r() * 36 | 0})`;
        c.fillRect(wx, wy, ww, wh);
        // moldura/peitoril
        c.fillStyle = 'rgba(0,0,0,0.22)';
        c.fillRect(wx, wy + wh - 2, ww, 2);
      }
    }
    // telhado: laje de concreto + unidades no topo
    c.fillStyle = '#8f8a80'; c.fillRect(0, ROOF_Y, 512, 512 - ROOF_Y);
    for (let i = 0; i < 60; i++) {
      c.fillStyle = `rgba(60,58,54,${0.10 + r() * 0.12})`;
      c.fillRect(r() * 512, ROOF_Y + r() * (512 - ROOF_Y), 14 + r() * 40, 8 + r() * 22);
    }
    for (let i = 0; i < 7; i++) {                          // caixas d'água / casas de máquina
      const bx = 40 + r() * 420, by = ROOF_Y + 20 + r() * 80;
      c.fillStyle = i % 2 ? '#6f7d8a' : '#a8a49a';
      c.fillRect(bx, by, 26 + r() * 30, 18 + r() * 20);
    }
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    return tex;
  });
}

/** BoxGeometry 1×1×1 com UVs remapeados p/ a facadeTexture: laterais → região
 *  de janelas, topo/base → região de telhado. Compartilhada por todas as
 *  cidades instanciadas. */
export function facadeBoxGeometry() {
  return cached('facadeBox', () => {
    const geo = new THREE.BoxGeometry(1, 1, 1);
    const uv = geo.attributes.uv;
    // ordem das faces no BoxGeometry: +x,-x,+y(top),-y(bottom),+z,-z — 4 verts cada
    const FACADE_TOP = 0.72;                    // v em [0..0.72] = janelas
    for (let f = 0; f < 6; f++) {
      const top = f === 2 || f === 3;
      for (let vi = 0; vi < 4; vi++) {
        const i = f * 4 + vi;
        const u = uv.getX(i), v = uv.getY(i);
        if (top) uv.setXY(i, u, 0.74 + v * 0.25);          // telhado
        else uv.setXY(i, u, v * FACADE_TOP);               // fachada
      }
    }
    uv.needsUpdate = true;
    return geo;
  });
}

/** Detalhe de SOLO tileável (speckle grama/terra) — multiplica os vertex colors
 *  do terreno p/ matar o look de bandas chapadas. Período divide o chunk. */
export function groundDetailTexture() {
  return cached('ground', () => {
    const cv = canvas(256, 256);
    const c = cv.getContext('2d');
    const r = rng(24680);
    c.fillStyle = '#c4c4c4'; c.fillRect(0, 0, 256, 256);   // ~0.77 neutro (multiplica)
    for (let i = 0; i < 2600; i++) {
      const g = 150 + r() * 105;
      c.fillStyle = `rgba(${g * (0.86 + r() * 0.2) | 0},${g | 0},${g * (0.72 + r() * 0.2) | 0},${0.22 + r() * 0.3})`;
      const s = 1 + r() * 3.2;
      c.fillRect(r() * 256, r() * 256, s, s);
    }
    // manchas maiores (variação de umidade/solo)
    for (let i = 0; i < 42; i++) {
      c.fillStyle = `rgba(${100 + r() * 70 | 0},${110 + r() * 60 | 0},${80 + r() * 50 | 0},0.07)`;
      c.beginPath();
      c.ellipse(r() * 256, r() * 256, 16 + r() * 44, 12 + r() * 36, r() * 3.14, 0, 6.29);
      c.fill();
    }
    const tex = new THREE.CanvasTexture(cv);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    return tex;
  });
}

/** Nuvem BILLBOARD fofa (alpha radial multi-lóbulo). 3 variações. */
export function cloudTexture(variant = 0) {
  return cached('cloud' + variant, () => {
    const cv = canvas(256, 128);
    const c = cv.getContext('2d');
    const r = rng(1357 + variant * 771);
    c.clearRect(0, 0, 256, 128);
    const lobes = 7 + Math.floor(r() * 5);
    for (let i = 0; i < lobes; i++) {
      const cx = 40 + r() * 176, cy = 52 + r() * 34;
      const rad = 22 + r() * 34;
      const g = c.createRadialGradient(cx, cy, 1, cx, cy, rad);
      g.addColorStop(0, 'rgba(255,255,255,0.85)');
      g.addColorStop(0.55, 'rgba(245,246,250,0.42)');
      g.addColorStop(1, 'rgba(240,242,248,0)');
      c.fillStyle = g;
      c.fillRect(cx - rad, cy - rad, rad * 2, rad * 2);
    }
    // base levemente sombreada (peso visual embaixo)
    const gb = c.createLinearGradient(0, 60, 0, 128);
    gb.addColorStop(0, 'rgba(0,0,0,0)');
    gb.addColorStop(1, 'rgba(150,158,172,0.18)');
    c.globalCompositeOperation = 'source-atop';
    c.fillStyle = gb; c.fillRect(0, 0, 256, 128);
    c.globalCompositeOperation = 'source-over';
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  });
}

/** TAPETE URBANO: malha de ruas + quadras vista de cima — o chão da cidade.
 *  De ar, uma cidade lê pela malha viária; os prédios instanciados assentam
 *  por cima. Alpha suave na borda (funde com o campo ao redor). */
export function cityCarpetTexture() {
  return cached('cityCarpet', () => {
    const cv = canvas(1024, 1024);
    const c = cv.getContext('2d');
    const r = rng(55221);
    // quadras: tons de lote/telhado/terra
    const LOT = ['#8f8574', '#9a8a6e', '#7f7a6c', '#93876f', '#877e64'];
    c.fillStyle = '#8a8272'; c.fillRect(0, 0, 1024, 1024);
    const step = 64;                                       // ~35 m por quadra
    for (let x = 0; x < 1024; x += step) {
      for (let y = 0; y < 1024; y += step) {
        c.fillStyle = LOT[Math.floor(r() * LOT.length)];
        c.fillRect(x, y, step, step);
        // lotes internos
        for (let i = 0; i < 5; i++) {
          c.fillStyle = `rgba(${90 + r() * 80 | 0},${80 + r() * 66 | 0},${60 + r() * 52 | 0},0.5)`;
          c.fillRect(x + r() * (step - 18), y + r() * (step - 14), 8 + r() * 16, 6 + r() * 12);
        }
      }
    }
    // malha viária (asfalto): ruas a cada quadra + 2 avenidas largas
    c.strokeStyle = '#3c3c40';
    for (let x = 0; x <= 1024; x += step) {
      c.lineWidth = (x % (step * 4) === 0) ? 12 : 6;
      c.beginPath(); c.moveTo(x, 0); c.lineTo(x, 1024); c.stroke();
      c.beginPath(); c.moveTo(0, x); c.lineTo(1024, x); c.stroke();
    }
    // borda com alpha (funde no campo)
    const g2 = c.createRadialGradient(512, 512, 380, 512, 512, 512);
    g2.addColorStop(0, 'rgba(0,0,0,0)');
    g2.addColorStop(1, 'rgba(0,0,0,1)');
    c.globalCompositeOperation = 'destination-out';
    c.fillStyle = g2; c.fillRect(0, 0, 1024, 1024);
    c.globalCompositeOperation = 'source-over';
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    return tex;
  });
}

/** CASA baixa: paredes rebocadas com janelas/porta + TELHADO de telha cerâmica
 *  na região do topo (mesmo layout de UV da facadeBoxGeometry). */
export function houseTexture() {
  return cached('house', () => {
    const cv = canvas(256, 256);
    const c = cv.getContext('2d');
    const r = rng(31415);
    const ROOF_Y = Math.floor(256 * (1 - 0.28));
    c.fillStyle = '#ded6c6'; c.fillRect(0, 0, 256, 256);   // reboco
    // janelas/porta (1-2 pavimentos)
    for (let ix = 0; ix < 4; ix++) {
      for (let iy = 0; iy < 3; iy++) {
        if (r() < 0.25) continue;
        c.fillStyle = `rgb(${40 + r() * 26 | 0},${52 + r() * 26 | 0},${64 + r() * 30 | 0})`;
        c.fillRect(18 + ix * 60, 22 + iy * 56, 30, 34);
      }
    }
    c.fillStyle = '#6a4a34'; c.fillRect(112, ROOF_Y - 50, 32, 50);   // porta
    // telhado: telhas cerâmica (linhas)
    c.fillStyle = '#a4552f'; c.fillRect(0, ROOF_Y, 256, 256 - ROOF_Y);
    for (let y = ROOF_Y; y < 256; y += 7) {
      c.fillStyle = 'rgba(0,0,0,0.18)'; c.fillRect(0, y, 256, 2);
      c.fillStyle = 'rgba(255,255,255,0.10)'; c.fillRect(0, y + 2, 256, 1);
    }
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    return tex;
  });
}

/** SUB-BOSQUE: mancha orgânica verde-escura com alpha radial — assenta sob os
 *  clusters de árvores p/ o bosque ler como floresta FECHADA vista do ar. */
export function forestFloorTexture() {
  return cached('forestFloor', () => {
    const cv = canvas(256, 256);
    const c = cv.getContext('2d');
    const r = rng(66442);
    c.clearRect(0, 0, 256, 256);
    for (let i = 0; i < 26; i++) {                          // lóbulos orgânicos
      const cx = 70 + r() * 116, cy = 70 + r() * 116;
      const rad = 36 + r() * 52;
      const g = c.createRadialGradient(cx, cy, 2, cx, cy, rad);
      const tone = 30 + r() * 22;
      g.addColorStop(0, `rgba(${tone * 0.55 | 0},${tone + 34 | 0},${tone * 0.5 | 0},0.85)`);
      g.addColorStop(1, 'rgba(20,44,18,0)');
      c.fillStyle = g;
      c.fillRect(cx - rad, cy - rad, rad * 2, rad * 2);
    }
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  });
}

/** Chapa industrial corrugada (galpões de fábrica). */
export function corrugatedTexture() {
  return cached('corrugated', () => {
    const cv = canvas(256, 256);
    const c = cv.getContext('2d');
    const r = rng(8642);
    c.fillStyle = '#9a938a'; c.fillRect(0, 0, 256, 256);
    for (let x = 0; x < 256; x += 8) {                     // nervuras verticais
      c.fillStyle = 'rgba(255,255,255,0.14)'; c.fillRect(x, 0, 3, 256);
      c.fillStyle = 'rgba(0,0,0,0.16)'; c.fillRect(x + 5, 0, 2, 256);
    }
    for (let i = 0; i < 30; i++) {                         // ferrugem/sujeira
      c.fillStyle = `rgba(${120 + r() * 60 | 0},${70 + r() * 40 | 0},${40 + r() * 30 | 0},${0.05 + r() * 0.12})`;
      c.fillRect(r() * 256, r() * 256, 10 + r() * 50, 6 + r() * 60);
    }
    const tex = new THREE.CanvasTexture(cv);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  });
}
