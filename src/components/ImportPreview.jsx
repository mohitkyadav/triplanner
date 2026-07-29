import { fmtRange } from '../lib/dates'
import { useStore } from '../lib/store'
import { btnGhost, btnPrimary, IconCalendar, IconMapPin } from './ui'

// Summary + confirm step before shared trips are added to the store.
export default function ImportPreview({ trips, onConfirm, onCancel }) {
  const { state } = useStore()
  const existing = new Set(state.trips.map(t => t.id))

  return (
    <div className="space-y-4 pb-1">
      {trips.map(trip => {
        const stops = trip.days.reduce((n, d) => n + d.items.length, 0)
        return (
          <div
            key={trip.id}
            className="rounded-xl bg-slate-50 p-4 ring-1 ring-slate-200 dark:bg-slate-800/50 dark:ring-slate-700"
          >
            <h3 className="text-lg font-bold">{trip.name}</h3>
            {trip.destination && (
              <p className="mt-0.5 flex items-center gap-1.5 text-sm font-medium text-slate-600 dark:text-slate-300">
                <IconMapPin className="size-4 shrink-0 text-brand-600 dark:text-brand-300" />
                {trip.destination}
              </p>
            )}
            <p className="mt-1 flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400">
              <IconCalendar className="size-4 shrink-0" />
              {[
                fmtRange(trip.startDate, trip.endDate),
                `${trip.days.length} day${trip.days.length === 1 ? '' : 's'}`,
                `${stops} stop${stops === 1 ? '' : 's'}`,
              ]
                .filter(Boolean)
                .join(' · ')}
            </p>
            {existing.has(trip.id) && (
              <p className="mt-2 text-[13px] font-medium text-amber-600 dark:text-amber-400">
                You already have this trip — adding it updates your copy.
              </p>
            )}
          </div>
        )
      })}
      <p className="text-xs text-slate-400 dark:text-slate-500">
        The trip is stored on this device only — nothing is uploaded.
      </p>
      <div className="flex justify-end gap-2">
        <button className={btnGhost} onClick={onCancel}>
          Cancel
        </button>
        <button className={btnPrimary} onClick={onConfirm}>
          {trips.length === 1 ? 'Add trip' : `Add ${trips.length} trips`}
        </button>
      </div>
    </div>
  )
}
