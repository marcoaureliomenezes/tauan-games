// celestial/stars.js — A hierarquia estelar da taxonomia NASA (AC-02).
// Referência: https://science.nasa.gov/universe/stars/types/
//
//   Star (superclasse: fotosfera FBM + corona + luz; defaults derivados da MASSA)
//   ├─ MainSequenceStar  — 0.08–200 M☉; massa → cor/raio (0.2 M☉ É uma anã vermelha)
//   ├─ RedGiant          — <8 M☉ evoluída: inflada, laranja, PULSA (NASA: instável)
//   ├─ RedSupergiant     — Betelgeuse: células gigantes, limbo assimétrico, poeira+pluma
//   ├─ WhiteDwarf        — remanescente do tamanho da Terra, azul-branco, sem fusão
//   ├─ BrownDwarf        — 13–80 M♃: "quase estrela", quase nenhuma luz visível
//   ├─ NeutronStar       — 8–20 M☉ pós-supernova: pulsar (toro síncrotron, jatos, farol)
//   └─ BlackHole         — >20 M☉ (ou SMBH): horizonte, anel de fótons, disco, lente, jato
//
// Refinar o visual de um TIPO aqui propaga para TODAS as instâncias (AC-06).

import * as THREE from '../../../vendor/three.module.min.js';
import { Lensflare, LensflareElement } from '../../../vendor/jsm/objects/Lensflare.js';
import { camera } from '../scene.js';
import { CelestialBody } from './body.js';
import {
  HEADLESS, starMaterial, makeRadialSprite, flareTexture,
  diskMaterial, DISK_SYNCHROTRON,
} from './atoms.js';
import { muFromSolarMasses, solarMassesFromMu, spectralFromMass, radiusFromMass } from './physics.js';

// ── Superclasse ──────────────────────────────────────────────────────────────
export class Star extends CelestialBody {
  /**
   * @param {object} p — no mínimo { name, key, mass } (M☉). A massa deriva
   * μ, cor espectral, cellScale e raio; QUALQUER default pode ser sobrescrito
   * (color, radius, mu, soi, cellScale, lumpyLimb, coronaScale, light{…,flare}).
   */
  constructor(p) {
    const mass = p.mass ?? (p.mu != null ? solarMassesFromMu(p.mu) : 1);
    const spec = spectralFromMass(mass);
    const radius = p.radius ?? radiusFromMass(mass);
    super({
      kind: 'star',
      color: spec.color,
      color2: spec.color2,
      cellScale: spec.cellScale,
      soi: p.soi ?? radius * 3,
      ...p,
      radius,
      mu: p.mu ?? muFromSolarMasses(mass),
      mass,
    });
  }

  // Fotosfera (shader de convecção) + corona + luz opcional — ex-buildStar.
  buildVisual() {
    const def = this.def;
    const group = new THREE.Group();
    const seg = HEADLESS ? 24 : (def.radius > 20000 ? 128 : def.radius > 3000 ? 96 : 64);
    const mat = starMaterial(def);
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(def.radius, seg, Math.floor(seg * 0.66)), mat);
    group.add(mesh);
    const c = new THREE.Color(def.color);
    const corona = makeRadialSprite([
      `rgba(${(c.r * 255) | 0},${(c.g * 255) | 0},${(c.b * 255) | 0},0.55)`,
      `rgba(${(c.r * 255) | 0},${(c.g * 200) | 0},${(c.b * 160) | 0},0.20)`,
      'rgba(0,0,0,0)',
    ]);
    corona.scale.setScalar(def.radius * (def.coronaScale ?? 4.2));
    group.add(corona);
    if (def.light) {
      const pl = new THREE.PointLight(def.light.color, def.light.intensity ?? 3.0, def.light.range ?? 1_000_000, 0.0);
      group.add(pl);
      if (def.light.flare && !HEADLESS) {
        const flare = new Lensflare();
        flare.addElement(new LensflareElement(flareTexture(true), 640, 0, new THREE.Color(0xfff0c8)));
        flare.addElement(new LensflareElement(flareTexture(false), 110, 0.55, new THREE.Color(0xffd9a0)));
        flare.addElement(new LensflareElement(flareTexture(false), 60, 0.85, new THREE.Color(0xaac8ff)));
        flare.addElement(new LensflareElement(flareTexture(false), 150, 1.2, new THREE.Color(0xff9a70)));
        pl.add(flare);
      }
    }
    this.group = group;
    this.mesh = mesh;
    this.corona = corona;
    this.fx = { t: 0, update(dt) {
      this.t += dt;
      mat.uniforms.uTime.value += dt;
      corona.material.opacity = 0.75 + Math.sin(this.t * 0.9) * 0.12;
    } };
  }
}

// ── Main sequence: a classe "pura por massa" (AC-03) ─────────────────────────
// 0.2 M☉ nasce anã vermelha (laranja-avermelhada, pequena, células largas);
// 15 M☉ nasce azul-branca gigante — tudo derivado, nada hand-tuned.
export class MainSequenceStar extends Star {}

// ── Gigante vermelha: <8 M☉ que esgotou o hidrogênio do núcleo ───────────────
// NASA: "unstable and begins pulsating" — a fotosfera pulsa devagar.
export class RedGiant extends Star {
  constructor(p) {
    super({
      kind: 'redgiant',
      color: 0xff9a52, color2: 0x8a2d0c,   // laranja (gigantes parecem laranja, não vermelho)
      cellScale: 3.2,                      // células grandes (convecção profunda)
      lumpyLimb: 0.02,
      coronaScale: 4.6,
      radius: p.radius ?? radiusFromMass(p.mass ?? 1) * 4.5,   // inflada vs main sequence
      ...p,
    });
  }
  buildVisual() {
    super.buildVisual();
    const mesh = this.mesh;
    const base = this.fx;
    this.fx = { t: 0, update(dt) {
      base.update(dt);
      this.t += dt;
      // pulsação radial sutil (período ~20 s de jogo) — a instabilidade da NASA
      mesh.scale.setScalar(1 + Math.sin(this.t * 0.31) * 0.018);
    } };
  }
}

// ── Supergigante vermelha: o tipo da Betelgeuse ──────────────────────────────
// Células de convecção GIGANTES (2-4 no disco), silhueta assimétrica (ALMA),
// envelope de poeira + pluma unilateral — características do tipo, não do sistema.
export class RedSupergiant extends Star {
  constructor(p) {
    super({
      kind: 'redsupergiant',
      cellScale: 1.8,
      lumpyLimb: 0.045,
      coronaScale: 3.6,
      dust: true,
      ...p,
    });
  }
  buildVisual() {
    super.buildVisual();
    const def = this.def;
    if (def.dust) {
      // Envelope de poeira ENORME e tênue (tijolo dessaturado) + pluma unilateral
      const dust = makeRadialSprite(['rgba(140,74,47,0.10)', 'rgba(110,55,35,0.05)', 'rgba(0,0,0,0)']);
      dust.scale.setScalar(def.radius * 9);
      this.group.add(dust);
      const plume = makeRadialSprite(['rgba(255,154,77,0.16)', 'rgba(180,80,40,0.07)', 'rgba(0,0,0,0)']);
      plume.scale.set(def.radius * 4.2, def.radius * 2.2, 1);
      plume.position.set(def.radius * 2.4, def.radius * 1.1, 0);
      this.group.add(plume);
    }
  }
}

// ── Anã branca: remanescente <8 M☉ — pequena, densa, azul-branca, sem fusão ──
export class WhiteDwarf extends Star {
  constructor(p) {
    super({
      kind: 'whitedwarf',
      color: 0xeaf2ff, color2: 0x9db4e8,
      cellScale: 16,                        // superfície lisa (sem convecção violenta)
      coronaScale: 7,                       // glint pontual — brilha além do tamanho
      radius: p.radius ?? 900,              // "do tamanho da Terra" na escala do jogo
      ...p,
    });
  }
}

// ── Anã marrom: 13–80 M♃ — "não é tecnicamente uma estrela" ─────────────────
// Quase nenhuma luz visível: fotosfera escura magenta-marrom, corona mínima, sem luz.
export class BrownDwarf extends Star {
  constructor(p) {
    super({
      kind: 'browndwarf',
      color: 0x8a4a52, color2: 0x2e1a20,
      cellScale: 8,
      coronaScale: 2.2,
      radius: p.radius ?? 1400,
      ...p,
      light: null,                          // não emite luz relevante
    });
  }
}

// ── Estrela de nêutrons (pulsar): remanescente 8–20 M☉ ───────────────────────
// Anatomia Crab: núcleo COMPACTO ofuscante, toro de vento síncrotron, jatos-agulha,
// gaiola dipolo tênue e o FAROL (flash quando o feixe varre a câmera).
function dipoleFieldLine(L, phi, radius) {
  // Linha de campo dipolo clássica: r(θ) = L·sin²θ, do polo norte ao polo sul.
  const pts = [];
  for (let i = 0; i <= 40; i++) {
    const th = 0.35 + (i / 40) * (Math.PI - 0.7);
    const r = Math.max(radius * 1.1, L * Math.sin(th) * Math.sin(th));
    pts.push(new THREE.Vector3(
      r * Math.sin(th) * Math.cos(phi),
      r * Math.cos(th),
      r * Math.sin(th) * Math.sin(phi),
    ));
  }
  const curve = new THREE.CatmullRomCurve3(pts);
  return new THREE.Mesh(
    new THREE.TubeGeometry(curve, 40, radius * 0.06, 5, false),
    new THREE.MeshBasicMaterial({ color: 0x86b4ff, transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false }),
  );
}

export class NeutronStar extends Star {
  constructor(p) {
    super({
      kind: 'neutron',
      color: 0x000000,      // paridade: o visual do pulsar não usa cor espectral
      spin: 1.4,            // pulsar ultrarrápido por default
      jetTilt: 0.5,
      ...p,
    });
  }
  buildVisual() {
    const def = this.def;
    const group = new THREE.Group();

    // Luz azul-branca do pulsar (ilumina os vizinhos do sistema), quando pedida.
    if (def.light) {
      group.add(new THREE.PointLight(def.light.color, def.light.intensity ?? 3.0, def.light.range ?? 900_000, 0.0));
    }

    // Núcleo: pequeno, branco-azulado, BRILHANTE (satura via bloom, não via sprite).
    const core = new THREE.Mesh(
      new THREE.SphereGeometry(def.radius, 48, 32),
      new THREE.MeshBasicMaterial({ color: 0xf4f8ff }),
    );
    group.add(core);
    // Brilho pontual curto (gradiente que MORRE cedo)
    const glint = makeRadialSprite(['rgba(235,244,255,0.85)', 'rgba(160,200,255,0.15)', 'rgba(0,0,0,0)']);
    glint.scale.setScalar(def.radius * 2.6);
    group.add(glint);

    // Eixo magnético (inclinado vs rotação) → jatos + toro carregados por ele.
    const axis = new THREE.Group();
    axis.rotation.z = def.jetTilt;
    group.add(axis);

    // TORO DE VENTO síncrotron (equatorial ao eixo magnético).
    const torusMat = diskMaterial(def.radius * 3.2, def.radius * 14, 0.85, DISK_SYNCHROTRON);
    const torus = new THREE.Mesh(
      new THREE.RingGeometry(def.radius * 3.2, def.radius * 14, 96, 3),
      torusMat,
    );
    torus.rotation.x = Math.PI / 2;
    axis.add(torus);

    // JATOS relativísticos: AGULHAS de luz finas e longas.
    const jetLen = def.radius * 150;
    const jetMats = [];
    for (const s of [1, -1]) {
      const outer = new THREE.Mesh(
        new THREE.CylinderGeometry(def.radius * 0.50, def.radius * 0.16, jetLen, 10, 1, true),
        new THREE.MeshBasicMaterial({ color: 0x9fd0ff, transparent: true, opacity: 0.18, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, depthWrite: false }),
      );
      outer.position.y = s * jetLen / 2;
      outer.rotation.x = s > 0 ? 0 : Math.PI;
      axis.add(outer);
      const inner = new THREE.Mesh(
        new THREE.CylinderGeometry(def.radius * 0.16, def.radius * 0.06, jetLen * 1.06, 8, 1, true),
        new THREE.MeshBasicMaterial({ color: 0xeaf4ff, transparent: true, opacity: 0.75, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, depthWrite: false }),
      );
      inner.position.y = s * jetLen * 0.53;
      inner.rotation.x = s > 0 ? 0 : Math.PI;
      axis.add(inner);
      jetMats.push(outer.material, inner.material);
    }

    // Gaiola dipolo: poucas linhas, bem tênues (estrutura, não neon).
    for (let i = 0; i < 6; i++) {
      const phi = (i / 6) * Math.PI * 2;
      const line = dipoleFieldLine(def.radius * 6.5, phi, def.radius);
      line.material.opacity = 0.09;
      axis.add(line);
    }

    const _jetDir = new THREE.Vector3();
    const _toCam = new THREE.Vector3();
    this.group = group;
    this.mesh = core;
    this.fx = { t: 0, update(dt) {
      this.t += dt;
      // rotação ultrarrápida do pulsar (jatos + toro varrem o céu)
      group.rotation.y += dt * (Math.PI * 2 / def.spin);
      torusMat.uniforms.uTime.value = this.t;
      // cintilação dos jatos
      const flick = 0.85 + 0.15 * Math.sin(this.t * 37.3);
      jetMats[0].opacity = 0.18 * flick; jetMats[1].opacity = 0.75 * flick;
      jetMats[2].opacity = 0.18 * flick; jetMats[3].opacity = 0.75 * flick;
      // FAROL: flash curto e intenso quando o feixe cruza a câmera
      _jetDir.set(0, 1, 0).applyQuaternion(group.quaternion).applyQuaternion(axis.quaternion);
      _toCam.copy(camera.position).sub(group.position).normalize();
      const sweep = Math.pow(Math.abs(_jetDir.dot(_toCam)), 24);
      glint.material.opacity = Math.min(0.95, 0.5 + sweep * 0.45);
      glint.scale.setScalar(def.radius * (2.6 + sweep * 2.2));
      core.material.color.setRGB(0.92 + sweep * 0.08, 0.95 + sweep * 0.05, 1.0);
    } };
  }
}

// ── Buraco negro: >20 M☉ (estelar) ou SMBH ───────────────────────────────────
// Horizonte absoluto + anel de fótons + disco com rotação diferencial/Doppler +
// "monte" lenseado billboard (look Interstellar) + jato bipolar opcional (M87*).
export class BlackHole extends Star {
  constructor(p) {
    const rs = p.rs ?? p.radius;
    super({
      kind: 'blackhole',
      color: 0x000000,           // paridade: BH não herda cor espectral (mapa/ícones)
      ...p,
      rs,
      radius: p.radius ?? rs,
      light: null,               // engole luz — não emite
    });
  }
  buildVisual() {
    const def = this.def;
    const group = new THREE.Group();

    // Horizonte de eventos: esfera preta absoluta (engole a luz).
    const horizon = new THREE.Mesh(
      new THREE.SphereGeometry(def.rs, 48, 32),
      new THREE.MeshBasicMaterial({ color: 0x000000 }),
    );
    group.add(horizon);

    // ANEL DE FÓTONS: UM aro FINO e ofuscante cravado na borda da sombra.
    const photonRing = def.photonRing ?? def.rs * 1.34;
    const photon = new THREE.Mesh(
      new THREE.TorusGeometry(photonRing, def.rs * 0.020, 10, 96),
      new THREE.MeshBasicMaterial({ color: 0xfffdf2, transparent: true, opacity: 1.0, blending: THREE.AdditiveBlending, depthWrite: false }),
    );
    photon.rotation.x = Math.PI / 2;
    group.add(photon);
    const photon2 = new THREE.Mesh(
      new THREE.TorusGeometry(photonRing * 1.22, def.rs * 0.011, 8, 96),
      new THREE.MeshBasicMaterial({ color: 0xffe9c0, transparent: true, opacity: 0.4, blending: THREE.AdditiveBlending, depthWrite: false }),
    );
    photon2.rotation.x = Math.PI / 2;
    group.add(photon2);

    // Disco de acreção plano (shader) — levemente inclinado.
    const disk0 = def.disk ?? { inner: def.rs * 2.1, outer: def.rs * 20 };
    const diskMat = diskMaterial(disk0.inner, disk0.outer, 1.0);
    const disk = new THREE.Mesh(new THREE.RingGeometry(disk0.inner, disk0.outer, 160, 4), diskMat);
    disk.rotation.x = Math.PI / 2 + 0.18;
    group.add(disk);

    // "MONTE" LENSEADO billboard: a imagem do lado distante do disco curvada
    // por cima/por baixo da sombra — ganho modulado por quão de-quina estamos.
    const lensMat = diskMaterial(def.rs * 1.4, def.rs * 2.8, 0.6);
    const lens = new THREE.Mesh(new THREE.RingGeometry(def.rs * 1.4, def.rs * 2.8, 96, 2), lensMat);
    group.add(lens);

    // JATO RELATIVÍSTICO bipolar (M87*) — apenas quando o def pede (SMBH).
    // Cilindros aditivos (não sprites — sprite aditivo + log-depth + bloom = NaN).
    const jetGroup = new THREE.Group();
    jetGroup.rotation.x = 0.18;                    // alinhado ao eixo do disco
    if (def.jet) {
      const jl = def.rs * 34;
      for (const s of [1, -1]) {
        const outer = new THREE.Mesh(
          new THREE.CylinderGeometry(def.rs * 0.55, def.rs * 0.16, jl, 10, 1, true),
          new THREE.MeshBasicMaterial({ color: 0xbfd8ff, transparent: true, opacity: 0.10, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, depthWrite: false }),
        );
        outer.position.y = s * jl / 2;
        outer.rotation.x = s > 0 ? 0 : Math.PI;
        jetGroup.add(outer);
        const inner = new THREE.Mesh(
          new THREE.CylinderGeometry(def.rs * 0.18, def.rs * 0.06, jl * 1.05, 8, 1, true),
          new THREE.MeshBasicMaterial({ color: 0xf0f7ff, transparent: true, opacity: 0.30, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, depthWrite: false }),
        );
        inner.position.y = s * jl * 0.525;
        inner.rotation.x = s > 0 ? 0 : Math.PI;
        jetGroup.add(inner);
      }
      group.add(jetGroup);
    }

    const _diskN = new THREE.Vector3();
    const _bhPos = new THREE.Vector3();
    const _toCamBH = new THREE.Vector3();
    this.group = group;
    this.mesh = horizon;
    this.fx = { t: 0, update(dt) {
      this.t += dt;
      diskMat.uniforms.uTime.value = this.t;      // rotação diferencial no shader
      lensMat.uniforms.uTime.value = this.t * 1.4;
      lens.quaternion.copy(camera.quaternion);     // billboard: lente sempre de frente
      // De-quina do plano do disco → monte lenseado forte; de frente → halo some.
      _diskN.set(0, 0, 1).applyQuaternion(disk.quaternion).applyQuaternion(group.quaternion);
      group.getWorldPosition(_bhPos);
      _toCamBH.copy(camera.position).sub(_bhPos).normalize();
      const edgeOn = 1.0 - Math.abs(_diskN.dot(_toCamBH));
      lensMat.uniforms.uGain.value = 0.08 + 0.62 * edgeOn * edgeOn;
      photon.material.opacity = 0.88 + Math.sin(this.t * 3) * 0.10;
      photon2.material.opacity = 0.32 + Math.sin(this.t * 2.2 + 1.4) * 0.10;
    } };
  }
}
