import { useEffect, useRef } from 'react'
import { useDestinationCenter, usePlaceSearch } from '../lib/geo'
import { btnChip, IconMapPin } from './ui'

/* Places matching what is being typed (the plan's name, or its map text),
   nearest the destination first. Shown right under the field being typed
   in, so they are in view with the keyboard up. */
export function PlaceSuggestions({ trip, text, onPick }) {
  const center = useDestinationCenter(trip?.destination)
  const { places, searching } = usePlaceSearch(text, center)
  const list = useRef(null)
  const shown = places.length > 0 || searching

  // Suggestions scroll into view, above a phone's keyboard.
  useEffect(() => {
    if (shown) list.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [shown, places])

  if (!shown) return null
  return (
    <div ref={list} className="anim-menu -mt-2 space-y-1.5 [transform-origin:top]" aria-live="polite">
      <span className="flex items-center gap-2 text-[13px] font-medium text-slate-500 dark:text-slate-400">
        Put it on the day map
        {searching && (
          <span className="inline-flex items-center gap-1.5 font-normal text-slate-400 dark:text-slate-500">
            <span className="size-3 animate-spin rounded-full border-2 border-current border-t-transparent motion-reduce:animate-none" />
            Searching places…
          </span>
        )}
      </span>
      {places.length > 0 && (
        <ul
          className={`overflow-hidden rounded-xl ring-1 ring-slate-200 transition-opacity dark:ring-slate-700 ${searching ? 'opacity-60' : ''}`}
        >
          {places.map(p => (
            <li key={`${p.lat},${p.lng}`} className="border-t border-slate-100 first:border-t-0 dark:border-slate-800">
              <button
                type="button"
                onClick={() =>
                  onPick({ lat: p.lat, lng: p.lng, label: [p.name, p.detail].filter(Boolean).join(', ') }, p)
                }
                className="focus-inset flex w-full items-start gap-2.5 px-3 py-2.5 text-left transition hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                <IconMapPin className="mt-0.5 size-4 shrink-0 text-slate-400" />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">{p.name}</span>
                  {p.detail && (
                    <span className="block truncate text-xs text-slate-500 dark:text-slate-400">{p.detail}</span>
                  )}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/* Where the plan sits on the day map, once it has a spot. */
export function PlaceSpot({ spot, linked, onClear }) {
  if (linked) {
    return (
      <p className="-mt-2 flex items-center gap-1.5 text-[13px] font-medium text-brand-600 dark:text-brand-300">
        <IconMapPin className="size-3.5 shrink-0" />
        On the day map, from the link.
      </p>
    )
  }
  if (!spot) return null
  return (
    <div className="-mt-2 flex items-center gap-2 text-[13px]">
      <IconMapPin className="size-3.5 shrink-0 text-brand-600 dark:text-brand-300" />
      <span className="min-w-0 flex-1 truncate text-slate-600 dark:text-slate-300">
        {spot.label || 'On the day map'}
        {spot.guess && <span className="text-amber-600 dark:text-amber-400"> · best guess</span>}
      </span>
      <button type="button" className={btnChip} onClick={onClear}>
        {spot.guess ? 'Pick the place' : 'Change'}
      </button>
    </div>
  )
}
