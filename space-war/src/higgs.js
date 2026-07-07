// higgs.js — Bomba de bóson de Higgs: um MICRO BURACO NEGRO transiente sob o
// comando do jogador (T-PF-07; redesenho operador 2026-07-07).
//
// Física do efeito: o poço (~0.5 M☉ por ~8 s) induz um transbordo de lobo de
// Roche na estrela engajada — a MESMA anatomia do Devorador (rocheStream):
// o plasma nasce na fotosfera virada ao poço, cai numa CORRENTE curva que
// enrola rumo ao poço e termina num hot spot pulsante; a estrela deforma em
// TEARDROP (uTideDir/uTideAmp do STAR_VERT) apontando ao poço. Também drena
// DISCOS DE ACREÇÃO de buracos negros (corrente da borda do disco ao poço).
//
// SUPERNOVA por DRENO ACUMULADO (determinística — sem sorteio): cada pulso
// completo drena a estrela; quando o dreno total passa do limiar (∝ raio),
// o envelope ejeta. A onda de choque NÃO mata o jogador: ela o ARREMESSA para
// longe, ileso, com a câmera em modo cinema olhando a explosão (operador:
// "would not kill us but take us far away while we see the explosion").
// Mergulho da bomba na fotosfera com o poço ativo continua = supernova direta.
// Licença documentada: a estrela re-estabiliza depois.

import * as THREE from '../../vendor/three.module.min.js';
import { scene } from './scene.js';
import { game } from './state.js';
import { supernovaFx } from './fx.js';
import { areaDamage } from './weapons.js';
import { showToast } from './hud.js';

export const HIGGS_MU = 5.0e11;       // ~0.5 M☉ NOMINAL — usado no critério de Roche
export const HIGGS_PULL_S = 8;        // duração do poço
export const HIGGS_COOLDOWN_S = 12;
// Dinâmica do poço (audit P0-2): o campo que os objetos SENTEM não é μ/d² do
// valor nominal (que dava um platô de 600 u/s² por 29k u) — é o perfil Plummer
// de physics.higgsWellAccel com estes parâmetros: pico 600 u/s² no núcleo
// (soft), ~1/d² além, zero fora de `reach`. O μ nominal segue valendo para o
// engajamento de estrelas (maré na fotosfera), que é um critério de CONTATO
// próximo — não é afetado pelo alcance dinâmico.
export const HIGGS_SOFT = 1000;
export const HIGGS_CAP = 600;
export const HIGGS_REACH = 18_000;

// Dreno p/ supernova: uma estrela precisa de `raio/12k` pulsos COMPLETOS
// (mín. 0.8, máx. 3) — anãs estouram com 1 bomba, supergigantes pedem ~3.
const NOVA_DRAIN_PER_RADIUS = 12_000;

const active = [];                     // engajamentos {well, star, disk, stream, phase, t, head}
const recovering = [];                 // estrelas re-estabilizando {star, t}

const _dir = new THREE.Vector3();
const _p = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _x = new THREE.Vector3(1, 0, 0);
const _tideLocal = new THREE.Vector3();
const _invQ = new THREE.Quaternion();

function isStarBody(b) {
  const k = b.def.kind;
  return b.isSun || k === 'star' || k === 'redgiant' || k === 'redsupergiant' || k === 'whitedwarf';
}

function makeHotSpot() {
  const cv = document.createElement('canvas'); cv.width = 64; cv.height = 64;
  const c = cv.getContext('2d');
  const g = c.createRadialGradient(32, 32, 1, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.35, 'rgba(255,214,150,0.7)');
  g.addColorStop(1, 'rgba(255,150,60,0)');
  c.fillStyle = g; c.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(cv);
  return new THREE.Sprite(new THREE.SpriteMaterial({
    map: tex, blending: THREE.NormalBlending, depthWrite: false, transparent: true,
  }));
}

// ── Corrente de plasma FONTE→POÇO (anatomia do rocheStream do Devorador) ─────
// Frame local ancorado no POÇO: +X aponta à fonte; a curva nasce na superfície
// da fonte, cai afinando e ENROLA (trailing) até o núcleo do poço, onde pulsa
// um hot spot. Construída uma vez (poço é estático na cena) e revelada por
// drawRange conforme e.head avança — na retração o gás recua de volta à fonte.
function buildStream(sep, srcRadius, color) {
  const group = new THREE.Group();
  const SEGS = 64;
  const s0 = sep - srcRadius * 0.72;              // raiz: fotosfera/borda da fonte
  const pts = [];
  for (let i = 0; i <= SEGS; i++) {
    const t = i / SEGS;
    const r = s0 * Math.pow(1 - t, 1.10) + HIGGS_SOFT * 0.6 * t;
    // deflexão SUAVE (≈40°): o poço é um PONTO — enrolar demais vira um
    // "ribbon" branco visto de lado; um arco raso lê como corrente de gás
    const th = 0.72 * Math.pow(t, 1.9);
    pts.push(new THREE.Vector3(
      Math.cos(th) * r,
      Math.sin(t * Math.PI) * srcRadius * 0.05,   // leve arco fora do plano
      Math.sin(th) * r,
    ));
  }
  const curve = new THREE.CatmullRomCurve3(pts);
  const col = new THREE.Color(color || 0xffb36a);
  const tube = new THREE.Mesh(
    new THREE.TubeGeometry(curve, SEGS, srcRadius * 0.10, 7, false),
    new THREE.MeshBasicMaterial({
      color: col.clone().lerp(new THREE.Color(0xffffff), 0.15), transparent: true,
      opacity: 0.30, blending: THREE.AdditiveBlending, depthWrite: false,
    }),
  );
  const hotTube = new THREE.Mesh(
    new THREE.TubeGeometry(curve, SEGS, srcRadius * 0.035, 6, false),
    new THREE.MeshBasicMaterial({
      color: 0xfff0d0, transparent: true, opacity: 0.55,
      blending: THREE.AdditiveBlending, depthWrite: false,
    }),
  );
  group.add(tube); group.add(hotTube);
  const spot = makeHotSpot();
  spot.scale.setScalar(srcRadius * 0.5);
  group.add(spot);
  const idxCount = tube.geometry.index.count;
  const idxCountHot = hotTube.geometry.index.count;
  return {
    group, spot,
    mats: [tube.material, hotTube.material],
    // revela a corrente da RAIZ (fonte) rumo ao poço conforme head 0→1
    setHead(h) {
      tube.geometry.setDrawRange(0, Math.floor(idxCount * h));
      hotTube.geometry.setDrawRange(0, Math.floor(idxCountHot * h));
      spot.visible = h > 0.92;
    },
    dispose() {
      group.removeFromParent();
      tube.geometry.dispose(); tube.material.dispose();
      hotTube.geometry.dispose(); hotTube.material.dispose();
      spot.material.map.dispose(); spot.material.dispose();
    },
  };
}

// Chamado pelo weapons.js quando a bomba ARMA: cria o poço e engaja a fonte.
export function activateHiggs(p) {
  const well = {
    pos: p.mesh.position, mu: HIGGS_MU, until: game.time + HIGGS_PULL_S,
    soft: HIGGS_SOFT, cap: HIGGS_CAP, reach: HIGGS_REACH,
  };
  game.wells.push(well);
  // Engajamento FÍSICO (critério de Roche): a estrela só é perturbada se a maré
  // do poço na fotosfera vencer ~2% da gravidade de superfície dela —
  // (d − R) ≤ √(μ_H / (0.02·g_surf)), g_surf = μ*/R². Consequência honesta:
  // anãs compactas (g_surf alto) são MUITO mais difíceis de perturbar que
  // gigantes infladas — exatamente como na física de binárias.
  let star = null, best = Infinity;
  for (const b of game.bodies) {
    if (!isStarBody(b)) continue;
    const R = b.def.radius;
    const d = b.worldPos.distanceTo(p.mesh.position);
    const gSurf = b.mu / (R * R);
    const reach = Math.sqrt(HIGGS_MU / (0.02 * gSurf));
    if (d - R < reach && d / R < best) { best = d / R; star = b; }
  }
  // Sem estrela: o poço também suga DISCOS DE ACREÇÃO (borda externa → poço).
  let disk = null;
  if (!star) {
    for (const b of game.bodies) {
      if (!b.def.disk) continue;
      const d = b.worldPos.distanceTo(p.mesh.position);
      if (d < b.def.disk.outer * 2.2) { disk = b; break; }
    }
  }
  const e = { well, star, disk, stream: null, phase: 'pull', t: 0, head: 0, proj: p };
  if (star) {
    const sep = Math.max(star.worldPos.distanceTo(well.pos), star.def.radius * 1.25);
    e.stream = buildStream(sep, star.def.radius, star.def.color);
    scene.add(e.stream.group);
    showToast(`Ħ BÓSON DE HIGGS — sugando plasma de ${star.def.name}`, 2600);
  } else if (disk) {
    const sep = Math.max(disk.worldPos.distanceTo(well.pos), disk.def.disk.outer * 0.9);
    e.stream = buildStream(sep, disk.def.disk.outer * 0.22, 0xaad4ff);
    scene.add(e.stream.group);
    showToast(`Ħ BÓSON DE HIGGS — drenando o disco de ${disk.def.name}`, 2600);
  } else {
    showToast('Ħ BÓSON DE HIGGS — poço gravitacional ativo', 2000);
  }
  active.push(e);
  // outcome forçado (testes): 'supernova' detona ao fim do pulso; 'plasma' nunca
  return game.higgsForceOutcome || (star ? 'plasma' : null);
}

// Chamado pelo weapons.js se a bomba TOCA a fotosfera com o poço ativo:
// "se a bomba é puxada para a estrela antes de explodir → supernova".
export function higgsPlunge(p) {
  for (const e of active) {
    if (e.proj === p && e.phase === 'pull') {
      e.well.until = game.time;                          // poço morre no mergulho
      if (e.star) goSupernova(e);
      else e.phase = 'retract';
      return true;
    }
  }
  return false;
}

const _fling = new THREE.Vector3();
function goSupernova(e) {
  e.phase = 'retract';
  const star = e.star;
  supernovaFx(star.worldPos, star.def.radius);
  // dano em área nos INIMIGOS/alvos; o jogador NÃO morre — a onda de choque o
  // ARREMESSA para longe, ileso, olhando a explosão (modo cinema ~6 s).
  const s = game.ship;
  s.spawnGrace = Math.max(s.spawnGrace, 10);             // blinda do areaDamage e do fogo inimigo
  areaDamage(star.worldPos, star.def.radius * 6, 400);
  if (!s.landed) {
    _fling.copy(s.pos).sub(star.worldPos);
    const d = Math.max(_fling.length(), 1);
    _fling.multiplyScalar(1 / d);
    const kick = Math.max(1.6 * Math.sqrt((2 * star.mu) / d), 24_000);
    s.vel.addScaledVector(_fling, kick);
    s.approach = false; s.orbitAssist = false; s.aligning = false;
    game.cinema = { at: star.worldPos.clone(), until: game.time + 6 };
  }
  star._drain = 0;
  // envelope ejetado: a estrela ENCOLHE e re-estabiliza aos poucos (licença).
  if (star.mesh) { star.mesh.scale.setScalar(0.62); recovering.push({ star, t: 0 }); }
  game.supernovaCount = (game.supernovaCount || 0) + 1;   // diagnóstico p/ e2e
  showToast(`💥 SUPERNOVA — ${star.def.name} ejetou o envelope!`, 3200);
}

function setTide(star, amp, towards) {
  const mat = star.mesh && star.mesh.material;
  if (!(mat && mat.uniforms && mat.uniforms.uTideDir)) return;
  if (towards) {
    _tideLocal.copy(towards).sub(star.worldPos).normalize();
    _invQ.copy(star.mesh.getWorldQuaternion(_q)).invert();
    _tideLocal.applyQuaternion(_invQ);
    mat.uniforms.uTideDir.value.copy(_tideLocal);
  }
  mat.uniforms.uTideAmp.value = amp;
}

export function updateHiggs(dt) {
  const s = game.ship;
  if (s.higgsCd > 0) s.higgsCd = Math.max(0, s.higgsCd - dt);

  // poços expirados saem da lista global (computeGravity só lê)
  for (let i = game.wells.length - 1; i >= 0; i--) {
    if (game.time > game.wells[i].until) game.wells.splice(i, 1);
  }

  for (let i = active.length - 1; i >= 0; i--) {
    const e = active[i];
    e.t += dt;

    if (e.phase === 'pull') {
      // cabeça da corrente avança da fonte até o poço
      e.head = Math.min(1, e.head + dt / 2.4);
      // DRENO acumulado (determinístico): a estrela guarda quanto já perdeu —
      // pulsos sucessivos somam até o limiar de supernova (∝ raio).
      if (e.star && e.head > 0.5) {
        e.star._drain = (e.star._drain || 0) + dt;
        const need = HIGGS_PULL_S * Math.min(3, Math.max(0.8, e.star.def.radius / NOVA_DRAIN_PER_RADIUS));
        if (e.star._drain >= need) { e.well.until = game.time; goSupernova(e); continue; }
      }
      if (game.time >= e.well.until) {
        // fim do pulso: outcome forçado (testes) detona; senão o gás REABSORVE
        if (e.star && game.higgsForceOutcome === 'supernova') goSupernova(e);
        else e.phase = 'retract';
      }
    } else if (e.phase === 'retract') {
      // "a fonte puxa de volta a corrente" — decaimento exponencial da cabeça
      e.head *= Math.exp(-1.6 * dt);
      if (e.head < 0.03) e.phase = 'dead';
    }

    const src = e.star || e.disk;
    if (src && e.stream && e.phase !== 'dead') {
      // reorienta o frame local: poço na origem, +X → fonte
      e.stream.group.position.copy(e.well.pos);
      _dir.copy(src.worldPos).sub(e.well.pos);
      const dist = _dir.length();
      if (dist > 1) {
        _q.setFromUnitVectors(_x, _dir.multiplyScalar(1 / dist));
        e.stream.group.quaternion.copy(_q);
      }
      e.stream.setHead(e.head);
      const breathe = 0.85 + 0.15 * Math.sin(e.t * 2.1);
      e.stream.mats[0].opacity = 0.30 * breathe;
      e.stream.mats[1].opacity = 0.55 * breathe;
      e.stream.spot.material.opacity = 0.65 + 0.30 * Math.sin(e.t * 5.7);
      // TEARDROP da estrela drenada: bulge aponta ao POÇO enquanto suga
      if (e.star) setTide(e.star, 0.30 * e.head, e.well.pos);
    }

    if (e.phase === 'dead') {
      if (e.star) setTide(e.star, 0, null);
      if (e.stream) e.stream.dispose();
      active.splice(i, 1);
    }
  }

  // estrelas re-estabilizando (envelope re-inflando ao longo de ~60 s)
  for (let i = recovering.length - 1; i >= 0; i--) {
    const r = recovering[i];
    r.t += dt;
    const sc = Math.min(1, 0.62 + (r.t / 60) * 0.38);
    if (r.star.mesh) r.star.mesh.scale.setScalar(sc);
    if (sc >= 1) recovering.splice(i, 1);
  }
}

// Diagnóstico p/ e2e/HUD
export function higgsActiveCount() { return active.length; }

// FASES (T-PR-06): engajamentos referenciam corpos do sistema descarregado —
// morrem com ele (correntes removidas, poços limpos por weapons.clearProjectiles).
export function clearHiggs() {
  for (const e of active) {
    if (e.stream) e.stream.dispose();
  }
  active.length = 0;
  recovering.length = 0;
}
