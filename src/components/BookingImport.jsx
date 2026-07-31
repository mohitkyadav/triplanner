import { useMemo, useState } from 'react'
import { readBooking } from '../lib/booking'
import { catById, titleFor } from '../lib/categories'
import { fmtDate } from '../lib/dates'
import {
  btnGhost,
  btnPrimary,
  IconAlert,
  IconCheckCircle,
  IconCircle,
  IconLogIn,
  IconLogOut,
  IconPlaneLanding,
  IconPlaneTakeoff,
  Modal,
} from './ui'

// Reads a booking file, shows what it found, and adds only what the user ticks.
// Nothing is saved until then.

const DIRECTION = {
  arrival: { icon: IconPlaneLanding, label: 'Arrival' },
  departure: { icon: IconPlaneTakeoff, label: 'Departure' },
}
const HOTEL = {
  'check-in': { icon: IconLogIn, label: 'Check-in' },
  'check-out': { icon: IconLogOut, label: 'Check-out' },
}

function metaFor(item) {
  if (item.type === 'flight') return DIRECTION[item.direction] ?? DIRECTION.arrival
  if (item.type === 'hotel') return HOTEL[item.hotelAction] ?? HOTEL['check-in']
  return null
}

export default function BookingImport({ trip, text, onImport, onClose }) {
  const parsed = useMemo(() => {
    try {
      return { rows: readBooking(text, trip) }
    } catch (err) {
      return { error: err.message }
    }
  }, [text, trip])

  const rows = parsed.rows ?? []
  const [picked, setPicked] = useState(() => new Set(rows.filter(r => !r.duplicate).map(r => r.key)))

  const chosen = rows.filter(r => picked.has(r.key))
  const knownDates = new Set(trip.days.map(d => d.date))
  const newDays = new Set(chosen.map(r => r.date).filter(d => !knownDates.has(d)))
  const converted = chosen.some(r => r.fromUtc)

  function toggle(key) {
    setPicked(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  if (parsed.error) {
    return (
      <Modal title="Import booking" onClose={onClose}>
        <p className="py-6 text-center text-sm text-slate-500 dark:text-slate-400">
          This file could not be read — {parsed.error}.
        </p>
        <p className="pb-2 text-center text-[13px] text-slate-400 dark:text-slate-500">
          Use the calendar file (.ics) that came with the confirmation mail.
        </p>
      </Modal>
    )
  }

  return (
    <Modal title={`Import booking · ${rows.length} event${rows.length === 1 ? '' : 's'}`} onClose={onClose}>
      <div className="space-y-4 pb-1">
        <ul className="space-y-2">
          {rows.map(row => {
            const cat = catById(row.item.type)
            const meta = metaFor(row.item)
            const on = picked.has(row.key)
            return (
              <li key={row.key}>
                <button
                  onClick={() => toggle(row.key)}
                  className={`flex w-full items-start gap-3 rounded-xl p-3 text-left ring-1 transition ${
                    on
                      ? 'bg-brand-50 ring-brand-300 dark:bg-brand-500/10 dark:ring-brand-600'
                      : 'ring-slate-200 hover:bg-slate-50 dark:ring-slate-700 dark:hover:bg-slate-800/50'
                  }`}
                >
                  <span className={`shrink-0 pt-0.5 ${on ? 'text-brand-600 dark:text-brand-300' : 'text-slate-300 dark:text-slate-600'}`}>
                    {on ? <IconCheckCircle className="size-5" /> : <IconCircle className="size-5" />}
                  </span>
                  <span className={`grid size-9 shrink-0 place-items-center rounded-lg text-lg ${cat.badge}`}>
                    {cat.emoji}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{titleFor(row.item)}</span>
                    <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
                      <span className="font-medium">{cat.label}</span>
                      {meta && (
                        <span className="inline-flex items-center gap-1">
                          <meta.icon className="size-3.5" />
                          {meta.label}
                        </span>
                      )}
                      <span className="tabular-nums">
                        {fmtDate(row.date)}
                        {row.time && ` · ${row.time}`}
                      </span>
                      {/* the title usually names the flight already */}
                      {row.item.flightNo && !row.item.title.includes(row.item.flightNo) && (
                        <span className="font-medium">{row.item.flightNo}</span>
                      )}
                    </span>
                    {row.duplicate && (
                      <span className="mt-1 block text-[11px] font-semibold text-amber-600 dark:text-amber-400">
                        The trip already holds this plan
                      </span>
                    )}
                    {row.fromUtc && (
                      <span className="mt-1 block text-[11px] text-slate-400 dark:text-slate-500">
                        The file gives this time in UTC — check it against your ticket
                      </span>
                    )}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>

        {(newDays.size > 0 || converted) && (
          <div className="flex items-start gap-2 rounded-xl bg-slate-50 p-3 text-[13px] text-slate-500 ring-1 ring-slate-200 dark:bg-slate-800/50 dark:text-slate-400 dark:ring-slate-700">
            <IconAlert className="mt-0.5 size-4 shrink-0 text-amber-500" />
            <span>
              {newDays.size > 0 && (
                <>
                  {newDays.size} new day{newDays.size === 1 ? '' : 's'} will join the trip, and the trip dates grow to
                  cover {newDays.size === 1 ? 'it' : 'them'}.
                </>
              )}
              {newDays.size > 0 && converted && ' '}
              {converted && 'A time given in UTC is shown on this device’s clock.'}
            </span>
          </div>
        )}

        <div className="flex items-center gap-2">
          <button
            className={btnGhost}
            onClick={() => setPicked(new Set(chosen.length === rows.length ? [] : rows.map(r => r.key)))}
          >
            {chosen.length === rows.length ? 'Clear all' : 'Select all'}
          </button>
          <span className="flex-1" />
          <button className={btnGhost} onClick={onClose}>
            Cancel
          </button>
          <button
            className={`${btnPrimary} disabled:pointer-events-none disabled:opacity-40`}
            disabled={chosen.length === 0}
            onClick={() => onImport(chosen)}
          >
            {chosen.length === 0 ? 'Select a plan' : `Add ${chosen.length} plan${chosen.length === 1 ? '' : 's'}`}
          </button>
        </div>

        <p className="text-center text-xs text-slate-400 dark:text-slate-500">
          The file is read on this device. Nothing is uploaded.
        </p>
      </div>
    </Modal>
  )
}
