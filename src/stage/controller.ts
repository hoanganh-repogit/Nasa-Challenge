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
  /** the light has stopped on the selected part: its caption may show */
  onPartReady?: (partId: string) => void
}

const SKY_RAD_PER_SEC = 0.006
const INSET_MS = 700
const easeInOut = (k: number) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2)

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
  private part: string | null = null
  private partAnnounced = true
  private inset = { from: 0, to: 0, start: 0, value: 0 }
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
    const from: Shot = { ...this.tr.to, key: this.currentKeyFor(now), sol: cur.sol, pose: cur.cam, exaggeration: cur.exaggeration, studio: cur.studio, fog: cur.fog }
    const cut = instant || this.opts.reducedMotion
    this.tr = { from, to, start: now, duration: cut ? 0 : to.durationMs, instant: cut }
    this.settledKey = ''
  }

  private currentKeyFor(now: number) {
    return isSettled(this.tr, now) ? this.tr.to.key : this.tr.from.key
  }

  /** Open the instrument inset on a part (light-paint), or close it with null. */
  showPart(id: string | null) {
    const now = performance.now()
    const cut = this.opts.reducedMotion
    this.inset = { from: cut ? (id ? 1 : 0) : this.inset.value, to: id ? 1 : 0, start: now, value: this.inset.value }
    this.part = id
    this.partAnnounced = !id
    this.stage.selectPart(id, now, cut)
  }

  setReducedMotion(on: boolean) { this.opts.reducedMotion = on }
  setSkyPaused(on: boolean) { this.skyPaused = on }

  /** Pre-compile shaders, then draw one frame of the current shot. */
  async warm() {
    this.stage.resize()
    const r = this.assets.replay
    const at = (shot: Shot, inset = 0): StageState => ({ sol: shot.sol, cam: shot.pose, exaggeration: shot.exaggeration, studio: shot.studio, skyAngle: this.skyAngle, trailIntensity: 1, fog: shot.fog, inset, now: performance.now() })
    const st = this.shots.stops
    // map rover close up, the whole route with both dashed gaps, the instrument inset, the opening portrait
    await this.stage.warm([at(st[6]), at(st[st.length - 1]), at({ ...st[3], sol: r.maxSol }), at({ ...st[6], studio: 0.7 }), at(st[5], 1), at(this.shots.opening)])
    this.frame(performance.now())
  }

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
    const ins = this.inset
    ins.value = ins.from + (ins.to - ins.from) * easeInOut(Math.min(1, (now - ins.start) / INSET_MS))
    s.inset = ins.value
    s.trailIntensity = 1 - 0.7 * ins.value
    this.stage.render(s)
    if (!this.partAnnounced && this.part && this.stage.partReady(now)) {
      this.partAnnounced = true
      this.opts.onPartReady?.(this.part)
    }
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
