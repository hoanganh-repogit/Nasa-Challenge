import { useEffect, type MouseEvent } from 'react'
import '../App.css'
import './about.css'
import { MEDIA, SOURCES, SOURCE_BY_ID } from '../content'
import rec from '../content/reconstruction.json'
import { navigate } from '../nav'
import { Icon } from '../ui/Icon'

const NUM = new Intl.NumberFormat('en-US')

const link = (path: string) => (e: MouseEvent<HTMLAnchorElement>) => {
  if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey) return
  e.preventDefault()
  navigate(path)
}

const Src = ({ id, children }: { id: string; children?: React.ReactNode }) => {
  const s = SOURCE_BY_ID.get(id)
  return s ? <a href={s.url} target="_blank" rel="noreferrer">{children ?? s.title}</a> : <>{children}</>
}

/** How this was made: what is real, what is illustrative, how the route was rebuilt, and every credit. */
export default function AboutPage() {
  useEffect(() => { document.title = 'How this was made · Echoes of the Cosmos'; window.scrollTo(0, 0) }, [])

  return (
    <main className="about">
      <nav aria-label="Site">
        <a className="about__home caption" href="/" onClick={link('/')}>
          <Icon name="prev" size={16} />
          The journey
        </a>
      </nav>

      <h1>How this was made</h1>
      <p className="about__lede">
        The rover route is visualized from NASA's historical records. Some in-between positions are interpolated for
        animation. Cinematic transitions are artistic reconstructions and should not be interpreted as recorded imagery or
        exact telemetry.
      </p>
      <p>
        The code and the words on this site were written with the help of an SI (AI) assistant (Claude, by Anthropic);
        the words come only from the sources listed below. The film's English voice-over is an SI-generated synthetic
        voice. Every fact links to its source. NASA has not reviewed or endorsed this site.
      </p>

      <section aria-labelledby="real">
        <div className="about__two">
          <div>
            <h2 id="real">What is real</h2>
            <ul>
              <li>Every position on the route: {NUM.format(rec.records)} records, sol {rec.firstSol} to sol {NUM.format(rec.lastRecordSol)}.</li>
              <li>The sols and Earth dates at each stop.</li>
              <li>The photographs: all by NASA missions, credited below.</li>
              <li>The rover's shape: NASA's own 3D model of Spirit and Opportunity.</li>
              <li>The facts in every caption, each with its source.</li>
            </ul>
          </div>
          <div>
            <h2>What is illustrative</h2>
            <ul>
              <li>The night sky and star trails. <strong>The rover drove by day.</strong></li>
              <li>The glowing light trail, and the brighter glow where many records pile up.</li>
              <li>The rover's size on the map: it is not to scale.</li>
              <li>The flat ground: there is no terrain height.</li>
              <li>The dust storm at the Silence stop, and the lighting on the rover.</li>
              <li>The one line written as "I, Opportunity". It is a narrative dramatization, not a message from the rover.</li>
            </ul>
          </div>
        </div>
      </section>

      <section aria-labelledby="route">
        <h2 id="route">The route</h2>
        <p>
          The positions come from the <Src id="SRC-TRAVERSE">MER Opportunity traverse table (MERB_traverse_5130)</Src> in the
          MER Analyst's Notebook at the PDS Geosciences Node, Washington University in St. Louis; traverse by Tim Parker. Its
          label says it is not a formally archived PDS product.
        </p>
        <p>
          The table has {NUM.format(rec.tableRows)} rows. {rec.duplicateRowsDropped} of them are exact copies of another row,
          so the trail is drawn from {NUM.format(rec.records)} position records. The records end on sol {NUM.format(rec.lastRecordSol)};
          the rover's last message came on sol {NUM.format(rec.lastContactSol)}, so after sol {NUM.format(rec.lastRecordSol)} the
          rover waits at its last recorded position.
        </p>
        <p>
          The table gives a position for each drive, not for each moment. On the stage the rover waits at a record, then
          moves to the next one; when several records share a sol, that sol is split evenly between them. Positions between
          two records are drawn in a straight line and labelled "Between two records".
        </p>
        <p>
          Adding up the straight lines between records gives {rec.routeKm.toFixed(1)} km. NASA's{' '}
          <Src id="SRC-PIA23178">final traverse map</Src> gives {rec.nasaKm} km. Different ways of measuring give slightly
          different totals.
        </p>
      </section>

      <section aria-labelledby="fit">
        <h2 id="fit">Lining the route up with NASA's map</h2>
        <p>
          The ground is NASA's <Src id="SRC-PIA23178">PIA23178</Src> map (NASA/JPL-Caltech/MSSS). The route was pinned to it
          at two points, its first record (Eagle crater) and its last (Perseverance Valley), with a 2-point fit:{' '}
          {rec.fit.metersPerPixel} metres per pixel, turned {rec.fit.rotationDeg}°. Elsewhere the route can sit up to about{' '}
          {rec.fit.maxOffsetKm} km away from where NASA drew it. On the 3D ground, NASA's own yellow route line, labels and
          scale bar were painted out so the two routes do not double up; the photo on the evidence card is NASA's original.
        </p>
      </section>

      <section aria-labelledby="gaps">
        <h2 id="gaps">Six gaps in the records</h2>
        <p>
          A gap is a stretch of more than {rec.gapRule.maxUncoveredSols} sols with no position record. The rover is never
          moved through a gap: it waits, then appears at the next record. Where it moved more than{' '}
          {rec.gapRule.gapJumpMinMeters} m during a gap, the trail shows a dashed line.
        </p>
        <table className="about__table">
          <thead>
            <tr><th scope="col">Sols with no record</th><th scope="col">Moved during the gap</th><th scope="col">On the stage</th></tr>
          </thead>
          <tbody>
            {rec.gaps.map((g) => (
              <tr key={g.fromSol}>
                <td>{NUM.format(g.fromSol)} to {NUM.format(g.toSol)}</td>
                <td>{g.jumpMeters < 0.05 ? 'none' : `${NUM.format(g.jumpMeters)} m`}</td>
                <td>{g.render === 'dashed' ? 'Dashed line' : 'Rover waits'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section aria-labelledby="credits">
        <h2 id="credits">Credits</h2>
        <h3>Photographs and maps</h3>
        <ul className="about__credits">
          {MEDIA.map((m) => (
            <li key={m.id}>
              <a href={m.originalUrl} target="_blank" rel="noreferrer">{m.title}</a>
              <span>{m.pia} · {m.credit}</span>
            </li>
          ))}
        </ul>
        <h3>Rover model</h3>
        <p><Src id="SRC-MER-MODEL" /> · NASA/JPL-Caltech</p>
        <h3>Images and use</h3>
        <p>
          Images are used under the <Src id="SRC-JPL-IMAGE-POLICY" />. No NASA or JPL logo is used, and nothing here implies
          endorsement.
        </p>
        <h3>Type and code</h3>
        <p>Commissioner typeface (SIL Open Font License). Built with three.js and React (MIT License).</p>
      </section>

      <section aria-labelledby="sources">
        <h2 id="sources">Sources</h2>
        <ol className="about__sources">
          {SOURCES.map((s) => (
            <li key={s.id}>
              <a href={s.url} target="_blank" rel="noreferrer">{s.title}</a>
              <span>{s.institution}{s.published ? `, ${s.published.slice(0, 4)}` : ''} · checked {s.verifiedOn}</span>
              {s.caveat && <span className="about__caveat">{s.caveat}</span>}
            </li>
          ))}
        </ol>
      </section>

      <p className="about__fine caption">
        Independent educational prototype; not an official NASA product and not endorsed by NASA. Made for NASA Space Apps
        Challenge 2026, "Abandoned but not Forgotten".
      </p>
    </main>
  )
}
