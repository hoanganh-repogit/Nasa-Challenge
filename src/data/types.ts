// Shapes of the files written by scripts/transform_traverse.py (public/data/*.json).

export type GapRender = 'hold' | 'dashed'

export interface TraverseGap {
  afterPointIndex: number
  afterEndSol: number
  nextStartSol: number
  fromSol: number
  toSol: number
  jumpMeters: number
  render: GapRender
}

export interface BasemapTransform {
  imageWidth: number
  imageHeight: number
  metersPerPixel: number
  rotationDeg: number
  /** px = a*x + b*y + c ; py = d*x + e*y + f  (x, y in metres; py grows downward) */
  matrix: { a: number; b: number; c: number; d: number; e: number; f: number }
  caveat: string
}

export interface TraverseFile {
  missionId: string
  sourceId: string
  dataCoverage: { firstSol: number; lastRecordEndSol: number; lastContactSol: number }
  totalKmApprox: number
  basemapTransform: BasemapTransform
  gapRule: { maxUncoveredSols: number; gapJumpMinMeters: number }
  gaps: TraverseGap[]
  flagCodes: { hold: number; drive: number; 'gap-before': number }
  pointFields: string[]
  points: number[][]
}

export interface RouteFile {
  epsilonMeters: number
  pointFields: string[]
  /** [pointIndex, eastingMeters, northingMeters] */
  points: [number, number, number][]
}

export interface MediaItem {
  id: string
  pia: string
  src: string
  originalUrl: string
  title: string
  credit: string
  capturedAt: string | null
  publishedAt: string
  colour: string | null
  notes: string
  alt: string
  sourceIds: string[]
}
