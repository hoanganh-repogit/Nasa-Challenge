// Night ground texture derived from PIA23178 (NASA/JPL-Caltech/MSSS).
// The orbital mosaic is greyscale; NASA drew the route in yellow and added white labels and a scale bar.
// On the 3D stage our own route (from the traverse table) is drawn instead, so the drawn yellow line,
// the labels and the scale bar are masked and filled from surrounding pixels. Nothing else changes.
// The unaltered PIA23178 stays in public/media/basemap-pia23178.webp and is shown as NASA's own map.
//
// Run: node scripts/clean_basemap.mjs   (needs ffmpeg on PATH)
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const SRC = root + 'public/media/basemap-pia23178.webp'
const OUT = root + 'public/media/ground-pia23178-clean.webp'
const W = 2667, H = 2058

const dec = spawnSync('ffmpeg', ['-v', 'error', '-i', SRC, '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], { maxBuffer: W * H * 3 + 1024 })
if (dec.status !== 0) throw new Error(dec.stderr.toString())
const rgb = dec.stdout
if (rgb.length !== W * H * 3) throw new Error(`unexpected size ${rgb.length}`)

const N = W * H
const grey = new Float32Array(N)
const mask = new Uint8Array(N)

// label and scale-bar boxes, read off the image (x0, y0, x1, y1 in original pixels), padded
const S = 2667 / 1000
const boxes = [
  [90, 8, 170, 30], [172, 28, 282, 50], [198, 160, 292, 184], [216, 290, 336, 312],
  [364, 510, 498, 534], [505, 490, 637, 516], [130, 695, 236, 736],
].map(([a, b, c, d]) => [a * S, b * S, c * S, d * S])
const inBox = (x, y) => boxes.some(([a, b, c, d]) => x >= a && x <= c && y >= b && y <= d)

for (let i = 0; i < N; i++) {
  const r = rgb[i * 3], g = rgb[i * 3 + 1], b = rgb[i * 3 + 2]
  grey[i] = (r + g + b) / 3
  const sat = Math.max(r, g, b) - Math.min(r, g, b)
  if (sat > 38) mask[i] = 1 // the yellow route and its leader lines (the mosaic itself is grey)
  else {
    const x = i % W, y = (i / W) | 0
    if (grey[i] > 185 && inBox(x, y)) mask[i] = 1 // white lettering, scale bar
  }
}

// dilate twice to swallow anti-aliased and JPEG-ringing edges
for (let pass = 0; pass < 3; pass++) {
  const m2 = mask.slice()
  for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
    const i = y * W + x
    if (mask[i]) continue
    if (mask[i - 1] || mask[i + 1] || mask[i - W] || mask[i + W]) m2[i] = 1
  }
  mask.set(m2)
}
let masked = 0
for (let i = 0; i < N; i++) masked += mask[i]

// fill: copy real mosaic texture from the nearest unmasked pixel a short way off (patch copy),
// then shift each copied run so its mean matches the onion-peel mean (keeps tone, adds grain)
const orig = mask.slice()
const smooth = grey.slice()
{
  const m = mask.slice()
  let left = masked, guard = 0
  while (left > 0 && guard++ < 400) {
    const fill = []
    for (let i = 0; i < N; i++) {
      if (!m[i]) continue
      const x = i % W, y = (i / W) | 0
      let s = 0, n = 0
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const xx = x + dx, yy = y + dy
        if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue
        const j = yy * W + xx
        if (!m[j]) { s += smooth[j]; n++ }
      }
      if (n >= 2 || (n === 1 && guard > 40)) fill.push(i, s / n)
    }
    for (let k = 0; k < fill.length; k += 2) { smooth[fill[k]] = fill[k + 1]; m[fill[k]] = 0 }
    left -= fill.length / 2
  }
}
const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]
let unfilled = 0
for (let i = 0; i < N; i++) {
  if (!orig[i]) continue
  const x = i % W, y = (i / W) | 0
  let done = false
  for (let d = 12; d <= 90 && !done; d += 4) {
    for (const [ux, uy] of DIRS) {
      const xx = x + ux * d, yy = y + uy * d
      if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue
      const j = yy * W + xx
      if (orig[j]) continue
      // local mean around the source, 5x5
      let s = 0, n = 0
      for (let a = -2; a <= 2; a++) for (let b = -2; b <= 2; b++) {
        const x2 = xx + a, y2 = yy + b
        if (x2 < 0 || y2 < 0 || x2 >= W || y2 >= H) continue
        s += grey[y2 * W + x2]; n++
      }
      grey[i] = smooth[i] + (grey[j] - s / n)
      done = true
      break
    }
  }
  if (!done) { grey[i] = smooth[i]; unfilled++ }
}
const out = Buffer.alloc(N)
for (let i = 0; i < N; i++) out[i] = Math.max(0, Math.min(255, Math.round(grey[i])))
const enc = spawnSync('ffmpeg', ['-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'gray', '-s', `${W}x${H}`, '-i', '-',
  '-c:v', 'libwebp', '-quality', '74', '-compression_level', '6', OUT], { input: out, maxBuffer: 1 << 20 })
if (enc.status !== 0) throw new Error(enc.stderr.toString())
console.log(`masked ${masked} px (${(100 * masked / N).toFixed(2)}%), smooth-only ${unfilled} -> ${OUT}`)
