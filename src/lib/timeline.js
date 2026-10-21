import { distanceKm } from './geo'
import { endOf, fmtClock, gapBetween, startOf } from './schedule'

/* The day as a timeline: what lies between one stop and the next, and the
   day in one line. Distances are as the crow flies — between two picked
   places, not along streets — good enough to tell a walk from a ride. */

const entry = item => ({ start: startOf(item), end: endOf(item) })
// Flights span two places, so they have no single spot.
const spotOf = item => (item.type !== 'flight' && item.geo ? item.geo : null)

// { gap, km } from one plan to the next; null when there is nothing to say.
export function legBetween(a, b) {
  const gap = gapBetween(entry(a), entry(b))
  const p = spotOf(a)
  const q = spotOf(b)
  const km = p && q ? distanceKm(p, q) : null
  return gap || km != null ? { gap, km } : null
}

// "650 m", "4.1 km", "23 km"
export function fmtKm(km) {
  if (km < 1) return `${Math.max(50, Math.round((km * 1000) / 50) * 50)} m`
  return `${km < 10 ? km.toFixed(1) : Math.round(km)} km`
}

/* "3 stops · 09:50–13:30 · 6.4 km": how many plans, from the first start to
   the last end, and the distance between the picked places in order
   (skipped plans left out). */
export function daySummary(day) {
  const items = day.items
  if (items.length === 0) return ''
  const parts = [`${items.length} ${items.length === 1 ? 'stop' : 'stops'}`]

  const starts = items.map(startOf).filter(n => n != null)
  const ends = items.map(i => endOf(i) ?? startOf(i)).filter(n => n != null)
  if (starts.length) {
    const from = Math.min(...starts)
    const to = Math.max(...ends)
    // a last plan that ends after midnight (a night flight) says so
    parts.push(to > from ? `${fmtClock(from)}–${fmtClock(to % 1440)}${to >= 1440 ? ' +1' : ''}` : fmtClock(from))
  }

  const spots = items
    .filter(i => i.status !== 'skipped')
    .map(spotOf)
    .filter(Boolean)
  let km = 0
  for (let i = 1; i < spots.length; i++) km += distanceKm(spots[i - 1], spots[i])
  if (spots.length > 1) parts.push(fmtKm(km))
  return parts.join(' · ')
}
