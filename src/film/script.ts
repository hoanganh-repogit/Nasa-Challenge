// The 30 s film as a pure function of time: which shot, which sol, which part is lit, which words show.
// Nothing here reads a clock; capture can ask for any frame in any order.
import timeline from '../../film/timeline.json'
import type { Replay } from '../engine/replay'
import { stateAt, type Shot, type StageState, type Transition } from '../stage/director'

export const DURATION = timeline.duration
export const FPS = timeline.fps
const S = timeline.scenes as unknown as Record<string, [number, number]>
const B = timeline.beats

const clamp01 = (x: number) => Math.min(1, Math.max(0, x))
const ease = (k: number) => { k = clamp01(k); return k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2 }

interface Shots { opening: Shot; stops: Shot[]; legacy: Shot }

/** Camera legs, in order: [scene, from, to]. A leg with from === to is a hold. */
function legs(sh: Shots): [string, Shot, Shot][] {
  const st = sh.stops
  return [
    ['opening', sh.opening, sh.opening],
    ['dive', sh.opening, st[0]],
    ['drive', st[0], st[2]],
    ['purgatory', st[2], st[2]],
    ['toEsperance', st[2], st[5]],
    ['esperance', st[5], st[5]],
    ['toSilence', st[5], st[6]],
    ['silence', st[6], st[6]],
    ['rise', st[6], sh.legacy],
    ['legacy', sh.legacy, sh.legacy],
  ]
}

export interface FilmFrame {
  state: StageState
  /** the part lit at this moment, and when its light-paint began (ms) */
  part: string | null
  paintStart: number
}

export function frameAt(t: number, sh: Shots, replay: Replay): FilmFrame {
  t = Math.min(Math.max(t, 0), DURATION - 1e-6)
  const all = legs(sh)
  const [name, from, to] = all.find(([n]) => t >= S[n][0] && t < S[n][1]) ?? all[all.length - 1]
  const [t0, t1] = S[name]
  const tr: Transition = { from, to, start: t0 * 1000, duration: (t1 - t0) * 1000, instant: false }
  const state = stateAt(tr, t * 1000, replay, 0.4 + t * 0.012)
  // the instrument inset at Esperance: rover slides in, the arm is light-painted, then it slides away
  const [e0, e1] = S.esperance
  const inset = ease((t - (e0 + 0.3)) / 0.7) * (1 - ease((t - (e1 - 0.7)) / 0.6))
  state.inset = inset
  state.trailIntensity = 1 - 0.7 * inset
  state.now = t * 1000
  // rising out of the storm: the dust clears in the first second, so the whole exposure reads clean
  if (name === 'rise') state.dust = 1 - ease((t - t0) / 0.9)
  const lit = t >= e0 + 0.3 && t < e1
  return { state, part: lit ? 'arm' : null, paintStart: B.paint * 1000 }
}

/** Opacity of a caption shown from a to b, with soft edges. */
export const show = (t: number, a: number, b: number, edge = 0.4) => clamp01((t - a) / edge) * clamp01((b - t) / edge)

/** The opening number: 90 → 5,111 between the count beats. */
export function countAt(t: number) {
  const [a, b] = B.count
  const k = clamp01((t - a) / (b - a))
  const e = (1 - Math.pow(2, -10 * k)) / (1 - Math.pow(2, -10)) // exponential ease-out that lands exactly on 1
  return Math.round(90 + (5111 - 90) * e)
}

export const SCENES = S
export const BEATS = B
