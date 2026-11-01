import { uid } from './uid'

/* A hotel stay is two plans: a check-in on the day you arrive and a
   check-out on the day you leave, linked by a shared `stayId`. The plan
   form edits them together; plans from before the link (or imported apart)
   pair by hotel name, the check-out after the check-in. */

const isHotel = (item, action) => item?.type === 'hotel' && (action == null || item.hotelAction === action)
const sameName = (a, b) => (a.title || '').trim().toLowerCase() === (b.title || '').trim().toLowerCase()

/* { in: { item, dayId } | null, out: { item, dayId } | null } for the stay a
   hotel plan belongs to. */
export function findStay(trip, item) {
  const where = trip.days.flatMap((d, i) => d.items.map(it => ({ item: it, dayId: d.id, i })))
  const self = where.find(w => w.item.id === item?.id)
  if (!self || !isHotel(item)) return { in: null, out: null }
  const pick = w => (w ? { item: w.item, dayId: w.dayId } : null)
  if (item.stayId) {
    const both = where.filter(w => isHotel(w.item) && w.item.stayId === item.stayId)
    return {
      in: pick(both.find(w => w.item.hotelAction !== 'check-out')),
      out: pick(both.find(w => w.item.hotelAction === 'check-out')),
    }
  }
  if (item.hotelAction === 'check-out') {
    const before = where.filter(
      w => w.i < self.i && isHotel(w.item, 'check-in') && !w.item.stayId && sameName(w.item, item),
    )
    return { in: pick(before[before.length - 1]), out: pick(self) }
  }
  const after = where.find(
    w => w.i > self.i && isHotel(w.item, 'check-out') && !w.item.stayId && sameName(w.item, item),
  )
  return { in: pick(self), out: pick(after) }
}

/* The store actions that save a stay from the plan form. `editing` is the
   plan the form opened (a check-in or a check-out), `data` the form's plan,
   `checkIn` / `checkOut` the days and times picked — checkOut null for no
   check-out (yet). Both plans share the name and place; cost, documents
   and notes stay on the check-in. */
export function stayActions(trip, { editing, data, checkIn, checkOut }) {
  const found = editing ? findStay(trip, editing) : { in: null, out: null }
  const stayId = found.in?.item.stayId || found.out?.item.stayId || uid()
  const tripId = trip.id
  const actions = []

  const inPlan = { ...data, type: 'hotel', hotelAction: 'check-in', time: checkIn.time, stayId }
  actions.push(
    found.in
      ? {
          type: 'item/update',
          tripId,
          dayId: found.in.dayId,
          toDayId: checkIn.dayId,
          itemId: found.in.item.id,
          patch: inPlan,
        }
      : { type: 'item/add', tripId, dayId: checkIn.dayId, item: { id: uid(), ...inPlan } },
  )

  if (checkOut) {
    const outPlan = {
      type: 'hotel',
      hotelAction: 'check-out',
      title: data.title,
      place: data.place,
      geo: data.geo,
      time: checkOut.time,
      stayId,
    }
    actions.push(
      found.out
        ? {
            type: 'item/update',
            tripId,
            dayId: found.out.dayId,
            toDayId: checkOut.dayId,
            itemId: found.out.item.id,
            patch: outPlan,
          }
        : { type: 'item/add', tripId, dayId: checkOut.dayId, item: { id: uid(), ...outPlan, notes: '' } },
    )
  } else if (found.out) {
    actions.push({ type: 'item/delete', tripId, dayId: found.out.dayId, itemId: found.out.item.id })
  }
  return actions
}

// Derives "staying at hotel X" strips from check-in/check-out items.
// A stay covers the days strictly between the check-in day and the check-out
// day (those two days already show the items themselves). A check-out closes
// its own stay (same stayId), else one with its name, else the most recent;
// a stay with no check-out runs to the end of the trip.
export function computeStays(trip) {
  let open = [] // [{ key, name, stayId }]
  const byDay = {}
  for (const day of trip.days) {
    const remaining = [...open]
    for (const item of day.items) {
      if (!isHotel(item, 'check-out')) continue
      const key = (item.title || '').trim().toLowerCase()
      let idx = item.stayId ? remaining.findIndex(s => s.stayId === item.stayId) : -1
      if (idx < 0 && key) idx = remaining.findIndex(s => s.key === key)
      if (idx < 0) idx = remaining.length - 1
      if (idx >= 0) remaining.splice(idx, 1)
    }
    byDay[day.id] = remaining.map(s => s.name)
    open = remaining
    for (const item of day.items) {
      if (!isHotel(item, 'check-in')) continue
      const name = (item.title || '').trim()
      if (name) open.push({ key: name.toLowerCase(), name, stayId: item.stayId })
    }
  }
  return byDay
}
