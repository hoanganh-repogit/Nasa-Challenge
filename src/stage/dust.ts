// Silence (stop 7): an illustrative dust storm. Soft drifting motes around the rover, a brown haze in the
// fog, and the rover's lights dimmed. It is a picture of what happened (dust blocked the Sun), not data.
import * as THREE from 'three'

const COUNT = 1600
const BOX = new THREE.Vector3(3.2, 0.42, 3.2) // km: wide and low, centred on the rover

const vert = /* glsl */ `
#include <common>
#include <logdepthbuf_pars_vertex>
uniform float uTime;
uniform float uSize;
uniform vec3 uBox;
uniform vec3 uCenter;
attribute float seed;
varying float vFade;
void main() {
  // drift with the wind (from the north-east), wrapped inside the box around the rover
  vec3 p = position + vec3(-0.055, 0.004 * sin(uTime * 0.6 + seed * 6.3), 0.035) * uTime * (0.6 + seed);
  p = mod(p + uBox * 0.5, uBox) - uBox * 0.5;
  // thin out towards the box edges so it has no visible border
  vec3 q = abs(p) / (uBox * 0.5);
  vFade = (1.0 - smoothstep(0.6, 1.0, max(q.x, q.z))) * (1.0 - smoothstep(0.5, 1.0, q.y));
  vec4 mv = modelViewMatrix * vec4(p + uCenter, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = uSize * (0.5 + seed) / max(0.05, -mv.z);
  #include <logdepthbuf_vertex>
}`

const frag = /* glsl */ `
#include <common>
#include <logdepthbuf_pars_fragment>
uniform vec3 uColor;
uniform float uOpacity;
varying float vFade;
void main() {
  #include <logdepthbuf_fragment>
  float r = length(gl_PointCoord - 0.5);
  float a = smoothstep(0.5, 0.0, r) * uOpacity * vFade;
  if (a < 0.003) discard;
  gl_FragColor = vec4(uColor, a);
  #include <colorspace_fragment>
}`

export interface Dust {
  points: THREE.Points
  /** amount 0..1, rover position (scene km), clock in seconds, pixel ratio */
  update(amount: number, x: number, z: number, t: number, dpr: number): void
  /** fog colour for this amount of dust */
  fogColor(base: THREE.Color, amount: number, out: THREE.Color): THREE.Color
  dispose(): void
}

export function createDust(): Dust {
  const pos = new Float32Array(COUNT * 3)
  const seed = new Float32Array(COUNT)
  // fixed pseudo-random layout, the same on every load
  let s = 7
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647)
  for (let i = 0; i < COUNT; i++) {
    pos[i * 3] = (rnd() - 0.5) * BOX.x
    pos[i * 3 + 1] = rnd() * rnd() * BOX.y // denser near the ground
    pos[i * 3 + 2] = (rnd() - 0.5) * BOX.z
    seed[i] = rnd()
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  geo.setAttribute('seed', new THREE.BufferAttribute(seed, 1))
  const mat = new THREE.ShaderMaterial({
    vertexShader: vert, fragmentShader: frag, transparent: true, depthWrite: false,
    uniforms: {
      uTime: { value: 0 }, uSize: { value: 26 }, uBox: { value: BOX }, uCenter: { value: new THREE.Vector3() },
      uColor: { value: new THREE.Color(0xb48d6a) }, uOpacity: { value: 0 },
    },
  })
  const points = new THREE.Points(geo, mat)
  points.frustumCulled = false
  points.renderOrder = 5
  const haze = new THREE.Color(0x5a4636)

  return {
    points,
    update(amount, x, z, t, dpr) {
      points.visible = amount > 0.002
      mat.uniforms.uOpacity.value = 0.42 * amount
      mat.uniforms.uTime.value = t
      mat.uniforms.uSize.value = 26 * dpr
      ;(mat.uniforms.uCenter.value as THREE.Vector3).set(x, 0, z)
    },
    fogColor(base, amount, out) { return out.copy(base).lerp(haze, amount) },
    dispose() { geo.dispose(); mat.dispose() },
  }
}
