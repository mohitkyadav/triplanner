/* Every map link in the app comes from here.

   A plan carries a `place` field that takes any text: a Maps link, an address,
   or a name. A link opens that exact place, so the app shows one button for
   the provider it belongs to. Any other text is a search, and the user picks
   the provider. An empty field falls back to the plan name plus the trip
   destination — so a plan always reaches the map without a question.

   No coordinates and no API key: a search by name is enough to place a stop,
   and Google gives the travel time between two of them. */

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

// What to search for: the plan's own text, else its name (an airport for a
// flight), with the trip destination added when the text does not name it.
export function placeQuery(trip, item) {
  const own = asUrl(item?.place) ? '' : String(item?.place ?? '').trim()
  const fallback = (item?.type === 'flight' ? item.location : item?.title) || ''
  const q = (own || fallback).trim()
  if (!q) return null
  const dest = (trip?.destination || '').trim()
  return dest && !q.toLowerCase().includes(dest.toLowerCase()) ? `${q}, ${dest}` : q
}

/* How a plan reaches the map:
     { kind: 'link',   url, provider }            — one exact place
     { kind: 'search', query, google, apple }     — the user picks a provider
     null                                         — nothing to search for */
export function placeLinks(trip, item) {
  const url = asUrl(item?.place)
  if (url) return { kind: 'link', url: url.href, provider: providerOf(url) }
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

// Directions from one stop to the next. Maps then gives the real travel time,
// which the app cannot calculate without coordinates.
export function pairRouteUrl(trip, from, to) {
  const a = placeQuery(trip, from)
  const b = placeQuery(trip, to)
  if (!a || !b || a === b) return null
  return `https://www.google.com/maps/dir/${encodeURIComponent(a)}/${encodeURIComponent(b)}`
}

// The whole day as one route, in plan order. Flights and skipped plans are
// left out.
export function dayRouteUrl(trip, day) {
  const points = day.items
    .filter(i => i.type !== 'flight' && i.status !== 'skipped')
    .map(i => placeQuery(trip, i))
    .filter(Boolean)
  if (points.length < 2) return null
  return 'https://www.google.com/maps/dir/' + points.map(encodeURIComponent).join('/')
}
