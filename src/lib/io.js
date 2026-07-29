import { uid } from './store'

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

function normalizeItem(i) {
  if (!i || typeof i !== 'object') throw new Error('invalid item')
  return {
    id: typeof i.id === 'string' ? i.id : uid(),
    type: str(i.type) || 'other',
    title: str(i.title),
    time: str(i.time),
    mapsUrl: str(i.mapsUrl),
    notes: str(i.notes),
    ...(Number.isFinite(+i.cost) && +i.cost > 0 && { cost: Math.round(+i.cost * 100) / 100 }),
    ...(['done', 'skipped'].includes(i.status) && { status: i.status }),
    ...(i.type === 'flight' && {
      flightNo: str(i.flightNo),
      direction: i.direction === 'departure' ? 'departure' : 'arrival',
      location: str(i.location),
    }),
    ...(i.type === 'hotel' && {
      hotelAction: i.hotelAction === 'check-out' ? 'check-out' : 'check-in',
    }),
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
    currency: str(t.currency).toUpperCase().slice(0, 3),
    createdAt: str(t.createdAt) || now,
    updatedAt: str(t.updatedAt) || now,
    days: Array.isArray(t.days) ? t.days.map(normalizeDay) : [],
    packing: Array.isArray(t.packing) ? t.packing.map(normalizePacking).filter(p => p.text) : [],
  }
}

export function parseImport(text) {
  let data
  try {
    data = JSON.parse(text)
  } catch {
    throw new Error('not a valid JSON file')
  }
  const trips = Array.isArray(data) ? data : data?.trips
  if (!Array.isArray(trips) || trips.length === 0) throw new Error('no trips found in file')
  return trips.map(normalizeTrip)
}
