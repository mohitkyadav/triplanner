import { useEffect, useState } from 'react'
import DayCard from '../components/DayCard'
import DayForm from '../components/DayForm'
import ItemForm from '../components/ItemForm'
import TripForm from '../components/TripForm'
import {
  IconArrowLeft,
  IconDownload,
  IconPencil,
  IconPlus,
  IconTrash,
  iconBtn,
  useToast,
} from '../components/ui'
import { addDaysISO, fmtRange, todayISO } from '../lib/dates'
import { downloadJSON, exportPayload, slug } from '../lib/io'
import { makeDay, uid, useStore } from '../lib/store'

export default function TripView({ id, navigate }) {
  const { state, dispatch } = useStore()
  const toast = useToast()
  const trip = state.trips.find(t => t.id === id)

  const [itemModal, setItemModal] = useState(null) // { dayId, item? }
  const [dayModal, setDayModal] = useState(null) // { day, index }
  const [editTrip, setEditTrip] = useState(false)

  useEffect(() => {
    if (!trip) navigate('')
  }, [trip, navigate])

  if (!trip) return null

  const stops = trip.days.reduce((n, d) => n + d.items.length, 0)

  function addDay() {
    const last = trip.days[trip.days.length - 1]
    const date = last?.date ? addDaysISO(last.date, 1) : trip.startDate || todayISO()
    dispatch({ type: 'day/add', tripId: trip.id, day: makeDay(date) })
  }

  function deleteTrip() {
    if (window.confirm(`Delete the trip “${trip.name}”? This cannot be undone.`)) {
      dispatch({ type: 'trip/delete', id: trip.id })
    }
  }

  function exportTrip() {
    downloadJSON(`${slug(trip.name)}.json`, exportPayload([trip]))
    toast('Trip exported')
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
    dispatch({ type: 'item/delete', tripId: trip.id, dayId: itemModal.dayId, itemId: itemModal.item.id })
    setItemModal(null)
  }

  const modalDayIndex = itemModal ? trip.days.findIndex(d => d.id === itemModal.dayId) : -1

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-40 border-b border-slate-200/60 bg-slate-50/80 backdrop-blur dark:border-slate-800/60 dark:bg-slate-950/80">
        <div className="mx-auto flex h-14 max-w-2xl items-center gap-1 px-4">
          <button className={iconBtn} onClick={() => navigate('')} aria-label="Back to trips">
            <IconArrowLeft />
          </button>
          <h1 className="min-w-0 flex-1 truncate px-1 font-semibold">{trip.name}</h1>
          <button className={iconBtn} onClick={() => setEditTrip(true)} aria-label="Edit trip">
            <IconPencil className="size-[18px]" />
          </button>
          <button className={iconBtn} onClick={exportTrip} aria-label="Export trip">
            <IconDownload className="size-[18px]" />
          </button>
          <button className={iconBtn} onClick={deleteTrip} aria-label="Delete trip">
            <IconTrash className="size-[18px]" />
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-2xl space-y-8 px-4 pb-[max(6rem,env(safe-area-inset-bottom))] pt-5">
        <div className="rounded-2xl bg-gradient-to-br from-sky-500 to-indigo-500 p-5 text-white shadow-md">
          <h2 className="text-2xl font-bold">{trip.name}</h2>
          {trip.destination && <p className="mt-0.5 font-medium text-sky-100">{trip.destination}</p>}
          <p className="mt-1.5 text-sm text-sky-100/90">
            {[fmtRange(trip.startDate, trip.endDate), `${trip.days.length} day${trip.days.length === 1 ? '' : 's'}`, `${stops} stop${stops === 1 ? '' : 's'}`]
              .filter(Boolean)
              .join(' · ')}
          </p>
        </div>

        {trip.days.map((day, i) => (
          <DayCard
            key={day.id}
            trip={trip}
            day={day}
            index={i}
            onEditDay={() => setDayModal({ day, index: i })}
            onAddItem={() => setItemModal({ dayId: day.id })}
            onEditItem={item => setItemModal({ dayId: day.id, item })}
          />
        ))}

        <button
          onClick={addDay}
          className="flex w-full items-center justify-center gap-1.5 rounded-2xl border-2 border-dashed border-slate-300 px-4 py-4 font-semibold text-slate-500 transition hover:border-sky-400 hover:text-sky-600 dark:border-slate-700 dark:text-slate-400 dark:hover:border-sky-500 dark:hover:text-sky-400"
        >
          <IconPlus className="size-5" />
          Add day {trip.days.length + 1}
        </button>
      </main>

      {itemModal && (
        <ItemForm
          initial={itemModal.item}
          dayLabel={`day ${modalDayIndex + 1}`}
          onSave={saveItem}
          onDelete={deleteItem}
          onClose={() => setItemModal(null)}
        />
      )}
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
