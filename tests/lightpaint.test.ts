import { readFileSync } from 'node:fs'
import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import parts from '../src/content/parts.json'
import { DIM, LightPaint, T_DIM, T_READY } from '../src/stage/lightpaint'

// material names in the shipped model (JSON chunk of the .glb)
const glb = readFileSync(new URL('../public/models/mer.glb', import.meta.url))
const gltf = JSON.parse(glb.subarray(20, 20 + glb.readUInt32LE(12)).toString('utf8')) as { materials: { name: string }[] }
const MODEL_MATERIALS = gltf.materials.map((m) => m.name)

function rig() {
  const root = new THREE.Group()
  const model = new THREE.Group()
  root.add(model)
  const byMaterial = new Map<string, THREE.Mesh[]>()
  MODEL_MATERIALS.forEach((name, i) => {
    const mat = new THREE.MeshStandardMaterial({ name, color: 0xffffff })
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 0.2), mat)
    mesh.position.set(i * 0.1, 0.5, 0)
    model.add(mesh)
    byMaterial.set(name, [mesh])
  })
  const spot = new THREE.SpotLight()
  const room = new THREE.DirectionalLight(0xffffff, 4)
  const paint = new LightPaint(root, byMaterial, spot, [room])
  const colorOf = (name: string) => (byMaterial.get(name)![0].material as THREE.MeshStandardMaterial).color.r
  return { paint, spot, room, colorOf, byMaterial }
}

describe('parts and the NASA model', () => {
  it('every part names materials that exist in mer.glb, and no material belongs to two parts', () => {
    const seen = new Set<string>()
    for (const p of parts) for (const m of p.materials) {
      expect(MODEL_MATERIALS).toContain(m)
      expect(seen.has(m)).toBe(false)
      seen.add(m)
    }
  })
})

describe('light-paint timeline', () => {
  it('dims the other parts to 0.12 in 400 ms and keeps the chosen part at full colour', () => {
    const { paint, colorOf } = rig()
    paint.select('arm', 0)
    paint.update(T_DIM / 2)
    expect(colorOf('tex_mast')).toBeGreaterThan(DIM)
    expect(colorOf('tex_mast')).toBeLessThan(1)
    paint.update(T_DIM)
    expect(colorOf('tex_mast')).toBeCloseTo(DIM, 5)
    expect(colorOf('tex_arm')).toBeCloseTo(1, 5)
  })

  it('the caption waits for the sweep to stop (400 + 900 ms)', () => {
    const { paint } = rig()
    paint.select('wheels', 1000)
    expect(paint.ready(1000 + T_READY - 1)).toBe(false)
    expect(paint.ready(1000 + T_READY)).toBe(true)
  })

  it('the spot is dark while the room dims, then sweeps in; the room lights drop', () => {
    const { paint, spot, room } = rig()
    paint.select('mast', 0)
    paint.update(T_DIM - 1)
    expect(spot.intensity).toBe(0)
    paint.update(T_READY + 10)
    expect(spot.intensity).toBeGreaterThan(0)
    expect(room.intensity).toBeLessThan(4)
  })

  it('the chosen part warms and steps out; a later choice hands the glow over', () => {
    const { paint, byMaterial } = rig()
    const arm = byMaterial.get('tex_arm')![0]
    const z0 = arm.position.z
    paint.select('arm', 0)
    paint.update(T_READY + 1)
    expect(arm.position.z - z0).toBeCloseTo(0.04, 5)
    expect((arm.material as THREE.MeshStandardMaterial).emissive.r).toBeGreaterThan(0)
    paint.select('wheels', 2000)
    paint.update(2000 + T_READY + 1)
    expect(arm.position.z).toBeCloseTo(z0, 5)
    expect((arm.material as THREE.MeshStandardMaterial).emissive.r).toBeCloseTo(0, 5)
  })

  it('reduced motion jumps straight to the end state, and null restores every colour', () => {
    const { paint, colorOf, room } = rig()
    paint.select('panels', 0, true)
    expect(paint.ready(0)).toBe(true)
    paint.update(0)
    expect(colorOf('tex_body_n')).toBeCloseTo(DIM, 5)
    paint.select(null, 10, true)
    paint.update(10)
    for (const m of MODEL_MATERIALS) expect(colorOf(m)).toBeCloseTo(1, 5)
    expect(room.intensity).toBeCloseTo(4, 5)
  })

  it('an interrupted reveal starts from where it was, never jumps', () => {
    const { paint, colorOf } = rig()
    paint.select('arm', 0)
    paint.update(T_DIM / 2)
    const mid = colorOf('tex_mast')
    paint.select('mast', T_DIM / 2)
    paint.update(T_DIM / 2)
    expect(colorOf('tex_mast')).toBeCloseTo(mid, 5)
  })
})
