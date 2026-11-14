import { useEffect, useState } from 'react'
import { EVENT_BY_ID, PART_BY_ID } from '../content'
import { navigate } from '../nav'
import { Icon } from './Icon'
import { STOPS } from '../content/stops'
import { EvidenceCard } from './EvidenceCard'
import { LegacyPanel } from './LegacyPanel'
import type { RouteFile, TraverseFile } from '../data/types'
import { createReplay } from '../engine/replay'
import { metersToPixel } from '../engine/basemap'

interface MapData { w: number; h: number; route: string[]; dashed: [number, number, number, number][]; stops: { id: string; x: number; y: number }[] }

/** Same content without WebGL or motion: the night map with the route drawn by the same 2-point fit, and a poster per stop. */
export function StaticView({ onExit, canExit }: { onExit: () => void; canExit: boolean }) {
  const [map, setMap] = useState<MapData | null>(null)

  useEffect(() => {
    let live = true
    Promise.all([
      fetch('/data/traverse.json').then((r) => r.json() as Promise<TraverseFile>),
      fetch('/data/route_simplified.json').then((r) => r.json() as Promise<RouteFile>),
    ]).then(([t, r]) => {
      if (!live) return
      const tf = t.basemapTransform
      const px = (x: number, y: number) => metersToPixel(tf, x, y).map((v) => v.toFixed(1)).join(',')
      const cuts = new Set(t.gaps.filter((g) => g.render === 'dashed').map((g) => g.afterPointIndex))
      const runs: string[][] = [[]]
      for (const [i, x, y] of r.points) {
        runs[runs.length - 1].push(px(x, y))
        if (cuts.has(i)) runs.push([])
      }
      const replay = createReplay(t)
      const dashed = t.gaps.filter((g) => g.render === 'dashed').map((g) => {
        const a = metersToPixel(tf, replay.xs[g.afterPointIndex], replay.ys[g.afterPointIndex])
        const b = metersToPixel(tf, replay.xs[g.afterPointIndex + 1], replay.ys[g.afterPointIndex + 1])
        return [a[0], a[1], b[0], b[1]] as [number, number, number, number]
      })
      const stops = STOPS.filter((s) => s.anchor).map((s) => {
        const f = replay.positionAt(s.sol)
        const [x, y] = metersToPixel(tf, f.x, f.y)
        return { id: s.id, x, y }
      })
      setMap({ w: tf.imageWidth, h: tf.imageHeight, route: runs.filter((r) => r.length > 1).map((r) => r.join(' ')), dashed, stops })
    }).catch(() => undefined)
    return () => { live = false }
  }, [])

  return (
    <main className="static">
      <header className="static__head">
        <h1>
          Built for 90 sols.
          <span className="lead__amber">It kept going for 5,111.</span>
        </h1>
        <p className="lead__body">
          Follow NASA's Opportunity rover along its real recorded route across Meridiani Planum, Mars, and meet the
          instruments behind each discovery.
        </p>
        <p className="static__switch">
          {canExit && <button type="button" className="btn btn--ghost" onClick={onExit}>Back to the 3D journey</button>}
        </p>
      </header>

      <figure className="static__map">
        {map ? (
          <svg viewBox={`0 0 ${map.w} ${map.h}`} role="img" aria-labelledby="map-cap">
            <image href="/media/ground-pia23178-clean.webp" width={map.w} height={map.h} className="static__ground" />
            {map.route.map((pts, i) => <polyline key={i} points={pts} className="static__route" />)}
            {map.dashed.map(([a, b, c, d], i) => <line key={i} x1={a} y1={b} x2={c} y2={d} className="static__gap" />)}
            {map.stops.map((s, i) => (
              <g key={s.id} transform={`translate(${s.x} ${s.y})`}>
                <circle r="16" className="static__dot" />
                <text x="26" y="10" className="static__num">{i + 1}</text>
              </g>
            ))}
          </svg>
        ) : <div className="static__placeholder" />}
        <figcaption id="map-cap" className="caption">
          Opportunity's route, sol 1 to sol 5081, drawn from 21,089 position records over PIA23178 (NASA/JPL-Caltech/MSSS;
          NASA's drawn route and labels removed). Route aligned to NASA map by a 2-point fit; offsets up to ~0.5 km.
          Dashed: no position records.
        </figcaption>
      </figure>

      <ol className="static__stops">
        {STOPS.map((s, i) => {
          const ev = EVENT_BY_ID.get(s.id)!
          return (
            <li key={s.id} id={`stop-${i + 1}`} className="static__stop">
              <div className="static__text">
                <h2>{ev.question}</h2>
                <p className="caption">{s.place} · {s.solLabel} · {ev.time.earthDateLabel} · Stop {i + 1} of {STOPS.length}</p>
                <p className="stop__finding">{ev.finding}</p>
                {ev.markers && (
                  <dl className="stop__markers">
                    {ev.markers.map((m) => <div key={m.sol}><dt>Sol {m.sol.toLocaleString('en-US')}</dt><dd>{m.label}</dd></div>)}
                  </dl>
                )}
                <p className="static__lead">{ev.lead}</p>
                {ev.dramatization && (
                  <figure className="stop__drama">
                    <blockquote><p>{ev.dramatization.text}</p></blockquote>
                    <figcaption className="caption">I, Opportunity · {ev.dramatization.label}</figcaption>
                  </figure>
                )}
                {ev.partIds.slice(0, 1).map((pid) => (
                  <p key={pid} className="static__part">
                    <a className="part__go" href={`/rover#${pid}`} onClick={(e) => { e.preventDefault(); navigate(`/rover#${pid}`) }}>
                      {PART_BY_ID.get(pid)!.short}, on the rover
                      <Icon name="next" size={16} />
                    </a>
                  </p>
                ))}
                <img src={`/posters/stop-${i + 1}.webp`} alt="" loading="lazy" width={1280} height={800} />
              </div>
              <EvidenceCard event={ev} inline />
            </li>
          )
        })}
      </ol>

      <section className="static__legacy" aria-labelledby="legacy-title">
        <LegacyPanel
          onStop={(n) => document.getElementById(`stop-${n}`)?.scrollIntoView()}
          onHome={() => window.scrollTo(0, 0)}
          onRover={(e) => { e.preventDefault(); navigate('/rover') }}
          onAbout={(e) => { e.preventDefault(); navigate('/about') }}
        />
      </section>

      <p className="static__labels caption">
        Night sky and light trail are illustrative; the rover drove by day. Rover not to scale. Flat plane, no terrain height.
        The dust storm at the Silence stop is illustrative.
      </p>
    </main>
  )
}
