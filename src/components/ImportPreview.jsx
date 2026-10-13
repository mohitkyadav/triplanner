import { useState } from 'react'
import { fmtRange } from '../lib/dates'
import { cloneTrip } from '../lib/io'
import { useStore } from '../lib/store'
import { btnGhost, btnPrimary, IconCalendar, IconMapPin, Segmented } from './ui'

/* Summary + confirm step before trips are added to the store. A trip this
   device already holds can replace the copy here, or sit next to it as a
   separate trip — so a trip passed back and forth never silently overwrites
   your own edits. onConfirm gets the trips to add. */
export default function ImportPreview({ trips, onConfirm, onCancel, defaultChoice = 'keep' }) {
  const { state } = useStore()
  const existing = new Map(state.trips.map(t => [t.id, t]))
  const [choice, setChoice] = useState(() => Object.fromEntries(trips.map(t => [t.id, defaultChoice])))

  function confirm() {
    onConfirm(
      trips.map(t => (existing.has(t.id) && choice[t.id] === 'keep' ? cloneTrip(t, { name: `${t.name} (copy)` }) : t)),
    )
  }

  return (
    <div className="space-y-4 pb-1">
      {trips.map(trip => {
        const stops = trip.days.reduce((n, d) => n + d.items.length, 0)
        const mine = existing.get(trip.id)
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
            {mine && (
              <div className="mt-3 space-y-2">
                <p className="text-[13px] font-medium text-amber-600 dark:text-amber-400">
                  You already have this trip{mine.name !== trip.name ? ` as “${mine.name}”` : ''}.
                </p>
                <Segmented
                  value={choice[trip.id]}
                  onChange={v => setChoice(prev => ({ ...prev, [trip.id]: v }))}
                  options={[
                    { value: 'keep', label: 'Keep both' },
                    { value: 'replace', label: 'Replace mine' },
                  ]}
                />
              </div>
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
        <button className={btnPrimary} onClick={confirm}>
          {trips.length === 1 ? 'Add trip' : `Add ${trips.length} trips`}
        </button>
      </div>
    </div>
  )
}
