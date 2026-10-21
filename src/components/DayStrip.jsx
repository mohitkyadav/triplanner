import { useEffect, useRef } from 'react'
import { weatherIcon } from '../lib/weather'
import { IconMap } from './ui'

// "Mon 9" for a chip; "" for a day without a date.
const short = date =>
  date ? new Date(`${date}T00:00`).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric' }) : ''

/* The trip's days in a strip that stays under the header: tap one to go
   to it; the one in view is lit, and the strip keeps it in sight. The map
   chip opens the whole trip on one map. */
export default function DayStrip({ days, activeId, today, weather, onPick, onMap }) {
  const scroller = useRef(null)

  // The lit chip slides into view as the page scrolls through the days.
  useEffect(() => {
    const box = scroller.current
    const chip = box?.querySelector(`[data-chip="${activeId}"]`)
    if (!chip) return
    box.scrollTo?.({ left: chip.offsetLeft - box.clientWidth / 2 + chip.clientWidth / 2, behavior: 'smooth' })
  }, [activeId])

  return (
    <nav
      aria-label="Days of the trip"
      className="sticky top-14 z-30 border-b border-slate-200/60 bg-slate-50/85 backdrop-blur dark:border-slate-800/60 dark:bg-slate-950/85"
    >
      <div
        ref={scroller}
        className="mx-auto flex max-w-2xl gap-1.5 overflow-x-auto px-4 py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {onMap && (
          <button
            onClick={onMap}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-[13px] font-semibold text-slate-700 shadow-sm ring-1 ring-slate-200 transition hover:ring-brand-300 dark:bg-slate-900 dark:text-slate-200 dark:ring-slate-700"
          >
            <IconMap className="size-4" />
            Map
          </button>
        )}
        {days.map((d, i) => {
          const active = d.id === activeId
          const wx = weather?.[d.date]
          return (
            <button
              key={d.id}
              data-chip={d.id}
              onClick={() => onPick(d.id)}
              aria-current={active ? 'true' : undefined}
              className={`relative inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] transition ${
                active
                  ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                  : 'text-slate-600 hover:bg-slate-200/70 dark:text-slate-300 dark:hover:bg-slate-800'
              }`}
            >
              <span className="font-semibold">Day {i + 1}</span>
              {d.date && (
                <span className={active ? 'opacity-75' : 'text-slate-400 dark:text-slate-500'}>{short(d.date)}</span>
              )}
              {wx && Number.isFinite(wx.max) && (
                <span aria-hidden="true" className="text-xs">
                  {weatherIcon(wx.code).emoji}
                </span>
              )}
              {d.date === today && (
                <span
                  className="absolute right-1 top-1 size-1.5 rounded-full bg-accent"
                  aria-label="today"
                  title="Today"
                />
              )}
            </button>
          )
        })}
      </div>
    </nav>
  )
}
