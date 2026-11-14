"""Opportunity traverse ETL: data/raw/MERB_traverse_5130.csv -> public/data/*.json

Run:  python -P scripts/transform_traverse.py

Rules (spec v1.1 sections 7.3, 8.3; research DATA_REPORT_MERB_traverse.md):
- Keep the source row order; END_SOL is the time key (never decreases).
- Drop the 15 fully duplicated rows from the output only; raw stays untouched.
- No interpolation across gaps, no lat/lon conversion, no invented positions.
- Coordinates are CORRECTED_X/Y = local easting/northing in metres (unit inferred, not stated in the LBL).
"""
from __future__ import annotations

import csv
import cmath
import hashlib
import json
import math
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RAW_CSV = ROOT / "data/raw/MERB_traverse_5130.csv"
RAW_LBL = ROOT / "data/raw/MERB_traverse_5130.lbl"
OUT = ROOT / "public/data"

SOURCE_URL_CSV = "https://an.rsl.wustl.edu/mera/AN/meri/MER/traverse/MERB_traverse_5130.csv"
SOURCE_URL_LBL = "https://an.rsl.wustl.edu/mera/AN/meri/MER/traverse/MERB_traverse_5130.lbl"
SOURCE_PAGE = "https://an.rsl.wustl.edu/mera/AN/pages/mer/mer_traverse.htm"

MAX_UNCOVERED_SOLS = 5      # project setting, not a NASA standard
GAP_JUMP_MIN_METERS = 5.0   # >= this across a gap: dashed line; below: hold + "no records" label
SIMPLIFY_EPSILON_M = 1.5    # Douglas-Peucker tolerance, drawing only
LAST_CONTACT_SOL = 5111     # PIA22929

# PIA23178 2-point similarity fit (research/scripts/overlay_vs_pia23178.py, DATA_REPORT section 4b).
# Pixel anchors on the original 2667x2058 image, y down, read by eye (+/- ~10 px).
BASEMAP = {"width": 2667, "height": 2058, "eaglePx": (393.0, 98.0), "perseverancePx": (972.0, 1388.0)}

FLAG_CODES = {"hold": 0, "drive": 1, "gap-before": 2}


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def read_rows() -> list[dict]:
    with RAW_CSV.open(newline="") as f:
        rows = []
        for i, r in enumerate(csv.DictReader(f)):
            rows.append({
                "sourceRow": i,  # 0-based data row index (header excluded)
                "site": int(r["SITE"]), "drive": int(r["DRIVE"]),
                "startSol": int(r["START_SOL"]), "endSol": int(r["END_SOL"]),
                "rawX": float(r["RAW_X"]), "rawY": float(r["RAW_Y"]), "rawZ": float(r["RAW_Z"]),
                "x": float(r["CORRECTED_X"]), "y": float(r["CORRECTED_Y"]),
                "key": tuple(r[k] for k in ("SITE", "DRIVE", "START_SOL", "END_SOL", "RAW_X", "RAW_Y", "RAW_Z", "CORRECTED_X", "CORRECTED_Y")),
            })
    return rows


def dedupe(rows: list[dict]) -> tuple[list[dict], list[int]]:
    """Drop rows identical to an earlier row in all 9 fields. Duplicates in this file are adjacent."""
    seen, kept, dropped = set(), [], []
    for r in rows:
        if r["key"] in seen:
            dropped.append(r["sourceRow"])
            continue
        seen.add(r["key"])
        kept.append(r)
    return kept, dropped


def step(a: dict, b: dict) -> float:
    return math.hypot(b["x"] - a["x"], b["y"] - a["y"])


def find_gaps(pts: list[dict]) -> list[dict]:
    gaps = []
    for i in range(len(pts) - 1):
        a, b = pts[i], pts[i + 1]
        if b["startSol"] - a["endSol"] > MAX_UNCOVERED_SOLS:
            jump = step(a, b)
            gaps.append({
                "afterPointIndex": i, "afterEndSol": a["endSol"], "nextStartSol": b["startSol"],
                "fromSol": a["endSol"] + 1, "toSol": b["startSol"] - 1,
                "jumpMeters": round(jump, 2),
                "render": "dashed" if jump >= GAP_JUMP_MIN_METERS else "hold",
            })
    return gaps


def basemap_transform(first: dict, last: dict) -> dict:
    """world (easting, northing; y up) -> image pixel (y down) as an affine matrix."""
    a_img, b_img = complex(*BASEMAP["eaglePx"]), complex(*BASEMAP["perseverancePx"])
    conj = lambda z: complex(z.real, -z.imag)
    a_w, b_w = complex(first["x"], first["y"]), complex(last["x"], last["y"])
    s = (b_img - a_img) / (conj(b_w) - conj(a_w))
    sr, si = s.real, s.imag
    # px = Ax + sr*(x-x0) + si*(y-y0);  py = Ay + si*(x-x0) - sr*(y-y0)
    return {
        "method": "2-point similarity fit, anchors at first (Eagle) and last (Perseverance Valley) records",
        "image": "PIA23178", "imageWidth": BASEMAP["width"], "imageHeight": BASEMAP["height"],
        "anchorsPx": {"eagle": BASEMAP["eaglePx"], "perseveranceValley": BASEMAP["perseverancePx"]},
        "metersPerPixel": round(1 / abs(s), 4),
        "rotationDeg": round(math.degrees(cmath.phase(s)), 3),
        "matrix": {  # px = a*x + b*y + c ; py = d*x + e*y + f   (x,y in metres)
            "a": sr, "b": si, "c": a_img.real - sr * first["x"] - si * first["y"],
            "d": si, "e": -sr, "f": a_img.imag - si * first["x"] + sr * first["y"],
        },
        "caveat": "Route aligned to NASA map by a 2-point fit; offsets up to ~0.5 km.",
    }


def simplify(pts: list[dict], eps: float) -> list[int]:
    """Iterative Douglas-Peucker; returns kept point indices (drawing only, lookup uses full data)."""
    n = len(pts)
    keep = [False] * n
    keep[0] = keep[-1] = True
    stack = [(0, n - 1)]
    while stack:
        i, j = stack.pop()
        ax, ay, bx, by = pts[i]["x"], pts[i]["y"], pts[j]["x"], pts[j]["y"]
        dx, dy = bx - ax, by - ay
        L = math.hypot(dx, dy)
        best, bi = -1.0, -1
        for k in range(i + 1, j):
            px, py = pts[k]["x"], pts[k]["y"]
            d = abs(dy * px - dx * py + bx * ay - by * ax) / L if L > 0 else math.hypot(px - ax, py - ay)
            if d > best:
                best, bi = d, k
        if best > eps:
            keep[bi] = True
            stack += [(i, bi), (bi, j)]
    return [k for k in range(n) if keep[k]]


def build() -> dict:
    rows = read_rows()
    pts, dropped = dedupe(rows)

    cum, flags = [0.0], ["hold"]
    gaps = find_gaps(pts)
    gap_after = {g["afterPointIndex"] for g in gaps}
    for i in range(1, len(pts)):
        d = step(pts[i - 1], pts[i])
        cum.append(cum[-1] + d)
        flags.append("gap-before" if (i - 1) in gap_after else ("drive" if d > 0 else "hold"))

    tf = basemap_transform(pts[0], pts[-1])
    kept = simplify(pts, SIMPLIFY_EPSILON_M)
    downloaded = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    traverse = {
        "missionId": "opportunity",
        "sourceId": "SRC-TRAVERSE",
        "coordinateFrame": "local easting/northing from landing site (CORRECTED_X/Y; frame per source web page)",
        "coordinateUnits": "m (inferred; not stated in LBL)",
        "quality": "corrected",
        "dataCoverage": {"firstSol": pts[0]["startSol"], "lastRecordEndSol": max(p["endSol"] for p in pts), "lastContactSol": LAST_CONTACT_SOL},
        "totalKmApprox": round(cum[-1] / 1000, 3),
        "basemapTransform": tf,
        "gapRule": {"maxUncoveredSols": MAX_UNCOVERED_SOLS, "gapJumpMinMeters": GAP_JUMP_MIN_METERS},
        "gaps": gaps,
        "flagCodes": FLAG_CODES,
        "pointFields": ["site", "drive", "startSol", "endSol", "eastingMeters", "northingMeters", "rawX", "rawY", "segmentFlag", "sourceRow", "cumulativeKm"],
        "points": [
            [p["site"], p["drive"], p["startSol"], p["endSol"], round(p["x"], 2), round(p["y"], 2),
             round(p["rawX"], 2), round(p["rawY"], 2), FLAG_CODES[f], p["sourceRow"], round(c / 1000, 4)]
            for p, f, c in zip(pts, flags, cum)
        ],
    }
    route = {
        "purpose": "drawing only; position lookup uses traverse.json",
        "epsilonMeters": SIMPLIFY_EPSILON_M,
        "pointFields": ["pointIndex", "eastingMeters", "northingMeters"],
        "points": [[k, round(pts[k]["x"], 2), round(pts[k]["y"], 2)] for k in kept],
    }
    manifest = {
        "dataset": "Opportunity traverse table MERB_traverse_5130",
        "institution": "MER Analyst's Notebook, PDS Geosciences Node (Washington University in St. Louis); traverse by Tim Parker",
        "sourcePage": SOURCE_PAGE,
        "files": [
            {"url": SOURCE_URL_CSV, "path": "data/raw/MERB_traverse_5130.csv", "sha256": sha256(RAW_CSV), "bytes": RAW_CSV.stat().st_size},
            {"url": SOURCE_URL_LBL, "path": "data/raw/MERB_traverse_5130.lbl", "sha256": sha256(RAW_LBL), "bytes": RAW_LBL.stat().st_size},
        ],
        "processedOn": downloaded,
        "caveat": "Not a formally archived PDS product (per LBL: DATA_SET_ID = N/A).",
        "units": "m (inferred, not stated in LBL)",
        "rawRows": len(rows),
        "duplicateRowsDropped": len(dropped),
        "duplicateSourceRows": dropped,
        "zeroMoveSteps": sum(1 for i in range(1, len(rows)) if step(rows[i - 1], rows[i]) == 0),
        "rawZAllZero": all(r["rawZ"] == 0 for r in rows),
        "startSolDecreases": [r["sourceRow"] for a, r in zip(rows, rows[1:]) if r["startSol"] < a["startSol"]],
        "coverage": traverse["dataCoverage"],
        "gaps": gaps,
        "simplifiedPoints": len(kept),
    }
    return {"traverse": traverse, "route": route, "manifest": manifest, "rows": rows, "pts": pts}


def main() -> None:
    out = build()
    OUT.mkdir(parents=True, exist_ok=True)
    for name, key in (("traverse.json", "traverse"), ("route_simplified.json", "route"), ("data_manifest.json", "manifest")):
        (OUT / name).write_text(json.dumps(out[key], separators=(",", ":"), ensure_ascii=False), encoding="utf-8")
    t, m = out["traverse"], out["manifest"]
    print(f"points {len(t['points'])} (raw {m['rawRows']}, dropped {m['duplicateRowsDropped']}), "
          f"{t['totalKmApprox']} km, gaps {len(t['gaps'])}, simplified {m['simplifiedPoints']}, "
          f"fit {t['basemapTransform']['metersPerPixel']} m/px {t['basemapTransform']['rotationDeg']:+} deg")


if __name__ == "__main__":
    main()
