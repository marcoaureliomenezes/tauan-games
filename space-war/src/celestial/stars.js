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
import { game } from '../state.js';
import { CelestialBody } from './body.js';

// Flare LOCAL (bug space-war-solar-flare-universe-overlay): o Lensflare do Three
// desenha em screen-space sem atenuação — a milhões de u o glare do Sol ainda
// cobria a tela inteira de OUTRO sistema. O flare agora encolhe com a distância
// e é CORTADO além da vizinhança solar.
const FLARE_FULL = 700_000;      // até aqui: tamanho pleno (vizinhança interna)
const FLARE_CUTOFF = 4_200_000;  // < anel de vizinhos (4.5M): lá fora, invisível
import {
  HEADLESS, starMaterial, makeRadialSprite, flareTexture,
  diskMaterial, DISK_SYNCHROTRON,
} from './atoms.js';
import { muFromSolarMasses, solarMassesFromMu, spectralFromMass, radiusFromMass, lightForMass } from './physics.js';

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
    let flare = null;
    let flareElems = null;
    if (def.light) {
      // def.light aceita número (só cor) ou objeto; intensity/range ausentes
      // derivam da MASSA (L ∝ M^3.5 comprimido — physics.lightForMass, P2-11).
      const L = typeof def.light === 'object' ? def.light : { color: def.light };
      const auto = lightForMass(def.mass ?? solarMassesFromMu(def.mu));
      const pl = new THREE.PointLight(L.color, L.intensity ?? auto.intensity, L.range ?? auto.range, 0.0);
      group.add(pl);
      if (def.light.flare && !HEADLESS) {
        flare = new Lensflare();
        flareElems = [
          new LensflareElement(flareTexture(true), 640, 0, new THREE.Color(0xfff0c8)),
          new LensflareElement(flareTexture(false), 110, 0.55, new THREE.Color(0xffd9a0)),
          new LensflareElement(flareTexture(false), 60, 0.85, new THREE.Color(0xaac8ff)),
          new LensflareElement(flareTexture(false), 150, 1.2, new THREE.Color(0xff9a70)),
        ];
        for (const el of flareElems) { el._baseSize = el.size; flare.addElement(el); }
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
      if (def.light && def.light.flare) {
        // Flare local ∝ FLUXO (bug space-war-distant-suns-oversized): o glare é
        // artefato de instrumento — escala com a energia recebida (FLARE_FULL/d)²,
        // SEM piso (o antigo 0.22 fixava 141px de flare a 4M u). A POLÍTICA roda
        // mesmo em HEADLESS — o diagnóstico game.sunFlareVisible/Factor é o que
        // os testes de regressão asserem.
        const d = camera.position.distanceTo(group.position);
        const vis = d < FLARE_CUTOFF;
        game.sunFlareVisible = vis;
        const fFlux = Math.min(1, (FLARE_FULL / Math.max(d, 1)) ** 2);
        game.sunFlareFactor = vis ? fFlux : 0;
        if (flare) {
          flare.visible = vis;
          if (vis) {
            for (const el of flareElems) el.size = el._baseSize * fFlux;
          }
        }
      }
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

    // Núcleo OFUSCANTE (P1-1): superfície a ~1e6 K — brilho superficial visível
    // ~173× o do Sol; qualquer T ≳ 30.000 K satura na mesma cromaticidade
    // azul-branca (sRGB ≈ 155,188,255). De perto o modo de falha correto é
    // ficar CEGO, não às escuras.
    const core = new THREE.Mesh(
      new THREE.SphereGeometry(def.radius, 48, 32),
      new THREE.MeshBasicMaterial({ color: 0xffffff }),
    );
    group.add(core);
    // Glint interno intenso (satura com o bloom)
    const glint = makeRadialSprite(['rgba(255,255,255,1.0)', 'rgba(190,215,255,0.45)', 'rgba(0,0,0,0)']);
    glint.scale.setScalar(def.radius * 8);
    group.add(glint);
    // Corona pontual (estilo anã branca, mais forte): o farol visível de longe.
    const corona = makeRadialSprite(['rgba(200,222,255,0.75)', 'rgba(130,170,255,0.22)', 'rgba(0,0,0,0)']);
    corona.scale.setScalar(def.radius * 26);
    group.add(corona);
    // Halo externo tênue: presença a grandes distâncias (pulsar = fonte pontual).
    const halo = makeRadialSprite(['rgba(155,188,255,0.28)', 'rgba(110,150,240,0.08)', 'rgba(0,0,0,0)']);
    halo.scale.setScalar(def.radius * 90);
    group.add(halo);

    // Eixo magnético (inclinado vs rotação) → jatos + toro carregados por ele.
    const axis = new THREE.Group();
    axis.rotation.z = def.jetTilt;
    group.add(axis);

    // TORO DE VENTO síncrotron (equatorial ao eixo magnético) — nebulosa do vento
    // de pulsar à la Crab/Chandra, VIVA (a nebulosa sozinha irradia ~3e4 L☉).
    const torusMat = diskMaterial(def.radius * 3.2, def.radius * 14, 1.25, DISK_SYNCHROTRON);
    const torus = new THREE.Mesh(
      new THREE.RingGeometry(def.radius * 3.2, def.radius * 14, 96, 3),
      torusMat,
    );
    torus.rotation.x = Math.PI / 2;
    axis.add(torus);

    // JATOS relativísticos: AGULHAS de luz finas, LONGAS e brilhantes
    // (referências do operador: needles atravessando os DOIS polos).
    const jetLen = def.radius * 220;
    const jetMats = [];
    for (const s of [1, -1]) {
      const outer = new THREE.Mesh(
        new THREE.CylinderGeometry(def.radius * 0.34, def.radius * 0.12, jetLen, 10, 1, true),
        new THREE.MeshBasicMaterial({ color: 0x9fd0ff, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, depthWrite: false }),
      );
      outer.position.y = s * jetLen / 2;
      outer.rotation.x = s > 0 ? 0 : Math.PI;
      axis.add(outer);
      const inner = new THREE.Mesh(
        new THREE.CylinderGeometry(def.radius * 0.12, def.radius * 0.04, jetLen * 1.06, 8, 1, true),
        new THREE.MeshBasicMaterial({ color: 0xeaf4ff, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, depthWrite: false }),
      );
      inner.position.y = s * jetLen * 0.53;
      inner.rotation.x = s > 0 ? 0 : Math.PI;
      axis.add(inner);
      jetMats.push(outer.material, inner.material);
    }

    // Gaiola dipolo VISÍVEL (refs: linhas de campo emoldurando a esfera).
    for (let i = 0; i < 10; i++) {
      const phi = (i / 10) * Math.PI * 2;
      const line = dipoleFieldLine(def.radius * 6.5, phi, def.radius);
      line.material.opacity = 0.14;
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
      // cintilação dos jatos (mais vivos — P1-1)
      const flick = 0.85 + 0.15 * Math.sin(this.t * 37.3);
      jetMats[0].opacity = 0.26 * flick; jetMats[1].opacity = 0.90 * flick;
      jetMats[2].opacity = 0.26 * flick; jetMats[3].opacity = 0.90 * flick;
      // STROBE ÓPTICO ~30 Hz: o Crab pulsa em LUZ VISÍVEL a ~30 Hz (Cocke+ 1969).
      // Em 60 fps vira um shimmer de quadros alternados — assinatura do pulsar.
      const strobe = 0.82 + 0.18 * (0.5 + 0.5 * Math.sin(this.t * Math.PI * 2 * 30));
      game.pulsarStrobe = strobe;                        // diagnóstico p/ e2e (AC-01)
      // FAROL: flash curto e intenso quando o feixe cruza a câmera
      _jetDir.set(0, 1, 0).applyQuaternion(group.quaternion).applyQuaternion(axis.quaternion);
      _toCam.copy(camera.position).sub(group.position).normalize();
      const sweep = Math.pow(Math.abs(_jetDir.dot(_toCam)), 24);
      glint.material.opacity = Math.min(1.0, (0.8 + sweep * 0.2) * strobe);
      glint.scale.setScalar(def.radius * (8 + sweep * 5) * strobe);
      corona.material.opacity = (0.6 + sweep * 0.25) * strobe;
      halo.material.opacity = 0.24 * strobe;
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

    // Disco de acreção DOMINANTE (referências Sagitário do operador): estrias
    // em braços espirais + aro interno branco-quente — levemente inclinado.
    const disk0 = def.disk ?? { inner: def.rs * 3.0, outer: def.rs * 20 };   // ISCO = 3·rs
    const diskMat = diskMaterial(disk0.inner, disk0.outer, def.diskGain ?? 1.0,
      undefined, { spiral: 1, rim: 1 });
    const disk = new THREE.Mesh(new THREE.RingGeometry(disk0.inner, disk0.outer, 160, 6), diskMat);
    disk.rotation.x = Math.PI / 2 + 0.18;
    group.add(disk);

    // "MONTE" LENSEADO billboard: a imagem do lado distante do disco curvada
    // por cima/por baixo da sombra — ganho modulado por quão de-quina estamos.
    const lensMat = diskMaterial(def.rs * 1.4, def.rs * 2.8, 0.6);
    const lens = new THREE.Mesh(new THREE.RingGeometry(def.rs * 1.4, def.rs * 2.8, 96, 2), lensMat);
    group.add(lens);

    // GÁS ESPIRALANDO PARA DENTRO (referências do operador): tubo em espiral
    // logarítmica no plano do disco, da borda externa até a ISCO — a queda é
    // VISÍVEL como caminho, não um cano reto. Gira devagar com o disco.
    const spiralPts = [];
    const TURNS = 2.2, SEGS = 90;
    for (let i = 0; i <= SEGS; i++) {
      const t = i / SEGS;
      const angS = t * TURNS * Math.PI * 2;
      const rS = disk0.outer * 0.98 * Math.pow((disk0.inner * 1.1) / (disk0.outer * 0.98), t);
      spiralPts.push(new THREE.Vector3(Math.cos(angS) * rS, Math.sin(angS) * rS, (1 - t) * def.rs * 0.25));
    }
    const spiral = new THREE.Mesh(
      new THREE.TubeGeometry(new THREE.CatmullRomCurve3(spiralPts), HEADLESS ? 40 : 120, def.rs * 0.16, 6, false),
      new THREE.MeshBasicMaterial({ color: 0xffc27a, transparent: true, opacity: 0.34, blending: THREE.AdditiveBlending, depthWrite: false }),
    );
    spiral.rotation.x = Math.PI / 2 + 0.18;          // mesmo plano do disco
    group.add(spiral);

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
      spiral.rotation.z += dt * 0.10;             // a espiral de gás enrola devagar
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
