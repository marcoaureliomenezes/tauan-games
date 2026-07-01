// main.js — Orquestrador do Space War. Wire-up dos módulos + loop rAF.
// Carregado pelo index.html como <script type="module">.

import * as THREE from '../../vendor/three.module.min.js';
import { scene, camera, renderer } from './scene.js';
import { game } from './state.js';
import { createSkybox } from './skybox.js';
import { buildSolarSystem, updateSOIView, updateBodyFX } from './bodies.js';
import { initOrbits, updateOrbits } from './orbits.js';
import { buildShip, updateShip, shipMesh, toggleObservationCamera } from './ship.js';
import { input, installListeners, onAction } from './input.js';
import { fireLaser, launchNuke, updateProjectiles } from './weapons.js';
import { spawnEnemies, updateEnemies } from './enemies.js';
import { startMissions, beginFlight, updateMissions } from './missions.js';
import { updateParticles, thruster, nukeBlast, explosion } from './fx.js';
import { updateHUD, showOverlay, hideOverlay, showToast } from './hud.js';
import { initMap, toggleMap, drawMap } from './map.js';
import { buildNav, initNavHUD, drawNav, cycleTarget } from './nav.js';
import { initPostFx, renderFrame } from './postfx.js';

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
initPostFx(renderer, scene, camera);

// Enquadra a Terra como pano de fundo do menu (offset proporcional ao raio).
const earthForMenu = game.bodies.find((b) => b.def.key === 'earth');
const er = earthForMenu.def.radius;
camera.position.set(earthForMenu.worldPos.x + er * 1.5, earthForMenu.worldPos.y + er * 0.6, earthForMenu.worldPos.z + er * 2.4);
camera.lookAt(earthForMenu.worldPos);

// --- Menu inicial ---
game.phase = 'menu';
showOverlay(`<div style="color:#7df;font-size:34px;letter-spacing:6px">SPACE WAR</div>
  <div class="sub"><b style="color:#ffd27a">5 SISTEMAS ESTELARES</b> — Sistema Solar · BETELGEUSE (supergigante
  vermelha + companheira Siwarha) · BINÁRIO buraco negro + pulsar (dentro do remanescente da
  supernova que criou o BN) · BINÁRIO CAÓTICO (2 estrelas, planetas em caos de 3 corpos) ·
  NÚCLEO DA GALÁXIA (12 estrelas orbitando caoticamente um buraco negro supermassivo)<br><br>
  <b style="color:#9fe">NAVEGAÇÃO:</b> <b>T</b> destino · <b>C</b> aponta · <b>N</b> auto-aproximação ·
  <b style="color:#8f8">O = ASSISTENTE DE ÓRBITA</b> (circulariza em torno de QUALQUER corpo — planeta,
  estrela, pulsar, buraco negro) · <b>V</b> câmera de observação (gira ao redor da nave)<br>
  <i style="color:#7a9">Fora dos sistemas o MOTOR INTERESTELAR desperta sozinho (velocidade ×4.5)
  — cada sistema fica a 1-3 min de viagem. Throttle 0 agora COASTA de verdade: entre em
  órbita, corte o motor e ela FECHA.</i><br><br>
  <b>W/S</b> empuxo · <b>Shift</b> turbo · <b>X</b> freio · <b>setas</b> guinada/arfagem · <b>A/D</b> rolagem<br>
  <b>Mouse</b> (clique p/ travar) pilota · <b>Espaço</b> laser · <b>F</b> nuke · <b>M</b> mapa · <b>P</b> pausa<br><br>
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
onAction('approach', () => {
  if (game.phase !== 'flight') return;
  game.ship.approach = !game.ship.approach;
  if (game.ship.approach) game.ship.orbitAssist = false;
  showToast(game.ship.approach ? '⏵ AUTO-APROXIMAÇÃO: voando até o alvo (qualquer manche cancela)' : 'auto-aproximação off', 1800);
});
onAction('orbit', () => {
  if (game.phase !== 'flight') return;
  game.ship.orbitAssist = !game.ship.orbitAssist;
  if (game.ship.orbitAssist) game.ship.approach = false;
  showToast(game.ship.orbitAssist
    ? `◎ ASSISTENTE DE ÓRBITA: circularizando em torno de ${game.ship.dominant?.def?.name ?? '...'}`
    : 'assistente de órbita off', 2000);
});
onAction('look', () => {
  if (game.phase !== 'flight') return;
  const on = toggleObservationCamera();
  showToast(on ? '👁 CÂMERA DE OBSERVAÇÃO: arraste o mouse p/ girar, scroll p/ zoom — [V] volta' : 'câmera de perseguição', 2200);
});
onAction('assist', () => {
  if (game.phase !== 'flight') return;
  game.ship.flightAssist = !game.ship.flightAssist;
  showToast(game.ship.flightAssist ? '🛟 PILOTO ASSISTIDO: LIGADO' : '🚀 NEWTONIANO: inércia real (assist desligado)', 2200);
});
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
    updateBodyFX(dt);
    updateShip(dt);
    if (input.fire) fireLaser(dt);
    // trilha do motor
    _back.set(0, 0, 1).applyQuaternion(game.ship.quat);
    thruster(shipMesh().position.clone().addScaledVector(_back, 8), _back, game.ship.throttle * (game.ship.boost ? 2 : 1));
    updateEnemies(dt);
    updateProjectiles(dt);
    updateMissions(dt);
    updateSOIView(game.ship.pos);
    if (game.ship.orbitLocked > 2.3) {   // recém-fechada (ship.js decrementa)
      showToast(`◎ ÓRBITA CIRCULAR ESTABELECIDA em torno de ${game.ship.dominant?.def?.name ?? ''} — throttle 0 = coast`, 2600);
    }
    if (game.ship.hp <= 0 && game.phase === 'flight') gameOver();
  } else if (game.phase === 'briefing') {
    // planetas continuam girando no fundo do briefing
    updateOrbits(dt);
    updateBodyFX(dt);
  }

  updateParticles(dt);
  updateHUD();
  drawNav();
  drawMap();
  renderFrame();

  // fps
  acc += dt; frames++;
  if (acc >= 0.5) { game.fps = Math.round(frames / acc); acc = 0; frames = 0; }
}

function gameOver() {
  game.phase = 'gameover';
  const by = game.ship.killedBy;
  const titles = {
    blackhole: '🕳 ESPAGUETIFICADO NO BURACO NEGRO',
    neutron: '⭐ ESMAGADO PELA ESTRELA DE NÊUTRONS',
    gas: '🌪 ESMAGADO NO GIGANTE GASOSO',
    sea: '🌊 QUEIMOU NA REENTRADA E CAIU NO MAR',
    sun: '☀ INCINERADO NO SOL',
  };
  const title = titles[by] || '💥 NAVE DESTRUÍDA';
  const color = by ? '#b18cff' : '#f55';
  showOverlay(`<div style="color:${color}">${title}</div><div class="sub">Score: ${game.score} · Abates: ${game.kills}<br><br>[Enter] para reiniciar</div>`);
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
