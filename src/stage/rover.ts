// NASA's Opportunity (MER) 3D model, lit like a night exposure: low tungsten key, cool rim.
// Two instances share geometry: a hand-lit "portrait" in its own studio scene (opening, instruments),
// and a scaled-up copy standing on the map ("Rover not to scale").
import * as THREE from 'three'
import type { GLTF } from 'three/addons/loaders/GLTFLoader.js'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'
import { KM, PALETTE } from './world'

// research/scripts/render_glb.html, preset "night"
export const NIGHT = {
  exposure: 0.95,
  hemi: [0x1b2440, 0x0b0705, 0.35] as const,
  key: [0xffb36b, 4.5, [-2.5, 1.2, 2.2]] as const,
  rim: [0x6f8fd6, 2.2, [2.5, 2.5, -3]] as const,
  envIntensity: 0.6,
}

/**
 * glTF assets face +Z. Verified on NASA's model (block E): the arm and the camera mast, both at the front
 * of the rover (NSSDCA 2003-032A), sit at +Z. yaw = PI - compass heading turns +Z towards the direction of travel.
 */
export const FORWARD_YAW = Math.PI

export type PartGroup = { name: string; meshes: THREE.Mesh[] }

function instance(gltf: GLTF) {
  const root = gltf.scene.clone(true)
  const parts = new Map<string, THREE.Mesh[]>()
  root.traverse((o) => {
    const m = o as THREE.Mesh
    if (!m.isMesh) return
    const mat = (m.material as THREE.MeshStandardMaterial).clone()
    m.material = mat
    m.castShadow = true
    m.receiveShadow = true
    const key = mat.name || 'unnamed'
    parts.set(key, [...(parts.get(key) ?? []), m])
  })
  const box = new THREE.Box3().setFromObject(root)
  const c = box.getCenter(new THREE.Vector3())
  root.position.set(-c.x, -box.min.y, -c.z)
  const holder = new THREE.Group()
  holder.add(root)
  return { holder, parts, size: box.getSize(new THREE.Vector3()) }
}

export interface Rover {
  studio: {
    scene: THREE.Scene; camera: THREE.PerspectiveCamera; size: THREE.Vector3; parts: Map<string, THREE.Mesh[]>
    /** the model, re-centred on the floor */
    root: THREE.Group
    /** light-paint spot; always in the scene (intensity 0 when idle) so the shaders never change */
    spot: THREE.SpotLight
    /** the studio's own lights, dimmed while a part is light-painted */
    lights: THREE.Light[]
  }
  world: { group: THREE.Group; parts: Map<string, THREE.Mesh[]> }
  /** place the map copy: position in km, heading in radians (0 = north), exaggeration factor */
  place(xKm: number, zKm: number, heading: number, exaggeration: number, visible: boolean): void
  setShadows(on: boolean): void
  dispose(): void
}

export function createRover(gltf: GLTF, renderer: THREE.WebGLRenderer): Rover {
  // studio
  const scene = new THREE.Scene()
  const pm = new THREE.PMREMGenerator(renderer)
  const env = pm.fromScene(new RoomEnvironment(), 0.04).texture
  pm.dispose()
  scene.environment = env
  scene.environmentIntensity = NIGHT.envIntensity
  const hemi = new THREE.HemisphereLight(NIGHT.hemi[0], NIGHT.hemi[1], NIGHT.hemi[2])
  scene.add(hemi)
  const key = new THREE.DirectionalLight(NIGHT.key[0], NIGHT.key[1])
  key.position.set(...NIGHT.key[2])
  key.castShadow = true
  key.shadow.mapSize.set(1024, 1024)
  Object.assign(key.shadow.camera, { left: -3, right: 3, top: 3, bottom: -3 })
  key.shadow.bias = -0.0005
  const rim = new THREE.DirectionalLight(NIGHT.rim[0], NIGHT.rim[1])
  rim.position.set(...NIGHT.rim[2])
  scene.add(key, rim)
  const spot = new THREE.SpotLight(0xffb36b, 0, 0, 0.4, 0.55, 2)
  scene.add(spot, spot.target)
  const floor = new THREE.Mesh(new THREE.CircleGeometry(4, 48).rotateX(-Math.PI / 2), new THREE.ShadowMaterial({ opacity: 0.6 }))
  floor.receiveShadow = true
  scene.add(floor)
  const s = instance(gltf)
  scene.add(s.holder)
  const camera = new THREE.PerspectiveCamera(30, 16 / 9, 0.05, 100)

  // map copy
  const w = instance(gltf)
  w.holder.traverse((o) => { o.castShadow = false; o.receiveShadow = false })
  const group = new THREE.Group()
  const worldKey = new THREE.DirectionalLight(NIGHT.key[0], 3.2)
  worldKey.position.set(-2.5, 1.6, 2.2)
  const worldRim = new THREE.DirectionalLight(NIGHT.rim[0], 1.6)
  worldRim.position.set(2.5, 2.5, -3)
  const yaw = new THREE.Group()
  yaw.add(w.holder)
  group.add(yaw, worldKey, worldRim, worldKey.target, worldRim.target)

  // beacon: the moving point of light on the map, visible at any zoom
  const beaconGeo = new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute([0, 0.003, 0], 3))
  const beaconMat = new THREE.PointsMaterial({ color: PALETTE.tungsten.clone().multiplyScalar(3), size: 7, sizeAttenuation: false, toneMapped: false, transparent: true, depthWrite: false })
  const beacon = new THREE.Points(beaconGeo, beaconMat)
  beacon.frustumCulled = false
  group.add(beacon)

  return {
    studio: { scene, camera, size: s.size, parts: s.parts, root: s.holder, spot, lights: [hemi, key, rim] },
    world: { group, parts: w.parts },
    place(xKm, zKm, heading, exaggeration, visible) {
      group.position.set(xKm, 0, zKm)
      yaw.visible = visible
      yaw.scale.setScalar(KM * exaggeration)
      yaw.rotation.y = -heading + FORWARD_YAW
      worldKey.target.position.set(0, 0, 0)
      worldRim.target.position.set(0, 0, 0)
    },
    setShadows(on) { key.castShadow = on; floor.visible = on },
    dispose() {
      env.dispose()
      for (const inst of [s, w]) inst.parts.forEach((ms) => ms.forEach((m) => (m.material as THREE.Material).dispose()))
      beaconGeo.dispose(); beaconMat.dispose()
      floor.geometry.dispose(); (floor.material as THREE.Material).dispose()
    },
  }
}
