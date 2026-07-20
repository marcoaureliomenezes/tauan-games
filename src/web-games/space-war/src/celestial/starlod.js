// celestial/starlod.js — LOD fotométrico ponto↔disco (T-PS-04, AC-02/03/04/05).
//
// Estrela é fonte pontual não-resolvida: quando o DISCO cai abaixo de ~1px o
// visual near (mesh FBM + corona + anatomia) desliga e entra o PONTO fotométrico
// — sprite de cena (escapa o cull por sistema) com brilho I = L·(D0/d)² e
// tamanho = núcleo fixo + glare √(I−1) (physics.pointIntensity/pointPx/
// pointAlpha, unit-provadas). Histerese 2px↑/1px↓ (physics.lodStep) anti-flicker.
//
// O pulsar (bug space-war-neutron-star-barely-visible) é a fonte pontual mais
// brilhante do jogo (lum 80): ponto azul-branco ofuscante MODULADO pelo strobe
// óptico ~30 Hz — visível de qualquer sistema, como um farol de verdade.
//
// GLOWS DE SISTEMA (substituem os beacons fixos de 40k — mesma doença dos
// "círculos de tamanho fixo"): fora de 0.9·raio do sistema, os membros somem e
// no lugar brilha UM ponto com o fluxo SOMADO das estrelas (cluster não-resolvido
// — fotometria honesta); dentro, os membros individuais assumem. Gauge maior
// (D0_SYS): sistemas são marcos de navegação.
//
// CORONA COM TETO (bug space-war-distant-suns-oversized): a corona natural
// (world-scale, 2.5×disco) afunila para 1.15×disco além da vizinhança solar —
// de longe um sol é um disco nítido com glow justo, não um blob de graus.

import * as THREE from '../../../vendor/three.module.min.js';
import { scene, camera } from '../scene.js';
import { game } from '../state.js';
import { SYSTEMS } from '../config.js';
import { makeRadialSprite } from './atoms.js';
import { pointIntensity, pointPx, pointAlpha, discPx, lodStep, lumForStar } from './physics.js';
import { pixelAngle } from '../starfield.js';

// Corona: natural (2.5×disco) até CORONA_NEAR, afunilando a 1.15×disco em CORONA_FAR.
const CORONA_NEAR = 700_000;
const CORONA_FAR = 3_000_000;
// Gauge dos glows de sistema (marcos de navegação — flux somado, não-resolvido).
// Anel de sistemas a 19–29M (proporções verdadeiras): 8M mantém o binário/
// Betelgeuse como faróis vivos e o solar como a estrela fraca que ele É de lá.
const D0_SYS = 8_000_000;
const GLOW_TINTS = {
  binary: ['rgba(220,232,255,0.98)', 'rgba(150,185,255,0.55)', 'rgba(150,90,230,0.18)', 'rgba(0,0,0,0)'],
  chaotic: ['rgba(200,220,255,0.95)', 'rgba(255,180,110,0.45)', 'rgba(120,80,50,0.12)', 'rgba(0,0,0,0)'],
  core: ['rgba(255,240,220,0.98)', 'rgba(255,190,120,0.5)', 'rgba(160,80,200,0.20)', 'rgba(0,0,0,0)'],
  veil: ['rgba(255,214,170,0.98)', 'rgba(255,140,90,0.5)', 'rgba(190,235,255,0.18)', 'rgba(0,0,0,0)'],
  solar: ['rgba(255,244,214,0.98)', 'rgba(255,220,150,0.5)', 'rgba(200,160,80,0.15)', 'rgba(0,0,0,0)'],
};

const _stars = [];    // { body, sprite, nearViz, mode, lum, coronaBase }
const _glows = [];    // { sys, sprite, lum, center }

function photoSprite(stops) {
  const sp = makeRadialSprite(stops);
  sp.material.blending = THREE.NormalBlending;   // gotcha: aditivo+log-depth+bloom = NaN
  sp.renderOrder = -6;                           // sobre o starfield, sob os corpos
  return sp;
}

function starStops(colorHex) {
  const c = new THREE.Color(colorHex);
  const rgb = `${(c.r * 255) | 0},${(c.g * 255) | 0},${(c.b * 255) | 0}`;
  return ['rgba(255,255,255,1.0)', `rgba(${rgb},0.85)`, `rgba(${rgb},0.22)`, 'rgba(0,0,0,0)'];
}

// Pós-build: prepara cada estrela luminosa (subgrupo nearViz + ponto de cena)
// e um glow fotométrico por sistema cullado.
export function buildFarStars() {
  for (const b of game.bodies) {
    const lum = lumForStar(b.def);
    if (!lum) continue;
    // separa o visual near (mesh/corona/anatomia) das LUZES (ficam no grupo —
    // um pulsar em modo ponto continua iluminando o remanescente).
    const nearViz = new THREE.Group();
    for (const child of [...b.group.children]) {
      if (child.isLight) continue;
      nearViz.add(child);
    }
    b.group.add(nearViz);
    const sprite = photoSprite(starStops(b.def.light?.color ?? b.def.color ?? 0xffffff));
    sprite.visible = false;
    scene.add(sprite);
    _stars.push({
      body: b, sprite, nearViz, mode: 'disc', lum,
      coronaBase: b.corona ? b.corona.scale.x : 0,
    });
  }

  // Glows de sistema: TODOS (proporções verdadeiras: com o cull universal e os
  // sistemas a 19–29M, nenhum disco cruza o vazio — o glow é o único marco;
  // o solar visto do binário é só mais uma estrela fraca, como manda o céu).
  for (const sys of SYSTEMS) {
    let lum = 0;
    for (const e of _stars) if (e.body.system === sys.key) lum += e.lum;
    if (!lum) continue;
    const sprite = photoSprite(GLOW_TINTS[sys.key] || GLOW_TINTS.solar);
    sprite.visible = false;
    sprite.position.set(...sys.center);
    scene.add(sprite);
    _glows.push({ sys, sprite, lum, center: new THREE.Vector3(...sys.center) });
  }
  game.starLod = {};
  game.sysGlow = {};
}

export function updateFarStars() {
  if (!_stars.length) return;
  const pxA = pixelAngle();
  const strobe = game.pulsarStrobe ?? 1;

  // Sistemas "resolvidos" (câmera dentro de 0.9·raio): membros assumem, glow some.
  const resolved = {};
  for (const g of _glows) {
    resolved[g.sys.key] = camera.position.distanceTo(g.center) < g.sys.radius * 0.9;
  }

  for (const e of _stars) {
    const b = e.body;
    const d = camera.position.distanceTo(b.worldPos);
    const dPx = discPx(b.def.radius, d, pxA);
    e.mode = lodStep(e.mode, dPx);
    // Cluster não-resolvido: fora de 0.9·raio o glow SOMADO representa o sistema
    // — o ponto individual cede (sem dupla contagem de fluxo). Discos resolvíveis
    // (Sol/Betelgeuse, sem glow) nunca são suprimidos.
    const clusterFar = (b.system in resolved) && !resolved[b.system];
    const discMode = e.mode === 'disc' && b.group.visible;

    e.nearViz.visible = discMode;
    let I = 0, px = 0, alpha = 0;
    if (!discMode && !clusterFar) {
      I = pointIntensity(e.lum, d);
      px = pointPx(I);
      alpha = pointAlpha(I) * (b.def.kind === 'neutron' ? strobe : 1);
      e.sprite.position.copy(b.worldPos);
      e.sprite.scale.setScalar(px * d * pxA);
      e.sprite.material.opacity = alpha;
      e.sprite.visible = alpha > 0.02;
    } else {
      e.sprite.visible = false;
    }

    // Teto da corona (só no modo disco; NS/BH têm anatomia própria sem b.corona)
    if (discMode && b.corona && e.coronaBase) {
      const t = THREE.MathUtils.smoothstep(d, CORONA_NEAR, CORONA_FAR);
      const capMul = 2.5 + (1.15 - 2.5) * t;
      const capWorld = capMul * (2 * b.def.radius);     // capMul × diâmetro do disco
      b.corona.scale.setScalar(Math.min(e.coronaBase, capWorld));
    }

    game.starLod[b.def.key] = {
      mode: discMode ? 'disc' : (clusterFar ? 'cluster' : 'point'),
      discPx: +dPx.toFixed(2), I: +I.toFixed(4), px: +px.toFixed(2),
      alpha: +alpha.toFixed(3),
      coronaPx: b.corona ? +((b.corona.scale.x / Math.max(d * pxA, 1e-9))).toFixed(1) : 0,
      visible: e.sprite.visible || (discMode && b.group.visible),
    };
  }

  for (const g of _glows) {
    const d = camera.position.distanceTo(g.center);
    const show = d > g.sys.radius * 0.9;
    let I = 0, px = 0, alpha = 0;
    if (show) {
      I = pointIntensity(g.lum, d, D0_SYS);
      px = pointPx(I, 2.6, 2.6, 30);
      alpha = pointAlpha(I) * (g.sys.key === 'binary' ? strobe : 1);
      g.sprite.scale.setScalar(px * d * pxA);
      g.sprite.material.opacity = alpha;
    }
    g.sprite.visible = show && alpha > 0.02;
    game.sysGlow[g.sys.key] = {
      I: +I.toFixed(4), px: +px.toFixed(2), alpha: +alpha.toFixed(3), visible: g.sprite.visible,
    };
  }
}
