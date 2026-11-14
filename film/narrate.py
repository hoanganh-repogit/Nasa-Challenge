"""Voice-over for the film: speaks film/narration.json with Kokoro (open-weight TTS, Apache-2.0), fits each line
inside its window, writes the voice track, and splits the lines into timed captions.

    KOKORO_DIR=<folder with kokoro-v1.0.onnx and voices-v1.0.bin> python film/narrate.py

Needs: pip install kokoro-onnx soundfile (kept out of the web app's dependencies).
Writes: teardown-out/film-voice.wav, film/captions.json (read by /film), film/captions.srt (for video players).
"""

import json
import os
import re
from pathlib import Path

import numpy as np
import soundfile as sf
from kokoro_onnx import Kokoro

ROOT = Path(__file__).resolve().parents[1]
FILM = ROOT / "film"
OUT = ROOT / os.environ.get("TEARDOWN_OUT", "teardown-out")
KDIR = Path(os.environ["KOKORO_DIR"])
MAX_CHARS = 44  # one caption line


def trim(x, sr, thr=0.01):
    """Cut leading and trailing silence, keeping a few milliseconds of air."""
    idx = np.flatnonzero(np.abs(x) > thr)
    if idx.size == 0:
        return x
    pad = int(0.03 * sr)
    return x[max(0, idx[0] - pad): min(len(x), idx[-1] + pad)]


def chunks(text):
    """Caption pieces: clauses (split at , . : ;) merged while they fit one line; a long piece splits at the space
    nearest its middle, so no line ends with a single orphan word."""
    clauses = [p.strip() for p in re.split(r"(?<=[.,:;])\s+", text) if p.strip()]
    merged = []
    for c in clauses:
        if merged and len(merged[-1]) + 1 + len(c) <= MAX_CHARS and not merged[-1].endswith((".", ":")):
            merged[-1] += " " + c
        else:
            merged.append(c)
    # a very short clause ("In 2005,") leans on the next one instead of flashing alone
    joined = []
    for c in merged:
        if joined and len(joined[-1]) < 12 and not joined[-1].endswith((".", ":")):
            joined[-1] += " " + c
        else:
            joined.append(c)
    out = []
    for p in joined:
        while len(p) > MAX_CHARS:
            mid = len(p) // 2
            spaces = [i for i, ch in enumerate(p) if ch == " "]
            cut = min(spaces, key=lambda i: abs(i - mid))
            out.append(p[:cut])
            p = p[cut + 1:]
        out.append(p)
    return out


def srt_time(t):
    ms = int(round(t * 1000))
    h, ms = divmod(ms, 3_600_000)
    m, ms = divmod(ms, 60_000)
    s, ms = divmod(ms, 1000)
    return f"{h:02}:{m:02}:{s:02},{ms:03}"


def main():
    spec = json.loads((FILM / "narration.json").read_text(encoding="utf-8"))
    tl = json.loads((FILM / "timeline.json").read_text(encoding="utf-8"))
    kokoro = Kokoro(str(KDIR / "kokoro-v1.0.onnx"), str(KDIR / "voices-v1.0.bin"))
    voice = spec["voice"]
    sr = 24000
    track = np.zeros(int(tl["duration"] * sr), dtype=np.float32)
    captions = []
    for line in spec["lines"]:
        a, b = line["window"]
        room = b - a
        speed = 1.0
        for _ in range(4):
            samples, sr = kokoro.create(line["text"], voice=voice, speed=speed, lang="en-us")
            samples = trim(np.asarray(samples, dtype=np.float32), sr)
            dur = len(samples) / sr
            if dur <= room or speed >= 1.25:
                break
            speed = min(1.25, speed * dur / room * 1.03)
        if dur > room:
            raise SystemExit(f"line does not fit its window even at speed {speed:.2f}: {line['text']}")
        i0 = int(a * sr)
        track[i0: i0 + len(samples)] += samples
        # captions: each piece gets time in proportion to its length, over the spoken span
        pieces = chunks(line["text"])
        total = sum(len(p) for p in pieces)
        t = a
        for p in pieces:
            d = dur * len(p) / total
            captions.append({"start": round(t, 2), "end": round(t + d + 0.25, 2), "text": p})
            t += d
        print(f"{a:5.1f}-{a + dur:5.1f}s (window {room:.1f}s, speed {speed:.2f})  {line['text']}")
    # keep captions from overlapping the next one
    for c, n in zip(captions, captions[1:]):
        c["end"] = min(c["end"], n["start"] - 0.02)
    OUT.mkdir(exist_ok=True)
    sf.write(OUT / "film-voice.wav", track, sr)
    (FILM / "captions.json").write_text(json.dumps(captions, indent=2) + "\n", encoding="utf-8")
    srt = "\n".join(f"{i}\n{srt_time(c['start'])} --> {srt_time(c['end'])}\n{c['text']}\n" for i, c in enumerate(captions, 1))
    (FILM / "captions.srt").write_text(srt, encoding="utf-8")
    print(f"wrote {OUT / 'film-voice.wav'}, {len(captions)} captions")


if __name__ == "__main__":
    main()
