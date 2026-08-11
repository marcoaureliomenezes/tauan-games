import * as THREE from '../../vendor/three.module.min.js';

const TRACER_COUNT = 24;
const PARTICLE_COUNT = 90;
const DECAL_COUNT = 48;
const up = new THREE.Vector3(0, 1, 0);
const temp = new THREE.Vector3();

// PERF LAW (measured on this exact game): three.js keys the compiled shader
// program cache on the SCENE'S LIGHT COUNT (`numPointLights` is both a shader
// define and part of `WebGLRenderer.getProgramCacheKey`). Adding or removing a
// Light at runtime invalidates and recompiles EVERY lit material in the scene
// on the very next render — with an instanced city + shadows + a dozen skinned
// enemies that is a multi-hundred-ms synchronous stall. So: every light this
// module ever needs is created ONCE, right here, permanently resident in the
// scene (`scene.add` happens exactly once per light, ever). Nothing below this
// point may ever call `scene.add`/`scene.remove` on a Light. "Turning a light
// off" always means `intensity = 0`, never removal.
const FLARE_LIGHT_COUNT = 3;   // shared by explosions AND in-flight rockets
const AURA_LIGHT_COUNT = 12;   // matches the densest mission roster (OP-05, 12/12 aura)

// Same law for the explosion rig's geometries/materials: sized once, reused
// forever. The per-explosion "variety" lives entirely in position/scale/
// opacity/color, all of which are already data-driven per detonation.
const EXPLOSION_RIG_COUNT = 3; // covers 2 grenades in flight + one chained prop
const EXPLOSION_LOBES = 6;
const EXPLOSION_SMOKE_PUFFS = 8;
const EXPLOSION_FLASH_GEOMETRY = new THREE.SphereGeometry(0.7, 12, 10);
const EXPLOSION_FRONT_GEOMETRY = new THREE.SphereGeometry(1, 20, 14);
const EXPLOSION_LOBE_GEOMETRIES = [0, 1, 2].map((i) => new THREE.IcosahedronGeometry(0.42 + i * 0.1, 1));
const EXPLOSION_DUST_GEOMETRY = new THREE.RingGeometry(0.3, 0.62, 44);
const EXPLOSION_SMOKE_GEOMETRIES = [0, 1, 2].map((i) => new THREE.DodecahedronGeometry(0.4 + i * 0.14, 1));

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

  // Poças de sangue: decalques deitados no chão, pool próprio para não
  // competir com os furos de bala.
  const POOL_COUNT = 14;
  let poolIndex = 0;
  const poolGeometry = new THREE.CircleGeometry(0.42, 14);
  const poolMaterial = new THREE.MeshBasicMaterial({ color: 0x4a0d09, transparent: true, opacity: 0.72, depthWrite: false });
  const pools = Array.from({ length: POOL_COUNT }, () => {
    const mesh = new THREE.Mesh(poolGeometry, poolMaterial);
    mesh.rotation.x = -Math.PI / 2;
    mesh.visible = false;
    mesh.userData.fx = true;
    scene.add(mesh);
    return mesh;
  });

  // Estilhaços: pedaços SÓLIDOS, não pontinhos. Cada um tem tamanho próprio,
  // gira no ar e quica no chão antes de sumir — é o que faltava para a explosão
  // ter matéria sendo arrancada, em vez de só luz inchando.
  const DEBRIS_COUNT = 46;
  const debrisGeometry = new THREE.TetrahedronGeometry(0.14, 0);
  const chunks = Array.from({ length: DEBRIS_COUNT }, () => {
    const mesh = new THREE.Mesh(debrisGeometry, new THREE.MeshStandardMaterial({
      color: 0x3a352e, roughness: 0.95, transparent: true, opacity: 1,
    }));
    mesh.visible = false;
    mesh.castShadow = true;
    mesh.userData.fx = true;
    scene.add(mesh);
    return { mesh, life: 0, max: 1, velocity: new THREE.Vector3(), spin: new THREE.Vector3() };
  });

  /** Chuva de estilhaços a partir de um ponto. */
  function debris(position, color = 0x3a352e, count = 12) {
    let spawned = 0;
    for (const chunk of chunks) {
      if (chunk.life > 0) continue;
      chunk.life = chunk.max = 1.3 + Math.random() * 1.1;
      chunk.mesh.visible = true;
      chunk.mesh.material.color.set(color);
      chunk.mesh.material.opacity = 1;
      chunk.mesh.position.copy(position);
      chunk.mesh.position.y += 0.2;
      const size = 0.55 + Math.random() * 1.5;
      chunk.mesh.scale.setScalar(size);
      // Cone para cima: destroço sobe e cai, não desliza pelo chão.
      chunk.velocity.set(Math.random() - 0.5, 0.55 + Math.random() * 0.8, Math.random() - 0.5)
        .normalize().multiplyScalar(5 + Math.random() * 9);
      chunk.spin.set((Math.random() - 0.5) * 18, (Math.random() - 0.5) * 18, (Math.random() - 0.5) * 18);
      if ((spawned += 1) >= count) break;
    }
  }

  const muzzleLight = new THREE.PointLight(0xffc267, 0, 7, 2);
  muzzleLight.userData.fx = true;
  scene.add(muzzleLight);

  // --- Pool de luzes de clarão: explosão (fx.js) e foguete (explosives.js) ---
  // partilham este único pool fixo. Nunca cresce, nunca some da cena: só
  // intensidade/posição/cor mudam. `busy` é bookkeeping local ao pool, não
  // afeta a contagem de luzes vista pelo three.js (ela é sempre FLARE_LIGHT_COUNT).
  let flareLeaseCounter = 0;
  const flareLights = Array.from({ length: FLARE_LIGHT_COUNT }, () => {
    const light = new THREE.PointLight(0xff8b3c, 0, 1, 2);
    light.userData.fx = true;
    scene.add(light);
    return { light, busy: false, lease: 0 };
  });

  /** @returns {THREE.PointLight} nunca null — sempre há uma luz para dar, mesmo que "roubada". */
  function borrowFlareLight() {
    let entry = flareLights.find((item) => !item.busy);
    if (!entry) entry = flareLights.reduce((oldest, item) => (item.lease < oldest.lease ? item : oldest));
    entry.busy = true;
    entry.lease = (flareLeaseCounter += 1);
    return entry.light;
  }

  function releaseFlareLight(light) {
    const entry = flareLights.find((item) => item.light === light);
    if (entry) entry.busy = false;
    light.intensity = 0;
  }

  // --- Pool de luzes de aura de inimigo ---------------------------------
  // Orçamento fixo pré-criado; se uma missão tiver mais auras que o orçamento
  // (não acontece hoje — OP-05 usa 12/12), as espécies excedentes ficam sem
  // aura em vez de estourar o pool ou recriar luzes.
  const auraLights = Array.from({ length: AURA_LIGHT_COUNT }, () => {
    const light = new THREE.PointLight(0xffffff, 0, 1, 2);
    light.userData.fx = true;
    scene.add(light);
    return { light, busy: false };
  });

  function borrowAuraLight() {
    const entry = auraLights.find((item) => !item.busy);
    if (!entry) return null;
    entry.busy = true;
    return entry.light;
  }

  function releaseAuraLight(light) {
    if (!light) return;
    const entry = auraLights.find((item) => item.light === light);
    if (entry) entry.busy = false;
    light.intensity = 0;
  }

  // --- Pool de rigs de explosão -------------------------------------------
  // Geometrias são compartilhadas entre TODOS os rigs (imutáveis); cada rig
  // tem os seus próprios materiais porque cada camada anima opacidade/cor de
  // forma independente enquanto o efeito está ativo.
  function createExplosionRig() {
    const group = new THREE.Group();
    group.userData.fx = true;
    group.visible = false;

    const flash = new THREE.Mesh(EXPLOSION_FLASH_GEOMETRY, new THREE.MeshBasicMaterial({
      color: 0xfffdf2, transparent: true, opacity: 1, depthWrite: false,
    }));
    group.add(flash);

    const front = new THREE.Mesh(EXPLOSION_FRONT_GEOMETRY, new THREE.MeshBasicMaterial({
      color: 0xdfe9ff, transparent: true, opacity: 0.34, depthWrite: false,
      side: THREE.DoubleSide, blending: THREE.NormalBlending,
    }));
    front.material.userData.base = 0.34;
    group.add(front);

    const lobes = [];
    const lobeBase = [];
    for (let index = 0; index < EXPLOSION_LOBES; index += 1) {
      const angle = index * 2.399;
      const tilt = (index % 3 - 1) * 0.5;
      const lobe = new THREE.Mesh(EXPLOSION_LOBE_GEOMETRIES[index % 3], new THREE.MeshBasicMaterial({
        color: 0xffe9b0, transparent: true, opacity: 0.98, depthWrite: false,
      }));
      const base = new THREE.Vector3(Math.cos(angle) * 0.34, 0.12 + tilt * 0.3, Math.sin(angle) * 0.34);
      lobe.position.copy(base);
      group.add(lobe);
      lobes.push(lobe);
      lobeBase.push(base);
    }

    const dust = new THREE.Mesh(EXPLOSION_DUST_GEOMETRY, new THREE.MeshBasicMaterial({
      color: 0xbaa987, transparent: true, opacity: 0.6, side: THREE.DoubleSide, depthWrite: false,
    }));
    dust.material.userData.base = 0.6;
    dust.rotation.x = -Math.PI / 2;
    group.add(dust);

    const smokes = [];
    const smokeBase = [];
    for (let index = 0; index < EXPLOSION_SMOKE_PUFFS; index += 1) {
      const angle = index * 2.243;
      const smoke = new THREE.Mesh(EXPLOSION_SMOKE_GEOMETRIES[index % 3], new THREE.MeshStandardMaterial({
        color: 0x27231e, transparent: true, opacity: 0.72, roughness: 1,
      }));
      smoke.material.userData.base = 0.72;
      const base = new THREE.Vector3(Math.cos(angle) * 0.46, 0.2 + index * 0.16, Math.sin(angle) * 0.46);
      smoke.position.copy(base);
      group.add(smoke);
      smokes.push(smoke);
      smokeBase.push(base);
    }

    scene.add(group);
    const allMeshes = [flash, front, ...lobes, dust, ...smokes];
    return { group, flash, front, lobes, lobeBase, dust, smokes, smokeBase, allMeshes, busy: false };
  }

  const explosionRigs = Array.from({ length: EXPLOSION_RIG_COUNT }, () => createExplosionRig());

  /** Recoloca o rig na pose-base e apaga todas as camadas antes de reusar. */
  function resetRig(rig, position) {
    rig.flash.position.set(0, 0, 0);
    rig.front.position.set(0, 0, 0);
    rig.lobes.forEach((lobe, index) => lobe.position.copy(rig.lobeBase[index]));
    rig.dust.position.set(0, 0.09 - position.y, 0);
    rig.smokes.forEach((smoke, index) => smoke.position.copy(rig.smokeBase[index]));
    for (const mesh of rig.allMeshes) { mesh.visible = false; mesh.scale.setScalar(1); }
  }

  /** Libera o rig e a luz da explosão mais antiga ainda ativa (rouba, nunca destrói). */
  function reclaimOldestExplosion() {
    let oldest = effects[0];
    for (const effect of effects) if (effect.life < oldest.life) oldest = effect;
    const index = effects.indexOf(oldest);
    effects.splice(index, 1);
    releaseFlareLight(oldest.light);
    oldest.rig.group.visible = false;
    return oldest.rig;
  }

  function borrowExplosionRig() {
    const free = explosionRigs.find((rig) => !rig.busy);
    if (free) { free.busy = true; return free; }
    return reclaimOldestExplosion();
  }

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

  /**
   * Sangue no impacto. Com `direction` (a direção do tiro) o jato sai pelas
   * costas do alvo em vez de espirrar para todo lado — dá leitura imediata de
   * onde a bala entrou.
   */
  function blood(position, direction = null) {
    spawnParticles(position, 0x8f1d16, 9, 2.8, 11, 0.5);
    if (!direction) return;
    // Jato traseiro: partículas rápidas seguindo a bala, com pouca abertura.
    let spawned = 0;
    for (const particle of particles) {
      if (particle.life > 0) continue;
      particle.life = particle.max = 0.34 + Math.random() * 0.22;
      particle.mesh.visible = true;
      particle.mesh.material.color.set(0x64110c);
      particle.mesh.material.opacity = 1;
      particle.mesh.position.copy(position);
      particle.velocity.copy(direction)
        .addScaledVector(temp.set(Math.random() - 0.5, Math.random() - 0.35, Math.random() - 0.5), 0.42)
        .normalize()
        .multiplyScalar(4.5 + Math.random() * 3.5);
      particle.gravity = 12;
      if ((spawned += 1) >= 7) break;
    }
  }

  /** Poça escura no chão sob o corpo. Reusa o pool de decalques. */
  function bloodPool(position) {
    const mesh = pools[poolIndex];
    poolIndex = (poolIndex + 1) % POOL_COUNT;
    mesh.visible = true;
    mesh.position.set(position.x, (position.y || 0) + 0.015, position.z);
    const scale = 0.9 + Math.random() * 0.7;
    mesh.scale.set(scale, scale * (0.8 + Math.random() * 0.4), 1);
    mesh.rotation.z = Math.random() * Math.PI;
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

  /**
   * EXPLOSÃO — seis fenômenos com tempos próprios, na ordem em que a física os
   * produz. A versão anterior era uma bola lisa que inchava: lia como balão
   * porque tinha uma única forma, expansão uniforme e nenhuma frente de choque.
   *
   *   t=0      clarão branco + pico de luz (a detonação em si)
   *   t=0      frente de choque: casca fina expandindo MUITO rápido e sumindo
   *   t=0      bola de fogo em LOBOS: vários núcleos deslocados, cada um com o
   *            seu ritmo, esfriando de branco → amarelo → laranja → vermelho
   *   t=0.02   anel de poeira rente ao chão, largo e baixo
   *   t=0.06   pluma de fumaça que sobe, se abre e sobrevive ao fogo
   *   t=0      estilhaços: pedaços sólidos girando, com quique no chão
   *
   * Blending NORMAL de propósito em tudo: aditivo sobre o fog escuro deste jogo
   * estoura o tone mapping (armadilha já registrada em explosives.js).
   *
   * PERF: o rig (17 malhas) e a luz vêm de pools fixos criados em createFx() —
   * nada é alocado nem descartado aqui. Ver o comentário de topo do arquivo.
   */
  function explosion(position, radius = 5) {
    const rig = borrowExplosionRig();
    resetRig(rig, position);
    rig.group.position.copy(position);
    rig.group.visible = true;
    const layers = [];

    // 1. Clarão da detonação — estoura e some em ~0.09 s.
    layers.push({ mesh: rig.flash, from: 0.3, to: 2.9, fade: 0.09, delay: 0 });

    // 2. Frente de choque — casca fina e quase transparente, a coisa mais
    //    rápida da cena: chega ao raio total em 0.22 s. É ela que dá a leitura
    //    de ONDA em vez de bola.
    layers.push({ mesh: rig.front, from: 0.4, to: radius * 1.25, fade: 0.22, delay: 0, ease: 'out' });

    // 3. Bola de fogo em lobos deslocados — turbulência em vez de esfera.
    rig.lobes.forEach((lobe, index) => {
      const angle = index * 2.399;
      layers.push({
        mesh: lobe,
        from: 0.5,
        to: radius * (0.44 + (index % 4) * 0.09),
        fade: 0.4 + (index % 3) * 0.11,
        delay: index * 0.012,
        cool: true,
        rise: 0.5 + (index % 3) * 0.35,
        drift: [Math.cos(angle) * 0.9, Math.sin(angle) * 0.9],
      });
    });

    // 4. Anel de poeira rasteiro — largo e baixo, some devagar.
    layers.push({ mesh: rig.dust, from: 0.6, to: radius * 2.1, fade: 0.75, delay: 0.02, ease: 'out' });

    // 5. Pluma de fumaça.
    rig.smokes.forEach((smoke, index) => {
      const angle = index * 2.243;
      layers.push({
        mesh: smoke, from: 0.7, to: 1.9 + index * 0.26, fade: 1.5 + index * 0.06,
        delay: 0.07 + index * 0.025, rise: 1.2 + index * 0.16,
        drift: [Math.cos(angle) * 0.5, Math.sin(angle) * 0.5],
      });
    });

    const light = borrowFlareLight();
    light.color.set(0xff8b3c);
    light.distance = radius * 4;
    light.decay = 2;
    light.position.copy(position);

    // 6. Estilhaços sólidos girando + faíscas + terra arrancada.
    debris(position, 0x35302a, Math.round(9 + radius));
    spawnParticles(position, 0xffe6b4, 18, 12, 8, 0.5);
    spawnParticles(position, 0xff8c3a, 12, 7.5, 9, 0.42);
    spawnParticles(position, 0x2f2a24, 10, 5, 6, 1.2);
    scorch(position, radius);
    effects.push({ rig, life: 2.2, max: 2.2, layers, light, radius });
    // Tranco curto e forte, em vez de um empurrão longo.
    shake = Math.max(shake, Math.min(0.46, 0.12 + radius * 0.045));
  }

  /** Marca preta no chão sob a explosão — reusa o pool de poças. */
  function scorch(position, radius) {
    const mesh = pools[poolIndex];
    poolIndex = (poolIndex + 1) % POOL_COUNT;
    mesh.visible = true;
    mesh.position.set(position.x, 0.014, position.z);
    const scale = Math.max(1.2, radius * 0.42);
    mesh.scale.set(scale, scale * (0.85 + Math.random() * 0.3), 1);
    mesh.rotation.z = Math.random() * Math.PI;
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
    for (const chunk of chunks) {
      if (chunk.life <= 0) continue;
      chunk.life -= dt;
      chunk.velocity.y -= 17 * dt;
      chunk.mesh.position.addScaledVector(chunk.velocity, dt);
      chunk.mesh.rotation.x += chunk.spin.x * dt;
      chunk.mesh.rotation.y += chunk.spin.y * dt;
      chunk.mesh.rotation.z += chunk.spin.z * dt;
      if (chunk.mesh.position.y < 0.06) {
        chunk.mesh.position.y = 0.06;
        chunk.velocity.y *= -0.34;
        chunk.velocity.x *= 0.58;
        chunk.velocity.z *= 0.58;
        chunk.spin.multiplyScalar(0.45);
      }
      // Só apaga no fim: o destroço fica no chão até o último quarto de vida.
      chunk.mesh.material.opacity = Math.min(1, (chunk.life / chunk.max) * 4);
      if (chunk.life <= 0) chunk.mesh.visible = false;
    }
    muzzleLight.intensity = Math.max(0, muzzleLight.intensity - dt * 60);
    for (let i = effects.length - 1; i >= 0; i -= 1) {
      const effect = effects[i];
      effect.life -= dt;
      const elapsed = effect.max - effect.life;
      for (const layer of effect.layers) {
        const t = (elapsed - layer.delay) / layer.fade;
        if (t < 0) { layer.mesh.visible = false; continue; }
        layer.mesh.visible = true;
        // `out` freia bem mais forte: é a curva da frente de choque e do anel
        // de poeira, que saem quase instantâneos e depois quase param.
        const eased = t >= 1 ? 1 : layer.ease === 'out' ? 1 - (1 - t) ** 5 : 1 - (1 - t) ** 3;
        layer.mesh.scale.setScalar(layer.from + (layer.to - layer.from) * eased);
        layer.mesh.material.opacity = Math.max(0, 1 - t) * (layer.mesh.material.userData?.base ?? 1);
        if (layer.rise) layer.mesh.position.y += layer.rise * dt;
        if (layer.drift) {
          layer.mesh.position.x += layer.drift[0] * dt;
          layer.mesh.position.z += layer.drift[1] * dt;
        }
        // A bola de fogo esfria de amarelo-claro para vermelho-escuro.
        if (layer.cool) layer.mesh.material.color.setRGB(1, Math.max(0.12, 0.7 - t * 0.62), Math.max(0.04, 0.28 - t * 0.3));
        if (t >= 1) layer.mesh.visible = false;
      }
      // Luz: pico forte e curto (a detonação), depois um rescaldo alaranjado.
      effect.light.intensity = elapsed < 0.08
        ? 40 * (1 - elapsed / 0.08) + 12
        : Math.max(0, 12 * (1 - (elapsed - 0.08) / 0.55));
      if (effect.life <= 0) {
        // PERF: nunca scene.remove/dispose — devolve o rig e a luz aos pools.
        effect.rig.group.visible = false;
        effect.rig.busy = false;
        releaseFlareLight(effect.light);
        effects.splice(i, 1);
      }
    }
    shake *= Math.pow(0.04, dt);
  }

  function rumble(value) {
    shake = Math.max(shake, value);
  }

  return {
    impact, blood, bloodPool, debris, tracer, decal, muzzle, enemyMuzzle, explosion, rumble, update,
    borrowFlareLight, releaseFlareLight, borrowAuraLight, releaseAuraLight,
    get shake() { return shake; },
  };
}
