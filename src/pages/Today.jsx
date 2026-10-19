import { useEffect, useMemo, useRef, useState } from 'react'
import AirlineLogo from '../components/AirlineLogo'
import { DocumentChips } from '../components/Documents'
import ItemForm from '../components/ItemForm'
import MapLinks from '../components/MapLinks'
import WeatherChip from '../components/WeatherChip'
import {
  btnChip,
  btnChipBrand,
  btnPrimary,
  IconAlert,
  IconArrowLeft,
  IconCheckCircle,
  IconChevronLeft,
  IconChevronRight,
  IconCircle,
  IconHourglass,
  IconNavigation,
  IconPencil,
  IconPlus,
  IconRadar,
  IconRoute,
  IconXCircle,
  iconBtn,
  PopIcon,
  Strike,
  useToast,
} from '../components/ui'
import { airlineFromFlightNo, flightTrackerUrl } from '../lib/airlines'
import { catById, flightRoute, titleFor } from '../lib/categories'
import { deviceTimeZone, fmtDate } from '../lib/dates'
import { dayRouteUrl, pairRouteUrl } from '../lib/maps'
import { costCurrency, dayCost, fmtMoney } from '../lib/money'
import { reducedMotion, transition, vtName } from '../lib/motion'
import { dayPlan, fmtClock, fmtDuration, fmtTimes, gapBetween, useClock } from '../lib/schedule'
import { uid, useStore } from '../lib/store'
import { useWeather } from '../lib/weather'

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
      <span className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-md bg-rose-100 px-1.5 py-0.5 text-[11px] font-bold text-rose-700 dark:bg-rose-400/10 dark:text-rose-300">
        <IconAlert className="size-3" />
        {gap.minutes === 0 ? 'same time' : `overlaps ${fmtDuration(gap.minutes)}`}
      </span>
    )
  }
  if (gap.minutes === 0) return null
  return (
    <span className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap text-[11px] font-semibold text-slate-400 dark:text-slate-500">
      <IconHourglass className="size-3" />
      {fmtDuration(gap.minutes)} {gap.kind === 'free' ? 'free' : 'later'}
    </span>
  )
}

function Chip({ item, className = 'size-11 rounded-xl text-xl' }) {
  const cat = catById(item.type)
  const airline = item.type === 'flight' ? airlineFromFlightNo(item.flightNo) : null
  const emoji = <span className={`grid shrink-0 place-items-center ${className} ${cat.badge}`}>{cat.emoji}</span>
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

function HeroCard({ trip, entry, label, running, now, onEdit, onStatus }) {
  const { item } = entry
  const cat = catById(item.type)
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
            {countdown && <span className="font-medium text-slate-500 dark:text-slate-400"> · {countdown}</span>}
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
          <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
            <span className={`rounded-md px-1.5 py-0.5 font-medium ${cat.badge}`}>{cat.label}</span>
            {item.type === 'flight' && item.title && flightRoute(item) && <span>{flightRoute(item)}</span>}
            {Number.isFinite(item.cost) && (
              <span className="font-semibold tabular-nums text-slate-600 dark:text-slate-300">
                {fmtMoney(item.cost, costCurrency(trip, item))}
              </span>
            )}
          </div>
          {item.notes && (
            <p className="mt-2 whitespace-pre-wrap text-sm text-slate-600 dark:text-slate-300">{item.notes}</p>
          )}
          <DocumentChips docs={item.attachments} className="mt-2.5" />
        </div>
      </div>

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

/* ---------- compact rows for the rest of the day ---------- */

function PlanRow({ trip, entry, clash, muted, onEdit, onStatus }) {
  const { item } = entry
  const skipped = item.status === 'skipped'
  const done = item.status === 'done'
  const StatusIcon = done ? IconCheckCircle : skipped ? IconXCircle : IconCircle

  return (
    <li
      className="flex items-center gap-2.5 rounded-xl bg-white p-2.5 shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800"
      style={planName(item)}
    >
      <button
        onClick={onEdit}
        className={`flex min-w-0 flex-1 items-center gap-2.5 text-left ${muted ? 'opacity-55' : ''}`}
      >
        <span className="w-11 shrink-0 text-center text-xs font-bold tabular-nums text-slate-500 dark:text-slate-400">
          {entry.start == null ? '—' : fmtClock(entry.start)}
          {entry.end != null && (
            <span className="block text-[10px] font-semibold text-slate-400 dark:text-slate-500">
              {fmtClock(entry.end)}
            </span>
          )}
        </span>
        <Chip item={item} className="size-8 rounded-lg text-sm" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">
            <Strike on={skipped}>{titleFor(item)}</Strike>
          </span>
          <span className="flex flex-wrap items-center gap-x-1.5 text-[11px] text-slate-500 dark:text-slate-400">
            <span>{catById(item.type).label}</span>
            {Number.isFinite(item.cost) && <span>{fmtMoney(item.cost, costCurrency(trip, item))}</span>}
            {item.attachments?.length > 0 && <span>📎 {item.attachments.length}</span>}
            {clash && (
              <span className="inline-flex items-center gap-0.5 font-bold text-rose-600 dark:text-rose-400">
                <IconAlert className="size-3" />
                {clash.minutes === 0 ? 'same time' : 'overlaps'}
              </span>
            )}
          </span>
        </span>
      </button>
      <button
        onClick={onStatus}
        className={`shrink-0 rounded-full p-1 transition ${
          done
            ? 'text-emerald-500 hover:text-emerald-600'
            : skipped
              ? 'text-slate-400 hover:text-slate-500'
              : 'text-slate-300 hover:text-slate-400 dark:text-slate-600 dark:hover:text-slate-500'
        }`}
        aria-label={`Change the result of ${titleFor(item)}`}
      >
        <PopIcon icon={StatusIcon} state={item.status} className="size-5.5" />
      </button>
    </li>
  )
}

function Section({ title, count, children }) {
  return (
    <section>
      <h3 className="mb-2 px-1 text-[13px] font-bold uppercase tracking-wide text-slate-400 dark:text-slate-500">
        {title}
        {count != null && <span className="ml-1.5 font-semibold normal-case tracking-normal">({count})</span>}
      </h3>
      <ul className="space-y-2">{children}</ul>
    </section>
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

  const [pickedIndex, setPickedIndex] = useState(null) // null follows the clock
  const [itemModal, setItemModal] = useState(null) // { dayId, item? }
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

  // What the view shows in order, so a clash is marked where it is seen.
  const sequence = [plan.hero, plan.then, ...plan.later].filter(Boolean)
  const clashing = new Map()
  sequence.forEach((entry, i) => {
    const gap = gapBetween(sequence[i - 1], entry)
    if (gap?.kind === 'clash') clashing.set(entry, gap)
  })

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

  const rowProps = entry => ({
    trip,
    entry,
    onEdit: () => setItemModal({ dayId: day.id, item: entry.item }),
    onStatus: () => setStatus(entry.item, STATUS_NEXT[entry.item.status]),
  })

  return (
    <div className="min-h-dvh">
      <Header trip={trip} navigate={navigate} routeUrl={routeUrl} zoneClock={zoneClock} />

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
      </div>

      <main
        className="mx-auto max-w-2xl space-y-5 px-4 pb-[max(6rem,env(safe-area-inset-bottom))] pt-4"
        style={{ viewTransitionName: 'today-day' }}
        data-vt-shared
        {...swipeHandlers}
      >
        {day.title && <p className="px-1 text-sm font-medium text-slate-500 dark:text-slate-400">{day.title}</p>}

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

        {plan.then && (
          <Section title={plan.hero && plan.later.length > 0 ? 'Then' : 'Also today'}>
            <PlanRow {...rowProps(plan.then)} clash={clashing.get(plan.then)} />
          </Section>
        )}

        {plan.later.length > 0 && (
          <Section title="Later" count={plan.later.length}>
            {plan.later.map(entry => (
              <PlanRow key={entry.item.id} {...rowProps(entry)} clash={clashing.get(entry)} />
            ))}
          </Section>
        )}

        {plan.missed.length > 0 && (
          <Section title="Not marked yet" count={plan.missed.length}>
            {plan.missed.map(entry => (
              <PlanRow key={entry.item.id} {...rowProps(entry)} muted />
            ))}
          </Section>
        )}

        {plan.done.length > 0 && (
          <Section title="Done and skipped" count={plan.done.length}>
            {plan.done.map(entry => (
              <PlanRow key={entry.item.id} {...rowProps(entry)} muted />
            ))}
          </Section>
        )}

        {plan.total > 0 && (
          <div className="space-y-2.5 rounded-2xl bg-white px-4 py-3 text-xs font-medium text-slate-500 shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:text-slate-400 dark:ring-slate-800">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <span className="tabular-nums">
                <span key={plan.doneCount} className="anim-tick inline-block">
                  {plan.doneCount}
                </span>{' '}
                of {plan.openCount} done
              </span>
              {cost > 0 && <span className="tabular-nums">{fmtMoney(cost, trip.currency)}</span>}
              <span className="flex-1" />
              <button className={btnChip} onClick={() => setItemModal({ dayId: day.id })}>
                <IconPlus className="size-3.5" />
                Add
              </button>
              <button className={btnChip} onClick={() => navigate(`/trip/${trip.id}`)}>
                Full day list
              </button>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
              <div
                className="bar-fill h-full rounded-full bg-emerald-500"
                style={{ '--fill': `${plan.openCount ? (plan.doneCount / plan.openCount) * 100 : 0}%` }}
              />
            </div>
          </div>
        )}
      </main>

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

function Header({ trip, navigate, routeUrl, zoneClock }) {
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
