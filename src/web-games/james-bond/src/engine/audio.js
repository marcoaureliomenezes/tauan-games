// Web game package: james-bond.
// Layered WebAudio synth: gunshot = crack (highpass noise) + body (lowpass noise) + thump (sine drop).
export function createAudio() {
  let context;
  let master;
  let noiseBuffer;
  let footstepClock = 0;
  let music = null;

  function ensure() {
    if (!context) {
      context = new (window.AudioContext || window.webkitAudioContext)();
      master = context.createGain();
      master.gain.value = 0.5;
      master.connect(context.destination);
      noiseBuffer = context.createBuffer(1, context.sampleRate, context.sampleRate);
      const data = noiseBuffer.getChannelData(0);
      for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
    }
    if (context.state === 'suspended') context.resume();
  }

  // PERF: HRTF é o modelo de espacialização mais caro do WebAudio (convolução
  // por nó) — um tiro não-suprimido cria 4 desses, uma explosão 3, e cadência
  // automática soma dezenas por segundo. `equalpower` mantém a pista de
  // direção/distância (o jogo já usa refDistance/rolloffFactor para a
  // sensação de perto/longe) a uma fração do custo — e é o suficiente para um
  // FPS de teclado. Combinado com a desconexão em `onended` abaixo, o grafo de
  // áudio para de crescer sem limite.
  function panner(position) {
    if (!position || !context.createPanner) return master;
    const node = context.createPanner();
    node.panningModel = 'equalpower';
    node.distanceModel = 'inverse';
    node.refDistance = 3;
    node.maxDistance = 80;
    node.rolloffFactor = 1.05;
    node.positionX.value = position.x;
    node.positionY.value = position.y || 1;
    node.positionZ.value = position.z;
    node.connect(master);
    return node;
  }

  function burst({ duration = 0.1, gain = 0.2, type = 'lowpass', cutoff = 1800, q = 0.6, position, when = 0, decay = true }) {
    const source = context.createBufferSource();
    const filter = context.createBiquadFilter();
    const envelope = context.createGain();
    source.buffer = noiseBuffer;
    source.playbackRate.value = 0.85 + Math.random() * 0.3;
    filter.type = type;
    filter.frequency.value = cutoff;
    filter.Q.value = q;
    const start = context.currentTime + when;
    envelope.gain.setValueAtTime(gain, start);
    if (decay) envelope.gain.exponentialRampToValueAtTime(0.001, start + duration);
    else envelope.gain.linearRampToValueAtTime(0.001, start + duration);
    const spatial = panner(position);
    source.connect(filter).connect(envelope).connect(spatial);
    source.start(start, Math.random() * 0.5, duration + 0.05);
    // Desconecta a cadeia inteira quando o som termina — sem isto o grafo de
    // áudio só crescia (nenhum nó jamais era desconectado).
    source.onended = () => {
      source.disconnect();
      filter.disconnect();
      envelope.disconnect();
      if (spatial !== master) spatial.disconnect();
    };
  }

  function tone({ frequency = 220, duration = 0.1, gain = 0.2, type = 'square', position, slide = 0, when = 0 }) {
    const oscillator = context.createOscillator();
    const envelope = context.createGain();
    const start = context.currentTime + when;
    const end = start + duration;
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, start);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(20, frequency + slide), end);
    envelope.gain.setValueAtTime(gain, start);
    envelope.gain.exponentialRampToValueAtTime(0.001, end);
    const spatial = panner(position);
    oscillator.connect(envelope).connect(spatial);
    oscillator.start(start);
    oscillator.stop(end);
    oscillator.onended = () => {
      oscillator.disconnect();
      envelope.disconnect();
      if (spatial !== master) spatial.disconnect();
    };
  }

  function gunshot(weapon, position, distant) {
    ensure();
    const suppressed = Boolean(weapon?.suppressed) || (weapon?.noise ?? 20) < 10;
    const pitch = weapon?.pitch ?? 220;
    if (suppressed) {
      burst({ duration: 0.07, gain: distant ? 0.06 : 0.1, cutoff: 750, position });
      tone({ frequency: 120, duration: 0.05, gain: 0.06, type: 'sine', slide: -55, position });
      return;
    }
    // crack — the supersonic snap
    burst({ duration: 0.05, gain: distant ? 0.16 : 0.36, type: 'highpass', cutoff: 1400 + pitch, position });
    // body — powder burn
    burst({ duration: 0.17, gain: distant ? 0.14 : 0.29, cutoff: 480 + pitch, position });
    // thump — pressure wave
    tone({ frequency: 68 + pitch * 0.12, duration: 0.15, gain: distant ? 0.12 : 0.24, type: 'sine', slide: -42, position });
    // tail — brief room echo
    burst({ duration: 0.32, gain: distant ? 0.05 : 0.08, cutoff: 300, when: 0.03, position, decay: false });
  }

  return {
    unlock: ensure,
    setListener(position, forward) {
      if (!context) return;
      const listener = context.listener;
      listener.positionX.value = position.x;
      listener.positionY.value = position.y;
      listener.positionZ.value = position.z;
      listener.forwardX.value = forward.x;
      listener.forwardY.value = forward.y;
      listener.forwardZ.value = forward.z;
    },
    gun(weapon, position) { gunshot(weapon, position, false); },
    enemyGun(position) { gunshot(null, position, true); },
    crack(position) {
      ensure();
      burst({ duration: 0.035, gain: 0.16, type: 'highpass', cutoff: 2600, position });
      tone({ frequency: 1900, duration: 0.05, gain: 0.03, type: 'sine', slide: -1300, position });
    },
    explosion(position) {
      ensure();
      burst({ duration: 0.7, gain: 0.5, cutoff: 900, position });
      burst({ duration: 1.1, gain: 0.25, cutoff: 220, when: 0.05, position, decay: false });
      tone({ frequency: 66, duration: 0.8, gain: 0.36, type: 'sine', slide: -48, position });
    },
    impact(position, metal = false) {
      ensure();
      if (metal) {
        tone({ frequency: 640 + Math.random() * 320, duration: 0.09, gain: 0.05, position, slide: -260 });
        burst({ duration: 0.04, gain: 0.06, type: 'highpass', cutoff: 3800, position });
      } else {
        burst({ duration: 0.05, gain: 0.08, cutoff: 1300, position });
      }
    },
    ricochet(position) {
      ensure();
      tone({ frequency: 2300 + Math.random() * 600, duration: 0.16, gain: 0.035, type: 'sine', slide: -1800, position });
    },
    blood(position) {
      ensure();
      burst({ duration: 0.06, gain: 0.09, cutoff: 900, position });
    },
    alarm(position) { ensure(); tone({ frequency: 620, duration: 0.32, gain: 0.12, position, slide: 170 }); },
    objective() { ensure(); tone({ frequency: 440, duration: 0.12, gain: 0.1, type: 'sine', slide: 440 }); },
    dry() { ensure(); tone({ frequency: 1150, duration: 0.03, gain: 0.04, type: 'square', slide: -350 }); },
    jump() { ensure(); burst({ duration: 0.07, gain: 0.045, cutoff: 520 }); },
    reload(duration = 1.4) {
      ensure();
      // mag out, mag in, bolt/slide rack
      burst({ duration: 0.03, gain: 0.07, type: 'bandpass', cutoff: 1900, q: 2.5 });
      burst({ duration: 0.03, gain: 0.08, type: 'bandpass', cutoff: 1500, q: 2.5, when: duration * 0.55 });
      burst({ duration: 0.04, gain: 0.1, type: 'bandpass', cutoff: 2300, q: 2, when: duration * 0.82 });
    },
    hurt() {
      ensure();
      tone({ frequency: 100, duration: 0.15, gain: 0.17, type: 'sawtooth', slide: -52 });
      burst({ duration: 0.08, gain: 0.1, cutoff: 500 });
    },
    melee(position) {
      ensure();
      tone({ frequency: 135, duration: 0.24, gain: 0.17, type: 'sawtooth', slide: -85, position });
      burst({ duration: 0.12, gain: 0.1, cutoff: 650, position });
    },
    // Faca: assobio curto de lâmina cortando o ar, sem estampido.
    knife(position) {
      ensure();
      burst({ duration: 0.09, gain: 0.075, type: 'bandpass', cutoff: 3200, q: 1.6, position });
      tone({ frequency: 880, duration: 0.08, gain: 0.03, type: 'sine', slide: -520, position });
    },
    // Lança-granadas: baque oco de expulsão + chiado do propelente subindo.
    launcher(position) {
      ensure();
      burst({ duration: 0.12, gain: 0.34, cutoff: 620, position });
      tone({ frequency: 96, duration: 0.22, gain: 0.3, type: 'sine', slide: -54, position });
      burst({ duration: 0.42, gain: 0.14, type: 'highpass', cutoff: 1500, when: 0.04, position, decay: false });
    },
    // Trilha de suspense procedural: drone menor (D2+F2) com filtro respirando + batimento.
    startMusic() {
      ensure();
      if (music) return;
      const bus = context.createGain();
      bus.gain.value = 0;
      bus.gain.linearRampToValueAtTime(0.055, context.currentTime + 3);
      bus.connect(master);
      const filter = context.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 210;
      filter.connect(bus);
      const oscillators = [73.42, 73.82, 87.31].map((frequency) => {
        const osc = context.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.value = frequency;
        osc.connect(filter);
        osc.start();
        return osc;
      });
      const lfo = context.createOscillator();
      const lfoGain = context.createGain();
      lfo.frequency.value = 0.07;
      lfoGain.gain.value = 95;
      lfo.connect(lfoGain).connect(filter.frequency);
      lfo.start();
      const heartbeat = setInterval(() => {
        if (!context) return;
        tone({ frequency: 52, duration: 0.16, gain: 0.13, type: 'sine', slide: -18 });
        setTimeout(() => tone({ frequency: 47, duration: 0.14, gain: 0.08, type: 'sine', slide: -14 }), 200);
      }, 1080);
      music = { bus, oscillators, lfo, heartbeat };
    },
    stopMusic() {
      if (!music || !context) return;
      const current = music;
      music = null;
      clearInterval(current.heartbeat);
      current.bus.gain.linearRampToValueAtTime(0, context.currentTime + 1.2);
      setTimeout(() => {
        current.oscillators.forEach((osc) => osc.stop());
        current.lfo.stop();
        current.bus.disconnect();
      }, 1400);
    },
    // ---- Inimigos -------------------------------------------------------
    // Tudo sintetizado: nenhum sample é carregado, então não há tela de
    // loading e nada depende de licença de áudio de terceiros.

    /**
     * Passo de inimigo. `height` escala peso: quanto maior o bicho, mais grave
     * e mais longo o impacto, e o T-Rex ainda ganha um tremor de solo.
     */
    enemyStep(type, position, height = 1.85) {
      ensure();
      if (type === 'phantom') return; // fantasma não pisa
      const heavy = Math.min(2.4, height / 1.85);
      if (type === 'raptor') {
        // Garra rápida e seca no piso.
        burst({ duration: 0.045, gain: 0.075, type: 'bandpass', cutoff: 2400, q: 1.4, position });
        tone({ frequency: 320, duration: 0.05, gain: 0.03, type: 'sine', slide: -180, position });
        return;
      }
      if (type === 'trex') {
        burst({ duration: 0.26, gain: 0.3, cutoff: 150, position });
        tone({ frequency: 38, duration: 0.42, gain: 0.32, type: 'sine', slide: -14, position });
        return;
      }
      burst({ duration: 0.06 * heavy, gain: 0.05 * heavy, cutoff: 420 / heavy + Math.random() * 120, position });
      if (heavy > 1.15) tone({ frequency: 74, duration: 0.16, gain: 0.09 * heavy, type: 'sine', slide: -22, position });
    },

    /**
     * Vocalização por espécie. `event` é 'idle' | 'alert' | 'attack' | 'hurt' | 'death'.
     * Cada espécie tem timbre próprio; o evento muda intensidade e altura.
     */
    enemyVoice(type, position, event = 'idle') {
      ensure();
      const loud = event === 'alert' || event === 'attack' ? 1.5 : event === 'death' ? 1.3 : event === 'hurt' ? 1.15 : 0.72;
      const pitchShift = event === 'hurt' ? 1.25 : event === 'death' ? 0.75 : 1;
      switch (type) {
        case 'vampire':
          // Silvo sibilante + guincho agudo.
          burst({ duration: 0.34 * loud, gain: 0.07 * loud, type: 'highpass', cutoff: 3400, q: 1.1, position, decay: false });
          tone({ frequency: 720 * pitchShift, duration: 0.3, gain: 0.045 * loud, type: 'sawtooth', slide: 420, position });
          break;
        case 'monster':
          // Rosnado gutural longo.
          tone({ frequency: 62 * pitchShift, duration: 0.72, gain: 0.16 * loud, type: 'sawtooth', slide: -18, position });
          burst({ duration: 0.6, gain: 0.07 * loud, cutoff: 340, position, decay: false });
          break;
        case 'demon':
          tone({ frequency: 88 * pitchShift, duration: 0.5, gain: 0.15 * loud, type: 'square', slide: -34, position });
          tone({ frequency: 131 * pitchShift, duration: 0.44, gain: 0.07 * loud, type: 'sawtooth', slide: -50, position });
          break;
        case 'phantom':
          // Lamento: seno lento que sobe e volta, sem ataque percussivo.
          tone({ frequency: 300 * pitchShift, duration: 1.25, gain: 0.075 * loud, type: 'sine', slide: 190, position });
          tone({ frequency: 452 * pitchShift, duration: 1.05, gain: 0.035 * loud, type: 'sine', slide: -230, position, when: 0.16 });
          break;
        case 'raptor':
          // Grito curto e estridente de caçador.
          tone({ frequency: 900 * pitchShift, duration: 0.19, gain: 0.1 * loud, type: 'sawtooth', slide: 620, position });
          tone({ frequency: 1500 * pitchShift, duration: 0.13, gain: 0.05 * loud, type: 'square', slide: -820, position, when: 0.14 });
          burst({ duration: 0.14, gain: 0.04 * loud, type: 'highpass', cutoff: 2400, position, when: 0.02 });
          break;
        case 'trex':
          // Bramido: fundamental muito grave + corpo rasgado por cima.
          tone({ frequency: 46 * pitchShift, duration: 1.5, gain: 0.34 * loud, type: 'sawtooth', slide: -12, position });
          tone({ frequency: 96 * pitchShift, duration: 1.25, gain: 0.16 * loud, type: 'square', slide: -34, position });
          burst({ duration: 1.35, gain: 0.11 * loud, cutoff: 620, position, decay: false });
          break;
        default:
          // Humano: grunhido curto; no 'alert' sai um chiado de rádio.
          if (event === 'alert') {
            burst({ duration: 0.1, gain: 0.07, type: 'bandpass', cutoff: 1900, q: 3, position });
            tone({ frequency: 640, duration: 0.09, gain: 0.035, type: 'square', slide: -180, position });
            break;
          }
          if (event === 'idle') return; // patrulha humana fica em silêncio
          tone({ frequency: 168 * pitchShift, duration: 0.22, gain: 0.09 * loud, type: 'sawtooth', slide: -62, position });
          break;
      }
    },

    footsteps(dt, moving, sprinting, position) {
      if (!moving) { footstepClock = 0; return; }
      footstepClock -= dt;
      if (footstepClock > 0) return;
      footstepClock = sprinting ? 0.3 : 0.44;
      ensure();
      burst({ duration: 0.05, gain: sprinting ? 0.07 : 0.04, cutoff: 480 + Math.random() * 160, position });
    },
  };
}
