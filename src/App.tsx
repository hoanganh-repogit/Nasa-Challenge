import { useCallback, useEffect, useRef, useState } from 'react'
import './App.css'
import { STOPS } from './content/stops'
import type { Provenance } from './engine/replay'
import type { StageController } from './stage/controller'
import type { Quality } from './stage/director'
import { ChapterRail } from './ui/ChapterRail'
import { Icon } from './ui/Icon'
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
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [stop, setStop] = useState(-1)
  const [settled, setSettled] = useState(true)
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
        },
        onSettled: () => setSettled(true),
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
      if (t.closest('input, textarea, select, [contenteditable="true"]')) return
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
  const journey = stop >= 0

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
          </section>
        )}

        {journey && (
          <>
            <ChapterRail stop={stop} onChapter={(i) => go(i)} markerRef={markerRef} />
            <section className="stop" aria-live="polite" aria-labelledby="stop-title" data-settled={settled}>
              <h2 id="stop-title" className="stop__place">{s!.place}</h2>
              <p className="stop__meta caption">
                Stop {stop + 1} of {STOPS.length} · {s!.solLabel} · {s!.earthDate}
              </p>
            </section>
            <div className="nav">
              <button type="button" className="btn btn--ghost" onClick={() => go(stop - 1)} aria-label={stop === 0 ? 'Back to the opening' : 'Previous stop'}>
                <Icon name="prev" />
                <span className="nav__label">{stop === 0 ? 'Opening' : 'Previous'}</span>
              </button>
              {stop < STOPS.length - 1 && (
                <button type="button" className="btn btn--next" onClick={() => go(stop + 1)}>
                  Next stop
                  <Icon name="next" />
                </button>
              )}
            </div>
          </>
        )}

        <aside className="labels caption" aria-label="About this view">
          <span>Night sky and light trail are illustrative; the rover drove by day.</span>
          {journey && <span>Rover not to scale · Flat plane, no terrain height</span>}
          {journey && <span>Route aligned to NASA map by a 2-point fit; offsets up to ~0.5 km.</span>}
        </aside>

        <footer className="band caption">
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
          <p className="band__sources">
            Route: MER Analyst's Notebook, PDS Geosciences Node · Model: NASA · Map: PIA23178, NASA/JPL-Caltech/MSSS
            <button type="button" className="band__btn" onClick={() => setMode('static')}>Static view</button>
          </p>
        </footer>
      </div>}

      {error && <p role="alert" className="stage-error">The 3D stage could not load ({error}).</p>}
      {DEBUG && <div ref={fpsRef} className="fps" />}
    </>
  )
}
