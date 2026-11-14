// /film: the 30 s film, drawn by the real stage. ?render freezes the clock and exposes
// window.seek(t), window.DURATION and window.FPS for frame-by-frame capture (scripts/capture_film.mjs).
// Without ?render it is a player for visitors: the picture follows the sound track (voice-over and music), with
// Back, Replay and Sound controls, scaled to fit any screen.
import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { flushSync } from 'react-dom'
import '../App.css'
import './film.css'
import type { MissionStage } from '../stage/createMissionStage'
import captions from '../../film/captions.json'
import { navigate } from '../nav'
import { Icon } from '../ui/Icon'
import { BEATS, countAt, DURATION, FPS, frameAt, SCENES, show } from './script'

const RENDER = new URLSearchParams(location.search).has('render')
const NUM = new Intl.NumberFormat('en-US')
const SOUND = '/film/echoes-of-the-cosmos-30s.m4a'
const VIDEO = '/film/echoes-of-the-cosmos-30s.mp4'
/** the overlay is laid out for 1600x900 and scaled to fit the window */
const fitScale = () => Math.min(innerWidth / 1600, innerHeight / 900)

interface Readout { sol: number; km: number }

/** Portrait phones: the 16:9 film would be a sliver, so play the finished video (captions burned in) instead. */
function PortraitFilm() {
  useEffect(() => { document.title = 'Film · Echoes of the Cosmos' }, [])
  return (
    <main className="film-m">
      <a className="film__btn" href="/" onClick={(e) => { e.preventDefault(); navigate('/') }}>
        <Icon name="prev" size={16} /> The site
      </a>
      <h1>Echoes of the Cosmos, in 30 seconds</h1>
      {/* captions are burned into the picture */}
      <video src={VIDEO} controls playsInline autoPlay preload="auto" poster="/posters/stop-1.webp" />
      <p className="caption">English voice-over (SI-generated synthetic voice) and captions. Turn your phone sideways for a bigger picture.</p>
    </main>
  )
}

const PORTRAIT = !RENDER && typeof matchMedia === 'function' && matchMedia('(orientation: portrait) and (max-width: 900px)').matches

export default function FilmPage() {
  if (PORTRAIT) return <PortraitFilm />
  return <LandscapeFilm />
}

function LandscapeFilm() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const lineRef = useRef<SVGLineElement>(null)
  const [t, setT] = useState(0)
  const [read, setRead] = useState<Readout>({ sol: 1, km: 0 })
  const [leader, setLeader] = useState<{ x: number; y: number } | null>(null)
  const [scale, setScale] = useState(RENDER ? 1 : fitScale())
  const [needTap, setNeedTap] = useState(false)
  const [ended, setEnded] = useState(false)
  const [muted, setMuted] = useState(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const startRef = useRef<() => void>(() => {})

  useEffect(() => {
    document.title = 'Film · Echoes of the Cosmos'
    let disposed = false
    let raf = 0
    let stage: MissionStage | null = null
    Promise.all([import('../stage/createMissionStage'), import('../stage/load'), import('../stage/director')]).then(
      async ([{ createMissionStage }, { loadStageAssets }, { buildShots }]) => {
        const assets = await loadStageAssets()
        if (disposed || !canvasRef.current) return
        stage = createMissionStage(canvasRef.current, assets, 'high')
        const shots = buildShots(assets.replay)
        const pt = { x: 0, y: 0 }
        const draw = (time: number) => {
          const f = frameAt(time, shots, assets.replay)
          stage!.paintAt(f.part, f.paintStart)
          stage!.render(f.state)
          const fix = assets.replay.positionAt(f.state.sol)
          const ok = time >= BEATS.lit && f.state.inset > 0.9 && stage!.anchorScreen(pt)
          flushSync(() => {
            setT(time)
            setRead({ sol: Math.round(fix.sol), km: Math.round(fix.km * 10) / 10 })
            setLeader(ok ? { x: pt.x, y: pt.y } : null)
          })
        }
        stage.resize()
        await stage.warm([0, 5, 8, 11, 16, 24, 29].map((s) => frameAt(s, shots, assets.replay).state))
        if (disposed) return
        const w = window as unknown as { seek: (t: number) => void; DURATION: number; FPS: number }
        w.DURATION = DURATION
        w.FPS = FPS
        w.seek = draw
        draw(0)
        if (!RENDER) {
          // the sound track is the clock; if the browser blocks sound, play silently and offer a button
          const audio = new Audio(SOUND)
          audio.preload = 'auto'
          audioRef.current = audio
          const clock = { sound: false, t0: performance.now(), done: false }
          const start = () => {
            clock.done = false
            setEnded(false)
            audio.currentTime = 0
            clock.t0 = performance.now()
            audio.play().then(() => { clock.sound = true; setNeedTap(false) }).catch(() => { clock.sound = false; setNeedTap(true) })
          }
          startRef.current = start
          start()
          const loop = (now: number) => {
            raf = requestAnimationFrame(loop)
            if (clock.done) return
            let time = clock.sound ? audio.currentTime : (now - clock.t0) / 1000
            if (time >= DURATION - 0.02 || (clock.sound && audio.ended)) { time = DURATION - 0.02; clock.done = true; setEnded(true) }
            draw(time)
          }
          raf = requestAnimationFrame(loop)
        }
      },
    )
    const onResize = () => { stage?.resize(); if (!RENDER) setScale(fitScale()) }
    window.addEventListener('resize', onResize)
    return () => {
      disposed = true
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', onResize)
      audioRef.current?.pause()
      stage?.dispose()
    }
  }, [])

  const [d0, d1] = SCENES.drive
  const readout = Math.max(show(t, d0 + 0.2, d1), show(t, SCENES.toEsperance[0] + 0.1, SCENES.toEsperance[1]), show(t, SCENES.toSilence[0] + 0.1, SCENES.toSilence[1]))
  const esp = SCENES.esperance, sil = SCENES.silence
  // voice-over captions (film/captions.json, written by film/narrate.py with the voice track)
  const cap = captions.find((c) => t >= c.start && t < c.end)

  return (
    <div className="film">
      <canvas ref={canvasRef} className="stage" aria-hidden="true" data-ready="true" />

      <div className="film__ui" style={{ '--s': scale } as CSSProperties}>
      <section className="film__open" style={{ opacity: show(t, 0.15, SCENES.opening[1] + 0.25, 0.35) }}>
        <h1>
          Built for 90 sols.
          <span className="lead__amber">It kept going for {NUM.format(countAt(t))}.</span>
        </h1>
        <p>NASA's Opportunity rover · Meridiani Planum, Mars</p>
      </section>

      <p className="film__readout caption" style={{ opacity: readout }}>
        <span>Sol <b>{NUM.format(read.sol)}</b></span>
        <span>Route <b>{read.km.toFixed(1)}</b> km</span>
      </p>

      <section className="film__cap" style={{ opacity: show(t, SCENES.purgatory[0] + 0.2, SCENES.purgatory[1] + 0.1) }}>
        <p className="film__where caption">Purgatory dune · 2005</p>
        <h2>Stuck for more than five weeks.</h2>
        <p>326 position records in almost one spot, so the trail glows brighter here.</p>
      </section>

      <section className="film__cap" style={{ opacity: show(t, BEATS.lit, esp[1] - 0.2) }}>
        <p className="film__where caption">Esperance · 2013</p>
        <h2>First the RAT ground into the rock. Then APXS read what it was made of.</h2>
        <p>Clay minerals: water that was not harshly acidic.</p>
        <figure className="film__print" style={{ opacity: show(t, BEATS.lit + 0.6, esp[1] - 0.2) }}>
          <img src="/media/pia17074.webp" alt="" />
          <figcaption>PIA17074 · NASA/JPL-Caltech/Cornell Univ./Arizona State Univ. · false colour</figcaption>
        </figure>
      </section>

      <section className="film__cap" style={{ opacity: show(t, sil[0] + 0.3, sil[1] + 0.1) }}>
        <p className="film__where caption">Perseverance Valley · June 2018</p>
        <h2>A planet-wide dust storm blocked the Sun.</h2>
        <dl className="stop__markers">
          <div><dt>Sol 5,081</dt><dd>Last position record</dd></div>
          <div><dt>Sol 5,111</dt><dd>Last message received</dd></div>
        </dl>
      </section>

      <section className="film__end" style={{ opacity: show(t, BEATS.title, DURATION + 1, 0.5) }}>
        <h2>Echoes of the Cosmos</h2>
        <p>Opportunity's real route: 21,089 position records, 45 kilometres, over 14 years.</p>
        <p className="film__url">echoes-of-the-cosmos-2026.vercel.app</p>
      </section>

      {cap && <p className="film__sub" style={{ opacity: show(t, cap.start, cap.end, 0.1) }}>{cap.text}</p>}

      {!RENDER && <p className="film__si caption">SI-generated voice-over · SI-assisted code</p>}
      <aside className="film__labels caption">
        <span>Night sky and light trail are illustrative; the rover drove by day.</span>
        {t >= SCENES.dive[0] && <span>Rover not to scale · Flat plane, no terrain height</span>}
        {t >= esp[0] && t < esp[1] && <span>Lighting is illustrative</span>}
        {t >= SCENES.toSilence[0] + 0.6 && t < sil[1] + 0.3 && <span>Dust storm is illustrative</span>}
      </aside>
      <p className="film__credit">
        Independent educational prototype; not an official NASA product. Route: MER Analyst's Notebook, PDS Geosciences Node ·
        Model: NASA/JPL-Caltech · Map: PIA23178, NASA/JPL-Caltech/MSSS
      </p>
      </div>

      {leader && (
        <div className="film__leader" aria-hidden="true">
          <svg><line ref={lineRef} x1={leader.x} y1={leader.y} x2={leader.x + 90 * scale} y2={leader.y - 120 * scale} /></svg>
          <span className="leader__label caption" style={{ transform: `translate(${leader.x + 90 * scale}px, ${leader.y - 120 * scale}px)`, fontSize: `${0.95 * Math.max(scale, 0.6)}rem` }}>Turret: RAT → APXS</span>
        </div>
      )}

      {!RENDER && (
        <nav className="film__player" aria-label="Film">
          <a className="film__btn" href="/" onClick={(e) => { e.preventDefault(); navigate('/') }}>
            <Icon name="prev" size={16} /> The site
          </a>
          <button type="button" className="film__btn" onClick={() => startRef.current()}>Replay</button>
          <button
            type="button" className="film__btn" aria-pressed={muted}
            onClick={() => { const a = audioRef.current; if (a) { a.muted = !a.muted; setMuted(a.muted) } }}
          >
            {muted ? 'Sound off' : 'Sound on'}
          </button>
          <a className="film__btn" href={VIDEO} target="_blank" rel="noreferrer">Video file</a>
        </nav>
      )}
      {!RENDER && needTap && !ended && (
        <button type="button" className="btn btn--primary film__tap" onClick={() => startRef.current()}>
          <Icon name="play" /> Play with sound
        </button>
      )}
      {!RENDER && ended && (
        <div className="film__again">
          <button type="button" className="btn btn--primary" onClick={() => startRef.current()}>Watch again</button>
          <a className="btn btn--ghost" href="/" onClick={(e) => { e.preventDefault(); navigate('/') }}>Explore the site</a>
        </div>
      )}
    </div>
  )
}
