import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import rec from '../src/content/reconstruction.json'

const t = JSON.parse(readFileSync(new URL('../public/data/traverse.json', import.meta.url), 'utf8'))

describe('/about numbers match the route data', () => {
  it('records, coverage, distance', () => {
    expect(rec.records).toBe(t.points.length)
    expect(rec.tableRows - rec.duplicateRowsDropped).toBe(rec.records)
    expect(rec.lastRecordSol).toBe(t.dataCoverage.lastRecordEndSol)
    expect(rec.lastContactSol).toBe(t.dataCoverage.lastContactSol)
    expect(rec.routeKm).toBe(t.totalKmApprox)
  })
  it('the six gaps and the map fit', () => {
    expect(rec.gaps).toHaveLength(6)
    rec.gaps.forEach((g, i) => {
      expect([g.fromSol, g.toSol, g.render]).toEqual([t.gaps[i].fromSol, t.gaps[i].toSol, t.gaps[i].render])
    })
    expect(rec.fit.metersPerPixel).toBeCloseTo(t.basemapTransform.metersPerPixel, 1)
    expect(rec.fit.rotationDeg).toBeCloseTo(t.basemapTransform.rotationDeg, 1)
  })
})
