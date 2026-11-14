// The light trail: the real route drawn as a long exposure.
// - travelled part: tungsten, HDR (picked up by bloom); not-yet-travelled part: faint.
// - every position record is one faint point of light, added up: where the rover sat for many
//   records (e.g. Purgatory dune, 326 records within ~1.6 m) the exposure builds a brighter spot.
// - data gaps >= 5 m are dashed and drawn only once reached; nothing is interpolated across them.
import * as THREE from 'three'
import { Line2 } from 'three/addons/lines/Line2.js'
import { LineGeometry } from 'three/addons/lines/LineGeometry.js'
import { LineMaterial } from 'three/addons/lines/LineMaterial.js'
import type { RouteFile, TraverseFile } from '../data/types'
import type { Replay, RoverFix } from '../engine/replay'
import { KM, PALETTE } from './world'

const LIFT = 0.0015 // 1.5 m above the flat plane

interface Run { idx: number[]; line: Line2; geo: LineGeometry }

export interface Trail {
  group: THREE.Group
  update(fix: RoverFix): void
  setResolution(w: number, h: number): void
  setIntensity(v: number): void
  dispose(): void
}

const upperBound = (a: number[], v: number) => {
  let lo = 0, hi = a.length
  while (lo < hi) { const m = (lo + hi) >> 1; if (a[m] <= v) lo = m + 1; else hi = m }
  return lo
}

export function createTrail(traverse: TraverseFile, route: RouteFile, replay: Replay): Trail {
  const { xs, ys } = replay
  const P = (i: number) => [xs[i] * KM, LIFT, -ys[i] * KM]
  const dashed = traverse.gaps.filter((g) => g.render === 'dashed')

  // drawn vertices = simplified route + both ends of every dashed gap, split into runs at those gaps
  const all = new Set(route.points.map((p) => p[0]))
  for (const g of dashed) { all.add(g.afterPointIndex); all.add(g.afterPointIndex + 1) }
  const sorted = [...all].sort((a, b) => a - b)
  const cuts = dashed.map((g) => g.afterPointIndex)
  const runsIdx: number[][] = [[]]
  for (const i of sorted) {
    runsIdx[runsIdx.length - 1].push(i)
    if (cuts.includes(i)) runsIdx.push([])
  }

  const group = new THREE.Group()
  const hot = PALETTE.tungsten.clone().multiplyScalar(2.4)
  const travelledMat = new LineMaterial({ color: hot, linewidth: 2.4, worldUnits: false, toneMapped: false })
  const futureMat = new LineMaterial({ color: PALETTE.star, linewidth: 1, transparent: true, opacity: 0.14, depthWrite: false })
  const gapMat = new LineMaterial({ color: PALETTE.tungsten, linewidth: 1.6, dashed: true, dashSize: 0.012, gapSize: 0.01, transparent: true, opacity: 0.9, toneMapped: false })
  const mats = [travelledMat, futureMat, gapMat]

  const geos: THREE.BufferGeometry[] = []
  const runs: Run[] = runsIdx.filter((r) => r.length > 1).map((idx) => {
    const flat = idx.flatMap(P)
    const future = new LineGeometry(); future.setPositions(flat); geos.push(future)
    group.add(new Line2(future, futureMat))
    const geo = new LineGeometry(); geo.setPositions(flat); geos.push(geo)
    const line = new Line2(geo, travelledMat)
    line.frustumCulled = false
    group.add(line)
    return { idx, line, geo }
  })

  const gapLines = dashed.map((g) => {
    const geo = new LineGeometry(); geo.setPositions([...P(g.afterPointIndex), ...P(g.afterPointIndex + 1)]); geos.push(geo)
    const line = new Line2(geo, gapMat); line.computeLineDistances(); line.visible = false
    group.add(line)
    return { after: g.afterPointIndex, line }
  })

  // head: last drawn vertex -> current position (updated every frame, 2 points)
  const headGeo = new LineGeometry(); headGeo.setPositions([0, 0, 0, 0, 0, 0]); geos.push(headGeo)
  const head = new Line2(headGeo, travelledMat); head.frustumCulled = false
  group.add(head)

  // one point of light per record
  const pts = new Float32Array(replay.count * 3)
  for (let i = 0; i < replay.count; i++) pts.set(P(i), i * 3)
  const ptsGeo = new THREE.BufferGeometry(); geos.push(ptsGeo)
  ptsGeo.setAttribute('position', new THREE.BufferAttribute(pts, 3))
  const ptsMat = new THREE.PointsMaterial({
    color: PALETTE.tungsten.clone().multiplyScalar(0.5), size: 1.6, sizeAttenuation: false,
    transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
  })
  const points = new THREE.Points(ptsGeo, ptsMat)
  points.frustumCulled = false
  group.add(points)

  const headPos = new Float32Array(6)
  function update(fix: RoverFix) {
    const r = fix.recordIndex
    let lastRun: Run | null = null, lastK = 0
    for (const run of runs) {
      const k = upperBound(run.idx, r) // vertices reached in this run
      run.geo.instanceCount = Math.max(0, k - 1)
      run.line.visible = k > 1
      if (k > 0) { lastRun = run; lastK = k }
    }
    for (const g of gapLines) g.line.visible = r > g.after
    ptsGeo.setDrawRange(0, r + 1)
    if (lastRun) {
      const from = P(lastRun.idx[lastK - 1])
      headPos.set(from, 0)
      headPos.set([fix.x * KM, LIFT, -fix.y * KM], 3)
      const buf = (headGeo.attributes.instanceStart as THREE.InterleavedBufferAttribute).data
      ;(buf.array as Float32Array).set(headPos)
      buf.needsUpdate = true
      head.visible = true
    } else head.visible = false
  }

  return {
    group, update,
    setResolution(w, h) { for (const m of mats) m.resolution.set(w, h) },
    setIntensity(v) { travelledMat.color.copy(PALETTE.tungsten).multiplyScalar(2.4 * v) },
    dispose() { geos.forEach((g) => g.dispose()); mats.forEach((m) => m.dispose()); ptsMat.dispose() },
  }
}
