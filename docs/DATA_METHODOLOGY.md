# Data methodology

How Opportunity's route, map and facts become what the site shows. Every number here is checked by a test or a script
named next to it.

## 1. Source data

| | |
|---|---|
| Dataset | MER Opportunity traverse table `MERB_traverse_5130` (CSV + PDS3 label) |
| Publisher | MER Analyst's Notebook, PDS Geosciences Node, Washington University in St. Louis; traverse by Tim Parker |
| Page | https://an.rsl.wustl.edu/mera/AN/pages/mer/mer_traverse.htm |
| CSV SHA-256 | `bd0a50b39c62f021ce609170f72c00229ef9dd15459bf48fa5bb5f5c45ba553b` (1,463,086 bytes) |
| LBL SHA-256 | `e5aa91bcd6f89c9a48d39cdb3c410db2120c6a1bb3617f752fa65f9ffaa6df0e` (6,140 bytes) |
| Caveat | Not a formally archived PDS product (label: `DATA_SET_ID = N/A`) |

The raw files are kept byte for byte in `data/raw/` (`.gitattributes -text`). `public/data/data_manifest.json`
records the hashes and every processing decision.

## 2. ETL (`scripts/transform_traverse.py`, tests in `tests/test_transform.py`)

- 21,104 rows, 9 fields, matching the label. `RAW_Z` is 0 in every row: there is no elevation, so the ground is flat.
- Coordinates: `CORRECTED_X/Y`, local easting/northing from the landing site, in metres (unit inferred, not stated).
- Source row order is kept; `END_SOL` is the time key and never decreases.
- 15 rows are exact duplicates of another row and are dropped from the output only (their row numbers are in the
  manifest). **21,089 position records** remain.
- No interpolation across gaps, no latitude/longitude conversion, no invented positions.
- Total of straight lines between records: **45.105 km**. NASA's final traverse map (PIA23178) gives 45.16 km.
- A simplified copy (Douglas–Peucker, ε = 1.5 m, 1,340 points) is used only to draw; positions are looked up in the
  full table.

## 3. Gaps

A gap is more than 5 sols with no record (a project setting, not a NASA rule). Six were found:

| Sols with no record | Moved during the gap | On the stage |
|---|---|---|
| 215–219 | 0.46 m | rover waits |
| 640–754 | 181.3 m | dashed line |
| 1,367–1,381 | 0.01 m | rover waits |
| 2,907–2,914 | 0 m | rover waits |
| 3,503–3,509 | 19.09 m | dashed line |
| 4,249–4,261 | 1.71 m | rover waits |

`tests/about.test.ts` checks that the table on `/about` matches `public/data/traverse.json`.

## 4. Replay model (`src/engine/replay.ts`, 13 tests in `tests/replay.test.ts`)

Hold-then-move: the table gives a position per drive, not per moment. At a given sol the rover waits at the last
record, then moves to the next. Records that share a sol split that sol evenly. Inside a gap the rover waits and then
appears at the next record (labelled "No position records"); it is never animated through a gap. Positions between two
records are labelled "Between two records". After sol 5081 (the last record) the rover stays put until sol 5111, the
last message, and the readout says "No traverse records after sol 5081". Every position carries one of three labels:
recorded, between two records, no records.

## 5. Map alignment

The ground is NASA's PIA23178 (2667 × 2058 px). The route is pinned at two points, its first record (Eagle crater,
pixel 393, 98) and its last (Perseverance Valley, pixel 972, 1388): a similarity fit of 17.67 m per pixel, rotated
0.59°. Elsewhere the route can sit up to about 0.5 km from where NASA drew it; this is printed on screen. For the 3D
ground, NASA's yellow route line, labels and scale bar were painted out (`scripts/clean_basemap.mjs`) so the two routes
do not double up; NASA's original map is shown unaltered on the evidence print.

## 6. Facts, quotes and images

- Every fact is stored with source IDs in `src/content/*.json` (events, FAQ, parts, legacy, media, sources).
- `scripts/lint_content.mjs` fails if a source, image or rover part does not exist, if a card is outside its word
  range, or if a banned phrase appears ("drinkable", "proved life", "life was found", "measured position").
- `scripts/check_sources.mjs` re-opens every source and image page (with a real browser where a site blocks scripts).
  All 31 sources were last checked on 14 Nov 2026.
- Where NASA does not state a value (for example the exact sol Opportunity left Purgatory dune), the site says it is
  derived and from what.

## 7. What is illustrative

The night sky and star trails (the rover drove by day), the glowing trail, the rover's size on the map (not to
scale), the flat ground, the dust storm at the Silence stop, the lighting on the rover, and one line written as
"I, Opportunity" (labelled *narrative dramatization*). Each is labelled where it appears.
