// main.js — Orquestrador do Space War. Wire-up dos módulos + loop rAF.
// Carregado pelo index.html como <script type="module">.

import * as THREE from '../../vendor/three.module.min.js';
import { scene, camera, renderer } from './scene.js';
import { game } from './state.js';
import { createSkybox } from './skybox.js';
import { initUniverse, loadSystem as sysLoad, updateSOIView, updateBodyFX } from './celestial/system.js';
import { universeSystems } from './universe.js';
import { SYSTEMS } from './config.js';
import { updateWorldPhase, onWorldShift } from './world.js';
import { initOrbits, updateOrbits } from './orbits.js';
import { buildShip, updateShip, shipMesh, toggleObservationCamera, shiftShip } from './ship.js';
import { input, installListeners, onAction } from './input.js';
import {
  fireLaser, launchNuke, launchGravBomb, launchHiggs, updateProjectiles, enemyBomb,
  clearProjectiles, shiftProjectiles,
} from './weapons.js';
import { clearHiggs } from './higgs.js';
import { journeyToggle, journeyEligible, journeyWarp } from './journey.js';
import { updateEnemies, clearEnemies } from './enemies.js';
import {
  startMissions, beginFlight, updateMissions, debugCompleteMission, debugKillTarget,
  onSystemLoaded as missionsOnLoaded, onSystemUnloaded as missionsOnUnloaded,
} from './missions.js';
import { updateParticles, thruster, nukeBlast, explosion, shiftParticles } from './fx.js';
import { updateHUD, showOverlay, hideOverlay, showToast } from './hud.js';
import { initMap, toggleMap, drawMap } from './map.js';
import { buildNav, initNavHUD, drawNav, cycleTarget, targetBody, targetSystem } from './nav.js';
import { initPostFx, renderFrame, updateAdaptiveRes, setLens, setJourneyBeta } from './postfx.js';
import { buildStarfield, updateStarfield } from './starfield.js';
import { buildFarStars, disposeFarStars, updateFarStars } from './celestial/starlod.js';

// --- Construir o mundo (FASES, T-PR-06: só o sistema ativo materializa) ---
const skybox = createSkybox();
scene.add(skybox);
initUniverse(universeSystems(), {
  onLoaded(key) {
    initOrbits();
    // Avança a simulação 1 passo para posicionar os corpos.
    updateOrbits(0.0001);
    buildFarStars();
    buildNav();
    missionsOnLoaded(key);
  },
  onUnloaded() {
    clearEnemies();
    clearProjectiles();
    clearHiggs();
    disposeFarStars();
    missionsOnUnloaded();
    buildNav();
    // diagnósticos do Sol são escritos pelo fx da estrela — sem o solar
    // carregado ninguém os escreveria de novo (flags ficariam stale).
    game.sunFlareVisible = false;
    game.sunFlareFactor = 0;
  },
});
onWorldShift(shiftShip);
onWorldShift(shiftParticles);
onWorldShift(shiftProjectiles);
sysLoad('solar');
buildShip();
buildStarfield();
installListeners();
initMap();
initNavHUD();
initPostFx(renderer, scene, camera);

// Enquadra a Terra como pano de fundo do menu (offset proporcional ao raio).
const earthForMenu = game.bodies.find((b) => b.def.key === 'earth');
const er = earthForMenu.def.radius;
camera.position.set(earthForMenu.worldPos.x + er * 1.5, earthForMenu.worldPos.y + er * 0.6, earthForMenu.worldPos.z + er * 2.4);
camera.lookAt(earthForMenu.worldPos);

// --- Menu inicial ---
game.screen = 'menu';
showOverlay(`<div style="color:#7df;font-size:34px;letter-spacing:6px">SPACE WAR</div>
  <div class="sub"><b style="color:#ffd27a">5 SISTEMAS ESTELARES</b> — Sistema Solar · BETELGEUSE (supergigante
  vermelha + companheira Siwarha) · BINÁRIO buraco negro + pulsar (dentro do remanescente da
  supernova que criou o BN) · BINÁRIO CAÓTICO (2 estrelas, planetas em caos de 3 corpos) ·
  NÚCLEO DA GALÁXIA (12 estrelas S em <b>elipses keplerianas</b> ao redor de Sagitário A✦ —
  mire uma com <b>[N]</b> e <b>SIGA-A em órbita</b> enquanto ela contorna o buraco negro)<br>
  <i style="color:#c9a2ff">Física real: nada cai RETO num buraco negro — perto de corpos
  compactos o controle vira newtoniano (a gravidade CURVA sua trajetória) e dentro do
  disco de acreção o gás rouba energia: ESPIRAL DA MORTE, não sucção.</i><br><br>
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
  if (game.screen === 'menu') { game.screen = 'briefing'; startMissions(); }
  else if (game.screen === 'briefing') { game.screen = 'flight'; beginFlight(); hideOverlay(); }
  else if (game.screen === 'win' || game.screen === 'gameover') { location.reload(); }
});
onAction('nuke', () => { if (game.screen === 'flight') { if (!launchNuke()) showToast('Sem nukes ou nave pousada', 1500); } });
onAction('gravbomb', () => { if (game.screen === 'flight') { if (!launchGravBomb()) showToast('Decole para lançar a traçadora', 1500); } });
onAction('higgs', () => { if (game.screen === 'flight') { if (!launchHiggs()) showToast('Bomba de Higgs recarregando (ou nave pousada)', 1500); } });
onAction('map', () => { if (game.screen === 'flight' || game.mapOpen) toggleMap(); });
onAction('target', () => { if (game.screen === 'flight') cycleTarget(1); });
onAction('targetPrev', () => { if (game.screen === 'flight') cycleTarget(-1); });
onAction('align', () => { if (game.screen === 'flight') game.ship.aligning = true; });
onAction('approach', () => {
  if (game.screen !== 'flight') return;
  game.ship.approach = !game.ship.approach;
  if (game.ship.approach) game.ship.orbitAssist = false;
  showToast(game.ship.approach ? '⏵ AUTO-APROXIMAÇÃO: voando até o alvo (qualquer manche cancela)' : 'auto-aproximação off', 1800);
});
onAction('orbit', () => {
  if (game.screen !== 'flight') return;
  game.ship.orbitAssist = !game.ship.orbitAssist;
  if (game.ship.orbitAssist) game.ship.approach = false;
  showToast(game.ship.orbitAssist
    ? `◎ ASSISTENTE DE ÓRBITA: circularizando em torno de ${game.ship.dominant?.def?.name ?? '...'}`
    : 'assistente de órbita off', 2000);
});
onAction('look', () => {
  if (game.screen !== 'flight') return;
  const on = toggleObservationCamera();
  showToast(on ? '👁 CÂMERA DE OBSERVAÇÃO: arraste o mouse p/ girar, scroll p/ zoom — [V] volta' : 'câmera de perseguição', 2200);
});
onAction('assist', () => {
  if (game.screen !== 'flight') return;
  // [Z] CONTEXTUAL (decisão do operador): alvo de OUTRO sistema → engata/aborta
  // a viagem interestelar; alvo local → toggle de assist (comportamento clássico).
  if ((game.journey && game.journey.active) || journeyEligible()) {
    if (journeyToggle() === null) showToast('⭒ Decole antes de engatar a viagem interestelar', 2200);
    return;
  }
  game.ship.flightAssist = !game.ship.flightAssist;
  showToast(game.ship.flightAssist ? '🛟 PILOTO ASSISTIDO: LIGADO' : '🚀 NEWTONIANO: inércia real (assist desligado)', 2200);
});
onAction('pause', () => { if (game.screen === 'flight') { game.paused = !game.paused; showToast(game.paused ? '⏸ PAUSA' : '', game.paused ? 99999 : 1); } });

// --- Loop ---
const clock = new THREE.Clock();
const _back = new THREE.Vector3();
const _thrPos = new THREE.Vector3();
let acc = 0, frames = 0;

function loop() {
  requestAnimationFrame(loop);
  let dt = clock.getDelta();
  updateAdaptiveRes(dt);                // dt REAL (pré-clamp) mede a carga de verdade
  if (dt > 0.05) dt = 0.05;             // clamp p/ estabilidade
  game.time += dt;

  // skybox sempre centrada na câmera (= infinitamente longe)
  skybox.position.copy(camera.position);

  if ((game.screen === 'flight') && !game.paused) {
    updateOrbits(dt);
    updateBodyFX(dt);
    updateShip(dt);
    if (input.fire) fireLaser(dt);
    // trilha do motor
    _back.set(0, 0, 1).applyQuaternion(game.ship.quat);
    _thrPos.copy(shipMesh().position).addScaledVector(_back, 8);
    thruster(_thrPos, _back, game.ship.throttle * (game.ship.boost ? 2 : 1));
    updateEnemies(dt);
    updateProjectiles(dt);
    updateMissions(dt);
    updateWorldPhase();                  // FASES: load/unload + rebase por posição
    updateSOIView(game.ship.pos);
    if (game.ship.orbitLocked > 2.3) {   // recém-fechada (ship.js decrementa)
      showToast(`◎ ÓRBITA CIRCULAR ESTABELECIDA em torno de ${game.ship.dominant?.def?.name ?? ''} — throttle 0 = coast`, 2600);
    }
    if (game.ship.hp <= 0 && game.screen === 'flight') gameOver();
  } else if (game.screen === 'briefing') {
    // planetas continuam girando no fundo do briefing
    updateOrbits(dt);
    updateBodyFX(dt);
  }

  updateParticles(dt);
  updateHUD();
  drawNav();
  drawMap();
  updateGravLens();
  updateStarfield();
  updateFarStars();
  // Tint relativístico de tela gateado pela MESMA fronteira do starfield
  // (audit P0-1): dentro do sistema β_vis = 0 — nada de pinch/Doppler de tela
  // com planetas ainda em volta. updateStarfield acabou de publicar o fade.
  setJourneyBeta(game.journey && game.journey.active
    ? game.journey.beta * (game.starfieldFade ?? 1) : 0);
  renderFrame();

  // fps
  acc += dt; frames++;
  if (acc >= 0.5) { game.fps = Math.round(frames / acc); acc = 0; frames = 0; }
}

// LENTE GRAVITACIONAL: acha o corpo compacto mais "aparente" na tela (rs/dist) e
// alimenta o passe de lente — o fundo estica em arcos ao redor do horizonte,
// como nas imagens do EHT. Fora de alcance, mix 0 (custo ~zero).
// Prints D.A 2026-07-02: "a parte mais notável não é o tamanho — é a DISTORÇÃO"
// → a lente liga MUITO mais longe (rs·1400) e a estrela de nêutrons também
// curva o espaço (lensRs pequeno), mesmo sem ser um buraco negro.
const _lensV = new THREE.Vector3();
function updateGravLens() {
  let best = null, bestApp = 0;
  for (const b of game.bodies) {
    if (!b.group.visible) continue;
    const kind = b.def.kind;
    if (kind !== 'blackhole' && kind !== 'neutron') continue;
    const rs = b.def.lensRs || b.def.rs || b.def.radius;
    const dist = camera.position.distanceTo(b.worldPos);
    if (dist < rs * 2 || dist > rs * 1400) continue;
    const app = rs / dist;
    if (app > bestApp) { bestApp = app; best = b; }
  }
  if (!best) { setLens(0, 0, 0, 0); return; }
  _lensV.copy(best.worldPos).project(camera);
  // atrás da câmera ou fora da tela (com margem p/ os arcos): desliga
  if (_lensV.z > 1 || Math.abs(_lensV.x) > 1.6 || Math.abs(_lensV.y) > 1.6) { setLens(0, 0, 0, 0); return; }
  // raio de Einstein na tela ∝ √(rs/dist) (regime de lente fina), limitado
  const theta = Math.min(0.38, 0.55 * Math.sqrt(bestApp));
  const mix = Math.max(0, Math.min(1, (bestApp - 0.0007) / 0.0035));
  const bx = _lensV.x, by = _lensV.y;
  // posição da NAVE na tela (proteção do 1º plano na lente)
  _lensV.copy(game.ship.pos).project(camera);
  setLens(bx, by, theta, mix, _lensV.x, _lensV.y, best.def.kind === 'blackhole' ? 1 : 0);
}

function gameOver() {
  game.screen = 'gameover';
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
    launchGravBomb: () => launchGravBomb(),
    launchHiggs(outcome = null) { game.higgsForceOutcome = outcome; return launchHiggs(); },
    journeyToggle: () => journeyToggle(),
    journeyWarp: (s) => journeyWarp(s),
    target(key) {
      const k = String(key).toLowerCase();
      const b = game.bodies.find((x) => (x.def.key || '').toLowerCase() === k);
      if (b) { targetBody(b); return true; }
      // FASES: corpos de outros sistemas não existem — mira o DESCRITOR do
      // sistema (aceita a chave do sistema ou a da primária).
      const sys = SYSTEMS.find((s) => s.key.toLowerCase() === k || s.primary.toLowerCase() === k);
      if (sys && sys.key !== game.world.systemKey) return targetSystem(sys.key);
      return false;
    },
    // FASES (QA): troca a fase diretamente — descarrega o sistema atual,
    // materializa `key` na origem e posiciona a nave na primária.
    loadSystem(key, distMul = 3.2) {
      const sys = SYSTEMS.find((s) => s.key === String(key));
      if (!sys) return false;
      if (game.world.systemKey !== sys.key && !sysLoad(sys.key)) return false;
      return this.goTo(sys.primary, distMul);
    },
    shipReport() {
      const m = shipMesh();
      let pointLights = 0, redLamps = 0, cones = 0, rimIntensity = 0;
      m.traverse((o) => {
        if (o.isPointLight) { pointLights++; rimIntensity = Math.max(rimIntensity, o.intensity); }
        if (o.isMesh && o.material && o.material.color && o.material.color.r > 0.5
            && o.material.color.g < 0.35 && o.material.color.b < 0.35
            && o.geometry && o.geometry.type === 'SphereGeometry') redLamps++;
        if (o.isMesh && o.geometry && o.geometry.type === 'ConeGeometry'
            && o.material && o.material.transparent) cones++;
      });
      return { pointLights, redLamps, cones, rimIntensity };
    },
    // Teleporta a nave para o lado iluminado de um corpo e aponta o nariz para
    // ele. FASES: se o corpo pertence a um sistema descarregado, troca a fase
    // (procura sistema a sistema — QA determinístico, custo só em testes).
    goTo(name, distMul = 3.2, elev = 0.6) {
      const key = String(name).toLowerCase();
      const find = () => game.bodies.find(
        (x) => (x.def.key || '').toLowerCase() === key || x.def.name.toLowerCase() === key);
      let b = find();
      if (!b) {
        const prev = game.world.systemKey;
        for (const sys of SYSTEMS) {
          if (sys.key === game.world.systemKey) continue;
          sysLoad(sys.key);
          b = find();
          if (b) break;
        }
        if (!b) { if (prev) sysLoad(prev); return false; }
      }
      game.screen = 'flight';
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
    // Teleporta a nave para PERTO DO OBJETIVO da missão atual (radialmente acima
    // da base / ao lado da nave capital) e aponta o nariz. Determinístico p/ QA:
    // o goTo por corpo depende da FASE ORBITAL aleatória de boot + posição
    // aleatória da base na superfície — uma loteria que flakeava o teste do
    // solver balístico (pré-existente; corrigido na photometric-stars rc-1).
    goToObjective(dist = 7000) {
      const m = game.mission;
      const t = m && m.targets ? m.targets[m.targets.length - 1] : null;
      if (!t || t.destroyed) return false;
      game.screen = 'flight';
      const s = game.ship;
      s.landed = false; s.throttle = 0;
      // CO-MÓVEL com o corpo do alvo: sem isto a nave deriva ~250 u/s em relação
      // à base (a Lua anda!) e cai do encontro durante a espera do teste.
      if (t.body.worldVel) s.vel.copy(t.body.worldVel); else s.vel.set(0, 0, 0);
      const up = new THREE.Vector3().copy(t.obj.position).sub(t.body.worldPos);
      if (up.lengthSq() < 1e-6) up.set(0, 1, 0); else up.normalize();
      s.pos.copy(t.obj.position).addScaledVector(up, dist);
      const mLook = new THREE.Matrix4().lookAt(s.pos, t.obj.position, _up);
      s.quat.setFromRotationMatrix(mLook);
      return true;
    },
    // Detona uma nuke logo à frente da nave (espetáculo de teste).
    nuke() {
      const f = new THREE.Vector3(0, 0, -1).applyQuaternion(game.ship.quat);
      nukeBlast(game.ship.pos.clone().addScaledVector(f, 30));
    },
    boom() { explosion(game.ship.pos.clone(), 1.5); },
    // Campanha (QA): força a conclusão da missão ativa (gating/unlock testável).
    winMission() { return debugCompleteMission(); },
    // Caçada (QA): destrói SÓ o alvo atual — testa a cadeia k → k+1.
    killTarget() { return debugKillTarget(); },
    // Solta uma bomba inimiga parada perto da nave (prova AC-04: gravidade age).
    dropBomb() {
      const f = new THREE.Vector3(0, 0, -1).applyQuaternion(game.ship.quat);
      enemyBomb(game.ship.pos.clone().addScaledVector(f, 220), new THREE.Vector3(0, 0, 0));
      return game.projectiles.filter((p) => p.isBomb).length;
    },
  };
}
