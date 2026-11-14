// Illustrative night sky: a graded dome and star arcs that turn slowly around a pole.
// The rover drove by day; this sky is the exposure's frame, not an observation.
import * as THREE from 'three'
import { PALETTE } from './world'

const R = 800 // km; the sky follows the camera so it reads as "at infinity"

const domeVert = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = normalize(position);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`
const domeFrag = /* glsl */ `
uniform vec3 zenith; uniform vec3 mid; uniform vec3 horizon; uniform vec3 warm; uniform vec3 below;
varying vec3 vDir;
void main() {
  float h = clamp(vDir.y, -1.0, 1.0);
  vec3 c = mix(mid, zenith, smoothstep(0.08, 0.55, h));
  c = mix(horizon, c, smoothstep(0.0, 0.1, h));
  c = mix(c, warm, (1.0 - smoothstep(0.0, 0.035, abs(h - 0.006))) * 0.7);
  c = mix(below, c, smoothstep(-0.02, 0.0, h));
  gl_FragColor = vec4(max(c, vec3(0.0)), 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`

export interface Sky {
  group: THREE.Group
  setArcCount(n: number): void
  update(camera: THREE.Camera, angle: number): void
  /** illustrative dust: stars fade (they keep turning), the low sky goes brown. 0 = clear */
  setHaze(amount: number): void
  dispose(): void
}

function mulberry32(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function createSky(maxArcs = 700): Sky {
  const group = new THREE.Group()

  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(R * 1.05, 48, 24),
    new THREE.ShaderMaterial({
      vertexShader: domeVert, fragmentShader: domeFrag, side: THREE.BackSide, depthWrite: false, depthTest: false, fog: false,
      uniforms: {
        zenith: { value: PALETTE.night.clone() },
        mid: { value: new THREE.Color('#141d3a') },
        horizon: { value: new THREE.Color('#2a2f4f') },
        warm: { value: new THREE.Color('#3a2c2c') },
        below: { value: new THREE.Color('#120c0b') },
      },
    }),
  )
  dome.renderOrder = -10
  group.add(dome)

  // star arcs around a pole tilted towards the south-east, high in the sky
  const pole = new THREE.Vector3(0.45, 0.62, 0.64).normalize()
  const SEG = 16, SWEEP = THREE.MathUtils.degToRad(24)
  const rnd = mulberry32(5111)
  const pos = new Float32Array(maxArcs * SEG * 2 * 3)
  const col = new Float32Array(maxArcs * SEG * 2 * 3)
  const basis = new THREE.Matrix4().lookAt(new THREE.Vector3(), pole, new THREE.Vector3(0, 1, 0).cross(pole).lengthSq() > 0 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0))
  const v = new THREE.Vector3()
  for (let a = 0; a < maxArcs; a++) {
    const theta = THREE.MathUtils.degToRad(2 + 86 * Math.sqrt(rnd())) // angular distance from the pole
    const phi0 = rnd() * Math.PI * 2
    const b = 0.18 + 0.55 * rnd() ** 2.2
    for (let s = 0; s < SEG; s++) {
      for (let e = 0; e < 2; e++) {
        const phi = phi0 + SWEEP * ((s + e) / SEG)
        v.set(Math.sin(theta) * Math.cos(phi), Math.sin(theta) * Math.sin(phi), -Math.cos(theta)).applyMatrix4(basis).multiplyScalar(R)
        const o = ((a * SEG + s) * 2 + e) * 3
        pos.set([v.x, v.y, v.z], o)
        // fade both ends a little, like a real trail starting and stopping
        const k = b * (0.75 + 0.25 * Math.sin(Math.PI * (s + e) / SEG))
        col.set([PALETTE.star.r * k, PALETTE.star.g * k, PALETTE.star.b * k], o)
      }
    }
  }
  const arcGeo = new THREE.BufferGeometry()
  arcGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  arcGeo.setAttribute('color', new THREE.BufferAttribute(col, 3))
  const arcMat = new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, toneMapped: false })
  const arcs = new THREE.LineSegments(arcGeo, arcMat)
  arcs.renderOrder = -9
  arcs.frustumCulled = false
  const spin = new THREE.Group()
  spin.add(arcs)
  group.add(spin)

  const q = new THREE.Quaternion()
  const u = (dome.material as THREE.ShaderMaterial).uniforms
  const base = { mid: u.mid.value.clone(), horizon: u.horizon.value.clone(), zenith: u.zenith.value.clone() }
  const dusty = { mid: new THREE.Color('#3b2e27'), horizon: new THREE.Color('#5a4434'), zenith: new THREE.Color('#1c1a20') }
  let haze = -1
  return {
    group,
    setArcCount(n) { arcGeo.setDrawRange(0, Math.min(maxArcs, n) * SEG * 2) },
    setHaze(a) {
      if (Math.abs(a - haze) < 1e-3) return
      haze = a
      arcMat.opacity = 1 - 0.75 * a
      u.mid.value.lerpColors(base.mid, dusty.mid, a)
      u.horizon.value.lerpColors(base.horizon, dusty.horizon, a)
      u.zenith.value.lerpColors(base.zenith, dusty.zenith, a)
    },
    update(camera, angle) {
      group.position.copy(camera.position)
      spin.quaternion.copy(q.setFromAxisAngle(pole, angle))
    },
    dispose() {
      dome.geometry.dispose(); (dome.material as THREE.Material).dispose()
      arcGeo.dispose(); arcMat.dispose()
    },
  }
}
