import { createContext, useContext, useEffect, useReducer } from 'react'
import { addDaysISO, daysBetween } from './dates'

const KEY = 'triplanner:v1'

export const uid = () =>
  globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2) + Date.now().toString(36)

function load() {
  try {
    const data = JSON.parse(localStorage.getItem(KEY))
    if (data && Array.isArray(data.trips)) return { trips: data.trips }
  } catch {
    // corrupted storage — start fresh rather than crash
  }
  return { trips: [] }
}

function save(state) {
  try {
    localStorage.setItem(KEY, JSON.stringify(state))
  } catch {
    // storage full or unavailable — keep the app usable in memory
  }
}

// Days with dates sort chronologically; undated days keep their position at the end.
export function sortDays(days) {
  return [...days].sort((a, b) => {
    if (!a.date && !b.date) return 0
    if (!a.date) return 1
    if (!b.date) return -1
    return a.date < b.date ? -1 : a.date > b.date ? 1 : 0
  })
}

export function makeDay(date = '') {
  return { id: uid(), date, title: '', items: [] }
}

export function makeTrip({ name, destination = '', startDate = '', endDate = '' }) {
  const now = new Date().toISOString()
  const days = []
  if (startDate) {
    const count = endDate ? Math.min(Math.max(daysBetween(startDate, endDate) + 1, 1), 90) : 1
    for (let i = 0; i < count; i++) days.push(makeDay(addDaysISO(startDate, i)))
  }
  return { id: uid(), name, destination, startDate, endDate, createdAt: now, updatedAt: now, days }
}

const touch = trip => ({ ...trip, updatedAt: new Date().toISOString() })

const mapTrip = (state, id, fn) => ({
  ...state,
  trips: state.trips.map(t => (t.id === id ? touch(fn(t)) : t)),
})

const mapDay = (trip, dayId, fn) => ({
  ...trip,
  days: trip.days.map(d => (d.id === dayId ? fn(d) : d)),
})

function reducer(state, a) {
  switch (a.type) {
    case 'trip/create':
      return { ...state, trips: [a.trip, ...state.trips] }
    case 'trip/update':
      return mapTrip(state, a.id, t => ({ ...t, ...a.patch }))
    case 'trip/delete':
      return { ...state, trips: state.trips.filter(t => t.id !== a.id) }
    case 'day/add':
      return mapTrip(state, a.tripId, t => ({ ...t, days: sortDays([...t.days, a.day]) }))
    case 'day/update':
      return mapTrip(state, a.tripId, t => ({
        ...t,
        days: sortDays(t.days.map(d => (d.id === a.dayId ? { ...d, ...a.patch } : d))),
      }))
    case 'day/delete':
      return mapTrip(state, a.tripId, t => ({ ...t, days: t.days.filter(d => d.id !== a.dayId) }))
    case 'item/add':
      return mapTrip(state, a.tripId, t => mapDay(t, a.dayId, d => ({ ...d, items: [...d.items, a.item] })))
    case 'item/update':
      return mapTrip(state, a.tripId, t =>
        mapDay(t, a.dayId, d => ({
          ...d,
          items: d.items.map(i => (i.id === a.itemId ? { ...i, ...a.patch } : i)),
        })),
      )
    case 'item/delete':
      return mapTrip(state, a.tripId, t =>
        mapDay(t, a.dayId, d => ({ ...d, items: d.items.filter(i => i.id !== a.itemId) })),
      )
    case 'item/move':
      return mapTrip(state, a.tripId, t =>
        mapDay(t, a.dayId, d => {
          const items = [...d.items]
          const [moved] = items.splice(a.from, 1)
          items.splice(a.to, 0, moved)
          return { ...d, items }
        }),
      )
    case 'item/transfer':
      return mapTrip(state, a.tripId, t => {
        const item = t.days.find(d => d.id === a.fromDayId)?.items.find(i => i.id === a.itemId)
        if (!item || a.fromDayId === a.toDayId) return t
        return {
          ...t,
          days: t.days.map(d => {
            if (d.id === a.fromDayId) return { ...d, items: d.items.filter(i => i.id !== a.itemId) }
            if (d.id === a.toDayId) {
              const items = [...d.items]
              items.splice(Math.min(a.toIndex, items.length), 0, item)
              return { ...d, items }
            }
            return d
          }),
        }
      })
    case 'trip/setDays':
      return mapTrip(state, a.tripId, t => ({ ...t, days: a.days }))
    case 'data/import': {
      // Trips with a known id replace the existing one (round-trip friendly);
      // everything else is added on top.
      const incoming = new Map(a.trips.map(t => [t.id, t]))
      const merged = state.trips.map(t => (incoming.has(t.id) ? incoming.get(t.id) : t))
      const existing = new Set(state.trips.map(t => t.id))
      const added = a.trips.filter(t => !existing.has(t.id))
      return { trips: [...added, ...merged] }
    }
    default:
      return state
  }
}

const StoreCtx = createContext(null)

export function StoreProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, null, load)
  useEffect(() => save(state), [state])
  return <StoreCtx.Provider value={{ state, dispatch }}>{children}</StoreCtx.Provider>
}

export const useStore = () => useContext(StoreCtx)
