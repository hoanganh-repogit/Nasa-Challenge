// Owns the requestAnimationFrame loop and the current transition. React only hears about
// settled stops (rarely); per-frame readouts are written straight into DOM nodes.
import { createMissionStage, type MissionStage, type StageAssets } from './createMissionStage'
import { buildShots, isSettled, stateAt, type Quality, type Shot, type StageState, type Transition } from './director'

export interface ControllerOptions {
  reducedMotion: boolean
  quality: Quality
  onFrame?: (s: StageState) => void
  onSettled?: (key: string) => void
  onQuality?: (q: Quality) => void
}

const SKY_RAD_PER_SEC = 0.006

export class StageController {
  readonly stage: MissionStage
  readonly shots: { opening: Shot; stops: Shot[] }
  private tr: Transition
  private raf = 0
  private skyAngle = 0.4
  private last = 0
  private settledKey = ''
  private skyPaused = false
  private fps = { frames: 0, since: 0, low: 0, value: 60 }
  autoQuality = true
  private assets: StageAssets
  private opts: ControllerOptions

  constructor(canvas: HTMLCanvasElement, assets: StageAssets, opts: ControllerOptions) {
    this.assets = assets
    this.opts = opts
    this.stage = createMissionStage(canvas, assets, opts.quality)
    this.shots = buildShots(assets.replay)
    const o = this.shots.opening
    this.tr = { from: o, to: o, start: 0, duration: 0, instant: true }
  }

  get fpsValue() { return this.fps.value }

  /** Fly (or cut, with reduced motion) to a stop index, or -1 for the opening frame. */
  goTo(index: number, instant = false) {
    const to = index < 0 ? this.shots.opening : this.shots.stops[index]
    const now = performance.now()
    // start from wherever the camera is now, so an interrupted flight never jumps
    const cur = stateAt(this.tr, now, this.assets.replay, this.skyAngle)
    const from: Shot = { ...this.tr.to, key: this.currentKeyFor(now), sol: cur.sol, pose: cur.cam, exaggeration: cur.exaggeration, studio: cur.studio }
    const cut = instant || this.opts.reducedMotion
    this.tr = { from, to, start: now, duration: cut ? 0 : to.durationMs, instant: cut }
    this.settledKey = ''
  }

  private currentKeyFor(now: number) {
    return isSettled(this.tr, now) ? this.tr.to.key : this.tr.from.key
  }

  setReducedMotion(on: boolean) { this.opts.reducedMotion = on }
  setSkyPaused(on: boolean) { this.skyPaused = on }

  start() {
    this.stage.resize()
    const loop = (t: number) => {
      this.raf = requestAnimationFrame(loop)
      this.frame(t)
    }
    this.raf = requestAnimationFrame(loop)
  }

  frame(now: number) {
    const dt = this.last ? Math.min(0.1, (now - this.last) / 1000) : 0
    this.last = now
    if (!this.skyPaused && !this.opts.reducedMotion) this.skyAngle += dt * SKY_RAD_PER_SEC
    const s = stateAt(this.tr, now, this.assets.replay, this.skyAngle)
    this.stage.render(s)
    this.opts.onFrame?.(s)
    if (!this.settledKey && isSettled(this.tr, now)) {
      this.settledKey = this.tr.to.key
      this.opts.onSettled?.(this.settledKey)
    }
    this.measure(now)
  }

  /** Drop one quality tier when FPS stays under 40 for 2 s. */
  private measure(now: number) {
    const f = this.fps
    f.frames++
    if (!f.since) f.since = now
    const span = now - f.since
    if (span < 500) return
    f.value = (f.frames * 1000) / span
    f.frames = 0; f.since = now
    if (!this.autoQuality || document.hidden) return
    f.low = f.value < 40 ? f.low + span : 0
    if (f.low >= 2000) {
      f.low = 0
      const q = this.stage.quality
      const next: Quality | null = q === 'high' ? 'mid' : q === 'mid' ? 'low' : null
      if (next) { this.stage.setQuality(next); this.opts.onQuality?.(next) }
    }
  }

  stop() { cancelAnimationFrame(this.raf); this.raf = 0 }
  dispose() { this.stop(); this.stage.dispose() }
}
