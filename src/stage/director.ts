// Camera director: derives the whole stage state from (shot transition, time). Pure; no React.
// The route never deforms; only the camera and the replay sol move.
import { STOPS } from '../content/stops'
import type { Replay } from '../engine/replay'
import shots from './shots.json'

export type Quality = 'high' | 'mid' | 'low'

export interface CamPose { tx: number; tz: number; az: number; el: number; dist: number; fov: number }

export interface StageState {
  sol: number
  cam: CamPose
  exaggeration: number
  /** 0 = studio portrait gone, 1 = in place */
  studio: number
  skyAngle: number
  /** 0..1 dims the route while a card or instrument view needs attention */
  trailIntensity: number
  fog: number
  /** 0..1 instrument inset: the studio rover framed on a lit part, the map veiled behind it */
  inset: number
  /** 0..1 illustrative dust storm (Silence) */
  dust: number
  /** clock (ms) for time-based reveals such as the light-paint */
  now: number
}

interface ShotDef { target?: number[]; az: number; el: number; dist: number; fov: number; exaggeration: number; studio: number; durationMs?: number; fog?: number; dust?: number }

export interface Shot { key: string; sol: number; pose: CamPose; exaggeration: number; studio: number; durationMs: number; follow: boolean; fog: number; dust: number }

const OPENING_SOL = 5111

export function buildShots(replay: Replay): { opening: Shot; stops: Shot[]; legacy: Shot } {
  const mk = (key: string, def: ShotDef, sol: number): Shot => {
    const at = replay.positionAt(sol)
    const [tx, tz] = def.target ? [def.target[0], def.target[1]] : [at.x / 1000, -at.y / 1000]
    return {
      key, sol, exaggeration: def.exaggeration, studio: def.studio, durationMs: def.durationMs ?? 3000, follow: !def.target, fog: def.fog ?? 0.035, dust: def.dust ?? 0,
      pose: { tx, tz, az: def.az, el: def.el, dist: def.dist, fov: def.fov },
    }
  }
  const defs = shots.stops as Record<string, ShotDef>
  return {
    opening: mk('opening', shots.opening as ShotDef, OPENING_SOL),
    stops: STOPS.map((s) => mk(s.id, defs[s.id], s.sol)),
    legacy: mk('legacy', shots.legacy as ShotDef, replay.maxSol),
  }
}

const easeInOut = (k: number) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2)
const lerp = (a: number, b: number, k: number) => a + (b - a) * k
const lerpAngle = (a: number, b: number, k: number) => {
  const d = ((((b - a) % 360) + 540) % 360) - 180
  return a + d * k
}

export interface Transition { from: Shot; to: Shot; start: number; duration: number; instant: boolean }

/**
 * Stage state at time `now` for a transition. The replay sol is eased from shot to shot; the camera
 * target follows the rover along the trail; the camera pulls back mid-flight in proportion to the
 * ground covered so long legs stay readable.
 */
export function stateAt(tr: Transition, now: number, replay: Replay, skyAngle: number): StageState {
  const raw = tr.instant || tr.duration <= 0 ? 1 : Math.min(1, Math.max(0, (now - tr.start) / tr.duration))
  const k = easeInOut(raw)
  const { from, to } = tr
  // going back to sol 1 from the opening rewinds the exposure quickly, then the dive settles
  const solK = from.key === 'opening' ? easeInOut(Math.min(1, raw * 1.6)) : k
  const sol = lerp(from.sol, to.sol, solK)
  const fix = replay.positionAt(sol)
  const roverX = fix.x / 1000, roverZ = -fix.y / 1000

  const fp = from.pose, tp = to.pose
  let tx = lerp(fp.tx, tp.tx, k), tz = lerp(fp.tz, tp.tz, k)
  if (from.follow && to.follow) {
    // mid-flight the target rides on the rover; at both ends it equals the shots' targets
    const w = Math.sin(Math.PI * k)
    tx = lerp(tx, roverX, w); tz = lerp(tz, roverZ, w)
  }
  const legKm = Math.hypot(tp.tx - fp.tx, tp.tz - fp.tz)
  const lift = from.key === 'opening' || to.key === 'opening' ? 0 : 0.45 * legKm * Math.sin(Math.PI * k)
  const dist = Math.exp(lerp(Math.log(fp.dist), Math.log(tp.dist), k)) + lift

  return {
    sol,
    cam: { tx, tz, az: lerpAngle(fp.az, tp.az, k), el: lerp(fp.el, tp.el, k), dist, fov: lerp(fp.fov, tp.fov, k) },
    exaggeration: lerp(from.exaggeration, to.exaggeration, k),
    studio: lerp(from.studio, to.studio, Math.min(1, raw * 2.2)),
    skyAngle,
    trailIntensity: 1,
    fog: lerp(from.fog, to.fog, k),
    inset: 0,
    dust: lerp(from.dust, to.dust, k),
    now,
  }
}

export const isSettled = (tr: Transition, now: number) => tr.instant || now - tr.start >= tr.duration
