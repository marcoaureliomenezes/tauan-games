// journey.js — VIAGEM INTERESTELAR trapezoidal (T-IE-02, operador 2026-07-04):
//
// Perfil 30/40/30 — 30% do tempo ACELERANDO, 40% em VELOCIDADE MÁXIMA
// (cruzeiro: é onde a relatividade DURA na tela), 30% FREANDO:
//   v_max = D/(0.7T)  ·  a = v_max/(0.3T)  (physics.journeyProfileTrapezoid)
// O tempo é NORMALIZADO pela distância entre sistemas (D_min→3:00, D_max→6:00).
// β_visual = 0.995·v/v_max alimenta a relatividade (aberração/Doppler/beaming)
// do starfield e do postfx — a 0.995, uma estrela a 90° aparece a ~5.7° do rumo
// (headlight forte, realista). IMUNIDADE a colisão durante a queima (D-4:
// reverte o abort-por-impacto do rc-1 por demanda explícita do operador).

import * as THREE from '../../vendor/three.module.min.js';
import { game } from './state.js';
import { SYSTEMS } from './config.js';
import { currentTarget, currentSystem } from './nav.js';
import { showToast } from './hud.js';
// Leis PURAS em celestial/physics.js (node-testável): perfil + duração.
import { journeyProfileTrapezoid, journeyDuration } from './celestial/physics.js';

// Menor/maior distância entre pares de centros de sistemas (inclui o Véu,
// registrado em runtime — SYSTEMS é o array vivo).
function systemPairBounds() {
  let dMin = Infinity, dMax = 0;
  const c = new THREE.Vector3(), d = new THREE.Vector3();
  for (let i = 0; i < SYSTEMS.length; i++) {
    for (let j = i + 1; j < SYSTEMS.length; j++) {
      c.set(...SYSTEMS[i].center); d.set(...SYSTEMS[j].center);
      const dist = c.distanceTo(d);
      dMin = Math.min(dMin, dist); dMax = Math.max(dMax, dist);
    }
  }
  return { dMin, dMax };
}

const _to = new THREE.Vector3();
const _dir = new THREE.Vector3();

// O alvo atual pede viagem interestelar? (corpo de OUTRO sistema)
export function journeyEligible() {
  const t = currentTarget();
  if (!t || !t.body || t.isMission) return false;
  const sys = currentSystem();
  return !sys || t.body.system !== sys.key;
}

export function journeyToggle() {
  const j = game.journey;
  if (j && j.active) { journeyAbort('abortada pelo piloto'); return 'aborted'; }
  const t = currentTarget();
  if (!journeyEligible() || game.ship.landed) return null;
  const s = game.ship;
  const { dMin, dMax } = systemPairBounds();
  // ponto de chegada: à FRENTE da primária alvo, do lado de quem chega
  const arriveDist = Math.max(t.body.def.radius * 8, 130_000);
  _to.copy(t.pos);
  _dir.copy(_to).sub(s.pos).normalize();
  _to.addScaledVector(_dir, -arriveDist);
  const D = s.pos.distanceTo(_to);
  const T = journeyDuration(D, dMin, dMax);
  game.journey = {
    active: true, t: 0, T, D, s: 0, beta: 0, v: 0, phase: 'accel',
    immune: true,                        // sem colisão durante a queima (AC-05)
    from: s.pos.clone(), targetKey: t.key, targetName: t.name,
    arriveDist, vMax: D / (0.7 * T),
  };
  s.orbitAssist = false; s.aligning = false;
  showToast(`⭒ VIAGEM INTERESTELAR → ${t.name} · ${fmtT(T)} de queima contínua`, 3200);
  return 'engaged';
}

export function journeyAbort(reason) {
  const j = game.journey;
  if (!j || !j.active) return;
  j.active = false;
  // velocidade residual segura na direção do voo
  const s = game.ship;
  const v = Math.min(j.v || 0, 9000);
  s.vel.copy(_dir).multiplyScalar(v);
  showToast(`⭒ Queima interrompida (${reason})`, 2200);
}

// Salto de progresso p/ testes/QA (D-8): __swDebug.journeyWarp(0.55)
export function journeyWarp(sNorm) {
  const j = game.journey;
  if (!j || !j.active) return false;
  j.t = Math.max(0, Math.min(1, sNorm)) * j.T;
  return true;
}

const _q = new THREE.Quaternion();
const _m = new THREE.Matrix4();
const _up = new THREE.Vector3(0, 1, 0);

export function updateJourney(dt) {
  const j = game.journey;
  if (!j || !j.active) return false;
  const s = game.ship;
  const t = game.bodies.find((b) => b.def.key === j.targetKey);
  if (!t) { journeyAbort('alvo perdido'); return false; }

  j.t += dt;
  // endpoint segue o alvo (primárias quase paradas; binário dança)
  _to.copy(t.worldPos);
  _dir.copy(_to).sub(j.from).normalize();
  _to.addScaledVector(_dir, -j.arriveDist);
  const D = j.from.distanceTo(_to);

  const prof = journeyProfileTrapezoid(D, j.T, j.t);
  j.s = prof.s; j.v = prof.v; j.D = D; j.phase = prof.phase;
  j.vMax = prof.vMax;
  j.beta = 0.995 * (prof.v / Math.max(1, prof.vMax));

  // posição no corredor + velocidade real (projéteis/HUD herdam)
  s.pos.copy(j.from).addScaledVector(_dir, prof.x);
  s.vel.copy(_dir).multiplyScalar(prof.v);
  s.speed = prof.v;

  // IMUNIDADE (AC-05, reverte D-1 do rc-1 da journey por ordem do operador:
  // "retire a possibilidade de colidirmos com estrelas"): o autopilot da queima
  // atravessa o corredor sem abort nem dano — chegada e aborto manual intactos.

  // nariz gruda na direção do voo (a nave "surfa" a própria queima)
  _m.lookAt(s.pos, _to, _up);
  _q.setFromRotationMatrix(_m);
  s.quat.slerp(_q, Math.min(1, 4 * dt));

  if (j.t >= j.T) {
    j.active = false;
    s.vel.copy(_dir).multiplyScalar(1500);       // residual de chegada
    showToast(`⭒ Chegada: ${j.targetName} — bem-vindo ao sistema`, 3000);
  }
  return true;
}

function fmtT(T) {
  const m = Math.floor(T / 60), ss = Math.round(T % 60);
  return `${m}:${String(ss).padStart(2, '0')}`;
}
