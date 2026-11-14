import type { Ref } from 'react'
import { LEGACY, SOURCE_BY_ID } from '../content'
import { STOPS } from '../content/stops'
import { Icon } from './Icon'

const cite = (ids: string[]) =>
  ids.map((id, i) => {
    const s = SOURCE_BY_ID.get(id)
    return s ? <span key={id}>{i > 0 && ' · '}<a href={s.url} target="_blank" rel="noreferrer">{s.title}</a></span> : null
  })

/** Legacy: what NASA wanted to know, next to what Opportunity helped reveal. Every row sourced. */
export function LegacyPanel({ headingRef, onStop, onHome, onRover, onAbout }: {
  headingRef?: Ref<HTMLHeadingElement>
  onStop: (n: number) => void
  onHome: () => void
  onRover: (e: React.MouseEvent<HTMLAnchorElement>) => void
  onAbout: (e: React.MouseEvent<HTMLAnchorElement>) => void
}) {
  const L = LEGACY
  return (
    <div className="legacy">
      <h2 id="legacy-title" className="legacy__title" ref={headingRef} tabIndex={-1}>{L.title}</h2>
      <p className="legacy__intro">{L.intro}</p>
      <table className="legacy__table">
        <thead>
          <tr><th scope="col">{L.wantedHead}</th><th scope="col">{L.revealedHead}</th></tr>
        </thead>
        <tbody>
          {L.rows.map((r) => (
            <tr key={r.wanted}>
              <td className="legacy__wanted" data-head={L.wantedHead}>{r.wantedQuoted ? <q>{r.wanted}</q> : r.wanted}</td>
              <td data-head={L.revealedHead}>
                <p>{r.revealed}</p>
                <p className="legacy__cite">
                  <button type="button" className="legacy__stop" onClick={() => onStop(r.stop)}>
                    Stop {r.stop}: {STOPS[r.stop - 1].place}
                  </button>
                  {' · '}{cite(r.sourceIds)}
                </p>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="legacy__limit">{L.limitation}</p>
      <p className="legacy__closing">{L.closing}</p>
      <p className="legacy__cite">{cite(L.closingSourceIds)}</p>
      <div className="stop__actions legacy__actions">
        <button type="button" className="btn btn--next" onClick={onHome}>
          <Icon name="prev" />
          Back to the start
        </button>
        <a className="btn btn--ghost" href="/rover" onClick={onRover}>Meet the rover</a>
        <a className="btn btn--ghost" href="/about" onClick={onAbout}>How this was made</a>
      </div>
    </div>
  )
}
