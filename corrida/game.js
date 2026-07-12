/* Corrida — primeiro jogavel top-down.
 * Runtime estatico: Phaser local + JS puro, sem rede e sem assets externos.
 */

(function () {
  'use strict';

  const WIDTH = 960;
  const HEIGHT = 720;
  const TOTAL_LAPS = 3;
  const PLAYER_START = { x: 486, y: 585, angle: -90 };
  const OFF_TRACK_MAX_SPEED = 3.8;
  const OFF_TRACK_ACCEL_MULTIPLIER = 0.55;
  const OFF_TRACK_DRAG = 0.94;
  const TRACK = {
    centerX: 480,
    centerY: 360,
    radiusX: 330,
    radiusY: 220,
    width: 118,
    outerRadiusX: 389,
    outerRadiusY: 279,
    innerRadiusX: 271,
    innerRadiusY: 161,
    startLine: { x: 474, y: 500, width: 12, height: 132 },
    offTrackProbe: { x: 480, y: 360 },
    palette: {
      asphalt: '#4d5562',
      offTrack: '#2f8a45',
      boundary: '#f5d547',
    },
  };
  const START_CROSSING_Y = TRACK.startLine.y + TRACK.startLine.height / 2;
  const CONTROLS_TEXT =
    'Acelerar: seta para cima ou W | Frear/re: seta para baixo ou S | Estercar: esquerda/direita ou A/D | Iniciar: espaco | Reiniciar: R';

  const checkpoints = [
    { x: 480, y: 145, width: 150, height: 20 },
    { x: 785, y: 360, width: 20, height: 150 },
    { x: 480, y: 575, width: 150, height: 20 },
    { x: 175, y: 360, width: 20, height: 150 },
  ];

  const waypoints = [
    { x: 480, y: 140 },
    { x: 650, y: 176 },
    { x: 792, y: 314 },
    { x: 765, y: 455 },
    { x: 600, y: 565 },
    { x: 430, y: 580 },
    { x: 230, y: 510 },
    { x: 160, y: 360 },
    { x: 240, y: 210 },
  ];

  const state = {
    ready: false,
    status: 'ready',
    lapCount: 0,
    totalLaps: TOTAL_LAPS,
    totalTimeMs: 0,
    currentLapTimeMs: 0,
    lastLapTimeMs: null,
    finalTimeMs: null,
    player: {
      x: PLAYER_START.x,
      y: PLAYER_START.y,
      speed: 0,
      angle: PLAYER_START.angle,
      onTrack: true,
      checkpointIndex: 0,
    },
    opponents: [],
    result: null,
  };

  let sceneRef = null;
  let hud = null;
  let cursors = null;
  let keys = null;
  let playerCar = null;
  let opponentCars = [];
  let trackGraphics = null;
  let checkpointGraphics = null;
  let lapStartMs = 0;
  let raceStartMs = 0;
  let previousPlayerY = PLAYER_START.y;

  function createOpponent(id, index) {
    const start = waypoints[(index * 2 + 5) % waypoints.length];
    return {
      id,
      x: start.x + index * 18,
      y: start.y + index * 12,
      angle: -90,
      lapCount: 0,
      waypointIndex: (index * 2 + 6) % waypoints.length,
      stuckMs: 0,
      lastX: start.x,
      lastY: start.y,
      totalTimeMs: null,
    };
  }

  function resetState() {
    state.ready = true;
    state.status = 'ready';
    state.lapCount = 0;
    state.totalTimeMs = 0;
    state.currentLapTimeMs = 0;
    state.lastLapTimeMs = null;
    state.finalTimeMs = null;
    state.result = null;
    state.player.x = PLAYER_START.x;
    state.player.y = PLAYER_START.y;
    state.player.speed = 0;
    state.player.angle = PLAYER_START.angle;
    state.player.onTrack = true;
    state.player.checkpointIndex = 0;
    state.opponents = [
      createOpponent('azul', 0),
      createOpponent('vermelho', 1),
      createOpponent('amarelo', 2),
    ];
    raceStartMs = 0;
    lapStartMs = 0;
    previousPlayerY = PLAYER_START.y;
  }

  function formatTime(ms) {
    const safe = Math.max(0, Math.floor(ms || 0));
    const seconds = Math.floor(safe / 1000);
    const centis = Math.floor((safe % 1000) / 10);
    return seconds + '.' + String(centis).padStart(2, '0') + 's';
  }

  function isPointOnTrack(x, y) {
    const outerDx = (x - TRACK.centerX) / TRACK.outerRadiusX;
    const outerDy = (y - TRACK.centerY) / TRACK.outerRadiusY;
    const innerDx = (x - TRACK.centerX) / TRACK.innerRadiusX;
    const innerDy = (y - TRACK.centerY) / TRACK.innerRadiusY;
    const insideOuterBoundary = outerDx * outerDx + outerDy * outerDy <= 1;
    const outsideInnerBoundary = innerDx * innerDx + innerDy * innerDy >= 1;
    return insideOuterBoundary && outsideInnerBoundary;
  }

  function overlapRect(point, rect) {
    return point.x >= rect.x - rect.width / 2 &&
      point.x <= rect.x + rect.width / 2 &&
      point.y >= rect.y - rect.height / 2 &&
      point.y <= rect.y + rect.height / 2;
  }

  function startRace() {
    if (state.status === 'finished') return;
    if (state.status !== 'running') {
      state.status = 'running';
      raceStartMs = performance.now() - state.totalTimeMs;
      lapStartMs = performance.now() - state.currentLapTimeMs;
    }
  }

  function finishRace() {
    if (state.status === 'finished') return;
    state.status = 'finished';
    state.finalTimeMs = state.totalTimeMs;
    state.player.speed = 0;

    const ranking = [
      { id: 'tauan', totalTimeMs: state.finalTimeMs || 1 },
      ...state.opponents.map(function (opponent, index) {
        const fallback = (state.finalTimeMs || 1) + 1200 + index * 900;
        return { id: opponent.id, totalTimeMs: opponent.totalTimeMs || fallback };
      }),
    ].sort(function (a, b) {
      return a.totalTimeMs - b.totalTimeMs;
    }).map(function (entry, index) {
      return {
        id: entry.id,
        position: index + 1,
        totalTimeMs: Math.floor(entry.totalTimeMs),
      };
    });

    const player = ranking.find(function (entry) { return entry.id === 'tauan'; });
    state.result = {
      ranking,
      playerPosition: player ? player.position : ranking.length,
      totalTimeMs: Math.floor(state.finalTimeMs || 0),
    };
  }

  function restartRace() {
    resetState();
    syncSprites();
    updateHud();
  }

  function completePlayerLapForTest() {
    if (state.status !== 'running') startRace();
    state.player.checkpointIndex = checkpoints.length;
    previousPlayerY = START_CROSSING_Y + 4;
    state.player.x = TRACK.startLine.x + TRACK.startLine.width / 2;
    state.player.y = START_CROSSING_Y - 2;
    state.player.onTrack = isPointOnTrack(state.player.x, state.player.y);
    registerStartLineCross();
    syncSprites();
    updateHud();
  }

  function teleportPlayerToCheckpoint(index) {
    const checkpoint = checkpoints[Math.max(0, Math.min(checkpoints.length - 1, index))];
    state.player.x = checkpoint.x;
    state.player.y = checkpoint.y;
    state.player.checkpointIndex = Math.max(state.player.checkpointIndex, index + 1);
    state.player.onTrack = isPointOnTrack(state.player.x, state.player.y);
    syncSprites();
  }

  function teleportPlayerOffTrackForTest(speed) {
    state.player.x = TRACK.offTrackProbe.x;
    state.player.y = TRACK.offTrackProbe.y;
    state.player.speed = Phaser.Math.Clamp(Number(speed) || 6, -OFF_TRACK_MAX_SPEED, OFF_TRACK_MAX_SPEED);
    state.player.onTrack = isPointOnTrack(state.player.x, state.player.y);
    syncSprites();
    updateHud();
  }

  function attemptStartLineCrossForTest(direction) {
    if (state.status !== 'running') startRace();
    state.player.x = TRACK.startLine.x + TRACK.startLine.width / 2;
    if (direction === 'wrong') {
      previousPlayerY = START_CROSSING_Y - 4;
      state.player.y = START_CROSSING_Y + 2;
    } else {
      previousPlayerY = START_CROSSING_Y + 4;
      state.player.y = START_CROSSING_Y - 2;
    }
    state.player.onTrack = isPointOnTrack(state.player.x, state.player.y);
    registerStartLineCross();
    syncSprites();
    updateHud();
  }

  function forceFinishForTest() {
    if (state.status !== 'running') startRace();
    state.lapCount = TOTAL_LAPS;
    state.totalTimeMs = Math.max(state.totalTimeMs, 1000);
    finishRace();
    updateHud();
  }

  function crossedStartLineForward() {
    return previousPlayerY > START_CROSSING_Y &&
      state.player.y <= START_CROSSING_Y &&
      overlapRect(state.player, TRACK.startLine);
  }

  function registerStartLineCross() {
    if (!crossedStartLineForward() || state.player.checkpointIndex < checkpoints.length) return;
    state.lapCount += 1;
    state.lastLapTimeMs = state.currentLapTimeMs;
    state.currentLapTimeMs = 0;
    state.player.checkpointIndex = 0;
    lapStartMs = performance.now();
    if (state.lapCount >= TOTAL_LAPS) finishRace();
  }

  function getDebugState() {
    return {
      ready: state.ready,
      status: state.status,
      lapCount: state.lapCount,
      totalLaps: state.totalLaps,
      totalTimeMs: Math.floor(state.status === 'finished' ? state.finalTimeMs || 0 : state.totalTimeMs),
      currentLapTimeMs: Math.floor(state.currentLapTimeMs),
      lastLapTimeMs: state.lastLapTimeMs === null ? null : Math.floor(state.lastLapTimeMs),
      player: {
        x: Math.round(state.player.x),
        y: Math.round(state.player.y),
        speed: Math.round(state.player.speed * 100) / 100,
        angle: Math.round(state.player.angle),
        onTrack: state.player.onTrack,
        checkpointIndex: state.player.checkpointIndex,
      },
      opponents: state.opponents.map(function (opponent) {
        return {
          id: opponent.id,
          lapCount: opponent.lapCount,
          waypointIndex: opponent.waypointIndex,
          stuckMs: Math.floor(opponent.stuckMs),
        };
      }),
      track: {
        palette: Object.assign({}, TRACK.palette),
        checkpointCount: checkpoints.length,
        startLine: Object.assign({}, TRACK.startLine),
        offTrackProbe: Object.assign({}, TRACK.offTrackProbe),
      },
      result: state.result ? {
        ranking: state.result.ranking.map(function (entry) { return Object.assign({}, entry); }),
        playerPosition: state.result.playerPosition,
        totalTimeMs: state.result.totalTimeMs,
      } : null,
      hud: {
        visible: Boolean(hud),
        lapText: hud ? hud.lap.text : 'Volta 0/' + TOTAL_LAPS,
        totalTimeText: hud ? hud.total.text : 'Total 0.00s',
        currentLapTimeText: hud ? hud.current.text : 'Volta atual 0.00s',
        controlsText: CONTROLS_TEXT,
        resultVisible: state.status === 'finished',
      },
    };
  }

  function drawTrack(scene) {
    trackGraphics.clear();
    trackGraphics.fillStyle(0x2f8a45, 1);
    trackGraphics.fillRect(0, 0, WIDTH, HEIGHT);
    trackGraphics.fillStyle(0x265e33, 1);
    trackGraphics.fillEllipse(TRACK.centerX, TRACK.centerY, TRACK.outerRadiusX * 2 + 62, TRACK.outerRadiusY * 2 + 52);
    trackGraphics.lineStyle(34, 0xf5d547, 1);
    trackGraphics.strokeEllipse(TRACK.centerX, TRACK.centerY, TRACK.outerRadiusX * 2, TRACK.outerRadiusY * 2);
    trackGraphics.lineStyle(TRACK.width, 0x4d5562, 1);
    trackGraphics.strokeEllipse(TRACK.centerX, TRACK.centerY, TRACK.radiusX * 2, TRACK.radiusY * 2);
    trackGraphics.lineStyle(8, 0xe7edf4, 1);
    trackGraphics.strokeEllipse(TRACK.centerX, TRACK.centerY, TRACK.innerRadiusX * 2, TRACK.innerRadiusY * 2);

    trackGraphics.fillStyle(0xffffff, 1);
    trackGraphics.fillRect(TRACK.startLine.x, TRACK.startLine.y - TRACK.startLine.height / 2, TRACK.startLine.width, TRACK.startLine.height);
    trackGraphics.fillStyle(0x111111, 1);
    for (let i = 0; i < 6; i += 1) {
      trackGraphics.fillRect(TRACK.startLine.x, TRACK.startLine.y - 60 + i * 22, TRACK.startLine.width, 11);
    }

    checkpointGraphics.clear();
    checkpointGraphics.lineStyle(2, 0x90cdf4, 0.35);
    checkpoints.forEach(function (checkpoint) {
      checkpointGraphics.strokeRect(
        checkpoint.x - checkpoint.width / 2,
        checkpoint.y - checkpoint.height / 2,
        checkpoint.width,
        checkpoint.height
      );
    });

    scene.add.text(28, HEIGHT - 34, 'CORRIDA', {
      fontFamily: 'Arial, Helvetica, sans-serif',
      fontSize: '18px',
      color: '#ffffff',
      fontStyle: 'bold',
    }).setAlpha(0.65);
  }

  function createCar(scene, color, label) {
    const group = scene.add.container(0, 0);
    const body = scene.add.rectangle(0, 0, 28, 46, color).setStrokeStyle(3, 0x101820);
    const cabin = scene.add.rectangle(0, -8, 16, 17, 0xd7f4ff);
    const nose = scene.add.triangle(0, -28, -10, 0, 10, 0, 0, -14, 0xffffff).setAlpha(0.9);
    const name = scene.add.text(0, 33, label, {
      fontFamily: 'Arial, Helvetica, sans-serif',
      fontSize: '13px',
      color: '#ffffff',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    group.add([body, cabin, nose, name]);
    return group;
  }

  function syncSprites() {
    if (playerCar) {
      playerCar.setPosition(state.player.x, state.player.y);
      playerCar.setRotation(Phaser.Math.DegToRad(state.player.angle + 90));
    }
    opponentCars.forEach(function (car, index) {
      const opponent = state.opponents[index];
      if (!opponent) return;
      car.setPosition(opponent.x, opponent.y);
      car.setRotation(Phaser.Math.DegToRad(opponent.angle + 90));
    });
  }

  function updateHud() {
    if (!hud) return;
    hud.lap.setText('Volta ' + Math.min(state.lapCount + 1, TOTAL_LAPS) + '/' + TOTAL_LAPS);
    hud.total.setText('Total ' + formatTime(state.status === 'finished' ? state.finalTimeMs : state.totalTimeMs));
    hud.current.setText('Volta atual ' + formatTime(state.currentLapTimeMs));
    hud.last.setText('Ultima ' + (state.lastLapTimeMs === null ? '--' : formatTime(state.lastLapTimeMs)));
    hud.status.setText(state.status === 'running' ? 'Correndo!' : state.status === 'finished' ? 'Resultado' : 'Pressione ESPACO para iniciar');
    hud.result.setVisible(state.status === 'finished');
    if (state.result) {
      hud.result.setText(
        'Fim de corrida\nPosicao: ' + state.result.playerPosition + ' de 4\nTempo: ' +
        formatTime(state.result.totalTimeMs) + '\nPressione R para correr de novo'
      );
    }
  }

  function updatePlayer(delta) {
    const accelPressed = cursors.up.isDown || keys.W.isDown;
    const brakePressed = cursors.down.isDown || keys.S.isDown;
    const leftPressed = cursors.left.isDown || keys.A.isDown;
    const rightPressed = cursors.right.isDown || keys.D.isDown;

    if (accelPressed || brakePressed || leftPressed || rightPressed) startRace();
    if (state.status !== 'running') return;

    const dt = delta / 16.6667;
    const trackGrip = state.player.onTrack ? 1 : OFF_TRACK_ACCEL_MULTIPLIER;
    if (accelPressed) state.player.speed += 0.18 * dt * trackGrip;
    if (brakePressed) state.player.speed -= 0.16 * dt;
    state.player.speed *= state.player.onTrack ? 0.985 : OFF_TRACK_DRAG;
    state.player.speed = Phaser.Math.Clamp(state.player.speed, -2.2, state.player.onTrack ? 7.2 : OFF_TRACK_MAX_SPEED);

    const turnPower = Phaser.Math.Clamp(Math.abs(state.player.speed) / 5.5, 0.25, 1);
    if (leftPressed) state.player.angle -= 3.1 * dt * turnPower;
    if (rightPressed) state.player.angle += 3.1 * dt * turnPower;

    previousPlayerY = state.player.y;
    const radians = Phaser.Math.DegToRad(state.player.angle);
    state.player.x += Math.cos(radians) * state.player.speed * dt;
    state.player.y += Math.sin(radians) * state.player.speed * dt;
    state.player.x = Phaser.Math.Clamp(state.player.x, 40, WIDTH - 40);
    state.player.y = Phaser.Math.Clamp(state.player.y, 40, HEIGHT - 40);
    state.player.onTrack = isPointOnTrack(state.player.x, state.player.y);
    if (!state.player.onTrack) {
      state.player.speed = Phaser.Math.Clamp(state.player.speed, -OFF_TRACK_MAX_SPEED, OFF_TRACK_MAX_SPEED);
    }

    const nextCheckpoint = checkpoints[state.player.checkpointIndex];
    if (nextCheckpoint && overlapRect(state.player, nextCheckpoint)) {
      state.player.checkpointIndex += 1;
    }

    registerStartLineCross();
  }

  function updateOpponents(delta) {
    if (state.status !== 'running') return;
    const dt = delta / 16.6667;
    state.opponents.forEach(function (opponent, index) {
      const target = waypoints[opponent.waypointIndex];
      const angle = Phaser.Math.Angle.Between(opponent.x, opponent.y, target.x, target.y);
      const speed = 3.25 + index * 0.18;
      opponent.x += Math.cos(angle) * speed * dt;
      opponent.y += Math.sin(angle) * speed * dt;
      opponent.angle = Phaser.Math.RadToDeg(angle);

      if (Phaser.Math.Distance.Between(opponent.x, opponent.y, target.x, target.y) < 24) {
        opponent.waypointIndex = (opponent.waypointIndex + 1) % waypoints.length;
        if (opponent.waypointIndex === 0) {
          opponent.lapCount += 1;
          if (opponent.lapCount >= TOTAL_LAPS && opponent.totalTimeMs === null) {
            opponent.totalTimeMs = state.totalTimeMs + 600 + index * 700;
          }
        }
      }

      const moved = Phaser.Math.Distance.Between(opponent.x, opponent.y, opponent.lastX, opponent.lastY);
      opponent.stuckMs = moved < 0.4 ? opponent.stuckMs + delta : 0;
      opponent.lastX = opponent.x;
      opponent.lastY = opponent.y;
    });
  }

  class CorridaScene extends Phaser.Scene {
    constructor() {
      super({ key: 'CorridaScene' });
    }

    create() {
      sceneRef = this;
      resetState();
      trackGraphics = this.add.graphics();
      checkpointGraphics = this.add.graphics();
      drawTrack(this);

      playerCar = createCar(this, 0x1f7ae0, 'TAUAN');
      opponentCars = [
        createCar(this, 0xe53e3e, 'IA 1'),
        createCar(this, 0xf6ad2f, 'IA 2'),
        createCar(this, 0x9f7aea, 'IA 3'),
      ];

      const hudStyle = {
        fontFamily: 'Arial, Helvetica, sans-serif',
        fontSize: '20px',
        color: '#ffffff',
        fontStyle: 'bold',
      };
      hud = {
        lap: this.add.text(22, 20, '', hudStyle),
        total: this.add.text(22, 48, '', hudStyle),
        current: this.add.text(22, 76, '', hudStyle),
        last: this.add.text(22, 104, '', hudStyle),
        status: this.add.text(WIDTH / 2, 20, '', hudStyle).setOrigin(0.5, 0),
        controls: this.add.text(WIDTH / 2, HEIGHT - 62, CONTROLS_TEXT, {
          fontFamily: 'Arial, Helvetica, sans-serif',
          fontSize: '16px',
          color: '#ffffff',
          align: 'center',
          wordWrap: { width: WIDTH - 80 },
        }).setOrigin(0.5, 0),
        result: this.add.text(WIDTH / 2, HEIGHT / 2 - 74, '', {
          fontFamily: 'Arial, Helvetica, sans-serif',
          fontSize: '30px',
          color: '#ffffff',
          align: 'center',
          backgroundColor: '#17324d',
          padding: { x: 28, y: 20 },
        }).setOrigin(0.5),
      };

      cursors = this.input.keyboard.createCursorKeys();
      keys = this.input.keyboard.addKeys('W,A,S,D,R,SPACE');
      keys.SPACE.on('down', startRace);
      keys.R.on('down', restartRace);

      window.__corridaDebug = {
        getState: getDebugState,
        startRace,
        restartRace,
        teleportPlayerToCheckpoint,
        teleportPlayerOffTrackForTest,
        attemptStartLineCrossForTest,
        completePlayerLapForTest,
        forceFinishForTest,
      };

      syncSprites();
      updateHud();
    }

    update(_, delta) {
      if (state.status === 'running') {
        const now = performance.now();
        state.totalTimeMs = now - raceStartMs;
        state.currentLapTimeMs = now - lapStartMs;
      }
      updatePlayer(delta);
      updateOpponents(delta);
      syncSprites();
      updateHud();
    }
  }

  if (!window.Phaser) {
    throw new Error('Phaser local nao foi carregado.');
  }

  new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game-container',
    width: WIDTH,
    height: HEIGHT,
    backgroundColor: '#2f8a45',
    scene: CorridaScene,
    physics: {
      default: 'arcade',
      arcade: { debug: false },
    },
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
  });
}());
