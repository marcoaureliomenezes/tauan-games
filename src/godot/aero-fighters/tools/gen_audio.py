#!/usr/bin/env python3
"""Gera os WAVs sintéticos do aero-fighters Godot (port do audio.js web —
tudo sintetizado, zero assets externos). 16-bit mono 22050 Hz."""
import math, random, struct, os

SR = 22050
OUT = os.path.join(os.path.dirname(__file__), "..", "assets", "audio")
os.makedirs(OUT, exist_ok=True)
random.seed(42)


def write_wav(name, samples):
    samples = [max(-1.0, min(1.0, s)) for s in samples]
    data = b"".join(struct.pack("<h", int(s * 32767)) for s in samples)
    with open(os.path.join(OUT, name), "wb") as f:
        f.write(b"RIFF" + struct.pack("<I", 36 + len(data)) + b"WAVE")
        f.write(b"fmt " + struct.pack("<IHHIIHH", 16, 1, 1, SR, SR * 2, 2, 16))
        f.write(b"data" + struct.pack("<I", len(data)) + data)
    print(f"  {name}: {len(samples)/SR:.2f}s")


def noise():
    return random.uniform(-1, 1)


def sweep(dur, f0, f1, amp=0.5, decay=8.0, noise_mix=0.0, noise_lp=0.0):
    """Varredura senoidal com decaimento + ruído opcional (lp simples 1 polo)."""
    n = int(dur * SR)
    out = []
    prev = 0.0
    for i in range(n):
        t = i / n
        f = f0 + (f1 - f0) * t
        ph = 2 * math.pi * f * (i / SR)
        s = math.sin(ph) * amp
        if noise_mix > 0:
            lp = noise_lp if noise_lp > 0 else 0.2
            prev += lp * (noise() - prev)
            s += prev * noise_mix
        s *= math.exp(-decay * t)
        out.append(s)
    return out


def noise_burst(dur, amp=0.6, decay=6.0, lp=0.15, sub_f=None, sub_amp=0.0):
    """Explosão: ruído lowpass + opcional sub senoidal (85→28 Hz no mega)."""
    n = int(dur * SR)
    out = []
    prev = 0.0
    for i in range(n):
        t = i / n
        prev += lp * (noise() - prev)
        s = prev * amp
        if sub_f:
            f = sub_f[0] + (sub_f[1] - sub_f[0]) * t
            s += math.sin(2 * math.pi * f * (i / SR)) * sub_amp
        s *= math.exp(-decay * t)
        out.append(s)
    return out


def tone(dur, freq, amp=0.4, decay=0.0):
    n = int(dur * SR)
    return [math.sin(2 * math.pi * freq * (i / SR)) * amp * math.exp(-decay * i / n)
            for i in range(n)]


def engine_loop(dur=2.0):
    """Turbina: whine de osciladores + ruído bandpass, loopável (crossfade)."""
    n = int(dur * SR)
    out = []
    prev = 0.0
    for i in range(n):
        t = i / SR
        # crossfade nas pontas para loop sem clique
        fade = min(1.0, min(i, n - i) / (0.1 * SR))
        prev += 0.08 * (noise() - prev)
        s = (math.sin(2 * math.pi * 180 * t) * 0.20
             + math.sin(2 * math.pi * 540 * t) * 0.10
             + math.sin(2 * math.pi * 1230 * t) * 0.05
             + prev * 0.30)
        out.append(s * fade)
    return out


def wind_loop(dur=2.5):
    n = int(dur * SR)
    out = []
    prev = 0.0
    for i in range(n):
        fade = min(1.0, min(i, n - i) / (0.2 * SR))
        prev += 0.03 * (noise() - prev)
        out.append(prev * 0.7 * fade)
    return out


def mayday(dur=2.0):
    """Alarme hi/lo 880/620 Hz alternando (8 s no web; loop de 2 s aqui)."""
    n = int(dur * SR)
    out = []
    for i in range(n):
        f = 880 if (i // int(0.25 * SR)) % 2 == 0 else 620
        fade = min(1.0, min(i, n - i) / (0.05 * SR))
        out.append(math.sin(2 * math.pi * f * (i / SR)) * 0.30 * fade)
    return out


print("gerando WAVs em", OUT)
write_wav("engine.wav", engine_loop())
write_wav("wind.wav", wind_loop())
write_wav("cannon.wav", sweep(0.12, 2400, 900, amp=0.55, decay=30.0, noise_mix=1.2, noise_lp=0.5))
write_wav("aa50.wav", sweep(0.15, 420, 140, amp=0.6, decay=20.0, noise_mix=1.0, noise_lp=0.4))
write_wav("explosion.wav", noise_burst(1.2, amp=0.9, decay=5.0, lp=0.12))
write_wav("mega_explosion.wav", noise_burst(2.5, amp=1.0, decay=3.0, lp=0.10, sub_f=(85, 28), sub_amp=0.5))
write_wav("missile.wav", sweep(0.7, 180, 900, amp=0.35, decay=3.0, noise_mix=0.6, noise_lp=0.25))
write_wav("lock_search.wav", tone(0.45, 800, amp=0.25, decay=1.0))
write_wav("lock_on.wav", tone(0.12, 1400, amp=0.35, decay=4.0))
write_wav("mayday.wav", mayday())
write_wav("hit.wav", noise_burst(0.25, amp=0.7, decay=15.0, lp=0.3))
write_wav("overheat.wav", tone(0.08, 320, amp=0.4, decay=10.0))
write_wav("pickup.wav", sweep(0.2, 600, 1200, amp=0.3, decay=6.0))
write_wav("splash.wav", noise_burst(0.9, amp=0.6, decay=4.0, lp=0.06))
write_wav("incoming.wav", tone(0.3, 980, amp=0.3, decay=2.0))
print("OK")
