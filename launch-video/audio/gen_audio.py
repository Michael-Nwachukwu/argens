#!/usr/bin/env python3
"""Deterministic audio for the Argens launch film.
Music: warm lo-fi bed, 92.3 BPM, arrangement keyed to scene times.
SFX: pops, ticks, typing, whooshes, slams, coin bounces, clicks, dings, blips.
"""
import numpy as np
import wave
import os

SR = 44100
OUT = os.path.dirname(os.path.abspath(__file__))

def write_wav(name, x, gain=1.0):
    x = np.asarray(x, dtype=np.float64) * gain
    peak = np.max(np.abs(x)) or 1.0
    if peak > 0.98:
        x = x / peak * 0.98
    pcm = (x * 32767).astype(np.int16)
    with wave.open(os.path.join(OUT, name), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm.tobytes())
    print(f"  {name}  {len(x)/SR:.2f}s")

def t_axis(dur):
    return np.arange(int(dur * SR)) / SR

def env_exp(dur, tau):
    return np.exp(-t_axis(dur) / tau)

def env_ar(dur, a, r):
    n = int(dur * SR)
    e = np.ones(n)
    na = max(1, int(a * SR)); nr = max(1, int(r * SR))
    e[:na] = np.linspace(0, 1, na)
    e[-nr:] = np.minimum(e[-nr:], np.linspace(1, 0, nr))
    return e

rng = np.random.default_rng(42)  # seeded — deterministic

# ───────────────────────── SFX ─────────────────────────
print("SFX:")

# pop — pitch-up blip
d = 0.16; t = t_axis(d)
f = 320 + 580 * (t / d)
pop = np.sin(2 * np.pi * np.cumsum(f) / SR) * env_exp(d, 0.04)
write_wav("pop.wav", pop, 0.9)

# tick — tiny UI tick
d = 0.05; t = t_axis(d)
tick = np.sin(2 * np.pi * 1100 * t) * env_exp(d, 0.008)
tick += rng.standard_normal(len(t)) * env_exp(d, 0.004) * 0.25
write_wav("tick.wav", tick, 0.8)

# morphtick — brighter swap tick
d = 0.12; t = t_axis(d)
f = 900 + 500 * (t / d)
mt = np.sin(2 * np.pi * np.cumsum(f) / SR) * env_exp(d, 0.025)
write_wav("morphtick.wav", mt, 0.8)

# typing bursts — irregular key ticks (deterministic pattern)
def typing(dur, n_keys, seed):
    r = np.random.default_rng(seed)
    out = np.zeros(int(dur * SR))
    times = np.sort(r.uniform(0.02, dur - 0.06, n_keys))
    for kt in times:
        kd = 0.035
        kt_ax = t_axis(kd)
        key = r.standard_normal(len(kt_ax)) * env_exp(kd, 0.006) * 0.6
        key += np.sin(2 * np.pi * (700 + r.uniform(-150, 250)) * kt_ax) * env_exp(kd, 0.01) * 0.5
        i = int(kt * SR)
        out[i:i + len(key)] += key
    return out
write_wav("typing1.wav", typing(1.15, 26, 7), 0.85)
write_wav("typing2.wav", typing(1.25, 30, 11), 0.85)
write_wav("typing3.wav", typing(1.0, 22, 13), 0.85)

# whoosh — noise swell with sweep
d = 0.7; t = t_axis(d)
noise = rng.standard_normal(len(t))
sweep = np.sin(2 * np.pi * np.cumsum(220 + 880 * (t / d)) / SR) * 0.25
shape = np.sin(np.pi * (t / d)) ** 2.2
wh = (noise * 0.7 + sweep) * shape
# crude lowpass: moving average
wh = np.convolve(wh, np.ones(24) / 24, mode="same")
write_wav("whoosh.wav", wh, 0.9)

# slam — thump + burst
d = 0.45; t = t_axis(d)
fdrop = 120 * np.exp(-t * 14) + 42
thump = np.sin(2 * np.pi * np.cumsum(fdrop) / SR) * env_exp(d, 0.10)
burst = rng.standard_normal(len(t)) * env_exp(d, 0.015) * 0.5
burst = np.convolve(burst, np.ones(10) / 10, mode="same")
write_wav("slam.wav", thump + burst, 0.95)

# coin bounces — metallic descending blips
def bounce(f0, d=0.13):
    t = np.arange(int(d * SR)) / SR
    f = f0 * np.exp(-t * 9)
    x = np.sin(2 * np.pi * np.cumsum(f) / SR) * env_exp(d, 0.03)
    x += np.sin(2 * np.pi * np.cumsum(f * 2.76) / SR) * env_exp(d, 0.018) * 0.4
    return x
write_wav("bounce1.wav", bounce(820), 0.85)
write_wav("bounce2.wav", bounce(640, 0.11), 0.8)

# roll — low rumble
d = 1.9; t = t_axis(d)
rl = rng.standard_normal(len(t))
rl = np.convolve(rl, np.ones(120) / 120, mode="same")
rl *= env_ar(d, 0.25, 0.6) * (1 + 0.3 * np.sin(2 * np.pi * 11 * t))
write_wav("roll.wav", rl, 0.9)

# click — mouse click
d = 0.07; t = t_axis(d)
ck = rng.standard_normal(len(t)) * env_exp(d, 0.004) * 0.7
ck += np.sin(2 * np.pi * 2300 * t) * env_exp(d, 0.006) * 0.6
ck += np.sin(2 * np.pi * 90 * t) * env_exp(d, 0.025) * 0.5
write_wav("click.wav", ck, 0.85)

# ding — success chime (two partials)
d = 0.6; t = t_axis(d)
dg = np.sin(2 * np.pi * 880 * t) * env_exp(d, 0.16)
dg += np.sin(2 * np.pi * 1318.5 * t) * env_exp(d, 0.11) * 0.6
dg += np.sin(2 * np.pi * 1760 * t) * env_exp(d, 0.07) * 0.25
write_wav("ding.wav", dg, 0.7)

# blip — soft reasoning beep
d = 0.12; t = t_axis(d)
bl = np.sin(2 * np.pi * 440 * t) * 0.6 + np.sin(2 * np.pi * 552 * t) * 0.4
bl *= env_ar(d, 0.015, 0.07)
write_wav("blip.wav", bl, 0.55)

# ───────────────────────── MUSIC ─────────────────────────
print("Music:")
DUR = 52.6
BPM = 92.3
BEAT = 60.0 / BPM
BAR = BEAT * 4
N = int(DUR * SR)
mix = np.zeros(N)

NOTE = {"C2":65.41,"D2":73.42,"E2":82.41,"F2":87.31,"G2":98.0,"A2":110.0,"Bb2":116.54,
        "C3":130.81,"D3":146.83,"E3":164.81,"F3":174.61,"G3":196.0,"A3":220.0,"Bb3":233.08,
        "C4":261.63,"D4":293.66,"E4":329.63,"F4":349.23,"G4":392.0,"A4":440.0,"Bb4":466.16,
        "C5":523.25,"D5":587.33,"E5":659.25,"F5":698.46}

# warm chord voicings — Dm7 / Bbmaj7 / F maj9-ish / Cadd9 cycle
PROG = [
    ["D3","F3","A3","C4"],
    ["Bb2","D3","F3","A3"],
    ["F3","A3","C4","E4"],
    ["C3","E3","G3","D4"],
]
BASS = ["D2", "Bb2", "F2", "C2"]

def add(sig, at):
    i = int(at * SR)
    j = min(N, i + len(sig))
    if i < N:
        mix[i:j] += sig[: j - i]

def pad_chord(freqs, dur, vol):
    t = t_axis(dur)
    x = np.zeros(len(t))
    for f in freqs:
        det = 1 + 0.0015 * np.sin(2 * np.pi * 0.45 * t + f)
        x += np.sin(2 * np.pi * f * det * t)
        x += 0.35 * np.sin(2 * np.pi * f * 2 * t)
        x += 0.12 * np.sin(2 * np.pi * f * 3 * t)
    x /= len(freqs) * 1.5
    x *= env_ar(dur, 0.5, 0.8)
    trem = 1 + 0.08 * np.sin(2 * np.pi * 0.9 * t)
    return x * trem * vol

def kick_hit():
    d = 0.22; t = t_axis(d)
    f = 110 * np.exp(-t * 26) + 44
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * env_exp(d, 0.06)

def hat_hit():
    d = 0.05
    h = rng.standard_normal(int(d * SR)) * env_exp(d, 0.009)
    return h - np.convolve(h, np.ones(8) / 8, mode="same")  # crude highpass

def bass_note(f, dur, vol):
    t = t_axis(dur)
    x = np.sin(2 * np.pi * f * t) + 0.3 * np.sin(2 * np.pi * f * 2 * t)
    return x * env_ar(dur, 0.01, dur * 0.5) * vol

def pluck(f, dur, vol):
    t = t_axis(dur)
    x = np.sin(2 * np.pi * f * t) + 0.4 * np.sin(2 * np.pi * f * 2.01 * t)
    return x * env_exp(dur, dur * 0.22) * vol

# sections: (start, end, kick, hats, bass, melody, pad_vol)
SECTIONS = [
    (0.0, 10.4, False, False, False, False, 0.16),
    (10.4, 16.8, True, False, True, False, 0.20),
    (16.8, 22.6, True, True, True, False, 0.22),
    (22.6, 30.4, True, True, True, True, 0.24),
    (30.4, 38.0, False, False, True, True, 0.18),
    (38.0, 46.6, True, True, True, True, 0.24),
    (46.6, 52.6, False, False, True, False, 0.16),
]

def section_at(time):
    for s in SECTIONS:
        if s[0] <= time < s[1]:
            return s
    return SECTIONS[-1]

# pads — one chord per bar, cycling
n_bars = int(np.ceil(DUR / BAR))
for b in range(n_bars):
    at = b * BAR
    sec = section_at(at)
    chord = [NOTE[n] for n in PROG[b % 4]]
    add(pad_chord(chord, BAR + 0.4, sec[6]), at)

# kick — beats 1 & 3, with sidechain-style pad duck baked into kick prominence
for b in range(n_bars):
    for beat in (0, 2):
        at = b * BAR + beat * BEAT
        if at >= DUR: break
        if section_at(at)[2]:
            add(kick_hit() * 0.5, at)

# hats — offbeat 8ths
for b in range(n_bars):
    for e in range(8):
        at = b * BAR + e * BEAT / 2
        if at >= DUR: break
        if e % 2 == 1 and section_at(at)[3]:
            add(hat_hit() * 0.06, at)

# bass — root, two hits per bar
for b in range(n_bars):
    at = b * BAR
    sec = section_at(at)
    if sec[4]:
        f = NOTE[BASS[b % 4]]
        add(bass_note(f, BEAT * 1.6, 0.20), at)
        add(bass_note(f, BEAT * 1.2, 0.14), at + 2 * BEAT)

# melody — sparse pentatonic plucks, deterministic pattern
MELODY = ["D4","F4","A4","C5","A4","F4","E4","D4","C4","D4","F4","G4"]
mi = 0
for b in range(n_bars):
    for slot in (1.0, 2.5, 3.5):
        at = b * BAR + slot * BEAT
        if at >= DUR: break
        sec = section_at(at)
        if sec[5] and (b + int(slot * 2)) % 3 != 0:
            f = NOTE[MELODY[mi % len(MELODY)]]
            add(pluck(f, 0.7, 0.10), at)
            mi += 1

# gentle master fade in / out
fade_in = int(0.8 * SR)
mix[:fade_in] *= np.linspace(0, 1, fade_in)
fade_out = int(2.2 * SR)
mix[-fade_out:] *= np.linspace(1, 0, fade_out)

write_wav("music.wav", mix, 0.95)
print("done")
