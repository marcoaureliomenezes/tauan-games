// celestial/planets.js — Componentes não-estelares: Planet, Moon e Comet (AC-04).
//
// Planet reproduz o ex-buildPlanetBody (textura procedural por kind, atmosfera
// fresnel, anéis, luas); Moon o ex-corpo de lua; Comet é NOVO (AC-09): núcleo
// rochoso + coma + cauda ANTI-SOLAR cujo comprimento cresce perto do periélio.

import * as THREE from '../../../vendor/three.module.min.js';
import { CelestialBody } from './body.js';
import { MoonRail } from './motion.js';
import { planetTexture, makeSphere, atmosphere, ringMesh, makeRadialSprite } from './atoms.js';
import { muFromEarthMasses } from './physics.js';

export class Planet extends CelestialBody {
  /**
   * @param {object} p — { name, key, kind: rock|gas|ice|earth|cloud, radius,
   *   color, color2, mass (M⊕) | mu, soi, spin, tilt?, atmosphere?|hasAtmo?,
   *   ring?{inner,outer,color,tilt}, redspot?, moons?[] }
   */
  constructor(p) {
    super({ kind: 'rock', ...p, mu: p.mu ?? muFromEarthMasses(p.mass ?? 1) });
  }

  buildVisual() {
    const def = this.def;
    const group = new THREE.Group();
    const tex = planetTexture(def);
    const mesh = makeSphere(def.radius, tex, false, def);
    mesh.rotation.z = def.tilt || 0;
    group.add(mesh);
    if (def.hasAtmo || def.atmosphere) group.add(atmosphere(def.radius, def.atmosphere || 0x6fb6ff));
    if (def.ring) group.add(ringMesh(def.ring));
    this.group = group;
    this.mesh = mesh;
  }

  // Materializa o planeta e as luas declaradas em def.moons (cada uma vira um
  // Moon componente em MoonRail — o rail segue o worldPos do pai dinamicamente).
  register(systemKey) {
    super.register(systemKey);
    for (const m of (this.def.moons || [])) {
      new Moon(m)
        .withMotion(new MoonRail(this, { orbit: m.orbit, period: m.period, retrograde: !!m.retrograde }))
        .register(systemKey);
    }
    return this;
  }
}

export class Moon extends CelestialBody {
  constructor(p) {
    super({ kind: 'rock', ...p, mu: p.mu ?? muFromEarthMasses(p.mass ?? 0.01) });
  }
  buildVisual() {
    const def = this.def;
    const group = new THREE.Group();
    // Paridade com o ex-buildPlanetBody: textura de rocha com color2 = color.
    const tex = planetTexture({ ...def, kind: 'rock', color2: def.color });
    const mesh = makeSphere(def.radius, tex, false, { kind: 'rock' });
    group.add(mesh);
    this.group = group;
    this.mesh = mesh;
  }
}

// ── Cometa (NOVO — AC-09) ────────────────────────────────────────────────────
// Núcleo rochoso pequeno + COMA (sprite radial esverdeado-azulado) + CAUDA de íons
// apontando SEMPRE para longe da primária, comprimento ∝ (r_peri/r)² — de longe é
// um risco tênue; no periélio vira um rastro dramático.
export class Comet extends CelestialBody {
  /**
   * @param {object} p — { name, key, radius, mass?|mu?, soi?, spin?,
   *   primary: CelestialBody|THREE.Vector3 (fonte da direção anti-solar),
   *   rPeri: number (periélio, para a escala da cauda),
   *   tailMax?: number (comprimento máx. da cauda no periélio) }
   */
  constructor(p) {
    super({
      kind: 'comet',
      color: 0xbfd8d0, color2: 0x6a7a74,
      soi: p.soi ?? Math.max(300, (p.radius ?? 40) * 4),
      spin: p.spin ?? 30,
      ...p,
      mu: p.mu ?? muFromEarthMasses(p.mass ?? 1e-6),
    });
  }

  buildVisual() {
    const def = this.def;
    const group = new THREE.Group();

    // Núcleo: rocha suja pequena.
    const tex = planetTexture({ ...def, kind: 'rock', color2: def.color2 });
    const nucleus = makeSphere(def.radius, tex, false, { kind: 'rock' });
    group.add(nucleus);

    // COMA: halo esverdeado (C2) com miolo branco.
    const coma = makeRadialSprite(['rgba(235,255,245,0.85)', 'rgba(150,230,200,0.28)', 'rgba(80,160,140,0.08)', 'rgba(0,0,0,0)']);
    coma.scale.setScalar(def.radius * 6);
    group.add(coma);

    // CAUDA de íons: cone aditivo azulado, orientado por-frame para o anti-solar.
    // (cilindro/cone aditivo, NUNCA sprite aditivo — gotcha NaN c/ log-depth+bloom)
    const tailMat = new THREE.MeshBasicMaterial({
      color: 0xaee8ff, transparent: true, opacity: 0.22,
      blending: THREE.AdditiveBlending, side: THREE.DoubleSide, depthWrite: false,
    });
    // Cone unitário (altura 1, apontando +Y): escala/orientação por-frame.
    const tail = new THREE.Mesh(new THREE.ConeGeometry(def.radius * 1.6, 1, 10, 1, true), tailMat);
    group.add(tail);
    // Cauda de POEIRA: mais curta, amarelada, levemente defasada (curvatura fake).
    const dustMat = new THREE.MeshBasicMaterial({
      color: 0xf0e0b8, transparent: true, opacity: 0.13,
      blending: THREE.AdditiveBlending, side: THREE.DoubleSide, depthWrite: false,
    });
    const dust = new THREE.Mesh(new THREE.ConeGeometry(def.radius * 2.4, 1, 10, 1, true), dustMat);
    group.add(dust);

    const primary = def.primary;
    const rPeri = def.rPeri || 30000;
    const tailMax = def.tailMax || 24000;
    const _dir = new THREE.Vector3();
    const _up = new THREE.Vector3(0, 1, 0);
    const _dustDir = new THREE.Vector3();
    const body = this;

    this.group = group;
    this.mesh = nucleus;
    this.fx = { t: 0, update(dt) {
      this.t += dt;
      const src = primary && primary.worldPos ? primary.worldPos : primary;
      if (!src) return;
      _dir.copy(body.worldPos).sub(src);
      const r = Math.max(_dir.length(), 1);
      _dir.multiplyScalar(1 / r);                       // anti-solar unitário
      const near = Math.min(1, (rPeri / r) * (rPeri / r));
      const len = Math.max(def.radius * 4, tailMax * near);
      // cone aponta +Y → alinhar +Y ao anti-solar; base no núcleo, ponta longe
      tail.scale.set(1, len, 1);
      tail.position.copy(_dir).multiplyScalar(len * 0.5);
      tail.quaternion.setFromUnitVectors(_up, _dir);
      tailMat.opacity = 0.06 + 0.20 * near;
      // poeira: 55% do comprimento, direção levemente girada (curvatura)
      _dustDir.copy(_dir).applyAxisAngle(_up, 0.18).normalize();
      const dlen = len * 0.55;
      dust.scale.set(1, dlen, 1);
      dust.position.copy(_dustDir).multiplyScalar(dlen * 0.5);
      dust.quaternion.setFromUnitVectors(_up, _dustDir);
      dustMat.opacity = 0.04 + 0.12 * near;
      // coma respira com a proximidade
      coma.scale.setScalar(def.radius * (5 + 7 * near));
    } };
  }
}
