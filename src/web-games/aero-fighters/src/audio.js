// audio.js — Motor de áudio sintetizado via Web Audio API. Sem arquivos externos.
// Exporta: `audio` (objeto com init, startEngine, cannon, missile, explosion, megaExplosion, aaFire, hit, toggle).
// Para adicionar um novo som: adicione um método público aqui e chame de onde necessário.

/** Motor de áudio. Lazy-init no primeiro gesto do usuário (autoplay policy). */
export const audio = {
  ctx: null, master: null, muted: false, initialized: false,
  // Turbina do motor (T-08): núcleo de ruído filtrado (spool/rumble) + whine agudo
  // de osciladores destonados. Ver startEngine/setEngineRPM.
  engineCoreNoise: null, engineCoreFilter: null, engineCoreLowpass: null, engineCoreGain: null,
  engineWhineOscs: null, engineWhineDetunes: null, engineWhineFilter: null, engineWhineGain: null,

  /** Inicializa AudioContext. Chamar após interação do usuário. */
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

  /** Atualiza posição/orientação do listener (player). Chame a cada frame. */
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

  /** Cria um node de panner 3D na posição dada e retorna-o conectado ao master. */
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

  /** Liga o som contínuo do motor do jato — síntese de turbina (T-08, D-7).
   * Grafo fixo criado uma única vez (sem alocação por frame):
   *  - Núcleo (spool/rumble): ruído filtrado por um bandpass cuja frequência
   *    central varre com o RPM, seguido de um lowpass que dá brilho crescente.
   *    Substitui os osciladores serrote+quadrada anteriores (que soavam a
   *    hélice) — o núcleo é 100% ruído, sem tom periódico de baixa frequência.
   *  - Whine agudo: 2-3 osciladores levemente destonados (shepard-ish) somados
   *    através de um bandpass ressonante; sobem de tom e ganho com o RPM,
   *    dando o assobio agudo característico de uma turbina em alta potência.
   * Nunca aplica modulação de amplitude em baixa frequência (isso soaria a
   * hélice) — só ramps contínuos de frequência/ganho em setEngineRPM. */
  startEngine() {
    if (!this.initialized || this.engineCoreNoise) return;
    const ctx = this.ctx;

    // ── Núcleo: ruído filtrado (spool/rumble da turbina) ──
    const noise = ctx.createBufferSource(); noise.buffer = this._noiseBuf(3); noise.loop = true;
    const coreFilter = ctx.createBiquadFilter();
    coreFilter.type = 'bandpass'; coreFilter.frequency.value = 70; coreFilter.Q.value = 1.1;
    const coreLowpass = ctx.createBiquadFilter();
    coreLowpass.type = 'lowpass'; coreLowpass.frequency.value = 500; coreLowpass.Q.value = 0.5;
    const coreGain = ctx.createGain(); coreGain.gain.value = 0.0;
    noise.connect(coreFilter); coreFilter.connect(coreLowpass); coreLowpass.connect(coreGain);
    coreGain.connect(this.master);

    // ── Whine agudo: osciladores destonados que sobem com o RPM ──
    const whineFilter = ctx.createBiquadFilter();
    whineFilter.type = 'bandpass'; whineFilter.frequency.value = 900; whineFilter.Q.value = 3.5;
    const whineGain = ctx.createGain(); whineGain.gain.value = 0.0;
    whineFilter.connect(whineGain); whineGain.connect(this.master);

    const detunes = [1.0, 1.012, 0.985];
    const whineOscs = detunes.map(ratio => {
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = 900 * ratio;
      o.connect(whineFilter);
      o.start();
      return o;
    });

    noise.start();

    this.engineCoreNoise = noise;
    this.engineCoreFilter = coreFilter;
    this.engineCoreLowpass = coreLowpass;
    this.engineCoreGain = coreGain;
    this.engineWhineOscs = whineOscs;
    this.engineWhineDetunes = detunes;
    this.engineWhineFilter = whineFilter;
    this.engineWhineGain = whineGain;
  },

  /** Silencia o motor (sem destruir osciladores/ruído — apenas os ganhos vão a 0). */
  stopEngine() {
    if (!this.engineCoreGain) return;
    try {
      const t = this.ctx.currentTime;
      this.engineCoreGain.gain.setTargetAtTime(0, t, 0.1);
      this.engineWhineGain.gain.setTargetAtTime(0, t, 0.1);
    } catch (e) { /* ignore */ }
  },

  /** Atualiza pitch/volume da turbina conforme velocidade e throttle.
   * @param {number} speed velocidade atual
   * @param {number} throttle 0..1 */
  setEngineRPM(speed, throttle) {
    if (!this.engineCoreNoise || this.muted) return;
    const t = this.ctx.currentTime;
    const normSpeed = Math.max(0, Math.min(1, speed / 80));
    const th = Math.max(0, Math.min(1, throttle));
    // RPM sintético: dominado pelo throttle (comando do piloto), com uma
    // contribuição menor da velocidade para a sensação de "spool" acompanhando
    // o ar — nunca um chop de amplitude em baixa frequência (isso é hélice).
    const rpm = Math.max(0, Math.min(1, th * 0.65 + normSpeed * 0.35));

    // Núcleo: a banda do ruído varre com o RPM (spool/rumble da turbina).
    this.engineCoreFilter.frequency.setTargetAtTime(70 + rpm * 340, t, 0.12);
    this.engineCoreLowpass.frequency.setTargetAtTime(500 + rpm * 1700, t, 0.12);
    this.engineCoreGain.gain.setTargetAtTime(0.05 + th * 0.15 + normSpeed * 0.02, t, 0.18);

    // Whine agudo: sobe de forma não-linear — mais estridente perto do máximo.
    const whineBase = 900 + Math.pow(rpm, 1.4) * 2600;
    for (let i = 0; i < this.engineWhineOscs.length; i++) {
      this.engineWhineOscs[i].frequency.setTargetAtTime(whineBase * this.engineWhineDetunes[i], t, 0.15);
    }
    this.engineWhineFilter.frequency.setTargetAtTime(whineBase, t, 0.15);
    this.engineWhineGain.gain.setTargetAtTime(0.01 + Math.pow(th, 2) * 0.06, t, 0.2);
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

  /** @param {number} scale 0.3 (mini) — 1.6 (grande) @param {Object?} pos opcional {x,y,z} para espacializar */
  explosion(scale = 1, pos = null) {
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

  /** @param {Object?} pos posição 3D opcional */
  megaExplosion(pos = null) {
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

  /** @param {Object?} pos posição 3D opcional (da AA gun no mapa) */
  aaFire(pos = null) {
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

  /** Beep do sistema de lock-on. @param {boolean} locked tom mais agudo quando travado */
  lockBeep(locked = false) {
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

  /** Alarme de mayday sintetizado — padrão hi/lo sawtooth por 8 segundos. */
  mayday() {
    if (!this.initialized || this.muted) return;
    const ctx = this.ctx, now = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, now);
    const filt = ctx.createBiquadFilter();
    filt.type = 'bandpass'; filt.frequency.value = 750; filt.Q.value = 1.5;
    let t = 0;
    for (let i = 0; i < 22; i++) {
      const freq = (i % 2 === 0) ? 880 : 620;
      osc.frequency.setValueAtTime(freq, now + t);
      g.gain.linearRampToValueAtTime(0.20, now + t + 0.04);
      g.gain.setValueAtTime(0.20, now + t + 0.14);
      g.gain.linearRampToValueAtTime(0, now + t + 0.22);
      t += 0.33;
    }
    osc.connect(filt); filt.connect(g); g.connect(this.master);
    osc.start(now); osc.stop(now + 8.5);
  },

  /** Som de bala inimiga passando próxima — whoosh descendente. */
  closeMiss() {
    if (!this.initialized || this.muted) return;
    const ctx = this.ctx, now = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(340, now);
    osc.frequency.exponentialRampToValueAtTime(110, now + 0.13);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.13, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.13);
    osc.connect(g); g.connect(this.master);
    osc.start(now); osc.stop(now + 0.14);
  },

  /** Crackle rápido de rádio estático em tempo agendado. */
  _radioStatic(at) {
    if (!this.initialized) return;
    const ctx = this.ctx;
    const src = ctx.createBufferSource(); src.buffer = this._noiseBuf(0.07);
    const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 2200;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, at);
    g.gain.linearRampToValueAtTime(0.14, at + 0.01);
    g.gain.exponentialRampToValueAtTime(0.001, at + 0.07);
    src.connect(f); f.connect(g); g.connect(this.master);
    src.start(at);
  },

  /** Chatter de rádio sintetizado — ruído AM modulado, simula voz de piloto. */
  radioChatter() {
    if (!this.initialized || this.muted) return;
    const ctx = this.ctx, now = ctx.currentTime;
    const dur = 0.8 + Math.random() * 1.2;

    // Noise source (telephone vocal range)
    const noise = ctx.createBufferSource(); noise.buffer = this._noiseBuf(dur + 0.2);
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1800; bp.Q.value = 0.7;

    // AM modulation (simulates speech rhythm at 4-9 Hz)
    const lfo = ctx.createOscillator(); lfo.type = 'sine'; lfo.frequency.value = 4 + Math.random() * 5;
    const lfoGain = ctx.createGain(); lfoGain.gain.value = 0.5;
    const carrier = ctx.createGain(); carrier.gain.value = 0.5;
    lfo.connect(lfoGain); lfoGain.connect(carrier.gain);

    const g = ctx.createGain();
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(0.20, now + 0.04);
    g.gain.setValueAtTime(0.20, now + dur);
    g.gain.linearRampToValueAtTime(0, now + dur + 0.05);

    noise.connect(bp); bp.connect(carrier); carrier.connect(g); g.connect(this.master);
    noise.start(now); noise.stop(now + dur + 0.1);
    lfo.start(now); lfo.stop(now + dur + 0.1);

    this._radioStatic(now - 0.02 < 0 ? now : now - 0.01);
    this._radioStatic(now + dur + 0.02);
  },

  /** Inicia ruído de vento contínuo se necessário. */
  _startWind() {
    if (this._windNode) return;
    const ctx = this.ctx;
    const noise = ctx.createBufferSource(); noise.buffer = this._noiseBuf(4); noise.loop = true;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 400;
    const g = ctx.createGain(); g.gain.value = 0;
    noise.connect(lp); lp.connect(g); g.connect(this.master);
    noise.start();
    this._windNode = noise; this._windGain = g;
  },

  /** Ajusta volume do vento pela altitude. Chamar a cada frame. */
  setWindLevel(altitude) {
    if (!this.initialized || this.muted) return;
    this._startWind();
    const vol = Math.max(0, Math.min(0.08, (altitude - 40) / 200));
    this._windGain.gain.setTargetAtTime(vol, this.ctx.currentTime, 0.5);
  },

  /** Boom distante ambiental — explosão ao longe, quase inaudível. */
  distantExplosion() {
    if (!this.initialized || this.muted) return;
    const ctx = this.ctx, now = ctx.currentTime;
    // Low sine thud
    const osc = ctx.createOscillator(); osc.type = 'sine';
    osc.frequency.setValueAtTime(45, now);
    osc.frequency.exponentialRampToValueAtTime(22, now + 1.8);
    const og = ctx.createGain();
    og.gain.setValueAtTime(0.06, now);
    og.gain.exponentialRampToValueAtTime(0.001, now + 2.0);
    osc.connect(og); og.connect(this.master);
    osc.start(now); osc.stop(now + 2.1);
    // Rumble noise
    const src = ctx.createBufferSource(); src.buffer = this._noiseBuf(1.5);
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 150; bp.Q.value = 1.2;
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(0.04, now);
    ng.gain.exponentialRampToValueAtTime(0.001, now + 1.5);
    src.connect(bp); bp.connect(ng); ng.connect(this.master);
    src.start(now);
  },

  /** @returns {boolean} novo estado de muted */
  toggle() {
    if (!this.initialized) this.init();
    this.muted = !this.muted;
    if (this.master) this.master.gain.setTargetAtTime(this.muted ? 0 : 0.55, this.ctx.currentTime, 0.05);
    return this.muted;
  },
};

if (typeof window !== 'undefined') window.audio = audio;
