// Mission Stage "Night Exposure": one WebGL canvas behind a thin React text layer.
// render(state) draws one frame from a StageState and nothing else; no hidden clocks.
import * as THREE from 'three'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js'
import type { GLTF } from 'three/addons/loaders/GLTFLoader.js'
import type { RouteFile, TraverseFile } from '../data/types'
import type { Replay } from '../engine/replay'
import type { Quality, StageState } from './director'
import { createGround } from './ground'
import { createRover, NIGHT } from './rover'
import { createSky } from './sky'
import { createTrail } from './trail'

export const TIERS: Record<Quality, { maxDpr: number; bloom: boolean; bloomScale: number; shadows: boolean; arcs: number }> = {
  high: { maxDpr: 2, bloom: true, bloomScale: 1, shadows: true, arcs: 700 },
  mid: { maxDpr: 1.5, bloom: true, bloomScale: 0.5, shadows: true, arcs: 700 },
  low: { maxDpr: 1, bloom: false, bloomScale: 0.5, shadows: false, arcs: 200 },
}

export interface StageAssets {
  traverse: TraverseFile
  route: RouteFile
  basemap: THREE.Texture
  gltf: GLTF
  replay: Replay
}

export interface MissionStage {
  render(state: StageState): void
  resize(): void
  setQuality(q: Quality): void
  /** Compile every shader variant the journey will need, so the first flight never stalls. */
  warm(states: StageState[]): Promise<void>
  dispose(): void
  readonly quality: Quality
}

export function createMissionStage(canvas: HTMLCanvasElement, assets: StageAssets, quality: Quality = 'mid'): MissionStage {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, logarithmicDepthBuffer: true, powerPreference: 'high-performance' })
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = NIGHT.exposure
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFSoftShadowMap
  renderer.setClearColor(0x0b1020, 1)

  const { replay } = assets
  const world = new THREE.Scene()
  const fog = new THREE.FogExp2(0x262a44, 0.035)
  world.fog = fog
  const camera = new THREE.PerspectiveCamera(40, 16 / 9, 0.0005, 3000)

  const ground = createGround(assets.traverse.basemapTransform, assets.basemap)
  const trail = createTrail(assets.traverse, assets.route, replay)
  const sky = createSky(700)
  const rover = createRover(assets.gltf, renderer)
  world.add(sky.group, ground.group, trail.group, rover.world.group)
  world.add(new THREE.HemisphereLight(NIGHT.hemi[0], NIGHT.hemi[1], NIGHT.hemi[2] * 2))
  world.environment = rover.studio.scene.environment
  world.environmentIntensity = 0.5

  const studioCam = rover.studio.camera

  // post: bloom on the trail only (HDR > threshold); the studio portrait is drawn after bloom
  const composer = new EffectComposer(renderer)
  const worldPass = new RenderPass(world, camera)
  const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.85, 0.55, 0.9)
  const studioPass = new RenderPass(rover.studio.scene, studioCam)
  studioPass.clear = false
  studioPass.clearDepth = true
  composer.addPass(worldPass)
  composer.addPass(bloom)
  composer.addPass(studioPass)
  composer.addPass(new OutputPass())

  let q: Quality = quality
  let w = 1, h = 1

  function applyQuality() {
    const t = TIERS[q]
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, t.maxDpr))
    composer.setPixelRatio(Math.min(window.devicePixelRatio || 1, t.maxDpr))
    bloom.enabled = t.bloom
    rover.setShadows(t.shadows)
    renderer.shadowMap.enabled = t.shadows
    sky.setArcCount(t.arcs)
    resize()
  }

  function resize() {
    const r = canvas.getBoundingClientRect()
    w = Math.max(1, Math.round(r.width)); h = Math.max(1, Math.round(r.height))
    renderer.setSize(w, h, false)
    composer.setSize(w, h)
    const bs = TIERS[q].bloomScale
    bloom.resolution.set(Math.round(w * bs), Math.round(h * bs))
    trail.setResolution(w, h)
    camera.aspect = w / h
    camera.updateProjectionMatrix()
    studioCam.aspect = w / h
  }

  const v = new THREE.Vector3()
  function heading(i: number) {
    const { xs, ys, count } = replay
    const a = Math.max(0, i - 2), b = Math.min(count - 1, i + 2)
    const dx = xs[b] - xs[a], dy = ys[b] - ys[a]
    return dx === 0 && dy === 0 ? 0 : Math.atan2(dx, dy)
  }

  function render(s: StageState) {
    fog.density = s.fog
    const fix = replay.positionAt(s.sol)
    trail.update(fix)
    trail.setIntensity(s.trailIntensity)
    const xKm = fix.x / 1000, zKm = -fix.y / 1000
    rover.place(xKm, zKm, heading(fix.recordIndex), s.exaggeration, s.exaggeration > 0.5)

    // world camera from a compass bearing around the target
    const { tx, tz, az, el, dist, fov } = s.cam
    const A = THREE.MathUtils.degToRad(az), E = THREE.MathUtils.degToRad(el)
    camera.position.set(tx + Math.sin(A) * Math.cos(E) * dist, Math.sin(E) * dist, tz - Math.cos(A) * Math.cos(E) * dist)
    camera.fov = fov
    camera.updateProjectionMatrix()
    camera.lookAt(v.set(tx, 0, tz))
    sky.update(camera, s.skyAngle)

    // studio portrait: right foreground; slides out to the right as `studio` goes to 0
    const size = rover.studio.size
    studioCam.fov = 30
    const sa = THREE.MathUtils.degToRad(35), se = THREE.MathUtils.degToRad(12), sd = 5.6
    const ty = size.y * 0.42
    studioCam.position.set(Math.sin(sa) * Math.cos(se) * sd, ty + Math.sin(se) * sd, Math.cos(sa) * Math.cos(se) * sd)
    studioCam.lookAt(0, ty, 0)
    const p = s.studio
    studioCam.setViewOffset(w, h, -w * (0.3 + (1 - p) * 0.75), -h * 0.17, w, h)
    studioCam.updateProjectionMatrix()
    studioPass.enabled = p > 0.001

    if (TIERS[q].bloom || studioPass.enabled) composer.render()
    else renderer.render(world, camera)
  }

  applyQuality()

  /**
   * ANGLE on D3D11 (Chrome on Windows) only builds a shader at its first real draw, so compiling is not
   * enough: draw each given state once, through the composer and the direct (Low tier) path.
   */
  async function warm(states: StageState[]) {
    renderer.setRenderTarget(composer.readBuffer)
    try { await renderer.compileAsync(world, camera) } finally { renderer.setRenderTarget(null) }
    for (const st of states) {
      render(st)
      composer.render()
      renderer.render(world, camera)
    }
  }

  return {
    render, resize, warm,
    setQuality(next) { q = next; applyQuality() },
    get quality() { return q },
    dispose() {
      ground.dispose(); trail.dispose(); sky.dispose(); rover.dispose()
      composer.dispose(); renderer.dispose()
    },
  }
}
