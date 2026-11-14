// The /rover explorer: NASA's model alone in the dark, one part light-painted at a time.
// Same rover rig and light-paint as the journey's instrument inset; its own small renderer.
import * as THREE from 'three'
import type { GLTF } from 'three/addons/loaders/GLTFLoader.js'
import { LightPaint, placeCamera } from '../stage/lightpaint'
import { createRover, NIGHT } from '../stage/rover'

export interface RoverStage {
  select(id: string | null, instant?: boolean): void
  /** extra turn (degrees) from dragging */
  spin: number
  anchorScreen(out: { x: number; y: number }): boolean
  resize(): void
  dispose(): void
}

export function createRoverStage(canvas: HTMLCanvasElement, gltf: GLTF, opts: {
  reducedMotion: boolean
  onPartReady?: (id: string) => void
  onFrame?: () => void
}): RoverStage {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' })
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = NIGHT.exposure
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFShadowMap
  renderer.setClearColor(0x0b1020, 1)

  const rover = createRover(gltf, renderer)
  const { scene, camera } = rover.studio
  const paint = new LightPaint(rover.studio.root, rover.studio.parts, rover.studio.spot, rover.studio.lights)
  let w = 1, h = 1
  let dpr = Math.min(window.devicePixelRatio || 1, 1.75)
  let announced = true
  let raf = 0
  const fps = { frames: 0, since: 0, low: 0 }

  function resize() {
    const r = canvas.getBoundingClientRect()
    w = Math.max(1, Math.round(r.width)); h = Math.max(1, Math.round(r.height))
    renderer.setPixelRatio(dpr)
    renderer.setSize(w, h, false)
    camera.aspect = w / h
  }

  const stage: RoverStage = {
    spin: 0,
    select(id, instant = false) {
      paint.select(id, performance.now(), instant || opts.reducedMotion)
      announced = !id
    },
    anchorScreen(out) {
      if (!paint.anchor(paint.selected, v)) return false
      v.project(camera)
      if (v.z > 1) return false
      out.x = (v.x * 0.5 + 0.5) * w
      out.y = (-v.y * 0.5 + 0.5) * h
      return true
    },
    resize,
    dispose() {
      cancelAnimationFrame(raf)
      rover.dispose()
      renderer.dispose()
    },
  }
  const v = new THREE.Vector3()

  function frame(now: number) {
    raf = requestAnimationFrame(frame)
    camera.fov = 30
    const lit = paint.update(now, camera.fov, w / h)
    const pose = { ...lit, az: lit.az + stage.spin }
    placeCamera(camera, pose)
    const wide = w / h > 1.05
    // wide: the rover sits right of the text column; narrow: in the top half above it
    camera.setViewOffset(w, h, wide ? -w * 0.2 : 0, wide ? -h * 0.02 : h * 0.24, w, h)
    camera.updateProjectionMatrix()
    renderer.render(scene, camera)
    if (!announced && paint.selected && paint.ready(now)) {
      announced = true
      opts.onPartReady?.(paint.selected)
    }
    opts.onFrame?.()
    // one step down if the GPU struggles: lower pixel ratio and no shadows
    fps.frames++
    if (!fps.since) fps.since = now
    if (now - fps.since >= 500) {
      const value = (fps.frames * 1000) / (now - fps.since)
      fps.low = value < 40 && !document.hidden ? fps.low + (now - fps.since) : 0
      fps.frames = 0; fps.since = now
      if (fps.low >= 2000 && dpr > 1) { dpr = 1; rover.setShadows(false); renderer.shadowMap.enabled = false; resize() }
    }
  }

  resize()
  raf = requestAnimationFrame(frame)
  return stage
}
