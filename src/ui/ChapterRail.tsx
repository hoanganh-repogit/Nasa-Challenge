import type { Ref } from 'react'
import { CHAPTERS, STOPS } from '../content/stops'

const MAX_SOL = 5111
const pct = (sol: number) => `${((sol - 1) / (MAX_SOL - 1)) * 100}%`

/** Four chapters across the top, over a true sol axis with a tick per stop and the moving sol marker. */
export function ChapterRail({ stop, onChapter, markerRef }: { stop: number; onChapter: (firstStop: number) => void; markerRef: Ref<HTMLSpanElement> }) {
  const current = STOPS[stop]?.chapter
  return (
    <nav className="rail" aria-label="Chapters">
      <ol className="rail__chapters">
        {CHAPTERS.map((c) => {
          const first = STOPS.findIndex((s) => s.chapter === c.id)
          return (
            <li key={c.id}>
              <button type="button" className="rail__chapter" aria-current={c.id === current ? 'step' : undefined} onClick={() => onChapter(first)}>
                {c.title}
              </button>
            </li>
          )
        })}
      </ol>
      <div className="rail__axis" aria-hidden="true">
        {STOPS.filter((s) => s.anchor).map((s) => (
          <span key={s.id} className="rail__tick" data-on={STOPS[stop]?.id === s.id || undefined} style={{ left: pct(s.sol) }} />
        ))}
        <span ref={markerRef} className="rail__marker" />
        <span className="rail__end rail__end--a">Sol 1</span>
        <span className="rail__end rail__end--b">Sol 5111</span>
      </div>
    </nav>
  )
}
