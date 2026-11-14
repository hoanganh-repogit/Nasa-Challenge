// World frame for the stage. 1 scene unit = 1 km.
// x = easting, z = -northing (three.js is y-up, right-handed), y = up.
import * as THREE from 'three'

export const KM = 0.001

export const toScene = (eastingM: number, northingM: number, y = 0, out = new THREE.Vector3()) =>
  out.set(eastingM * KM, y, -northingM * KM)

export { metersToPixel, pixelToMeters } from '../engine/basemap'

export const PALETTE = {
  night: new THREE.Color('#0b1020'),
  dusk: new THREE.Color('#1f2a4d'),
  ground: new THREE.Color('#5a3a2a'),
  tungsten: new THREE.Color('#f2a65a'),
  star: new THREE.Color('#eef1f6'),
}
