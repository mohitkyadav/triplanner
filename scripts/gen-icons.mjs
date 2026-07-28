// Generates the PWA PNG icons (flat rounded square + map pin) with zero
// dependencies — pure Node zlib PNG encoding, 3x3 supersampled for smooth edges.
import { deflateSync } from 'node:zlib'
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'public')

function crc32(buf) {
  let crc = ~0
  for (let n = 0; n < buf.length; n++) {
    crc ^= buf[n]
    for (let k = 0; k < 8; k++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1))
  }
  return ~crc >>> 0
}

function chunk(type, data) {
  const buf = Buffer.alloc(12 + data.length)
  buf.writeUInt32BE(data.length, 0)
  buf.write(type, 4, 'ascii')
  data.copy(buf, 8)
  buf.writeUInt32BE(crc32(buf.subarray(4, 8 + data.length)), 8 + data.length)
  return buf
}

function png(size, pixels) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // RGBA
  const stride = 1 + size * 4
  const raw = Buffer.alloc(size * stride)
  for (let y = 0; y < size; y++) pixels.copy(raw, y * stride + 1, y * size * 4, (y + 1) * size * 4)
  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

const C1 = [2, 132, 199] // sky-600 — flat brand color, no gradient
const C2 = C1

// One sample in unit space -> [r, g, b, a]
function sample(u, v, { cornerRadius, glyphScale }) {
  if (cornerRadius > 0) {
    const dx = Math.max(Math.abs(u - 0.5) - (0.5 - cornerRadius), 0)
    const dy = Math.max(Math.abs(v - 0.5) - (0.5 - cornerRadius), 0)
    if (Math.hypot(dx, dy) > cornerRadius) return [0, 0, 0, 0]
  }
  const t = (u + v) / 2
  let col = [
    C1[0] + (C2[0] - C1[0]) * t,
    C1[1] + (C2[1] - C1[1]) * t,
    C1[2] + (C2[2] - C1[2]) * t,
  ]
  // Map-pin glyph, scaled around the icon center
  const gu = (u - 0.5) / glyphScale + 0.5
  const gv = (v - 0.5) / glyphScale + 0.5
  const cx = 0.5, cy = 0.41, R = 0.235, hole = 0.094, tip = 0.82
  const ddx = gu - cx, ddy = gv - cy
  const inCircle = ddx * ddx + ddy * ddy <= R * R
  const inCone = gv >= cy && gv <= tip && Math.abs(ddx) <= (R * (tip - gv)) / (tip - cy)
  const inHole = ddx * ddx + ddy * ddy <= hole * hole
  if ((inCircle || inCone) && !inHole) col = [255, 255, 255]
  return [col[0], col[1], col[2], 255]
}

function render(size, opts) {
  const px = Buffer.alloc(size * size * 4)
  const SS = 3 // 3x3 supersampling
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let r = 0, g = 0, b = 0, a = 0
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const [sr, sg, sb, sa] = sample((x + (sx + 0.5) / SS) / size, (y + (sy + 0.5) / SS) / size, opts)
          r += sr * (sa / 255); g += sg * (sa / 255); b += sb * (sa / 255); a += sa
        }
      }
      const n = SS * SS
      const i = (y * size + x) * 4
      const alpha = a / n
      // premultiplied average -> straight alpha
      const un = alpha > 0 ? 255 / alpha : 0
      px[i] = Math.min(255, Math.round((r / n) * un))
      px[i + 1] = Math.min(255, Math.round((g / n) * un))
      px[i + 2] = Math.min(255, Math.round((b / n) * un))
      px[i + 3] = Math.round(alpha)
    }
  }
  return png(size, px)
}

mkdirSync(OUT, { recursive: true })
const targets = [
  ['pwa-192.png', 192, { cornerRadius: 0.22, glyphScale: 1 }],
  ['pwa-512.png', 512, { cornerRadius: 0.22, glyphScale: 1 }],
  ['pwa-512-maskable.png', 512, { cornerRadius: 0, glyphScale: 0.72 }],
  ['apple-touch-icon.png', 180, { cornerRadius: 0, glyphScale: 0.85 }],
]
for (const [name, size, opts] of targets) {
  writeFileSync(join(OUT, name), render(size, opts))
  console.log('wrote', name)
}
