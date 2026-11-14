// The 8 stops (playbook block D table; research/SOURCE_RESEARCH_checkpoints.md).
// Structure only: place, sol, Earth date and the record anchor. Story copy arrives in block D.
export type ChapterId = 'arrival' | 'stuck' | 'water' | 'silence'

export interface Chapter { id: ChapterId; title: string }

export const CHAPTERS: Chapter[] = [
  { id: 'arrival', title: 'Arrival' },
  { id: 'stuck', title: 'Stuck' },
  { id: 'water', title: 'Better water' },
  { id: 'silence', title: 'Silence' },
]

export interface Stop {
  id: string
  chapter: ChapterId
  place: string
  /** sol shown on the stage (the rover position is looked up at this sol) */
  sol: number
  /** sol label as printed, e.g. "Sol 446 → ≈ 484" */
  solLabel: string
  earthDate: string
  /** "SITE/DRIVE" of the anchor record, or null when the event has no position */
  anchor: string | null
}

export const STOPS: Stop[] = [
  { id: 'evt-landing', chapter: 'arrival', place: 'Eagle crater, Meridiani Planum', sol: 1, solLabel: 'Sol 1', earthDate: '25 Jan 2004', anchor: '0/0' },
  { id: 'evt-wet-meridiani', chapter: 'arrival', place: 'Eagle crater outcrop', sol: 38, solLabel: '≈ Sol 37', earthDate: '2 Mar 2004', anchor: '5/38' },
  { id: 'evt-purgatory', chapter: 'stuck', place: 'Purgatory dune', sol: 470, solLabel: 'Sol 446 → ≈ 484', earthDate: '26 Apr 2005', anchor: '55/226 → 55/802' },
  { id: 'evt-victoria', chapter: 'stuck', place: 'Victoria crater', sol: 951, solLabel: 'Sol 951', earthDate: '26 Sep 2006', anchor: '76/264' },
  { id: 'evt-endeavour', chapter: 'water', place: 'Spirit Point, Endeavour crater', sol: 2680, solLabel: '≈ Sol 2680', earthDate: '9 Aug 2011', anchor: '158/0' },
  { id: 'evt-esperance', chapter: 'water', place: 'Esperance, Endeavour rim', sol: 3230, solLabel: 'Sol 3230', earthDate: '23 Feb 2013', anchor: '169/553' },
  { id: 'evt-last-contact', chapter: 'silence', place: 'Perseverance Valley', sol: 5111, solLabel: 'Sol 5111 (last record sol 5081)', earthDate: '10 Jun 2018', anchor: '210/277' },
  { id: 'evt-end-of-mission', chapter: 'silence', place: 'The whole route', sol: 5111, solLabel: 'After sol 5111', earthDate: '13 Feb 2019', anchor: null },
]
