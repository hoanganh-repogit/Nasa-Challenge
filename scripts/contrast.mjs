// WCAG 2.2 contrast check for the palette tokens. Usage: node scripts/contrast.mjs
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255)
const lin = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
const lum = (h) => { const [r, g, b] = hex(h).map(lin); return 0.2126 * r + 0.7152 * g + 0.0722 * b }
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05) }

const fg = { star: '#eef1f6', starDim: '#b3bccd', tungsten: '#f2a65a' }
const bg = { night: '#0b1020', dusk: '#1f2a4d' }
let fail = 0
for (const [fn, f] of Object.entries(fg)) for (const [bn, b] of Object.entries(bg)) {
  const r = ratio(f, b), ok = r >= 4.5 ? 'AA text' : r >= 3 ? 'AA large/UI only' : 'FAIL'
  if (ok === 'FAIL') fail++
  console.log(`${fn.padEnd(9)} on ${bn.padEnd(5)} ${r.toFixed(2).padStart(5)}:1  ${ok}`)
}
// Button: night text on tungsten fill
const btn = ratio('#0b1020', fg.tungsten)
console.log(`night on tungsten button ${btn.toFixed(2)}:1  ${btn >= 4.5 ? 'AA text' : 'FAIL'}`)
process.exit(fail ? 1 : 0)
