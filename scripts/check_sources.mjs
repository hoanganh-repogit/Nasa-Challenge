// D1: re-open every source and media page. URLs are never rewritten; failures are reported, not "fixed".
// Run: node scripts/check_sources.mjs [--write]   (--write stamps verifiedOn on sources that answered 200)
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const SOURCES = root + 'src/content/sources.json'
const MEDIA = root + 'src/content/media.json'
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36'
const today = new Date().toISOString().slice(0, 10)

const sources = JSON.parse(readFileSync(SOURCES, 'utf8'))
const media = JSON.parse(readFileSync(MEDIA, 'utf8'))
const targets = [
  ...sources.map((s) => ({ kind: 'source', id: s.id, url: s.url })),
  ...media.map((m) => ({ kind: 'media', id: m.id, url: m.originalUrl })),
]

async function check(url) {
  const ctl = new AbortController()
  const t = setTimeout(() => ctl.abort(), 25000)
  try {
    const r = await fetch(url, { headers: { 'user-agent': UA, accept: 'text/html,*/*' }, redirect: 'follow', signal: ctl.signal })
    return { status: r.status, final: r.url !== url ? r.url : null }
  } catch (e) {
    return { status: 0, error: e.name === 'AbortError' ? 'timeout' : String(e.cause?.code ?? e.message) }
  } finally {
    clearTimeout(t)
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const results = []
for (let i = 0; i < targets.length; i += 6) {
  const batch = targets.slice(i, i + 6)
  results.push(...await Promise.all(batch.map(async (t) => ({ ...t, ...(await check(t.url)) }))))
}
// jpl.nasa.gov answers 202 (bot challenge) to bursts: retry those one at a time, slowly
for (const r of results) {
  for (let k = 0; k < 3 && r.status === 202; k++) {
    await sleep(4000 * (k + 1))
    Object.assign(r, await check(r.url))
  }
}

// still challenged (or timed out)? open those in a real browser if Playwright is available
const pending = results.filter((r) => r.status !== 200)
if (pending.length && process.env.PLAYWRIGHT) {
  const { createRequire } = await import('node:module')
  const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT)
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage({ userAgent: UA })
  for (const r of pending) {
    try {
      const resp = await page.goto(r.url, { waitUntil: 'domcontentloaded', timeout: 45000 })
      await page.waitForTimeout(2500) // let a JS challenge finish and reload
      const title = await page.title()
      const status = resp?.status() ?? 0
      const ok = (status === 200 || status === 202) && title && !/not found|404|access denied|challenge/i.test(title)
      Object.assign(r, { status: ok ? 200 : status, via: 'browser', title, error: ok ? undefined : r.error })
    } catch (e) {
      r.error = 'browser: ' + String(e.message).split(/\r?\n/)[0]
    }
  }
  await browser.close()
}

let bad = 0
for (const r of results) {
  const ok = r.status === 200
  if (!ok) bad++
  console.log(`${ok ? 'OK ' : 'ERR'} ${String(r.status).padStart(3)} ${r.kind.padEnd(6)} ${r.id}${r.final ? `  -> ${r.final}` : ''}${r.via ? `  [browser: ${r.title}]` : ''}${r.error ? `  (${r.error})` : ''}`)
}
console.log(`\n${results.length - bad}/${results.length} answered 200`)

if (process.argv.includes('--write')) {
  for (const s of sources) {
    const r = results.find((x) => x.kind === 'source' && x.id === s.id)
    if (r?.status === 200) s.verifiedOn = today
    else s.lastCheck = { on: today, status: r?.status ?? 0, error: r?.error ?? null }
  }
  writeFileSync(SOURCES, JSON.stringify(sources, null, 2) + '\n')
  console.log('verifiedOn stamped for sources that answered 200')
}
