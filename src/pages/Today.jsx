import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import AirlineLogo from '../components/AirlineLogo'
import { DocumentChips, DocumentViewer } from '../components/Documents'
import DayMapPanel, { mappable } from '../components/DayMapPanel'
import { PlanRow } from '../components/ItemCard'
import ItemForm from '../components/ItemForm'
import MapLinks from '../components/MapLinks'
import WeatherChip from '../components/WeatherChip'
import {
  btnChip,
  btnChipBrand,
  btnPrimary,
  Collapse,
  IconAlert,
  IconArrowLeft,
  IconCheckCircle,
  IconChevronDown,
  IconChevronLeft,
  IconChevronRight,
  IconHourglass,
  IconMap,
  IconNavigation,
  IconPencil,
  IconPlus,
  IconRadar,
  IconRoute,
  IconTicket,
  IconXCircle,
  iconBtn,
  RollingText,
  useDismiss,
  useToast,
} from '../components/ui'
import { airlineFromFlightNo, flightTrackerUrl } from '../lib/airlines'
import { airportCity, catById, titleFor } from '../lib/categories'
import { deviceTimeZone, fmtDate } from '../lib/dates'
import { dayRouteUrl, pairRouteUrl } from '../lib/maps'
import { costCurrency, dayCost, fmtMoney } from '../lib/money'
import { reducedMotion, transition, vtName } from '../lib/motion'
import { dayPlan, fmtClock, fmtDuration, fmtTimes, gapBetween, useClock } from '../lib/schedule'
import { uid, useStore } from '../lib/store'
import { rainAhead, useWeather, useWeatherNow, weatherIcon } from '../lib/weather'
import { legBetween } from '../lib/timeline'
import CategoryIcon from '../components/CategoryIcon'

/* Trip mode: one day at a time, led by the plan to act on right now. The
   classic day list stays the place to build a trip; this view is for the days
   of the trip itself. */

const STATUS_NEXT = { undefined: 'done', done: 'skipped', skipped: undefined }
const STATUS_WORD = { done: 'Marked done', skipped: 'Marked skipped', undefined: 'Back to planned' }

// What lies between one plan and the next (see gapBetween). Both times come
// from the user, so this is never a guess. Plans that start together, or run
// into each other, are a clash worth showing.
function GapChip({ gap }) {
  if (!gap) return null
  if (gap.kind === 'clash') {
    return (
      <span className="anim-shake inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-md bg-rose-100 px-1.5 py-0.5 text-[11px] font-bold text-rose-700 dark:bg-rose-400/10 dark:text-rose-300">
        <IconAlert className="size-3" />
        {gap.minutes === 0 ? 'same time' : `overlaps ${fmtDuration(gap.minutes)}`}
      </span>
    )
  }
  if (gap.minutes === 0) return null
  return (
    <span className="anim-fade inline-flex shrink-0 items-center gap-1 whitespace-nowrap text-[11px] font-semibold text-slate-400 dark:text-slate-500">
      <IconHourglass className="size-3" />
      {fmtDuration(gap.minutes)} {gap.kind === 'free' ? 'free' : 'later'}
    </span>
  )
}

function Chip({ item, className = 'size-11 rounded-xl [&>svg]:size-5.5' }) {
  const cat = catById(item.type)
  const airline = item.type === 'flight' ? airlineFromFlightNo(item.flightNo) : null
  const emoji = (
    <span className={`grid shrink-0 place-items-center ${className} ${cat.badge}`}>
      <CategoryIcon type={item.type} />
    </span>
  )
  return airline ? (
    <AirlineLogo iata={airline.iata} name={airline.name} className={className} fallback={emoji} />
  ) : (
    emoji
  )
}

const timeLabel = entry => (entry.start == null ? 'Any time' : fmtTimes(entry.item))

// "ends in 20 min" for the plan you are on, "in 45 min" for the next one.
function countdownFor(entry, running, now) {
  if (now == null) return ''
  if (running) return entry.end != null && entry.end > now ? `ends in ${fmtDuration(entry.end - now)}` : ''
  return entry.start != null && entry.start > now ? `in ${fmtDuration(entry.start - now)}` : ''
}

/* ---------- the card that leads the view ---------- */

// A plan keeps its name wherever it shows, so marking it done moves the card
// down into "Done and skipped" and the next plan up into its place.
const planName = item => ({ viewTransitionName: vtName('now', item.id), viewTransitionClass: 'plan' })

// The label for the lead card's document button, from the file's name.
function ticketLabel(doc) {
  if (/board/i.test(doc.name)) return 'Boarding pass'
  if (/ticket|pass|entry|voucher/i.test(doc.name)) return 'Show ticket'
  return 'Open document'
}

function HeroCard({ trip, entry, label, running, now, onEdit, onStatus }) {
  const { item } = entry
  const [viewing, setViewing] = useState(null) // the document open full screen
  const ticket = item.attachments?.[0] ?? null
  const cities =
    item.type === 'flight' && airportCity(item.from) && airportCity(item.to)
      ? `${airportCity(item.from)} → ${airportCity(item.to)}`
      : ''
  const countdown = countdownFor(entry, running, now)
  const left =
    running && now != null && entry.end != null && entry.end > entry.start
      ? Math.max(0, Math.min(100, ((entry.end - now) / (entry.end - entry.start)) * 100))
      : null
  const tracker = item.type === 'flight' ? flightTrackerUrl(item.flightNo) : null

  return (
    <section
      className={`overflow-hidden rounded-2xl bg-white shadow-sm ring-1 dark:bg-slate-900 ${
        running ? 'ring-2 ring-brand-500 dark:ring-brand-400' : 'ring-slate-200 dark:ring-slate-800'
      }`}
      style={planName(item)}
    >
      <div className="flex items-center gap-2 px-4 pt-3.5">
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide ${
            running
              ? 'bg-brand text-white dark:bg-brand-600'
              : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
          }`}
        >
          {running && (
            <span className="relative flex size-1.5" aria-hidden="true">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-accent opacity-75 motion-reduce:hidden" />
              <span className="relative inline-flex size-1.5 rounded-full bg-accent" />
            </span>
          )}
          {label}
        </span>
        <span className="flex-1" />
        <button className={iconBtn} onClick={onEdit} aria-label={`Edit ${titleFor(item)}`}>
          <IconPencil className="size-4" />
        </button>
      </div>

      <div className="flex items-start gap-3 px-4 pb-4 pt-2">
        <Chip item={item} />
        <div className="min-w-0 flex-1">
          <h2 className="text-xl font-bold leading-tight">{titleFor(item)}</h2>
          <p className="mt-1 text-sm font-semibold tabular-nums text-brand-600 dark:text-brand-300">
            {timeLabel(entry)}
            {countdown && (
              <span className="font-medium text-slate-500 dark:text-slate-400">
                {' '}
                · <RollingText text={countdown} />
              </span>
            )}
          </p>
          {left != null && (
            // the time left, draining as the plan runs
            <span className="mt-1.5 block h-1 w-full max-w-48 overflow-hidden rounded-full bg-brand-100 dark:bg-brand-500/15">
              <span
                className="block h-full rounded-full bg-brand-500 transition-[width] duration-1000 ease-linear dark:bg-brand-400"
                style={{ width: `${left}%` }}
              />
            </span>
          )}
          {(cities || Number.isFinite(item.cost)) && (
            <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
              {cities && <span>{cities}</span>}
              {Number.isFinite(item.cost) && (
                <span className="font-semibold tabular-nums text-slate-600 dark:text-slate-300">
                  {fmtMoney(item.cost, costCurrency(trip, item))}
                </span>
              )}
            </div>
          )}
          {item.notes && (
            <p className="mt-2 whitespace-pre-wrap text-sm text-slate-600 dark:text-slate-300">{item.notes}</p>
          )}
          <DocumentChips docs={item.attachments} className="mt-2.5" />
        </div>
      </div>

      {/* the ticket, one tap away at the gate or the door */}
      {ticket && (
        <div className="px-4 pb-3">
          <button
            onClick={() => setViewing(ticket)}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-bold text-brand shadow-sm transition hover:brightness-105 active:scale-[.99]"
          >
            <IconTicket className="size-4.5" />
            {ticketLabel(ticket)}
            {item.attachments.length > 1 && (
              <span className="font-semibold opacity-70">+{item.attachments.length - 1}</span>
            )}
          </button>
        </div>
      )}
      {viewing && <DocumentViewer doc={viewing} onClose={() => setViewing(null)} />}

      <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 px-4 py-3 dark:border-slate-800">
        <button className={btnChipBrand} onClick={() => onStatus('done')}>
          <IconCheckCircle className="size-4" />
          Done
        </button>
        <button className={btnChip} onClick={() => onStatus('skipped')}>
          <IconXCircle className="size-4" />
          Skip
        </button>
        <span className="flex-1" />
        {tracker && (
          <a className={btnChip} href={tracker} target="_blank" rel="noopener noreferrer">
            <IconRadar className="size-4" />
            Track
          </a>
        )}
        <MapLinks trip={trip} item={item} hero />
      </div>
    </section>
  )
}

/* ---------- the step from one stop to the next ---------- */

function Hop({ trip, from, to }) {
  const gap = gapBetween(from, to)
  const url = pairRouteUrl(trip, from.item, to.item)
  const inner = (
    <>
      <IconNavigation className="size-3.5 shrink-0" />
      <span className="min-w-0 truncate font-medium">
        {url ? `Directions to ${titleFor(to.item)}` : `Then ${titleFor(to.item)}`}
      </span>
      <span className="flex-1" />
      <GapChip gap={gap} />
    </>
  )
  const cls = 'mx-1 my-1.5 flex items-center gap-2 rounded-xl px-3 py-2 text-xs text-slate-500 dark:text-slate-400'
  return url ? (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={`${cls} transition hover:bg-white hover:text-brand-600 dark:hover:bg-slate-900 dark:hover:text-brand-300`}
    >
      {inner}
    </a>
  ) : (
    <div className={cls}>{inner}</div>
  )
}

/* ---------- the rest of the day ---------- */

// Plans in a row on the day's line (the trip page's look), with what lies
// between one and the next. `vtPrefix` 'now' lets a row and the lead card
// morph into each other when a plan is marked.
function Timeline({ trip, entries, muted, selectedId, onTap, onStatus }) {
  return (
    <ul>
      {entries.map((entry, i) => (
        <PlanRow
          key={entry.item.id}
          trip={trip}
          item={entry.item}
          leg={i < entries.length - 1 ? legBetween(entry.item, entries[i + 1].item) : null}
          first={i === 0}
          last={i === entries.length - 1}
          vtPrefix="now"
          muted={muted}
          selected={entry.item.id === selectedId}
          onEdit={() => onTap(entry.item)}
          onSetStatus={status => onStatus(entry.item, status)}
        />
      ))}
    </ul>
  )
}

function Heading({ children }) {
  return (
    <h3 className="mb-2 px-1 text-[13px] font-bold uppercase tracking-wide text-slate-400 dark:text-slate-500">
      {children}
    </h3>
  )
}

// What is done or skipped, folded into one line until asked for.
function DoneFold({ count, children }) {
  const [open, setOpen] = useState(false)
  return (
    <section>
      <button
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        className="flex w-full items-center gap-1.5 rounded-xl px-1 py-1.5 text-left text-[13px] font-semibold text-slate-500 transition hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-900"
      >
        <IconCheckCircle className="size-4 text-emerald-500" />
        {count} done or skipped
        <span className="flex-1" />
        <IconChevronDown className={`size-4 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      <Collapse open={open}>
        <div className="pt-2">{children}</div>
      </Collapse>
    </section>
  )
}

/* Map mode: the day's map over the whole screen, and its plans in a sheet
   pulled up from the bottom — a peek, half the screen, or most of it. A pin
   picked on the map lights its row in the sheet, a row tapped once shows
   its pin, and a second tap opens it. Back or the shrink button leave. */
const SHEET = [0.2, 0.46, 0.86] // of the screen's height

function MapMode({ title, onClose, map, children }) {
  useDismiss(onClose)
  const [snap, setSnap] = useState(1)
  const [dragged, setDragged] = useState(null) // the sheet's height while a finger moves it
  const drag = useRef(null)
  const height = snap => Math.round(window.innerHeight * SHEET[snap])
  const shown = dragged ?? height(snap)

  const handle = {
    onPointerDown: e => {
      if (e.target.closest('button')) return
      drag.current = { y: e.clientY, h: shown, t: e.timeStamp, v: 0, last: e.clientY }
      e.currentTarget.setPointerCapture(e.pointerId)
    },
    onPointerMove: e => {
      const d = drag.current
      if (!d) return
      d.v = (d.last - e.clientY) / Math.max(1, e.timeStamp - d.t)
      d.last = e.clientY
      d.t = e.timeStamp
      setDragged(Math.max(96, Math.min(window.innerHeight * 0.92, d.h + d.y - e.clientY)))
    },
    onPointerUp: () => {
      const d = drag.current
      drag.current = null
      if (!d) return
      // a flick goes to the next stop its way; otherwise the nearest stop wins
      const h = dragged ?? d.h
      const stops = SHEET.map((_, n) => n)
      let next = stops.reduce((a, b) => (Math.abs(height(b) - h) < Math.abs(height(a) - h) ? b : a))
      if (d.v > 0.4) next = stops.find(n => height(n) > h + 8) ?? 2
      if (d.v < -0.4) next = stops.filter(n => height(n) < h - 8).pop() ?? 0
      setSnap(next)
      setDragged(null)
    },
  }
  handle.onPointerCancel = handle.onPointerUp

  return createPortal(
    <div className="fixed inset-0 z-50 bg-slate-100 dark:bg-slate-900" role="region" aria-label="Map mode">
      <div className="absolute inset-0">{map(Math.round(shown / 2))}</div>
      <div
        data-sheet
        className="absolute inset-x-0 bottom-0 z-10 mx-auto flex max-w-2xl flex-col rounded-t-3xl bg-slate-50 shadow-[0_-8px_30px_rgba(0,0,0,0.18)] ring-1 ring-slate-200 dark:bg-slate-950 dark:ring-slate-800"
        style={{ height: shown, transition: dragged == null ? 'height .32s cubic-bezier(.2,.8,.2,1)' : 'none' }}
      >
        <div {...handle} className="shrink-0 cursor-grab touch-none px-4 pb-2 pt-2 active:cursor-grabbing">
          <div className="mx-auto mb-2 h-1.5 w-10 rounded-full bg-slate-300 dark:bg-slate-700" />
          <div className="flex items-center gap-2">
            <span className="min-w-0 flex-1 truncate text-sm font-bold">{title}</span>
            <button
              className={iconBtn}
              onClick={() => setSnap(snap === 2 ? 0 : 2)}
              aria-label={snap === 2 ? 'Lower the list' : 'Raise the list'}
            >
              <IconChevronDown className={`size-4.5 transition-transform ${snap === 2 ? '' : 'rotate-180'}`} />
            </button>
          </div>
        </div>
        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
          {children({ raise: () => snap === 0 && setSnap(1) })}
        </div>
      </div>
    </div>,
    document.body,
  )
}

/* Two bursts from the bottom corners, loaded only when a day is complete. */
function confetti() {
  if (reducedMotion()) return
  import('canvas-confetti')
    .then(({ default: fire }) => {
      const colors = ['#1a7a72', '#48a094', '#e5a33f', '#f4c27a', '#ffffff']
      const shot = { particleCount: 70, spread: 65, startVelocity: 55, ticks: 220, colors, zIndex: 70 }
      fire({ ...shot, angle: 60, origin: { x: 0, y: 0.95 } })
      fire({ ...shot, angle: 120, origin: { x: 1, y: 0.95 } })
    })
    .catch(() => {})
}

/* ---------- the page ---------- */

export default function Today({ id, navigate }) {
  const { state, dispatch } = useStore()
  const toast = useToast()
  const trip = state.trips.find(t => t.id === id)
  const { minutes, today } = useClock(trip?.timeZone)
  const days = useMemo(() => trip?.days ?? [], [trip])
  const weather = useWeather(trip)
  // the weather now and soon, while the trip is on today
  const weatherNow = useWeatherNow(
    trip,
    days.some(d => d.date === today),
  )

  const [pickedIndex, setPickedIndex] = useState(null) // null follows the clock
  const [itemModal, setItemModal] = useState(null) // { dayId, item? }
  const [showMap, setShowMap] = useState(readMapPref)
  const [mapMode, setMapMode] = useState(false)
  const [selectedId, setSelectedId] = useState(null) // the plan picked on the map in map mode
  const swipe = useRef(null)

  // The day the trip is on: today, else the next day of the trip, else the last.
  const clockIndex = useMemo(() => {
    if (days.length === 0) return 0
    const exact = days.findIndex(d => d.date === today)
    if (exact >= 0) return exact
    const ahead = days.findIndex(d => d.date && d.date >= today)
    return ahead >= 0 ? ahead : days.length - 1
  }, [days, today])

  useEffect(() => {
    if (!trip) navigate('')
  }, [trip, navigate])

  if (!trip) return null

  if (days.length === 0) {
    return (
      <div className="min-h-dvh">
        <Header trip={trip} navigate={navigate} routeUrl={null} />
        <main className="mx-auto max-w-2xl px-4 pt-16 text-center">
          <p className="text-sm text-slate-500 dark:text-slate-400">This trip has no days yet.</p>
          <button className={`${btnPrimary} mt-4`} onClick={() => navigate(`/trip/${trip.id}`)}>
            Open the trip
          </button>
        </main>
      </div>
    )
  }

  const dayIndex = Math.min(pickedIndex ?? clockIndex, days.length - 1)
  const day = days[dayIndex]
  const isToday = day.date === today
  const plan = dayPlan(day, isToday ? minutes : null)
  const cost = dayCost(trip, day)
  // The trip's clock, shown when it is not the one on this device.
  const zoneClock = trip.timeZone && trip.timeZone !== deviceTimeZone() ? fmtClock(minutes) : null
  const routeUrl = dayRouteUrl(trip, day)

  // Moves to another day: the old day slides out, the new one in from the
  // side it lies on.
  function pickDay(index) {
    const to = Math.max(0, Math.min(days.length - 1, index ?? clockIndex))
    if (to === dayIndex) return
    transition(() => setPickedIndex(index), to > dayIndex ? 'next' : 'prev')
  }

  // A sideways swipe over the day goes to the day before or after.
  const swipeHandlers = {
    onTouchStart: e => {
      const t = e.touches[0]
      swipe.current = e.touches.length === 1 ? { x: t.clientX, y: t.clientY } : null
    },
    onTouchEnd: e => {
      const start = swipe.current
      swipe.current = null
      if (!start) return
      const t = e.changedTouches[0]
      const dx = t.clientX - start.x
      const dy = t.clientY - start.y
      if (Math.abs(dx) < 70 || Math.abs(dx) < Math.abs(dy) * 1.8) return
      pickDay(dayIndex + (dx < 0 ? 1 : -1))
    },
  }

  function setStatus(item, status) {
    const previous = item.status
    const patch = { status }
    // The last open plan of the day gets a result: the day is complete.
    const completes = item.status == null && status != null && plan.total - plan.done.length === 1
    const celebrate = completes && plan.doneCount + (status === 'done' ? 1 : 0) > 0
    dispatch({ type: 'item/update', tripId: trip.id, dayId: day.id, itemId: item.id, patch })
    if (celebrate) confetti()
    toast(celebrate ? 'Day complete 🎉' : STATUS_WORD[status], {
      label: 'Undo',
      onClick: () =>
        dispatch({
          type: 'item/update',
          tripId: trip.id,
          dayId: day.id,
          itemId: item.id,
          patch: { status: previous },
        }),
    })
  }

  function saveItem(data, toDayId) {
    if (itemModal.item) {
      dispatch({ type: 'item/update', tripId: trip.id, dayId: day.id, toDayId, itemId: itemModal.item.id, patch: data })
    } else {
      dispatch({ type: 'item/add', tripId: trip.id, dayId: toDayId ?? day.id, item: { id: uid(), ...data } })
    }
    setItemModal(null)
  }

  function deleteItem() {
    const item = itemModal.item
    const index = day.items.findIndex(i => i.id === item.id)
    dispatch({ type: 'item/delete', tripId: trip.id, dayId: day.id, itemId: item.id })
    setItemModal(null)
    toast('Plan deleted', {
      label: 'Undo',
      onClick: () => dispatch({ type: 'item/add', tripId: trip.id, dayId: day.id, item, index }),
    })
  }

  const runningId = plan.running ? plan.hero.item.id : null
  const rest = [plan.then, ...plan.later].filter(Boolean)
  const progress = plan.openCount ? (plan.doneCount / plan.openCount) * 100 : 0
  const nowWx = isToday && weatherNow ? weatherIcon(weatherNow.code) : null
  const rain = isToday ? rainAhead(weatherNow) : ''

  // A row tapped in map mode shows its pin first; tapped again, it opens.
  const tapRow = inSheet => item => {
    if (inSheet && selectedId !== item.id) return setSelectedId(item.id)
    setItemModal({ dayId: day.id, item })
  }

  // The day's plans: the one to act on, then the rest on the line, then
  // those waiting for a result, then — folded — the ones done or skipped.
  const dayList = inSheet => (
    <>
      {plan.total === 0 && (
        <div className="rounded-2xl border-2 border-dashed border-slate-300 px-4 py-10 text-center dark:border-slate-700">
          <p className="text-sm text-slate-500 dark:text-slate-400">Nothing is planned for this day.</p>
          <button className={`${btnPrimary} mt-3`} onClick={() => setItemModal({ dayId: day.id })}>
            <IconPlus className="size-4" />
            Add a plan
          </button>
        </div>
      )}

      {plan.hero && (
        <div>
          <HeroCard
            trip={trip}
            entry={plan.hero}
            label={plan.running ? 'Now' : isToday ? 'Next up' : 'First up'}
            running={plan.running}
            now={isToday ? minutes : null}
            onEdit={() => setItemModal({ dayId: day.id, item: plan.hero.item })}
            onStatus={status => setStatus(plan.hero.item, status)}
          />
          {plan.then && <Hop trip={trip} from={plan.hero} to={plan.then} />}
        </div>
      )}

      {!plan.hero && plan.total > 0 && (
        <div className="rounded-2xl bg-white px-4 py-8 text-center shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800">
          <p className="text-3xl">{plan.missed.length > 0 ? '🌙' : '🎉'}</p>
          <p className="mt-2 text-sm font-semibold">
            {isToday ? 'Nothing more is planned today' : 'Every plan of this day is marked'}
          </p>
          <p className="mt-0.5 text-[13px] text-slate-500 dark:text-slate-400">
            {plan.missed.length > 0
              ? 'Some plans have no result yet. Mark them below.'
              : 'Every plan of this day carries a result.'}
          </p>
        </div>
      )}

      {rest.length > 0 && (
        <section>
          <Heading>{plan.hero ? (isToday ? 'Later today' : 'Then') : 'Also this day'}</Heading>
          <Timeline
            trip={trip}
            entries={rest}
            selectedId={inSheet ? selectedId : null}
            onTap={tapRow(inSheet)}
            onStatus={setStatus}
          />
        </section>
      )}

      {plan.missed.length > 0 && (
        <section>
          <Heading>Not marked yet</Heading>
          <Timeline
            trip={trip}
            entries={plan.missed}
            muted
            selectedId={inSheet ? selectedId : null}
            onTap={tapRow(inSheet)}
            onStatus={setStatus}
          />
        </section>
      )}

      {plan.done.length > 0 && (
        <DoneFold count={plan.done.length}>
          <Timeline
            trip={trip}
            entries={plan.done}
            muted
            selectedId={inSheet ? selectedId : null}
            onTap={tapRow(inSheet)}
            onStatus={setStatus}
          />
        </DoneFold>
      )}
    </>
  )

  return (
    <div className="min-h-dvh">
      <Header
        trip={trip}
        navigate={navigate}
        routeUrl={routeUrl}
        zoneClock={zoneClock}
        map={mappable(day).length > 0 ? showMap : null}
        onToggleMap={() => {
          setShowMap(!showMap)
          writeMapPref(!showMap)
        }}
      />

      <div
        className="sticky top-14 z-30 border-b border-slate-200/60 bg-slate-50/80 backdrop-blur dark:border-slate-800/60 dark:bg-slate-950/80"
        style={{ viewTransitionName: vtName('tripmode', trip.id) }}
        data-vt-shared
      >
        <div className="mx-auto flex h-12 max-w-2xl items-center gap-1 px-3">
          <button
            className={`${iconBtn} disabled:opacity-30`}
            onClick={() => pickDay(dayIndex - 1)}
            disabled={dayIndex === 0}
            aria-label="The day before"
          >
            <IconChevronLeft className="size-4.5" />
          </button>
          <div className="flex min-w-0 flex-1 items-center justify-center gap-2">
            <span className="truncate text-sm font-bold">Day {dayIndex + 1}</span>
            {day.date && (
              <span className="truncate text-sm text-slate-500 dark:text-slate-400">{fmtDate(day.date)}</span>
            )}
            {isToday && (
              <span className="shrink-0 rounded-full bg-accent px-2 py-0.5 text-[11px] font-bold text-brand">
                Today
              </span>
            )}
            <WeatherChip day={weather?.[day.date]} />
          </div>
          {dayIndex !== clockIndex && (
            <button className={btnChip} onClick={() => pickDay(null)} title="Back to the day the trip is on">
              Now
            </button>
          )}
          <button
            className={`${iconBtn} disabled:opacity-30`}
            onClick={() => pickDay(dayIndex + 1)}
            disabled={dayIndex === days.length - 1}
            aria-label="The day after"
          >
            <IconChevronRight className="size-4.5" />
          </button>
        </div>
        {/* how much of the day is done, along the bar's bottom edge */}
        {plan.openCount > 0 && (
          <div
            className="absolute inset-x-0 -bottom-px h-[3px]"
            role="progressbar"
            aria-label={`${plan.doneCount} of ${plan.openCount} done`}
            aria-valuenow={Math.round(progress)}
          >
            <div
              className="h-full rounded-r-full bg-emerald-500 transition-[width] duration-700"
              style={{ width: `${progress}%` }}
            />
          </div>
        )}
      </div>

      <main
        className="mx-auto max-w-2xl space-y-5 px-4 pb-[max(7rem,env(safe-area-inset-bottom))] pt-3"
        style={{ viewTransitionName: 'today-day' }}
        data-vt-shared
        {...swipeHandlers}
      >
        {/* the day in a line: its name, the weather now and soon, how far along */}
        <div className="space-y-0.5 px-1 text-[13px]">
          <div className="flex items-center gap-2">
            <span className="min-w-0 flex-1 truncate font-medium text-slate-500 dark:text-slate-400">{day.title}</span>
            {plan.openCount > 0 && (
              <span className="shrink-0 font-semibold tabular-nums text-slate-500 dark:text-slate-400">
                <span key={plan.doneCount} className="anim-tick inline-block">
                  {plan.doneCount}
                </span>{' '}
                of {plan.openCount} done{cost > 0 && <> · {fmtMoney(cost, trip.currency)}</>}
              </span>
            )}
          </div>
          {nowWx && (
            <p className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
              <span aria-hidden="true" className={`inline-block ${nowWx.motion}`}>
                {nowWx.emoji}
              </span>
              <span className="font-semibold text-slate-600 dark:text-slate-300">{weatherNow.temp}° now</span>
              {rain && <span className="text-sky-600 dark:text-sky-400">· 🌧 {rain}</span>}
            </p>
          )}
        </div>

        {/* one map at a time: in map mode this one steps aside */}
        {showMap && !mapMode && mappable(day).length > 0 && (
          // panning the map is not a swipe to another day
          <div onTouchStart={e => e.stopPropagation()} onTouchEnd={e => e.stopPropagation()}>
            <DayMapPanel
              trip={trip}
              days={[day]}
              runningId={runningId}
              onStatus={setStatus}
              onEdit={item => setItemModal({ dayId: day.id, item })}
              onExpand={() => {
                setSelectedId(null)
                setMapMode(true)
              }}
              className="h-60"
            />
          </div>
        )}

        {dayList(false)}
      </main>

      {/* one + to add to this day */}
      <button
        onClick={() => setItemModal({ dayId: day.id })}
        className="fixed bottom-[max(1.25rem,env(safe-area-inset-bottom))] right-[max(1rem,calc((100vw-42rem)/2+1rem))] z-30 grid size-14 place-items-center rounded-full bg-brand text-white shadow-lg shadow-brand/30 transition hover:bg-brand-600 active:scale-95 dark:bg-brand-600 dark:hover:bg-brand-500"
        aria-label={`Add a plan to day ${dayIndex + 1}`}
        title={`Add to day ${dayIndex + 1}`}
      >
        <IconPlus className="size-6" />
      </button>

      {mapMode && (
        <MapMode
          title={[`Day ${dayIndex + 1}`, day.date && fmtDate(day.date), day.title].filter(Boolean).join(' · ')}
          onClose={() => setMapMode(false)}
          map={offset => (
            <DayMapPanel
              trip={trip}
              days={[day]}
              runningId={runningId}
              onStatus={setStatus}
              onEdit={item => setItemModal({ dayId: day.id, item })}
              bare
              selectedId={selectedId}
              onSelect={setSelectedId}
              onExpand={() => setMapMode(false)}
              focusOffset={offset}
            />
          )}
        >
          {({ raise }) => (
            <SheetSync selectedId={selectedId} onShow={raise}>
              {dayList(true)}
            </SheetSync>
          )}
        </MapMode>
      )}

      {itemModal && (
        <ItemForm
          initial={itemModal.item}
          dayLabel={`day ${dayIndex + 1}`}
          trip={trip}
          days={days}
          dayId={day.id}
          onSave={saveItem}
          onDelete={deleteItem}
          onClose={() => setItemModal(null)}
        />
      )}
    </div>
  )
}

// Keeps the sheet's picked row in view, raising a lowered sheet to show it.
function SheetSync({ selectedId, onShow, children }) {
  useEffect(() => {
    if (!selectedId) return
    onShow()
    const t = setTimeout(
      () =>
        document
          .querySelector(`[data-sheet] [data-plan="${selectedId}"]`)
          ?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }),
      320,
    )
    return () => clearTimeout(t)
    // onShow changes with the sheet's height; following the pick is enough
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId])
  return children
}

// Trip mode remembers whether the map was shown.
const MAP_PREF = 'triplanner:today-map'
function readMapPref() {
  try {
    return localStorage.getItem(MAP_PREF) !== 'off'
  } catch {
    return true
  }
}
function writeMapPref(on) {
  try {
    localStorage.setItem(MAP_PREF, on ? 'on' : 'off')
  } catch {
    // storage unavailable — the choice lasts for this visit
  }
}

// map: whether the day map shows, or null when the day has nothing to map
function Header({ trip, navigate, routeUrl, zoneClock, map = null, onToggleMap }) {
  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/60 bg-slate-50/80 backdrop-blur dark:border-slate-800/60 dark:bg-slate-950/80">
      <div className="mx-auto flex h-14 max-w-2xl items-center gap-1 px-4">
        <button className={iconBtn} onClick={() => navigate(`/trip/${trip.id}`)} aria-label="Back to the trip">
          <IconArrowLeft />
        </button>
        <div className="min-w-0 flex-1 px-1">
          <p className="truncate text-[11px] font-bold uppercase tracking-wide text-brand-600 dark:text-brand-300">
            Trip mode
            {zoneClock && (
              <span className="font-semibold normal-case tracking-normal text-slate-500 dark:text-slate-400">
                {' '}
                · {zoneClock} local time
              </span>
            )}
          </p>
          <h1 className="truncate text-sm font-semibold leading-tight">{trip.name}</h1>
        </div>
        {map != null && (
          <button
            className={`${iconBtn} ${map ? 'text-brand-600 dark:text-brand-300' : ''}`}
            onClick={onToggleMap}
            aria-label={map ? 'Hide the map' : 'Show the map'}
            aria-pressed={map}
            title={map ? 'Hide the map' : 'Show the map'}
          >
            <IconMap className="size-4.5" />
          </button>
        )}
        {routeUrl && (
          <a
            className={iconBtn}
            href={routeUrl}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="The whole day in Google Maps"
            title="The whole day in Google Maps"
          >
            <IconRoute className="size-4.5" />
          </a>
        )}
      </div>
    </header>
  )
}
