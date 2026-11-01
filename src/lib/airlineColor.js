import { useEffect, useState } from 'react'
import { airlineLogoUrl } from './airlines'

/* An airline's two logo colours, taken from its logo on this device the
   first time the logo loads, then remembered. A flight's card fades from
   the first into the second (index.css, .flight-tint) — Swiss from red into
   white, IndiGo from blue into white, Air India from saffron into red. The
   logo comes through the app's own /logos/ address, so its pixels may be
   read; a logo that will not load, or has no colour in it (black, white,
   grey only), gives none and the card stays plain. */

const KEY = 'triplanner:airline-colors-v3' // v1 held one colour, v2 merged colours too eagerly
const listeners = new Set()
const pending = new Map() // iata → loading promise

function readAll() {
  try {
    return JSON.parse(localStorage.getItem(KEY)) ?? {}
  } catch {
    return {}
  }
}

function remember(iata, colors) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...readAll(), [iata]: colors }))
  } catch {
    // storage full — worked out again next time
  }
  listeners.forEach(fn => fn())
}

const hex = ({ r, g, b, n }) =>
  '#' +
  [r, g, b]
    .map(v =>
      Math.round(v / n)
        .toString(16)
        .padStart(2, '0'),
    )
    .join('')
const hueGap = (a, b) => Math.min(Math.abs(a - b), 360 - Math.abs(a - b))

/* { a, b } — `a` the colour that owns most of the logo's colourful pixels,
   `b` the logo's second colour: another hue that holds a fair share, else
   the white or dark it sits on, else null. null when there is no colour at
   all. Greys and the few pixels on an edge do not count. */
export function brandColors(img) {
  const size = 48
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) return null
  ctx.drawImage(img, 0, 0, size, size)
  let data
  try {
    data = ctx.getImageData(0, 0, size, size).data
  } catch {
    return null // a logo from another address: its pixels are out of reach
  }

  const bins = new Map() // hue bin (15°) → totals
  const light = { r: 0, g: 0, b: 0, n: 0 }
  const dark = { r: 0, g: 0, b: 0, n: 0 }
  let opaque = 0
  for (let p = 0; p < data.length; p += 4) {
    const [r, g, b, alpha] = [data[p], data[p + 1], data[p + 2], data[p + 3]]
    if (alpha < 200) continue
    opaque += 1
    const max = Math.max(r, g, b) / 255
    const min = Math.min(r, g, b) / 255
    const l = (max + min) / 2
    const d = max - min
    const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1))
    if (s < 0.28 || l > 0.93 || l < 0.08) {
      const neutral = l >= 0.5 ? light : dark
      neutral.r += r
      neutral.g += g
      neutral.b += b
      neutral.n += 1
      continue
    }
    let h
    if (max === r / 255) h = ((g - b) / 255 / d) % 6
    else if (max === g / 255) h = (b - r) / 255 / d + 2
    else h = (r - g) / 255 / d + 4
    const hue = (h * 60 + 360) % 360
    const bin = Math.round(hue / 15) % 24
    const e = bins.get(bin) ?? { hue: bin * 15, weight: 0, r: 0, g: 0, b: 0, n: 0 }
    e.weight += s
    e.r += r
    e.g += g
    e.b += b
    e.n += 1
    bins.set(bin, e)
  }

  // A bin and its direct neighbour are one colour (a shade either side of a
  // 15° boundary); anything further apart is a colour of its own, so Air
  // India's red stays apart from its saffron.
  const sorted = [...bins.values()].sort((x, y) => y.weight - x.weight)
  const colors = []
  for (const e of sorted) {
    const near = colors.find(c => hueGap(c.hue, e.hue) <= 15)
    if (near) {
      near.weight += e.weight
      near.r += e.r
      near.g += e.g
      near.b += e.b
      near.n += e.n
    } else colors.push({ ...e })
  }
  const [first, second] = colors
  if (!first || first.n < 40) return null // a few stray pixels are not a brand colour

  let b = null
  if (second && second.n >= 40 && second.weight >= first.weight * 0.2) b = hex(second)
  // white lettering on a coloured block (IndiGo) is a few pixels, but it is
  // half of what the logo looks like
  else if (light.n >= opaque * 0.08) b = hex(light)
  else if (dark.n >= opaque * 0.08) b = hex(dark)
  return { a: hex(first), b }
}

function learn(iata) {
  if (pending.has(iata) || typeof Image === 'undefined') return
  const done = new Promise(resolve => {
    const img = new Image()
    img.onload = () => resolve(brandColors(img) ?? false) // false: looked, no colour
    img.onerror = () => resolve(undefined) // offline or no logo: try again another time
    img.src = airlineLogoUrl(iata)
  }).then(colors => {
    pending.delete(iata)
    if (colors !== undefined) remember(iata, colors)
  })
  pending.set(iata, done)
}

// The airline's { a, b } colours, or null while unknown or when it has none.
export function useAirlineColors(iata) {
  const [all, setAll] = useState(readAll)
  useEffect(() => {
    const sync = () => setAll(readAll())
    listeners.add(sync)
    return () => listeners.delete(sync)
  }, [])
  const known = iata ? all[iata] : null
  useEffect(() => {
    if (iata && known === undefined) learn(iata)
  }, [iata, known])
  return known || null
}

// The custom properties .flight-tint reads; the second colour falls back
// to the first, so a one-colour logo simply fades out.
export const tintStyle = colors => (colors ? { '--accent': colors.a, '--accent-2': colors.b ?? colors.a } : {})
