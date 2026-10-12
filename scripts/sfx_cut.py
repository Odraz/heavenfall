"""Finishes all 17 S1 sound-effect families for the game (docs/rogue/audio-prompts.md).

Reads every take assets/audio-src/rogue/sfx/<name>-NN.mp3 (or .wav) whose <name> is listed in
SOUNDS, writes assets/sfx/<name>-NN.wav: mono, 48 kHz, 16-bit. The originals stay untouched.

For each take:
- decoded to mono with the rumble below 40 Hz removed;
- the start found: `onset` is where the take first rises to 30 dB below its peak (the first shot
  of a burst, the start of a hit); `peak` is where it first comes within 6 dB of its peak (for
  takes that swell or tick late), minus a short pre-roll;
- cut there, at most the listed length, ending early once it falls 50 dB below the peak;
- a 3 ms fade-in and the listed fade-out, so there's no click;
- normalized to a peak of -1 dBFS. The game matches each take's loudness to the synthesized cue
  it replaces, so the toggle compares sound, not level.

Usage: python -I scripts/sfx_cut.py [name ...]   (no names: every listed sound)
Optional source sidecar `processing` overrides: anchor (onset/peak), pre_roll_seconds,
max_duration_seconds and fade_out_seconds. Cutting never depends on provider labels.
Needs Python 3 with NumPy, and ffmpeg on the PATH.
"""
import json
import math
import pathlib
import re
import shutil
import subprocess
import sys
import wave

import numpy as np

ROOT = pathlib.Path(__file__).resolve().parent.parent
SRC = ROOT / "assets" / "audio-src" / "rogue" / "sfx"
OUT = ROOT / "assets" / "sfx"
SR = 48000
HOP = SR // 1000  # 1 ms

# name: (longest cut in s, fade-out in s, anchor, pre-roll in s)
SOUNDS = {
    # 12 a second: only the first shot of the burst (pilot rule, 2026-10-11).
    "chaingun": (0.075, 0.012, "onset", 0.002),
    "shotgun": (0.6, 0.12, "onset", 0.003),
    "slug": (0.7, 0.14, "onset", 0.003),
    "censerLaunch": (0.5, 0.1, "onset", 0.003),
    "censerBreak": (0.8, 0.16, "onset", 0.003),
    "revolver": (0.5, 0.1, "onset", 0.003),
    "silverBullet": (0.9, 0.18, "onset", 0.003),
    "scourge": (0.7, 0.14, "onset", 0.003),
    "daggerCut": (0.35, 0.07, "onset", 0.003),
    "hitTick": (0.08, 0.025, "peak", 0.008),
    "killTick": (0.15, 0.04, "peak", 0.01),
    "burstPop": (0.4, 0.08, "onset", 0.003),
    "blessedDeath": (0.35, 0.08, "onset", 0.003),
    # The trailer-impact takes swell up to their hit: cut from just before the hit.
    "massKill": (1.0, 0.25, "peak", 0.03),
    "porcelainBreak": (0.7, 0.14, "onset", 0.003),
    "blastLampCrack": (0.15, 0.025, "onset", 0.003),
    "blastLampBurst": (0.7, 0.14, "onset", 0.003),
}


def decode(path: pathlib.Path) -> np.ndarray:
    raw = subprocess.run(
        ["ffmpeg", "-v", "error", "-i", str(path), "-ac", "1", "-ar", str(SR), "-af", "highpass=f=40", "-f", "f32le", "-"],
        capture_output=True, check=True).stdout
    return np.frombuffer(raw, dtype=np.float32).astype(np.float64)


def envelope_db(x: np.ndarray) -> np.ndarray:
    """Level per 1 ms, smoothed over 5 ms."""
    n = len(x) // HOP
    if n < 5 or not np.isfinite(x).all() or np.max(np.abs(x)) < 1e-8:
        raise ValueError("take is too short, silent or contains invalid samples")
    rms = np.sqrt((x[: n * HOP].reshape(n, HOP) ** 2).mean(axis=1))
    rms = np.convolve(rms, np.ones(5) / 5, mode="same")
    return 20 * np.log10(rms + 1e-9)


def cut(x: np.ndarray, longest: float, fade_out: float, anchor: str, pre: float) -> tuple[np.ndarray, int]:
    db = envelope_db(x)
    peak = db.max()
    above = np.nonzero(db >= peak - (30 if anchor == "onset" else 6))[0]
    start_ms = max(0, int(above[0]) - round(pre * 1000))
    # Ends early once the level stays 50 dB under the peak for 20 ms.
    end_ms = min(len(db), start_ms + round(longest * 1000))
    quiet = db < peak - 50
    for i in range(int(np.argmax(db)), end_ms - 20):
        if quiet[i:i + 20].all():
            end_ms = i + 20
            break
    y = x[start_ms * HOP: end_ms * HOP].copy()
    if not len(y) or np.max(np.abs(y)) < 1e-8:
        raise ValueError("cut contains no audible samples; review processing settings")
    fi = min(int(0.003 * SR), len(y))
    y[:fi] *= np.linspace(0, 1, fi)
    fo = min(int(fade_out * SR), len(y) // 2)
    y[len(y) - fo:] *= np.linspace(1, 0, fo) ** 2
    y *= 10 ** (-1 / 20) / (np.abs(y).max() + 1e-12)
    return y, start_ms


def write_wav(path: pathlib.Path, y: np.ndarray) -> None:
    pcm = np.clip(np.round(y * 32767), -32768, 32767).astype("<i2")
    with wave.open(str(path), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm.tobytes())


def processing_settings(name: str, overrides: dict) -> tuple[float, float, str, float]:
    longest, fade_out, anchor, pre = SOUNDS[name]
    if not isinstance(overrides, dict):
        raise ValueError("processing must be a JSON object")
    allowed = {"anchor", "pre_roll_seconds", "max_duration_seconds", "fade_out_seconds"}
    if overrides.keys() - allowed:
        raise ValueError(f"unknown processing settings: {', '.join(sorted(overrides.keys() - allowed))}")
    anchor = overrides.get("anchor", anchor)
    if anchor not in ("onset", "peak"):
        raise ValueError("processing anchor must be onset or peak")
    values = []
    for key, default, minimum in (("max_duration_seconds", longest, 0.005),
                                  ("fade_out_seconds", fade_out, 0), ("pre_roll_seconds", pre, 0)):
        value = overrides.get(key, default)
        if (isinstance(value, bool) or not isinstance(value, (int, float))
                or not math.isfinite(value) or value < minimum):
            raise ValueError(f"{key} must be a finite number >= {minimum}")
        values.append(value)
    return values[0], values[1], anchor, values[2]


def family_files(folder: pathlib.Path, name: str) -> list[pathlib.Path]:
    return sorted(p for p in folder.glob(f"{name}-*")
                  if p.suffix.lower() in (".mp3", ".wav")
                  and re.fullmatch(rf"{re.escape(name)}-\d+", p.stem))


def prepare_family(name: str, takes: list[pathlib.Path] | None = None) -> list:
    if name not in SOUNDS:
        raise ValueError(f"no S1 finishing rule for {name}")
    takes = family_files(SRC, name) if takes is None else takes
    if len({p.stem for p in takes}) != len(takes):
        raise ValueError(f"{name}: duplicate source take numbers across formats")
    prepared = []
    for p in takes:
        sidecar = p.with_suffix(".json")
        source = json.loads(sidecar.read_text(encoding="utf-8-sig")) if sidecar.exists() else {}
        if not isinstance(source, dict):
            raise ValueError(f"expected a JSON object: {sidecar}")
        settings = processing_settings(name, source.get("processing", {}))
        prepared.append((p, *cut(decode(p), *settings)))
    return prepared


def install_family(name: str, prepared: list) -> None:
    if not prepared:
        return
    OUT.mkdir(parents=True, exist_ok=True)
    previous = [p for p in family_files(OUT, name) if p.suffix.lower() == ".wav"]
    if previous:
        archive = SRC / "rejected" / "runtime"
        version = 1
        while (archive / f"{name}-v{version}").exists():
            version += 1
        folder = archive / f"{name}-v{version}"
        folder.mkdir(parents=True)
        for old in previous:
            shutil.move(str(old), folder / old.name)
        print(f"{name}: previous runtime takes archived in {folder.relative_to(ROOT).as_posix()}")
    for p, y, start_ms in prepared:
        dst = OUT / f"{p.stem}.wav"
        write_wav(dst, y)
        print(f"{p.name}: from {start_ms} ms, {len(y) * 1000 // SR} ms -> {dst.relative_to(ROOT).as_posix()}")


def main(names: list[str]) -> None:
    names = list(dict.fromkeys(names or SOUNDS))
    unknown = set(names) - SOUNDS.keys()
    if unknown:
        raise ValueError(f"no S1 finishing rule for: {', '.join(sorted(unknown))}")
    for name in names:
        prepared = prepare_family(name)
        if prepared:
            install_family(name, prepared)
        else:
            print(f"{name}: no takes")


if __name__ == "__main__":
    main(sys.argv[1:])
