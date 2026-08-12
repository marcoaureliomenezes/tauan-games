// Web game package: james-bond.
//
// CENÁRIO QUE RESPONDE: barris, carros, engradados e tambores deixam de ser
// enfeite sólido e passam a ser corpos com vida própria.
//
// Três comportamentos, sempre juntos:
//   1. SÓLIDO      — cada peça tem colisor; não se atravessa um barril.
//   2. ATINGÍVEL   — tiro e explosão tiram vida; ao zerar, a peça é destruída
//                    (o barril e o carro detonam; o engradado se despedaça).
//   3. DESLOCÁVEL  — a onda de choque ARREMESSA a peça: ela voa girando, quica
//                    no chão e assenta em outro lugar, levando o colisor junto.
//
// O colisor acompanha o estado: sai da física enquanto a peça voa (para não
// virar parede invisível no ar) e volta onde ela assenta. Peça destruída não
// deixa colisor nenhum.
//
// Uma peça pode ser um Object3D próprio (carro, barril de missão) ou UMA
// INSTÂNCIA dentro de uma InstancedMesh (engradados e tambores de props.js).
// O registro abstrai os dois: `apply()` sabe escrever de volta na forma certa.

import * as THREE from '../../../vendor/three.module.min.js';

const GRAVITY = 15;
const REST_SPEED = 0.55;
const matrix = new THREE.Matrix4();
const quaternion = new THREE.Quaternion();
const scaleVector = new THREE.Vector3();
const temp = new THREE.Vector3();
const HIDDEN = new THREE.Matrix4().makeScale(0, 0, 0);

export function createDestructibles(scene, physics, fx, audio) {
  const entries = [];
  /** Chamado quando uma peça explosiva morre; ligado em explosives.js. */
  let onExplode = null;

  /**
   * @param {object} spec
   * @param {THREE.Object3D} [spec.node]       peça própria (carro, barril)
   * @param {THREE.InstancedMesh} [spec.instanced]  malha instanciada…
   * @param {number} [spec.index]              …e o índice desta instância
   * @param {THREE.Vector3|{x,y,z}} spec.position
   * @param {number} spec.health
   * @param {number} spec.mass      1 = leve (voa longe); 8 = carro (mal se mexe)
   * @param {boolean} [spec.explosive]
   * @param {number} [spec.radius]  raio da própria explosão
   */
  function register(spec) {
    const entry = {
      kind: spec.kind,
      node: spec.node || null,
      instanced: spec.instanced || null,
      index: spec.index ?? -1,
      position: new THREE.Vector3(spec.position.x, spec.position.y || 0, spec.position.z),
      // Altura de repouso da peça (centro do barril, base do engradado…). O
      // corpo assenta AQUI, não em y=0 — senão o barril afunda no asfalto.
      groundY: spec.groundY ?? spec.position.y ?? 0,
      rotation: new THREE.Euler(0, spec.yaw || 0, 0),
      scale: spec.scale ?? 1,
      health: spec.health,
      maxHealth: spec.health,
      mass: spec.mass ?? 1,
      explosive: Boolean(spec.explosive),
      blastRadius: spec.radius ?? 5.5,
      debrisColor: spec.debrisColor ?? 0x6b5433,
      collider: spec.collider || null,
      hitHalf: spec.hitHalf ?? 0.5,
      velocity: new THREE.Vector3(),
      spin: new THREE.Vector3(),
      alive: true,
      flying: false,
    };
    // Peça sólida sem colisor pré-existente cria o seu: é o que faz o barril
    // e o engradado deixarem de ser enfeite atravessável. O carro passa o
    // colisor que o tile `c` já criou, para não haver dois no mesmo lugar.
    if (!entry.collider && spec.solid !== false) {
      entry.collider = physics.addBox(entry.position.x, entry.position.y, entry.position.z,
        entry.hitHalf, entry.hitHalf, entry.hitHalf);
    }
    entries.push(entry);
    // Marca a peça para o raycast de tiro achar o dono a partir do mesh.
    if (entry.node) entry.node.traverse((part) => { part.userData.prop = entry; });
    return entry;
  }

  /** Entrada correspondente a um resultado de raycast, se houver. */
  function fromHit(hit) {
    if (!hit?.object) return null;
    const direct = hit.object.userData.prop;
    if (direct) return direct.alive ? direct : null;
    const group = hit.object.userData.propGroup;
    if (group && hit.instanceId !== undefined && hit.instanceId !== null) {
      const entry = group[hit.instanceId];
      return entry?.alive ? entry : null;
    }
    return null;
  }

  /** Escreve posição/rotação de volta na forma certa (nó ou instância). */
  function apply(entry) {
    if (entry.node) {
      entry.node.position.copy(entry.position);
      entry.node.rotation.copy(entry.rotation);
      return;
    }
    if (!entry.instanced) return;
    quaternion.setFromEuler(entry.rotation);
    scaleVector.setScalar(entry.scale);
    matrix.compose(entry.position, quaternion, scaleVector);
    entry.instanced.setMatrixAt(entry.index, matrix);
    entry.instanced.instanceMatrix.needsUpdate = true;
  }

  function hide(entry) {
    if (entry.node) { entry.node.visible = false; return; }
    if (!entry.instanced) return;
    entry.instanced.setMatrixAt(entry.index, HIDDEN);
    entry.instanced.instanceMatrix.needsUpdate = true;
  }

  function dropCollider(entry) {
    if (!entry.collider) return;
    physics.removeBox(entry.collider);
    entry.collider = null;
  }

  /** Recria o colisor onde a peça assentou. */
  function restoreCollider(entry) {
    if (entry.collider || !entry.alive) return;
    entry.collider = physics.addBox(entry.position.x, entry.position.y, entry.position.z,
      entry.hitHalf, entry.hitHalf, entry.hitHalf);
  }

  /**
   * Arremessa a peça. `power` é 0..1 (proporção da força da explosão que chegou
   * até ela). Massa alta quase não sai do lugar — um carro balança, um barril voa.
   */
  function launch(entry, direction, power) {
    if (!entry.alive) return;
    const push = (7.5 * power) / entry.mass;
    if (push < 0.6) return;                       // empurrão fraco demais: fica
    entry.flying = true;
    dropCollider(entry);
    entry.velocity.copy(direction).normalize().multiplyScalar(push);
    entry.velocity.y += push * 0.55 + 1.2;
    entry.spin.set((Math.random() - 0.5) * 9, (Math.random() - 0.5) * 9, (Math.random() - 0.5) * 9)
      .multiplyScalar(Math.min(1.6, power * 2.4 / entry.mass));
  }

  function damage(entry, amount, direction = null, power = 0) {
    if (!entry?.alive) return false;
    entry.health -= amount;
    if (direction && power > 0) launch(entry, direction, power);
    if (entry.health > 0) {
      // Ainda de pé: um tranco visível para o tiro ter peso.
      if (!entry.flying && direction) {
        entry.rotation.z += (Math.random() - 0.5) * 0.07;
        entry.position.addScaledVector(temp.copy(direction).setY(0).normalize(), 0.05 / entry.mass);
        apply(entry);
      }
      return false;
    }
    destroy(entry, direction);
    return true;
  }

  function destroy(entry, direction = null) {
    entry.alive = false;
    entry.flying = false;
    dropCollider(entry);
    hide(entry);
    if (entry.explosive) {
      // Barril e carro detonam: a cadeia de explosões é o que torna a rua
      // perigosa de verdade.
      onExplode?.(entry.position.clone(), entry.blastRadius);
      return;
    }
    // Peça destruída vira matéria voando: é o que se vê no lugar dela.
    fx.debris(entry.position, entry.debrisColor, 16);
    audio?.impact?.(entry.position, false);
    if (direction) fx.impact(entry.position, entry.debrisColor);
  }

  /** Onda de choque: fere e arremessa tudo dentro do raio. */
  function blast(position, radius, power = 1) {
    for (const entry of entries) {
      if (!entry.alive) continue;
      const distance = entry.position.distanceTo(position);
      if (distance > radius) continue;
      const falloff = 1 - distance / radius;
      temp.copy(entry.position).sub(position).setY(0);
      if (temp.lengthSq() < 0.0001) temp.set(Math.random() - 0.5, 0, Math.random() - 0.5);
      // A explosão empurra ANTES de matar. O dano é deliberadamente MODESTO:
      // se a onda matasse tudo no raio, nada seria visto voando — a peça
      // sumiria no mesmo quadro. Só quem está perto do epicentro é destruído;
      // o resto é arremessado, gira no ar e assenta noutro lugar.
      launch(entry, temp, falloff * power);
      damage(entry, 70 * falloff * falloff * power);
    }
  }

  function update(dt) {
    for (const entry of entries) {
      if (!entry.flying) continue;
      entry.velocity.y -= GRAVITY * dt;
      entry.position.addScaledVector(entry.velocity, dt);
      entry.rotation.x += entry.spin.x * dt;
      entry.rotation.y += entry.spin.y * dt;
      entry.rotation.z += entry.spin.z * dt;
      if (entry.position.y <= entry.groundY) {
        entry.position.y = entry.groundY;
        entry.velocity.y *= -0.32;
        entry.velocity.x *= 0.62;
        entry.velocity.z *= 0.62;
        entry.spin.multiplyScalar(0.5);
        if (entry.velocity.length() < REST_SPEED) {
          // Assentou: tomba para um lado e volta a ser obstáculo sólido.
          entry.flying = false;
          entry.velocity.set(0, 0, 0);
          entry.spin.set(0, 0, 0);
          entry.position.y = entry.groundY;
          restoreCollider(entry);
        }
      }
      apply(entry);
    }
  }

  return {
    entries,
    register,
    registerInstanced(instanced, list) {
      // `propGroup` é indexado por instanceId — é assim que o raycast descobre
      // QUAL engradado da InstancedMesh foi atingido.
      const group = [];
      for (const spec of list) group[spec.index] = register({ ...spec, instanced });
      instanced.userData.propGroup = group;
      return group;
    },
    fromHit,
    damage,
    blast,
    update,
    set explodeHandler(handler) { onExplode = handler; },
  };
}
