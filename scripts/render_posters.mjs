// Render one poster per stop from the live 3D stage (for Static view): public/posters/stop-n.webp
// Usage: npm run dev (port 5180) in another shell, then
//   PLAYWRIGHT=<path to a playwright package> node scripts/render_posters.mjs
// Uses the real GPU through ANGLE (headless SwiftShader is too slow and looks different).
import { spawnSync } from 'node:child_process'
import { mkdirSync, rmSync } from 'node:fs'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const require = createRequire(import.meta.url)
const { chromium } = require(process.env.PLAYWRIGHT || 'playwright')
const BASE = process.env.BASE || 'http://localhost:5180/'
const STOPS = 8
const tmp = root + 'teardown-out/posters'
mkdirSync(tmp, { recursive: true })
mkdirSync(root + 'public/posters', { recursive: true })

const browser = await chromium.launch({ headless: true, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] })
const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 })
for (let i = 0; i < STOPS; i++) {
  await page.goto(`${BASE}?clean&tier=high&shot=${i}`, { waitUntil: 'load' })
  await page.waitForSelector('canvas[data-ready="true"]', { timeout: 30000 })
  await page.waitForTimeout(1200)
  const png = `${tmp}/stop-${i + 1}.png`
  await page.screenshot({ path: png })
  const out = `${root}public/posters/stop-${i + 1}.webp`
  const r = spawnSync('ffmpeg', ['-v', 'error', '-y', '-i', png, '-c:v', 'libwebp', '-quality', '72', out])
  if (r.status !== 0) throw new Error(r.stderr.toString())
  console.log('poster', i + 1)
}
await browser.close()
rmSync(tmp, { recursive: true, force: true })
