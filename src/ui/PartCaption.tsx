import type { Ref } from 'react'
import { EVENTS, SOURCE_BY_ID, type Part } from '../content'
import { STOPS } from '../content/stops'
import { Icon } from './Icon'

/**
 * What a part is, how it works and what it found, from NASA's own descriptions.
 * `eventId` = shown inside a stop (only that stop's finding, tools in the order they worked);
 * without it = the rover explorer (every finding, each with a way to the stop).
 */
export function PartCaption({ part, eventId, headingRef, stopHref, onStopLink, tool }: {
  part: Part
  eventId?: string
  headingRef?: Ref<HTMLHeadingElement>
  stopHref?: (n: number) => string
  onStopLink?: (e: React.MouseEvent<HTMLAnchorElement>, n: number) => void
  /** a tool to mark (deep link /rover#rat) */
  tool?: string | null
}) {
  const order = eventId ? part.toolsAt?.[eventId] ?? [] : []
  const tools = part.tools ? [...part.tools].sort((a, b) => rank(order, a.id) - rank(order, b.id)) : []
  const findings = eventId
    ? (part.found[eventId] ? [[eventId, part.found[eventId]] as const] : [])
    : EVENTS.flatMap((e) => (part.found[e.id] ? [[e.id, part.found[e.id]] as const] : []))
  const quoteSrc = SOURCE_BY_ID.get(part.quote.sourceId)

  const factsEl = (
    <dl className="part__facts">
      <dt>What it is</dt>
      <dd>{part.whatItIs}</dd>
      <dt>How it works</dt>
      <dd>{part.howItWorks}</dd>
    </dl>
  )
  const toolsEl = tools.length > 0 && (
    <ol className="part__tools" aria-label={order.length ? 'Tools on the turret, in the order they worked here' : 'Tools on the turret'}>
      {tools.map((t) => {
        const n = order.indexOf(t.id)
        return (
          <li key={t.id} id={`tool-${t.id}`} data-used={n >= 0 || undefined} data-marked={tool === t.id || undefined}>
            <span className="part__step" aria-hidden="true">{n >= 0 ? n + 1 : ''}</span>
            <span><b>{t.name}</b> {t.job}{n >= 0 && <span className="sr-only"> (used here, step {n + 1})</span>}</span>
          </li>
        )
      })}
    </ol>
  )
  const foundEl = (
    <>
      <h3 className="part__h">{eventId ? 'What it found here' : 'What it found'}</h3>
      {findings.length === 0 && <p className="part__found">Used throughout the mission.</p>}
      {findings.map(([eid, text]) => {
        const n = STOPS.findIndex((s) => s.id === eid) + 1
        return (
          <div key={eid} className="part__found">
            {!eventId && <p className="part__where caption">Stop {n} · {STOPS[n - 1].place}</p>}
            <p>{text}</p>
            {!eventId && stopHref && (
              <a className="part__go" href={stopHref(n)} onClick={(e) => onStopLink?.(e, n)}>
                See it at Stop {n}
                <Icon name="next" size={16} />
              </a>
            )}
          </div>
        )
      })}
    </>
  )

  return (
    <div className="part">
      <h2 id="part-title" className="part__name" ref={headingRef} tabIndex={-1}>{part.name}</h2>
      {/* inside a stop the link to that stop's discovery leads; in the explorer, the part itself does */}
      {eventId ? <>{foundEl}{toolsEl}{factsEl}</> : <>{factsEl}{toolsEl}{foundEl}</>}

      <figure className="part__quote">
        <blockquote><p>{part.quote.text}</p></blockquote>
        <figcaption>
          {part.quote.who}
          {quoteSrc && <> · <a href={quoteSrc.url} target="_blank" rel="noreferrer">{quoteSrc.institution}</a></>}
        </figcaption>
      </figure>

      <p className="part__sources caption">
        Sources:{' '}
        {part.sourceIds.map((id, i) => {
          const s = SOURCE_BY_ID.get(id)
          return s ? <span key={id}>{i > 0 && ' · '}<a href={s.url} target="_blank" rel="noreferrer">{s.title}</a></span> : null
        })}
      </p>
    </div>
  )
}

const rank = (order: string[], id: string) => { const i = order.indexOf(id); return i < 0 ? 99 : i }
