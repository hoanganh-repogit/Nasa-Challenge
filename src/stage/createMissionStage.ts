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
import { createDust } from './dust'
import { createGround } from './ground'
import { LightPaint, placeCamera, type Pose } from './lightpaint'
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
  /** Light-paint one part of the studio rover (null = none). Shows while state.inset > 0. */
  selectPart(id: string | null, now: number, instant?: boolean): void
  /** true once the light has stopped on the selected part */
  partReady(now: number): boolean
  /** Screen position (CSS px) of the selected part's leader-line anchor, from the last frame. */
  anchorScreen(out: { x: number; y: number }): boolean
  dispose(): void
  readonly quality: Quality
}

export function createMissionStage(canvas: HTMLCanvasElement, assets: StageAssets, quality: Quality = 'mid'): MissionStage {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, logarithmicDepthBuffer: true, powerPreference: 'high-performance' })
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = NIGHT.exposure
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFShadowMap
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
  const dust = createDust()
  const fogBase = fog.color.clone()
  world.add(sky.group, ground.group, trail.group, rover.world.group, dust.points)
  world.add(new THREE.HemisphereLight(NIGHT.hemi[0], NIGHT.hemi[1], NIGHT.hemi[2] * 2))
  world.environment = rover.studio.scene.environment
  world.environmentIntensity = 0.5

  const studioCam = rover.studio.camera
  const paint = new LightPaint(rover.studio.root, rover.studio.parts, rover.studio.spot, rover.studio.lights)

  // instrument inset: a veil drawn first in the studio pass darkens the map behind the lit rover
  const veilMat = new THREE.ShaderMaterial({
    uniforms: { uAlpha: { value: 0 } },
    vertexShader: 'void main(){ gl_Position = vec4(position.xy, 0.0, 1.0); }',
    fragmentShader: 'uniform float uAlpha; void main(){ gl_FragColor = vec4(0.03, 0.04, 0.09, uAlpha); }',
    blending: THREE.CustomBlending, transparent: false, depthTest: false, depthWrite: false,
  })
  const veil = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), veilMat)
  veil.frustumCulled = false
  veil.renderOrder = -10
  rover.studio.scene.add(veil)

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
  const portrait: Pose = { target: new THREE.Vector3(0, rover.studio.size.y * 0.42, 0), az: 35, el: 12, dist: 5.6 }
  function heading(i: number) {
    const { xs, ys, count } = replay
    const a = Math.max(0, i - 2), b = Math.min(count - 1, i + 2)
    const dx = xs[b] - xs[a], dy = ys[b] - ys[a]
    return dx === 0 && dy === 0 ? 0 : Math.atan2(dx, dy)
  }

  function render(s: StageState) {
    fog.density = s.fog + 0.3 * s.dust
    dust.fogColor(fogBase, s.dust, fog.color)
    sky.setHaze(s.dust)
    rover.setDim(s.dust)
    world.environmentIntensity = 0.5 * (1 - 0.65 * s.dust)
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
    // dust drifts on the sky's clock, so it rests with reduced motion or while a card is open
    dust.update(s.dust, xKm, zKm, s.skyAngle / 0.006, renderer.getPixelRatio())

    // studio portrait: right foreground; slides out to the right as `studio` goes to 0.
    // Instrument inset: the same rover, framed on the lit part, beside the text column.
    studioCam.fov = 30
    const lit = paint.update(s.now, studioCam.fov, w / h)
    const k = s.inset
    const pose: Pose = k <= 0 ? portrait : {
      target: portrait.target.clone().lerp(lit.target, k),
      az: portrait.az + ((((lit.az - portrait.az) % 360) + 540) % 360 - 180) * k,
      el: portrait.el + (lit.el - portrait.el) * k,
      dist: Math.exp(Math.log(portrait.dist) + (Math.log(lit.dist) - Math.log(portrait.dist)) * k),
    }
    placeCamera(studioCam, pose)
    const p = Math.max(s.studio, k)
    const wide = w / h > 1.05
    // portrait: right foreground on wide screens; lower and more central on phones, under the headline
    const ox0 = -w * ((wide ? 0.3 : 0.1) + (1 - p) * 0.75), oy0 = wide ? -h * 0.17 : -h * 0.3
    const ox1 = wide ? -w * 0.21 : 0, oy1 = wide ? -h * 0.02 : h * 0.2
    studioCam.setViewOffset(w, h, ox0 + (ox1 - ox0) * k, oy0 + (oy1 - oy0) * k, w, h)
    studioCam.updateProjectionMatrix()
    veilMat.uniforms.uAlpha.value = 0.86 * k
    veil.visible = k > 0.001
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

  const anchor = new THREE.Vector3()
  return {
    render, resize, warm,
    selectPart(id, now, instant = false) { paint.select(id, now, instant) },
    partReady(now) { return paint.ready(now) },
    anchorScreen(out) {
      if (!studioPass.enabled || !paint.anchor(paint.selected, anchor)) return false
      anchor.project(studioCam)
      if (anchor.z > 1) return false
      out.x = (anchor.x * 0.5 + 0.5) * w
      out.y = (-anchor.y * 0.5 + 0.5) * h
      return true
    },
    setQuality(next) { q = next; applyQuality() },
    get quality() { return q },
    dispose() {
      veil.geometry.dispose(); veilMat.dispose()
      ground.dispose(); trail.dispose(); sky.dispose(); rover.dispose(); dust.dispose()
      composer.dispose(); renderer.dispose()
    },
  }
}
