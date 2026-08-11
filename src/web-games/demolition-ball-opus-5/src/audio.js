// Synthesised audio — no asset files. Diesel engine drone whose pitch tracks
// the tracks, plus impact thuds, rubble crashes and collapse rumble.

export class Audio {
  constructor() {
    this.ctx = null;
    this.ready = false;
    this.muted = false;
  }

  start() {
    if (this.ready) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    const ctx = this.ctx;

    this.master = ctx.createGain();
    this.master.gain.value = 0.55;
    this.master.connect(ctx.destination);

    // Diesel: two detuned saws through a low-pass.
    this.engineGain = ctx.createGain();
    this.engineGain.gain.value = 0.0;
    this.engineFilter = ctx.createBiquadFilter();
    this.engineFilter.type = 'lowpass';
    this.engineFilter.frequency.value = 420;
    this.engineGain.connect(this.engineFilter);
    this.engineFilter.connect(this.master);

    this.osc = [];
    for (const detune of [0, 7]) {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = 48;
      o.detune.value = detune;
      o.connect(this.engineGain);
      o.start();
      this.osc.push(o);
    }

    // Reusable noise buffer for impacts.
    const len = ctx.sampleRate * 2;
    this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;

    this.ready = true;
  }

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  }

  setEngine(speed, throttle) {
    if (!this.ready || this.muted) return;
    const t = this.ctx.currentTime;
    const rpm = 42 + Math.abs(speed) * 5.2 + Math.abs(throttle) * 12;
    for (const o of this.osc) o.frequency.setTargetAtTime(rpm, t, 0.12);
    this.engineFilter.frequency.setTargetAtTime(320 + Math.abs(speed) * 26, t, 0.2);
    this.engineGain.gain.setTargetAtTime(0.055 + Math.abs(throttle) * 0.05, t, 0.15);
  }

  burst({ gain = 0.5, duration = 0.5, freq = 900, type = 'lowpass', q = 1 }) {
    if (!this.ready || this.muted) return;
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    const filt = ctx.createBiquadFilter();
    filt.type = type;
    filt.frequency.value = freq;
    filt.Q.value = q;
    const g = ctx.createGain();
    const t = ctx.currentTime;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    src.connect(filt); filt.connect(g); g.connect(this.master);
    src.start(t);
    src.stop(t + duration + 0.05);
  }

  thump(strength) {
    if (!this.ready || this.muted) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(120 * (0.7 + strength * 0.5), t);
    o.frequency.exponentialRampToValueAtTime(38, t + 0.35);
    const g = ctx.createGain();
    g.gain.setValueAtTime(Math.min(0.9, 0.28 + strength * 0.5), t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.55);
    o.connect(g); g.connect(this.master);
    o.start(t); o.stop(t + 0.6);
  }

  impact(energy, killed) {
    const s = Math.min(1, energy / 400000);
    this.thump(s);
    this.burst({ gain: 0.18 + s * 0.35, duration: 0.35 + s * 0.5, freq: 1400 + killed * 40, type: 'bandpass', q: 0.7 });
  }

  collapse(cells) {
    const s = Math.min(1, cells / 180);
    this.burst({ gain: 0.25 + s * 0.4, duration: 1.4 + s * 1.6, freq: 480, type: 'lowpass' });
    this.thump(0.6 + s * 0.4);
  }

  chime(up = true) {
    if (!this.ready || this.muted) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    [0, 0.12, 0.24].forEach((off, i) => {
      const o = ctx.createOscillator();
      o.type = 'triangle';
      const base = up ? [523, 659, 784] : [392, 349, 262];
      o.frequency.value = base[i];
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t + off);
      g.gain.exponentialRampToValueAtTime(0.22, t + off + 0.03);
      g.gain.exponentialRampToValueAtTime(0.0001, t + off + 0.45);
      o.connect(g); g.connect(this.master);
      o.start(t + off); o.stop(t + off + 0.5);
    });
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.master) this.master.gain.value = this.muted ? 0 : 0.55;
    return this.muted;
  }
}
