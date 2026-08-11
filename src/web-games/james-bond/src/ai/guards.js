import * as THREE from '../../../vendor/three.module.min.js';
import * as YUKA from '../../../vendor/james-bond/yuka-0.7.8.module.js';
import { CONFIG, DIFFICULTY } from '../config.js';
import { MISSIONS } from '../content/missions.js';
import { hasLineOfSight } from '../world.js';
import { buildSoldier } from './soldier-model.js';
import { buildNavGraph, nearestWalkableCell } from './nav-graph.js';
import { fireWeapon, meleeAttack } from './engage.js';
import { spawnEnemyModel, buildHitBoxes, hasEnemyModel } from './enemy-assets.js';
import {
  DEFAULT_SPAWN_RATE, DEFAULT_MAX_ALIVE, CORPSE_LINGER, groundPoolSize,
  createSpawnScheduler, pickSpawnCell,
} from '../gameplay/spawner.js';

const tempA = new THREE.Vector3();
const tempB = new THREE.Vector3();

// Comportamento por tipo. `model` aponta para a chave do manifesto de GLBs
// (vendor/models/enemies/manifest.json); quando ausente ou não carregado, o
// inimigo cai no modelo procedural de soldier-model.js.
//   float — altura de flutuação (fantasma não pisa no chão)
//   boss  — um só por mapa, muito mais vida
// Dez espécies a partir de seis GLBs + o soldado procedural. Duas espécies
// distintas por missão (ver `enemyMix` em content/missions.js): a leitura de um
// mapa melhora muito quando há dois inimigos com SILHUETA, COR e ANDAR
// diferentes disputando a atenção do jogador.
//
//   look — recoloração por matiz preservando o contraste interno do modelo
//          (ver `applyLook`); é o que dá identidade de cor a cada espécie sem
//          achatar o modelo numa mancha monocromática.
//   gait — personalidade de movimento: balanço vertical, rolagem lateral,
//          inclinação ao correr e velocidade da animação.
//   ring — cor do halo no chão quando a espécie está em alerta.
//   aura — luz própria (demônio brasa, fantasma frio).
const TYPE_STATS = {
  human: {
    melee: false, speedMul: 1, healthMul: 1, height: 1.85,
    ring: 0xee5b55, gait: { bob: 0.02, sway: 0.03, lean: 0.05, clip: 1 },
  },
  // --- Vampiros ------------------------------------------------------------
  vampire: {
    melee: true, speedMul: 1.85, healthMul: 0.9, damageMul: 1.6, model: 'vampire', height: 1.95,
    look: { hue: 0.98, saturation: 0.55, lightness: 0.78, emissive: 0x2a0208, emissiveIntensity: 0.3 },
    ring: 0xd42a3c, gait: { bob: 0.05, sway: 0.09, lean: 0.28, clip: 1.35 },
  },
  witch: {
    melee: true, speedMul: 1.35, healthMul: 1.1, damageMul: 1.5, model: 'vampire', height: 1.78,
    look: { hue: 0.76, saturation: 0.62, lightness: 0.7, emissive: 0x2d0a4a, emissiveIntensity: 0.45 },
    ring: 0x9d5be0, float: 0.35, aura: { color: 0x8a4fd6, intensity: 2.4, distance: 6 },
    gait: { bob: 0.16, sway: 0.14, lean: 0.1, clip: 0.9 },
  },
  // --- Fantasmas -----------------------------------------------------------
  phantom: {
    melee: true, speedMul: 1.15, healthMul: 0.7, damageMul: 1.35, model: 'phantom', height: 1.78,
    float: 1.0, ghost: true, noFlinch: true,
    look: { hue: 0.55, saturation: 0.16, lightness: 1.35, emissive: 0x6f8fa8, emissiveIntensity: 0.6, opacity: 0.52 },
    ring: 0x7fd4ff, aura: { color: 0x7fc4ff, intensity: 2.2, distance: 7 },
    gait: { bob: 0.22, sway: 0.2, lean: 0, clip: 0.85 },
  },
  wraith: {
    melee: true, speedMul: 1.75, healthMul: 0.55, damageMul: 1.5, model: 'phantom', height: 1.55,
    float: 0.8, ghost: true, noFlinch: true,
    look: { hue: 0.79, saturation: 0.5, lightness: 0.55, emissive: 0x3b1060, emissiveIntensity: 0.9, opacity: 0.44 },
    ring: 0xb464ff, aura: { color: 0x9040ff, intensity: 2.6, distance: 6 },
    gait: { bob: 0.3, sway: 0.28, lean: 0, clip: 1.45 },
  },
  // --- Brutamontes ---------------------------------------------------------
  brute: {
    melee: true, speedMul: 0.72, healthMul: 3.1, damageMul: 2.4, noFlinch: true, model: 'monster', height: 2.35,
    look: { hue: 0.56, saturation: 0.12, lightness: 1.2 },
    ring: 0xffb35c, gait: { bob: 0.13, sway: 0.11, lean: 0.16, clip: 0.78 },
  },
  ghoul: {
    melee: true, speedMul: 1.45, healthMul: 1.3, damageMul: 1.7, model: 'monster', height: 1.72,
    look: { hue: 0.24, saturation: 0.42, lightness: 0.72, emissive: 0x14300c, emissiveIntensity: 0.28 },
    ring: 0x86d13f, gait: { bob: 0.09, sway: 0.16, lean: 0.3, clip: 1.3 },
  },
  // Nome antigo mantido: `monster` continua válido como apelido de `brute`.
  monster: {
    melee: true, speedMul: 0.72, healthMul: 3, damageMul: 2.4, noFlinch: true, model: 'monster', height: 2.3,
    look: { hue: 0.09, saturation: 0.3, lightness: 0.9 },
    ring: 0xffb35c, gait: { bob: 0.13, sway: 0.11, lean: 0.16, clip: 0.78 },
  },
  // --- Demônios ------------------------------------------------------------
  demon: {
    melee: true, speedMul: 1.3, healthMul: 1.8, damageMul: 1.9, model: 'demon', height: 2.15,
    look: { hue: 0.02, saturation: 0.66, lightness: 0.85, emissive: 0x5a1004, emissiveIntensity: 0.55 },
    ring: 0xff6a2c, aura: { color: 0xff5a20, intensity: 3, distance: 7 },
    gait: { bob: 0.08, sway: 0.09, lean: 0.24, clip: 1.1 },
  },
  imp: {
    melee: true, speedMul: 2.1, healthMul: 0.65, damageMul: 1.2, model: 'demon', height: 1.25,
    look: { hue: 0.09, saturation: 0.8, lightness: 1.05, emissive: 0x6a3000, emissiveIntensity: 0.7 },
    ring: 0xffc24a, aura: { color: 0xff9a30, intensity: 2, distance: 5 },
    gait: { bob: 0.2, sway: 0.24, lean: 0.34, clip: 1.7 },
  },
  // --- Dinossauros ---------------------------------------------------------
  raptor: {
    melee: true, speedMul: 2.05, healthMul: 0.9, damageMul: 1.6, model: 'raptor', height: 1.65,
    look: { hue: 0.11, saturation: 0.5, lightness: 0.85 },
    ring: 0xe6a04b, gait: { bob: 0.1, sway: 0.18, lean: 0.42, clip: 1.25 },
  },
  trex: {
    melee: true, speedMul: 0.9, healthMul: 5.5, damageMul: 3.4, noFlinch: true, boss: true, model: 'trex', height: 4.6,
    look: { hue: 0.32, saturation: 0.34, lightness: 0.72 },
    ring: 0xff3b2f, gait: { bob: 0.24, sway: 0.14, lean: 0.2, clip: 0.85 },
  },
};
const MELEE_RANGE = 2.3;

/** Resolve o tipo de inimigo do índice `id` a partir da missão. */
function resolveType(mission, id) {
  if (mission?.enemyMix) {
    // Distribuição determinística por peso: mesmo mapa, mesma composição.
    const pool = [];
    for (const [type, weight] of Object.entries(mission.enemyMix)) {
      for (let i = 0; i < weight; i += 1) pool.push(type);
    }
    return pool[id % pool.length] || 'human';
  }
  return mission?.enemyType || 'human';
}

export function createGuards(scene, game, world, audio, damagePlayer, fx) {
  // Um grafo por nível: guarda do mezanino só anda em laje, guarda do térreo
  // só anda em corredor. Sem isso o inimigo de cima seguia caminhos do térreo
  // a 3.55 m de altura e parecia flutuar sobre um piso invisível.
  const navByLevel = {
    ground: buildNavGraph(world, world.groundWalkable),
    upper: world.upper.cells.size ? buildNavGraph(world, world.upperWalkable) : null,
  };
  const difficulty = DIFFICULTY[game.difficulty];
  const mission = MISSIONS[game.missionIndex];
  const ctx = { difficulty, game, audio, fx, damagePlayer };
  const accents = [0x2b3547, 0x303a44, 0x27313d, 0x343b47];
  let bossTaken = false;

  // F3 — POOL fixo, nunca cresce depois daqui. `world.guards` é a guarnição
  // inicial de sempre (tiles `G` do grid + `upper.guards`); a ela somamos
  // slots de RESERVA — inimigos criados (rig, hitboxes, luz de aura) mas
  // invisíveis e inativos até o spawner de reforço os ativar. Reforço só
  // nasce no térreo (ver `trySpawnReinforcement`), então a reserva só
  // precisa cobrir o nível 'ground': o mezanino nunca repõe quem morre lá —
  // é uma postura defensiva fixa da missão, não um front de reforço.
  const spawnRate = Number.isFinite(mission.spawnRate) && mission.spawnRate > 0 ? mission.spawnRate : DEFAULT_SPAWN_RATE;
  const maxAlive = Number.isInteger(mission.maxAlive) && mission.maxAlive > 0 ? mission.maxAlive : DEFAULT_MAX_ALIVE;
  const groundInitialCount = world.guards.filter((position) => position.y <= CONFIG.floorHeight - 1).length;
  const groundTarget = groundPoolSize(groundInitialCount, maxAlive);
  const reserveCount = Math.max(0, groundTarget - groundInitialCount);
  // `world.start` como posição-placeholder: a reserva nasce escondida e só
  // recebe uma posição de verdade quando o spawner a ativa pela primeira vez.
  const poolPositions = [...world.guards, ...Array.from({ length: reserveCount }, () => world.start.clone())];

  const enemies = poolPositions.map((position, id) => {
    const spawned = id < world.guards.length;
    let type = resolveType(mission, id);
    let stats = TYPE_STATS[type] || TYPE_STATS.human;
    // Chefes são únicos: o segundo T-Rex vira a espécie comum do mapa.
    if (stats.boss) {
      if (bossTaken) {
        type = Object.keys(mission.enemyMix || {}).find((key) => key !== type) || 'human';
        stats = TYPE_STATS[type] || TYPE_STATS.human;
      } else {
        bossTaken = true;
      }
    }
    const elite = type === 'monster' && id === 0 && mission?.code === 'OP-06';
    const visual = buildVisual(type, stats, elite, accents[id % accents.length]);
    visual.root.position.copy(position);
    if (stats.float) visual.root.position.y += stats.float;
    visual.root.visible = spawned;
    scene.add(visual.root);

    // Luz própria da espécie (brasa do demônio, frio do fantasma): pool fixo
    // pré-criado em createFx(), nunca uma PointLight nova por inimigo — ver o
    // comentário de topo de fx.js. Mesma condição de antes: só o caminho de
    // modelo animado ganhava aura. Slots de reserva também recebem a aura
    // (se a espécie tiver e o orçamento permitir) — ela fica com intensidade
    // 0 (apagada) até o inimigo nascer de verdade, exatamente como um
    // cadáver recém-morto continua com a própria aura acesa.
    const auraLight = stats.aura && visual.rig ? fx.borrowAuraLight() : null;
    if (auraLight) {
      auraLight.color.set(stats.aura.color);
      auraLight.intensity = spawned ? stats.aura.intensity : 0;
      auraLight.distance = stats.aura.distance;
      auraLight.decay = 2;
    }

    const enemy = {
      id, ...visual, elite, type, stats, auraLight,
      level: position.y > CONFIG.floorHeight - 1 ? 'upper' : 'ground',
      melee: stats.melee, noFlinch: Boolean(stats.noFlinch), ghost: Boolean(stats.ghost),
      gait: stats.gait || {},
      floatY: stats.float || 0,
      health: difficulty.enemyHealth * stats.healthMul * (elite ? 1.6 : 1), state: 'patrol', stateTime: 0,
      speed: CONFIG.enemySpeed * stats.speedMul,
      meleeDamage: Math.round((difficulty.damage + 2) * (stats.damageMul || 1)),
      home: position.clone(), target: position.clone(), lastKnown: new YUKA.Vector3(),
      path: [], pathIndex: 0, repath: 0, fireCooldown: 1, burstLeft: 0, strafeDir: id % 2 ? 1 : -1,
      facing: new THREE.Vector3(0, 0, 1), alive: spawned, revealedUntil: 0, sightTime: 0,
      flinch: 0, deathT: -1, flashT: 0, attackT: 0, moving: false, knockVel: new THREE.Vector3(),
      clip: null, voiceT: 1 + Math.random() * 4, stepClock: 0,
      // F3 — pool/reciclagem: `spawned` marca um slot já ativado ALGUMA vez
      // (elegível a virar cadáver-reciclável); `corpseTimer`/`reclaimable`
      // controlam o tempo de assentamento de um cadáver de verdade (ver
      // `updateCorpse`). Reserva nunca usada (`spawned=false`, `deathT=-1`)
      // é reclamável IMEDIATAMENTE — não é cadáver, não precisa assentar.
      spawned, corpseTimer: 0, reclaimable: false,
    };
    visual.root.userData.enemy = enemy;
    visual.hitMeshes.forEach((part) => { part.userData.enemy = enemy; });
    return enemy;
  });
  game.enemies = enemies;
  game.telemetry.yukaReady = true;
  game.telemetry.animatedEnemies = enemies.filter((enemy) => enemy.rig).length;

  // --- F3: reforço contínuo -------------------------------------------------
  // Candidatas ESTÁTICAS de nascimento: toda célula andável do térreo, com o
  // que não muda entre reforços (interior/borda). Distância e visibilidade
  // dependem da posição do jogador e são recalculadas a cada tentativa de
  // spawn — mas a tentativa em si só roda a cada `spawnInterval` segundos
  // (relógio de jogo), então isto nunca custa por frame.
  const groundCells = [];
  for (let z = 0; z < world.height; z += 1) {
    for (let x = 0; x < world.width; x += 1) {
      if (!world.groundWalkable(x, z)) continue;
      groundCells.push({
        x, z,
        interior: world.chars[z][x] === '.',
        edgeDistance: Math.min(x, world.width - 1 - x, z, world.height - 1 - z),
        world: world.toWorld({ x, z }),
      });
    }
  }
  const scheduler = createSpawnScheduler(spawnRate);

  /** Slot elegível para reciclagem: reserva virgem primeiro, cadáver de térreo
   * mais antigo (já assentado) como próximo recurso. */
  function reclaimableSlot() {
    const virgin = enemies.find((enemy) => enemy.level === 'ground' && !enemy.spawned);
    if (virgin) return virgin;
    let oldest = null;
    for (const enemy of enemies) {
      if (enemy.level !== 'ground' || enemy.alive || !enemy.reclaimable) continue;
      if (!oldest || enemy.corpseTimer > oldest.corpseTimer) oldest = enemy;
    }
    return oldest;
  }

  /** Reativa um slot da pool no lugar escolhido — NUNCA cria rig/luz/mesh novos. */
  function resetToAlive(enemy, position) {
    enemy.root.visible = true;
    enemy.root.position.copy(position);
    if (enemy.floatY) enemy.root.position.y += enemy.floatY;
    enemy.root.rotation.set(0, 0, 0);
    enemy.home.copy(position);
    enemy.target.copy(position);
    enemy.lastKnown.set(position.x, position.y, position.z);
    enemy.health = difficulty.enemyHealth * enemy.stats.healthMul * (enemy.elite ? 1.6 : 1);
    enemy.state = 'patrol';
    enemy.stateTime = 0;
    enemy.path = [];
    enemy.pathIndex = 0;
    enemy.repath = 0;
    enemy.fireCooldown = 1;
    enemy.burstLeft = 0;
    enemy.facing.set(0, 0, 1);
    enemy.alive = true;
    enemy.revealedUntil = 0;
    enemy.sightTime = 0;
    enemy.flinch = 0;
    enemy.deathT = -1;
    enemy.flashT = 0;
    enemy.attackT = 0;
    enemy.moving = false;
    enemy.knockVel.set(0, 0, 0);
    enemy.corpseTimer = 0;
    enemy.reclaimable = false;
    enemy.spawned = true;
    enemy.ring.material.opacity = 0;
    if (enemy.flash) enemy.flash.material.opacity = 0;
    if (enemy.auraLight) enemy.auraLight.intensity = enemy.stats.aura?.intensity ?? 0;
    if (enemy.rig) {
      enemy.rig.mixer.stopAllAction();
      playClip(enemy, ['idle', 'flying_idle'], { fade: 0 });
    }
  }

  /** @returns {boolean} true quando um reforço nasceu de verdade. */
  function trySpawnReinforcement(playerPosition) {
    const aliveCount = enemies.reduce((total, enemy) => total + (enemy.alive ? 1 : 0), 0);
    if (aliveCount >= maxAlive) return false;
    const slot = reclaimableSlot();
    if (!slot || !groundCells.length) return false;
    const candidates = groundCells.map((cell) => ({
      x: cell.x, z: cell.z, interior: cell.interior, edgeDistance: cell.edgeDistance,
      distanceToPlayer: cell.world.distanceTo(playerPosition),
      visible: hasLineOfSight(world, playerPosition, cell.world),
      worldPosition: cell.world,
    }));
    const chosen = pickSpawnCell(candidates, Math.random);
    if (!chosen) return false;
    resetToAlive(slot, chosen.worldPosition);
    game.telemetry.spawns = (game.telemetry.spawns || 0) + 1;
    return true;
  }

  /** Monta o visual: GLB animado quando disponível, senão procedural. */
  function buildVisual(type, stats, elite, accent) {
    if (stats.model && hasEnemyModel(stats.model)) {
      const rig = spawnEnemyModel(stats.model, stats.height);
      if (rig) {
        applyLook(rig.model, stats.look, rig.owned);
        const hitMeshes = buildHitBoxes(rig.root, stats.height, Math.max(0.34, stats.height * 0.22), rig.owned);
        const ring = buildRing(stats.ring);
        rig.owned.push(ring.geometry, ring.material);
        rig.root.add(ring);
        rig.root.userData.kind = 'enemy';
        // `body` é o nó que recebe o balanço do andar (gait). Balançar a raiz
        // moveria também o halo do chão e as caixas de dano.
        return { root: rig.root, body: rig.model, rig, ring, hitMeshes, head: null, torso: null, legL: null, legR: null, flash: null, muzzleTip: null };
      }
    }
    const soldier = buildSoldier(accent, elite, type);
    if (stats.ring) soldier.ring.material.color.setHex(stats.ring);
    return { ...soldier, body: null, rig: null };
  }

  /** Predicado de célula pisável para o nível deste inimigo. */
  function levelWalkable(enemy) {
    return enemy.level === 'upper' ? world.upperWalkable : world.groundWalkable;
  }

  function plan(enemy, target) {
    const nav = navByLevel[enemy.level] || navByLevel.ground;
    const walkable = nav.walkable;
    // O mezanino é esparso: o alvo (jogador no térreo) pode estar a muitas
    // células da laje mais próxima, então o raio de encaixe é bem maior.
    const snapRadius = enemy.level === 'upper' ? 24 : 3;
    const from = nearestWalkableCell(world, world.toCell(enemy.root.position), walkable, snapRadius);
    const to = nearestWalkableCell(world, world.toCell(target), walkable, snapRadius);
    if (!from || !to) { enemy.path = []; enemy.pathIndex = 0; return; }
    // As lajes de um mapa podem ser ilhas desconexas: um alvo na outra ilha
    // não tem caminho, e o A* não pode derrubar o frame por isso.
    try {
      const search = new YUKA.AStar(nav.graph, nav.index(from.x, from.z), nav.index(to.x, to.z));
      search.search();
      enemy.path = search.getPath().slice(1)
        .map((node) => nav.graph.getNode(node))
        .filter(Boolean)
        .map((node) => node.position);
    } catch {
      enemy.path = [];
    }
    enemy.pathIndex = 0;
  }

  function setState(enemy, state, playerPosition) {
    if (enemy.state === state) return;
    enemy.state = state;
    enemy.stateTime = 0;
    if (playerPosition) enemy.lastKnown.copy(playerPosition);
    if (state === 'engage') {
      enemy.fireCooldown = Math.max(enemy.fireCooldown, difficulty.reaction);
      // Grito de detecção: o jogador ouve que foi visto antes de levar o bote.
      audio.enemyVoice(enemy.type, enemy.root.position, 'alert');
    }
    enemy.ring.material.opacity = state === 'engage' || state === 'pursue' ? 0.75 : state === 'investigate' ? 0.35 : 0;
  }

  function update(dt, now, playerPosition) {
    let alertCount = 0;
    let shooterTokens = CONFIG.maxShooters;
    // Orçamento global de replanejamento: no máximo N buscas A* completas por
    // fixed step, no total, entre TODOS os inimigos — mesmo padrão de
    // `shooterTokens` acima. Sem isto, uma explosão que solta os 12 inimigos em
    // `pursue`/`investigate` ao mesmo tempo (ver explosives.js `notifyNoise`)
    // fazia até 12 buscas A* completas por fixed step, e até 5 fixed steps por
    // frame renderizado (`config.js maxFrameDelta`) — a espiral de morte que
    // travava o jogo na granada.
    let planBudget = CONFIG.maxRepathsPerStep;
    const tryPlan = (enemy, target) => {
      if (planBudget <= 0) {
        // Sem orçamento neste step: tenta de novo em breve, mas NUNCA no mesmo
        // frame (isso reproduziria o bug original) e nunca ultrapassando o
        // tempo que já faltava para o próximo replanejamento natural.
        enemy.repath = Math.min(Math.max(enemy.repath, 0.05), 0.15);
        return;
      }
      planBudget -= 1;
      plan(enemy, target);
      // Sucesso: cadência normal. Falha (caminho vazio — alvo inalcançável,
      // ou nasceu de um `lastKnown` fora de qualquer célula andável, ver
      // `notifyNoise`): BACKOFF — sem isto o timer era derrotado no frame
      // seguinte pela condição antiga `pathIndex >= path.length` (0 >= 0 com
      // path vazio é sempre verdadeiro), e o inimigo buscava A* exaustivo a
      // cada fixed step, para sempre, enquanto o alvo continuasse inalcançável.
      enemy.repath = enemy.path.length ? 0.8 : 1.2 + Math.random() * 0.6;
    };
    enemies.forEach((enemy) => {
      if (!enemy.alive) { updateCorpse(enemy, dt); return; }
      enemy.stateTime += dt;
      enemy.fireCooldown -= dt;
      enemy.repath -= dt;
      enemy.flinch = Math.max(0, enemy.flinch - dt);
      enemy.attackT = Math.max(0, enemy.attackT - dt);
      enemy.flashT = Math.max(0, enemy.flashT - dt);
      if (enemy.flash) enemy.flash.material.opacity = enemy.flashT > 0 ? 0.9 : 0;
      applyKnockback(enemy, dt);
      const distance = enemy.root.position.distanceTo(playerPosition);
      tempA.copy(playerPosition).sub(enemy.root.position).setY(0).normalize();
      const los = hasLineOfSight(world, enemy.root.position, playerPosition);
      const visible = distance < CONFIG.enemyVisionRange && enemy.facing.dot(tempA) > CONFIG.enemyVisionCos && los;

      if (visible) {
        enemy.sightTime += dt;
        enemy.lastKnown.set(playerPosition.x, playerPosition.y, playerPosition.z);
        if (enemy.sightTime > difficulty.reaction * 0.6 || ['engage', 'pursue'].includes(enemy.state)) {
          setState(enemy, distance < CONFIG.enemyFireRange ? 'engage' : 'pursue', playerPosition);
        }
      } else {
        enemy.sightTime = Math.max(0, enemy.sightTime - dt * 2.5);
        if (enemy.state === 'engage') setState(enemy, 'pursue');
      }

      if (['engage', 'pursue', 'investigate', 'search'].includes(enemy.state)) alertCount += 1;
      enemy.moving = false;
      if (enemy.state === 'engage') {
        enemy.facing.lerp(tempA, Math.min(1, dt * 8)).normalize();
        if (enemy.melee) {
          const reach = MELEE_RANGE * (enemy.stats.height > 3 ? 1.8 : 1);
          if (distance > reach) {
            moveAlongPath(enemy, playerPosition, dt, 1.2, tryPlan);
          } else if (enemy.fireCooldown <= 0 && los) {
            enemy.attackT = 0.28;
            playClip(enemy, ['attack', 'punch', 'bite_front', 'headbutt'], { once: true, fade: 0.1 });
            audio.enemyVoice(enemy.type, enemy.root.position, 'attack');
            meleeAttack(enemy, ctx);
          }
        } else if (enemy.flinch <= 0 && los && enemy.fireCooldown <= 0) {
          if (shooterTokens > 0 && distance < CONFIG.enemyFireRange) {
            shooterTokens -= 1;
            fireWeapon(enemy, distance, playerPosition, now, ctx);
          } else if (enemy.stateTime > 2.5) {
            tempB.crossVectors(tempA, enemy.root.up).multiplyScalar(enemy.strafeDir);
            const step = enemy.speed * 0.5 * dt;
            const cell = world.toCell(tempA.copy(enemy.root.position).addScaledVector(tempB, step));
            if (levelWalkable(enemy)(cell.x, cell.z)) {
              enemy.root.position.addScaledVector(tempB, step);
              enemy.moving = true;
            } else {
              enemy.strafeDir *= -1;
            }
            if (enemy.stateTime > 4.5) { enemy.stateTime = 2.6; enemy.strafeDir *= -1; }
          }
        }
      } else {
        let target = enemy.home;
        let speedFactor = 0.8;
        if (enemy.state === 'investigate' || enemy.state === 'search') { target = enemy.lastKnown; speedFactor = 1; }
        if (enemy.state === 'pursue') { target = enemy.lastKnown; speedFactor = 1.45; }
        if (enemy.state === 'patrol' && enemy.stateTime > 2.5) {
          const angle = (enemy.id * 2.3 + now * 0.07) % (Math.PI * 2);
          target = tempB.set(enemy.home.x + Math.cos(angle) * 6, 0, enemy.home.z + Math.sin(angle) * 6);
        }
        moveAlongPath(enemy, target, dt, speedFactor, tryPlan);
        if (enemy.state === 'pursue' && enemy.root.position.distanceTo(enemy.lastKnown) < 1.4) setState(enemy, 'search');
        if ((enemy.state === 'search' || enemy.state === 'investigate') && enemy.stateTime > 5) setState(enemy, 'patrol');
      }
      enemy.root.rotation.y = Math.atan2(enemy.facing.x, enemy.facing.z);
      animate(enemy, dt, now, distance);
      syncAuraLight(enemy);
      emitSounds(enemy, dt, distance);
    });
    game.alertLevel = Math.min(1, alertCount / 2);

    // F3 — relógio FIXO de jogo (nunca setTimeout/relógio de parede): dispara
    // quando o intervalo estoura; sucesso reagenda o intervalo cheio, falha
    // (teto de vivos atingido) tenta de novo em breve — "pausa no teto,
    // retoma ao morrer alguém" sem acumular um backlog de spawns atrasados.
    if (scheduler.tick(dt)) {
      if (trySpawnReinforcement(playerPosition)) scheduler.schedule(spawnRate);
      else scheduler.retry();
    }
  }

  /** A luz de aura não é mais filha de `root` (ela vive no pool fixo de fx.js,
   * permanentemente na cena) — precisa ser reposicionada manualmente todo
   * frame, viva ou morta, para continuar acompanhando o inimigo. */
  function syncAuraLight(enemy) {
    if (!enemy.auraLight) return;
    enemy.auraLight.position.copy(enemy.root.position);
    enemy.auraLight.position.y += enemy.stats.height * 0.55;
  }

  function playClip(enemy, candidates, options) {
    if (!enemy.rig) return;
    enemy.clip = enemy.rig.play(candidates, options);
  }

  function animate(enemy, dt, now, distance) {
    if (enemy.rig) {
      enemy.rig.mixer.update(dt);
      applyGait(enemy, now);
      // Ataque e morte travam o clipe; os demais estados seguem o movimento.
      if (enemy.attackT > 0 || enemy.deathT >= 0) return;
      const chasing = enemy.state === 'engage' || enemy.state === 'pursue';
      const speed = (enemy.gait.clip ?? 1) * (chasing ? 1.15 : 1);
      if (enemy.moving) playClip(enemy, chasing ? ['run', 'fast_flying', 'walk'] : ['walk', 'flying_idle', 'run'], { speed });
      else playClip(enemy, ['idle', 'flying_idle'], { speed: speed * 0.8 });
      if (enemy.ghost) {
        // Bruxuleio de fantasma: sobe e desce de leve, cada um no seu tempo.
        enemy.root.position.y = enemy.home.y + enemy.floatY + Math.sin(now * 1.6 + enemy.id) * 0.16;
      } else if (enemy.floatY) {
        // Bruxa: paira pouco acima do chão, com deriva lenta.
        enemy.root.position.y = enemy.home.y + enemy.floatY + Math.sin(now * 0.9 + enemy.id * 1.7) * 0.09;
      }
      return;
    }
    const stride = enemy.moving ? Math.sin(now * (enemy.melee ? 11 : 9) + enemy.id * 1.7) * 0.5 : 0;
    enemy.legL.rotation.x = stride;
    enemy.legR.rotation.x = -stride;
    const flinchTilt = enemy.flinch > 0 ? -0.3 * (enemy.flinch / 0.18) : 0;
    const lungeTilt = enemy.attackT > 0 ? 0.55 * (enemy.attackT / 0.28) : 0;
    enemy.torso.rotation.x = flinchTilt + lungeTilt + (enemy.type === 'monster' ? 0.28 : 0);
    enemy.head.rotation.x = flinchTilt * 0.6;
  }

  /**
   * Personalidade de movimento por espécie, aplicada POR CIMA do clipe do GLB.
   *
   * Os clipes vêm todos do mesmo pacote, então sem isto um demônio anda igual
   * a um yeti. O balanço é aplicado ao nó do MODELO, não à raiz: a raiz carrega
   * o halo do chão e as caixas de dano, que não podem oscilar junto.
   *   bob   — sobe e desce (peso do bicho)
   *   sway  — rola de um lado para o outro (gingado)
   *   lean  — inclina para a frente ao perseguir (ímpeto)
   */
  function applyGait(enemy, now) {
    const body = enemy.body;
    if (!body) return;
    const gait = enemy.gait;
    const chasing = enemy.state === 'engage' || enemy.state === 'pursue';
    const cadence = now * (enemy.moving ? 5.2 * (gait.clip ?? 1) : 1.3) + enemy.id * 2.1;
    const drive = enemy.moving ? 1 : 0.25;
    body.position.y = Math.abs(Math.sin(cadence)) * (gait.bob ?? 0) * drive;
    body.rotation.z = Math.sin(cadence * 0.5) * (gait.sway ?? 0) * drive;
    const lunge = enemy.attackT > 0 ? 0.5 * (enemy.attackT / 0.28) : 0;
    body.rotation.x = (chasing && enemy.moving ? (gait.lean ?? 0) : 0) + lunge;
  }

  /** Passos ritmados pelo movimento + vocalização ambiente esporádica. */
  function emitSounds(enemy, dt, distance) {
    if (distance > 34) return;
    if (enemy.moving && !enemy.ghost) {
      enemy.stepClock -= dt;
      if (enemy.stepClock <= 0) {
        // Passo mais lento e pesado quanto maior o bicho.
        const cadence = enemy.stats.height > 3 ? 0.62 : enemy.stats.height > 2 ? 0.46 : 0.38;
        enemy.stepClock = cadence / (enemy.state === 'engage' || enemy.state === 'pursue' ? 1.5 : 1);
        audio.enemyStep(enemy.type, enemy.root.position, enemy.stats.height);
      }
    }
    enemy.voiceT -= dt;
    if (enemy.voiceT <= 0) {
      enemy.voiceT = 5 + Math.random() * 7;
      audio.enemyVoice(enemy.type, enemy.root.position, 'idle');
    }
  }

  function updateCorpse(enemy, dt) {
    applyKnockback(enemy, dt);
    syncAuraLight(enemy);
    // deathT < 0 é um slot de RESERVA nunca ativado (nunca passou por
    // `damage()`) — não é cadáver, não tem tempo de assentamento a contar.
    // `reclaimableSlot()` já sabe reciclar isto de imediato via `!spawned`.
    if (enemy.deathT < 0) return;
    // F3 — cadáver de verdade: conta o tempo de assentamento (relógio de
    // jogo) independente do estado da animação de queda, para o spawner
    // saber quando pode reciclar este slot. Só o térreo recicla — ver o
    // comentário de topo de `createGuards`.
    enemy.corpseTimer += dt;
    if (enemy.level === 'ground' && !enemy.reclaimable && enemy.corpseTimer >= CORPSE_LINGER) enemy.reclaimable = true;
    // PERF: uma vez assentado, NUNCA MAIS chame mixer.update nem raycast este
    // cadáver — antes disto todo inimigo morto animava (skinning por vértice)
    // para sempre, e ficava para sempre no raycast de cada tiro. `alive` já
    // exclui o cadáver do registro de raycast de combat.js; aqui paramos o
    // mixer explicitamente assim que a queda termina.
    if (enemy.deathT >= 1) return;
    if (enemy.rig) enemy.rig.mixer.update(dt);
    enemy.deathT = Math.min(1, enemy.deathT + dt * 2.2);
    const ease = 1 - (1 - enemy.deathT) ** 2;
    if (enemy.rig) {
      // O GLB tem clipe de morte próprio: só acompanhamos a queda do fantasma,
      // que precisa aterrissar em vez de ficar boiando.
      if (enemy.floatY) enemy.root.position.y = enemy.home.y + enemy.floatY * (1 - ease);
    } else {
      enemy.root.rotation.z = enemy.fallDir * ease * Math.PI * 0.48;
      enemy.root.position.y = ease * 0.12;
      if (enemy.flash) enemy.flash.material.opacity = 0;
    }
    if (enemy.deathT >= 1 && enemy.rig) enemy.rig.mixer.stopAllAction();
  }

  // Energia do projétil: empurra o inimigo na direção do tiro, com decaimento e
  // checagem de parede.
  function applyKnockback(enemy, dt) {
    if (enemy.knockVel.lengthSq() < 0.0004) return;
    tempB.copy(enemy.knockVel).multiplyScalar(dt);
    const cell = world.toCell(tempA.copy(enemy.root.position).add(tempB));
    // Checagem no nível do inimigo: rajada não empurra guarda de mezanino
    // para fora da laje (ele ficaria suspenso no ar).
    if (levelWalkable(enemy)(cell.x, cell.z)) enemy.root.position.add(tempB);
    enemy.knockVel.multiplyScalar(Math.pow(0.002, dt));
  }

  function notifyNoise(position, radius, now) {
    enemies.forEach((enemy) => {
      if (!enemy.alive || enemy.root.position.distanceTo(position) > radius) return;
      enemy.lastKnown.set(position.x, position.y, position.z);
      enemy.revealedUntil = now + 4;
      setState(enemy, radius > 15 ? 'pursue' : 'investigate');
    });
  }

  function damage(enemy, amount, zone, shotDir, knock = 0) {
    if (!enemy?.alive) return false;
    enemy.health -= amount * (zone === 'head' ? 2.4 : zone === 'limb' ? 0.65 : 1);
    setState(enemy, 'engage', game.camera.position);
    const killed = enemy.health <= 0;
    if (shotDir && knock > 0) {
      // Impulso acumulativo: rajadas sucessivas empurram mais que um tiro só.
      const mass = enemy.stats.boss ? 0.18 : enemy.stats.height > 2 ? 0.45 : 1;
      tempA.copy(shotDir).setY(0).normalize()
        .multiplyScalar(knock * 3.4 * mass * (killed ? 2.4 : zone === 'head' ? 1.35 : 1));
      enemy.knockVel.add(tempA);
    }
    if (!killed) {
      if (!enemy.noFlinch) {
        enemy.flinch = 0.18;
        playClip(enemy, ['hitreact', 'hitrecieve'], { once: true, fade: 0.08 });
      }
      audio.enemyVoice(enemy.type, enemy.root.position, 'hurt');
      enemy.burstLeft = 0;
      enemy.fireCooldown = Math.max(enemy.fireCooldown, 0.3);
      return false;
    }
    enemy.alive = false;
    enemy.state = 'down';
    enemy.deathT = 0;
    enemy.fallDir = Math.random() > 0.5 ? 1 : -1;
    enemy.ring.material.opacity = 0;
    playClip(enemy, ['death'], { once: true, fade: 0.12 });
    audio.enemyVoice(enemy.type, enemy.root.position, 'death');
    // Fantasma se dissipa, não sangra.
    if (!enemy.ghost) {
      fx.bloodPool(enemy.root.position);
      fx.blood(tempA.copy(enemy.root.position).setY(enemy.root.position.y + enemy.stats.height * 0.55));
    }
    game.kills += 1;
    return true;
  }

  return {
    enemies,
    update,
    notifyNoise,
    damage,
    // F3 — gancho de teste/telemetria: prova a cadência, o teto de vivos e o
    // tamanho FIXO do pool (nenhum rig criado depois do deploy).
    spawnerStats: () => ({
      alive: enemies.reduce((total, enemy) => total + (enemy.alive ? 1 : 0), 0),
      maxAlive,
      spawnRate,
      poolSize: enemies.length,
      spawns: game.telemetry.spawns || 0,
      // Estado interno exposto para diagnóstico de cadência nos specs.
      reclaimable: enemies.reduce((total, enemy) => total + (!enemy.alive && enemy.reclaimable && enemy.level === 'ground' ? 1 : 0), 0),
      virgin: enemies.reduce((total, enemy) => total + (enemy.level === 'ground' && !enemy.spawned ? 1 : 0), 0),
      schedulerRemaining: scheduler.remaining,
    }),
    dispose: () => enemies.forEach((enemy) => {
      // Devolve a luz de aura ao pool fixo ANTES de qualquer outra coisa —
      // nunca é removida da cena, só apagada e liberada para o próximo deploy.
      if (enemy.auraLight) fx.releaseAuraLight(enemy.auraLight);
      scene.remove(enemy.root);
      if (enemy.rig) {
        // Inimigo de GLB: geometria e materiais são do modelo mestre e servem
        // as próximas missões — só o que é da instância pode ser liberado.
        enemy.rig.dispose();
        return;
      }
      enemy.root.traverse((part) => { part.geometry?.dispose(); part.material?.dispose(); });
    }),
  };
}

function buildRing(color = 0xee5b55) {
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.5, 0.58, 18),
    new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide, transparent: true, opacity: 0 }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.02;
  ring.userData.fx = true;
  ring.userData.noRay = true;
  return ring;
}

/**
 * Recoloração por MATIZ, preservando o contraste interno do modelo.
 *
 * A versão anterior (`applyTint`) misturava toda a paleta com uma cor só a
 * 55%: manto, pele e olhos viravam a mesma mancha e o inimigo perdia leitura.
 * Aqui cada material é convertido para HSL e recebe o matiz da espécie,
 * enquanto a LUMINOSIDADE relativa de cada parte é mantida (apenas escalada).
 * Assim o manto continua sendo a parte escura e a pele a parte clara — o
 * modelo continua legível, mas com a cor da espécie.
 *
 * NormalBlending de propósito no caso translúcido — AdditiveBlending sobre o
 * fog escuro do jogo estoura o tone mapping (armadilha já vista no space-war).
 */
const hsl = { h: 0, s: 0, l: 0 };
function applyLook(model, look, owned = null) {
  if (!look) return;
  model.traverse((node) => {
    if (!node.isMesh || !node.material) return;
    const material = node.material.clone();
    if (material.color) {
      material.color.getHSL(hsl);
      const h = look.hue ?? hsl.h;
      const s = look.saturation ?? hsl.s;
      const l = Math.min(0.95, Math.max(0.03, hsl.l * (look.lightness ?? 1)));
      material.color.setHSL(h, s, l);
    }
    if (look.emissive !== undefined && 'emissive' in material) {
      material.emissive = new THREE.Color(look.emissive);
      material.emissiveIntensity = look.emissiveIntensity ?? 0.4;
      owned?.push(material.emissive);
    }
    if (look.opacity !== undefined) {
      material.transparent = true;
      material.opacity = look.opacity;
      material.depthWrite = false;
      material.blending = THREE.NormalBlending;
      node.castShadow = false;
    }
    owned?.push(material);
    node.material = material;
  });
}

// PERF LAW: nenhuma PointLight nova por inimigo. Aura vem do pool fixo de
// `fx.borrowAuraLight()` (ver o comentário de topo de fx.js) — a criação de
// `THREE.PointLight` por espécie que existia aqui foi removida de propósito.

// `tryPlan` é o orçamento global de replanejamento (ver `update()`): decide
// SE este inimigo pode rodar um A* completo neste fixed step, e aplica o
// backoff correto (sucesso vs. falha) — `moveAlongPath` nunca chama `plan`
// direto nem decide sozinho o próximo `enemy.repath`.
function moveAlongPath(enemy, target, dt, speedFactor, tryPlan) {
  if (enemy.repath <= 0) tryPlan(enemy, target);
  const waypoint = enemy.path[enemy.pathIndex];
  if (!waypoint) return;
  tempA.set(waypoint.x, 0, waypoint.z).sub(enemy.root.position).setY(0);
  if (tempA.length() < 0.35) {
    enemy.pathIndex += 1;
    // Chegou ao fim do caminho antes do timer expirar: não force um novo A*
    // no mesmo frame (era o bug), mas também não deixe o inimigo parado por
    // até 0.8 s — encurta a espera para o próximo replanejamento.
    if (enemy.pathIndex >= enemy.path.length) enemy.repath = Math.min(enemy.repath, 0.15);
    return;
  }
  tempA.normalize();
  enemy.facing.lerp(tempA, Math.min(1, dt * 6)).normalize();
  enemy.root.position.addScaledVector(enemy.facing, enemy.speed * speedFactor * dt);
  enemy.moving = true;
}
