import { useEffect, useState } from 'react'
import { fmtRange } from '../lib/dates'
import { isBookingFile, onLaunchFiles, setPendingBooking, takeSharedFiles } from '../lib/inbox'
import { parseImport } from '../lib/io'
import { useStore } from '../lib/store'
import { groupTrips } from '../lib/trips'
import ImportPreview from './ImportPreview'
import { IconChevronRight, IconTicket, Modal, useToast } from './ui'

/* A file shared to the app, or opened with it. A booking (.ics) asks which
   trip it belongs to, then opens that trip's import preview. A backup or an
   exported trip (.json) shows the usual import preview. */
export default function Inbox({ route, navigate }) {
  const { state, dispatch } = useStore()
  const toast = useToast()
  const [file, setFile] = useState(null)

  useEffect(() => {
    let alive = true
    const show = files => alive && files.length > 0 && setFile(files[0])
    takeSharedFiles().then(show)
    onLaunchFiles(show)
    return () => {
      alive = false
    }
  }, [])

  // #/inbox is only the way in: once the files are read, go home.
  useEffect(() => {
    if (route === '/inbox') navigate('', { replace: true })
  }, [route, navigate])

  if (!file) return null
  const close = () => setFile(null)

  if (isBookingFile(file)) {
    const trips = groupTrips(state.trips).flatMap(g => g.trips)
    return (
      <Modal title="Add this booking to…" onClose={close}>
        <p className="mb-3 flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
          <IconTicket className="size-4 shrink-0" />
          <span className="truncate">{file.name}</span>
        </p>
        {trips.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-500 dark:text-slate-400">
            Create a trip first, then share the booking again.
          </p>
        ) : (
          <ul className="space-y-2 pb-1">
            {trips.map(trip => (
              <li key={trip.id}>
                <button
                  onClick={() => {
                    setPendingBooking(trip.id, file.text)
                    close()
                    navigate(`/trip/${trip.id}`)
                  }}
                  className="flex w-full items-center gap-3 rounded-xl p-3 text-left ring-1 ring-slate-200 transition hover:bg-slate-50 dark:ring-slate-700 dark:hover:bg-slate-800/50"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{trip.name}</span>
                    <span className="block truncate text-xs text-slate-500 dark:text-slate-400">
                      {[trip.destination, fmtRange(trip.startDate, trip.endDate)].filter(Boolean).join(' · ')}
                    </span>
                  </span>
                  <IconChevronRight className="size-4.5 shrink-0 text-slate-400" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </Modal>
    )
  }

  let trips = null
  try {
    trips = parseImport(file.text)
  } catch {
    // not a Triplanner file
  }
  return (
    <Modal title="Import trips" onClose={close}>
      {trips ? (
        <ImportPreview
          trips={trips}
          onConfirm={chosen => {
            dispatch({ type: 'data/import', trips: chosen })
            toast(`Imported ${chosen.length} trip${chosen.length === 1 ? '' : 's'}`)
            close()
          }}
          onCancel={close}
        />
      ) : (
        <p className="py-8 text-center text-sm text-slate-500 dark:text-slate-400">
          “{file.name}” is not a booking (.ics) or a Triplanner file (.json).
        </p>
      )}
    </Modal>
  )
}
