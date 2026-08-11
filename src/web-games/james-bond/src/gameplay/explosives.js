import * as THREE from '../../../vendor/three.module.min.js';
import { hasLineOfSight } from '../world.js';
import { stepProjectile } from './ballistics.js';

const direction = new THREE.Vector3();
const origin = new THREE.Vector3();
const blastDir = new THREE.Vector3();

const GRENADE_BLAST = 6.5;
// Cadeia barril->carro->barril: raio de ruído da explosão. `*5` (32.5 m, quase
// o mapa inteiro) colocava os 12 inimigos em replan simultâneo — ver
// ai/guards.js. `*2.5` ainda alerta o quarteirão, sem esgotar o grafo inteiro.
const NOISE_RADIUS_MULTIPLIER = 2.5;
const NOISE_RADIUS_CAP = 16;

// PERF: geometria/material de granada e foguete são MÓDULO-ESCOPO — criados
// uma única vez para a vida inteira da página (nunca por detonação, nunca por
// deploy). `createExplosives` é chamado de novo a cada deploy (combat.js
// recria o módulo inteiro), então os POOLS abaixo usam init preguiçosa
// guardada em variáveis de módulo: a primeira chamada cria, as seguintes
// reaproveitam os mesmos meshes (a `scene` é sempre a mesma instância única
// criada em main.js).
const grenadeGeometry = new THREE.SphereGeometry(0.14, 10, 8);
const grenadeMaterial = new THREE.MeshStandardMaterial({ color: 0x334036, metalness: 0.65 });
const rocketBodyGeometry = new THREE.CylinderGeometry(0.055, 0.055, 0.34, 10);
const rocketBodyMaterial = new THREE.MeshStandardMaterial({ color: 0x4a4f43, roughness: 0.6, metalness: 0.5 });
const rocketNoseGeometry = new THREE.ConeGeometry(0.075, 0.18, 10);
const rocketNoseMaterial = new THREE.MeshStandardMaterial({ color: 0x8e3a2c, roughness: 0.55, metalness: 0.4 });
const rocketFlameGeometry = new THREE.ConeGeometry(0.07, 0.3, 8);
const rocketFlameMaterial = new THREE.MeshBasicMaterial({ color: 0xffb457, transparent: true, opacity: 0.85, depthWrite: false });

const GRENADE_POOL_SIZE = 2;   // igual ao teto de granadas simultâneas no ar
const ROCKET_POOL_SIZE = 2;
let grenadePool = null;
let rocketPool = null;

function ensurePools(scene) {
  if (grenadePool) return;
  grenadePool = Array.from({ length: GRENADE_POOL_SIZE }, () => {
    const mesh = new THREE.Mesh(grenadeGeometry, grenadeMaterial);
    mesh.visible = false;
    mesh.userData.fx = true;
    scene.add(mesh);
    return { mesh, busy: false };
  });
  rocketPool = Array.from({ length: ROCKET_POOL_SIZE }, () => {
    const group = new THREE.Group();
    group.userData.fx = true;
    group.visible = false;
    const body = new THREE.Mesh(rocketBodyGeometry, rocketBodyMaterial);
    body.rotation.x = Math.PI / 2;
    const nose = new THREE.Mesh(rocketNoseGeometry, rocketNoseMaterial);
    nose.rotation.x = Math.PI / 2;
    nose.position.z = 0.24;
    // Chama do propelente: NormalBlending de propósito — additive sobre o
    // bloom/fog escuro do jogo estoura o tone mapping.
    const flame = new THREE.Mesh(rocketFlameGeometry, rocketFlameMaterial);
    flame.rotation.x = -Math.PI / 2;
    flame.position.z = -0.3;
    group.add(body, nose, flame);
    scene.add(group);
    return { group, flame, busy: false };
  });
}

function borrowFromPool(pool) {
  let entry = pool.find((item) => !item.busy);
  if (!entry) entry = pool[0]; // esgotado: reaproveita o mais antigo em vez de crescer o pool
  entry.busy = true;
  return entry;
}

function releaseToPool(entry) {
  entry.busy = false;
}

// Granadas arremessadas, foguetes do lança-granadas e barris explosivos, com
// detonação em cadeia.
export function createExplosives(scene, camera, game, audio, fx, world, guards, damagePlayer) {
  ensurePools(scene);
  const projectiles = [];
  const pendingFuses = []; // detonações em cadeia agendadas no RELÓGIO DO JOGO
  // A sonda é a física REAL do mapa (paredes, lajes, degraus), com altura de
  // verdade — não a célula 2D do grid. Ver o cabeçalho de ballistics.js: era a
  // célula 2D que fazia a granada atravessar o piso do segundo andar e bater
  // numa parede invisível ao ser arremessada do mezanino.
  const probe = game.physics;
  // Peça explosiva destruída detona por conta própria: é assim que a cadeia
  // barril → carro → barril se propaga pela rua. O atraso curto é de propósito
  // — escalona a cadeia (soa e se vê como uma sequência, não como um estrondo
  // só) e quebra a recursão explode → blast → explode na mesma pilha.
  //
  // PERF/CORREÇÃO: antes disto era `window.setTimeout`, um relógio de PAREDE
  // desligado do jogo — disparava durante pausa, no menu ou com o mapa tático
  // aberto, e mutava a `run` errada se a missão fosse abortada no meio do
  // atraso. Agora a fila é drenada em `update(dt)`, no relógio de jogo
  // (`game.time`), e `dispose()` a esvazia.
  world.props.explodeHandler = (position, radius) => {
    pendingFuses.push({ at: game.time + 0.11 + Math.random() * 0.26, position, radius });
  };

  /** @returns {boolean} false quando já há granadas demais no ar. */
  function throwGrenade() {
    if (projectiles.filter((entry) => entry.kind === 'grenade').length >= GRENADE_POOL_SIZE) return false;
    camera.getWorldDirection(direction);
    const slot = borrowFromPool(grenadePool);
    const mesh = slot.mesh;
    mesh.visible = true;
    mesh.position.copy(camera.position).addScaledVector(direction, 0.8);
    projectiles.push({
      kind: 'grenade', mesh, slot, radius: GRENADE_BLAST, radius3d: 0.14,
      velocity: direction.clone().multiplyScalar(10).add(new THREE.Vector3(0, 3.2, 0)),
      fuse: 2.15,
    });
    return true;
  }

  /**
   * Dispara um foguete visível a partir da boca do cano. Ao contrário da
   * granada, detona no primeiro impacto em vez de esperar o pavio.
   */
  function fireRocket(from, weapon) {
    camera.getWorldDirection(direction);
    const slot = borrowFromPool(rocketPool);
    const mesh = slot.group;
    mesh.visible = true;
    mesh.position.copy(from).addScaledVector(direction, 0.35);
    mesh.lookAt(origin.copy(mesh.position).add(direction));
    const light = fx.borrowFlareLight();
    light.color.set(0xff9a44);
    light.distance = 7;
    light.decay = 2;
    light.intensity = 3.2;
    light.position.copy(mesh.position);
    game.telemetry.rockets = (game.telemetry.rockets || 0) + 1;
    projectiles.push({
      kind: 'rocket', mesh, slot, light, radius: weapon.blastRadius || GRENADE_BLAST, radius3d: 0.09,
      velocity: direction.clone().multiplyScalar(weapon.muzzleSpeed || 34),
      // restitution 0 — o foguete não quica: `step.hitSolid` já o detona.
      fuse: 6, gravity: 3.4, armed: 0.05, restitution: 0,
    });
    return true;
  }

  function explode(position, radius) {
    game.telemetry.explosions = (game.telemetry.explosions || 0) + 1;
    fx.explosion(position, radius);
    audio.explosion(position);
    guards.notifyNoise(position, Math.min(NOISE_RADIUS_CAP, radius * NOISE_RADIUS_MULTIPLIER), game.time);
    guards.enemies.forEach((enemy) => {
      if (!enemy.alive) return;
      const distance = enemy.root.position.distanceTo(position);
      if (distance < radius && hasLineOfSight(world, position, enemy.root.position)) {
        blastDir.copy(enemy.root.position).sub(position).normalize();
        guards.damage(enemy, 120 * (1 - distance / radius), 'torso', blastDir, 1.6);
      }
    });
    const playerDistance = camera.position.distanceTo(position);
    if (playerDistance < radius && hasLineOfSight(world, position, camera.position)) damagePlayer(72 * (1 - playerDistance / radius));
    // Cenário: a onda de choque fere E desloca tudo que alcança — barris,
    // carros, engradados e tambores. Quem morre explodindo entra na cadeia.
    world.props.blast(position, radius);
  }

  function detonate(projectile, index, position) {
    explode(position.clone(), projectile.radius);
    projectile.mesh.visible = false;
    releaseToPool(projectile.slot);
    if (projectile.light) fx.releaseFlareLight(projectile.light);
    projectiles.splice(index, 1);
  }

  /** Primeiro inimigo vivo dentro do raio de contato do foguete. */
  function enemyContact(position) {
    return guards.enemies.find((enemy) => enemy.alive
      && Math.abs(enemy.root.position.y + 0.9 - position.y) < 1.5
      && Math.hypot(enemy.root.position.x - position.x, enemy.root.position.z - position.z) < 0.75);
  }

  function update(dt) {
    // Fusíveis em cadeia: drenados no relógio de jogo, nunca em pausa/menu.
    for (let i = pendingFuses.length - 1; i >= 0; i -= 1) {
      const fuse = pendingFuses[i];
      if (game.time < fuse.at) continue;
      pendingFuses.splice(i, 1);
      explode(fuse.position, fuse.radius);
    }

    for (let i = projectiles.length - 1; i >= 0; i -= 1) {
      const projectile = projectiles[i];
      projectile.fuse -= dt;
      if (projectile.armed > 0) projectile.armed -= dt;

      // Um único passo balístico para os dois tipos: mesma colisão 3D contra a
      // física real. O que muda é a REAÇÃO — o foguete detona no primeiro
      // contato, a granada quica e espera o pavio.
      const step = stepProjectile({
        position: projectile.mesh.position,
        velocity: projectile.velocity,
        radius: projectile.radius3d,
        gravity: projectile.gravity ?? 12,
        restitution: projectile.restitution ?? 0.48,
        friction: 0.82,
      }, dt, probe);
      origin.set(step.from.x, step.from.y, step.from.z);

      if (projectile.kind === 'rocket') {
        // Aponta o foguete para onde ele está indo e faz a chama tremular.
        projectile.mesh.lookAt(blastDir.copy(projectile.mesh.position).add(projectile.velocity));
        if (projectile.light) projectile.light.position.copy(projectile.mesh.position);
        const flame = projectile.slot.flame;
        if (flame) flame.scale.setScalar(0.75 + Math.random() * 0.6);
        const hitEnemy = projectile.armed <= 0 ? enemyContact(projectile.mesh.position) : null;
        if (step.hitSolid || step.landed || hitEnemy || projectile.fuse <= 0) {
          // Bateu em parede: detona no ponto ANTERIOR, do lado de fora dela,
          // senão a explosão nasce dentro do volume e não atinge ninguém.
          detonate(projectile, i, step.hitSolid ? origin : projectile.mesh.position);
        }
        continue;
      }

      if (projectile.fuse <= 0) detonate(projectile, i, projectile.mesh.position);
    }
  }

  function dispose() {
    projectiles.forEach((entry) => {
      entry.mesh.visible = false;
      releaseToPool(entry.slot);
      if (entry.light) fx.releaseFlareLight(entry.light);
    });
    projectiles.length = 0;
    pendingFuses.length = 0;
  }

  return {
    throwGrenade, fireRocket, explode, update, dispose,
    get inFlight() { return projectiles.length; },
  };
}
