// gravity.js — Gravidade sobre a NAVE, consciente do REGIME de cada sistema:
//
//  - Sistemas HIERÁRQUICOS (solar, betelgeuse): patched-conics — o corpo de MENOR
//    SOI que contém a nave domina sozinho (é o que torna órbitas keplerianas
//    limpas possíveis em torno de qualquer corpo).
//  - PAR BINÁRIO (Devorador, Pulsar, Betelgeuse): os DOIS parceiros somam.
//  - Sistemas DINÂMICOS (regime N-corpos, hoje dormente): SOMA de TODOS os corpos.
//  - VAZIO INTERESTELAR (fora de todos os SOIs): o corpo de maior aceleração
//    real domina (nunca existe zona morta) e a flag `interstellar` libera o
//    motor interestelar (overdrive) da nave.
//
// Devolve também a análise orbital: v_circ=√(μ/r), v_esc=√(2μ/r), componentes
// tangencial/radial da velocidade da nave (p/ HUD e assistente de órbita).

import * as THREE from '../../vendor/three.module.min.js';
import { MAX_ESCAPE_SPEED } from './config.js';
import { game } from './state.js';
import { pwAccel, pwCircularSpeed, pwEscapeSpeed, higgsWellAccel } from './celestial/physics.js';

// r_s efetivo de um corpo compacto: BN declara `rs`; NS usa compacidade real
// R ≈ 2.5·r_s (R/r_s = 2.4–2.9 nas medidas NICER).
function _rsOf(def) {
  return def.rs ?? def.radius / 2.5;
}
function _isCompact(def) {
  return def.kind === 'blackhole' || def.kind === 'neutron';
}

// Regime N-corpos somado: DORMENTE desde o roster do audit 2026-07-07 (o
// 'chaotic' saiu do jogo). O integrador velocity-Verlet (orbits.js) e este
// regime ficam como capacidade testada — um sistema futuro só precisa usar
// NBodyDynamic e registrar a chave aqui.
const DYNAMIC_SYSTEMS = new Set([]);

function _accelOf(b, dist) {
  const r = Math.max(dist, b.def.radius * 0.85);
  // Paczyński–Wiita p/ compactos (P2-5): ISCO real em 3·r_s + mergulho abaixo.
  if (_isCompact(b.def)) return pwAccel(b.mu, r, _rsOf(b.def));
  return b.mu / (r * r);
}

const _partnerPull = new THREE.Vector3();
const _tmp = new THREE.Vector3();
const _rel = new THREE.Vector3();

export function computeGravity(pos, out, shipVel = null) {
  out.set(0, 0, 0);

  // 1) Dominante hierárquico = menor SOI que contém a nave.
  let dominant = null, domSoi = Infinity, domDist = 0;
  for (const b of game.bodies) {
    const dist = b.worldPos.distanceTo(pos);
    if (dist < b.soi && b.soi < domSoi) { dominant = b; domSoi = b.soi; domDist = dist; }
  }

  // 2) Vazio interestelar: maior aceleração real domina; flag libera overdrive.
  let interstellar = false;
  if (!dominant) {
    interstellar = true;
    let bestA = 0;
    for (const b of game.bodies) {
      const dist = b.worldPos.distanceTo(pos);
      const a = _accelOf(b, dist);
      if (a > bestA) { bestA = a; dominant = b; domDist = dist; }
    }
    if (!dominant) {
      return {
        dominant: null, gravMag: 0, noReturn: false, dist: Infinity, altitude: Infinity,
        escapeVel: 0, circVel: 0, canEscape: true, pull: out, interstellar: true,
        vTangential: shipVel ? shipVel.length() : 0, vRadial: 0,
      };
    }
  }

  let gravMag;

  if (DYNAMIC_SYSTEMS.has(dominant.system)) {
    // 3) Sistema CAÓTICO: soma de TODOS os corpos do sistema (estrelas + planetas
    //    + âncora). Dominante do HUD = maior contribuição individual.
    const sysKey = dominant.system;
    let bestA = 0;
    for (const b of game.bodies) {
      if (b.system !== sysKey) continue;
      const dist = b.worldPos.distanceTo(pos);
      const a = _accelOf(b, dist);
      _tmp.copy(b.worldPos).sub(pos).multiplyScalar(a / Math.max(dist, 1e-6));
      out.add(_tmp);
      if (a > bestA) { bestA = a; dominant = b; domDist = dist; }
    }
    gravMag = out.length();
  } else {
    // 4) Hierárquico / binário — TODO corpo puxa (operador 2026-07-02): dominante
    //    com força plena + PERTURBAÇÃO DE MARÉ de cada outro corpo próximo do
    //    mesmo sistema: puxão_no_ponto_da_nave − puxão_no_dominante. É a física
    //    real de N corpos no frame patched-conics: perto de qualquer lua/planeta
    //    /estrela o puxão DELE emerge continuamente na aproximação, e órbitas
    //    fechadas em volta do dominante continuam fechando (a maré é o resíduo
    //    físico de verdade). Forma de maré, e não soma direta, porque os trilhos
    //    são comprimidos (não keplerianos vs μ da primária) — somar direto
    //    arrancaria a nave de qualquer órbita.
    if (dominant.binaryPair) {
      // no par, o membro que puxa mais forte é o dominante do HUD/órbita
      for (const b of game.bodies) {
        if (b !== dominant && b.binaryPair) {
          const distP = b.worldPos.distanceTo(pos);
          if (_accelOf(b, distP) > _accelOf(dominant, domDist)) { dominant = b; domDist = distP; }
          break;
        }
      }
    }
    const a = _accelOf(dominant, domDist);
    out.copy(dominant.worldPos).sub(pos).multiplyScalar(a / Math.max(domDist, 1e-6));
    for (const b of game.bodies) {
      if (b === dominant || b.system !== dominant.system) continue;
      const dist = b.worldPos.distanceTo(pos);
      if (dist > (b.gravReach || b.soi * 4)) continue;      // longe demais p/ importar
      const aS = _accelOf(b, dist);
      _tmp.copy(b.worldPos).sub(pos).multiplyScalar(aS / Math.max(dist, 1e-6));
      out.add(_tmp);                                        // puxão no ponto da nave…
      const dDom = b.worldPos.distanceTo(dominant.worldPos);
      const aD = _accelOf(b, dDom);
      _partnerPull.copy(b.worldPos).sub(dominant.worldPos)
        .multiplyScalar(-aD / Math.max(dDom, 1e-6));
      out.add(_partnerPull);                                // …menos o puxão no dominante
    }
    gravMag = out.length();
    // ACELERAÇÃO DE FRAME (patched-conics honesto): o corpo dominante ACELERA
    // (trilho ao redor da sua estrela). A nave cai JUNTO com ele — sem isto a
    // órbita relativa fica excêntrica e deriva. Com isto, Kepler puro no frame
    // do corpo → a órbita fecha REDONDA (não conta no gravMag do HUD).
    // POLISH (audit T-PR-09): BLEND na borda do SOI — a aceleração de frame
    // desvanece nos 10% externos em vez de ligar num degrau (era o "kink"
    // visível nas trilhas das traçadoras ao cruzar fronteiras de SOI).
    if (!interstellar && dominant.worldAcc) {
      const tEdge = Math.max(0, Math.min(1, (domDist / Math.max(domSoi, 1) - 0.90) / 0.10));
      const w = 1 - tEdge * tEdge * (3 - 2 * tEdge);
      out.addScaledVector(dominant.worldAcc, w);
    }
  }

  // POÇOS GRAVITACIONAIS TRANSIENTES (bomba de Higgs, D-2): perturbação ADITIVA
  // sem SOI própria — nave, projéteis e plasma sentem o MESMO poço. Nunca vira
  // `dominant` (HUD estável); entra no gravMag (portões de overdrive/aviso).
  if (game.wells && game.wells.length) {
    for (const w of game.wells) {
      if (game.time > w.until) continue;                 // limpeza em updateProjectiles
      _tmp.copy(w.pos).sub(pos);
      const dW = _tmp.length();
      // Perfil REAL do poço (audit P0-2): Plummer com pico=cap no núcleo, queda
      // ~1/d² além de `soft` e taper a 0 em `reach` — sem o platô de força
      // constante de ~29k u do min(μ/d², cap) antigo, e sem alcance infinito
      // (o poço é uma arma LOCAL; não perturba o outro lado do sistema nem o
      // solver balístico). physics.higgsWellAccel é puro e unit-testado.
      const aW = higgsWellAccel(dW, w);
      if (aW > 0) {
        out.addScaledVector(_tmp.normalize(), aW);
        gravMag += aW;
      }
    }
  }

  const surf = dominant.def.radius;
  const r = Math.max(domDist, surf * 0.85);
  // HUD honesto perto de compactos: v_circ/v_esc do potencial PW (divergem no r_s).
  const compact = _isCompact(dominant.def);
  const circVel = compact ? pwCircularSpeed(dominant.mu, r, _rsOf(dominant.def))
    : Math.sqrt(dominant.mu / r);
  const escapeVel = compact ? pwEscapeSpeed(dominant.mu, r, _rsOf(dominant.def))
    : circVel * Math.SQRT2;
  const canEscape = MAX_ESCAPE_SPEED > escapeVel * 1.05;
  const noReturn = !canEscape;

  // Decomposição da velocidade da nave vs o dominante — no FRAME CO-MÓVEL do
  // corpo (planetas em trilho se MOVEM; órbita é relativa a ELE, não ao mundo).
  let vTangential = 0, vRadial = 0;
  if (shipVel) {
    _rel.copy(shipVel);
    if (dominant.worldVel) _rel.sub(dominant.worldVel);
    _tmp.copy(pos).sub(dominant.worldPos).normalize();     // r̂ (do corpo → nave)
    vRadial = _rel.dot(_tmp);                              // >0 = subindo
    vTangential = Math.sqrt(Math.max(0, _rel.lengthSq() - vRadial * vRadial));
  }

  return {
    dominant, gravMag, noReturn, dist: domDist, altitude: domDist - surf,
    escapeVel, circVel, canEscape, pull: out, interstellar,
    vTangential, vRadial,
  };
}

// Detecta colisão / contato com a superfície (ou horizonte) do corpo mais próximo.
export function surfaceContact(pos, margin = 0) {
  for (const b of game.bodies) {
    const d = b.worldPos.distanceTo(pos);
    if (d < b.def.radius + margin) return { body: b, depth: b.def.radius + margin - d };
  }
  return null;
}
