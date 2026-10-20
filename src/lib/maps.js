/* Every map link in the app comes from here.

   A plan carries a `place` field that takes any text: a Maps link, an address,
   or a name. A link opens that exact place, so the app shows one button for
   the provider it belongs to. Any other text is a search, and the user picks
   the provider. An empty field falls back to the plan name plus the trip
   destination — so a plan always reaches the map without a question.

   A plan whose place was picked for the day map (`geo`, see lib/geo.js) goes
   to that exact spot instead: Google and Apple get its coordinates, so the
   pin and the directions land where it was picked, not on a namesake. A best
   guess is not trusted that far — those plans still search by name. No API
   key either way. */

const GOOGLE_SEARCH = 'https://www.google.com/maps/search/?api=1&query='
const APPLE_SEARCH = 'https://maps.apple.com/?q='

// Text that looks like a bare host ("maps.app.goo.gl/xyz") gets a scheme, so a
// link pasted without one still counts as a link. Text with a space never can.
const BARE_HOST = /^[\w-]+(\.[\w-]+)+(\/|\?|$)/

function asUrl(text) {
  const t = String(text ?? '').trim()
  if (!t) return null
  const tries = [t]
  if (BARE_HOST.test(t)) tries.push(`https://${t}`)
  for (const candidate of tries) {
    try {
      const url = new URL(candidate)
      if (url.protocol === 'http:' || url.protocol === 'https:') return url
    } catch {
      // not a URL — the text is a search term
    }
  }
  return null
}

const providerOf = url => {
  const h = url.hostname.toLowerCase()
  if (h.endsWith('.apple.com')) return 'apple'
  if (h === 'goo.gl' || h.endsWith('.goo.gl') || h.includes('google.')) return 'google'
  return 'other'
}

// "38.724300,-9.135700" for a plan with a picked spot, else null.
export function spotOf(item) {
  const g = item?.type !== 'flight' && !item?.geo?.guess ? item?.geo : null
  return g && Number.isFinite(g.lat) && Number.isFinite(g.lng) ? `${g.lat.toFixed(6)},${g.lng.toFixed(6)}` : null
}

// A bare airport code searches badly on its own; "LIS airport" finds it.
const airport = text => (/^[A-Z]{3}$/.test(text) ? `${text} airport` : text)

/* What to search for: the plan's own text, else its name, with the trip
   destination added when the text does not name it. A flight is an airport:
   the one it leaves from when you are on your way to it (`role` 'arrive'),
   the one it lands at when you move on from it (`role` 'leave'). Airports
   carry no destination — the flight may well leave from home. */
export function placeQuery(trip, item, role = 'arrive') {
  const own = asUrl(item?.place) ? '' : String(item?.place ?? '').trim()
  if (item?.type === 'flight') {
    const from = (item.from ?? '').trim()
    const to = (item.to ?? '').trim()
    const q = own || (role === 'leave' ? to || from : from || to)
    return q ? airport(q) : null
  }
  const q = (own || item?.title || '').trim()
  if (!q) return null
  const dest = (trip?.destination || '').trim()
  return dest && !q.toLowerCase().includes(dest.toLowerCase()) ? `${q}, ${dest}` : q
}

/* How a plan reaches the map:
     { kind: 'link',   url, provider }            — one exact place
     { kind: 'search', query, google, apple, exact? } — the user picks a
        provider; `exact` when both open the picked spot
     null                                         — nothing to search for */
export function placeLinks(trip, item) {
  const url = asUrl(item?.place)
  if (url) return { kind: 'link', url: url.href, provider: providerOf(url) }
  const spot = spotOf(item)
  if (spot) {
    const name = (item.title || item.geo.label || '').trim()
    return {
      kind: 'search',
      exact: true,
      query: item.geo.label || name || spot,
      google: GOOGLE_SEARCH + spot,
      apple: `https://maps.apple.com/?ll=${spot}${name ? `&q=${encodeURIComponent(name)}` : ''}`,
    }
  }
  const query = placeQuery(trip, item)
  if (!query) return null
  const q = encodeURIComponent(query)
  return { kind: 'search', query, google: GOOGLE_SEARCH + q, apple: APPLE_SEARCH + q }
}

// One URL for a place, for the calendar export: the exact link when there is
// one, else a search that any device can open.
export function placeUrl(trip, item) {
  const links = placeLinks(trip, item)
  if (!links) return null
  return links.kind === 'link' ? links.url : links.google
}

// Where directions go for a stop: its picked spot, else a search for it.
const waypoint = (trip, item, role) => spotOf(item) ?? placeQuery(trip, item, role)

// Directions from one stop to the next. Maps then gives the real travel time.
export function pairRouteUrl(trip, from, to) {
  const a = waypoint(trip, from, 'leave')
  const b = waypoint(trip, to, 'arrive')
  if (!a || !b || a === b) return null
  return `https://www.google.com/maps/dir/${encodeURIComponent(a)}/${encodeURIComponent(b)}`
}

// The whole day as one route, in plan order. Flights and skipped plans are
// left out.
export function dayRouteUrl(trip, day) {
  const points = day.items
    .filter(i => i.type !== 'flight' && i.status !== 'skipped')
    .map(i => waypoint(trip, i))
    .filter(Boolean)
  if (points.length < 2) return null
  return 'https://www.google.com/maps/dir/' + points.map(encodeURIComponent).join('/')
}
