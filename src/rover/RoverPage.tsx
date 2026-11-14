import { useCallback, useEffect, useRef, useState } from 'react'
import '../App.css'
import './rover.css'
import { PART_BY_ID, PARTS, stopsForPart } from '../content'
import { navigate } from '../nav'
import { Icon } from '../ui/Icon'
import { PartCaption } from '../ui/PartCaption'
import type { RoverStage } from './createRoverStage'

const TOOLS = new Set(['rat', 'apxs', 'mb', 'mi'])
const TOUR_IDLE_MS = 8000
const TOUR_STEP_MS = 7000
const LEADER: Record<string, string> = { arm: 'Turret: RAT · APXS · MB · MI' }
const hasWebGL = (() => {
  try { return !!document.createElement('canvas').getContext('webgl2') } catch { return false }
})()

/** "#arm" -> arm; "#rat" -> the arm, with the RAT marked; anything else -> nothing selected */
function fromHash(): { part: string | null; tool: string | null } {
  const id = location.hash.slice(1).toLowerCase()
  if (TOOLS.has(id)) return { part: 'arm', tool: id }
  return { part: PART_BY_ID.has(id) ? id : null, tool: null }
}

export default function RoverPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const stageRef = useRef<RoverStage | null>(null)
  const headRef = useRef<HTMLHeadingElement>(null)
  const leaderRef = useRef<SVGLineElement>(null)
  const leaderLabelRef = useRef<HTMLDivElement>(null)
  const leaderOn = useRef(false)
  const [sel, setSel] = useState(fromHash)
  const [ready, setReady] = useState(false)
  const [lit, setLit] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [touring, setTouring] = useState(false)
  const reduced = useRef(window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  const idleAt = useRef(performance.now())
  const part = sel.part ? PART_BY_ID.get(sel.part) : undefined
  const selRef = useRef(sel)
  useEffect(() => { selRef.current = sel }, [sel])

  useEffect(() => { document.title = 'The rover · Echoes of the Cosmos' }, [])

  // stage lifecycle
  useEffect(() => {
    // no WebGL: the part list and captions still work, as text
    if (!hasWebGL) { setReady(true); setLit(true); return }
    let disposed = false
    const pt = { x: 0, y: 0 }
    Promise.all([import('./createRoverStage'), import('../stage/load')]).then(async ([{ createRoverStage }, { loadRoverModel }]) => {
      const gltf = await loadRoverModel()
      if (disposed || !canvasRef.current) return
      const st = createRoverStage(canvasRef.current, gltf, {
        reducedMotion: reduced.current,
        onPartReady: () => setLit(true),
        onFrame: () => {
          const line = leaderRef.current, label = leaderLabelRef.current
          if (!line || !label) return
          const ok = leaderOn.current && st.anchorScreen(pt)
          line.parentElement!.parentElement!.style.opacity = ok ? '1' : '0'
          if (!ok) return
          const wide = innerWidth / innerHeight > 1.05
          const lx = pt.x + (wide ? 90 : -40), ly = pt.y - (wide ? 120 : 80)
          line.setAttribute('x1', String(pt.x)); line.setAttribute('y1', String(pt.y))
          line.setAttribute('x2', String(lx)); line.setAttribute('y2', String(ly))
          label.style.transform = `translate(${lx}px, ${ly}px)`
        },
      })
      st.select(fromHash().part, true)
      stageRef.current = st
      setLit(!!fromHash().part)
      setReady(true)
    }).catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)))
    const onResize = () => stageRef.current?.resize()
    window.addEventListener('resize', onResize)
    return () => {
      disposed = true
      window.removeEventListener('resize', onResize)
      stageRef.current?.dispose()
      stageRef.current = null
    }
  }, [])

  const apply = useCallback((next: { part: string | null; tool: string | null }) => {
    setSel(next)
    setLit(!hasWebGL)
    stageRef.current?.select(next.part)
  }, [])

  // Back / Forward walk the parts the visitor chose
  useEffect(() => {
    const on = () => apply(fromHash())
    window.addEventListener('hashchange', on)
    return () => window.removeEventListener('hashchange', on)
  }, [apply])

  const choose = (id: string) => {
    setTouring(false)
    idleAt.current = performance.now()
    if (id === sel.part && !sel.tool) return
    history.pushState(null, '', `#${id}`)
    apply({ part: id, tool: null })
  }

  // auto tour after 8 s without input; any input hands control back
  useEffect(() => {
    const poke = () => { idleAt.current = performance.now(); setTouring(false) }
    const evs = ['pointerdown', 'keydown', 'wheel'] as const
    evs.forEach((e) => window.addEventListener(e, poke))
    const id = window.setInterval(() => {
      if (!stageRef.current || document.hidden) return
      if (performance.now() - idleAt.current >= TOUR_IDLE_MS && !reduced.current) setTouring(true)
    }, 500)
    return () => { evs.forEach((e) => window.removeEventListener(e, poke)); clearInterval(id) }
  }, [])
  useEffect(() => {
    if (!touring) return
    const step = () => {
      const k = PARTS.findIndex((p) => p.id === selRef.current.part)
      const next = PARTS[(k + 1) % PARTS.length].id
      history.replaceState(null, '', `#${next}`)
      apply({ part: next, tool: null })
    }
    step()
    const id = window.setInterval(step, TOUR_STEP_MS)
    return () => clearInterval(id)
  }, [touring, apply])

  useEffect(() => { leaderOn.current = lit && !!sel.part && sel.part in LEADER }, [lit, sel.part])

  // drag to turn the rover
  useEffect(() => {
    const c = canvasRef.current
    if (!c) return
    let x0: number | null = null, s0 = 0
    const down = (e: PointerEvent) => { x0 = e.clientX; s0 = stageRef.current?.spin ?? 0; c.setPointerCapture(e.pointerId) }
    const move = (e: PointerEvent) => { if (x0 !== null && stageRef.current) stageRef.current.spin = s0 - (e.clientX - x0) * 0.35 }
    const up = () => { x0 = null }
    c.addEventListener('pointerdown', down); c.addEventListener('pointermove', move); c.addEventListener('pointerup', up); c.addEventListener('pointercancel', up)
    return () => { c.removeEventListener('pointerdown', down); c.removeEventListener('pointermove', move); c.removeEventListener('pointerup', up); c.removeEventListener('pointercancel', up) }
  }, [])

  const toStop = (e: React.MouseEvent<HTMLAnchorElement>, n: number) => {
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey) return
    e.preventDefault()
    navigate(`/#stop-${n}`, { journey: true }) // Back from the stop returns here
  }

  return (
    <>
      {hasWebGL && <canvas ref={canvasRef} className="stage rv-stage" aria-hidden="true" data-ready={ready} />}
      <div className="ui rv">
        <a className="rv__home caption" href="/" onClick={(e) => { e.preventDefault(); navigate('/') }}>
          <Icon name="prev" size={16} />
          The journey
        </a>
        <section className="rv__col" aria-labelledby="rv-title">
          <h1 id="rv-title">The rover, part by part</h1>
          <p className="rv__intro">
            NASA's 3D model of Opportunity. Choose a part to light it up and see what it found. Drag the rover to turn it.
          </p>
          <ul className="rv__parts" aria-label="Parts of the rover">
            {PARTS.map((p) => {
              const stops = stopsForPart(p.id)
              return (
                <li key={p.id}>
                  <button type="button" className="rv__part" aria-pressed={sel.part === p.id} onClick={() => choose(p.id)} disabled={!ready}>
                    <span className="rv__pname">{p.name}</span>
                    <span className="rv__pstops caption">{stops.length ? `Stop ${stops.join(', ')}` : 'Used throughout'}</span>
                  </button>
                </li>
              )
            })}
          </ul>
          {touring && (
            <p className="rv__tour caption">
              Touring the parts
              <button type="button" className="band__btn" onClick={() => { setTouring(false); idleAt.current = performance.now() }}>
                <Icon name="pause" size={14} /> Pause
              </button>
            </p>
          )}
          {part && (
            <div className="rv__caption" data-ready={lit}>
              <PartCaption part={part} headingRef={headRef} tool={sel.tool} stopHref={(n) => `/#stop-${n}`} onStopLink={toStop} />
            </div>
          )}
        </section>

        <div className="leader" aria-hidden="true">
          <svg><line ref={leaderRef} /></svg>
          <div ref={leaderLabelRef} className="leader__label caption">{sel.part ? LEADER[sel.part] ?? '' : ''}</div>
        </div>

        <p className="sr-only" aria-live="polite">{part && lit ? `${part.name}, lit on the rover.` : ''}</p>
        <footer className="rv__fine caption">
          <span>Model: Spirit and Opportunity Rover 3D Model, NASA/JPL-Caltech · Lighting is illustrative</span>
          <span>Independent educational prototype; not an official NASA product and not endorsed by NASA. <a href="/about" onClick={(e) => { e.preventDefault(); navigate('/about') }}>How this was made</a></span>
        </footer>
      </div>
      {error && <p role="alert" className="stage-error">The 3D rover could not load ({error}).</p>}
    </>
  )
}
