import { useCallback, useEffect, useRef, useState } from 'react'
import './App.css'
import { EVENT_BY_ID, PART_BY_ID } from './content'
import { STOPS } from './content/stops'
import type { Provenance } from './engine/replay'
import type { StageController } from './stage/controller'
import type { Quality } from './stage/director'
import { ChapterRail } from './ui/ChapterRail'
import { EvidenceCard } from './ui/EvidenceCard'
import { Icon } from './ui/Icon'
import { PartCaption } from './ui/PartCaption'
import { navigate } from './nav'
import { StaticView } from './ui/StaticView'

const params = new URLSearchParams(location.search)
const DEBUG = params.has('debug')
const CLEAN = params.has('clean') // poster capture: stage only

const hasWebGL = (() => {
  try { return !!document.createElement('canvas').getContext('webgl2') } catch { return false }
})()

const PROVENANCE: Record<Provenance, string> = {
  corrected: 'Recorded position',
  interpolated: 'Between two records',
  gap: 'No position records',
}

/** parts with a leader-line label (the anchor lives in stage/lightpaint.ts) */
const LEADER: Record<string, string> = { arm: 'Turret' }
const TOOL_ABBR: Record<string, string> = { rat: 'RAT', apxs: 'APXS', mb: 'MB', mi: 'MI' }

const stopFromHash = () => {
  const m = /^#stop-(\d+)$/.exec(location.hash)
  return m ? Math.min(STOPS.length, Math.max(1, Number(m[1]))) - 1 : -1
}

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const ctrlRef = useRef<StageController | null>(null)
  const fpsRef = useRef<HTMLDivElement>(null)
  const solRef = useRef<HTMLSpanElement>(null)
  const kmRef = useRef<HTMLSpanElement>(null)
  const provRef = useRef<HTMLSpanElement>(null)
  const markerRef = useRef<HTMLSpanElement>(null)
  const leaderRef = useRef<SVGLineElement>(null)
  const leaderLabelRef = useRef<HTMLDivElement>(null)
  const partHeadRef = useRef<HTMLHeadingElement>(null)
  // the open instrument inset: part id, and whether the light has stopped on it
  const [part, setPart] = useState<string | null>(null)
  const [partReady, setPartReady] = useState(false)
  const leaderOn = useRef(false)
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [stop, setStop] = useState(-1)
  const [settled, setSettled] = useState(true)
  const [cardOpen, setCardOpen] = useState(false)
  const closeCard = useCallback(() => {
    setCardOpen(false)
    document.querySelector<HTMLButtonElement>('.btn--evidence')?.focus()
  }, [])
  const openPart = useCallback((id: string) => {
    setCardOpen(false)
    setPart(id)
    setPartReady(false)
  }, [])
  // start the light-paint on the frame after React has laid out the caption, so that work never lands mid-reveal
  useEffect(() => {
    if (!part) return
    const raf = requestAnimationFrame(() => ctrlRef.current?.showPart(part))
    return () => cancelAnimationFrame(raf)
  }, [part])
  const closePart = useCallback((refocus = true) => {
    setPart(null)
    setPartReady(false)
    leaderOn.current = false
    ctrlRef.current?.showPart(null)
    if (refocus) requestAnimationFrame(() => document.querySelector<HTMLButtonElement>('.btn--part')?.focus())
  }, [])
  const [mode, setMode] = useState<'stage' | 'static'>(!hasWebGL || params.has('static') ? 'static' : 'stage')

  const go = useCallback((n: number, opts: { push?: boolean; instant?: boolean } = {}) => {
    const next = Math.max(-1, Math.min(STOPS.length - 1, n))
    ctrlRef.current?.goTo(next, opts.instant)
    setStop(next)
    setSettled(false)
    if (opts.push !== false) {
      const url = next < 0 ? location.pathname + location.search : `#stop-${next + 1}`
      history.pushState({ stop: next }, '', url)
    }
  }, [])

  // stage lifecycle
  useEffect(() => {
    if (mode !== 'stage') return
    let disposed = false
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const q = (params.get('tier') as Quality) || 'mid'
    let lastSol = -1, lastKm = -1, lastProv = ''
    const pt = { x: 0, y: 0 }
    // three.js and the stage load as a separate chunk so the words paint first
    Promise.all([import('./stage/controller'), import('./stage/load')]).then(async ([{ StageController }, { loadStageAssets }]) => {
      const assets = await loadStageAssets()
      if (disposed || !canvasRef.current) return
      const ctrl = new StageController(canvasRef.current, assets, {
        reducedMotion: reduced, quality: q,
        onFrame: (s) => {
          const fix = assets.replay.positionAt(s.sol)
          const sol = Math.round(fix.sol), km = Math.round(fix.km * 10) / 10
          if (sol !== lastSol && solRef.current) { solRef.current.textContent = String(sol); lastSol = sol }
          if (km !== lastKm && kmRef.current) { kmRef.current.textContent = km.toFixed(1); lastKm = km }
          const prov = fix.note && fix.sol > assets.replay.lastRecordEndSol ? fix.note : PROVENANCE[fix.provenance]
          if (prov !== lastProv && provRef.current) { provRef.current.textContent = prov; lastProv = prov }
          if (markerRef.current) markerRef.current.style.left = `${((fix.sol - 1) / 5110) * 100}%`
          if (DEBUG && fpsRef.current) fpsRef.current.textContent = `${ctrl.fpsValue.toFixed(0)} fps · ${ctrl.stage.quality}`
          // leader line from the lit part to its label
          const line = leaderRef.current, label = leaderLabelRef.current
          if (line && label) {
            const ok = leaderOn.current && ctrl.stage.anchorScreen(pt)
            line.parentElement!.parentElement!.style.opacity = ok ? '1' : '0'
            if (ok) {
              const wide = innerWidth / innerHeight > 1.05
              const lx = pt.x + (wide ? 90 : -40), ly = pt.y - (wide ? 120 : 90)
              line.setAttribute('x1', String(pt.x)); line.setAttribute('y1', String(pt.y))
              line.setAttribute('x2', String(lx)); line.setAttribute('y2', String(ly))
              label.style.transform = `translate(${lx}px, ${ly}px)`
            }
          }
        },
        onSettled: () => setSettled(true),
        onPartReady: () => setPartReady(true),
      })
      ctrl.autoQuality = !params.has('tier')
      ctrlRef.current = ctrl
      // debug: ?shot=n jumps to a stop; ?cam=az,el,dist[,tx,tz,fov] overrides that shot's camera
      const shot = params.get('shot')
      const cam = params.get('cam')
      if (cam) {
        const [az, el, dist, tx, tz, fov] = cam.split(',').map(Number)
        const s = shot === null || Number(shot) < 0 ? ctrl.shots.opening : ctrl.shots.stops[Number(shot)]
        Object.assign(s.pose, { az, el, dist, ...(Number.isFinite(tx) ? { tx, tz } : {}), ...(Number.isFinite(fov) ? { fov } : {}) })
      }
      const initial = shot !== null ? Number(shot) : stopFromHash()
      if (initial >= 0 || cam) { ctrl.goTo(initial, true); setStop(initial) }
      await ctrl.warm()
      if (disposed) return
      ctrl.start()
      ;(window as unknown as { stage: StageController }).stage = ctrl
      setReady(true)
    }).catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)))
    const onResize = () => ctrlRef.current?.stage.resize()
    window.addEventListener('resize', onResize)
    return () => {
      disposed = true
      window.removeEventListener('resize', onResize)
      ctrlRef.current?.dispose()
      ctrlRef.current = null
      setReady(false)
    }
  }, [mode])

  useEffect(() => {
    setCardOpen(false)
    setPart((p) => { if (p) { leaderOn.current = false; ctrlRef.current?.showPart(null) } return null })
    setPartReady(false)
  }, [stop])
  useEffect(() => { ctrlRef.current?.setSkyPaused(cardOpen || !!part) }, [cardOpen, part])
  useEffect(() => { if (part) partHeadRef.current?.focus() }, [part])
  useEffect(() => { leaderOn.current = partReady && !!part && part in LEADER }, [part, partReady])
  useEffect(() => {
    if (!part) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closePart() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [part, closePart])

  // Back / Forward walk the stops
  useEffect(() => {
    const onPop = () => go(stopFromHash(), { push: false })
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [go])

  // keyboard: ← / → between stops, Space = next
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.altKey || e.ctrlKey || e.metaKey) return
      const t = e.target as HTMLElement
      if (t.closest('input, textarea, select, [contenteditable="true"], .print')) return
      if (e.key === 'ArrowRight' || (e.key === ' ' && !t.closest('button, a'))) {
        e.preventDefault(); go(stop + 1)
      } else if (e.key === 'ArrowLeft' && stop >= 0) {
        e.preventDefault(); go(stop - 1)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [go, stop])

  const s = stop >= 0 ? STOPS[stop] : null
  const ev = s ? EVENT_BY_ID.get(s.id) : undefined
  const journey = stop >= 0
  const stopPart = ev?.partIds.length ? PART_BY_ID.get(ev.partIds[0]) : undefined
  const openP = part ? PART_BY_ID.get(part) : undefined
  const leaderText = openP && ev && LEADER[openP.id]
    ? `${LEADER[openP.id]}: ${(openP.toolsAt?.[ev.id] ?? openP.tools?.map((t) => t.id) ?? []).map((t) => TOOL_ABBR[t] ?? t).join(openP.toolsAt?.[ev.id] ? ' → ' : ' · ')}`
    : ''

  if (mode === 'static') return <StaticView canExit={hasWebGL} onExit={() => setMode('stage')} />

  return (
    <>
      <canvas ref={canvasRef} className="stage" aria-hidden="true" data-ready={ready} />
      {!ready && !error && <img className="poster" src="/posters/rov-night.webp" alt="" />}

      {!CLEAN && <div className="ui" data-phase={journey ? 'journey' : 'opening'}>
        {!journey && (
          <section className="lead" aria-labelledby="title">
            <h1 id="title">
              Built for 90 sols.
              <span className="lead__amber">It kept going for 5,111.</span>
            </h1>
            <p className="lead__body">
              Follow NASA's Opportunity rover along its real recorded route across Meridiani Planum, Mars, and meet the
              instruments behind each discovery.
            </p>
            <button type="button" className="btn btn--primary" onClick={() => go(0)} disabled={!ready}>
              {ready ? 'Start the journey' : 'Loading the route'}
              <Icon name="next" />
            </button>
            <a className="btn btn--ghost lead__rover" href="/rover" onClick={(e) => { e.preventDefault(); navigate('/rover') }}>
              Meet the rover
            </a>
          </section>
        )}

        {journey && (
          <>
            <ChapterRail stop={stop} onChapter={(i) => go(i)} markerRef={markerRef} />
            {openP ? (
              <section className="stop stop--part" aria-labelledby="part-title" data-ready={partReady}>
                <PartCaption part={openP} eventId={ev!.id} headingRef={partHeadRef} />
                <div className="stop__actions">
                  <button type="button" className="btn btn--next" onClick={() => closePart()}>
                    <Icon name="prev" />
                    Back to the stop
                  </button>
                  <a className="btn btn--ghost" href={`/rover#${openP.id}`} onClick={(e) => { e.preventDefault(); navigate(`/rover#${openP.id}`) }}>
                    The whole rover
                  </a>
                </div>
              </section>
            ) : (
            <section className="stop" aria-labelledby="stop-title" data-settled={settled}>
              <h2 id="stop-title" className="stop__q">{ev!.question}</h2>
              <p className="stop__meta caption">
                {s!.place} · {s!.solLabel} · {ev!.time.earthDateLabel} · Stop {stop + 1} of {STOPS.length}
              </p>
              <p className="stop__finding">{ev!.finding}</p>
              <p className="stop__lead">{ev!.lead}</p>
              <div className="stop__actions">
                <button type="button" className="btn btn--evidence" aria-expanded={cardOpen} onClick={() => setCardOpen((o) => !o)}>
                  {cardOpen ? 'Hide the evidence' : 'The evidence'}
                </button>
                {stopPart && (
                  <button type="button" className="btn btn--evidence btn--part" onClick={() => openPart(stopPart.id)} disabled={!ready}>
                    {stopPart.short}
                  </button>
                )}
                {stop < STOPS.length - 1 && (
                  <button type="button" className="btn btn--next" onClick={() => go(stop + 1)}>
                    Next stop
                    <Icon name="next" />
                  </button>
                )}
                <button type="button" className="btn btn--ghost btn--icon" onClick={() => go(stop - 1)} aria-label={stop === 0 ? 'Back to the opening' : 'Previous stop'}>
                  <Icon name="prev" />
                </button>
              </div>
            </section>
            )}
            {cardOpen && <EvidenceCard event={ev!} onClose={closeCard} />}
            <div className="leader" aria-hidden="true">
              <svg><line ref={leaderRef} /></svg>
              <div ref={leaderLabelRef} className="leader__label caption">{leaderText}</div>
            </div>
            <p className="sr-only" aria-live="polite">{openP ? (partReady ? `${openP.name}, lit on the rover.` : '') : `Stop ${stop + 1} of ${STOPS.length}: ${s!.place}. ${ev!.question}`}</p>
          </>
        )}

        <aside className="labels caption" aria-label="About this view">
          <span>Night sky and light trail are illustrative; the rover drove by day.</span>
          {openP && <span>Lighting is illustrative · Model: NASA/JPL-Caltech</span>}
          {journey && <span>Rover not to scale · Flat plane, no terrain height</span>}
          {journey && <span>Route aligned to NASA map by a 2-point fit; offsets up to ~0.5 km.</span>}
        </aside>

        <footer className="band caption">
          <div className="band__row">
            {journey ? (
              <p className="band__live">
                <span>Sol <b ref={solRef}>1</b></span>
                <span>Route <b ref={kmRef}>0.0</b> km</span>
                <span ref={provRef}>Recorded position</span>
              </p>
            ) : (
              <p className="band__exif">
                <span>Sol 1 → Sol 5111 · Meridiani Planum, Mars</span>
                <span>Exposure <b>14 years</b></span>
                <span>Route <b>45.1 km</b></span>
                <span><b>21,104</b> position records</span>
              </p>
            )}
            <button type="button" className="band__btn" onClick={() => setMode('static')}>Static view</button>
          </div>
          <p className="band__fine">
            <span>Independent educational prototype; not an official NASA product and not endorsed by NASA.</span>
            <span className="band__credits">Route: MER Analyst's Notebook, PDS Geosciences Node · Model: NASA/JPL-Caltech · Map: PIA23178, NASA/JPL-Caltech/MSSS</span>
          </p>
        </footer>
      </div>}

      {error && <p role="alert" className="stage-error">The 3D stage could not load ({error}).</p>}
      {DEBUG && <div ref={fpsRef} className="fps" />}
    </>
  )
}
