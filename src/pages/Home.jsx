import { useRef, useState } from 'react'
import ScanModal from '../components/ScanModal'
import ThemeSwitcher from '../components/ThemeSwitcher'
import TripForm from '../components/TripForm'
import {
  IconDownload,
  IconPlus,
  IconQrCode,
  IconTrash,
  IconUpload,
  btnGhost,
  btnPrimary,
  iconBtn,
  useToast,
} from '../components/ui'
import { fmtRange, todayISO } from '../lib/dates'
import { downloadJSON, exportPayload, parseImport } from '../lib/io'
import { makeTrip, useStore } from '../lib/store'

export default function Home({ navigate }) {
  const { state, dispatch } = useStore()
  const toast = useToast()
  const [creating, setCreating] = useState(false)
  const [scanning, setScanning] = useState(false)
  const fileRef = useRef(null)

  function createTrip(data) {
    const trip = makeTrip(data)
    dispatch({ type: 'trip/create', trip })
    setCreating(false)
    navigate(`/trip/${trip.id}`)
  }

  function exportAll() {
    downloadJSON(`triplanner-backup-${todayISO()}.json`, exportPayload(state.trips))
    toast('Backup exported')
  }

  async function importFile(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    try {
      const trips = parseImport(await file.text())
      dispatch({ type: 'data/import', trips })
      toast(`Imported ${trips.length} trip${trips.length === 1 ? '' : 's'}`)
    } catch (err) {
      toast(`Import failed: ${err.message}`)
    }
  }

  function deleteTrip(trip) {
    if (!window.confirm(`Delete the trip “${trip.name}”?`)) return
    const index = state.trips.findIndex(t => t.id === trip.id)
    dispatch({ type: 'trip/delete', id: trip.id })
    toast('Trip deleted', {
      label: 'Undo',
      onClick: () => dispatch({ type: 'trip/restore', trip, index }),
    })
  }

  function importScanned(trips) {
    dispatch({ type: 'data/import', trips })
    setScanning(false)
    toast(`Added “${trips[0].name}”`)
    navigate(`/trip/${trips[0].id}`)
  }

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-40 border-b border-slate-200/60 bg-slate-50/80 backdrop-blur dark:border-slate-800/60 dark:bg-slate-950/80">
        <div className="mx-auto flex h-14 max-w-2xl items-center gap-3 px-4">
          <img src="/icons/icon-128.png" alt="" className="size-7 rounded-lg" />
          <h1 className="flex-1 text-lg font-bold tracking-tight">Triplanner</h1>
          <button className={iconBtn} onClick={() => setScanning(true)} aria-label="Scan a shared trip">
            <IconQrCode className="size-4.5" />
          </button>
          {state.trips.length > 0 && (
            <button className={btnPrimary} onClick={() => setCreating(true)}>
              <IconPlus className="size-4" />
              New trip
            </button>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 pb-[max(6rem,env(safe-area-inset-bottom))] pt-6">
        {state.trips.length === 0 ? (
          <div className="flex flex-col items-center gap-4 py-24 text-center">
            <span className="text-6xl">🧳</span>
            <div>
              <h2 className="text-xl font-bold">Plan your first trip</h2>
              <p className="mt-1 max-w-xs text-sm text-slate-500 dark:text-slate-400">
                Days, flights, hotels and places to see — all on your device, even offline.
              </p>
            </div>
            <button className={btnPrimary} onClick={() => setCreating(true)}>
              <IconPlus className="size-4" />
              New trip
            </button>
            <div className="flex gap-2">
              <button className={btnGhost} onClick={() => setScanning(true)}>
                <IconQrCode className="size-4" />
                Scan a shared trip
              </button>
              <button className={btnGhost} onClick={() => fileRef.current?.click()}>
                <IconUpload className="size-4" />
                Import a backup
              </button>
            </div>
          </div>
        ) : (
          <>
            <ul className="space-y-3">
              {state.trips.map(trip => {
                const stops = trip.days.reduce((n, d) => n + d.items.length, 0)
                return (
                  <li
                    key={trip.id}
                    onClick={() => navigate(`/trip/${trip.id}`)}
                    className="group cursor-pointer rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200 transition hover:shadow-md hover:ring-brand-300 dark:bg-slate-900 dark:ring-slate-800 dark:hover:ring-brand-600"
                  >
                    <div className="flex items-start gap-3">
                      <div className="min-w-0 flex-1">
                        <h3 className="truncate text-lg font-semibold">{trip.name}</h3>
                        {trip.destination && (
                          <p className="truncate text-sm text-slate-500 dark:text-slate-400">{trip.destination}</p>
                        )}
                      </div>
                      <button
                        className={`${iconBtn} opacity-60 group-hover:opacity-100`}
                        onClick={e => {
                          e.stopPropagation()
                          deleteTrip(trip)
                        }}
                        aria-label={`Delete ${trip.name}`}
                      >
                        <IconTrash className="size-4" />
                      </button>
                    </div>
                    <p className="mt-2 text-xs font-medium text-slate-400 dark:text-slate-500">
                      {[
                        fmtRange(trip.startDate, trip.endDate),
                        `${trip.days.length} day${trip.days.length === 1 ? '' : 's'}`,
                        `${stops} stop${stops === 1 ? '' : 's'}`,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </p>
                  </li>
                )
              })}
            </ul>

            <div className="mt-8 flex flex-col items-center gap-1">
              <div className="flex gap-2">
                <button className={btnGhost} onClick={exportAll}>
                  <IconDownload className="size-4" />
                  Export all
                </button>
                <button className={btnGhost} onClick={() => fileRef.current?.click()}>
                  <IconUpload className="size-4" />
                  Import
                </button>
              </div>
              <p className="text-xs text-slate-400 dark:text-slate-500">
                Everything lives in this browser — export now and then to back up.
              </p>
            </div>
          </>
        )}

        <div className="mt-10">
          <ThemeSwitcher />
        </div>
      </main>

      <input ref={fileRef} type="file" accept=".json,application/json" hidden onChange={importFile} />
      {creating && <TripForm onSave={createTrip} onClose={() => setCreating(false)} />}
      {scanning && <ScanModal onImport={importScanned} onClose={() => setScanning(false)} />}
    </div>
  )
}
