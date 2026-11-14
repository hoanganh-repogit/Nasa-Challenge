import { useCallback, useEffect, useRef, useState, type MouseEvent } from 'react'
import './App.css'
import { EVENT_BY_ID, LEGACY, PART_BY_ID } from './content'
import { STOPS } from './content/stops'
import type { Provenance } from './engine/replay'
import type { StageController } from './stage/controller'
import type { Quality } from './stage/director'
import { ChapterRail } from './ui/ChapterRail'
import { EvidenceCard } from './ui/EvidenceCard'
import { Icon } from './ui/Icon'
import { LegacyPanel } from './ui/LegacyPanel'
import { PartCaption } from './ui/PartCaption'
import { navigate, spaNavigated } from './nav'
import { reducedMotionNow, setReducedMotion, useReducedMotion } from './motion'
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

interface JourneyState { journey?: boolean; fromHome?: boolean }

// A fresh load straight onto a stop (/#stop-6) gets the opening screen underneath it, so Back leads home.
if (!spaNavigated && /^#stop-\d+$/.test(location.hash) && !params.has('shot')) {
  const hash = location.hash
  history.replaceState(null, '', location.pathname + location.search)
  history.pushState({ journey: true, fromHome: true } satisfies JourneyState, '', hash)
}

const NUM = new Intl.NumberFormat('en-US')

/** The opening's number counts up from the design life to the real one, once per showing. */
function CountUp({ from, to, ms, reduced }: { from: number; to: number; ms: number; reduced: boolean }) {
  const ref = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    if (reduced) return
    let raf = 0
    const t0 = performance.now() + 450
    const tick = (t: number) => {
      const k = Math.min(1, Math.max(0, (t - t0) / ms))
      const e = k >= 1 ? 1 : 1 - Math.pow(2, -10 * k)
      if (ref.current) ref.current.textContent = NUM.format(Math.round(from + (to - from) * e))
      if (k < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [from, to, ms, reduced])
  return (
    <>
      <span ref={ref} className="countup" aria-hidden="true">{NUM.format(reduced ? to : from)}</span>
      <span className="sr-only">{NUM.format(to)}</span>
    </>
  )
}

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
  // Legacy (after the last stop): the two-column panel, the camera high above the whole exposure
  const [legacy, setLegacy] = useState(false)
  const legacyHeadRef = useRef<HTMLHeadingElement>(null)
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
  const reduced = useReducedMotion()
  useEffect(() => { ctrlRef.current?.setReducedMotion(reduced) }, [reduced, ready])
  const [mode, setMode] = useState<'stage' | 'static'>(!hasWebGL || params.has('static') ? 'static' : 'stage')

  /**
   * History: the whole journey is one entry on top of the opening screen. Stops replace each other,
   * so Back (browser or phone) from any stop lands on the opening; "Back to the start" does the same.
   */
  const go = useCallback((n: number, opts: { push?: boolean; instant?: boolean } = {}) => {
    const next = Math.max(-1, Math.min(STOPS.length - 1, n))
    const st = (history.state ?? {}) as JourneyState
    if (opts.push !== false && next < 0 && st.fromHome) {
      history.back() // popstate brings the opening back
      return
    }
    ctrlRef.current?.goTo(next, opts.instant)
    setStop(next)
    setSettled(false)
    if (opts.push === false) return
    if (next < 0) history.pushState(null, '', location.pathname + location.search)
    else if (st.journey) history.replaceState(st, '', `#stop-${next + 1}`)
    // a stop typed into the address bar: keep it as the single journey entry
    else if (/^#stop-\d+$/.test(location.hash)) history.replaceState({ journey: true } satisfies JourneyState, '', `#stop-${next + 1}`)
    else history.pushState({ journey: true, fromHome: true } satisfies JourneyState, '', `#stop-${next + 1}`)
  }, [])
  const goHome = useCallback(() => go(-1), [go])

  // stage lifecycle
  useEffect(() => {
    if (mode !== 'stage') return
    let disposed = false
    const reduced = reducedMotionNow()
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
              const lx = pt.x + (wide ? 90 : -40), ly = pt.y - (wide ? 120 : 64)
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
    setLegacy(false)
    setPart((p) => { if (p) { leaderOn.current = false; ctrlRef.current?.showPart(null) } return null })
    setPartReady(false)
  }, [stop])
  useEffect(() => { ctrlRef.current?.setSkyPaused(cardOpen || !!part) }, [cardOpen, part])
  const openLegacy = useCallback(() => { setCardOpen(false); setLegacy(true) }, [])
  // rise on the frame after React has laid out the table, so that work never lands mid-flight
  useEffect(() => {
    if (!legacy) return
    const raf = requestAnimationFrame(() => ctrlRef.current?.goLegacy(true))
    return () => cancelAnimationFrame(raf)
  }, [legacy])
  const closeLegacy = useCallback(() => {
    setLegacy(false)
    ctrlRef.current?.goLegacy(false)
    requestAnimationFrame(() => document.querySelector<HTMLButtonElement>('.btn--legacy')?.focus())
  }, [])
  useEffect(() => { if (legacy) legacyHeadRef.current?.focus() }, [legacy])
  useEffect(() => {
    if (!legacy) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closeLegacy() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [legacy, closeLegacy])
  const toPage = (path: string) => (e: MouseEvent<HTMLAnchorElement>) => {
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey) return
    e.preventDefault()
    navigate(path)
  }
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
      if (t.closest('input, textarea, select, [contenteditable="true"], .print, .legacy')) return
      if (e.key === 'ArrowRight' || (e.key === ' ' && !t.closest('button, a'))) {
        e.preventDefault(); go(stop + 1)
      } else if (e.key === 'ArrowLeft' && stop >= 0) {
        e.preventDefault(); go(stop - 1)
      } else if (e.key === 'Home' && stop >= 0) {
        e.preventDefault(); goHome()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [go, goHome, stop])

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
              <span className="lead__amber">It kept going for <CountUp from={90} to={5111} ms={1900} reduced={reduced} />.</span>
            </h1>
            <p className="lead__body">
              Follow NASA's Opportunity rover along its real recorded route across Meridiani Planum, Mars, and meet the
              instruments behind each discovery.
            </p>
            <div className="lead__actions">
              <button type="button" className="btn btn--primary" onClick={() => go(0)} disabled={!ready}>
                {ready ? 'Start the journey' : 'Loading the route'}
                <Icon name="next" />
              </button>
              <a className="btn btn--ghost lead__rover" href="/rover" onClick={toPage('/rover')}>
                Meet the rover
              </a>
            </div>
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
            ) : legacy ? (
              <section className="stop stop--legacy" aria-labelledby="legacy-title">
                <LegacyPanel
                  headingRef={legacyHeadRef}
                  onStop={(n) => go(n - 1)}
                  onHome={goHome}
                  onRover={toPage('/rover')}
                  onAbout={toPage('/about')}
                />
              </section>
            ) : (
            <section className="stop" aria-labelledby="stop-title" data-settled={settled}>
              <h2 id="stop-title" className="stop__q">{ev!.question}</h2>
              <p className="stop__meta caption">
                {s!.place} · {s!.solLabel} · {ev!.time.earthDateLabel} · Stop {stop + 1} of {STOPS.length}
              </p>
              <p className="stop__finding">{ev!.finding}</p>
              {ev!.markers && (
                <dl className="stop__markers">
                  {ev!.markers.map((m) => (
                    <div key={m.sol}><dt>Sol {NUM.format(m.sol)}</dt><dd>{m.label}</dd></div>
                  ))}
                </dl>
              )}
              <p className="stop__lead">{ev!.lead}</p>
              {ev!.dramatization && (
                <figure className="stop__drama">
                  <blockquote><p>{ev!.dramatization.text}</p></blockquote>
                  <figcaption className="caption">I, Opportunity · {ev!.dramatization.label}</figcaption>
                </figure>
              )}
              <div className="stop__actions">
                <button type="button" className="btn btn--evidence" aria-expanded={cardOpen} onClick={() => setCardOpen((o) => !o)}>
                  {cardOpen ? 'Hide the evidence' : 'The evidence'}
                </button>
                {stopPart && (
                  <button type="button" className="btn btn--evidence btn--part" onClick={() => openPart(stopPart.id)} disabled={!ready}>
                    {stopPart.short}
                  </button>
                )}
                {stop < STOPS.length - 1 ? (
                  <button type="button" className="btn btn--next" onClick={() => go(stop + 1)}>
                    Next stop
                    <Icon name="next" />
                  </button>
                ) : (
                  <button type="button" className="btn btn--next btn--legacy" onClick={openLegacy}>
                    What it all revealed
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
            <p className="sr-only" aria-live="polite">{legacy ? `${LEGACY.title}.` : openP ? (partReady ? `${openP.name}, lit on the rover.` : '') : `Stop ${stop + 1} of ${STOPS.length}: ${s!.place}. ${ev!.question}`}</p>
          </>
        )}

        <aside className="labels caption" aria-label="About this view">
          <span>Night sky and light trail are illustrative; the rover drove by day.</span>
          {openP && <span>Lighting is illustrative · Model: NASA/JPL-Caltech</span>}
          {ev?.id === 'evt-last-contact' && !openP && <span>Dust storm is illustrative</span>}
          {journey && <span>Rover not to scale · Flat plane, no terrain height</span>}
          {journey && <span className="labels__long">Route aligned to NASA map by a 2-point fit; offsets up to ~0.5 km.</span>}
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
            <div className="band__btns">
              {journey && (
                <button type="button" className="band__btn" onClick={goHome} aria-keyshortcuts="Home" aria-label="Back to the start">
                  <span className="lbl-long">Back to the start</span><span className="lbl-short" hidden>Home</span>
                </button>
              )}
              <button
                type="button" className="band__btn" aria-pressed={reduced} aria-label="Reduce motion"
                title={reduced ? 'Camera moves are cut and the sky is still. Click to turn motion back on.' : 'Cut camera moves and stop the sky'}
                onClick={() => setReducedMotion(!reduced)}
              >
                {reduced ? 'Motion off' : 'Reduce motion'}
              </button>
              <button type="button" className="band__btn" onClick={() => setMode('static')}>Static view</button>
            </div>
          </div>
          <p className="band__fine">
            <span>Independent educational prototype; not an official NASA product and not endorsed by NASA. <a href="/about" onClick={toPage('/about')}>How this was made</a></span>
            <span className="band__credits">Route: MER Analyst's Notebook, PDS Geosciences Node · Model: NASA/JPL-Caltech · Map: PIA23178, NASA/JPL-Caltech/MSSS</span>
          </p>
        </footer>
      </div>}

      {error && <p role="alert" className="stage-error">The 3D stage could not load ({error}).</p>}
      {DEBUG && <div ref={fpsRef} className="fps" />}
    </>
  )
}
