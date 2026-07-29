// Builds a Google Maps directions URL for a day's stops, in their order.
// Stops are searched by name (+ trip destination for disambiguation), so no
// coordinates or API key are needed. Flights and skipped plans are left out.
function routePoints(trip, day) {
  const dest = (trip.destination || '').trim()
  return day.items
    .filter(i => i.type !== 'flight' && i.status !== 'skipped' && (i.title || '').trim())
    .map(i => {
      const q = i.title.trim()
      return dest && !q.toLowerCase().includes(dest.toLowerCase()) ? `${q}, ${dest}` : q
    })
}

export function dayRouteUrl(trip, day) {
  const points = routePoints(trip, day)
  if (points.length < 2) return null
  return 'https://www.google.com/maps/dir/' + points.map(encodeURIComponent).join('/')
}
