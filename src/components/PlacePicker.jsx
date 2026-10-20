import { useDestinationCenter, usePlaceSearch } from '../lib/geo'
import { btnChip, IconMapPin } from './ui'

/* Puts a plan on the day map. While the plan has no spot, places matching
   its place text (or its name) are suggested, nearest the destination
   first; picking one keeps its coordinates. A maps link with coordinates
   needs no picking. */
export default function PlacePicker({ trip, text, spot, linked, onPick }) {
  const center = useDestinationCenter(trip?.destination)
  const places = usePlaceSearch(text, center, !spot && !linked)

  if (linked) {
    return (
      <p className="-mt-2 flex items-center gap-1.5 text-[13px] font-medium text-brand-600 dark:text-brand-300">
        <IconMapPin className="size-3.5 shrink-0" />
        On the day map, from the link.
      </p>
    )
  }

  if (spot) {
    return (
      <div className="-mt-2 flex items-center gap-2 text-[13px]">
        <IconMapPin className="size-3.5 shrink-0 text-brand-600 dark:text-brand-300" />
        <span className="min-w-0 flex-1 truncate text-slate-600 dark:text-slate-300">
          {spot.label || 'On the day map'}
          {spot.guess && <span className="text-amber-600 dark:text-amber-400"> · best guess</span>}
        </span>
        <button type="button" className={btnChip} onClick={() => onPick(null)}>
          {spot.guess ? 'Pick the place' : 'Change'}
        </button>
      </div>
    )
  }

  if (places.length === 0) return null
  return (
    <div className="-mt-2 space-y-1.5">
      <span className="block text-[13px] font-medium text-slate-500 dark:text-slate-400">Put it on the day map</span>
      <ul className="overflow-hidden rounded-xl ring-1 ring-slate-200 dark:ring-slate-700">
        {places.map(p => (
          <li key={`${p.lat},${p.lng}`} className="border-t border-slate-100 first:border-t-0 dark:border-slate-800">
            <button
              type="button"
              onClick={() =>
                onPick({ lat: p.lat, lng: p.lng, label: [p.name, p.detail].filter(Boolean).join(', ') }, p)
              }
              className="flex w-full items-start gap-2.5 px-3 py-2 text-left transition hover:bg-slate-50 dark:hover:bg-slate-800"
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
    </div>
  )
}
