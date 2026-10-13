import { RENAMED_TYPES } from './categories'
import { uid } from './uid'

export function downloadFile(filename, content, type) {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export const downloadJSON = (filename, obj) =>
  downloadFile(filename, JSON.stringify(obj, null, 2), 'application/json')

export const exportPayload = trips => ({
  app: 'triplanner',
  version: 1,
  exportedAt: new Date().toISOString(),
  trips,
})

export const slug = s =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'trip'

const str = v => (typeof v === 'string' ? v : '')
const num = v => (Number.isFinite(+v) && v !== '' && v != null ? +v : null)
const money = v => (num(v) != null && +v > 0 ? Math.round(+v * 100) / 100 : null)
const code = v => str(v).trim().toUpperCase().slice(0, 3)

/* Moves for data an older version wrote, applied when it loads:
     `mapsUrl` took a link only — `place` takes any text.
     the single `transport` type became `train` and `bus`.
     a flight was an "arrival" or a "departure" at one `location` — it is now
     one plan from → to, leaving at `time` and landing at `endTime`. */
export function upgradeItem({ mapsUrl, direction, location, ...item }) {
  const next = { ...item }
  if (!next.place && mapsUrl) next.place = mapsUrl
  if (RENAMED_TYPES[next.type]) next.type = RENAMED_TYPES[next.type]
  if (next.type === 'flight' && next.from == null && next.to == null && (direction || location)) {
    const where = str(location)
    if (direction === 'departure') Object.assign(next, { from: where, to: '' })
    else Object.assign(next, { from: '', to: where, endTime: str(item.time), time: '' })
  }
  return next
}

function normalizeAttachment(a) {
  if (!a || typeof a !== 'object' || typeof a.id !== 'string') return null
  return { id: a.id, name: str(a.name) || 'Document', type: str(a.type), size: num(a.size) ?? 0 }
}

function normalizeItem(raw) {
  if (!raw || typeof raw !== 'object') throw new Error('invalid item')
  const i = upgradeItem(raw)
  const type = str(i.type) || 'other'
  const attachments = Array.isArray(i.attachments) ? i.attachments.map(normalizeAttachment).filter(Boolean) : []
  const cost = money(i.cost)
  return {
    id: typeof i.id === 'string' ? i.id : uid(),
    type,
    title: str(i.title),
    time: str(i.time),
    endTime: str(i.endTime),
    place: str(i.place),
    notes: str(i.notes),
    ...(cost != null && { cost }),
    ...(cost != null && code(i.currency) && { currency: code(i.currency) }),
    ...(cost != null && i.paid === true && { paid: true }),
    ...(cost != null && str(i.paidBy) && { paidBy: str(i.paidBy) }),
    ...(['done', 'skipped'].includes(i.status) && { status: i.status }),
    ...(type === 'flight' && { flightNo: str(i.flightNo), from: str(i.from), to: str(i.to) }),
    ...(type === 'hotel' && {
      hotelAction: i.hotelAction === 'check-out' ? 'check-out' : 'check-in',
    }),
    ...(attachments.length > 0 && { attachments }),
  }
}

function normalizeDay(d) {
  if (!d || typeof d !== 'object') throw new Error('invalid day')
  return {
    id: typeof d.id === 'string' ? d.id : uid(),
    date: /^\d{4}-\d{2}-\d{2}$/.test(d.date) ? d.date : '',
    title: str(d.title),
    items: Array.isArray(d.items) ? d.items.map(normalizeItem) : [],
  }
}

function normalizePacking(p) {
  if (!p || typeof p !== 'object') throw new Error('invalid packing item')
  return {
    id: typeof p.id === 'string' ? p.id : uid(),
    text: str(p.text),
    done: Boolean(p.done),
  }
}

function normalizeTrip(t) {
  if (!t || typeof t !== 'object' || !t.name) throw new Error('invalid trip entry')
  const now = new Date().toISOString()
  return {
    id: typeof t.id === 'string' ? t.id : uid(),
    name: String(t.name),
    destination: str(t.destination),
    startDate: str(t.startDate),
    endDate: str(t.endDate),
    currency: code(t.currency),
    timeZone: str(t.timeZone),
    ...(money(t.budget) != null && { budget: money(t.budget) }),
    travellers: Array.isArray(t.travellers) ? [...new Set(t.travellers.map(str).map(s => s.trim()).filter(Boolean))] : [],
    rates: Object.fromEntries(
      Object.entries(t.rates && typeof t.rates === 'object' ? t.rates : {})
        .map(([k, v]) => [code(k), num(v)])
        .filter(([k, v]) => k.length === 3 && v > 0),
    ),
    createdAt: str(t.createdAt) || now,
    updatedAt: str(t.updatedAt) || now,
    days: Array.isArray(t.days) ? t.days.map(normalizeDay) : [],
    packing: Array.isArray(t.packing) ? t.packing.map(normalizePacking).filter(p => p.text) : [],
  }
}

// Accepts an export payload or a bare array of trips.
export function normalizeTrips(data) {
  const trips = Array.isArray(data) ? data : data?.trips
  if (!Array.isArray(trips) || trips.length === 0) throw new Error('no trips found in file')
  return trips.map(normalizeTrip)
}

export function parseImport(text) {
  let data
  try {
    data = JSON.parse(text)
  } catch {
    throw new Error('not a valid JSON file')
  }
  return normalizeTrips(data)
}

/* A copy of a trip that can live next to the original: every trip, day, plan
   and packing id is new. Documents keep pointing at the same stored files. */
export function cloneTrip(trip, overrides = {}) {
  const now = new Date().toISOString()
  return {
    ...trip,
    id: uid(),
    createdAt: now,
    updatedAt: now,
    days: trip.days.map(d => ({ ...d, id: uid(), items: d.items.map(i => ({ ...i, id: uid() })) })),
    packing: (trip.packing ?? []).map(p => ({ ...p, id: uid() })),
    ...overrides,
  }
}
