// Web game package: james-bond.
import { MISSIONS } from './content/missions.js';
import { WEAPONS } from './content/weapons.js';
import { CONFIG } from './config.js';

const $ = (selector) => document.querySelector(selector);
const screens = ['menu', 'briefing', 'pause', 'result'];

export function createUi(game) {
  let callbacks = {};
  let selected = game.missionIndex;
  let mapOpen = false;
  let hitTimer = 0;
  const hudCache = { health: -1, armor: -1, mag: -1, reserve: -1, weapon: '', alert: null, objectives: '', code: '' };

  function screen(id) {
    mapOpen = false;
    $('#tactical-map').classList.add('is-hidden');
    screens.forEach((name) => $(`#${name}`).classList.toggle('screen-active', name === id));
    $('#hud').classList.toggle('is-hidden', id !== null);
    $('#radar').classList.toggle('is-hidden', id !== null);
  }

  function renderSelector() {
    const host = $('#mission-selector');
    host.replaceChildren();
    MISSIONS.forEach((mission, index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `mission-tab${index >= game.unlocked ? ' locked' : ''}`;
      button.textContent = String(index + 1).padStart(2, '0');
      button.disabled = index >= game.unlocked;
      button.setAttribute('aria-selected', String(index === selected));
      button.addEventListener('click', () => selectMission(index));
      host.append(button);
    });
  }

  function selectMission(index) {
    if (index >= game.unlocked) return;
    selected = index;
    const mission = MISSIONS[index];
    $('#menu-code').textContent = `OPERAÇÃO ${String(index + 1).padStart(2, '0')}`;
    $('#menu-title').textContent = mission.title;
    $('#menu-brief').textContent = mission.brief;
    renderSelector();
    callbacks.preview?.(index);
  }

  function showBriefing() {
    const mission = MISSIONS[selected];
    $('#brief-code').textContent = mission.code;
    $('#brief-title').textContent = mission.title;
    $('#brief-location').textContent = mission.location;
    $('#brief-objectives').replaceChildren(...Object.values(mission.objectives).map((label) => {
      const item = document.createElement('li'); item.textContent = label; return item;
    }));
    screen('briefing');
  }

  // Change-only DOM writes: the fixed loop calls this at ~10 Hz and on events.
  function updateHud() {
    const mission = MISSIONS[game.missionIndex];
    if (hudCache.code !== mission.code) {
      hudCache.code = mission.code;
      $('#mission-code').textContent = mission.code;
      $('#mission-name').textContent = mission.title;
    }
    const health = Math.max(0, Math.round(game.health));
    if (hudCache.health !== health) { hudCache.health = health; $('#health').value = health; }
    const armor = Math.max(0, Math.round(game.armor));
    if (hudCache.armor !== armor) { hudCache.armor = armor; $('#armor').value = armor; }
    const weapon = WEAPONS[game.currentWeapon];
    const ammo = game.ammo[game.currentWeapon];
    if (hudCache.weapon !== weapon.name) { hudCache.weapon = weapon.name; $('#weapon-name').textContent = weapon.name; }
    const mag = ammo?.mag ?? 0;
    const reserve = ammo?.reserve ?? 0;
    if (hudCache.mag !== mag) { hudCache.mag = mag; $('#ammo-mag').textContent = mag; }
    if (hudCache.reserve !== reserve) { hudCache.reserve = reserve; $('#ammo-reserve').textContent = reserve; }
    const alert = game.alertLevel > 0.05;
    if (hudCache.alert !== alert) {
      hudCache.alert = alert;
      $('#alert-state').textContent = alert ? 'ALERTA' : 'OCULTO';
      $('#alert-state').classList.toggle('alert', alert);
    }
    const signature = game.objectives.map((objective) => `${objective.key}${objective.done ? 1 : 0}`).join('');
    if (hudCache.objectives !== signature) {
      hudCache.objectives = signature;
      $('#objective-list').replaceChildren(...game.objectives.map((objective) => {
        const row = document.createElement('div');
        row.className = `objective${objective.done ? ' done' : ''}`;
        row.textContent = `${objective.done ? '✓' : '○'} ${objective.label}`;
        return row;
      }));
    }
  }

  // Dynamic crosshair: gap tracks weapon spread, fades out in ADS.
  const crosshairElement = $('#crosshair');
  const hitmarkerElement = $('#hitmarker');
  function crosshair(view) {
    const gap = Math.round(Math.min(46, 4 + view.spread * 1600));
    crosshairElement.style.setProperty('--gap', `${gap}px`);
    crosshairElement.style.opacity = String(1 - view.adsT * 0.92);
    if (hitTimer > 0) {
      hitTimer -= CONFIG.fixedStep;
      if (hitTimer <= 0) hitmarkerElement.classList.remove('show', 'kill');
    }
  }

  function hitmarker(killed, headshot) {
    hitmarkerElement.classList.remove('show', 'kill');
    void hitmarkerElement.offsetWidth;
    hitmarkerElement.classList.add('show');
    if (killed || headshot) hitmarkerElement.classList.add('kill');
    hitTimer = killed ? 0.3 : 0.14;
  }

  function prompt(label) {
    const element = $('#interaction-prompt');
    element.classList.toggle('is-hidden', !label);
    element.querySelector('span').textContent = label || '';
  }

  function showResult(success) {
    $('#result-kicker').textContent = success ? 'MISSÃO CONCLUÍDA' : 'MISSÃO FRACASSADA';
    $('#result-title').textContent = success ? 'EXTRAÇÃO CONFIRMADA' : 'AGENTE FORA DE COMBATE';
    const accuracy = game.shots ? Math.round(game.hits / game.shots * 100) : 0;
    $('#result-stats').innerHTML = `<div><strong>${formatTime(game.time)}</strong><small>TEMPO</small></div><div><strong>${accuracy}%</strong><small>PRECISÃO</small></div><div><strong>${game.kills}</strong><small>BAIXAS</small></div>`;
    $('#next-button').classList.toggle('is-hidden', !success || game.missionIndex >= MISSIONS.length - 1);
    screen('result');
  }

  function drawRadar(world, camera, large = false) {
    const canvas = large ? $('#map-canvas') : $('#radar');
    const ctx = canvas.getContext('2d');
    const scale = large ? Math.min(canvas.width / world.width, canvas.height / world.height) : canvas.width / (CONFIG.radarRange * 2);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = large ? '#0a0f0c' : 'rgba(5,10,7,.82)'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    if (large) drawGrid(ctx, world, scale, centerX, centerY);
    const playerX = large ? centerX + camera.position.x / CONFIG.cellSize * scale : centerX;
    const playerY = large ? centerY + camera.position.z / CONFIG.cellSize * scale : centerY;
    drawPoint(ctx, playerX, playerY, '#50e29a', 4);
    game.enemies.forEach((enemy) => {
      if (!enemy.alive || (!large && enemy.revealedUntil < game.time && enemy.state === 'patrol')) return;
      const x = large ? centerX + enemy.root.position.x / CONFIG.cellSize * scale : centerX + (enemy.root.position.x - camera.position.x) * scale;
      const y = large ? centerY + enemy.root.position.z / CONFIG.cellSize * scale : centerY + (enemy.root.position.z - camera.position.z) * scale;
      if (x > 2 && y > 2 && x < canvas.width - 2 && y < canvas.height - 2) drawPoint(ctx, x, y, '#ee5b55', 3);
    });
  }

  function drawGrid(ctx, world, scale, cx, cy) {
    ctx.fillStyle = '#313b34';
    world.walls.forEach((wall) => ctx.fillRect(cx + wall.x / CONFIG.cellSize * scale - scale / 2, cy + wall.z / CONFIG.cellSize * scale - scale / 2, scale, scale));
    ctx.fillStyle = '#50e29a'; ctx.fillRect(cx + world.extraction.x / CONFIG.cellSize * scale - 4, cy + world.extraction.z / CONFIG.cellSize * scale - 4, 8, 8);
    world.objectiveMeshes.filter((mesh) => mesh.userData.active).forEach((mesh) => drawPoint(ctx, cx + mesh.position.x / CONFIG.cellSize * scale, cy + mesh.position.z / CONFIG.cellSize * scale, '#f1bc58', 4));
  }

  function toggleMap(world, camera) {
    mapOpen = !mapOpen;
    $('#tactical-map').classList.toggle('is-hidden', !mapOpen);
    if (mapOpen) drawRadar(world, camera, true);
    return mapOpen;
  }

  $('#start-button').addEventListener('click', () => { game.difficulty = $('#difficulty').value; showBriefing(); });
  $('#deploy-button').addEventListener('click', () => callbacks.deploy?.(selected));
  $('#resume-button').addEventListener('click', () => callbacks.resume?.());
  $('#abort-button').addEventListener('click', () => callbacks.abort?.());
  $('#menu-button').addEventListener('click', () => callbacks.menu?.());
  $('#next-button').addEventListener('click', () => callbacks.next?.());
  $('#close-map').addEventListener('click', () => callbacks.toggleMap?.());

  renderSelector();
  selectMission(selected);
  return {
    setCallbacks(value) { callbacks = value; },
    screen, selectMission, showBriefing, updateHud, crosshair, hitmarker, prompt, showResult, drawRadar, toggleMap,
    refresh: renderSelector,
    get selected() { return selected; },
    get mapOpen() { return mapOpen; },
  };
}

function drawPoint(ctx, x, y, color, radius) { ctx.fillStyle = color; ctx.beginPath(); ctx.arc(x, y, radius, 0, Math.PI * 2); ctx.fill(); }
function formatTime(seconds) { const min = Math.floor(seconds / 60); return `${String(min).padStart(2, '0')}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`; }
