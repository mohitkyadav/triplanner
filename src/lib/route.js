// Google Maps links built from plan names — no coordinates and no API key.
// A stop is searched by its name plus the trip destination, which is enough to
// place it. Flights carry the airport in `location` instead of a title.
function placeQuery(trip, item) {
  const dest = (trip.destination || '').trim()
  const raw = (item?.type === 'flight' ? item.location : item?.title) || ''
  const q = raw.trim()
  if (!q) return null
  return dest && !q.toLowerCase().includes(dest.toLowerCase()) ? `${q}, ${dest}` : q
}

// One stop on the map. A link the user pasted wins, because it points at the
// exact place.
export function placeMapsUrl(trip, item) {
  if (item?.mapsUrl) return item.mapsUrl
  const q = placeQuery(trip, item)
  return q ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}` : null
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
