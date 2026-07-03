// celestial/body.js — CelestialBody: a superclasse de TODO corpo celeste.
//
// A INSTÂNCIA é o próprio record que gravity.js / orbits.js / nav / map / missions
// consomem em game.bodies (contrato do PLAN §2): worldPos, mu, soi, gravReach,
// system, parent, isMoon, isSun, def{key,name,kind,radius,…} etc. Assim os módulos
// de física ficam INTOCADOS (AC-05) — eles não sabem que agora existem classes.
//
// Parametrização (AC-01): o construtor aceita PARÂMETROS FÍSICOS (massa em
// M☉/M⊕ conforme a subclasse, spin/velocidade angular, raio…) e deriva defaults
// via physics.js; qualquer campo pode ser sobrescrito explicitamente (paridade
// com os valores hand-tuned migrados de config.js).

import * as THREE from '../../../vendor/three.module.min.js';
import { scene } from '../scene.js';
import { game } from '../state.js';
import { defaultGravReach } from './physics.js';

export class CelestialBody {
  /**
   * @param {object} p — parâmetros físicos + visuais.
   *   Obrigatórios: name, key.
   *   Físicos: mu (direto) OU massa via subclasse; radius; spin; soi; gravReach.
   *   Visuais: color, color2, kind, … (repassados ao def).
   */
  constructor(p) {
    // `key` é opcional (luas históricas não têm — nav/map toleram undefined).
    if (!p || !p.name) throw new Error('CelestialBody: name é obrigatório');
    // def = a folha de parâmetros consumida por HUD/nav/map (def.radius, def.kind…).
    // Mantém TODOS os campos extras (rs, disk, photonRing, cellScale, tilt, ring…).
    this.def = { ...p };

    // ── Contrato físico do record (gravity.js) ──
    this.mu = p.mu;
    this.soi = p.soi;
    this.gravReach = p.gravReach || defaultGravReach(this.def);
    this.def.gravReach = this.gravReach;

    // ── Identidade na cena/sistema ──
    this.system = null;            // setado por register()
    this.parent = p.parent || null;
    this.isMoon = false;
    this.isSun = false;
    this.moons = [];

    // ── Cinemática (orbits.js mantém) ──
    this.worldPos = new THREE.Vector3();
    this.angle = Math.random() * Math.PI * 2;
    this.orbitCenter = null;
    this.orbit = p.orbit;
    this.period = p.period ?? null;
    this.spin = p.spin;

    // ── Visual ──
    this.group = null;
    this.mesh = null;
    this.fx = null;                // { update(dt) } — registrado no ticker do sistema
  }

  // Subclasses constroem o visual aqui e DEVEM setar this.group e this.mesh.
  buildVisual() { throw new Error(`${this.constructor.name}: buildVisual() não implementado`); }

  // Pluga um componente de movimento (motion.js) — qualquer corpo × qualquer regime.
  withMotion(motion) { this._motion = motion; return this; }

  /**
   * Materializa o corpo: constrói o visual, aplica o movimento e registra em
   * game.bodies + cena. Devolve a própria instância (o record canônico).
   */
  register(systemKey) {
    this.system = systemKey;
    if (!this.group) this.buildVisual();
    scene.add(this.group);
    if (this._motion) this._motion.attach(this);
    this.group.position.copy(this.worldPos);
    game.bodies.push(this);
    return this;
  }
}
