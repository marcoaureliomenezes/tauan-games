// main.js — Orquestrador. Zero lógica de jogo, só wire-up dos módulos.
// Carregado pelo index.html como <script type="module">.

import * as THREE from '../../vendor/three.module.min.js';

import { game } from './state.js';
import { CANNON } from './config.js';
import { audio } from './audio.js';
import { scene, camera, renderer, attachToBody, dirLight, ambLight } from './scene.js';
import { initSky, updateSky, getSunData, getAmbientData, getSkyColor } from './sky.js';
import { ocean, createIslands, updateWorld, updateAmbientFlak, setActiveHeightFn } from './world.js';
import { getActiveHeightFn } from './world.js';
import { updateParticles, spawnMuzzleFlash } from './fx.js';
import { tickSmokeEmitters, tickFactoryParticles } from './factory-fx.js';
import { updatePropFires } from './prop-fire.js';
import { input, installListeners, onAction } from './input.js';
import { jet, updatePlayer, playerHit, barrelRoll, firePosition, respawnJet, respawnAndRelaunch } from './player.js';
import { updateTargets } from './targets.js';
import { spawnBullet, updateBullets, spawnMissile, updateMissiles, updatePickups, spawnNuclearMissile, updateNuclears } from './projectiles.js';
import { updateHUD, showOverlay, hideOverlay, tickOverlayTimer, setSoundIcon } from './hud.js';
import { startGame, restartGame, crashAndDie, checkMissionComplete, gameOver, spawnMission } from './missions.js';
import { createCrosshair, updateCrosshair, missileLockedTarget } from './crosshair.js';
import { initMinimap, updateMinimap } from './ui/minimap.js';
import { INHAUMA_DEM_ATTRIBUTION } from './ui/credits.js';
import { MAPS, getMapHeightFn } from './maps/index.js';
import { spawnWingmen, updateWingmen, clearWingmen } from './wingmen.js';
import { spawnAllyEnemies, updateAllyWar, clearAllyEnemies } from './ally-war.js';
import { updateAutoTaxi, isAutoTaxiActive } from './auto-taxi.js';
import { installDebugApi, recordFrame } from './debug.js';
import { createAirportFor } from './airport.js';
import { startService, updateService } from './service-scene.js';
import { requestEjection, updateEjection, createPilotVisual } from './ejection.js';
import { cycleCameraMode, updateCameraRig } from './camera-modes.js';
import { updateNuclearFx } from './nuclear-fx.js';
import { updateBoss } from './boss.js';
import { SortieEvent, SortieState, transitionSortie } from './sortie-state.js';

// ─── Boot do mundo ───────────────────────────────────────────────────────────
attachToBody();
initSky(scene);
// Ilhas criadas por padrão (mapa 'islands' é o default até selectMap() ser chamado)
createIslands();
createCrosshair();
initMinimap();
const pilotVisual = createPilotVisual(scene);

// ─── Seleção de Mapa ─────────────────────────────────────────────────────────
// Guarda referência aos objetos extras criados pelos mapas alternativos
// para permitir limpeza ao reiniciar (futuro). Por ora, seleção é uma vez por sessão.
let _activeMapUpdate = updateWorld; // função de update do mapa atual

// Ambient audio timers
let _radioTimer = 8 + game.rng.range(0, 12);
let _boomTimer  = 5 + game.rng.range(0, 10);

/** Chamado pelos botões do #map-select overlay no HTML. */
window.selectMap = function(mapKey) {
  const el = document.getElementById('map-select');
  if (el) el.style.display = 'none';

  // Esconde o oceano animado para mapas que não usam o oceano de world.js
  ocean.visible = (mapKey === 'islands');

  if (mapKey !== 'islands') {
    // Para mapas não-ilhas: inicializa o mapa (sobrescreve game.islands)
    const mapDef = MAPS[mapKey];
    if (mapDef) {
      mapDef.create(scene);
      if (mapKey === 'desert') {
        const airport = createAirportFor('desert', scene);
        game.missionRealism.desertLandmarks = {
          roads: 2,
          hangars: 1,
          lights: airport.userData.airportText?.lights?.length ?? 0,
        };
      }
      _activeMapUpdate = mapDef.update;
      setActiveHeightFn(mapDef.heightAt);
    }
  } else {
    // Mapa ilhas: restaura a função de altura padrão
    setActiveHeightFn(getMapHeightFn('islands'));
  }
  // Atualiza estado ANTES de criar aeroporto/respawn (ambos leem game.activeMap)
  game.activeMap = mapKey;
  // Todo mapa tem aeroporto (WS-2) — e o jato nasce na zona de serviço dele
  createAirportFor(mapKey, scene);
  respawnJet();

  // Aliados em formação — spawna após criar o mapa (game.islands já populado)
  spawnWingmen(scene, jet);
  // Inimigos DOS ALIADOS — a frente de batalha dos amigos (separada da do player)
  spawnAllyEnemies(scene);

  // Mostra o overlay de instruções (início do jogo)
  showOverlay(
    'AERO STRIKE — F-35 LIGHTNING II',
    'Missão: destrua todos os alvos militares (bases, fábricas, prédios, comboios).\n\n' +
    'CONTROLES (estilo simulador):\n' +
    '↑ nariz para BAIXO   ↓ nariz para CIMA   (invertido)\n' +
    '← → rolar/virar     W acelerar    S frear\n' +
    'Q/E leme    Espaço/Z canhão    X míssil leve    B míssil pesado    T NUCLEAR    C câmera    J ejetar    P pausa\n\n' +
    'Decole da pista, cumpra a missão, retorne ao aeroporto e faça serviço completo.\n\n' +
    // AC-09: DEM attribution credit — only Inhaúma's terrain is DEM-derived (the
    // other 3 maps are hand-authored, no attribution owed).
    (mapKey === 'inhauma' ? `${INHAUMA_DEM_ATTRIBUTION}\n\n` : '') +
    'pressione Espaço para iniciar',
    0,
  );
};

if (game.runtime?.mission) game.cycle = game.runtime.mission;

// Se não houver #map-select (headless/test), inicializa direto com mapa padrão
if (typeof document !== 'undefined') {
  const mapSelectEl = document.getElementById('map-select');
  if (!mapSelectEl) {
    game.activeMap = 'islands';
  }
  if (game.runtime?.map && MAPS[game.runtime.map]) {
    window.selectMap(game.runtime.map);
  }
  // Se está em headless (sem o overlay), também inicia direto
}

installDebugApi({
  camera,
  renderer,
  heightFn: (...args) => getActiveHeightFn()(...args),
});

// Speed lines decorativos
const speedLines = [];
for (let i = 0; i < 4; i++) {
  const l = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 4), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.3 }));
  scene.add(l); speedLines.push(l);
}
let _slFrame = 0;
function updateSpeedLines() {
  if ((_slFrame++ & 1) !== 0) return;
  // WS-7: streaks só fazem sentido em alta velocidade
  const fast = game.player.speed > 60;
  for (const l of speedLines) l.visible = fast;
  if (!fast) return;
  const t = performance.now() * 0.01;
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + t * 0.5;
    speedLines[i].position.set(jet.position.x + Math.cos(a) * 4, jet.position.y + Math.sin(a) * 4, jet.position.z - 4 + ((t * 8) % 6));
  }
}

// ─── Câmera ──────────────────────────────────────────────────────────────────
const camTarget = new THREE.Vector3();
const camDesired = new THREE.Vector3();
const camFwd = new THREE.Vector3();
const camUpVec = new THREE.Vector3(0, 1, 0);
const _worldUp = new THREE.Vector3(0, 1, 0);
const _camV = new THREE.Vector3();

function updateCamera(dt) {
  if (game.missionRealism?.enabled) {
    const shake = game.flags.cameraShake?.intensity || 0;
    updateCameraRig(game.missionRealism.camera, dt, camera, jet, shake);
    if (game.flags.cameraShake) {
      game.flags.cameraShake.intensity *= (1 - 8 * dt);
      game.flags.cameraShake.duration -= dt;
      if (game.flags.cameraShake.duration <= 0 || game.flags.cameraShake.intensity < 0.05) game.flags.cameraShake = null;
    }
    audio.updateListener(camera.position.x, camera.position.y, camera.position.z, 0, 0, -1, 0, 1, 0);
    const _sunD = getSunData();
    dirLight.position.set(jet.position.x + _sunD.direction.x * 300, jet.position.y + Math.max(50, _sunD.direction.y * 300), jet.position.z + _sunD.direction.z * 300);
    dirLight.target.position.set(jet.position.x, 0, jet.position.z);
    dirLight.target.updateMatrixWorld();
    return;
  }
  const localOff = _camV.set(0, 3.0, 5).applyQuaternion(jet.quaternion);
  camDesired.copy(jet.position).add(localOff);
  // Camera shake (nuclear ou outros eventos)
  if (game.flags.cameraShake) {
    const s = game.flags.cameraShake;
    camDesired.x += (Math.random() - 0.5) * s.intensity;
    camDesired.y += (Math.random() - 0.5) * s.intensity;
    camDesired.z += (Math.random() - 0.5) * s.intensity * 0.3;
    s.intensity *= (1 - 8 * dt);
    s.duration -= dt;
    if (s.duration <= 0 || s.intensity < 0.05) game.flags.cameraShake = null;
  }
  camera.position.lerp(camDesired, 0.09);
  camFwd.set(0, 0, -1).applyQuaternion(jet.quaternion);
  // Alinha look-at paralelo ao forward do jato: ergue o target pela mesma altura
  // local da câmera para que a linha cam→target seja paralela ao fwd.
  const jetUpForAim = _camV.set(0, 3.0, 0).applyQuaternion(jet.quaternion);
  camTarget.copy(jet.position).add(jetUpForAim).addScaledVector(camFwd, 30);
  camera.lookAt(camTarget);

  // Atualiza listener de áudio 3D (posição da câmera, orientação para frente)
  audio.updateListener(
    camera.position.x, camera.position.y, camera.position.z,
    camFwd.x, camFwd.y, camFwd.z,
    0, 1, 0,
  );
  const jetUp = _camV.set(0, 1, 0).applyQuaternion(jet.quaternion);
  camUpVec.lerpVectors(jetUp, _worldUp, 0.35).normalize();
  camera.up.copy(camUpVec);
  if (game.flags.shakeTime > 0) {
    game.flags.shakeTime -= dt;
    camera.position.x += (Math.random() - 0.5) * 1.5;
    camera.position.y += (Math.random() - 0.5) * 1.5;
  }

  // Move o frustum da shadow camera junto com o player (sombras só perto)
  // Usa direção do sol quando disponível, senão posição fixa
  const _sunD = getSunData();
  dirLight.position.set(
    jet.position.x + _sunD.direction.x * 300,
    jet.position.y + Math.max(50, _sunD.direction.y * 300),
    jet.position.z + _sunD.direction.z * 300,
  );
  dirLight.target.position.set(jet.position.x, 0, jet.position.z);
  dirLight.target.updateMatrixWorld();
}

// ─── Tiro do canhão ──────────────────────────────────────────────────────────
let cannonCooldown = 0;
const _fOrig = new THREE.Vector3();
const _fRight = new THREE.Vector3();
const _fLeftPos = new THREE.Vector3();
const _fRightPos = new THREE.Vector3();
function fireCannon() {
  if (!game.running || game.flags.paused || cannonCooldown > 0) return;
  cannonCooldown = CANNON.RATE;
  const fwd = firePosition(_fOrig, CANNON.MUZZLE_OFFSET);
  _fRight.set(1, 0, 0).applyQuaternion(jet.quaternion);
  // Muzzle flashes at wing gun positions (visual only)
  _fLeftPos.copy(_fOrig).addScaledVector(_fRight, -CANNON.WING_OFFSET);
  spawnMuzzleFlash(_fLeftPos);
  _fRightPos.copy(_fOrig).addScaledVector(_fRight, CANNON.WING_OFFSET);
  spawnMuzzleFlash(_fRightPos);
  // Bullets from centerline so they track the crosshair exactly
  spawnBullet(_fOrig.clone(), fwd, false);
  spawnBullet(_fOrig.clone(), fwd, false);
  audio.cannon();
}

// ─── Disparo de míssil leve (X) — exige lock-on ──────────────────────────────
function fireMissile() {
  if (!game.running || game.flags.paused || game.player.missiles <= 0) return;
  const locked = missileLockedTarget();
  if (!locked) { audio.hit(); return; }
  // CONTRATO: writer de game.player.missiles
  game.player.missiles -= 1;
  firePosition(_fOrig, 1.5);
  spawnMissile(_fOrig.clone(), locked, jet.quaternion, 'light');
}

// ─── Disparo de míssil pesado (B) — exige lock-on, dano 5x, supply 10 ────────
function fireHeavyMissile() {
  if (!game.running || game.flags.paused || game.player.heavyMissiles <= 0) return;
  const locked = missileLockedTarget();
  if (!locked) { audio.hit(); return; }
  // CONTRATO: writer de game.player.heavyMissiles
  game.player.heavyMissiles -= 1;
  firePosition(_fOrig, 1.5);
  spawnMissile(_fOrig.clone(), locked, jet.quaternion, 'heavy');
}

// ─── Disparo de míssil nuclear (T) — devastador, supply 3 ────────────────────
function fireNuclearMissile() {
  if (!game.running || game.flags.paused || game.player.nuclearMissiles <= 0) return;
  const locked = missileLockedTarget();
  firePosition(_fOrig, 1.5);
  // Nuclear dispara mesmo sem lock (atinge terreno se não houver alvo)
  spawnNuclearMissile(_fOrig.clone(), locked, jet.quaternion);
}

// ─── Listeners de ação ───────────────────────────────────────────────────────
installListeners();

function handleStartOrFire() {
  audio.init();
  // O loop de solo automático (auto-taxi) já recoloca para a próxima surtida;
  // se ele estiver ativo, o Espaço não força avanço (evita duplo-avanço).
  if (game.missionRealism?.enabled && game.missionRealism.sortie.state === SortieState.NEXT_SORTIE_READY) {
    if (isAutoTaxiActive()) return;
    transitionSortie(game.missionRealism.sortie, SortieEvent.NEXT_SORTIE, {}, game.time);
    game.cycle += 1;
    game.flags.missionCompleteShown = false;
    game.missionRealism.service.phase = 'idle';
    spawnMission(game.cycle);
    return;
  }
  if (!game.running) {
    if (!game.player.dead && game.player.lives > 0 && !game.flags.missionFailed && !game.flags.missionCompleteShown) {
      startGame();
      return;
    }
    if (game.flags.missionFailed || game.player.dead) {
      if (game.flags.crashFreezeTime <= 0) {
        restartGame();
        clearWingmen(scene);
        spawnWingmen(scene, jet);
        clearAllyEnemies(scene);
        spawnAllyEnemies(scene);
      }
      return;
    }
  }
  fireCannon();
}
onAction('start', handleStartOrFire);   // Enter
onAction('fire', handleStartOrFire);    // Space/Z (inicia se parado, dispara se rodando)
onAction('missile', () => { audio.init(); fireMissile(); });
onAction('heavyMissile', () => { audio.init(); fireHeavyMissile(); });
onAction('nuclearMissile', () => { audio.init(); fireNuclearMissile(); });
onAction('cameraMode', () => { audio.init(); cycleCameraMode(game.missionRealism.camera); });
onAction('eject', () => {
  audio.init();
  if (!game.missionRealism?.enabled) return;
  if (game.flags.mayday || game.missionRealism.sortie.state === SortieState.MAYDAY) {
    if (requestEjection(game.missionRealism.ejection, jet.position)) {
      transitionSortie(game.missionRealism.sortie, SortieEvent.EJECT_REQUESTED, {}, game.time);
      pilotVisual.position.copy(jet.position);
      pilotVisual.visible = true;
      jet.visible = false;
    }
  }
});
onAction('roll',    () => { audio.init(); barrelRoll(); });
onAction('pause',   () => {
  audio.init();
  if (game.running) {
    game.flags.paused = !game.flags.paused;
    if (game.flags.paused) showOverlay('PAUSADO', 'pressione P para continuar', 0);
    else hideOverlay();
  }
});
onAction('mute', () => {
  audio.init();
  const muted = audio.toggle();
  setSoundIcon(muted);
});

// Botão de som (HUD)
{
  const btn = document.getElementById('sound-toggle');
  if (btn) btn.addEventListener('click', () => {
    audio.init();
    const muted = audio.toggle();
    setSoundIcon(muted);
  });
}

// ─── Game loop ───────────────────────────────────────────────────────────────
const clock = new THREE.Clock();

function tick() {
  requestAnimationFrame(tick);
  let dt = clock.getDelta();
  if (dt > 0.1) dt = 0.1;
  recordFrame(dt);

  // ADR-U4: slow-mo nuclear — dilatação GLOBAL de dt (0.35×) por 1.5 s reais.
  // Decremento em tempo real; cancela se o player está em mayday (justiça > drama).
  if (game.flags.nukeSlowmo > 0) {
    game.flags.nukeSlowmo -= dt;
    if (!game.flags.mayday) dt *= 0.35;
  }
  // WS-6: chegada da onda de choque nuclear (delay físico) — shake + boom
  if (game.flags.nukeShockArrival) {
    game.flags.nukeShockArrival.t -= dt / (game.flags.nukeSlowmo > 0 ? 0.35 : 1);
    if (game.flags.nukeShockArrival.t <= 0) {
      game.flags.cameraShake = { intensity: game.flags.nukeShockArrival.intensity, duration: 1.4 };
      audio.distantExplosion();
      game.flags.nukeShockArrival = null;
    }
  }

  if (game.running && !game.flags.paused && !game.flags.missionFailed) {
    cannonCooldown -= dt;
    game.flags.rollTimer    -= dt;
    game.flags.rollCooldown -= dt;
    game.flags.invincibility -= dt;

    if (input.fireHeld) fireCannon();

    if (game.missionRealism?.sortie?.state === SortieState.SERVICE_SCENE && !game.missionRealism.service.active && game.missionRealism.service.phase !== 'complete') {
      startService(game.missionRealism.service);
      showOverlay('REABASTECIMENTO', 'tanker, manutenção e rearmamento em andamento', game.runtime?.testMode ? 1200 : 2200);
    }
    const servicing = game.missionRealism?.sortie?.state === SortieState.SERVICE_SCENE || game.missionRealism?.service?.active;
    if (game.missionRealism?.service?.active) {
      if (updateService(game.missionRealism.service, dt, game.player)) {
        transitionSortie(game.missionRealism.sortie, SortieEvent.SERVICE_COMPLETE, {}, game.time);
        showOverlay('SERVIÇO COMPLETO', 'armamento completo — próxima surtida pronta', 1800);
      }
    }
    if (!servicing) {
      // Após pousar, o loop de solo é automático (taxi + reabastecimento +
      // recolocação para decolagem). Fora dele, controle manual normal.
      if (isAutoTaxiActive()) updateAutoTaxi(dt);
      else updatePlayer(dt, input, crashAndDie);
    }
    if (game.missionRealism?.ejection?.active) {
      pilotVisual.visible = true;
      pilotVisual.position.y = game.missionRealism.ejection.descentY;
      pilotVisual.position.x = jet.position.x;
      pilotVisual.position.z = jet.position.z;
      if (updateEjection(game.missionRealism.ejection, dt)) {
        // Paraquedas tocou o solo: recoloca o avião no aeroporto e rearma a
        // decolagem automática (mesmo caminho do crash no solo) — senão o avião
        // ficava parado no ar em NEXT_SORTIE_READY, sem conseguir decolar.
        pilotVisual.visible = false;
        respawnAndRelaunch();
      }
    }
    updateWingmen(dt, jet);
    updateAllyWar(dt);
    // Player não passa wingmen: os inimigos do PLAYER não ferem os amigos
    // (cada lado tem os próprios inimigos).
    updateBullets(dt, jet.position, playerHit);
    updateMissiles(dt);
    updateNuclears(dt);
    updateNuclearFx(dt);
    updateTargets(dt, jet.position);
    updateBoss(dt, jet.position, playerHit);
    updatePickups(dt, jet.position);
    updateParticles(dt, jet.position);
    tickSmokeEmitters(dt);
    tickFactoryParticles(dt);
    updatePropFires(dt);
    updateSpeedLines();
    _activeMapUpdate(dt, jet.position);
    updateAmbientFlak(dt, jet.position, jet.quaternion);

    // Ambient audio: radio chatter + distant booms
    _radioTimer -= dt;
    if (_radioTimer <= 0) { audio.radioChatter(); _radioTimer = 8 + game.rng.range(0, 17); }
    _boomTimer -= dt;
    if (_boomTimer <= 0) { audio.distantExplosion(); _boomTimer = 8 + game.rng.range(0, 12); }
    audio.setWindLevel(game.player.y);

    checkMissionComplete();

    if (game.player.lives <= 0 && !game.flags.missionFailed) gameOver();
    if (game.player.dead && !game.flags.missionFailed) gameOver();

    // Ciclo dia/noite — atualiza shader + luzes + fog
    updateSky(dt);
    const sun = getSunData();
    dirLight.color.setHex(sun.color);
    dirLight.intensity = sun.intensity;
    const amb = getAmbientData();
    ambLight.color.setHex(amb.color);
    ambLight.intensity = amb.intensity;
    if (game.activeMap === 'islands' || !game.activeMap) {
      scene.fog.color.setHex(getSkyColor());
    }
    jet.visible = game.flags.invincibility > 0 ? Math.floor(game.flags.invincibility * 12) % 2 === 0 : true;
  } else {
    if (game.flags.crashFreezeTime > 0) game.flags.crashFreezeTime -= dt;
    updateParticles(dt, jet.position);
    tickSmokeEmitters(dt);
    tickFactoryParticles(dt);
    updatePropFires(dt);
    updateNuclearFx(dt);
    _activeMapUpdate(dt, jet.position);
  }

  updateCamera(dt);
  updateCrosshair(dt, camera, jet.position, jet.quaternion);
  tickOverlayTimer(dt);
  updateHUD();
  updateMinimap();
  renderer.render(scene, camera);
}

// ─── Boot overlay + loop ─────────────────────────────────────────────────────
// A tela de seleção de mapa (#map-select no HTML) mostra primeiro.
// showOverlay de instruções é chamado dentro de selectMap() após a seleção.
// Se #map-select não existir (headless/teste), mostra overlay diretamente.
{
  const mapSelectEl = typeof document !== 'undefined' && document.getElementById('map-select');
  if (!mapSelectEl) {
    // Headless / sem map-select: inicia direto com mapa padrão
    game.activeMap = 'islands';
    showOverlay(
      'AERO STRIKE — F-35 LIGHTNING II',
      'Missão: destrua todos os alvos militares.\n\npressione Espaço para iniciar',
      0,
    );
  }
}
tick();
