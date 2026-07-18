// maps/inhauma-backdrop.js — Anel de montanhas de fundo (backdrop) do mapa Inhaúma.
// Exporta: createInhaumaBackdrop, updateInhaumaBackdrop.
// Para ajustar raios/alturas/tintas dos anéis, edite BACKDROP_RINGS abaixo.
//
// T-V-09 (aero-fighters-inhauma-visual-uplift-v1): a janela de terreno streamed
// acaba ~2,1 km à frente e NÃO havia montanhas distantes — a 700 m de altitude o
// horizonte era céu vazio em toda direção (shot 03 da auditoria). Aqui: 3 anéis
// concêntricos de cristas low-poly (ridged-FBM) a 3,5-5,8 km, recentrados no XZ do
// jogador a cada frame (mesmo padrão do sky group em sky.js) — inalcançáveis,
// puramente visuais: sem colisão, fora do heightAt. Material Basic com fog:false e
// cor atualizada por frame a partir da cor EFETIVA do horizonte (scene.fog.color —
// que main.js já sincroniza a cada frame com getSkyColor() via lerp dia/noite:
// dia = cor base do mapa, dusk/noite = horizonte real do dome Preetham). Cada anel
// é uma versão dessaturada/escurecida dessa cor (perspectiva atmosférica em
// camadas), então os anéis APAGAM à noite junto com o céu (nunca brilham).
// NOTA: usar scene.fog.color em vez de getSkyColor() cru é deliberado — o espelho
// Preetham devolve valores LINEARES >1 em pleno dia (anel ficaria branco/invisível
// contra o céu), enquanto a cor que o jogador de fato vê no horizonte é a do fog.
//
// Budget (D-5 da release): 3 anéis × 180 segmentos × 5 bandas × 2 tris = 5400 tris
// (≤15k) e 3 draw calls (≤4).

import * as THREE from '../../../../../vendor/three.module.min.js';
import { ridgedFbm2D } from './noise.js';

// sky.js toca `window` no escopo de módulo — carga LAZY (mesmo padrão de
// inhauma-scene.js) para este arquivo continuar importável em Node
// (validate:aero-map / test:aero:unit / test:aero:sim). Sem o céu carregado, os
// anéis simplesmente mantêm a cor neutra de criação.
let _getSkyColor = null;
if (typeof window !== 'undefined') {
  import('../sky.js').then((m) => { _getSkyColor = m.getSkyColor; }).catch(() => {});
}

// Anéis do mais perto para o mais longe. `radius` é o raio da faixa central;
// o anel se estende ±width/2. O ponto mais distante (5300+500=5800 m) fica dentro
// do camera.far=6000. `tint` = fator de luminância contra a cor do horizonte do
// céu (anel próximo mais escuro/contrastado, distante quase fundido com o céu).
// `snowLine` > 0 clareia os picos (neve) via vertex color — só no anel mais alto.
const BACKDROP_RINGS = [
  { radius: 3500, width: 700,  peak: 620,  tint: 0.80, snowLine: 0,    offX: 211000, offZ: -187000 },
  { radius: 4400, width: 850,  peak: 980,  tint: 0.85, snowLine: 0,    offX: -163000, offZ: 149000 },
  { radius: 5300, width: 1000, peak: 1380, tint: 0.90, snowLine: 1050, offX: 99000,  offZ: 233000 },
];
const ANGULAR_SEGS = 180; // segmentos ao longo do círculo
const RADIAL_BANDS = 5;   // faixas radiais (perfil triangular da crista)
const SNOW_BAND_M = 260;  // largura da transição rocha→neve nos picos

/** Geometria de um anel de cristas: grade (bandas radiais × segmentos angulares)
 *  com altura = ridged-FBM mascarado por um perfil senoidal (0 nas bordas do anel,
 *  pico no meio). Vertex color > 1 nos picos nevados (clareia contra o céu ao
 *  multiplicar a tinta do material). */
function makeRidgeRingGeometry(spec) {
  const cols = ANGULAR_SEGS + 1, rows = RADIAL_BANDS + 1;
  const pos = new Float32Array(cols * rows * 3);
  const col = new Float32Array(cols * rows * 3);
  const idx = [];
  for (let j = 0; j < rows; j++) {
    const fr = j / RADIAL_BANDS;
    const r = spec.radius - spec.width / 2 + fr * spec.width;
    const mask = Math.sin(Math.PI * fr); // 0 nas bordas, 1 na faixa central
    for (let i = 0; i < cols; i++) {
      const a = (i / ANGULAR_SEGS) * Math.PI * 2;
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      // λ ~1,4 km: picos/cavas largos que leem como serras, não como serra de dente.
      const ridge = ridgedFbm2D(x * 0.6 + spec.offX, z * 0.6 + spec.offZ, { freq: 1 / 1400, oct: 4 });
      const h = mask * (50 + ridge * spec.peak);
      const vi = (j * cols + i) * 3;
      pos[vi] = x; pos[vi + 1] = h; pos[vi + 2] = z;
      // Neve sutil nos picos: vertex color acima de 1 (Basic multiplica cor×vcolor).
      let shade = 1;
      if (spec.snowLine > 0) {
        const t = Math.max(0, Math.min(1, (h - (spec.snowLine - SNOW_BAND_M / 2)) / SNOW_BAND_M));
        shade = 1 + t * t * 0.4;
      }
      col[vi] = shade; col[vi + 1] = shade; col[vi + 2] = Math.min(shade * 1.04, 1.5);
    }
  }
  for (let j = 0; j < RADIAL_BANDS; j++) {
    for (let i = 0; i < ANGULAR_SEGS; i++) {
      const a = j * cols + i, b = a + 1, c = a + cols, d = c + 1;
      idx.push(a, c, b, b, c, d);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.setIndex(idx);
  return geo;
}

/** Cria o grupo de backdrop (3 anéis) e o adiciona à cena. Chamado UMA vez no
 *  create do mapa (buildInhaumaTerrain). Node-safe: só THREE puro, sem DOM. */
export function createInhaumaBackdrop(scene) {
  const group = new THREE.Group();
  const rings = BACKDROP_RINGS.map((spec) => {
    // Basic (não Lambert): cor 100% dirigida por getSkyColor() a cada frame —
    // comportamento noturno controlado (apaga com o céu), sem depender de luz.
    const mesh = new THREE.Mesh(
      makeRidgeRingGeometry(spec),
      new THREE.MeshBasicMaterial({ color: 0x8fa5b5, vertexColors: true, fog: false }),
    );
    mesh.frustumCulled = false; // anel 360° ao redor da câmera — sempre parcialmente visível
    group.add(mesh);
    return { mesh, tint: spec.tint };
  });
  scene.add(group);
  return { group, rings };
}

const _gray = new THREE.Color();

/** Recentra o grupo no XZ do jogador e retinta cada anel pela cor EFETIVA do
 *  horizonte: scene.fog.color (já sincronizada por main.js com getSkyColor() a cada
 *  frame — dia = base do mapa, noite = horizonte Preetham, que apaga os anéis).
 *  Fallback: getSkyColor() cru se a cena não expuser fog. Dessatura ~30% e
 *  escurece pelo fator do anel. Chamado todo frame pelo update do mapa. */
export function updateInhaumaBackdrop(backdrop, playerPos) {
  if (!backdrop || !playerPos) return;
  backdrop.group.position.set(playerPos.x, 0, playerPos.z);
  const fogColor = backdrop.group.parent?.fog?.color;
  const sky = fogColor || (_getSkyColor ? _getSkyColor() : null);
  if (!sky) return;
  for (const ring of backdrop.rings) {
    const c = ring.mesh.material.color;
    c.copy(sky);
    const lum = c.r * 0.299 + c.g * 0.587 + c.b * 0.114;
    _gray.setRGB(lum, lum, lum);
    c.lerp(_gray, 0.3).multiplyScalar(ring.tint);
  }
}
