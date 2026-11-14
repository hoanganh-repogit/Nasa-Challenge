"""Data-quality tests DQ-01..DQ-11 (spec v1.1 section 15.1) plus the Purgatory figures.
Expected values come from research/DATA_REPORT_MERB_traverse.md (analysis of 01/11/2026).
Run: python -P -m pytest -q
"""
import math
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
import transform_traverse as T  # noqa: E402

CSV_SHA = "bd0a50b39c62f021ce609170f72c00229ef9dd15459bf48fa5bb5f5c45ba553b"
LBL_SHA = "e5aa91bcd6f89c9a48d39cdb3c410db2120c6a1bb3617f752fa65f9ffaa6df0e"


@pytest.fixture(scope="module")
def out():
    return T.build()


def test_dq01_schema_and_rows(out):
    header = T.RAW_CSV.read_text().splitlines()[0].split(",")
    assert header == ["SITE", "DRIVE", "START_SOL", "END_SOL", "RAW_X", "RAW_Y", "RAW_Z", "CORRECTED_X", "CORRECTED_Y"]
    assert len(out["rows"]) == 21104
    assert "ROWS" in T.RAW_LBL.read_text() and "21104" in T.RAW_LBL.read_text()


def test_dq02_sols(out):
    rows = out["rows"]
    assert all(r["startSol"] >= 1 and r["endSol"] >= 1 for r in rows)
    assert all(b["endSol"] >= a["endSol"] for a, b in zip(rows, rows[1:]))
    assert len(out["manifest"]["startSolDecreases"]) == 1


def test_dq03_coordinates(out):
    pts = out["pts"]
    assert all(math.isfinite(p["x"]) and math.isfinite(p["y"]) for p in pts)
    assert (pts[0]["x"], pts[0]["y"]) == (0.0, 0.0)
    assert pts[-1]["x"] == pytest.approx(10464.5, abs=0.1)
    assert pts[-1]["y"] == pytest.approx(-22687.6, abs=0.1)


def test_dq04_duplicates_and_holds(out):
    m = out["manifest"]
    assert m["duplicateRowsDropped"] == 15
    assert m["zeroMoveSteps"] == 1050
    assert m["rawZAllZero"] is True
    assert len(out["traverse"]["points"]) == 21104 - 15


def test_dq05_source_attribution(out):
    assert out["traverse"]["sourceId"] == "SRC-TRAVERSE"
    assert "not a formally archived pds product" in out["manifest"]["caveat"].lower()


def test_dq06_coverage(out):
    c = out["traverse"]["dataCoverage"]
    assert c == {"firstSol": 1, "lastRecordEndSol": 5081, "lastContactSol": 5111}


def test_dq08_basemap_fit(out):
    tf = out["traverse"]["basemapTransform"]
    assert tf["metersPerPixel"] == pytest.approx(17.67, abs=0.05)
    assert tf["rotationDeg"] == pytest.approx(0.59, abs=0.05)
    m, p0, p1 = tf["matrix"], out["pts"][0], out["pts"][-1]
    apply = lambda p: (m["a"] * p["x"] + m["b"] * p["y"] + m["c"], m["d"] * p["x"] + m["e"] * p["y"] + m["f"])
    assert apply(p0) == pytest.approx(T.BASEMAP["eaglePx"], abs=1e-6)
    assert apply(p1) == pytest.approx(T.BASEMAP["perseverancePx"], abs=1e-6)


def test_dq09_total_distance(out):
    km = out["traverse"]["totalKmApprox"]
    assert km == pytest.approx(45.105, abs=0.01)
    assert abs(km - 45.16) / 45.16 < 0.01


def test_dq10_gaps(out):
    gaps = out["traverse"]["gaps"]
    assert [(g["afterEndSol"], g["nextStartSol"]) for g in gaps] == [
        (214, 220), (639, 755), (1366, 1382), (2906, 2915), (3502, 3510), (4248, 4262)]
    big = gaps[1]
    assert big["jumpMeters"] == pytest.approx(181.3, abs=0.1) and big["render"] == "dashed"
    assert [g["render"] for g in gaps] == ["hold", "dashed", "hold", "hold", "dashed", "hold"]


def test_dq11_hashes(out):
    files = {f["path"]: f["sha256"] for f in out["manifest"]["files"]}
    assert files["data/raw/MERB_traverse_5130.csv"] == CSV_SHA
    assert files["data/raw/MERB_traverse_5130.lbl"] == LBL_SHA


def test_purgatory(out):
    sub = [r for r in out["rows"] if 447 <= r["startSol"] <= 484]
    assert len(sub) == 326
    net = math.hypot(sub[-1]["x"] - sub[0]["x"], sub[-1]["y"] - sub[0]["y"])
    assert net == pytest.approx(1.6, abs=0.05)


def test_segment_flags(out):
    t = out["traverse"]
    i_flag = t["pointFields"].index("segmentFlag")
    codes = [p[i_flag] for p in t["points"]]
    assert codes.count(T.FLAG_CODES["gap-before"]) == 6


def test_simplified_route_keeps_ends(out):
    pts = out["route"]["points"]
    assert pts[0][0] == 0 and pts[-1][0] == len(out["pts"]) - 1
    assert len(pts) < len(out["pts"]) / 2
