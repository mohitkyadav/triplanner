import {
  closestCorners,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import { restrictToVerticalAxis } from '@dnd-kit/modifiers'
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable'
import { useEffect, useRef, useState } from 'react'
import AirlineLogo from '../components/AirlineLogo'
import BookingImport from '../components/BookingImport'
import BudgetCard from '../components/Budget'
import DayCard from '../components/DayCard'
import DayForm from '../components/DayForm'
import InviteModal from '../components/InviteModal'
import { ItemCardOverlay } from '../components/ItemCard'
import ItemForm from '../components/ItemForm'
import PackingList from '../components/PackingList'
import ShareModal from '../components/ShareModal'
import TripForm from '../components/TripForm'
import {
  IconArrowLeft,
  IconCalendar,
  IconCalendarPlus,
  IconChevronRight,
  IconCopy,
  IconDownload,
  IconMapPin,
  IconNavigation,
  IconPencil,
  IconPlaneLanding,
  IconPlaneTakeoff,
  IconRadar,
  IconPlus,
  IconShare,
  IconTicket,
  IconTrash,
  IconUsers,
  Menu,
  iconBtn,
  useToast,
} from '../components/ui'
import { airlineFromFlightNo, flightTrackerUrl } from '../lib/airlines'
import { flightRoute } from '../lib/categories'
import { addDaysISO, fmtDate, fmtRange, todayISO } from '../lib/dates'
import { tripToICS } from '../lib/ics'
import { takePendingBooking } from '../lib/inbox'
import { cloneTrip, downloadFile, downloadJSON, exportPayload, slug } from '../lib/io'
import { fmtMoney, tripCost } from '../lib/money'
import { rescheduleDays } from '../lib/reschedule'
import { fmtTimes } from '../lib/schedule'
import { leaveTrip } from '../lib/shares'
import { makeDay, placeByTime, sortDays, uid, useStore } from '../lib/store'
import { syncEnabled } from '../lib/sync'
import { computeStays } from '../lib/stays'
import { useWeather } from '../lib/weather'
import { vtName } from '../lib/motion'

// The first and the last flight of the trip, for the banner.
function flightEndpoints(trip) {
  const flights = trip.days.flatMap(day => day.items.filter(i => i.type === 'flight').map(item => ({ item, day })))
  return { outbound: flights[0] ?? null, back: flights.length > 1 ? flights[flights.length - 1] : null }
}

function FlightRow({ icon: Icon, label, item, day }) {
  const airline = airlineFromFlightNo(item.flightNo)
  const tracker = flightTrackerUrl(item.flightNo)
  const sub = [airline?.name, fmtDate(day.date), fmtTimes(item), flightRoute(item)].filter(Boolean).join(' · ')
  const planeChip = (
    <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-300">
      <Icon className="size-4.5" />
    </span>
  )
  return (
    <div className="flex items-center gap-3 px-5 py-3">
      {airline ? (
        <AirlineLogo iata={airline.iata} name={airline.name} className="size-9 rounded-lg" fallback={planeChip} />
      ) : (
        planeChip
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">
          {label}
          {item.flightNo && <span className="font-medium text-slate-500 dark:text-slate-400"> · {item.flightNo}</span>}
        </p>
        {sub && <p className="truncate text-xs text-slate-500 dark:text-slate-400">{sub}</p>}
      </div>
      {tracker && (
        <a
          className={iconBtn}
          href={tracker}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Track flight ${item.flightNo}`}
          title="Live flight status"
        >
          <IconRadar className="size-4.5" />
        </a>
      )}
    </div>
  )
}

export default function TripView({ id, navigate }) {
  const { state, dispatch } = useStore()
  const toast = useToast()
  const trip = state.trips.find(t => t.id === id)

  const [itemModal, setItemModal] = useState(null) // { dayId, item? }
  const [dayModal, setDayModal] = useState(null) // { day, index }
  const [editTrip, setEditTrip] = useState(false)
  const [sharing, setSharing] = useState(false)
  const [inviting, setInviting] = useState(false)
  const [booking, setBooking] = useState(null) // contents of a chosen .ics file
  const [activeItem, setActiveItem] = useState(null) // item being dragged (for the overlay)
  // Plans that show up after the page did — added, imported, brought back
  // by Undo — flash where they land. Not while dragging: a card moving
  // between days shows up there too.
  const arrivals = useRef(false)
  useEffect(() => {
    arrivals.current = !activeItem
  }, [activeItem])
  const dragSnapshot = useRef(null) // days before the drag, restored on cancel
  const icsRef = useRef(null)

  const weather = useWeather(trip)

  const sensors = useSensors(
    // a mouse drags by the grip; a finger by pressing on the card a moment,
    // so scrolling past it still scrolls
    useSensor(MouseSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 280, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  useEffect(() => {
    if (!trip) navigate('')
  }, [trip, navigate])

  // A booking shared to the app (Inbox) waits for this trip to open.
  useEffect(() => {
    const text = takePendingBooking(id)
    if (text) setBooking(text)
  }, [id])

  // On opening a trip that spans today, smoothly scroll to the current day.
  useEffect(() => {
    const days = trip?.days ?? []
    const today = todayISO(trip?.timeZone)
    const idx = days.findIndex(d => d.date && d.date >= today)
    if (idx <= 0) return
    const t = setTimeout(() => {
      document.getElementById(`day-${days[idx].id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 150)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once per opened trip
  }, [id])

  if (!trip) return null

  const stops = trip.days.reduce((n, d) => n + d.items.length, 0)

  function addDay() {
    const last = trip.days[trip.days.length - 1]
    const date = last?.date ? addDaysISO(last.date, 1) : trip.startDate || todayISO(trip.timeZone)
    dispatch({ type: 'day/add', tripId: trip.id, day: makeDay(date) })
  }

  // A trip shared with you is not yours to delete: you can stop seeing it.
  async function leave() {
    const owner = trip.sharedFrom.ownerEmail || 'its owner'
    if (!window.confirm(`Remove “${trip.name}” from your trips? You will stop seeing it; ${owner} keeps it.`)) return
    try {
      await leaveTrip(trip)
    } catch (err) {
      toast(err.message)
      return
    }
    dispatch({ type: 'trip/delete', id: trip.id })
    navigate('')
    toast('Removed from your trips')
  }

  function deleteTrip() {
    if (trip.sharedFrom) return leave()
    if (!window.confirm(`Delete the trip “${trip.name}”?`)) return
    const index = state.trips.findIndex(t => t.id === trip.id)
    dispatch({ type: 'trip/delete', id: trip.id })
    toast('Trip deleted', {
      label: 'Undo',
      onClick: () => dispatch({ type: 'trip/restore', trip, index }),
    })
  }

  function duplicateTrip() {
    const copy = cloneTrip(trip, { name: `${trip.name} (copy)` })
    dispatch({ type: 'trip/create', trip: copy })
    toast(`Duplicated as “${copy.name}”`)
    navigate(`/trip/${copy.id}`)
  }

  /* Saves the trip form. New dates bring the days along (see
     rescheduleDays); one Undo puts the trip back as it was. */
  function saveTrip(patch, { mode }) {
    const before = trip
    const datesChanged = patch.startDate !== trip.startDate || patch.endDate !== trip.endDate
    const { days, outside } = datesChanged ? rescheduleDays(trip, patch, mode) : { days: trip.days, outside: 0 }
    dispatch({ type: 'trip/update', id: trip.id, patch: { ...patch, days } })
    setEditTrip(false)
    if (datesChanged) {
      const undo = { label: 'Undo', onClick: () => dispatch({ type: 'trip/update', id: trip.id, patch: before }) }
      toast(
        outside > 0
          ? `${outside} day${outside === 1 ? '' : 's'} with plans fall outside the dates — kept`
          : 'Dates updated',
        undo,
      )
    }
  }

  function exportTrip() {
    downloadJSON(`${slug(trip.name)}.json`, exportPayload([trip]))
    toast('Trip exported')
  }

  function exportCalendar() {
    downloadFile(`${slug(trip.name)}.ics`, tripToICS(trip), 'text/calendar')
    toast('Calendar file exported')
  }

  async function readBookingFile(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    try {
      setBooking(await file.text())
    } catch {
      toast('That file could not be read')
    }
  }

  /* Adds the plans the user ticked in the preview. A booking can fall on a day
     the trip does not hold yet, so the day is created and the trip dates grow
     to cover it. One Undo puts everything back. */
  function addBooking(rows) {
    const before = { days: trip.days, startDate: trip.startDate, endDate: trip.endDate }
    let days = trip.days
    for (const row of rows) {
      let day = days.find(d => d.date === row.date)
      if (!day) {
        day = makeDay(row.date)
        days = sortDays([...days, day])
      }
      days = days.map(d => (d.id === day.id ? { ...d, items: placeByTime(d.items, { id: uid(), ...row.item }) } : d))
    }
    const dates = rows.map(r => r.date).filter(Boolean)
    const span = [trip.startDate, trip.endDate, ...dates].filter(Boolean).sort()

    dispatch({
      type: 'trip/update',
      id: trip.id,
      patch: { days, startDate: span[0] ?? '', endDate: span[span.length - 1] ?? '' },
    })
    setBooking(null)
    toast(`Added ${rows.length} plan${rows.length === 1 ? '' : 's'}`, {
      label: 'Undo',
      onClick: () => dispatch({ type: 'trip/update', id: trip.id, patch: before }),
    })
  }

  function saveItem(data, toDayId) {
    const { dayId, item } = itemModal
    if (item) {
      dispatch({ type: 'item/update', tripId: trip.id, dayId, toDayId, itemId: item.id, patch: data })
    } else {
      dispatch({ type: 'item/add', tripId: trip.id, dayId: toDayId ?? dayId, item: { id: uid(), ...data } })
    }
    setItemModal(null)
  }

  function deleteItem() {
    const { dayId, item } = itemModal
    const index = trip.days.find(d => d.id === dayId)?.items.findIndex(i => i.id === item.id)
    dispatch({ type: 'item/delete', tripId: trip.id, dayId, itemId: item.id })
    setItemModal(null)
    toast('Plan deleted', {
      label: 'Undo',
      onClick: () => dispatch({ type: 'item/add', tripId: trip.id, dayId, item, index }),
    })
  }

  const modalDayIndex = itemModal ? trip.days.findIndex(d => d.id === itemModal.dayId) : -1
  const staysByDay = computeStays(trip)
  const { outbound, back } = flightEndpoints(trip)
  const totalCost = tripCost(trip)
  const today = todayISO(trip.timeZone)
  const todayIndex = trip.days.findIndex(d => d.date === today)

  const dayOfItem = itemId => trip.days.find(d => d.items.some(i => i.id === itemId))
  const dayById = dayId => trip.days.find(d => d.id === dayId)

  function handleDragStart({ active }) {
    dragSnapshot.current = trip.days
    setActiveItem(dayOfItem(active.id)?.items.find(i => i.id === active.id) ?? null)
  }

  // Move the item between days while dragging so the list previews the drop.
  function handleDragOver({ active, over }) {
    if (!over || active.id === over.id) return
    const fromDay = dayOfItem(active.id)
    const toDay = dayOfItem(over.id) ?? dayById(over.id)
    if (!fromDay || !toDay || fromDay.id === toDay.id) return
    const overIndex = toDay.items.findIndex(i => i.id === over.id)
    const activeTop = active.rect.current.translated?.top ?? 0
    const isBelow = overIndex >= 0 && activeTop > over.rect.top + over.rect.height / 2
    const toIndex = overIndex >= 0 ? overIndex + (isBelow ? 1 : 0) : toDay.items.length
    dispatch({
      type: 'item/transfer',
      tripId: trip.id,
      fromDayId: fromDay.id,
      toDayId: toDay.id,
      itemId: active.id,
      toIndex,
    })
  }

  function handleDragEnd({ active, over }) {
    setActiveItem(null)
    dragSnapshot.current = null
    if (!over) return
    const day = dayOfItem(active.id)
    const toDay = dayOfItem(over.id) ?? dayById(over.id)
    if (!day || !toDay || day.id !== toDay.id) return
    const from = day.items.findIndex(i => i.id === active.id)
    const to = day.items.findIndex(i => i.id === over.id)
    if (from !== -1 && to !== -1 && from !== to) {
      dispatch({ type: 'item/move', tripId: trip.id, dayId: day.id, from, to })
    }
  }

  function handleDragCancel() {
    if (dragSnapshot.current) {
      dispatch({ type: 'trip/setDays', tripId: trip.id, days: dragSnapshot.current })
      dragSnapshot.current = null
    }
    setActiveItem(null)
  }

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-40 border-b border-slate-200/60 bg-slate-50/80 backdrop-blur dark:border-slate-800/60 dark:bg-slate-950/80">
        <div className="mx-auto flex h-14 max-w-2xl items-center gap-1 px-4">
          <button className={iconBtn} onClick={() => navigate('')} aria-label="Back to trips">
            <IconArrowLeft />
          </button>
          <h1 className="min-w-0 flex-1 truncate px-1 font-semibold">{trip.name}</h1>
          <button
            className={iconBtn}
            onClick={() => navigate(`/trip/${trip.id}/today`)}
            aria-label="Trip mode"
            title="Trip mode — now and next"
          >
            <IconNavigation className="size-4.5" />
          </button>
          {syncEnabled && !trip.sharedFrom && (
            <button
              className={iconBtn}
              onClick={() => setInviting(true)}
              aria-label="Invite people"
              title="Invite people"
            >
              <IconUsers className="size-4.5" />
            </button>
          )}
          <button className={iconBtn} onClick={() => setSharing(true)} aria-label="Share trip">
            <IconShare className="size-4.5" />
          </button>
          <button className={iconBtn} onClick={() => setEditTrip(true)} aria-label="Edit trip">
            <IconPencil className="size-4.5" />
          </button>
          <Menu
            label="More trip actions"
            items={[
              { label: 'Import booking (.ics)', icon: IconTicket, onClick: () => icsRef.current?.click() },
              { label: 'Export to calendar (.ics)', icon: IconCalendarPlus, onClick: exportCalendar },
              { label: 'Export as JSON', icon: IconDownload, onClick: exportTrip },
              { label: 'Duplicate trip', icon: IconCopy, onClick: duplicateTrip },
              trip.sharedFrom
                ? { label: 'Remove from my trips', icon: IconTrash, onClick: deleteTrip, danger: true }
                : { label: 'Delete trip', icon: IconTrash, onClick: deleteTrip, danger: true },
            ]}
          />
        </div>
      </header>

      <main className="mx-auto max-w-2xl space-y-8 px-4 pb-[max(6rem,env(safe-area-inset-bottom))] pt-5">
        <div
          className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800"
          style={{ viewTransitionName: vtName('trip', trip.id) }}
          data-vt-shared
        >
          <div className="p-5">
            <h2
              className="w-fit text-2xl font-bold tracking-tight"
              style={{ viewTransitionName: vtName('trip-title', trip.id) }}
              data-vt-shared
            >
              {trip.name}
            </h2>
            {trip.sharedFrom && (
              <p className="mt-1.5 flex items-center gap-1.5 text-sm font-medium text-brand-700 dark:text-brand-300">
                <IconUsers className="size-4 shrink-0" />
                Shared by {trip.sharedFrom.ownerEmail || 'someone'} · you can edit it
              </p>
            )}
            {trip.destination && (
              <p className="mt-1.5 flex items-center gap-1.5 font-medium text-slate-600 dark:text-slate-300">
                <IconMapPin className="size-4 shrink-0 text-brand-600 dark:text-brand-300" />
                {trip.destination}
              </p>
            )}
            <p className="mt-1.5 flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400">
              <IconCalendar className="size-4 shrink-0" />
              {[
                fmtRange(trip.startDate, trip.endDate),
                `${trip.days.length} day${trip.days.length === 1 ? '' : 's'}`,
                `${stops} stop${stops === 1 ? '' : 's'}`,
                totalCost > 0 && fmtMoney(totalCost, trip.currency),
              ]
                .filter(Boolean)
                .join(' · ')}
            </p>
          </div>
          {outbound && (
            <div className="divide-y divide-slate-100 border-t border-slate-100 dark:divide-slate-800 dark:border-slate-800">
              <FlightRow
                icon={IconPlaneTakeoff}
                label={back ? 'Outbound' : 'Flight'}
                item={outbound.item}
                day={outbound.day}
              />
              {back && <FlightRow icon={IconPlaneLanding} label="Return" item={back.item} day={back.day} />}
            </div>
          )}
          {todayIndex >= 0 && (
            <button
              onClick={() => navigate(`/trip/${trip.id}/today`)}
              style={{ viewTransitionName: vtName('tripmode', trip.id) }}
              data-vt-shared
              className="focus-inset flex w-full items-center gap-3 rounded-b-2xl border-t border-slate-100 px-5 py-3 text-left transition hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/40"
            >
              <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-accent/15 text-amber-700 dark:text-amber-400">
                <IconNavigation className="size-4.5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold">Trip mode · day {todayIndex + 1}</span>
                <span className="block text-xs text-slate-500 dark:text-slate-400">
                  What runs now, what comes next, and the free time between
                </span>
              </span>
              <IconChevronRight className="size-4.5 shrink-0 text-slate-400" />
            </button>
          )}
        </div>

        <PackingList trip={trip} />
        <BudgetCard trip={trip} />

        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          modifiers={[restrictToVerticalAxis]}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
          onDragCancel={handleDragCancel}
        >
          {trip.days.map((day, i) => (
            <DayCard
              key={day.id}
              trip={trip}
              day={day}
              index={i}
              stays={staysByDay[day.id]}
              weather={weather?.[day.date]}
              isPast={Boolean(day.date) && day.date < today}
              isToday={day.date === today}
              onEditDay={() => setDayModal({ day, index: i })}
              onAddItem={() => setItemModal({ dayId: day.id })}
              onEditItem={item => setItemModal({ dayId: day.id, item })}
              arrivals={arrivals}
            />
          ))}
          <DragOverlay>{activeItem ? <ItemCardOverlay trip={trip} item={activeItem} /> : null}</DragOverlay>
        </DndContext>

        <button
          onClick={addDay}
          className="flex w-full items-center justify-center gap-1.5 rounded-2xl border-2 border-dashed border-slate-300 px-4 py-4 font-semibold text-slate-500 transition hover:border-brand-400 hover:text-brand-600 dark:border-slate-700 dark:text-slate-400 dark:hover:border-brand-500 dark:hover:text-brand-300"
        >
          <IconPlus className="size-5" />
          Add day {trip.days.length + 1}
        </button>
      </main>

      {itemModal && (
        <ItemForm
          initial={itemModal.item}
          dayLabel={`day ${modalDayIndex + 1}`}
          trip={trip}
          days={trip.days}
          dayId={itemModal.dayId}
          onSave={saveItem}
          onDelete={deleteItem}
          onClose={() => setItemModal(null)}
        />
      )}
      <input ref={icsRef} type="file" accept=".ics,text/calendar" hidden onChange={readBookingFile} />
      {booking != null && (
        <BookingImport trip={trip} text={booking} onImport={addBooking} onClose={() => setBooking(null)} />
      )}
      {sharing && <ShareModal trip={trip} onClose={() => setSharing(false)} />}
      {inviting && <InviteModal trip={trip} onClose={() => setInviting(false)} />}
      {dayModal && (
        <DayForm
          day={dayModal.day}
          index={dayModal.index}
          onSave={patch => {
            dispatch({ type: 'day/update', tripId: trip.id, dayId: dayModal.day.id, patch })
            setDayModal(null)
          }}
          onClose={() => setDayModal(null)}
        />
      )}
      {editTrip && <TripForm initial={trip} onSave={saveTrip} onClose={() => setEditTrip(false)} />}
    </div>
  )
}
