import { useEffect, useState } from 'react'
import { zonedNow } from './dates'

/* Turns a day's plans into a time line: the plan you are on, the plan that
   comes next, and how long it is from one to the other.

   A plan keeps a start time and, when the user knows it, an end time. Without
   an end the app never guesses one: the plan you are on is simply the one
   that started last. A flight starts when it leaves and ends when it lands;
   a flight known only by its landing time is anchored there. */

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

/* ---------- a plan's times ---------- */

// The minute a plan is placed at on its day.
export const startOf = item => toMinutes(item?.time) ?? (item?.type === 'flight' ? toMinutes(item.endTime) : null)

// The minute a plan ends, counted from its own day's midnight: an end at or
// before the start runs past midnight. Null when either time is missing.
export function endOf(item) {
  const s = toMinutes(item?.time)
  const e = toMinutes(item?.endTime)
  if (s == null || e == null) return null
  return e <= s ? e + 1440 : e
}

// "10:35–14:20", "22:10–06:05 +1", "10:35", or "→ 14:20" for a landing time alone.
export function fmtTimes(item) {
  const s = toMinutes(item?.time)
  const e = toMinutes(item?.endTime)
  if (s != null && e != null) return `${fmtClock(s)}–${fmtClock(e)}${e <= s ? ' +1' : ''}`
  if (s != null) return fmtClock(s)
  if (e != null) return `→ ${fmtClock(e)}`
  return ''
}

// The clock the Today view runs on, in the trip's time zone: minutes since
// midnight plus the date, so the view also follows midnight.
export function useClock(timeZone = '') {
  const [clock, setClock] = useState(() => zonedNow(timeZone))
  useEffect(() => {
    const tick = () => setClock(zonedNow(timeZone))
    tick()
    const id = setInterval(tick, 30_000)
    document.addEventListener('visibilitychange', tick)
    return () => {
      clearInterval(id)
      document.removeEventListener('visibilitychange', tick)
    }
  }, [timeZone])
  return clock
}

/* ---------- the day plan ---------- */

const isOpen = entry => entry.item.status !== 'skipped' && entry.item.status !== 'done'

/* What lies between one plan and the next, or null when one carries no time:
     { kind: 'clash',  minutes }  both start together, or the first runs into
                                  the second (minutes of overlap)
     { kind: 'free',   minutes }  the first has an end: free time until the next
     { kind: 'later',  minutes }  no end known: start to start */
export function gapBetween(a, b) {
  if (a?.start == null || b?.start == null) return null
  if (b.start === a.start) return { kind: 'clash', minutes: 0 }
  if (a.end != null) {
    const free = b.start - a.end
    return free < 0 ? { kind: 'clash', minutes: -free } : { kind: 'free', minutes: free }
  }
  const diff = b.start - a.start
  return diff > 0 ? { kind: 'later', minutes: diff } : null
}

/* Everything the Today view needs for one day.

   `nowMinutes` is the clock for a day that is today, and null for any other
   day — then there is no "now" and the first open plan leads the view.

     hero    the plan to act on: the one running now, else the next one
     then    the plan after the hero
     later   the rest of the open plans, in time order, undated ones last
     missed  plans that started (or ended) before now and carry no result yet
     done    plans marked done or skipped */
export function dayPlan(day, nowMinutes = null) {
  const timed = []
  const undated = []
  for (const item of day.items) {
    const start = startOf(item)
    if (start == null) undated.push({ item, start: null, end: null })
    else timed.push({ item, start, end: endOf(item) })
  }
  timed.sort((a, b) => a.start - b.start) // a stable sort keeps equal times in list order

  const live = timed.filter(e => e.item.status !== 'skipped')
  let current = null
  let next = null
  const missed = []
  if (nowMinutes != null) {
    // The plan you are on is the last one that started, has not ended, and
    // still has no result. Anything else that started waits to be marked; a
    // plan that starts at the same minute stays in the queue, where the view
    // can show the two as a clash.
    const started = live.filter(e => isOpen(e) && e.start <= nowMinutes)
    const last = started[started.length - 1] ?? null
    current = last && (last.end == null || last.end > nowMinutes) ? last : null
    missed.push(...started.filter(e => e !== current && (!current || e.start < current.start)))
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
