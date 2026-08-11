// audio.js — Fully synthesized WebAudio (no audio files): hoof rhythm per gait,
// gunshot, reload click, arrow whoosh, campfire crackle, eagle cry, train
// chug+whistle, ambient wind. Context starts on the first user gesture and
// retries on later gestures if suspended (headless-safe: never throws).
// Exports: initAudio, updateAudio, playGunshot, playReload, playWhoosh, toggleMute.

import { AUDIO } from './config.js';
import { game } from './state.js';

let ctx = null;
let master = null;
let windGain = null;
let noiseBuf = null;
let hoofT = 0, chugT = 0, whistleT = 0, crackleT = 0, eagleT = 20, chugOn = false;

/** Creates the context + master chain. Idempotent; resumes on later calls. */
export function initAudio() {
  try {
    if (!ctx) {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      master = ctx.createGain();
      master.gain.value = game.audio.muted ? 0 : AUDIO.MASTER;
      master.connect(ctx.destination);
      noiseBuf = makeNoiseBuffer();
      startWind();
    }
    if (ctx.state === 'suspended') ctx.resume().catch(() => { /* retry next gesture */ });
    // CONTRACT: writer of game.audio.state
    game.audio.state = ctx.state;
  } catch (e) { /* no WebAudio — silent game */ }
}

function makeNoiseBuffer() {
  const buf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const d = buf.getChannelData(0);
  let last = 0;
  for (let i = 0; i < d.length; i++) {
    const white = Math.random() * 2 - 1;
    last = (last + 0.02 * white) / 1.02; // pink-ish
    d[i] = last * 3.5;
  }
  return buf;
}

function noiseSource() {
  const src = ctx.createBufferSource();
  src.buffer = noiseBuf;
  src.loop = true;
  return src;
}

/** Filtered noise burst. */
function burst(dur, freq, q, vol, type = 'bandpass') {
  if (!ctx || game.audio.muted) return;
  const t = ctx.currentTime;
  const src = noiseSource();
  const f = ctx.createBiquadFilter();
  f.type = type;
  f.frequency.value = freq;
  f.Q.value = q;
  const g = ctx.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  src.connect(f).connect(g).connect(master);
  src.start(t);
  src.stop(t + dur + 0.05);
}

/** Sine glide (eagle cry, whistle). */
function glide(f0, f1, dur, vol, type = 'sine') {
  if (!ctx || game.audio.muted) return;
  const t = ctx.currentTime;
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(f0, t);
  o.frequency.exponentialRampToValueAtTime(f1, t + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.05);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g).connect(master);
  o.start(t);
  o.stop(t + dur + 0.05);
}

function startWind() {
  const src = noiseSource();
  const f = ctx.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.value = 400;
  windGain = ctx.createGain();
  windGain.gain.value = AUDIO.WIND_VOL;
  src.connect(f).connect(windGain).connect(master);
  src.start();
}

// ─── Public one-shots ────────────────────────────────────────────────────────

export function playGunshot() {
  burst(0.18, 900, 0.7, AUDIO.GUN_VOL, 'lowpass');
  burst(0.05, 3200, 1.2, AUDIO.GUN_VOL * 0.7, 'highpass');
}

export function playReload() {
  burst(0.05, 1800, 3, AUDIO.GUN_VOL * 0.3);
  setTimeout(() => burst(0.05, 1300, 3, AUDIO.GUN_VOL * 0.3), 180);
}

export function playWhoosh() {
  burst(0.25, 2400, 2, 0.18, 'bandpass');
}

export function toggleMute() {
  // CONTRACT: writer of game.audio.muted
  game.audio.muted = !game.audio.muted;
  if (master) master.gain.value = game.audio.muted ? 0 : AUDIO.MASTER;
  return game.audio.muted;
}

// ─── Continuous / scheduled layers ───────────────────────────────────────────

function gaitInterval(gait) {
  if (gait === 'gallop') return AUDIO.HOOF_GALLOP;
  if (gait === 'trot') return AUDIO.HOOF_TROT;
  if (gait === 'walk') return AUDIO.HOOF_WALK;
  return 0;
}

/** Per-frame audio update: hooves, wind, camp fire, train, eagle. @param {number} dt */
export function updateAudio(dt) {
  if (!ctx) return;
  // CONTRACT: writer of game.audio.state
  game.audio.state = ctx.state;
  if (game.audio.muted || ctx.state !== 'running') return;
  const p = game.player;

  // Hooves: rhythm follows gait
  const interval = gaitInterval(p.gait);
  if (interval > 0) {
    hoofT -= dt;
    if (hoofT <= 0) {
      hoofT = interval;
      burst(0.07, 300 + Math.random() * 150, 1, AUDIO.HOOF_VOL, 'lowpass');
    }
  }

  // Wind louder with altitude and speed (gallop rush)
  if (windGain) {
    const alt = Math.max(0, p.position.y) / 200;
    const spd = Math.min(1, p.speed / 14);
    windGain.gain.value = AUDIO.WIND_VOL * (1 + alt) * (1 + spd * 1.6);
  }

  // Campfire crackle near camp
  const camp = game.entities.camp;
  if (camp) {
    const d = Math.hypot(camp.position.x - p.position.x, camp.position.z - p.position.z);
    if (d < AUDIO.CAMPFIRE_R) {
      crackleT -= dt;
      if (crackleT <= 0) {
        crackleT = 0.05 + Math.random() * 0.22;
        burst(0.03, 1500 + Math.random() * 2000, 2, 0.10 * (1 - d / AUDIO.CAMPFIRE_R), 'highpass');
      }
    }
  }

  // Train chug + whistle
  const train = game.entities.train;
  if (train) {
    const d = Math.hypot(train.position.x - p.position.x, train.position.z - p.position.z);
    if (d < AUDIO.TRAIN_R) {
      chugT -= dt;
      if (chugT <= 0) {
        chugT = 0.32;
        burst(0.12, 200, 1, 0.22 * (1 - d / AUDIO.TRAIN_R), 'lowpass');
      }
      whistleT -= dt;
      if (whistleT <= 0) {
        whistleT = AUDIO.WHISTLE_EVERY;
        glide(620, 880, 0.9, 0.14 * (1 - d / AUDIO.TRAIN_R), 'triangle');
        setTimeout(() => glide(880, 660, 0.7, 0.10, 'triangle'), 500);
      }
    }
  }

  // Occasional eagle cry
  eagleT -= dt;
  if (eagleT <= 0) {
    eagleT = AUDIO.EAGLE_CRY_MIN + Math.random() * AUDIO.EAGLE_CRY_SPAN;
    glide(2200, 900, 1.1, 0.07);
  }
}
