// audio.js — Motor de audio sintetizado via Web Audio API. Sem arquivos externos.
// Copia exata do aero-fighters/src/audio.js (Web Audio API pura, sem Babylon Sound).

export const audio = {
  ctx: null, master: null, muted: false, initialized: false,
  engineOsc: null, engineOsc2: null, engineGain: null,
  engineNoise: null, engineNoiseGain: null,

  init() {
    if (this.initialized) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.55;
    this.master.connect(this.ctx.destination);
    this.initialized = true;
  },

  updateListener(px, py, pz, fx, fy, fz, ux, uy, uz) {
    if (!this.initialized) return;
    const lst = this.ctx.listener;
    if (lst.positionX) {
      lst.positionX.value = px; lst.positionY.value = py; lst.positionZ.value = pz;
      lst.forwardX.value = fx; lst.forwardY.value = fy; lst.forwardZ.value = fz;
      lst.upX.value = ux; lst.upY.value = uy; lst.upZ.value = uz;
    } else if (lst.setPosition) {
      lst.setPosition(px, py, pz);
      lst.setOrientation(fx, fy, fz, ux, uy, uz);
    }
  },

  _makePanner(x, y, z) {
    const p = this.ctx.createPanner();
    p.panningModel = 'HRTF';
    p.distanceModel = 'inverse';
    p.refDistance = 30;
    p.maxDistance = 1500;
    p.rolloffFactor = 1.2;
    if (p.positionX) {
      p.positionX.value = x; p.positionY.value = y; p.positionZ.value = z;
    } else if (p.setPosition) {
      p.setPosition(x, y, z);
    }
    p.connect(this.master);
    return p;
  },

  _noiseBuf(duration) {
    const len = Math.max(1, (this.ctx.sampleRate * duration) | 0);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  },

  startEngine() {
    if (!this.initialized || this.engineOsc) return;
    const ctx = this.ctx;
    const o1 = ctx.createOscillator(); o1.type = 'sawtooth'; o1.frequency.value = 80;
    const o2 = ctx.createOscillator(); o2.type = 'square';   o2.frequency.value = 38;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass'; filter.frequency.value = 700; filter.Q.value = 0.8;
    const eg = ctx.createGain(); eg.gain.value = 0.0;
    o1.connect(filter); o2.connect(filter); filter.connect(eg); eg.connect(this.master);

    const noise = ctx.createBufferSource(); noise.buffer = this._noiseBuf(2); noise.loop = true;
    const nf = ctx.createBiquadFilter(); nf.type = 'bandpass'; nf.frequency.value = 450; nf.Q.value = 1.3;
    const ng = ctx.createGain(); ng.gain.value = 0.0;
    noise.connect(nf); nf.connect(ng); ng.connect(this.master);

    o1.start(); o2.start(); noise.start();
    this.engineOsc = o1; this.engineOsc2 = o2; this.engineGain = eg;
    this.engineNoise = noise; this.engineNoiseGain = ng;
  },

  stopEngine() {
    if (!this.engineGain) return;
    try {
      this.engineGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.1);
      this.engineNoiseGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.1);
    } catch (e) { /* ignore */ }
  },

  setEngineRPM(speed, throttle) {
    if (!this.engineOsc || this.muted) return;
    const norm = Math.max(0, Math.min(1, speed / 80));
    const t = this.ctx.currentTime;
    this.engineOsc.frequency.setTargetAtTime(60 + norm * 140, t, 0.1);
    this.engineOsc2.frequency.setTargetAtTime(32 + norm * 70, t, 0.1);
    this.engineGain.gain.setTargetAtTime(0.05 + throttle * 0.11, t, 0.2);
    this.engineNoiseGain.gain.setTargetAtTime(0.015 + norm * 0.085, t, 0.2);
  },

  cannon() {
    if (!this.initialized || this.muted) return;
    const ctx = this.ctx, now = ctx.currentTime;
    const src = ctx.createBufferSource(); src.buffer = this._noiseBuf(0.05);
    const f = ctx.createBiquadFilter(); f.type = 'bandpass';
    f.frequency.setValueAtTime(2400, now);
    f.frequency.exponentialRampToValueAtTime(900, now + 0.05);
    f.Q.value = 3;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.30, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
    src.connect(f); f.connect(g); g.connect(this.master);
    src.start(now);
  },

  missile() {
    if (!this.initialized || this.muted) return;
    const ctx = this.ctx, now = ctx.currentTime;
    const osc = ctx.createOscillator(); osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(180, now);
    osc.frequency.exponentialRampToValueAtTime(900, now + 0.4);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.18, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
    osc.connect(g); g.connect(this.master);
    osc.start(now); osc.stop(now + 0.5);
  },

  explosion(scale, pos) {
    scale = scale !== undefined ? scale : 1;
    pos = pos !== undefined ? pos : null;
    if (!this.initialized || this.muted) return;
    const ctx = this.ctx, now = ctx.currentTime;
    const sc = Math.min(scale, 2);
    const src = ctx.createBufferSource(); src.buffer = this._noiseBuf(0.7 * sc);
    const f = ctx.createBiquadFilter(); f.type = 'lowpass';
    f.frequency.setValueAtTime(900, now);
    f.frequency.exponentialRampToValueAtTime(120, now + 0.55 * sc);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.32 * sc, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.7 * sc);
    src.connect(f); f.connect(g);
    if (pos) g.connect(this._makePanner(pos.x, pos.y, pos.z));
    else g.connect(this.master);
    src.start(now);
  },

  megaExplosion(pos) {
    pos = pos !== undefined ? pos : null;
    if (!this.initialized || this.muted) return;
    this.explosion(1.6, pos);
    const ctx = this.ctx, now = ctx.currentTime;
    const osc = ctx.createOscillator(); osc.type = 'sine';
    osc.frequency.setValueAtTime(85, now);
    osc.frequency.exponentialRampToValueAtTime(28, now + 1.2);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.55, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 1.2);
    osc.connect(g);
    if (pos) g.connect(this._makePanner(pos.x, pos.y, pos.z));
    else g.connect(this.master);
    osc.start(now); osc.stop(now + 1.25);
  },

  aaFire(pos) {
    pos = pos !== undefined ? pos : null;
    if (!this.initialized || this.muted) return;
    const ctx = this.ctx, now = ctx.currentTime;
    const src = ctx.createBufferSource(); src.buffer = this._noiseBuf(0.18);
    const f = ctx.createBiquadFilter(); f.type = 'bandpass';
    f.frequency.value = 340; f.Q.value = 1.4;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.13, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
    src.connect(f); f.connect(g);
    if (pos) g.connect(this._makePanner(pos.x, pos.y, pos.z));
    else g.connect(this.master);
    src.start(now);
  },

  lockBeep(locked) {
    locked = locked !== undefined ? locked : false;
    if (!this.initialized || this.muted) return;
    const ctx = this.ctx, now = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(locked ? 1400 : 800, now);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.07, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
    osc.connect(g); g.connect(this.master);
    osc.start(now); osc.stop(now + 0.1);
  },

  hit() {
    if (!this.initialized || this.muted) return;
    const ctx = this.ctx, now = ctx.currentTime;
    const src = ctx.createBufferSource(); src.buffer = this._noiseBuf(0.12);
    const f = ctx.createBiquadFilter(); f.type = 'lowpass';
    f.frequency.value = 600;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.22, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
    src.connect(f); f.connect(g); g.connect(this.master);
    src.start(now);
  },

  toggle() {
    if (!this.initialized) this.init();
    this.muted = !this.muted;
    if (this.master) this.master.gain.setTargetAtTime(this.muted ? 0 : 0.55, this.ctx.currentTime, 0.05);
    return this.muted;
  },
};

if (typeof window !== 'undefined') window.audio = audio;
