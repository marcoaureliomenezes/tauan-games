/* Tauan T-Rex — Enhanced Dino Run
 * SPEC: specs/features/tauan-trex/SPEC.md (Approved)
 * All graphics via Phaser.GameObjects.Graphics — never raw canvas ctx.
 */

(function () {
  'use strict';

  // ---------------------------------------------------------------------------
  // Constants
  // ---------------------------------------------------------------------------
  const CANVAS_WIDTH = Math.min(800, window.innerWidth || 800);
  const CANVAS_HEIGHT = 300;

  const GROUND_Y = 250;          // y of the ground line
  const PLAYER_X = 80;           // fixed dino x
  const PLAYER_GROUND_Y = 220;   // top-of-sprite y when standing on ground
  const PLAYER_HEIGHT = 60;      // standing height
  const PLAYER_WIDTH = 44;       // standing width
  const DUCK_HEIGHT = 30;        // ducking height (50% of standing)
  const DUCK_WIDTH = 60;         // ducking width (wider)

  const GRAVITY = 0.6;           // px / frame^2
  const JUMP_VELOCITY = -14;     // px / frame
  const DUCK_BOOST = 4;          // extra downward force per frame while ducking mid-air

  const START_SPEED = 6;
  const MAX_SPEED = 18;
  const SPEED_STEP_SCORE = 300;
  const SPEED_INCREMENT = 0.5;

  const SCORE_FRAMES_PER_POINT = 6;
  const PTERO_UNLOCK_SCORE = 300;
  const NIGHT_TOGGLE_SCORE = 700;
  const MILESTONE_INTERVAL = 100;

  const HISCORE_KEY = 'tauan-hiscore';

  const COLOR_DAY_FG = 0x535353;
  const COLOR_DAY_GREEN = 0x2e8b57;
  const COLOR_DAY_GREEN_DARK = 0x1f5e3a;
  const COLOR_DAY_ORANGE = 0xff8c1a;
  const COLOR_DAY_EYE = 0xffffff;
  const COLOR_NIGHT_FG = 0xf7f7f7;
  const COLOR_NIGHT_GREEN = 0x6ec48a;
  const COLOR_NIGHT_GREEN_DARK = 0x3a8a5a;
  const COLOR_NIGHT_ORANGE = 0xffb347;
  const COLOR_NIGHT_EYE = 0xffffff;
  const COLOR_CACTUS = 0x2e8b57;
  const COLOR_CACTUS_NIGHT = 0x6ec48a;
  const COLOR_PTERO = 0x535353;
  const COLOR_PTERO_NIGHT = 0xf7f7f7;

  // ---------------------------------------------------------------------------
  // window.game contract (read by Playwright)
  // ---------------------------------------------------------------------------
  window.game = {
    running: false,
    score: 0,
    projectiles: [],
    enemies: [],
    kills: 0,
    cycle: 1,
    player: {
      x: PLAYER_X,
      y: PLAYER_GROUND_Y,
      pitch: 0,
      dead: false,
      lives: 1,
      missiles: 0,
    },
  };

  // High score is loaded immediately so the DOM reflects it before the user starts.
  let hiScore = 0;
  try {
    hiScore = parseInt(localStorage.getItem(HISCORE_KEY) || '0', 10) || 0;
  } catch (_) {
    hiScore = 0;
  }

  // ---------------------------------------------------------------------------
  // DOM helpers
  // ---------------------------------------------------------------------------
  const scoreEl = document.getElementById('score');
  const hiScoreEl = document.getElementById('hi-score');
  const overlayEl = document.getElementById('game-over-overlay');

  function pad5(n) {
    const s = String(Math.max(0, Math.floor(n)));
    return ('00000' + s).slice(-5);
  }

  function renderScores() {
    if (scoreEl) scoreEl.textContent = 'SCORE: ' + pad5(window.game.score);
    if (hiScoreEl) hiScoreEl.textContent = 'HI: ' + pad5(hiScore);
  }

  function showGameOverOverlay() {
    if (overlayEl && !overlayEl.classList.contains('visible')) {
      overlayEl.classList.add('visible');
    }
  }

  function hideGameOverOverlay() {
    if (overlayEl && overlayEl.classList.contains('visible')) {
      overlayEl.classList.remove('visible');
    }
  }

  renderScores();

  // ---------------------------------------------------------------------------
  // Audio (Web Audio API only, lazily initialised)
  // ---------------------------------------------------------------------------
  let audioCtx = null;
  let muted = false;

  function ensureAudio() {
    if (audioCtx) return audioCtx;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      audioCtx = new AC();
    } catch (_) {
      audioCtx = null;
    }
    return audioCtx;
  }

  function tone(type, freqStart, freqEnd, durationMs, gainPeak) {
    if (muted) return;
    const ctx = ensureAudio();
    if (!ctx) return;
    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freqStart, now);
      osc.frequency.linearRampToValueAtTime(freqEnd, now + durationMs / 1000);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(gainPeak, now + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + durationMs / 1000);
      osc.connect(gain).connect(ctx.destination);
      osc.start(now);
      osc.stop(now + durationMs / 1000 + 0.02);
    } catch (_) {
      // Swallow audio errors — never break the game loop.
    }
  }

  function playJump() { tone('sine', 220, 440, 150, 0.08); }
  function playDie() { tone('sawtooth', 440, 110, 300, 0.10); }
  function playMilestone() { tone('triangle', 880, 880, 80, 0.06); }

  // ---------------------------------------------------------------------------
  // Phaser scene
  // ---------------------------------------------------------------------------
  class BootScene extends Phaser.Scene {
    constructor() {
      super({ key: 'BootScene' });
    }

    create() {
      this.cameras.main.setBackgroundColor(0xffffff);

      // State
      this.state = 'idle';            // 'idle' | 'running' | 'dead'
      this.frameCount = 0;
      this.scoreFrames = 0;
      this.speed = START_SPEED;
      this.lastMilestone = 0;
      this.isNight = false;
      this.lastNightToggleBucket = 0;

      // Player physics
      this.player = {
        x: PLAYER_X,
        y: PLAYER_GROUND_Y,
        vy: 0,
        ducking: false,
        onGround: true,
        runFrame: 0,
        runFrameTimer: 0,
        dead: false,
      };

      // Obstacles
      this.obstacles = [];
      this.framesUntilNextSpawn = 60;

      // Ground decoration data (pebbles)
      this.pebbles = [];
      const totalPebbles = Math.ceil(CANVAS_WIDTH / 50) + 4;
      for (let i = 0; i < totalPebbles; i++) {
        this.pebbles.push({
          x: i * 50 + Math.random() * 30,
          y: GROUND_Y + 6 + Math.random() * 10,
          r: 1 + Math.random() * 2,
        });
      }
      this.cloudOffsets = [
        { x: CANVAS_WIDTH * 0.2, y: 50, r: 14 },
        { x: CANVAS_WIDTH * 0.55, y: 70, r: 18 },
        { x: CANVAS_WIDTH * 0.85, y: 40, r: 12 },
      ];

      // Graphics layers (order matters for z)
      this.bgGraphics = this.add.graphics();
      this.groundGraphics = this.add.graphics();
      this.obstacleGraphics = this.add.graphics();
      this.playerGraphics = this.add.graphics();
      this.uiGraphics = this.add.graphics();

      // Start screen text (Phaser Text)
      this.startTitle = this.add.text(CANVAS_WIDTH / 2, 70, 'TAUAN', {
        fontFamily: 'Courier New, monospace',
        fontSize: '40px',
        color: '#535353',
        fontStyle: 'bold',
      }).setOrigin(0.5);

      this.startPrompt = this.add.text(CANVAS_WIDTH / 2, 130, 'PRESSIONE ESPACO', {
        fontFamily: 'Courier New, monospace',
        fontSize: '18px',
        color: '#535353',
      }).setOrigin(0.5);

      // Input
      this.cursors = this.input.keyboard.createCursorKeys();
      this.spaceKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
      this.upKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.UP);
      this.downKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.DOWN);
      this.muteKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.M);

      this.input.keyboard.on('keydown-SPACE', () => this.handleAction());
      this.input.keyboard.on('keydown-UP', () => this.handleAction());
      this.input.keyboard.on('keydown-M', () => { muted = !muted; });

      // Touch / pointer
      this.touchHoldTimer = null;
      this.touchActive = false;
      this.input.on('pointerdown', () => {
        this.handleAction();
        this.touchActive = true;
        this.touchHoldStart = performance.now();
      });
      this.input.on('pointerup', () => {
        this.touchActive = false;
        this.player.ducking = false;
      });

      // Initial draw
      this.drawAll();
      renderScores();
    }

    handleAction() {
      // Resume audio context on first user gesture (browser policy).
      const ctx = ensureAudio();
      if (ctx && ctx.state === 'suspended') {
        try { ctx.resume(); } catch (_) { /* noop */ }
      }

      if (this.state === 'idle') {
        this.startGame();
        this.tryJump();
      } else if (this.state === 'running') {
        this.tryJump();
      } else if (this.state === 'dead') {
        this.restart();
      }
    }

    tryJump() {
      if (this.player.onGround && !this.player.dead) {
        this.player.vy = JUMP_VELOCITY;
        this.player.onGround = false;
        playJump();
      }
    }

    startGame() {
      this.state = 'running';
      window.game.running = true;
      window.game.player.dead = false;
      this.player.dead = false;
      hideGameOverOverlay();
      if (this.startTitle) this.startTitle.setVisible(false);
      if (this.startPrompt) this.startPrompt.setVisible(false);
    }

    restart() {
      window.game.score = 0;
      window.game.player.dead = false;
      window.game.player.y = PLAYER_GROUND_Y;
      this.player.dead = false;
      this.player.y = PLAYER_GROUND_Y;
      this.player.vy = 0;
      this.player.onGround = true;
      this.player.ducking = false;
      this.obstacles = [];
      this.frameCount = 0;
      this.scoreFrames = 0;
      this.speed = START_SPEED;
      this.lastMilestone = 0;
      this.framesUntilNextSpawn = 60;
      this.lastNightToggleBucket = 0;
      this.setNight(false);
      this.startGame();
    }

    triggerDeath() {
      if (this.state !== 'running') return;
      this.state = 'dead';
      this.player.dead = true;
      window.game.player.dead = true;
      window.game.running = false;
      // Persist high score
      if (window.game.score > hiScore) {
        hiScore = Math.floor(window.game.score);
        try { localStorage.setItem(HISCORE_KEY, String(hiScore)); } catch (_) { /* noop */ }
        renderScores();
      }
      showGameOverOverlay();
      playDie();
    }

    update(_time, _delta) {
      this.frameCount++;

      // External death injection (Playwright AC-6).
      if (window.game.player.dead && !this.player.dead) {
        this.triggerDeath();
      }

      if (this.state === 'running') {
        this.updateRunning();
      } else if (this.state === 'idle') {
        // Idle bobbing — keep player on ground; redraw for animation.
        this.player.runFrameTimer = (this.player.runFrameTimer + 1) % 20;
        this.player.runFrame = this.player.runFrameTimer < 10 ? 0 : 1;
      }

      // Mirror physics state to the public contract every frame.
      window.game.player.x = PLAYER_X;
      window.game.player.y = this.player.y;

      this.drawAll();
    }

    updateRunning() {
      // Speed scaling
      this.speed = Math.min(
        MAX_SPEED,
        START_SPEED + Math.floor(window.game.score / SPEED_STEP_SCORE) * SPEED_INCREMENT
      );

      // Duck input (held)
      const downHeld = this.cursors.down.isDown || this.downKey.isDown ||
        (this.touchActive && (performance.now() - (this.touchHoldStart || 0) > 200));
      this.player.ducking = downHeld && this.player.onGround;

      // Vertical physics
      this.player.vy += GRAVITY;
      // Mid-air ducking accelerates descent
      if (downHeld && !this.player.onGround) {
        this.player.vy += DUCK_BOOST;
      }
      this.player.y += this.player.vy;
      if (this.player.y >= PLAYER_GROUND_Y) {
        this.player.y = PLAYER_GROUND_Y;
        this.player.vy = 0;
        this.player.onGround = true;
      } else {
        this.player.onGround = false;
      }

      // Run animation
      this.player.runFrameTimer = (this.player.runFrameTimer + 1) % 20;
      this.player.runFrame = this.player.runFrameTimer < 10 ? 0 : 1;

      // Score
      this.scoreFrames++;
      if (this.scoreFrames >= SCORE_FRAMES_PER_POINT) {
        this.scoreFrames = 0;
        window.game.score++;
        // Milestone sound
        if (window.game.score - this.lastMilestone >= MILESTONE_INTERVAL) {
          this.lastMilestone = window.game.score;
          playMilestone();
        }
        // Hi score live update
        if (window.game.score > hiScore) {
          hiScore = window.game.score;
          try { localStorage.setItem(HISCORE_KEY, String(hiScore)); } catch (_) { /* noop */ }
        }
        renderScores();
      }

      // Day/Night cycle
      const cycleBucket = Math.floor(window.game.score / NIGHT_TOGGLE_SCORE);
      if (cycleBucket !== this.lastNightToggleBucket) {
        this.lastNightToggleBucket = cycleBucket;
        this.setNight(cycleBucket % 2 === 1);
      }

      // Pebble scroll
      for (let i = 0; i < this.pebbles.length; i++) {
        this.pebbles[i].x -= this.speed;
        if (this.pebbles[i].x < -10) {
          this.pebbles[i].x += CANVAS_WIDTH + 20;
          this.pebbles[i].y = GROUND_Y + 6 + Math.random() * 10;
          this.pebbles[i].r = 1 + Math.random() * 2;
        }
      }

      // Cloud scroll (slower)
      for (let i = 0; i < this.cloudOffsets.length; i++) {
        this.cloudOffsets[i].x -= this.speed * 0.3;
        if (this.cloudOffsets[i].x < -40) {
          this.cloudOffsets[i].x = CANVAS_WIDTH + 40;
          this.cloudOffsets[i].y = 30 + Math.random() * 60;
        }
      }

      // Obstacle update
      this.framesUntilNextSpawn--;
      if (this.framesUntilNextSpawn <= 0) {
        this.spawnObstacle();
        const minGapPx = 600 + this.speed * 20;
        const minGapFrames = Math.max(40, Math.ceil(minGapPx / Math.max(1, this.speed)));
        // Add a small random jitter so obstacles don't feel metronomic.
        this.framesUntilNextSpawn = minGapFrames + Math.floor(Math.random() * 30);
      }

      for (let i = this.obstacles.length - 1; i >= 0; i--) {
        const ob = this.obstacles[i];
        ob.x -= this.speed;
        if (ob.type === 'ptero') {
          ob.wingTimer = (ob.wingTimer + 1) % 30;
          ob.wingFrame = ob.wingTimer < 15 ? 0 : 1;
        }
        if (ob.x + ob.w < -50) {
          this.obstacles.splice(i, 1);
          continue;
        }
        if (this.collides(ob)) {
          this.triggerDeath();
          break;
        }
      }
    }

    spawnObstacle() {
      const pool = ['cactus_small', 'cactus_medium', 'cactus_cluster'];
      if (window.game.score >= PTERO_UNLOCK_SCORE) {
        pool.push('ptero_low', 'ptero_high');
      }
      const type = pool[Math.floor(Math.random() * pool.length)];

      let ob;
      if (type === 'cactus_small') {
        ob = { type: 'cactus', subtype: 'small', x: CANVAS_WIDTH + 10, y: GROUND_Y - 50, w: 30, h: 50 };
      } else if (type === 'cactus_medium') {
        ob = { type: 'cactus', subtype: 'medium', x: CANVAS_WIDTH + 10, y: GROUND_Y - 70, w: 30, h: 70 };
      } else if (type === 'cactus_cluster') {
        ob = { type: 'cactus', subtype: 'cluster', x: CANVAS_WIDTH + 10, y: GROUND_Y - 50, w: 80, h: 50 };
      } else if (type === 'ptero_low') {
        ob = { type: 'ptero', x: CANVAS_WIDTH + 10, y: 200, w: 50, h: 26, wingTimer: 0, wingFrame: 0 };
      } else {
        ob = { type: 'ptero', x: CANVAS_WIDTH + 10, y: 170, w: 50, h: 26, wingTimer: 0, wingFrame: 0 };
      }
      this.obstacles.push(ob);
    }

    collides(ob) {
      // Player hitbox (forgiving — shrunk by 8 each side).
      const ph = this.player.ducking ? DUCK_HEIGHT : PLAYER_HEIGHT;
      const pw = this.player.ducking ? DUCK_WIDTH : PLAYER_WIDTH;
      const py = this.player.y + (PLAYER_HEIGHT - ph); // duck keeps feet on ground
      const px = this.player.x;

      const pLeft = px + 8;
      const pRight = px + pw - 8;
      const pTop = py + 8;
      const pBottom = py + ph - 8;

      const oLeft = ob.x + 4;
      const oRight = ob.x + ob.w - 4;
      const oTop = ob.y + 4;
      const oBottom = ob.y + ob.h - 4;

      return pLeft < oRight && pRight > oLeft && pTop < oBottom && pBottom > oTop;
    }

    // -------------------------------------------------------------------------
    // Drawing — Phaser Graphics only
    // -------------------------------------------------------------------------
    setNight(night) {
      this.isNight = night;
      if (night) {
        document.body.classList.add('night');
        this.cameras.main.setBackgroundColor(0x1a1a2e);
        if (this.startTitle) this.startTitle.setColor('#f7f7f7');
        if (this.startPrompt) this.startPrompt.setColor('#f7f7f7');
      } else {
        document.body.classList.remove('night');
        this.cameras.main.setBackgroundColor(0xffffff);
        if (this.startTitle) this.startTitle.setColor('#535353');
        if (this.startPrompt) this.startPrompt.setColor('#535353');
      }
    }

    drawAll() {
      this.drawBackground();
      this.drawGround();
      this.drawObstacles();
      this.drawPlayer();
    }

    drawBackground() {
      const g = this.bgGraphics;
      g.clear();
      const cloudColor = this.isNight ? 0xcfcfd6 : 0xd3d3d3;
      g.fillStyle(cloudColor, 1);
      for (let i = 0; i < this.cloudOffsets.length; i++) {
        const c = this.cloudOffsets[i];
        g.fillRect(c.x, c.y, 24, 6);
        g.fillRect(c.x + 6, c.y - 4, 14, 4);
        g.fillRect(c.x + 4, c.y + 6, 16, 4);
      }
    }

    drawGround() {
      const g = this.groundGraphics;
      g.clear();
      const fg = this.isNight ? COLOR_NIGHT_FG : COLOR_DAY_FG;
      g.fillStyle(fg, 1);
      g.fillRect(0, GROUND_Y, CANVAS_WIDTH, 2);
      // Pebbles
      for (let i = 0; i < this.pebbles.length; i++) {
        const p = this.pebbles[i];
        g.fillRect(p.x, p.y, Math.max(2, p.r * 2), 2);
      }
    }

    drawObstacles() {
      const g = this.obstacleGraphics;
      g.clear();
      for (let i = 0; i < this.obstacles.length; i++) {
        const ob = this.obstacles[i];
        if (ob.type === 'cactus') {
          this.drawCactus(g, ob);
        } else if (ob.type === 'ptero') {
          this.drawPtero(g, ob);
        }
      }
    }

    drawCactus(g, ob) {
      const main = this.isNight ? COLOR_CACTUS_NIGHT : COLOR_CACTUS;
      const dark = this.isNight ? 0x4f9870 : 0x1f5e3a;
      g.fillStyle(main, 1);

      if (ob.subtype === 'small') {
        // Single cactus 30x50
        g.fillRect(ob.x + 10, ob.y, 10, 50);
        g.fillRect(ob.x + 4, ob.y + 12, 6, 16);   // left arm
        g.fillRect(ob.x + 20, ob.y + 8, 6, 18);   // right arm
        g.fillStyle(dark, 1);
        g.fillRect(ob.x + 12, ob.y + 4, 2, 42);
      } else if (ob.subtype === 'medium') {
        // 30x70
        g.fillRect(ob.x + 10, ob.y, 10, 70);
        g.fillRect(ob.x + 4, ob.y + 18, 6, 22);
        g.fillRect(ob.x + 20, ob.y + 10, 6, 22);
        g.fillStyle(dark, 1);
        g.fillRect(ob.x + 12, ob.y + 4, 2, 60);
      } else {
        // cluster 80x50: three cacti staggered
        const baseY = ob.y;
        for (let i = 0; i < 3; i++) {
          const cx = ob.x + i * 26;
          g.fillStyle(main, 1);
          g.fillRect(cx + 8, baseY + (i === 1 ? 0 : 6), 8, i === 1 ? 50 : 44);
          g.fillRect(cx + 2, baseY + 18, 6, 14);
          g.fillRect(cx + 16, baseY + 14, 6, 14);
        }
      }
    }

    drawPtero(g, ob) {
      const c = this.isNight ? COLOR_PTERO_NIGHT : COLOR_PTERO;
      g.fillStyle(c, 1);
      // Body
      g.fillRect(ob.x + 12, ob.y + 8, 26, 8);
      // Head
      g.fillRect(ob.x + 32, ob.y + 4, 12, 8);
      // Beak
      g.fillRect(ob.x + 42, ob.y + 6, 8, 4);
      // Tail
      g.fillRect(ob.x + 4, ob.y + 10, 10, 4);
      // Wings — animated frames
      if (ob.wingFrame === 0) {
        // wings up
        g.fillRect(ob.x + 18, ob.y - 2, 16, 6);
        g.fillRect(ob.x + 14, ob.y, 24, 4);
      } else {
        // wings down
        g.fillRect(ob.x + 14, ob.y + 16, 24, 4);
        g.fillRect(ob.x + 18, ob.y + 20, 16, 6);
      }
      // Eye
      g.fillStyle(this.isNight ? 0x000000 : 0xffffff, 1);
      g.fillRect(ob.x + 38, ob.y + 6, 2, 2);
    }

    drawPlayer() {
      const g = this.playerGraphics;
      g.clear();
      const green = this.isNight ? COLOR_NIGHT_GREEN : COLOR_DAY_GREEN;
      const greenDark = this.isNight ? COLOR_NIGHT_GREEN_DARK : COLOR_DAY_GREEN_DARK;
      const orange = this.isNight ? COLOR_NIGHT_ORANGE : COLOR_DAY_ORANGE;
      const eyeColor = this.isNight ? COLOR_NIGHT_EYE : COLOR_DAY_EYE;
      const eyeDark = 0x000000;

      const px = this.player.x;
      const py = this.player.y;
      const ducking = this.player.ducking;
      const dead = this.player.dead;

      if (ducking) {
        // Crouched dino — wider, shorter (60 wide x 30 tall)
        const baseY = py + (PLAYER_HEIGHT - DUCK_HEIGHT);
        // Body
        g.fillStyle(green, 1);
        g.fillRect(px, baseY + 8, 50, 16);          // long body
        g.fillRect(px + 36, baseY, 18, 16);         // head extended forward
        g.fillRect(px + 50, baseY + 8, 6, 6);       // snout
        // Tail
        g.fillRect(px - 6, baseY + 10, 8, 6);
        // Legs
        g.fillRect(px + 8, baseY + 24, 6, 6);
        g.fillRect(px + 22, baseY + 24, 6, 6);
        // Belly highlight
        g.fillStyle(greenDark, 1);
        g.fillRect(px + 4, baseY + 18, 36, 4);
        // Orange chest detail
        g.fillStyle(orange, 1);
        g.fillRect(px + 18, baseY + 12, 10, 4);
        // Eye
        g.fillStyle(eyeColor, 1);
        g.fillRect(px + 44, baseY + 4, 4, 4);
        g.fillStyle(eyeDark, 1);
        if (dead) {
          // X eyes
          g.fillRect(px + 44, baseY + 4, 1, 1);
          g.fillRect(px + 47, baseY + 4, 1, 1);
          g.fillRect(px + 44, baseY + 7, 1, 1);
          g.fillRect(px + 47, baseY + 7, 1, 1);
        } else {
          g.fillRect(px + 45, baseY + 5, 2, 2);
        }
      } else {
        // Standing / running dino — 44 wide x 60 tall
        // Tail
        g.fillStyle(green, 1);
        g.fillRect(px - 6, py + 14, 10, 8);
        // Body
        g.fillRect(px, py + 18, 28, 24);
        // Neck
        g.fillRect(px + 24, py + 8, 10, 16);
        // Head
        g.fillRect(px + 28, py, 16, 18);
        // Snout
        g.fillRect(px + 40, py + 8, 6, 6);
        // Mouth (open if dead)
        if (dead) {
          g.fillStyle(0x000000, 1);
          g.fillRect(px + 36, py + 12, 8, 3);
          g.fillStyle(green, 1);
        }
        // Belly highlight
        g.fillStyle(greenDark, 1);
        g.fillRect(px + 2, py + 36, 22, 4);
        // Arm
        g.fillStyle(green, 1);
        g.fillRect(px + 22, py + 26, 4, 6);
        // Legs (animated)
        if (this.player.onGround && this.state === 'running' && !dead) {
          if (this.player.runFrame === 0) {
            g.fillRect(px + 6, py + 42, 6, 14);
            g.fillRect(px + 18, py + 42, 6, 10);
            g.fillRect(px + 6, py + 56, 8, 4);
            g.fillRect(px + 16, py + 52, 6, 4);
          } else {
            g.fillRect(px + 6, py + 42, 6, 10);
            g.fillRect(px + 18, py + 42, 6, 14);
            g.fillRect(px + 4, py + 52, 6, 4);
            g.fillRect(px + 18, py + 56, 8, 4);
          }
        } else {
          // Both legs grounded (idle / airborne)
          g.fillRect(px + 6, py + 42, 6, 14);
          g.fillRect(px + 18, py + 42, 6, 14);
          g.fillRect(px + 4, py + 56, 10, 4);
          g.fillRect(px + 16, py + 56, 10, 4);
        }
        // Orange chest detail
        g.fillStyle(orange, 1);
        g.fillRect(px + 4, py + 22, 10, 6);
        // Orange eyebrow detail
        g.fillRect(px + 30, py + 2, 8, 2);
        // Eye
        g.fillStyle(eyeColor, 1);
        g.fillRect(px + 34, py + 5, 6, 6);
        g.fillStyle(eyeDark, 1);
        if (dead) {
          // X eye
          g.fillRect(px + 34, py + 5, 2, 2);
          g.fillRect(px + 38, py + 5, 2, 2);
          g.fillRect(px + 34, py + 9, 2, 2);
          g.fillRect(px + 38, py + 9, 2, 2);
        } else {
          g.fillRect(px + 36, py + 7, 3, 3);
        }
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Boot Phaser
  // ---------------------------------------------------------------------------
  const config = {
    type: Phaser.AUTO,
    width: CANVAS_WIDTH,
    height: CANVAS_HEIGHT,
    parent: 'game-container',
    backgroundColor: '#ffffff',
    fps: { target: 60, forceSetTimeOut: false },
    scene: [BootScene],
    banner: false,
  };

  // Phaser writes its own instance to the global scope under `Phaser.Game`.
  // We assign it to a private name so `window.game` stays reserved for the
  // Playwright contract defined above.
  const phaserGame = new Phaser.Game(config);
  window.__phaser = phaserGame;

  // Tag the canvas with the contract id once Phaser has created it.
  function tagCanvas() {
    const container = document.getElementById('game-container');
    if (!container) return false;
    const canvas = container.querySelector('canvas');
    if (!canvas) return false;
    canvas.id = 'game-canvas';
    canvas.setAttribute('tabindex', '0');
    return true;
  }

  if (!tagCanvas()) {
    // Retry briefly until the canvas exists.
    let tries = 0;
    const retry = setInterval(() => {
      tries++;
      if (tagCanvas() || tries > 30) clearInterval(retry);
    }, 16);
  }
})();
