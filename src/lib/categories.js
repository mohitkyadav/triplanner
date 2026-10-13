export const CATEGORIES = [
  { id: 'flight', label: 'Flight', emoji: '✈️', badge: 'bg-sky-100 text-sky-700 dark:bg-sky-400/10 dark:text-sky-300' },
  {
    id: 'train',
    label: 'Train',
    emoji: '🚆',
    badge: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-400/10 dark:text-cyan-300',
  },
  {
    id: 'bus',
    label: 'Bus',
    emoji: '🚌',
    badge: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-400/10 dark:text-yellow-300',
  },
  {
    id: 'hotel',
    label: 'Hotel',
    emoji: '🏨',
    badge: 'bg-violet-100 text-violet-700 dark:bg-violet-400/10 dark:text-violet-300',
  },
  {
    id: 'restaurant',
    label: 'Restaurant',
    emoji: '🍽️',
    badge: 'bg-rose-100 text-rose-700 dark:bg-rose-400/10 dark:text-rose-300',
  },
  {
    id: 'cafe',
    label: 'Café',
    emoji: '☕',
    badge: 'bg-amber-100 text-amber-800 dark:bg-amber-400/10 dark:text-amber-300',
  },
  {
    id: 'bar',
    label: 'Nightlife',
    emoji: '🍸',
    badge: 'bg-fuchsia-100 text-fuchsia-700 dark:bg-fuchsia-400/10 dark:text-fuchsia-300',
  },
  {
    id: 'museum',
    label: 'Museum',
    emoji: '🏛️',
    badge: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-400/10 dark:text-indigo-300',
  },
  {
    id: 'landmark',
    label: 'Landmark',
    emoji: '🗼',
    badge: 'bg-orange-100 text-orange-700 dark:bg-orange-400/10 dark:text-orange-300',
  },
  {
    id: 'park',
    label: 'Park',
    emoji: '🌳',
    badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-300',
  },
  {
    id: 'beach',
    label: 'Beach',
    emoji: '🏖️',
    badge: 'bg-teal-100 text-teal-700 dark:bg-teal-400/10 dark:text-teal-300',
  },
  {
    id: 'shopping',
    label: 'Shopping',
    emoji: '🛍️',
    badge: 'bg-pink-100 text-pink-700 dark:bg-pink-400/10 dark:text-pink-300',
  },
  {
    id: 'activity',
    label: 'Activity',
    emoji: '🎟️',
    badge: 'bg-lime-100 text-lime-800 dark:bg-lime-400/10 dark:text-lime-300',
  },
  {
    id: 'work',
    label: 'Work',
    emoji: '💼',
    badge: 'bg-stone-200 text-stone-700 dark:bg-stone-400/10 dark:text-stone-300',
  },
  {
    id: 'other',
    label: 'Other',
    emoji: '📌',
    badge: 'bg-slate-100 text-slate-700 dark:bg-slate-400/10 dark:text-slate-300',
  },
]

// The single "transport" type became "train" and "bus"; old data keeps working.
export const RENAMED_TYPES = { transport: 'train' }

export const catById = id =>
  CATEGORIES.find(c => c.id === (RENAMED_TYPES[id] ?? id)) ?? CATEGORIES[CATEGORIES.length - 1]

// "BER → LIS", "→ LIS", "BER →", or '' for a flight with neither end.
export function flightRoute(item) {
  const from = (item.from ?? '').trim()
  const to = (item.to ?? '').trim()
  if (from && to) return `${from} → ${to}`
  if (from) return `${from} →`
  return to ? `→ ${to}` : ''
}

export function titleFor(item) {
  if (item.title) return item.title
  if (item.type === 'flight') {
    const route = flightRoute(item)
    if (route && item.flightNo) return `${route} · ${item.flightNo}`
    return route || (item.flightNo ? `Flight ${item.flightNo}` : 'Flight')
  }
  return 'Untitled'
}
