import { useEffect, useRef } from 'react'
import { faqFor, MEDIA_BY_ID, SOURCE_BY_ID, type StoryEvent } from '../content'

/** The evidence for one stop, laid out like a developed print: NASA picture, credit, then the reading. */
export function EvidenceCard({ event, onClose, inline = false }: { event: StoryEvent; onClose?: () => void; inline?: boolean }) {
  const headRef = useRef<HTMLHeadingElement>(null)
  useEffect(() => { if (!inline) headRef.current?.focus() }, [event.id, inline])
  useEffect(() => {
    if (inline || !onClose) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, inline])

  const img = event.mediaIds.map((id) => MEDIA_BY_ID.get(id)).find(Boolean)
  const quoteSrc = event.quote ? SOURCE_BY_ID.get(event.quote.sourceId) : null
  const sources = event.sourceIds.map((id) => SOURCE_BY_ID.get(id)).filter((s) => !!s)

  return (
    <aside className={inline ? 'print print--inline' : 'print'} aria-labelledby={`print-title-${event.id}`}>
      {!inline && <button type="button" className="print__close" onClick={onClose} aria-label="Close the evidence">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
      </button>}
      {img && (
        <figure className="print__photo">
          <img src={img.src} alt={img.alt} />
          <figcaption>
            <span className="print__ptitle">{img.title}</span>
            <span>
              {img.pia} · {img.credit}
              {img.capturedAt ? ` · ${img.capturedAt}` : ''}
              {img.colour ? ` · ${img.colour}` : ''}
            </span>
            {img.notes && <span className="print__note">{img.notes}</span>}
          </figcaption>
        </figure>
      )}
      <div className="print__body">
        <h3 id={`print-title-${event.id}`} ref={headRef} tabIndex={-1}>The evidence</h3>
        {!inline && <p className="print__lead">{event.lead}</p>}
        <p>{event.card}</p>
        {event.quote && (
          <figure className="print__quote">
            <blockquote><p>{event.quote.text}</p></blockquote>
            <figcaption>
              {event.quote.who}
              {quoteSrc && <> · <a href={quoteSrc.url} target="_blank" rel="noreferrer">{quoteSrc.institution}</a></>}
            </figcaption>
          </figure>
        )}
        <h4>What this does not tell us</h4>
        <p>{event.limitations}</p>

        <h4>Questions</h4>
        <div className="print__faq">
          {faqFor(event.id).map((f) => (
            <details key={f.id}>
              <summary>{f.q}</summary>
              <p>{f.a}</p>
              <p className="print__cite">
                {f.sourceIds.map((id, i) => {
                  const s = SOURCE_BY_ID.get(id)
                  return s ? <span key={id}>{i > 0 && ' · '}<a href={s.url} target="_blank" rel="noreferrer">{s.title}</a></span> : null
                })}
              </p>
            </details>
          ))}
        </div>

        <h4>Sources</h4>
        <ol className="print__sources">
          {sources.map((s) => (
            <li key={s.id}>
              <a href={s.url} target="_blank" rel="noreferrer">{s.title}</a>
              <span>{s.institution}{s.published ? `, ${s.published.slice(0, 4)}` : ''}</span>
            </li>
          ))}
        </ol>
      </div>
    </aside>
  )
}
