// music.js — trilha 100% procedural (Web Audio, zero assets) no espírito da
// trilha de Top Gear (SNES, Barry Leitch): rock de pista ~144 BPM, baixo
// pulsante em colcheias, lead de serralheira (saw) brilhante com glissando e
// vibrato, batera roqueira (kick 4/4, caixa no 2 e 4, chimbal em colcheias).
// Melodia ORIGINAL (progressão Am F C G / Am F Dm E) — 8 compassos em loop.
//
// Uso: music.init() no 1º gesto do usuário (autoplay policy); depois
// music.setIntensity('menu'|'race') e music.toggleMute() (tecla M).

const BPM = 144;
const STEP = 60 / BPM / 4;              // semicolcheia (~0,104 s)
const BARS = 8, STEPS = BARS * 16;      // loop de 8 compassos

const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

// ── composição ──────────────────────────────────────────────────────────────
// baixo: tônica de cada compasso (o padrão colcheia + oitava está no scheduler)
const BASS_ROOT = [45, 41, 36, 43, 45, 41, 38, 40];   // A F C G | A F D E

// lead: [passo, midi, duração em passos, glide?] — glide entra 1 semitom abaixo
const LEAD = [
  // Am — chamada ascendente
  [0, 76, 2], [2, 79, 2], [4, 81, 4, 1], [8, 79, 2], [10, 76, 2], [12, 74, 4],
  // F — resposta no agudo
  [16, 77, 2], [18, 81, 2], [20, 84, 4, 1], [24, 81, 4], [28, 79, 4],
  // C — frase média, respiro
  [32, 76, 4], [36, 79, 2], [38, 76, 2], [40, 72, 4, 1], [44, 74, 4],
  // G — gancho do refrão
  [48, 74, 2], [50, 79, 2], [52, 83, 4, 1], [56, 81, 2], [58, 79, 2], [60, 74, 4],
  // Am — repete a chamada, uma oitava de energia
  [64, 76, 2], [66, 79, 2], [68, 81, 4, 1], [72, 83, 2], [74, 84, 2], [76, 81, 4],
  // F — variação com salto
  [80, 84, 2], [82, 81, 2], [84, 77, 4, 1], [88, 81, 4], [92, 79, 4],
  // Dm — tensão descendente
  [96, 77, 2], [98, 74, 2], [100, 72, 4], [104, 74, 2], [106, 77, 2], [108, 81, 4, 1],
  // E — dominante: fecha a frase e puxa o loop de volta p/ Am
  [112, 80, 2], [114, 76, 2], [116, 71, 4, 1], [120, 68, 6], [126, 71, 2],
];
const leadAt = new Map(LEAD.map((n) => [n[0], n]));

// ── engine ──────────────────────────────────────────────────────────────────
export const music = {
  ctx: null, master: null, ch: {},
  muted: false, intensity: 'menu', scheduled: 0,
  init, setIntensity, toggleMute,
};

const LEVELS = {                                   // intensidade por contexto
  race: { kick: 0.9, snare: 0.75, hat: 0.5, bass: 0.8, lead: 0.75 },
  menu: { kick: 0.55, snare: 0.0, hat: 0.28, bass: 0.55, lead: 0.0 },
};

let step = 0, nextT = 0, noiseBuf = null, timer = null;

function init() {
  if (!music.ctx) {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    music.ctx = ctx;
    music.master = ctx.createGain();
    music.master.gain.value = 0.85;
    music.master.connect(ctx.destination);
    for (const name of ['kick', 'snare', 'hat', 'bass', 'lead']) {
      const g = ctx.createGain();
      g.connect(music.master);
      music.ch[name] = g;
    }
    setIntensity(music.intensity);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    nextT = ctx.currentTime + 0.06;
    timer = setInterval(tick, 30);                 // scheduler lookahead
  }
  music.ctx.resume();                              // gesto do usuário libera o áudio
}

function setIntensity(mode) {
  music.intensity = mode;
  if (!music.ctx) return;
  const t = music.ctx.currentTime;
  for (const [name, v] of Object.entries(LEVELS[mode])) {
    music.ch[name].gain.setTargetAtTime(v, t, 0.15);
  }
}

function toggleMute() {
  music.muted = !music.muted;
  if (music.ctx) {
    music.master.gain.setTargetAtTime(music.muted ? 0 : 0.85, music.ctx.currentTime, 0.02);
  }
  return music.muted;
}

// lookahead scheduling: agenda os passos que caem nos próximos 0,12 s
function tick() {
  const ctx = music.ctx;
  if (ctx.state !== 'running') return;
  while (nextT < ctx.currentTime + 0.12) {
    scheduleStep(step % STEPS, nextT);
    step++;
    nextT += STEP;
  }
}

function scheduleStep(s, t) {
  const bar = (s / 16) | 0, sub = s % 16;
  if (sub % 4 === 0) kick(t);                                // 4/4 no chão
  if (sub === 4 || sub === 12) snare(t, 1);                  // caixa no 2 e 4
  if (bar === 7 && sub >= 12) snare(t, 0.45);                // virada no fim do loop
  if (sub % 2 === 0) hat(t, sub % 4 === 2 ? 0.5 : 0.3);      // colcheias, contra-tempo
  if (sub % 2 === 0) {                                       // baixo pulsante
    const oct = (sub === 6 || sub === 14) ? 12 : 0;          // salto de oitava
    bass(t, BASS_ROOT[bar] + oct, sub % 4 === 0 ? 1 : 0.75);
  }
  const n = leadAt.get(s);
  if (n) lead(t, n[1], n[2] * STEP * 0.92, n[3]);
}

// ── instrumentos ────────────────────────────────────────────────────────────
function kick(t) {
  const ctx = music.ctx, o = ctx.createOscillator(), g = ctx.createGain();
  o.type = 'sine';
  o.frequency.setValueAtTime(150, t);
  o.frequency.exponentialRampToValueAtTime(48, t + 0.11);
  g.gain.setValueAtTime(1, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
  o.connect(g).connect(music.ch.kick);
  o.start(t); o.stop(t + 0.18);
  music.scheduled++;
}

function snare(t, vel) {
  const ctx = music.ctx;
  const nz = ctx.createBufferSource(); nz.buffer = noiseBuf;
  const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1800;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.9 * vel, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
  nz.connect(bp).connect(g).connect(music.ch.snare);
  nz.start(t, Math.random() * 0.5); nz.stop(t + 0.14);
  const o = ctx.createOscillator(), g2 = ctx.createGain();   // corpo da caixa
  o.type = 'triangle'; o.frequency.value = 190;
  g2.gain.setValueAtTime(0.5 * vel, t);
  g2.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
  o.connect(g2).connect(music.ch.snare);
  o.start(t); o.stop(t + 0.1);
  music.scheduled++;
}

function hat(t, vel) {
  const ctx = music.ctx;
  const nz = ctx.createBufferSource(); nz.buffer = noiseBuf;
  const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 7500;
  const g = ctx.createGain();
  g.gain.setValueAtTime(vel, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.04);
  nz.connect(hp).connect(g).connect(music.ch.hat);
  nz.start(t, Math.random() * 0.5); nz.stop(t + 0.06);
  music.scheduled++;
}

function bass(t, midi, vel) {
  const ctx = music.ctx, o = ctx.createOscillator(), g = ctx.createGain();
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 520;
  o.type = 'square';
  o.frequency.value = mtof(midi);
  g.gain.setValueAtTime(0.5 * vel, t);
  g.gain.setTargetAtTime(0, t + STEP * 1.6, 0.03);           // staccato dirigido
  o.connect(lp).connect(g).connect(music.ch.bass);
  o.start(t); o.stop(t + STEP * 2);
  music.scheduled++;
}

function lead(t, midi, dur, glide) {
  const ctx = music.ctx, g = ctx.createGain();
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2800;
  // vibrato (o "flare" do Barry Leitch) + 2 saws desafinadas = lead brilhante
  const lfo = ctx.createOscillator(), lfoG = ctx.createGain();
  lfo.frequency.value = 5.5; lfoG.gain.value = 7;
  lfo.connect(lfoG);
  lfo.start(t); lfo.stop(t + dur);
  for (const det of [-7, 7]) {
    const o = ctx.createOscillator();
    o.type = 'sawtooth';
    o.detune.value = det;
    if (glide) {                                             // entra 1 semitom abaixo
      o.frequency.setValueAtTime(mtof(midi - 1), t);
      o.frequency.exponentialRampToValueAtTime(mtof(midi), t + 0.09);
    } else {
      o.frequency.value = mtof(midi);
    }
    lfoG.connect(o.detune);
    o.connect(lp);
    o.start(t); o.stop(t + dur + 0.05);
  }
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(0.32, t + 0.015);           // ataque sem click
  g.gain.setValueAtTime(0.32, t + dur - 0.05);
  g.gain.linearRampToValueAtTime(0, t + dur);
  lp.connect(g).connect(music.ch.lead);
  music.scheduled++;
}

// expõe p/ probes e2e (mesma ideia do window.__corrida)
if (typeof window !== 'undefined') window.__music = music;
