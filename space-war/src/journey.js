// journey.js — VIAGEM INTERESTELAR trapezoidal (T-IE-02; FASES no audit T-PR-06).
//
// Perfil 30/40/30 — 30% do tempo ACELERANDO, 40% em VELOCIDADE MÁXIMA
// (cruzeiro: é onde a relatividade DURA na tela), 30% FREANDO:
//   v_max = D/(0.7T)  ·  a = v_max/(0.3T)  (physics.journeyProfileTrapezoid)
// O tempo é NORMALIZADO pela distância entre sistemas (D_min→3:00, D_max→6:00).
// β_visual = 0.995·v/v_max · systemFade (P0-1: a relatividade só liga FORA da
// fronteira do sistema). IMUNIDADE a colisão durante a queima (D-4).
//
// FASES (T-PR-06): o alvo interestelar é um DESCRITOR de config.SYSTEMS (o
// corpo não existe até a chegada). O corredor é GALÁCTICO e fixo: from = posição
// galáctica da nave no engate; to = centro do destino recuado `arriveDist` do
// lado de quem chega. A nave recebe pos_cena = pos_galáctica − world.origin;
// quem carrega/descarrega sistemas e rebaseia a origem é world.updateWorldPhase
// — a journey só voa o corredor.

import * as THREE from '../../vendor/three.module.min.js';
import { game } from './state.js';
import { SYSTEMS } from './config.js';
import { currentTarget } from './nav.js';
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
const _g = new THREE.Vector3();

// O alvo atual pede viagem interestelar? (descritor de OUTRO sistema — a
// primária do sistema carregado é um corpo vivo, nunca isSystem)
export function journeyEligible() {
  const t = currentTarget();
  return !!(t && t.isSystem && !t.isMission);
}

export function journeyToggle() {
  const j = game.journey;
  if (j && j.active) { journeyAbort('abortada pelo piloto'); return 'aborted'; }
  const t = currentTarget();
  if (!journeyEligible() || game.ship.landed) return null;
  const s = game.ship;
  const sys = t.system;
  const { dMin, dMax } = systemPairBounds();
  // posição GALÁCTICA atual da nave e do centro do destino
  _g.copy(s.pos).add(game.world.origin);
  _to.set(...sys.center);
  // ponto de chegada: à frente do centro do destino, do lado de quem chega
  const arriveDist = sys.arriveDist || Math.max(sys.radius * 0.4, 130_000);
  _dir.copy(_to).sub(_g).normalize();
  _to.addScaledVector(_dir, -arriveDist);
  const D = _g.distanceTo(_to);
  const T = journeyDuration(D, dMin, dMax);
  game.journey = {
    active: true, t: 0, T, D, s: 0, beta: 0, v: 0, phase: 'accel',
    immune: true,                        // sem colisão durante a queima (AC-05)
    fromG: _g.clone(), toG: _to.clone(),
    targetKey: t.key, targetName: t.name, destKey: sys.key,
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

  j.t += dt;
  _dir.copy(j.toG).sub(j.fromG).normalize();

  const prof = journeyProfileTrapezoid(j.D, j.T, j.t);
  j.s = prof.s; j.v = prof.v; j.phase = prof.phase;
  j.vMax = prof.vMax;
  j.beta = 0.995 * (prof.v / Math.max(1, prof.vMax));

  // posição no corredor GALÁCTICO → frame da cena; velocidade real (HUD herda)
  _g.copy(j.fromG).addScaledVector(_dir, prof.x);
  s.pos.copy(_g).sub(game.world.origin);
  s.vel.copy(_dir).multiplyScalar(prof.v);
  s.speed = prof.v;

  // IMUNIDADE (AC-05): a queima atravessa o corredor sem abort nem dano.

  // nariz gruda na direção do voo (a nave "surfa" a própria queima)
  _to.copy(s.pos).add(_dir);
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
