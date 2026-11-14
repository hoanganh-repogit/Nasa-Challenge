// Frame-by-frame capture of /film (block H). The page draws frame t from scratch on window.seek(t),
// so nothing depends on how fast the GPU is: each frame is drawn, screenshotted and piped to ffmpeg.
//
//   PLAYWRIGHT=<path to playwright> node scripts/capture_film.mjs [--url http://localhost:5181/film?render]
//        [--size 1600x900] [--dpr 1.2] [--fps 60] [--out teardown-out/film-silent.mp4]
//        [--stills 0,4,8,...]   (PNGs only, into <out>-frames/)
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'

const argv = process.argv.slice(2)
const opt = (k, d) => { const i = argv.indexOf(`--${k}`); return i < 0 ? d : argv[i + 1] }
const url = opt('url', 'http://localhost:5181/film?render')
const [W, H] = opt('size', '1600x900').split('x').map(Number)
const dpr = Number(opt('dpr', 1.2))
const stills = opt('stills')
const out = path.resolve(opt('out', stills ? 'teardown-out/film-stills.png' : 'teardown-out/film-silent.mp4'))
fs.mkdirSync(path.dirname(out), { recursive: true })

if (!process.env.PLAYWRIGHT) { console.error('set PLAYWRIGHT to a playwright package path'); process.exit(1) }
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT)
const browser = await chromium.launch({ args: ['--use-angle=d3d11', '--ignore-gpu-blocklist', '--enable-gpu-rasterization'] })
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: dpr })
page.on('pageerror', (e) => console.error('[page error]', e.message))
page.on('console', (m) => m.type() === 'error' && console.error('[page]', m.text()))
await page.goto(url)
await page.waitForFunction(() => typeof window.seek === 'function', null, { timeout: 120000 })
await page.evaluate(() => document.fonts.ready)
const { duration, fps: pageFps, gpu } = await page.evaluate(() => {
  const gl = document.createElement('canvas').getContext('webgl2')
  const ext = gl && gl.getExtension('WEBGL_debug_renderer_info')
  return { duration: window.DURATION, fps: window.FPS, gpu: ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : 'unknown' }
})
console.log(`gpu: ${gpu} · ${duration}s · ${W}x${H} @${dpr}`)
const seek = (t) => page.evaluate((x) => window.seek(x), t)

if (stills) {
  const dir = out.replace(/\.png$/, '') + '-frames'
  fs.mkdirSync(dir, { recursive: true })
  for (const t of stills.split(',').map(Number)) {
    await seek(t)
    await page.screenshot({ path: path.join(dir, `t${String(t.toFixed(2)).padStart(5, '0')}.png`) })
    console.log('still', t)
  }
} else {
  const fps = Number(opt('fps', pageFps ?? 60))
  const frames = Math.round(duration * fps)
  const ff = spawn(process.env.FFMPEG || 'ffmpeg', [
    '-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(fps), '-i', '-',
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '16', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', out,
  ], { stdio: ['pipe', 'inherit', 'inherit'] })
  const t0 = Date.now()
  for (let i = 0; i < frames; i++) {
    await seek(i / fps)
    const buf = await page.screenshot({ type: 'png' })
    if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r))
    if (i % 120 === 0) console.log(`frame ${i}/${frames} · ${((Date.now() - t0) / 1000).toFixed(0)}s`)
  }
  ff.stdin.end()
  await new Promise((r) => ff.on('close', r))
  console.log('wrote', out)
}
await browser.close()
