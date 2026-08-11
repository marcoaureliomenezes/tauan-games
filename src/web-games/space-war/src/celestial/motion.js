// celestial/motion.js — Componentes de MOVIMENTO plugáveis (composição, não herança:
// qualquer corpo × qualquer regime — decisão D-1 do SPEC).
//
// Cada componente apenas SETA o subconjunto de campos que orbits.js já consome —
// os regimes do integrador ficam intocados (AC-05). Mapeamento 1:1:
//   Pinned      → regime 5 (primária pinada; spin axial via isSun)
//   KeplerRail  → regime 2 (trilho circular: orbitCenter+orbit+period+angle)
//   MoonRail    → regime 3 (lua: isMoon+parent+orbit+period±retrograde)
//   EllipseRail → regime 1b (elipse kepleriana: r(θ)=p/(1+e·cosθ))
//   BinaryPair  → regime 1 (par em torno do baricentro)
//   NBodyDynamic→ regime 4 (velocity-Verlet do enxame caótico)

import * as THREE from '../../../vendor/three.module.min.js';
import { game } from '../state.js';

// ── Primária pinada num ponto fixo (Sol, Betelgeuse, SMBH) ──────────────────
export class Pinned {
  constructor(center, { isSun = true } = {}) { this.center = center; this.isSun = isSun; }
  attach(body) {
    body.worldPos.copy(this.center);
    body.isSun = this.isSun;       // orbits regime 5: rotação axial da primária
    body.orbitCenter = null;
    body.parent = null;
  }
}

// ── Trilho circular kepleriano em torno de um centro ────────────────────────
export class KeplerRail {
  /** @param {THREE.Vector3} center @param {{orbit:number, period?:number, periodFactor?:number, angle0?:number}} o */
  constructor(center, o) { this.center = center; this.o = o; }
  attach(body) {
    body.orbitCenter = this.center;
    body.orbit = this.o.orbit;
    // period=null + def.periodFactor → orbits.initOrbits deriva EARTH_YEAR·factor
    body.period = this.o.period ?? null;
    if (this.o.periodFactor != null) body.def.periodFactor = this.o.periodFactor;
    if (this.o.angle0 != null) body.angle = this.o.angle0;
  }
}

// ── Lua em torno do pai (dinâmico: segue o worldPos do pai) ─────────────────
export class MoonRail {
  constructor(parent, { orbit, period, retrograde = false }) {
    this.parent = parent; this.orbit = orbit; this.period = period; this.retrograde = retrograde;
  }
  attach(body) {
    body.isMoon = true;
    body.parent = this.parent;
    body.orbit = this.orbit;
    body.period = this.period;
    body.retrograde = this.retrograde;
    body.orbitCenter = null;
    this.parent.moons.push(body);
  }
}

// ── Trilho ELÍPTICO kepleriano (estrelas S do núcleo, errantes, COMETAS) ─────
// Mesma matemática do antigo bodies.makeEllipse: plano orbital (nodo+inclinação),
// base ortonormal u,v, p=a(1−e²), h=√(μp); orbits.js avança θ̇=h/r².
export class EllipseRail {
  /** @param {THREE.Vector3} center @param {{mu:number,a:number,e:number,incl?:number,node?:number,theta0?:number,dir?:1|-1}} o */
  constructor(center, o) { this.center = center; this.o = o; }
  attach(body) {
    const { mu, a, e, incl = 0, node = 0, theta0 = Math.random() * Math.PI * 2, dir = 1 } = this.o;
    const u = new THREE.Vector3(Math.cos(node), 0, Math.sin(node));
    const v = new THREE.Vector3(-Math.sin(node), 0, Math.cos(node))
      .multiplyScalar(Math.cos(incl))
      .add(new THREE.Vector3(0, Math.sin(incl), 0))
      .normalize();
    const p = a * (1 - e * e);
    body.ellipse = { center: this.center, u, v, p, e, h: Math.sqrt(mu * p), mu, theta: theta0, dir };
    body.orbitCenter = null;
    EllipseRail.positionOf(body.ellipse, body.worldPos);
  }
  static positionOf(el, out) {
    const r = el.p / (1 + el.e * Math.cos(el.theta));
    return out.copy(el.center)
      .addScaledVector(el.u, Math.cos(el.theta) * r)
      .addScaledVector(el.v, Math.sin(el.theta) * r);
  }
}

// ── Par binário em torno do baricentro (trilho circular consistente c/ Kepler) ──
export class BinaryPair {
  /** @param {THREE.Vector3} barycenter @param {{pairRadius:number, period:number, phase?:number}} o */
  constructor(barycenter, o) { this.barycenter = barycenter; this.o = o; }
  attach(body) {
    body.binaryPair = true;
    body.barycenter = this.barycenter;
    body.pairRadius = this.o.pairRadius;
    body.pairPhase = this.o.phase ?? 0;
    body.period = this.o.period;
    body.orbitCenter = null;
    body.worldPos.set(
      this.barycenter.x + Math.cos(body.pairPhase) * body.pairRadius,
      this.barycenter.y,
      this.barycenter.z + Math.sin(body.pairPhase) * body.pairRadius,
    );
  }
}

// ── Corpo dinâmico integrado por N-corpos (sistema caótico) ─────────────────
export class NBodyDynamic {
  /** @param {{pos:THREE.Vector3, vel:THREE.Vector3, softening:number, systemDef:object,
   *            centralMu:number, reinjectR:number, anchor?:object}} o */
  constructor(o) { this.o = o; }
  attach(body) {
    body.dynamic = true;
    body.orbitCenter = null;
    if (this.o.pos) body.worldPos.copy(this.o.pos);
    body.vel = this.o.vel.clone();
    body.acc = new THREE.Vector3();
    body.softening = this.o.softening;
    body.anchor = this.o.anchor || null;
    body.systemDef = this.o.systemDef;
    body.centralMu = this.o.centralMu;
    body.reinjectR = this.o.reinjectR;
    body.spin = body.def.spin || 0;
    game.dynBodies = game.dynBodies || [];
    game.dynBodies.push(body);
  }
}
