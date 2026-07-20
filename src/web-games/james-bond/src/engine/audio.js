// Web game package: james-bond.
// Layered WebAudio synth: gunshot = crack (highpass noise) + body (lowpass noise) + thump (sine drop).
export function createAudio() {
  let context;
  let master;
  let noiseBuffer;
  let footstepClock = 0;

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

  function panner(position) {
    if (!position || !context.createPanner) return master;
    const node = context.createPanner();
    node.panningModel = 'HRTF';
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
    source.connect(filter).connect(envelope).connect(panner(position));
    source.start(start, Math.random() * 0.5, duration + 0.05);
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
    oscillator.connect(envelope).connect(panner(position));
    oscillator.start(start);
    oscillator.stop(end);
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
    burst({ duration: 0.045, gain: distant ? 0.14 : 0.3, type: 'highpass', cutoff: 1400 + pitch, position });
    // body — powder burn
    burst({ duration: 0.16, gain: distant ? 0.12 : 0.24, cutoff: 480 + pitch, position });
    // thump — pressure wave
    tone({ frequency: 68 + pitch * 0.12, duration: 0.14, gain: distant ? 0.1 : 0.2, type: 'sine', slide: -42, position });
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
