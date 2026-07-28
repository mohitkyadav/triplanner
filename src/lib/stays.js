// Derives "staying at hotel X" strips from check-in/check-out items.
// A stay covers the days strictly between the check-in day and the check-out
// day (those two days already show the items themselves). A check-out whose
// name doesn't match any open stay closes the most recent one; a stay with no
// check-out runs to the end of the trip.
export function computeStays(trip) {
  let open = [] // [{ key, name }]
  const byDay = {}
  for (const day of trip.days) {
    const remaining = [...open]
    for (const item of day.items) {
      if (item.type !== 'hotel' || item.hotelAction !== 'check-out') continue
      const key = (item.title || '').trim().toLowerCase()
      let idx = key ? remaining.findIndex(s => s.key === key) : -1
      if (idx < 0) idx = remaining.length - 1
      if (idx >= 0) remaining.splice(idx, 1)
    }
    byDay[day.id] = remaining.map(s => s.name)
    open = remaining
    for (const item of day.items) {
      if (item.type !== 'hotel' || item.hotelAction !== 'check-in') continue
      const name = (item.title || '').trim()
      if (name) open.push({ key: name.toLowerCase(), name })
    }
  }
  return byDay
}
