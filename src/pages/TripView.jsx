import {
  closestCorners,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import { restrictToVerticalAxis } from '@dnd-kit/modifiers'
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable'
import { useEffect, useRef, useState } from 'react'
import AirlineLogo from '../components/AirlineLogo'
import DayCard from '../components/DayCard'
import DayForm from '../components/DayForm'
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
  IconDownload,
  IconMapPin,
  IconNavigation,
  IconPencil,
  IconPlaneLanding,
  IconPlaneTakeoff,
  IconPlus,
  IconShare,
  IconTrash,
  Menu,
  iconBtn,
  useToast,
} from '../components/ui'
import { airlineFromFlightNo } from '../lib/airlines'
import { addDaysISO, fmtDate, fmtRange, todayISO } from '../lib/dates'
import { tripToICS } from '../lib/ics'
import { downloadFile, downloadJSON, exportPayload, slug } from '../lib/io'
import { fmtMoney, tripCost } from '../lib/money'
import { makeDay, uid, useStore } from '../lib/store'
import { computeStays } from '../lib/stays'

// First arrival flight and last departure flight of the trip, for the banner.
function flightEndpoints(trip) {
  let arrival = null
  let departure = null
  for (const day of trip.days) {
    for (const item of day.items) {
      if (item.type !== 'flight') continue
      if (item.direction === 'departure') departure = { item, day }
      else if (!arrival) arrival = { item, day }
    }
  }
  return { arrival, departure }
}

function FlightRow({ icon: Icon, label, item, day }) {
  const airline = airlineFromFlightNo(item.flightNo)
  const sub = [airline?.name, fmtDate(day.date), item.time, item.location].filter(Boolean).join(' · ')
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
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold">
          {label}
          {item.flightNo && <span className="font-medium text-slate-500 dark:text-slate-400"> · {item.flightNo}</span>}
        </p>
        {sub && <p className="truncate text-xs text-slate-500 dark:text-slate-400">{sub}</p>}
      </div>
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
  const [activeItem, setActiveItem] = useState(null) // item being dragged (for the overlay)
  const dragSnapshot = useRef(null) // days before the drag, restored on cancel

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  useEffect(() => {
    if (!trip) navigate('')
  }, [trip, navigate])

  // On opening a trip that spans today, smoothly scroll to the current day.
  useEffect(() => {
    const days = trip?.days ?? []
    const today = todayISO()
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
    const date = last?.date ? addDaysISO(last.date, 1) : trip.startDate || todayISO()
    dispatch({ type: 'day/add', tripId: trip.id, day: makeDay(date) })
  }

  function deleteTrip() {
    if (!window.confirm(`Delete the trip “${trip.name}”?`)) return
    const index = state.trips.findIndex(t => t.id === trip.id)
    dispatch({ type: 'trip/delete', id: trip.id })
    toast('Trip deleted', {
      label: 'Undo',
      onClick: () => dispatch({ type: 'trip/restore', trip, index }),
    })
  }

  function exportTrip() {
    downloadJSON(`${slug(trip.name)}.json`, exportPayload([trip]))
    toast('Trip exported')
  }

  function exportCalendar() {
    downloadFile(`${slug(trip.name)}.ics`, tripToICS(trip), 'text/calendar')
    toast('Calendar file exported')
  }

  function saveItem(data) {
    if (itemModal.item) {
      dispatch({ type: 'item/update', tripId: trip.id, dayId: itemModal.dayId, itemId: itemModal.item.id, patch: data })
    } else {
      dispatch({ type: 'item/add', tripId: trip.id, dayId: itemModal.dayId, item: { id: uid(), ...data } })
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
  const { arrival, departure } = flightEndpoints(trip)
  const totalCost = tripCost(trip)
  const today = todayISO()
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
    dispatch({ type: 'item/transfer', tripId: trip.id, fromDayId: fromDay.id, toDayId: toDay.id, itemId: active.id, toIndex })
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
          <button className={iconBtn} onClick={() => setSharing(true)} aria-label="Share trip">
            <IconShare className="size-4.5" />
          </button>
          <button className={iconBtn} onClick={() => setEditTrip(true)} aria-label="Edit trip">
            <IconPencil className="size-4.5" />
          </button>
          <Menu
            label="More trip actions"
            items={[
              { label: 'Add to calendar (.ics)', icon: IconCalendarPlus, onClick: exportCalendar },
              { label: 'Export as JSON', icon: IconDownload, onClick: exportTrip },
              { label: 'Delete trip', icon: IconTrash, onClick: deleteTrip, danger: true },
            ]}
          />
        </div>
      </header>

      <main className="mx-auto max-w-2xl space-y-8 px-4 pb-[max(6rem,env(safe-area-inset-bottom))] pt-5">
        <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800">
          <div className="p-5">
            <h2 className="text-2xl font-bold tracking-tight">{trip.name}</h2>
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
          {(arrival || departure) && (
            <div className="divide-y divide-slate-100 border-t border-slate-100 dark:divide-slate-800 dark:border-slate-800">
              {arrival && <FlightRow icon={IconPlaneLanding} label="Arrival" item={arrival.item} day={arrival.day} />}
              {departure && (
                <FlightRow icon={IconPlaneTakeoff} label="Departure" item={departure.item} day={departure.day} />
              )}
            </div>
          )}
          {todayIndex >= 0 && (
            <button
              onClick={() => navigate(`/trip/${trip.id}/today`)}
              className="flex w-full items-center gap-3 border-t border-slate-100 px-5 py-3 text-left transition hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/40"
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
              isPast={Boolean(day.date) && day.date < today}
              isToday={day.date === today}
              onEditDay={() => setDayModal({ day, index: i })}
              onAddItem={() => setItemModal({ dayId: day.id })}
              onEditItem={item => setItemModal({ dayId: day.id, item })}
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
          onSave={saveItem}
          onDelete={deleteItem}
          onClose={() => setItemModal(null)}
        />
      )}
      {sharing && <ShareModal trip={trip} onClose={() => setSharing(false)} />}
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
      {editTrip && (
        <TripForm
          initial={trip}
          onSave={patch => {
            dispatch({ type: 'trip/update', id: trip.id, patch })
            setEditTrip(false)
          }}
          onClose={() => setEditTrip(false)}
        />
      )}
    </div>
  )
}
