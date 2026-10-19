import { createContext, useContext, useEffect, useReducer, useRef } from 'react'
import { readMirror, requestPersistence, scheduleBackup } from './backup'
import { addDaysISO, daysBetween } from './dates'
import { collectUnusedFiles } from './files'
import { normalizeTrips, upgradeItem } from './io'
import { startOf } from './schedule'
import { uid } from './uid'

export const KEY = 'triplanner:v1'

export { uid }

// Data an older version wrote is brought up to date once, when it loads.
export const migrate = trips =>
  trips.map(trip => ({
    ...trip,
    days: (trip.days ?? []).map(day => ({ ...day, items: (day.items ?? []).map(upgradeItem) })),
  }))

// True when localStorage held nothing readable — the browser cleared it, the
// value was damaged, or this is a first visit. Only then may the app restore
// from the IndexedDB copy: the copy follows deletions too, so a user who
// removed every trip must not get them back.
let storageWasEmpty = false

function load() {
  storageWasEmpty = false
  try {
    const raw = localStorage.getItem(KEY)
    if (raw !== null) {
      const data = JSON.parse(raw)
      if (data && Array.isArray(data.trips)) return { trips: migrate(data.trips) }
    }
  } catch {
    // corrupted storage — start fresh rather than crash
  }
  storageWasEmpty = true
  return { trips: [] }
}

function save(state) {
  try {
    localStorage.setItem(KEY, JSON.stringify(state))
    return true
  } catch {
    // storage full or unavailable — the IndexedDB copy keeps the data safe
    return false
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

export function makeTrip({ name, destination = '', startDate = '', endDate = '', currency = '', timeZone = '' }) {
  const now = new Date().toISOString()
  const days = []
  if (startDate) {
    const count = endDate ? Math.min(Math.max(daysBetween(startDate, endDate) + 1, 1), 90) : 1
    for (let i = 0; i < count; i++) days.push(makeDay(addDaysISO(startDate, i)))
  }
  return {
    id: uid(),
    name,
    destination,
    startDate,
    endDate,
    currency,
    timeZone,
    travellers: [],
    rates: {},
    createdAt: now,
    updatedAt: now,
    days,
    packing: [],
  }
}

/* Keeps a day readable: a timed plan lands among the other timed plans, and a
   plan with no time goes to the end. Plans already out of order (dragged by
   hand) are left where they are. */
export function placeByTime(items, item) {
  const start = startOf(item)
  if (start == null) return [...items, item]
  const at = items.findIndex(i => {
    const other = startOf(i)
    return other == null || other > start
  })
  return at < 0 ? [...items, item] : [...items.slice(0, at), item, ...items.slice(at)]
}

const insertAt = (arr, item, index) => {
  const copy = [...arr]
  copy.splice(index >= 0 && index <= copy.length ? index : copy.length, 0, item)
  return copy
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
    case 'trip/restore':
      // Newer than the delete, so a synced copy follows the Undo too.
      return { ...state, trips: insertAt(state.trips, touch(a.trip), a.index) }
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
      // An explicit index (an Undo) puts the plan back where it was; a new
      // plan finds its place by time.
      return mapTrip(state, a.tripId, t =>
        mapDay(t, a.dayId, d => ({
          ...d,
          items: a.index != null ? insertAt(d.items, a.item, a.index) : placeByTime(d.items, a.item),
        })),
      )
    case 'item/update':
      // `toDayId` moves the plan to another day. A plan whose time changes, or
      // that changes day, is placed by time again.
      return mapTrip(state, a.tripId, t => {
        const old = t.days.find(d => d.id === a.dayId)?.items.find(i => i.id === a.itemId)
        if (!old) return t
        const item = { ...old, ...a.patch }
        const toDayId = a.toDayId ?? a.dayId
        if (toDayId === a.dayId && startOf(item) === startOf(old)) {
          return mapDay(t, a.dayId, d => ({ ...d, items: d.items.map(i => (i.id === a.itemId ? item : i)) }))
        }
        if (!t.days.some(d => d.id === toDayId)) return t
        return {
          ...t,
          days: t.days.map(d => {
            let items = d.id === a.dayId ? d.items.filter(i => i.id !== a.itemId) : d.items
            if (d.id === toDayId) items = placeByTime(items, item)
            return items === d.items ? d : { ...d, items }
          }),
        }
      })
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
    case 'packing/add':
      return mapTrip(state, a.tripId, t => ({ ...t, packing: [...(t.packing ?? []), a.item] }))
    case 'packing/addMany':
      return mapTrip(state, a.tripId, t => ({ ...t, packing: [...(t.packing ?? []), ...a.items] }))
    case 'packing/toggle':
      return mapTrip(state, a.tripId, t => ({
        ...t,
        packing: (t.packing ?? []).map(p => (p.id === a.itemId ? { ...p, done: !p.done } : p)),
      }))
    case 'packing/delete':
      return mapTrip(state, a.tripId, t => ({ ...t, packing: (t.packing ?? []).filter(p => p.id !== a.itemId) }))
    case 'data/import': {
      // Trips with a known id replace the existing one (round-trip friendly);
      // everything else is added on top.
      const incoming = new Map(a.trips.map(t => [t.id, t]))
      const merged = state.trips.map(t => (incoming.has(t.id) ? incoming.get(t.id) : t))
      const existing = new Set(state.trips.map(t => t.id))
      const added = a.trips.filter(t => !existing.has(t.id))
      return { trips: [...added, ...merged] }
    }
    case 'sync/apply': {
      // Trips from the account: newer copies replace these, new ones are added,
      // ones deleted elsewhere go. Their updatedAt stays as the account has it.
      const incoming = new Map(a.trips.map(t => [t.id, t]))
      const gone = new Set(a.remove)
      const kept = state.trips.filter(t => !gone.has(t.id)).map(t => incoming.get(t.id) ?? t)
      const have = new Set(state.trips.map(t => t.id))
      return { trips: [...a.trips.filter(t => !have.has(t.id)), ...kept] }
    }
    case 'data/replace':
      // Another tab saved: its state is the latest.
      return { trips: a.trips }
    default:
      return state
  }
}

// The localStorage write waits for a short pause, so a drag (which changes the
// state on every hop between days) writes once. A tab that goes away writes
// at once.
const SAVE_DELAY = 250

const StoreCtx = createContext(null)

export function StoreProvider({ children, onRecover }) {
  const [state, dispatch] = useReducer(reducer, null, load)
  const recovered = useRef(false)
  const fromOtherTab = useRef(false)
  const unsaved = useRef(null)
  const latest = useRef(state)
  latest.current = state

  useEffect(() => {
    // State that came from another tab is already saved, and backed up, there.
    if (fromOtherTab.current) {
      fromOtherTab.current = false
      return
    }
    unsaved.current = state
    scheduleBackup(state.trips) // IndexedDB copy + the automatic backup file
    const t = setTimeout(() => {
      save(state)
      unsaved.current = null
    }, SAVE_DELAY)
    return () => clearTimeout(t)
  }, [state])

  useEffect(() => {
    const flush = () => {
      if (!unsaved.current) return
      save(unsaved.current)
      unsaved.current = null
    }
    const onHide = () => document.visibilityState === 'hidden' && flush()
    document.addEventListener('visibilitychange', onHide)
    window.addEventListener('pagehide', flush)
    return () => {
      document.removeEventListener('visibilitychange', onHide)
      window.removeEventListener('pagehide', flush)
    }
  }, [])

  // The app open in two places (the installed app and a browser tab) must not
  // overwrite each other: when the other one saves, this one takes its state.
  useEffect(() => {
    const onStorage = e => {
      if (e.key !== KEY || e.newValue == null) return
      try {
        const data = JSON.parse(e.newValue)
        if (!Array.isArray(data?.trips)) return
        fromOtherTab.current = true
        unsaved.current = null
        dispatch({ type: 'data/replace', trips: migrate(data.trips) })
      } catch {
        // a damaged value — keep what this tab has
      }
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  useEffect(() => {
    requestPersistence()
    // Documents whose plan is gone are cleared out a little after start.
    const t = setTimeout(() => collectUnusedFiles(latest.current.trips), 5000)
    return () => clearTimeout(t)
  }, [])

  // localStorage came back empty. If the IndexedDB copy survived, the trips
  // are still there — bring them back.
  useEffect(() => {
    if (!storageWasEmpty || recovered.current) return
    recovered.current = true
    readMirror()
      .then(snapshot => {
        if (!snapshot?.trips?.length) return
        const trips = normalizeTrips(snapshot)
        dispatch({ type: 'data/import', trips })
        onRecover?.(trips.length)
      })
      .catch(() => {
        // no readable copy — nothing to bring back
      })
  }, [onRecover])

  return <StoreCtx.Provider value={{ state, dispatch }}>{children}</StoreCtx.Provider>
}

export const useStore = () => useContext(StoreCtx)
