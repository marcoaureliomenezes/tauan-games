import * as THREE from '../../vendor/three.module.min.js';
import { CONFIG } from './config.js';
import { WEAPONS, freshAmmo } from './content/weapons.js';
import { createViewModel } from './view-model.js';
import { createExplosives } from './gameplay/explosives.js';
import { isPrecisionShot, computeSpread } from './gameplay/spread.js';

const raycaster = new THREE.Raycaster();
const direction = new THREE.Vector3();
const right = new THREE.Vector3();
const upv = new THREE.Vector3();
const muzzle = new THREE.Vector3();
const normal = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);
const X_AXIS = new THREE.Vector3(1, 0, 0);
const Y_AXIS = new THREE.Vector3(0, 1, 0);
// Digit1..Digit5 -> slot do arsenal (ver `update`): hoistado para o escopo do
// módulo para não alocar array+closure a cada fixed step.
const WEAPON_SLOT_KEYS = ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5'];

/**
 * PERF LAW (ver o comentário de topo de fx.js): luzes NUNCA entram/saem da
 * cena depois do primeiro deploy. `createCombatLights` é chamado UMA VEZ, em
 * main.js, na inicialização — não a cada `createCombat()` (que roda de novo
 * por deploy). `setActive` só alterna intensidade.
 */
export function createCombatLights(camera) {
  // flashlight stays on layer 0 so it never blows out the view model (layer 1)
  const flashlight = new THREE.SpotLight(0xe7f3ec, 0, 26, 0.46, 0.6, 1.8);
  const flashlightTarget = new THREE.Object3D();
  flashlight.position.set(0.18, -0.12, -0.2);
  flashlightTarget.position.set(0, -0.1, -8);
  flashlight.target = flashlightTarget;
  // Preenchimento da arma (camada 1 apenas): luz HEMISFÉRICA, não pontual.
  //
  // A luz pontual ficava a ~30 cm do modelo e caía com 1/d², o que produzia um
  // realce especular saturado: a lâmina da faca virava uma mancha branca sem
  // forma, e no modo `compatibility` (onde performance.js troca Standard por
  // Lambert, sem metalness/roughness para segurar o brilho) a arma inteira
  // lavava. A hemisférica não tem distância nem realce: ilumina por igual, o
  // metal continua metal e o cabo continua escuro.
  const fill = new THREE.HemisphereLight(0xe4ece8, 0x1a1f24, 0);
  fill.layers.set(1);
  camera.add(flashlight, flashlightTarget, fill);
  return {
    flashlight,
    fill,
    setActive(active) {
      flashlight.intensity = active ? 30 : 0;
      fill.intensity = active ? 1.15 : 0;
    },
  };
}

/** Meshes/InstancedMesh sólidos do mundo, raycastáveis, excluindo o que
 * carrega `userData.noRay` (céu, montanhas, chão decorativo, guias, disco de
 * extração). Construído UMA vez por deploy — nunca por tiro. */
function buildWorldRaycastTargets(world) {
  const targets = [];
  world.group.traverse((object) => {
    if (!(object.isMesh || object.isInstancedMesh) || object.userData.noRay) return;
    targets.push(object);
  });
  return targets;
}

export function createCombat(scene, camera, game, input, audio, fx, world, guards, damagePlayer, ui) {
  let cooldown = 0;
  let reloadTimer = 0;
  let reloadTotal = 0;
  let triggerReady = true;
  let bloom = 0;
  let recoverable = 0;
  let adsT = 0;
  // F2 — precisão de primeiro tiro: tempo desde o último disparo (qualquer
  // arma). Começa em Infinity de propósito — o primeiro tiro de uma missão
  // nova é sempre o "tiro deliberado", nunca precisa de um `update(dt)`
  // prévio para se qualificar.
  let timeSinceLastShot = Infinity;
  game.ammo = freshAmmo();
  game.view = { adsT: 0, spread: 0, bloom: 0 };

  const explosives = createExplosives(scene, camera, game, audio, fx, world, guards, damagePlayer);
  camera.layers.enable(1);
  // O view-model nasce na arma que o ESTADO diz — nunca num padrão próprio.
  if (!WEAPONS[game.currentWeapon]) game.currentWeapon = 'deagle';
  const viewModel = createViewModel(camera, game.currentWeapon);

  // PERF (item 5 da revisão de performance): registro explícito de alvos de
  // raycast, montado uma vez aqui — nunca mais `intersectObjects(scene.children,
  // true)`. Isso exclui, de graça: os ~220 meshes de pool de fx.js (tracers,
  // partículas, decals, poças, estilhaços, rigs de explosão), o view-model
  // (arma em primeira pessoa), céu/montanhas, e os 12 `SkinnedMesh` dos
  // inimigos (o raycast neles aplicava bone transform POR VÉRTICE — o mais
  // caro da cena). As hitboxes de inimigo (já existiam para isto, ver
  // `enemy-assets.js buildHitBoxes`) entram por fora, filtradas por `alive`
  // a cada tiro — sempre corretas, sem precisar de um registro mutável.
  const worldRaycastTargets = buildWorldRaycastTargets(world);
  function raycastTargets() {
    const targets = worldRaycastTargets.slice();
    for (const enemy of guards.enemies) {
      if (!enemy.alive) continue;
      for (const mesh of enemy.hitMeshes) targets.push(mesh);
    }
    return targets;
  }

  /**
   * @param {boolean} precise F2 — quando true, ignora quase todo o
   * espalhamento de `bloom` (ver gameplay/spread.js). `false` (padrão) é o
   * valor usado para o HUD (`game.view.spread`, ver `update`): o crosshair
   * reflete o estado de AQUECIMENTO da arma, não o bônus pontual de um tiro
   * que ainda nem saiu.
   */
  function currentSpread(precise = false) {
    const weapon = WEAPONS[game.currentWeapon];
    const speed = game.player.speed || 0;
    const moveFactor = game.player.grounded === false ? 2.2 : speed > 5.5 ? 1.7 : speed > 0.5 ? 1.3 : 1;
    const crouchFactor = game.player.crouched ? 0.8 : 1;
    const adsFactor = 1 - adsT * 0.68;
    return computeSpread(weapon, { bloom, moveFactor, crouchFactor, adsFactor, precise });
  }

  function switchWeapon(id) {
    if (!WEAPONS[id] || reloadTimer > 0 || id === game.currentWeapon) return;
    game.currentWeapon = id;
    viewModel.setWeapon(id);
    cooldown = Math.max(cooldown, 0.32);
    audio.reload(0.32);
    ui.updateHud();
  }

  function cycleWeapon(directionValue) {
    const ids = Object.keys(WEAPONS).sort((a, b) => WEAPONS[a].slot - WEAPONS[b].slot);
    const index = ids.indexOf(game.currentWeapon);
    switchWeapon(ids[(index + directionValue + ids.length) % ids.length]);
  }

  /**
   * Aquecimento de shader (chamado por main.js, no deploy, antes de
   * `renderer.compileAsync`): monta cada modelo de arma por um instante — sem
   * isso as armas nunca escolhidas nesta run (ex.: RPG/faca com o jogador
   * começando na pistola) só compilam seus materiais no primeiro troca REAL,
   * no meio do jogo. Não usa `switchWeapon` de propósito: aquilo mexe em
   * cooldown/áudio/HUD, efeitos colaterais que não fazem sentido aqui.
   */
  function warmWeaponModels() {
    const current = game.currentWeapon;
    for (const id of Object.keys(WEAPONS)) {
      if (id !== current) viewModel.setWeapon(id);
    }
    viewModel.setWeapon(current);
  }

  function reload() {
    const ammo = game.ammo[game.currentWeapon];
    const weapon = WEAPONS[game.currentWeapon];
    if (reloadTimer > 0 || ammo.mag >= weapon.mag || ammo.reserve <= 0) return;
    reloadTimer = reloadTotal = weapon.reload;
    audio.reload(weapon.reload);
  }

  function completeReload() {
    const ammo = game.ammo[game.currentWeapon];
    const weapon = WEAPONS[game.currentWeapon];
    const amount = Math.min(weapon.mag - ammo.mag, ammo.reserve);
    ammo.mag += amount;
    if (ammo.reserve !== Infinity) ammo.reserve -= amount;
  }

  function throwGrenade() {
    explosives.throwGrenade();
  }

  function shoot() {
    const weapon = WEAPONS[game.currentWeapon];
    const ammo = game.ammo[game.currentWeapon];
    if (ammo.mag <= 0) { audio.dry(); cooldown = 0.24; return; }
    // F2: decide ANTES de zerar o relógio — é o tempo até ESTE tiro que
    // importa, não o próximo. Calculado para toda arma (mesmo faca/lança-
    // -granadas), mas só o `hitscan` de fireRay consome o resultado.
    const precise = isPrecisionShot(timeSinceLastShot, weapon);
    timeSinceLastShot = 0;
    if (weapon.kind === 'melee') return swingKnife(weapon);
    if (weapon.kind === 'throwable') return lobGrenade(weapon);
    if (weapon.kind === 'launcher') return fireLauncher(weapon);
    ammo.mag -= 1;
    cooldown = weapon.cadence;
    game.shots += 1;
    audio.gun(weapon, camera.position);
    viewModel.onShoot();
    fx.muzzle(camera, Boolean(weapon.suppressed));
    guards.notifyNoise(camera.position, weapon.noise, game.time);
    // F2: o raio sai com a câmera AINDA na direção mirada — o recuo desloca a
    // mira só DEPOIS, afetando o tiro seguinte. Aplicado antes, um Desert
    // Eagle (recoil 0.048 rad) erraria o alvo por ~4,7 m a 97 m mesmo com a
    // mira exata em cima dele.
    const pellets = weapon.pellets || 1;
    for (let i = 0; i < pellets; i += 1) fireRay(weapon, i > 0, precise);
    bloom = Math.min(2.6, bloom + CONFIG.bloomPerShot * (weapon.pellets ? 1.9 : 1));
    const aimKick = weapon.recoil * (1 - adsT * 0.35) * (1 + bloom * 0.25);
    pitchCamera(aimKick);
    yawCamera((Math.random() - 0.5) * weapon.recoil * 0.5);
    recoverable += aimKick * 0.72;
  }

  // Faca: golpe de curtíssimo alcance, sem munição e quase silencioso — dá para
  // limpar um corredor sem acordar o mapa inteiro.
  function swingKnife(weapon) {
    cooldown = weapon.cadence;
    game.shots += 1;
    viewModel.onShoot();
    audio.knife(camera.position);
    guards.notifyNoise(camera.position, weapon.noise, game.time);
    camera.getWorldDirection(direction);
    raycaster.set(camera.position, direction);
    raycaster.far = weapon.range;
    // Registro curado (defesa-em-profundidade: os flags userData continuam
    // filtrando depois da interseção, mas agora não há mais fx/view-model/
    // SkinnedMesh no conjunto testado).
    const hits = raycaster.intersectObjects(raycastTargets(), true);
    const hit = hits.find((entry) => !entry.object.userData.viewModel && !entry.object.userData.fx
      && !entry.object.userData.noRay && entry.distance > 0.1);
    if (!hit || hit.distance > weapon.range) return;
    const enemy = hit.object.userData.enemy;
    if (enemy) {
      const zone = hit.object.userData.zone || 'torso';
      game.hits += 1;
      const killed = guards.damage(enemy, weapon.damage, zone, direction, weapon.knock);
      fx.blood(hit.point, direction);
      audio.blood(hit.point);
      ui.hitmarker(killed, zone === 'head');
      return;
    }
    const prop = world.props.fromHit(hit);
    if (prop) world.props.damage(prop, weapon.damage, direction, 0);
    if (hit.face) {
      normal.copy(hit.face.normal).transformDirection(hit.object.matrixWorld);
      fx.impact(hit.point, 0xbfc6c9, normal);
    }
    audio.impact(hit.point, true);
  }

  // Lança-granadas: munição infinita, uma saída a cada 5 s. O projétil é
  // visível em voo e detona com o mesmo raio da granada de mão.
  function fireLauncher(weapon) {
    cooldown = weapon.cadence;
    game.shots += 1;
    audio.launcher(camera.position);
    viewModel.onShoot();
    fx.muzzle(camera, false);
    guards.notifyNoise(camera.position, weapon.noise, game.time);
    const aimKick = weapon.recoil;
    pitchCamera(aimKick);
    recoverable += aimKick * 0.72;
    viewModel.muzzleWorld(muzzle);
    explosives.fireRocket(muzzle, weapon);
  }

  function lobGrenade(weapon) {
    if (!explosives.throwGrenade()) return;
    cooldown = weapon.cadence;
    viewModel.onShoot();
    guards.notifyNoise(camera.position, weapon.noise, game.time);
  }

  // Recoil must rotate in quaternion space: PointerLockControls composes YXZ euler,
  // and mixing euler orders here makes the camera drift. Local-axis quaternion kicks
  // are order-independent and get absorbed cleanly on the next mouse move.
  const kickQuat = new THREE.Quaternion();
  function pitchCamera(angle) {
    kickQuat.setFromAxisAngle(X_AXIS, angle);
    camera.quaternion.multiply(kickQuat);
    // No modo criança o coice não pode furar o cone de visão: sem isto, uma
    // rajada de AK-47 empurra a mira para o céu e ela fica presa lá.
    if (input.kidsMode) input.clampPitch();
  }
  function yawCamera(angle) {
    kickQuat.setFromAxisAngle(Y_AXIS, angle);
    camera.quaternion.multiply(kickQuat);
  }

  // range: alcance efetivo do raycast, por arma (F2) — sem isto o corte fixo
  // de 90 m truncava um tiro no meio da rua principal antes de ela acabar
  // (~139 m de diagonal no maior quarteirão). 90 sobra como fallback só para
  // uma arma futura que não declare `range`.
  function fireRay(weapon, pellet, precise = false) {
    camera.getWorldDirection(direction);
    right.crossVectors(direction, UP).normalize();
    upv.crossVectors(right, direction).normalize();
    const spread = currentSpread(precise);
    const rx = (Math.random() + Math.random() - 1) * spread;
    const ry = (Math.random() + Math.random() - 1) * spread;
    direction.addScaledVector(right, rx).addScaledVector(upv, ry).normalize();
    const range = weapon.range ?? 90;
    raycaster.set(camera.position, direction);
    raycaster.far = range;
    const hits = raycaster.intersectObjects(raycastTargets(), true);
    const hit = hits.find((entry) => !entry.object.userData.viewModel && !entry.object.userData.fx
      && !entry.object.userData.noRay && entry.distance > 0.3);
    // Telemetria de TESTE: registro cru do último tiro (direção, spread e o
    // que o raio encontrou) — os specs diagnosticam mira/precisão sem
    // screenshot. Custo: um objeto pequeno por tiro.
    game.telemetry.lastShot = {
      precise, spread,
      dir: { x: direction.x, y: direction.y, z: direction.z },
      hit: hit ? { distance: hit.distance, zone: hit.object.userData.zone || null,
        enemyId: hit.object.userData.enemy?.id ?? null } : null,
    };
    viewModel.muzzleWorld(muzzle);
    if (!hit) {
      fx.tracer(muzzle, temp.copy(camera.position).addScaledVector(direction, range));
      return;
    }
    if (!pellet) fx.tracer(muzzle, hit.point);
    const enemy = hit.object.userData.enemy;
    if (enemy) {
      const zone = hit.object.userData.zone || 'torso';
      game.hits += 1;
      const killed = guards.damage(enemy, weapon.damage, zone, direction, weapon.knock);
      fx.blood(hit.point, direction);
      audio.blood(hit.point);
      ui.hitmarker(killed, zone === 'head');
      return;
    }
    // Cenário destrutível: o tiro tira vida da peça e a sacode. Barril e carro
    // detonam ao morrer; engradado e tambor se despedaçam.
    const prop = world.props.fromHit(hit);
    if (prop) world.props.damage(prop, weapon.damage, direction, 0);
    const metal = hit.object.material?.metalness > 0.4 || prop?.kind === 'barrel' || prop?.kind === 'drum';
    if (hit.face) {
      normal.copy(hit.face.normal).transformDirection(hit.object.matrixWorld);
      fx.impact(hit.point, metal ? 0xffd277 : 0xcbb998, normal);
    } else {
      fx.impact(hit.point, metal ? 0xffd277 : 0xcbb998);
    }
    audio.impact(hit.point, metal);
    if (!metal && Math.random() < 0.18) audio.ricochet(hit.point);
  }

  const temp = new THREE.Vector3();

  function update(dt) {
    cooldown -= dt;
    timeSinceLastShot += dt;
    if (reloadTimer > 0) {
      reloadTimer -= dt;
      if (reloadTimer <= 0) completeReload();
    }
    bloom = Math.max(0, bloom - dt * CONFIG.bloomDecay);
    if (recoverable > 0.0001) {
      const step = recoverable * Math.min(1, dt * CONFIG.recoilRecover);
      pitchCamera(-step);
      recoverable -= step;
    }
    const wantAds = input.aiming && reloadTimer <= 0 && !game.player.sprinting;
    adsT += ((wantAds ? 1 : 0) - adsT) * Math.min(1, dt * CONFIG.adsSpeed);
    if (!input.firing) triggerReady = true;
    const weapon = WEAPONS[game.currentWeapon];
    game.telemetry.trigger = { firing: input.firing, cooldown, reloadTimer, triggerReady, weapon: game.currentWeapon };
    if (input.firing && cooldown <= 0 && reloadTimer <= 0 && (weapon.auto || triggerReady)) {
      shoot();
      triggerReady = false;
    }
    if (input.consume('KeyE') || input.consume('KeyR')) reload();
    if (input.consume('KeyG')) throwGrenade();
    if (input.consume('KeyQ')) cycleWeapon(1);
    if (input.consume('WheelDown')) cycleWeapon(1);
    if (input.consume('WheelUp')) cycleWeapon(-1);
    WEAPON_SLOT_KEYS.forEach((code, index) => {
      if (input.consume(code)) switchWeapon(Object.keys(WEAPONS).find((id) => WEAPONS[id].slot === index + 1));
    });
    const look = input.consumeLook();
    viewModel.update({
      dt, time: game.time, moving: playerMoving(), sprinting: Boolean(game.player.sprinting),
      adsT, lookX: look.x, lookY: look.y,
      reloadT: reloadTimer > 0 ? 1 - reloadTimer / reloadTotal : -1,
    });
    game.view.adsT = adsT;
    game.view.spread = currentSpread();
    game.view.bloom = bloom;
    ui.crosshair(game.view);
    explosives.update(dt);
    world.props.update(dt);
  }

  function playerMoving() {
    return input.held('KeyW') || input.held('KeyA') || input.held('KeyS') || input.held('KeyD');
  }

  // Gancho de TESTE: replica o raio de fireRay sem espalhamento e devolve as
  // primeiras interseções cruas — permite aos specs diagnosticarem "o que o
  // tiro acertaria" sem disparar de verdade. Não usado pelo jogo.
  function debugRay(range = 200) {
    camera.getWorldDirection(direction);
    raycaster.set(camera.position, direction);
    raycaster.far = range;
    return raycaster.intersectObjects(raycastTargets(), true).slice(0, 5).map((entry) => ({
      distance: entry.distance,
      name: entry.object.name || entry.object.type,
      zone: entry.object.userData.zone || null,
      enemyId: entry.object.userData.enemy?.id ?? null,
      fx: Boolean(entry.object.userData.fx), noRay: Boolean(entry.object.userData.noRay),
      viewModel: Boolean(entry.object.userData.viewModel),
    }));
  }

  return { update, switchWeapon, reload, warmWeaponModels, explode: explosives.explode, debugRay,
    get inFlight() { return explosives.inFlight; },
    // PERF: flashlight/fill NUNCA são removidos daqui — são permanentes (ver
    // `createCombatLights` em main.js), só a intensidade é alternada por
    // main.js em disposeRun()/deploy(). Nenhuma Light entra/sai da cena por
    // deploy.
    dispose() { viewModel.dispose(); explosives.dispose(); } };
}
