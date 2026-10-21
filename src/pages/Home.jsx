import { useEffect, useRef, useState } from 'react'
import Account, { AccountMenu } from '../components/Account'
import DataSafety from '../components/DataSafety'
import ScanModal from '../components/ScanModal'
import ThemeSwitcher from '../components/ThemeSwitcher'
import TripForm from '../components/TripForm'
import {
  IconNavigation,
  IconPlus,
  IconQrCode,
  IconTrash,
  IconUpload,
  IconUsers,
  Segmented,
  btnChipBrand,
  btnGhost,
  btnPrimary,
  iconBtn,
  useToast,
} from '../components/ui'
import { fmtRange, todayISO } from '../lib/dates'
import { downloadJSON, exportPayload, parseImport } from '../lib/io'
import { leaveTrip } from '../lib/shares'
import { makeTrip, useStore } from '../lib/store'
import { useOnlineEnabled } from '../lib/online'
import { countdown, groupTrips, tripPhase } from '../lib/trips'
import { vtName } from '../lib/motion'

const GROUP_TITLE = { ongoing: 'Under way', upcoming: 'Upcoming', undated: 'No dates yet', past: 'Past trips' }

function TripRow({ trip, navigate, onDelete, introAt }) {
  const phase = tripPhase(trip)
  const stops = trip.days.reduce((n, d) => n + d.items.length, 0)
  const open = () => navigate(`/trip/${trip.id}`)
  const when = countdown(phase)
  return (
    <li
      onClick={open}
      onKeyDown={e => {
        if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault()
          open()
        }
      }}
      role="link"
      tabIndex={0}
      aria-label={`Open ${trip.name}`}
      style={{
        viewTransitionName: vtName('trip', trip.id),
        animationDelay: introAt != null ? `${Math.min(introAt, 8) * 60}ms` : undefined,
      }}
      data-vt-shared
      className={`${introAt != null ? 'anim-rise ' : ''}group cursor-pointer rounded-2xl bg-white p-4 shadow-sm ring-1 transition hover:shadow-md hover:ring-brand-300 dark:bg-slate-900 dark:hover:ring-brand-600 ${
        phase.phase === 'ongoing' ? 'ring-brand-300 dark:ring-brand-600' : 'ring-slate-200 dark:ring-slate-800'
      } ${phase.phase === 'past' ? 'opacity-75' : ''}`}
    >
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <h3
            className="w-fit max-w-full truncate text-lg font-semibold"
            style={{ viewTransitionName: vtName('trip-title', trip.id) }}
            data-vt-shared
          >
            {trip.name}
          </h3>
          {trip.destination && (
            <p className="truncate text-sm text-slate-500 dark:text-slate-400">{trip.destination}</p>
          )}
          {trip.sharedFrom && (
            <p className="mt-0.5 flex items-center gap-1 truncate text-xs font-medium text-brand-700 dark:text-brand-300">
              <IconUsers className="size-3.5 shrink-0" />
              Shared by {trip.sharedFrom.ownerEmail || 'someone'}
            </p>
          )}
        </div>
        {when && (
          <span className="mt-1 shrink-0 rounded-full bg-accent/15 px-2 py-0.5 text-[11px] font-bold text-amber-700 dark:text-amber-400">
            {when}
          </span>
        )}
        <button
          className={`${iconBtn} opacity-60 group-hover:opacity-100`}
          onClick={e => {
            e.stopPropagation()
            onDelete(trip)
          }}
          aria-label={trip.sharedFrom ? `Remove ${trip.name} from my trips` : `Delete ${trip.name}`}
        >
          <IconTrash className="size-4" />
        </button>
      </div>
      <div className="mt-2 flex items-center gap-2">
        <p className="min-w-0 flex-1 truncate text-xs font-medium text-slate-400 dark:text-slate-500">
          {[
            fmtRange(trip.startDate, trip.endDate),
            `${trip.days.length} day${trip.days.length === 1 ? '' : 's'}`,
            `${stops} stop${stops === 1 ? '' : 's'}`,
          ]
            .filter(Boolean)
            .join(' · ')}
        </p>
        {phase.phase === 'ongoing' && (
          <button
            className={btnChipBrand}
            style={{ viewTransitionName: vtName('tripmode', trip.id) }}
            data-vt-shared
            onClick={e => {
              e.stopPropagation()
              navigate(`/trip/${trip.id}/today`)
            }}
          >
            <IconNavigation className="size-3.5" />
            Trip mode
          </button>
        )}
      </div>
    </li>
  )
}

// One switch for the weather, the day maps and place search.
function OnlineSetting() {
  const [on, setOn] = useOnlineEnabled()
  return (
    <div className="mx-auto w-full max-w-72 space-y-1.5">
      <p className="text-center text-xs font-semibold text-slate-500 dark:text-slate-400">Weather &amp; maps</p>
      <Segmented
        value={on ? 'on' : 'off'}
        onChange={v => setOn(v === 'on')}
        options={[
          { value: 'on', label: 'On' },
          { value: 'off', label: 'Off' },
        ]}
      />
      <p className="text-center text-[11px] text-slate-400 dark:text-slate-500">
        They send only place names and the map area you look at to Open-Meteo, OpenFreeMap and Photon.
      </p>
    </div>
  )
}

// The trip cards rise in one after another the first time Home shows.
let introPlayed = false

export default function Home({ navigate }) {
  const { state, dispatch } = useStore()
  const [intro] = useState(() => !introPlayed)
  useEffect(() => {
    introPlayed = true
  }, [])
  const groups = groupTrips(state.trips)
  const introOrder = new Map(groups.flatMap(g => g.trips).map((t, i) => [t.id, i]))
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

  // A trip shared with you is not yours to delete: you can stop seeing it.
  async function leave(trip) {
    const owner = trip.sharedFrom.ownerEmail || 'its owner'
    if (!window.confirm(`Remove “${trip.name}” from your trips? You will stop seeing it; ${owner} keeps it.`)) return
    try {
      await leaveTrip(trip)
    } catch (err) {
      toast(err.message)
      return
    }
    dispatch({ type: 'trip/delete', id: trip.id })
    toast('Removed from your trips')
  }

  function deleteTrip(trip) {
    if (trip.sharedFrom) return leave(trip)
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
            // just the plus on a phone, where the header has little room
            <button
              className={`${btnPrimary} max-sm:size-10 max-sm:p-0`}
              onClick={() => setCreating(true)}
              aria-label="New trip"
              title="New trip"
            >
              <IconPlus className="size-4 max-sm:size-5" />
              <span className="max-sm:hidden">New trip</span>
            </button>
          )}
          <AccountMenu />
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
            <div className="space-y-6">
              {groups.map(group => (
                <section key={group.phase} aria-label={GROUP_TITLE[group.phase]}>
                  <h2 className="mb-2 px-1 text-[13px] font-bold uppercase tracking-wide text-slate-400 dark:text-slate-500">
                    {GROUP_TITLE[group.phase]}
                  </h2>
                  <ul className="space-y-3">
                    {group.trips.map(trip => (
                      <TripRow
                        key={trip.id}
                        trip={trip}
                        navigate={navigate}
                        onDelete={deleteTrip}
                        introAt={intro ? introOrder.get(trip.id) : null}
                      />
                    ))}
                  </ul>
                </section>
              ))}
            </div>

            <div className="mt-6">
              <DataSafety onExport={exportAll} onImport={() => fileRef.current?.click()} />
            </div>
          </>
        )}

        <Account />

        <div className="mt-10 space-y-4">
          <ThemeSwitcher />
          <OnlineSetting />
        </div>
      </main>

      <input ref={fileRef} type="file" accept=".json,application/json" hidden onChange={importFile} />
      {creating && <TripForm onSave={createTrip} onClose={() => setCreating(false)} />}
      {scanning && <ScanModal onImport={importScanned} onClose={() => setScanning(false)} />}
    </div>
  )
}
