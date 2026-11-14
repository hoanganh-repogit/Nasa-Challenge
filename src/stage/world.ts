// World frame for the stage. 1 scene unit = 1 km.
// x = easting, z = -northing (three.js is y-up, right-handed), y = up.
import * as THREE from 'three'
import type { BasemapTransform } from '../data/types'

export const KM = 0.001

export const toScene = (eastingM: number, northingM: number, y = 0, out = new THREE.Vector3()) =>
  out.set(eastingM * KM, y, -northingM * KM)

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

export const PALETTE = {
  night: new THREE.Color('#0b1020'),
  dusk: new THREE.Color('#1f2a4d'),
  ground: new THREE.Color('#5a3a2a'),
  tungsten: new THREE.Color('#f2a65a'),
  star: new THREE.Color('#eef1f6'),
}
