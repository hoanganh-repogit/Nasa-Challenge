// 2-point basemap fit helpers (no three.js, so the static view stays light).
import type { BasemapTransform } from '../data/types'

/** Inverse of the 2-point basemap fit: image pixel -> local metres. */
export function pixelToMeters(t: BasemapTransform, px: number, py: number): [number, number] {
  const { a, b, c, d, e, f } = t.matrix
  const det = a * e - b * d
  const u = px - c, v = py - f
  return [(e * u - b * v) / det, (-d * u + a * v) / det]
}

/** Local metres -> image pixel (y down). */
export function metersToPixel(t: BasemapTransform, x: number, y: number): [number, number] {
  const { a, b, c, d, e, f } = t.matrix
  return [a * x + b * y + c, d * x + e * y + f]
}
