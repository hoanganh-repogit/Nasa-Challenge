// The night ground: PIA23178 (NASA/JPL-Caltech/MSSS) laid flat under the route with the 2-point fit,
// darkened to a night exposure, edges fading into a plain dark plain. It is a flat plane, not terrain.
import * as THREE from 'three'
import type { BasemapTransform } from '../data/types'
import { pixelToMeters } from '../engine/basemap'
import { PALETTE, toScene } from './world'

const vert = /* glsl */ `
#include <common>
#include <fog_pars_vertex>
#include <logdepthbuf_pars_vertex>
varying vec2 vUv;
void main() {
  vUv = uv;
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mvPosition;
  #include <logdepthbuf_vertex>
  #include <fog_vertex>
}`

const frag = /* glsl */ `
#include <common>
#include <fog_pars_fragment>
#include <logdepthbuf_pars_fragment>
uniform sampler2D map;
uniform vec3 tint;
uniform vec3 base;
uniform float exposure;
varying vec2 vUv;
void main() {
  #include <logdepthbuf_fragment>
  vec3 img = texture2D(map, vUv).rgb;
  float edge = smoothstep(0.0, 0.08, vUv.x) * smoothstep(1.0, 0.92, vUv.x)
             * smoothstep(0.0, 0.08, vUv.y) * smoothstep(1.0, 0.92, vUv.y);
  vec3 col = mix(base, img * tint * exposure, edge);
  gl_FragColor = vec4(max(col, vec3(0.0)), 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  #include <fog_fragment>
}`

export interface Ground {
  group: THREE.Group
  setExposure(v: number): void
  dispose(): void
}

export function createGround(tf: BasemapTransform, texture: THREE.Texture): Ground {
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 4
  const W = tf.imageWidth, H = tf.imageHeight
  const corner = (px: number, py: number) => toScene(...pixelToMeters(tf, px, py))
  // two triangles; uv v=1 is the image top (flipY)
  const tl = corner(0, 0), tr = corner(W, 0), bl = corner(0, H), br = corner(W, H)
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute([...tl.toArray(), ...bl.toArray(), ...tr.toArray(), ...br.toArray()], 3))
  geo.setAttribute('uv', new THREE.Float32BufferAttribute([0, 1, 0, 0, 1, 1, 1, 0], 2))
  geo.setIndex([0, 1, 2, 2, 1, 3])
  geo.computeVertexNormals()

  const base = PALETTE.ground.clone().multiplyScalar(0.16)
  const mat = new THREE.ShaderMaterial({
    vertexShader: vert, fragmentShader: frag, fog: true,
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {
      map: { value: null }, tint: { value: new THREE.Color(0.42, 0.33, 0.3) }, base: { value: base }, exposure: { value: 0.55 },
    }]),
  })
  mat.uniforms.map.value = texture
  const map = new THREE.Mesh(geo, mat)
  map.renderOrder = 0

  // the plain beyond the image, so the horizon has no edge
  const plain = new THREE.Mesh(
    new THREE.CircleGeometry(600, 64).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: base }),
  )
  plain.position.set((tl.x + br.x) / 2, -0.004, (tl.z + br.z) / 2)

  const group = new THREE.Group()
  group.add(plain, map)
  return {
    group,
    setExposure: (v) => { mat.uniforms.exposure.value = v },
    dispose() {
      geo.dispose(); mat.dispose(); texture.dispose()
      plain.geometry.dispose(); (plain.material as THREE.Material).dispose()
    },
  }
}
