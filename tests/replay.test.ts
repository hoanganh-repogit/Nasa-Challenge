// Replay unit tests (spec v1.1 section 15.2) against the real traverse.json.
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import type { TraverseFile } from '../src/data/types'
import { createReplay, NO_RECORDS_NOTE, solForProgress } from '../src/engine/replay'

const traverse: TraverseFile = JSON.parse(readFileSync(new URL('../public/data/traverse.json', import.meta.url), 'utf8'))
const r = createReplay(traverse)
const last = r.count - 1

describe('replay engine', () => {
  it('clamps seeks before the first and after the last sol', () => {
    const before = r.positionAt(-50)
    expect(before.sol).toBe(1)
    expect([before.x, before.y]).toEqual([0, 0])
    const after = r.positionAt(99999)
    expect(after.sol).toBe(5111)
    expect(after.recordIndex).toBe(last)
    expect(r.positionAt(Number.NaN).sol).toBe(1)
  })

  it('never divides by zero when records share a sol', () => {
    for (let s = 1; s <= 5111; s += 0.37) {
      const f = r.positionAt(s)
      expect(Number.isFinite(f.x) && Number.isFinite(f.y) && Number.isFinite(f.km)).toBe(true)
    }
  })

  it('holds before the big gap at sol 700 and labels it gap, without interpolating', () => {
    const f = r.positionAt(700)
    const g = traverse.gaps.find((x) => x.afterEndSol === 639)!
    expect(f.provenance).toBe('gap')
    expect(f.recordIndex).toBe(g.afterPointIndex)
    expect(f.alpha).toBe(0)
    expect(f.x).toBe(r.xs[g.afterPointIndex])
  })

  it('jumps across a dashed gap only once the next record starts', () => {
    const g = traverse.gaps.find((x) => x.afterEndSol === 639)!
    expect(r.positionAt(754.99).recordIndex).toBe(g.afterPointIndex)
    const jumped = r.positionAt(755)
    expect(jumped.recordIndex).toBeGreaterThan(g.afterPointIndex)
  })

  it('holds at the last record from sol 5082 to 5111 with a note', () => {
    const f = r.positionAt(5100)
    expect(f.recordIndex).toBe(last)
    expect(f.provenance).toBe('corrected')
    expect(f.note).toBe(NO_RECORDS_NOTE)
    expect([f.x, f.y]).toEqual([r.xs[last], r.ys[last]])
  })

  it('holds exactly at P_i between END_SOL_i and START_SOL_{i+1}', () => {
    let checked = 0
    for (let i = 1; i < r.count - 1 && checked < 300; i++) {
      // Usually START_SOL_{i+1} == END_SOL_i, so the hold is the sols after the drive window up to END_SOL_i.
      if (r.endSols[i] - r.startSols[i] >= 2 && r.startSols[i + 1] >= r.endSols[i]) {
        const mid = r.positionAt(r.endSols[i] - 0.25)
        expect(mid.recordIndex).toBe(i)
        expect(mid.provenance).not.toBe('interpolated')
        expect([mid.x, mid.y]).toEqual([r.xs[i], r.ys[i]])
        const atEnd = r.positionAt(r.endSols[i])
        expect([atEnd.x, atEnd.y]).toEqual([r.xs[i], r.ys[i]])
        checked++
      }
    }
    expect(checked).toBe(300)
  })

  it('passes through every sol-410 record in source order', () => {
    const idx = [...r.startSols.keys()].filter((i) => r.startSols[i] === 410)
    expect(idx.length).toBe(58)
    const seen = new Set<number>()
    let prev = -1
    for (let s = 410; s < 411.001; s += 1 / 2000) {
      const k = r.positionAt(s).recordIndex
      expect(k).toBeGreaterThanOrEqual(prev)
      prev = k
      seen.add(k)
    }
    for (const i of idx) expect(seen.has(i)).toBe(true)
  })

  it('keeps the rover still for events after last contact (2019)', () => {
    const a = r.positionAt(5111)
    const b = r.positionAt(5111 + 250)
    expect([b.x, b.y, b.recordIndex]).toEqual([a.x, a.y, a.recordIndex])
  })

  it('a paused sol gives the same position on every frame', () => {
    const a = r.positionAt(1234.5), b = r.positionAt(1234.5)
    expect(b).toEqual(a)
  })

  it('always reports provenance', () => {
    const kinds = new Set<string>()
    for (let s = 1; s <= 5111; s += 0.13) kinds.add(r.positionAt(s).provenance)
    expect([...kinds].sort()).toEqual(['corrected', 'gap', 'interpolated'])
  })

  it('distance is monotone and ends near 45.1 km', () => {
    let prev = 0
    for (let s = 1; s <= 5111; s += 0.5) {
      const km = r.positionAt(s).km
      expect(km).toBeGreaterThanOrEqual(prev - 1e-9)
      prev = km
    }
    expect(prev).toBeCloseTo(45.105, 2)
  })
})

describe('time scale', () => {
  it('chronological is linear in sol', () => {
    expect(solForProgress(0.5, 'chronological', 1, 5111)).toBe(2556)
  })
  it('compressed passes through each checkpoint and stays monotone', () => {
    const cps = [37, 446, 951, 2680]
    expect(solForProgress(0, 'compressed', 1, 5111, cps)).toBe(1)
    expect(solForProgress(1, 'compressed', 1, 5111, cps)).toBe(5111)
    expect(solForProgress(2 / 5, 'compressed', 1, 5111, cps)).toBeCloseTo(446, 6)
    let prev = 0
    for (let u = 0; u <= 1; u += 0.001) {
      const s = solForProgress(u, 'compressed', 1, 5111, cps)
      expect(s).toBeGreaterThanOrEqual(prev)
      prev = s
    }
  })
})
