/**
 * Replay engine: where was Opportunity at a given sol? (spec v1.1 section 8.3, "hold-then-move")
 *
 * A sol is treated as a continuous number; the day "sol n" spans [n, n + 1).
 * - Record i is the position after a drive. The drive happens during sol START_SOL_i;
 *   k records sharing one START_SOL split that sol evenly, in source row order.
 * - Between drives the rover holds still at the last record (provenance "corrected").
 * - Across a data gap (START_SOL_{i+1} - END_SOL_i > maxUncoveredSols) the rover holds at P_i,
 *   the uncovered sols are labelled "gap", and at START_SOL_{i+1} it jumps without interpolation.
 * - After the last record (sol 5081) it holds at the last record up to last contact (sol 5111).
 * Interpolation between records is linear and never overshoots; it may not match the real wheel path.
 */
import type { TraverseFile } from '../data/types'

export type Provenance = 'corrected' | 'interpolated' | 'gap'

export interface RoverFix {
  sol: number
  x: number
  y: number
  km: number
  provenance: Provenance
  /** Last record whose position has been fully reached. */
  recordIndex: number
  /** 0..1 progress from recordIndex towards recordIndex + 1 (0 unless interpolating). */
  alpha: number
  note: string | null
}

export interface Replay {
  count: number
  minSol: number
  maxSol: number
  lastRecordEndSol: number
  xs: Float64Array
  ys: Float64Array
  kms: Float64Array
  startSols: Int32Array
  endSols: Int32Array
  positionAt(sol: number): RoverFix
  /** Sol at which record i is fully reached. */
  solOfRecord(i: number): number
}

export const NO_RECORDS_NOTE = 'No traverse records after sol 5081'
export const INTERPOLATION_NOTE = 'Linear interpolation between records'
export const GAP_NOTE = 'No position records for these sols'

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

export function createReplay(t: TraverseFile): Replay {
  const F = t.pointFields
  const col = (name: string) => {
    const k = F.indexOf(name)
    if (k < 0) throw new Error(`traverse.json is missing field ${name}`)
    return k
  }
  const [iS, iE, iX, iY, iFlag, iKm] = ['startSol', 'endSol', 'eastingMeters', 'northingMeters', 'segmentFlag', 'cumulativeKm'].map(col)
  const n = t.points.length
  const xs = new Float64Array(n), ys = new Float64Array(n), kms = new Float64Array(n)
  const startSols = new Int32Array(n), endSols = new Int32Array(n)
  const gapBefore = new Uint8Array(n)
  for (let i = 0; i < n; i++) {
    const p = t.points[i]
    xs[i] = p[iX]; ys[i] = p[iY]; kms[i] = p[iKm]
    startSols[i] = p[iS]; endSols[i] = p[iE]
    gapBefore[i] = p[iFlag] === t.flagCodes['gap-before'] ? 1 : 0
  }

  // Drive windows [wS[i], wE[i]] for the move P_{i-1} -> P_i. Monotone by construction.
  const wS = new Float64Array(n), wE = new Float64Array(n)
  wS[0] = wE[0] = startSols[0]
  let i = 1
  while (i < n) {
    let j = i
    while (j + 1 < n && startSols[j + 1] === startSols[i]) j++
    const k = j - i + 1
    for (let m = 0; m < k; m++) {
      const s = Math.max(startSols[i] + m / k, wE[i + m - 1])
      wS[i + m] = s
      wE[i + m] = Math.max(s, startSols[i] + (m + 1) / k)
    }
    i = j + 1
  }

  const minSol = t.dataCoverage.firstSol
  const maxSol = t.dataCoverage.lastContactSol
  const lastRecordEndSol = t.dataCoverage.lastRecordEndSol

  /** Largest i with wS[i] <= sol (0 if none). */
  const lastStarted = (sol: number) => {
    let lo = 0, hi = n - 1
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1
      if (wS[mid] <= sol) lo = mid
      else hi = mid - 1
    }
    return lo
  }

  function positionAt(rawSol: number): RoverFix {
    const sol = clamp(Number.isFinite(rawSol) ? rawSol : minSol, minSol, maxSol)
    const i = lastStarted(sol)
    const after = sol > lastRecordEndSol ? NO_RECORDS_NOTE : null

    if (i > 0 && sol < wE[i] && !gapBefore[i]) {
      const a = clamp((sol - wS[i]) / Math.max(wE[i] - wS[i], 1e-9), 0, 1)
      return {
        sol, provenance: 'interpolated', recordIndex: i - 1, alpha: a,
        x: xs[i - 1] + (xs[i] - xs[i - 1]) * a,
        y: ys[i - 1] + (ys[i] - ys[i - 1]) * a,
        km: kms[i - 1] + (kms[i] - kms[i - 1]) * a,
        note: after ?? INTERPOLATION_NOTE,
      }
    }
    const inGap = i + 1 < n && gapBefore[i + 1] === 1 && sol >= endSols[i] + 1
    return {
      sol, provenance: inGap ? 'gap' : 'corrected', recordIndex: i, alpha: 0,
      x: xs[i], y: ys[i], km: kms[i],
      note: after ?? (inGap ? GAP_NOTE : null),
    }
  }

  return {
    count: n, minSol, maxSol, lastRecordEndSol, xs, ys, kms, startSols, endSols,
    positionAt,
    solOfRecord: (k) => wE[clamp(k, 0, n - 1)],
  }
}

/**
 * Map playback progress u in [0, 1] to a sol.
 * - chronological: linear in sol, so long holds look like holds.
 * - compressed: every leg between consecutive checkpoints gets an equal share of playback,
 *   eased so the replay slows into and out of each checkpoint. Labelled "Time compressed" in the UI.
 */
export type TimeScale = 'compressed' | 'chronological'

export function solForProgress(u: number, timeScale: TimeScale, minSol: number, maxSol: number, checkpoints: number[] = []): number {
  const p = clamp(Number.isFinite(u) ? u : 0, 0, 1)
  if (timeScale === 'chronological') return minSol + (maxSol - minSol) * p
  const knots = [minSol, ...checkpoints.filter((s) => s > minSol && s < maxSol).sort((a, b) => a - b), maxSol]
  const legs = knots.length - 1
  const f = p * legs
  const leg = Math.min(legs - 1, Math.floor(f))
  const local = f - leg
  const eased = local * local * (3 - 2 * local)
  return knots[leg] + (knots[leg + 1] - knots[leg]) * eased
}
