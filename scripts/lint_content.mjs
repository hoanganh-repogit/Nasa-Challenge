// D3: content lint. Exits 1 on any problem.
// Run: node scripts/lint_content.mjs
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const read = (p) => JSON.parse(readFileSync(root + p, 'utf8'))
const events = read('src/content/events.json')
const faq = read('src/content/faq.json')
const sources = read('src/content/sources.json')
const media = read('src/content/media.json')

const BANNED = [/drinkable/i, /proved life/i, /life was found/i, /measured position/i, /\bdrink/i]
const PARTS = new Set(['mast', 'panels', 'body', 'arm', 'instruments', 'wheels'])
const srcIds = new Set(sources.map((s) => s.id))
const mediaIds = new Set(media.map((m) => m.id))
const words = (t) => t.trim().split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length

const problems = []
const bad = (where, msg) => problems.push(`${where}: ${msg}`)
const scanText = (where, text) => {
  for (const re of BANNED) if (re.test(text)) bad(where, `banned phrase ${re}`)
}

for (const e of events) {
  const w = e.id
  for (const k of ['question', 'finding', 'lead', 'card', 'limitations']) {
    if (!e[k]) bad(w, `missing ${k}`)
    else scanText(`${w}.${k}`, e[k])
  }
  const lw = words(e.lead ?? ''), cw = words(e.card ?? '')
  if (lw < 35 || lw > 70) bad(w, `lead has ${lw} words (35-70)`)
  if (cw < 80 || cw > 150) bad(w, `card has ${cw} words (80-150)`)
  for (const id of e.sourceIds ?? []) if (!srcIds.has(id)) bad(w, `unknown sourceId ${id}`)
  if (!e.sourceIds?.length) bad(w, 'no sources')
  if (e.quote) {
    scanText(`${w}.quote`, e.quote.text)
    if (!srcIds.has(e.quote.sourceId)) bad(w, `quote has unknown sourceId ${e.quote.sourceId}`)
    if (!e.sourceIds.includes(e.quote.sourceId)) bad(w, `quote source ${e.quote.sourceId} not in sourceIds`)
  }
  for (const id of e.mediaIds ?? []) if (!mediaIds.has(id)) bad(w, `unknown mediaId ${id}`)
  for (const p of e.partIds ?? []) if (!PARTS.has(p)) bad(w, `unknown partId ${p}`)
  if (e.time?.solSource === 'derived' && e.time.sol == null) bad(w, 'derived sol without value')
  const n = faq.filter((f) => f.eventId === w).length
  if (n < 3 || n > 5) bad(w, `${n} FAQ entries (3-5)`)
  console.log(`${w.padEnd(20)} lead ${String(lw).padStart(3)}  card ${String(cw).padStart(3)}  faq ${n}`)
}

const eventIds = new Set(events.map((e) => e.id))
for (const f of faq) {
  if (!eventIds.has(f.eventId)) bad(f.id, `unknown eventId ${f.eventId}`)
  if (!f.sourceIds?.length) bad(f.id, 'no sources')
  for (const id of f.sourceIds ?? []) if (!srcIds.has(id)) bad(f.id, `unknown sourceId ${id}`)
  scanText(f.id, f.q + ' ' + f.a)
}
for (const m of media) {
  if (!m.credit) bad(m.id, 'missing credit')
  if (!m.alt) bad(m.id, 'missing alt')
  for (const id of m.sourceIds ?? []) if (!srcIds.has(id)) bad(m.id, `unknown sourceId ${id}`)
}
const ids = sources.map((s) => s.id)
for (const id of ids.filter((x, i) => ids.indexOf(x) !== i)) bad('sources', `duplicate id ${id}`)

if (problems.length) {
  console.error(`\n${problems.length} problem(s):\n` + problems.map((p) => '  - ' + p).join('\n'))
  process.exit(1)
}
console.log(`\ncontent lint passed: ${events.length} events, ${faq.length} FAQ, ${sources.length} sources, ${media.length} media`)
