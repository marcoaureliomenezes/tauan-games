// higgs.js — Bomba de bóson de Higgs: poço gravitacional TRANSIENTE que
// desestabiliza estrelas (T-PF-07).
//
// Física do efeito: o poço (~0.5 M☉ por ~8 s) induz um transbordo de lobo de
// Roche — onde a maré do poço vence a gravidade local da fotosfera, o plasma
// escoa em BRAÇOS/CORRENTES na direção do poço (Eggleton 1983; é a mesma
// mecânica da transferência de massa em binárias). Cessado o poço, a estrela
// REABSORVE os braços (o gás segue ligado ao poço da estrela). Se a instável
// (30%) — ou se a PRÓPRIA BOMBA, que também cai no campo da estrela, mergulha
// na fotosfera antes do fim do pulso — a estrela ejeta o envelope: SUPERNOVA
// multicolorida (paleta dos filamentos do Crab: Hα vermelho, O III verde-azul,
// S II âmbar) + onda de choque + dano em área. Licença documentada: a estrela
// re-estabiliza depois (o remanescente persistente fica fora de escopo).

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

const ARMS = 4;                        // braços de plasma por estrela engajada
const BLOBS = 14;                      // "elos" da corrente de cada braço

const active = [];                     // engajamentos {well, star, outcome, arms, phase, t, head}
const recovering = [];                 // estrelas re-estabilizando {star, t}

const _dir = new THREE.Vector3();
const _perp = new THREE.Vector3();
const _perp2 = new THREE.Vector3();
const _p = new THREE.Vector3();

function isStarBody(b) {
  const k = b.def.kind;
  return b.isSun || k === 'star' || k === 'redgiant' || k === 'redsupergiant' || k === 'whitedwarf';
}

function buildArm(star, seed) {
  const R = star.def.radius;
  const col = new THREE.Color(star.def.color || 0xffd27a);
  const blobs = [];
  for (let i = 0; i < BLOBS; i++) {
    const t = i / (BLOBS - 1);
    // afina da raiz p/ a ponta; pescoço quase branco (plasma mais quente no gargalo)
    const r = R * (0.085 - 0.055 * t);
    const c = col.clone().lerp(new THREE.Color(0xffffff), 0.25 + 0.5 * t);
    const m = new THREE.Mesh(
      new THREE.SphereGeometry(Math.max(r, R * 0.02), 10, 8),
      new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.85 - 0.35 * t, depthWrite: false }),
    );
    m.visible = false;
    scene.add(m);
    blobs.push(m);
  }
  return { blobs, seed, jitter: 0.5 + Math.random() * 0.7 };
}

// Chamado pelo weapons.js quando a bomba ARMA: cria o poço e engaja a estrela.
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
  let outcome = null;
  if (star) {
    // 30% supernova / 70% extração de plasma — testes podem forçar via
    // game.higgsForceOutcome ('plasma' | 'supernova').
    outcome = game.higgsForceOutcome || (Math.random() < 0.30 ? 'supernova' : 'plasma');
    const arms = [];
    for (let i = 0; i < ARMS; i++) arms.push(buildArm(star, i));
    active.push({ well, star, outcome, arms, phase: 'pull', t: 0, head: 0, proj: p });
    showToast(outcome === 'supernova'
      ? `Ħ BÓSON DE HIGGS — ${star.def.name} INSTÁVEL!`
      : `Ħ BÓSON DE HIGGS — extraindo plasma de ${star.def.name}`, 2600);
  } else {
    active.push({ well, star: null, outcome: null, arms: [], phase: 'pull', t: 0, head: 0, proj: p });
    showToast('Ħ BÓSON DE HIGGS — poço gravitacional ativo', 2000);
  }
  return outcome;
}

// Chamado pelo weapons.js se a bomba TOCA a fotosfera com o poço ativo:
// "se a bomba é puxada para a estrela antes de explodir → supernova".
export function higgsPlunge(p) {
  for (const e of active) {
    if (e.proj === p && e.phase === 'pull') {
      e.well.until = game.time;                          // poço morre no mergulho
      if (e.star) goSupernova(e);
      else e.phase = 'dead';
      return true;
    }
  }
  return false;
}

function goSupernova(e) {
  e.phase = 'retract';
  e.outcome = 'done';
  const star = e.star;
  supernovaFx(star.worldPos, star.def.radius);
  areaDamage(star.worldPos, star.def.radius * 6, 400);
  // envelope ejetado: a estrela ENCOLHE e re-estabiliza aos poucos (licença).
  if (star.mesh) { star.mesh.scale.setScalar(0.62); recovering.push({ star, t: 0 }); }
  game.supernovaCount = (game.supernovaCount || 0) + 1;   // diagnóstico p/ e2e
  showToast(`💥 SUPERNOVA — ${star.def.name} ejetou o envelope!`, 3200);
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
      // cabeça do braço avança da fotosfera até ~92% do caminho ao poço
      e.head = Math.min(1, e.head + dt / 2.6);
      if (game.time >= e.well.until) {
        // fim do pulso: instável → supernova; senão o plasma REABSORVE
        if (e.outcome === 'supernova') goSupernova(e);
        else e.phase = 'retract';
      }
    } else if (e.phase === 'retract') {
      // "a estrela puxa de volta os braços" — decaimento exponencial da cabeça
      e.head *= Math.exp(-1.6 * dt);
      if (e.head < 0.03) e.phase = 'dead';
    }

    if (e.star && e.phase !== 'dead') {
      const star = e.star, R = star.def.radius;
      _dir.copy(e.well.pos).sub(star.worldPos);
      const dist = Math.max(_dir.length(), R * 1.2);
      _dir.normalize();
      _perp.set(-_dir.z, 0, _dir.x).normalize();
      _perp2.crossVectors(_dir, _perp);
      for (let a = 0; a < e.arms.length; a++) {
        const arm = e.arms[a];
        const ang = (a / e.arms.length) * Math.PI * 2 + arm.seed;
        for (let b = 0; b < arm.blobs.length; b++) {
          const blob = arm.blobs[b];
          const t = b / (arm.blobs.length - 1);
          const reach = t * e.head;
          if (reach > 1.02 || e.head <= 0.01) { blob.visible = false; continue; }
          // raiz na fotosfera (deslocada por braço) → cabeça rumo ao poço, com
          // ondulação transversal (a corrente "serpenteia" como gás de verdade)
          const wig = Math.sin(e.t * 2.2 * arm.jitter + t * 7) * R * 0.16 * (1 - t * 0.5);
          const spread = R * 0.5 * (1 - t);
          _p.copy(star.worldPos)
            .addScaledVector(_dir, R + reach * (dist - R) * 0.92)
            .addScaledVector(_perp, Math.cos(ang) * spread + wig)
            .addScaledVector(_perp2, Math.sin(ang) * spread + wig * 0.6);
          blob.position.copy(_p);
          blob.visible = true;
        }
      }
    }

    if (e.phase === 'dead') {
      for (const arm of e.arms) for (const b of arm.blobs) { scene.remove(b); b.material.dispose(); b.geometry.dispose(); }
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
