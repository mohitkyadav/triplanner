import { useEffect, useState } from 'react'
import { airlineLogoUrl } from './airlines'

/* An airline's brand colour, taken from its logo on this device the first
   time the logo loads, then remembered. Flight cards wear a faint tint of
   it (index.css, .flight-tint). The logo comes through the app's own
   /logos/ address, so its pixels may be read; a logo that will not load,
   or has no colour in it (black, white, grey), gives none and the card
   stays plain. */

const KEY = 'triplanner:airline-colors'
const listeners = new Set()
const pending = new Map() // iata → loading promise

function readAll() {
  try {
    return JSON.parse(localStorage.getItem(KEY)) ?? {}
  } catch {
    return {}
  }
}

function remember(iata, color) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...readAll(), [iata]: color }))
  } catch {
    // storage full — worked out again next time
  }
  listeners.forEach(fn => fn())
}

/* The colour that owns the most of the logo's colourful pixels — white,
   black and greys left out, so a logo on white or with black lettering
   gives its brand colour. '' when there is none. */
export function brandColor(img) {
  const size = 48
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) return ''
  ctx.drawImage(img, 0, 0, size, size)
  let data
  try {
    data = ctx.getImageData(0, 0, size, size).data
  } catch {
    return '' // a logo from another address: its pixels are out of reach
  }
  const bins = new Map() // hue bin → totals
  for (let p = 0; p < data.length; p += 4) {
    const [r, g, b, a] = [data[p], data[p + 1], data[p + 2], data[p + 3]]
    if (a < 200) continue
    const max = Math.max(r, g, b) / 255
    const min = Math.min(r, g, b) / 255
    const l = (max + min) / 2
    const d = max - min
    const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1))
    if (s < 0.28 || l > 0.93 || l < 0.08) continue
    let h
    if (max === r / 255) h = ((g - b) / 255 / d) % 6
    else if (max === g / 255) h = (b - r) / 255 / d + 2
    else h = (r - g) / 255 / d + 4
    const bin = Math.round(((h * 60 + 360) % 360) / 15)
    const e = bins.get(bin) ?? { weight: 0, r: 0, g: 0, b: 0, n: 0 }
    e.weight += s
    e.r += r
    e.g += g
    e.b += b
    e.n += 1
    bins.set(bin, e)
  }
  const best = [...bins.values()].sort((a, b) => b.weight - a.weight)[0]
  if (!best || best.n < 40) return '' // a few stray pixels are not a brand colour
  const hex = v =>
    Math.round(v / best.n)
      .toString(16)
      .padStart(2, '0')
  return `#${hex(best.r)}${hex(best.g)}${hex(best.b)}`
}

function learn(iata) {
  if (pending.has(iata) || typeof Image === 'undefined') return
  const done = new Promise(resolve => {
    const img = new Image()
    img.onload = () => resolve(brandColor(img))
    img.onerror = () => resolve(null) // offline or no logo: try again another time
    img.src = airlineLogoUrl(iata)
  }).then(color => {
    pending.delete(iata)
    if (color != null) remember(iata, color)
  })
  pending.set(iata, done)
}

// The airline's colour ('#rrggbb'), or '' while unknown or when it has none.
export function useAirlineColor(iata) {
  const [all, setAll] = useState(readAll)
  useEffect(() => {
    const sync = () => setAll(readAll())
    listeners.add(sync)
    return () => listeners.delete(sync)
  }, [])
  const known = iata ? all[iata] : ''
  useEffect(() => {
    if (iata && known === undefined) learn(iata)
  }, [iata, known])
  return known || ''
}
