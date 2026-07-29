import { useEffect, useState } from 'react'
import { todayISO } from './dates'

/* Turns a day's plans into a time line: the plan you are on, the plan that
   comes next, and how long it is from one to the other.

   A plan keeps a start time and nothing more. The app never guesses how long
   a plan runs, so it never claims an end time: the plan you are on is simply
   the one that started last. */

/* ---------- time helpers (minutes since midnight) ---------- */

export function toMinutes(hhmm) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm ?? '')
  if (!m) return null
  const min = Number(m[1]) * 60 + Number(m[2])
  return min >= 0 && min < 1440 ? min : null
}

export const fmtClock = min => {
  const m = ((Math.round(min) % 1440) + 1440) % 1440
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
}

export function fmtDuration(min) {
  if (!Number.isFinite(min) || min <= 0) return ''
  const total = Math.round(min)
  const h = Math.floor(total / 60)
  const m = total % 60
  if (!h) return `${m} min`
  return m ? `${h} h ${m} min` : `${h} h`
}

export const clockMinutes = () => {
  const d = new Date()
  return d.getHours() * 60 + d.getMinutes()
}

// The clock the Today view runs on: the time in minutes plus the current date,
// so the view also follows midnight.
export function useClock() {
  const read = () => ({ minutes: clockMinutes(), today: todayISO() })
  const [clock, setClock] = useState(read)
  useEffect(() => {
    const tick = () => setClock(read())
    const id = setInterval(tick, 30_000)
    document.addEventListener('visibilitychange', tick)
    return () => {
      clearInterval(id)
      document.removeEventListener('visibilitychange', tick)
    }
  }, [])
  return clock
}

/* ---------- the day plan ---------- */

const isOpen = entry => entry.item.status !== 'skipped' && entry.item.status !== 'done'

// Minutes from the start of one plan to the start of the next, or null when
// one of the two carries no time. 0 means both start at the same time.
export const gapBetween = (a, b) => {
  if (a?.start == null || b?.start == null) return null
  const diff = b.start - a.start
  return diff >= 0 ? diff : null
}

/* Everything the Today view needs for one day.

   `nowMinutes` is the clock for a day that is today, and null for any other
   day — then there is no "now" and the first open plan leads the view.

     hero    the plan to act on: the one that started last, else the next one
     then    the plan after the hero
     later   the rest of the open plans, in time order, undated ones last
     missed  plans that started before the hero and carry no result yet
     done    plans marked done or skipped */
export function dayPlan(day, nowMinutes = null) {
  const timed = []
  const undated = []
  for (const item of day.items) {
    const start = toMinutes(item.time)
    if (start == null) undated.push({ item })
    else timed.push({ item, start })
  }
  timed.sort((a, b) => a.start - b.start) // a stable sort keeps equal times in list order

  const live = timed.filter(e => e.item.status !== 'skipped')
  let current = null
  let next = null
  const missed = []
  if (nowMinutes != null) {
    // The plan you are on is the last one that started and still has no
    // result. Anything that started *before* it waits to be marked; a plan
    // that starts at the same minute stays in the queue, where the view can
    // show the two as a clash.
    const started = live.filter(e => isOpen(e) && e.start <= nowMinutes)
    current = started[started.length - 1] ?? null
    if (current) missed.push(...started.filter(e => e.start < current.start))
    next = live.find(e => isOpen(e) && e.start > nowMinutes) ?? null
  }

  const open = [...live.filter(isOpen), ...undated.filter(isOpen)]
  // On today the view leads with the plan in hand; on any other day it simply
  // leads with the first plan.
  const hero = current ?? next ?? (nowMinutes == null ? (open[0] ?? null) : null)
  const queue = open.filter(e => e !== hero && !missed.includes(e))
  const all = [...timed, ...undated]

  return {
    hero,
    running: Boolean(current),
    then: queue[0] ?? null,
    later: queue.slice(1),
    missed,
    done: all.filter(e => !isOpen(e)),
    doneCount: all.filter(e => e.item.status === 'done').length,
    openCount: all.filter(e => e.item.status !== 'skipped').length,
    total: all.length,
  }
}
