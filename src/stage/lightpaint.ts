// Light-paint reveal on the studio rover (playbook E2, practice notes 3 and 12):
// 1. the other parts go dark (colour × 0.12, never opacity) in 400 ms,
// 2. a tungsten spot sweeps along an arc for 900 ms and stops,
// 3. the chosen part warms (faint tungsten emissive) and steps out 4 cm along its `out` vector,
// 4. the caption may show only once the sweep has stopped (ready()).
// Everything is a function of (selection, time since selection), so a frame can be re-drawn exactly.
import * as THREE from 'three'
import parts from '../content/parts.json'

export const DIM = 0.12
export const T_DIM = 400
export const T_SWEEP = 900
export const T_READY = T_DIM + T_SWEEP
const STEP_OUT = 0.04 // metres
const TUNGSTEN = new THREE.Color(0xffb36b)
const GLOW = 0.2
const SPOT_CD = 7 // candela at 1.3 m; scaled with distance so the light on the part stays the same
/** while a part is lit, the studio's own lights drop to this share so the spot carries the picture */
const ROOM = 0.45

/** How each part is looked at and which way it steps out. az from the rover's front (+Z) towards +X. */
export const VIEWS: Record<string, { az: number; el: number; fill: number; out: [number, number, number] }> = {
  overview: { az: 35, el: 14, fill: 0.95, out: [0, 0, 0] },
  mast: { az: 30, el: 10, fill: 1.8, out: [0, 1, 0] },
  arm: { az: 24, el: 12, fill: 3.2, out: [0, 0, 1] },
  wheels: { az: 62, el: 12, fill: 1.1, out: [0, 0, 0] },
  panels: { az: 205, el: 42, fill: 1.0, out: [0, 1, 0] },
  body: { az: 55, el: 14, fill: 1.35, out: [0, 0, 0] },
  deck: { az: 200, el: 30, fill: 1.1, out: [0, 1, 0] },
}

/** Points worth a leader line, in model metres (NASA model: Y up, +Z front). */
export const ANCHORS: Record<string, { at: [number, number, number]; label: string }> = {
  // the stowed turret at the end of the arm: the cluster of tool heads on the rover's right front
  arm: { at: [0.14, 0.42, 0.43], label: 'Turret' },
}

export interface Pose { target: THREE.Vector3; az: number; el: number; dist: number }

interface Entry {
  mesh: THREE.Mesh
  mat: THREE.MeshStandardMaterial
  part: string | null
  baseColor: THREE.Color
  baseEmissive: THREE.Color
  baseEnv: number
  origin: THREE.Vector3
  // values at the moment of the last selection, so an interrupted reveal never jumps
  f0: number; g0: number; o0: number
  f: number; g: number; o: number
}

const clamp01 = (x: number) => Math.min(1, Math.max(0, x))
const ease = (k: number) => { k = clamp01(k); return k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2 }
const lerp = (a: number, b: number, k: number) => a + (b - a) * k
const lerpAngle = (a: number, b: number, k: number) => a + (((((b - a) % 360) + 540) % 360) - 180) * k

export class LightPaint {
  readonly spot: THREE.SpotLight
  private entries: Entry[] = []
  private frames = new Map<string, { center: THREE.Vector3; radius: number }>()
  private root: THREE.Object3D
  private sel: string | null = null
  private start = -1e9
  private spotI0 = 0
  private spotI = 0
  private pose0: Pose
  private poseNow: Pose
  private room: { light: THREE.Light; base: number }[]
  private room0 = 1
  private roomNow = 1

  /** `byMaterial` maps material names to meshes (rover.studio.parts); `root` holds the whole model. */
  constructor(root: THREE.Object3D, byMaterial: Map<string, THREE.Mesh[]>, spot: THREE.SpotLight, roomLights: THREE.Light[] = []) {
    this.root = root
    this.spot = spot
    this.room = roomLights.map((light) => ({ light, base: light.intensity }))
    root.updateMatrixWorld(true)
    const matToPart = new Map<string, string>()
    for (const p of parts) for (const m of p.materials) matToPart.set(m, p.id)
    const boxes = new Map<string, THREE.Box3>()
    byMaterial.forEach((meshes, matName) => {
      const part = matToPart.get(matName) ?? null
      for (const mesh of meshes) {
        const mat = mesh.material as THREE.MeshStandardMaterial
        this.entries.push({
          mesh, mat, part,
          baseColor: mat.color.clone(), baseEmissive: mat.emissive.clone(), baseEnv: mat.envMapIntensity ?? 1,
          origin: mesh.position.clone(), f0: 1, g0: 0, o0: 0, f: 1, g: 0, o: 0,
        })
        if (part) {
          const b = boxes.get(part) ?? new THREE.Box3()
          boxes.set(part, b.expandByObject(mesh))
        }
      }
    })
    const all = new THREE.Box3().setFromObject(root)
    boxes.set('overview', all)
    boxes.forEach((b, id) => {
      const s = b.getBoundingSphere(new THREE.Sphere())
      this.frames.set(id, { center: s.center, radius: s.radius })
    })
    this.pose0 = this.poseFor(null)
    this.poseNow = { ...this.pose0, target: this.pose0.target.clone() }
  }

  get selected() { return this.sel }

  /**
   * The resting camera for a part (or the whole rover), for a vertical field of view in degrees.
   * `aspect` < 1 (portrait screens) pulls back so the part also fits across.
   */
  poseFor(id: string | null, fov = 30, aspect = 1): Pose {
    const key = id ?? 'overview'
    const fr = this.frames.get(key) ?? this.frames.get('overview')!
    const v = VIEWS[key] ?? VIEWS.overview
    const dist = (fr.radius / Math.sin(THREE.MathUtils.degToRad(fov) / 2)) * v.fill / Math.min(1, aspect)
    return { target: fr.center.clone(), az: v.az, el: v.el, dist: Math.max(0.9, dist) }
  }

  select(id: string | null, now: number, instant = false) {
    if (id === this.sel && !instant) return
    for (const e of this.entries) { e.f0 = e.f; e.g0 = e.g; e.o0 = e.o }
    this.spotI0 = this.spotI
    this.room0 = this.roomNow
    this.pose0 = { ...this.poseNow, target: this.poseNow.target.clone() }
    this.sel = id
    this.start = instant ? now - T_READY - 1 : now
    if (instant) {
      // reduced motion: no sweep, no tween; jump straight to the end state
      for (const e of this.entries) { e.f0 = this.targetF(e); e.g0 = e.part === id && id ? 1 : 0; e.o0 = e.g0 }
      this.spotI0 = 0
      this.room0 = id ? ROOM : 1
      this.pose0 = this.poseFor(id)
    }
  }

  /** True once the sweep has stopped: the caption may show. */
  ready(now: number) { return now - this.start >= T_READY }

  private targetF(e: Entry) { return this.sel === null || e.part === this.sel ? 1 : DIM }

  /** Apply the reveal at `now`; returns the camera pose to use. */
  update(now: number, fov = 30, aspect = 1): Pose {
    const t = now - this.start
    const kDim = ease(t / T_DIM)
    const kRise = ease((t - T_DIM * 0.5) / (T_READY - T_DIM * 0.5))
    for (const e of this.entries) {
      const on = this.sel !== null && e.part === this.sel
      e.f = lerp(e.f0, this.targetF(e), kDim)
      e.g = on ? lerp(e.g0, 1, kRise) : lerp(e.g0, 0, kDim)
      e.o = on ? lerp(e.o0, 1, kRise) : lerp(e.o0, 0, kDim)
      e.mat.color.copy(e.baseColor).multiplyScalar(e.f)
      e.mat.envMapIntensity = e.baseEnv * e.f
      e.mat.emissive.copy(e.baseEmissive).lerp(TUNGSTEN, e.g * GLOW)
      const out = e.part ? VIEWS[e.part]?.out : undefined
      if (out) e.mesh.position.set(e.origin.x + out[0] * STEP_OUT * e.o, e.origin.y + out[1] * STEP_OUT * e.o, e.origin.z + out[2] * STEP_OUT * e.o)
    }

    this.roomNow = lerp(this.room0, this.sel === null ? 1 : ROOM, kDim)
    for (const r of this.room) r.light.intensity = r.base * this.roomNow

    // camera: ease from wherever it was to the part's framing over dim + sweep
    const to = this.poseFor(this.sel, fov, aspect)
    const kc = ease(t / T_READY)
    const p0 = this.pose0
    this.poseNow = {
      target: p0.target.clone().lerp(to.target, kc),
      az: lerpAngle(p0.az, to.az, kc), el: lerp(p0.el, to.el, kc),
      dist: Math.exp(lerp(Math.log(p0.dist), Math.log(to.dist), kc)),
    }

    // spot: fades with the dim, then sweeps an 80° arc onto the part and stops
    const fr = this.frames.get(this.sel ?? 'overview')!
    if (this.sel === null) {
      this.spotI = lerp(this.spotI0, 0, kDim)
    } else {
      this.spotI = t < T_DIM ? lerp(this.spotI0, 0, kDim) : SPOT_CD * ease((t - T_DIM) / 180)
      const sweep = ease((t - T_DIM) / T_SWEEP)
      const az = THREE.MathUtils.degToRad(to.az + 40 + (1 - sweep) * 80)
      const el = THREE.MathUtils.degToRad(38 - (1 - sweep) * 18)
      const r = Math.max(1.3, fr.radius * 3)
      this.spot.position.set(fr.center.x + Math.sin(az) * Math.cos(el) * r, fr.center.y + Math.sin(el) * r, fr.center.z + Math.cos(az) * Math.cos(el) * r)
      this.spot.target.position.copy(fr.center)
      this.spot.angle = Math.min(0.6, Math.atan((fr.radius * 1.2) / r))
      this.spot.distance = 0
      this.spot.intensity = this.spotI * (r / 1.3) ** 2
    }
    if (this.sel === null) this.spot.intensity = this.spotI
    this.spot.target.updateMatrixWorld()
    return this.poseNow
  }

  /** World position of a part's anchor, if it has one. */
  anchor(id: string | null, out: THREE.Vector3): boolean {
    const a = id ? ANCHORS[id] : undefined
    if (!a) return false
    out.set(a.at[0], a.at[1], a.at[2])
    // model metres -> scene: the model sits inside `root` (re-centred on the floor)
    const model = this.root.children[0]
    ;(model ?? this.root).localToWorld(out)
    const e = this.entries.find((x) => x.part === id)
    if (e) {
      const o = VIEWS[id!]?.out
      if (o) out.add(new THREE.Vector3(o[0], o[1], o[2]).multiplyScalar(STEP_OUT * e.o))
    }
    return true
  }
}

/** Place a camera on a pose (compass-style az around the target, el above the horizon). */
export function placeCamera(cam: THREE.PerspectiveCamera, p: Pose) {
  const A = THREE.MathUtils.degToRad(p.az), E = THREE.MathUtils.degToRad(p.el)
  cam.position.set(p.target.x + Math.sin(A) * Math.cos(E) * p.dist, p.target.y + Math.sin(E) * p.dist, p.target.z + Math.cos(A) * Math.cos(E) * p.dist)
  cam.lookAt(p.target)
}
