"""Score for the Echoes of the Cosmos film (30 s): a slow, warm pad in D (night, wonder, no drums), soft air under
every camera move, a small bell when the count lands and when the light stops on the arm, a dry dusty wind at the
Silence that thins the pad out, and the pad opening back up for the title.

    python <teardown>/run_sfx.py film/score.py

All times come from film/timeline.json, the same file src/film/script.ts draws from. Synthesised in Python, no samples.
"""

import os

from sfx.score_kit import airy, hiss, hz
from sfx.synth import chime, pad, whoosh

TIMELINE = "timeline.json"
OUT = os.path.join(os.environ.get("TEARDOWN_OUT", "teardown-out"), "film-score.wav")
TARGET_LUFS = -14.0
SEED = 7


def notes(*names):
    return [hz(n) for n in names]


def smooth(x):
    u = min(1.0, max(0.0, x))
    return u * u * (3 - 2 * u)


def score(mix, tl):
    dur = tl["duration"]
    sc = tl["scenes"]
    b = tl["beats"]
    s0, s1 = sc["silence"]
    t_dust = b["dust"]

    # the bed: Dmaj9 -> Bm9 -> Gmaj7 -> Em9 across the journey, a held Dmaj9 for the title
    chords = [
        (0.0, notes("D3", "A3", "E4", "F#4")),
        (sc["drive"][0], notes("B2", "F#3", "C#4", "D4")),
        (sc["toEsperance"][0], notes("G2", "D3", "F#3", "B3")),
        (sc["toSilence"][0], notes("E2", "B2", "F#3", "G3")),
        (sc["rise"][0] + 0.6, notes("D2", "A2", "E3", "F#3", "A3")),
    ]

    def volume(t):
        fade_in = smooth(t / 1.6)
        fade_out = 1 - smooth((t - (dur - 1.4)) / 1.4)
        # the storm thins the music; it comes back as the camera rises
        storm = 1 - 0.55 * smooth((t - t_dust) / 1.5) * (1 - smooth((t - s1) / 1.2))
        return fade_in * fade_out * storm

    left, right = pad(dur, chords, volume=volume, detune=0.5, tremolo=0.18, xfade=0.8)
    mix.put_stereo(0, left, right, 0.11)

    # the count lands on 5,111
    mix.put(b["count"][1], chime(notes("A5", "D6", "F#6"), dur=2.4, tau=0.9), 0.05)

    # soft air under each camera move
    for name, gain in (("dive", 0.03), ("toEsperance", 0.026), ("toSilence", 0.024), ("rise", 0.03)):
        a, z = sc[name]
        mix.put(a, whoosh(z - a + 0.4, 300, 1400, peak=0.55), gain)

    # light-paint: a low air as the spot sweeps, a bell when it stops on the arm
    mix.put(b["paint"], airy(b["lit"] - b["paint"] + 0.2, 500, 1700, 0.8), 0.02)
    mix.put(b["lit"], chime(notes("D6", "A6"), dur=1.8, tau=0.6), 0.035)

    # the dust storm (illustrative): a dry wind for the Silence
    mix.put(t_dust, hiss(s1 - t_dust + 0.8, fc=2600, level=0.8), 0.016)
    mix.put(t_dust + 0.4, airy(s1 - t_dust, 220, 520, 0.9), 0.03)

    # the title
    mix.put(b["title"], chime(notes("D5", "A5", "E6"), dur=2.4, tau=1.0), 0.04)
