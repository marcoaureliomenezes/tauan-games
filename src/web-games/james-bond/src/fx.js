import * as THREE from '../../vendor/three.module.min.js';

const TRACER_COUNT = 24;
const PARTICLE_COUNT = 90;
const DECAL_COUNT = 48;
const up = new THREE.Vector3(0, 1, 0);
const temp = new THREE.Vector3();

// Pooled combat feedback: tracers, impact sparks, blood, bullet-hole decals, one shared muzzle light.
// Every mesh is flagged userData.fx so the combat raycaster ignores it.
export function createFx(scene) {
  const effects = [];
  let shake = 0;

  const tracerGeometry = new THREE.BoxGeometry(0.018, 0.018, 1);
  const tracers = Array.from({ length: TRACER_COUNT }, () => {
    const mesh = new THREE.Mesh(tracerGeometry, new THREE.MeshBasicMaterial({
      color: 0xffd9a0, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    mesh.visible = false;
    mesh.userData.fx = true;
    scene.add(mesh);
    return { mesh, life: 0, max: 0.07 };
  });

  const particleGeometry = new THREE.BoxGeometry(0.03, 0.03, 0.03);
  const particles = Array.from({ length: PARTICLE_COUNT }, () => {
    const mesh = new THREE.Mesh(particleGeometry, new THREE.MeshBasicMaterial({
      color: 0xffffff, transparent: true, opacity: 0, depthWrite: false,
    }));
    mesh.visible = false;
    mesh.userData.fx = true;
    scene.add(mesh);
    return { mesh, life: 0, max: 0.5, velocity: new THREE.Vector3(), gravity: 9 };
  });

  const decalGeometry = new THREE.CircleGeometry(0.055, 10);
  const decalMaterial = new THREE.MeshBasicMaterial({ color: 0x14110d, transparent: true, opacity: 0.85, depthWrite: false });
  let decalIndex = 0;
  const decals = Array.from({ length: DECAL_COUNT }, () => {
    const mesh = new THREE.Mesh(decalGeometry, decalMaterial);
    mesh.visible = false;
    mesh.userData.fx = true;
    scene.add(mesh);
    return mesh;
  });

  const muzzleLight = new THREE.PointLight(0xffc267, 0, 7, 2);
  muzzleLight.userData.fx = true;
  scene.add(muzzleLight);

  function tracer(from, to, color = 0xffd9a0) {
    const slot = tracers.find((entry) => entry.life <= 0) || tracers[0];
    slot.life = slot.max;
    slot.mesh.visible = true;
    slot.mesh.material.color.set(color);
    slot.mesh.material.opacity = 0.9;
    temp.copy(to).sub(from);
    const length = temp.length();
    slot.mesh.position.copy(from).addScaledVector(temp, 0.5);
    slot.mesh.lookAt(to);
    slot.mesh.scale.set(1, 1, Math.max(0.2, length));
  }

  function spawnParticles(position, color, count, speed, gravity = 9, life = 0.45) {
    let spawned = 0;
    for (const particle of particles) {
      if (particle.life > 0) continue;
      particle.life = particle.max = life * (0.7 + Math.random() * 0.6);
      particle.mesh.visible = true;
      particle.mesh.material.color.set(color);
      particle.mesh.material.opacity = 1;
      particle.mesh.position.copy(position);
      particle.velocity.set(Math.random() - 0.5, Math.random() * 0.7, Math.random() - 0.5).normalize()
        .multiplyScalar(speed * (0.5 + Math.random() * 0.8));
      particle.gravity = gravity;
      if ((spawned += 1) >= count) break;
    }
  }

  function impact(position, color = 0xd9c9a3, normal = null) {
    spawnParticles(position, color, 5, 3.2, 10, 0.35);
    if (normal) decal(position, normal);
  }

  function blood(position) {
    spawnParticles(position, 0x8f1d16, 8, 2.6, 11, 0.5);
  }

  function decal(position, normal) {
    const mesh = decals[decalIndex];
    decalIndex = (decalIndex + 1) % DECAL_COUNT;
    mesh.visible = true;
    mesh.position.copy(position).addScaledVector(normal, 0.012);
    temp.copy(position).add(normal);
    mesh.lookAt(temp);
  }

  function muzzle(camera, suppressed = false) {
    camera.getWorldDirection(temp);
    muzzleLight.position.copy(camera.position).addScaledVector(temp, 0.9);
    muzzleLight.intensity = suppressed ? 0.6 : 5.5;
  }

  function enemyMuzzle(position) {
    muzzleLight.position.copy(position);
    muzzleLight.intensity = 4;
  }

  function explosion(position, radius = 5) {
    const group = new THREE.Group();
    group.userData.fx = true;
    const fireball = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.52, 2),
      new THREE.MeshBasicMaterial({ color: 0xffb347, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false }),
    );
    group.add(fireball);
    for (let index = 0; index < 5; index += 1) {
      const smoke = new THREE.Mesh(new THREE.DodecahedronGeometry(0.42 + index * 0.05, 1), new THREE.MeshStandardMaterial({ color: 0x332e29, transparent: true, opacity: 0.58, roughness: 1 }));
      smoke.position.set(Math.cos(index * 2.4) * 0.38, 0.28 + index * 0.16, Math.sin(index * 2.4) * 0.38);
      group.add(smoke);
    }
    const wave = new THREE.Mesh(new THREE.RingGeometry(0.28, 0.42, 32), new THREE.MeshBasicMaterial({ color: 0xffd18a, transparent: true, opacity: 0.7, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false }));
    wave.rotation.x = -Math.PI / 2;
    wave.position.y = 0.06;
    group.add(wave);
    group.position.copy(position);
    const light = new THREE.PointLight(0xff7b32, 8, radius * 2.6, 2);
    group.add(light);
    scene.add(group);
    spawnParticles(position, 0xffc267, 14, 7, 8, 0.6);
    spawnParticles(position, 0x3a342c, 10, 4, 6, 0.9);
    effects.push({ mesh: group, life: 1.2, max: 1.2, velocity: new THREE.Vector3(0, 0.7, 0), explosion: true, radius });
    shake = Math.max(shake, Math.min(0.22, radius * 0.025));
  }

  function update(dt) {
    for (const slot of tracers) {
      if (slot.life <= 0) continue;
      slot.life -= dt;
      slot.mesh.material.opacity = Math.max(0, slot.life / slot.max) * 0.9;
      if (slot.life <= 0) slot.mesh.visible = false;
    }
    for (const particle of particles) {
      if (particle.life <= 0) continue;
      particle.life -= dt;
      particle.velocity.y -= particle.gravity * dt;
      particle.mesh.position.addScaledVector(particle.velocity, dt);
      if (particle.mesh.position.y < 0.02) { particle.mesh.position.y = 0.02; particle.velocity.multiplyScalar(0.3); }
      particle.mesh.material.opacity = Math.max(0, particle.life / particle.max);
      if (particle.life <= 0) particle.mesh.visible = false;
    }
    muzzleLight.intensity = Math.max(0, muzzleLight.intensity - dt * 60);
    for (let i = effects.length - 1; i >= 0; i -= 1) {
      const effect = effects[i];
      effect.life -= dt;
      effect.mesh.position.addScaledVector(effect.velocity, dt);
      const progress = 1 - effect.life / effect.max;
      effect.mesh.scale.setScalar(1 + progress * effect.radius * 0.8);
      effect.mesh.children.forEach((child) => {
        if (child.material) child.material.opacity = Math.max(0, 1 - progress);
        if (child.isLight) child.intensity = Math.max(0, 8 * (1 - progress * 2));
      });
      if (effect.life <= 0) {
        scene.remove(effect.mesh);
        effect.mesh.traverse?.((object) => { object.geometry?.dispose(); object.material?.dispose(); });
        effects.splice(i, 1);
      }
    }
    shake *= Math.pow(0.04, dt);
  }

  return { impact, blood, tracer, decal, muzzle, enemyMuzzle, explosion, update, get shake() { return shake; } };
}
