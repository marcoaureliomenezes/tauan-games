// main.js — Orquestrador do Space War. Wire-up dos módulos + loop rAF.
// Carregado pelo index.html como <script type="module">.

import * as THREE from '../../vendor/three.module.min.js';
import { scene, camera, renderer } from './scene.js';
import { game } from './state.js';
import { createSkybox } from './skybox.js';
import { buildSolarSystem, updateSOIView } from './bodies.js';
import { initOrbits, updateOrbits } from './orbits.js';
import { buildShip, updateShip, shipMesh } from './ship.js';
import { input, installListeners, onAction } from './input.js';
import { fireLaser, launchNuke, updateProjectiles } from './weapons.js';
import { spawnEnemies, updateEnemies } from './enemies.js';
import { startMissions, beginFlight, updateMissions } from './missions.js';
import { updateParticles, thruster, nukeBlast, explosion } from './fx.js';
import { updateHUD, showOverlay, hideOverlay, showToast } from './hud.js';
import { initMap, toggleMap, drawMap } from './map.js';
import { buildNav, initNavHUD, drawNav, cycleTarget } from './nav.js';

// --- Construir o mundo ---
const skybox = createSkybox();
scene.add(skybox);
buildSolarSystem();
initOrbits();
// Avança a simulação 1 passo para posicionar os corpos antes de criar a nave.
updateOrbits(0.0001);
buildShip();
spawnEnemies();
installListeners();
initMap();
buildNav();
initNavHUD();

// Enquadra a Terra como pano de fundo do menu (offset proporcional ao raio).
const earthForMenu = game.bodies.find((b) => b.def.key === 'earth');
const er = earthForMenu.def.radius;
camera.position.set(earthForMenu.worldPos.x + er * 1.5, earthForMenu.worldPos.y + er * 0.6, earthForMenu.worldPos.z + er * 2.4);
camera.lookAt(earthForMenu.worldPos);

// --- Menu inicial ---
game.phase = 'menu';
showOverlay(`<div style="color:#7df;font-size:34px;letter-spacing:6px">SPACE WAR</div>
  <div class="sub">Decole da Terra · Cruze o Sistema Solar · Liberte os planetas<br><br>
  <b style="color:#9fe">NAVEGAÇÃO:</b> <b>T</b> escolhe o destino · <b>C</b> aponta a nave nele · <b>W</b> acelera até lá<br>
  (a seta/mira na tela sempre mostra para onde ir)<br><br>
  <b>W/S</b> empuxo · <b>Shift</b> turbo · <b>X</b> freio · <b>setas</b> guinada/arfagem · <b>A/D</b> rolagem<br>
  <b>Mouse</b> (clique p/ travar) pilota · <b>Espaço</b> laser · <b>F</b> nuke · <b>M</b> mapa · <b>P</b> pausa<br>
  <i style="color:#7a9">Física real: você tem inércia. Use o freio (X) pra parar e o turbo pra grandes distâncias.</i><br><br>
  [Enter] para iniciar</div>`);

// --- Ações discretas ---
onAction('start', () => {
  if (game.phase === 'menu') { game.phase = 'briefing'; startMissions(); }
  else if (game.phase === 'briefing') { game.phase = 'flight'; beginFlight(); hideOverlay(); }
  else if (game.phase === 'win' || game.phase === 'gameover') { location.reload(); }
});
onAction('nuke', () => { if (game.phase === 'flight') { if (!launchNuke()) showToast('Sem nukes ou nave pousada', 1500); } });
onAction('map', () => { if (game.phase === 'flight' || game.mapOpen) toggleMap(); });
onAction('target', () => { if (game.phase === 'flight') cycleTarget(1); });
onAction('targetPrev', () => { if (game.phase === 'flight') cycleTarget(-1); });
onAction('align', () => { if (game.phase === 'flight') game.ship.aligning = true; });
onAction('pause', () => { if (game.phase === 'flight') { game.paused = !game.paused; showToast(game.paused ? '⏸ PAUSA' : '', game.paused ? 99999 : 1); } });

// --- Loop ---
const clock = new THREE.Clock();
const _back = new THREE.Vector3();
let acc = 0, frames = 0;

function loop() {
  requestAnimationFrame(loop);
  let dt = clock.getDelta();
  if (dt > 0.05) dt = 0.05;             // clamp p/ estabilidade
  game.time += dt;

  // skybox sempre centrada na câmera (= infinitamente longe)
  skybox.position.copy(camera.position);

  if ((game.phase === 'flight') && !game.paused) {
    updateOrbits(dt);
    updateShip(dt);
    if (input.fire) fireLaser(dt);
    // trilha do motor
    _back.set(0, 0, 1).applyQuaternion(game.ship.quat);
    thruster(shipMesh().position.clone().addScaledVector(_back, 8), _back, game.ship.throttle * (game.ship.boost ? 2 : 1));
    updateEnemies(dt);
    updateProjectiles(dt);
    updateMissions(dt);
    updateSOIView(game.ship.pos);
    if (game.ship.hp <= 0 && game.phase === 'flight') gameOver();
  } else if (game.phase === 'briefing') {
    // planetas continuam girando no fundo do briefing
    updateOrbits(dt);
  }

  updateParticles(dt);
  updateHUD();
  drawNav();
  drawMap();
  renderer.render(scene, camera);

  // fps
  acc += dt; frames++;
  if (acc >= 0.5) { game.fps = Math.round(frames / acc); acc = 0; frames = 0; }
}

function gameOver() {
  game.phase = 'gameover';
  showOverlay(`<div style="color:#f55">💥 NAVE DESTRUÍDA</div><div class="sub">Score: ${game.score} · Abates: ${game.kills}<br><br>[Enter] para reiniciar</div>`);
}

loop();

// Sinaliza para os testes que o jogo inicializou.
game.ready = true;
if (typeof window !== 'undefined') window.__spaceWarReady = true;

// --- Debug/QA API (como o __aeroDebug do aero-fighters) ---
// Permite enquadrar qualquer corpo deterministicamente para inspeção visual.
if (typeof window !== 'undefined') {
  const _up = new THREE.Vector3(0, 1, 0);
  window.__swDebug = {
    list: () => game.bodies.map((b) => b.def.key || b.def.name),
    // Teleporta a nave para o lado iluminado de um corpo e aponta o nariz para ele.
    goTo(name, distMul = 3.2, elev = 0.6) {
      const key = String(name).toLowerCase();
      const b = game.bodies.find((x) => (x.def.key || '').toLowerCase() === key || x.def.name.toLowerCase() === key);
      if (!b) return false;
      game.phase = 'flight';
      const s = game.ship;
      s.landed = false; s.vel.set(0, 0, 0); s.throttle = 0;
      const r = b.def.radius;
      // Direção do Sol (corpo → origem) para enquadrar o hemisfério iluminado.
      const toSun = new THREE.Vector3().copy(b.worldPos).multiplyScalar(-1);
      if (toSun.lengthSq() < 1e-6) toSun.set(0, 0, 1);   // o próprio Sol: direção arbitrária
      toSun.normalize();
      s.pos.copy(b.worldPos).addScaledVector(toSun, r * distMul).addScaledVector(_up, r * elev);
      const m = new THREE.Matrix4().lookAt(s.pos, b.worldPos, _up);
      s.quat.setFromRotationMatrix(m);    // nariz (-Z) aponta para o corpo
      return true;
    },
    // Detona uma nuke logo à frente da nave (espetáculo de teste).
    nuke() {
      const f = new THREE.Vector3(0, 0, -1).applyQuaternion(game.ship.quat);
      nukeBlast(game.ship.pos.clone().addScaledVector(f, 30));
    },
    boom() { explosion(game.ship.pos.clone(), 1.5); },
  };
}
