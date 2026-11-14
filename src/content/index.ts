// Typed access to the edited, sourced content (block D). Lint: scripts/lint_content.mjs
import type { MediaItem } from '../data/types'
import eventsJson from './events.json'
import faqJson from './faq.json'
import mediaJson from './media.json'
import partsJson from './parts.json'
import sourcesJson from './sources.json'

export interface StoryEvent {
  id: string
  chapterId: string
  question: string
  finding: string
  time: { earthDate: string; earthDateLabel: string; sol: number | null; solSource: 'published' | 'derived' | null }
  anchor: string | null
  lead: string
  card: string
  quote?: { text: string; who: string; sourceId: string }
  limitations: string
  partIds: string[]
  mediaIds: string[]
  sourceIds: string[]
}
export interface PartTool { id: string; name: string; job: string }
export interface Part {
  id: string
  /** button label, e.g. "The wheels" */
  short: string
  name: string
  /** material names in NASA's MER model (24883_MER_static.glb) that make up this part */
  materials: string[]
  whatItIs: string
  howItWorks: string
  quote: { text: string; who: string; sourceId: string }
  tools?: PartTool[]
  /** tools used at a stop, in the order they worked */
  toolsAt?: Record<string, string[]>
  /** what this part found, per event id */
  found: Record<string, string>
  sourceIds: string[]
}
export interface Faq { id: string; eventId: string; q: string; a: string; sourceIds: string[] }
export interface Source { id: string; title: string; institution: string; url: string; published?: string; verifiedOn: string; caveat?: string; note?: string }

export const EVENTS = eventsJson as StoryEvent[]
export const FAQ = faqJson as Faq[]
export const MEDIA = mediaJson as MediaItem[]
export const SOURCES = sourcesJson as Source[]
export const PARTS = partsJson as Part[]

const byId = <T extends { id: string }>(list: T[]) => new Map(list.map((x) => [x.id, x]))
export const EVENT_BY_ID = byId(EVENTS)
export const MEDIA_BY_ID = byId(MEDIA)
export const SOURCE_BY_ID = byId(SOURCES)
export const PART_BY_ID = byId(PARTS)
export const faqFor = (eventId: string) => FAQ.filter((f) => f.eventId === eventId)
/** 1-based stop numbers whose event names this part, in journey order */
export const stopsForPart = (partId: string) =>
  EVENTS.map((e, i) => (e.partIds.includes(partId) ? i + 1 : 0)).filter((n) => n > 0)
