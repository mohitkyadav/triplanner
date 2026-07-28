import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { amapsUrl, catById, gmapsUrl, titleFor } from '../lib/categories'
import { IconGrip, IconMapPin } from './ui'

const HOTEL_LABELS = { 'check-in': 'Check-in', 'check-out': 'Check-out', stay: 'Stay' }

export default function ItemCard({ item, destination, onEdit }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } =
    useSortable({ id: item.id })

  const cat = catById(item.type)
  const title = titleFor(item)
  const mapsQuery = [item.title, destination].filter(Boolean).join(', ')

  const meta = []
  if (item.type === 'flight') {
    meta.push(item.direction === 'departure' ? 'Departure' : 'Arrival')
    if (item.location) meta.push(item.location)
  } else if (item.type === 'hotel' && item.hotelAction) {
    meta.push(HOTEL_LABELS[item.hotelAction] ?? item.hotelAction)
  }

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`relative flex items-start gap-2 rounded-xl bg-white p-3 ring-1 dark:bg-slate-900 ${
        isDragging
          ? 'z-10 opacity-90 shadow-xl ring-sky-400 dark:ring-sky-500'
          : 'shadow-sm ring-slate-200 dark:ring-slate-800'
      }`}
    >
      <button
        ref={setActivatorNodeRef}
        {...attributes}
        {...listeners}
        className="-m-1 mt-1.5 shrink-0 cursor-grab touch-none rounded p-1 text-slate-300 transition hover:text-slate-500 active:cursor-grabbing dark:text-slate-600 dark:hover:text-slate-400"
        aria-label="Reorder"
      >
        <IconGrip className="size-4" />
      </button>

      <div className="flex min-w-0 flex-1 cursor-pointer items-start gap-3" onClick={onEdit}>
        <span className={`grid size-10 shrink-0 place-items-center rounded-xl text-lg ${cat.badge}`}>
          {cat.emoji}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-2">
            <span className="min-w-0 flex-1 truncate font-medium">{title}</span>
            {item.time && (
              <span className="mt-0.5 shrink-0 rounded-md bg-slate-100 px-1.5 py-0.5 text-xs font-semibold tabular-nums text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                {item.time}
              </span>
            )}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
            <span className={`rounded-md px-1.5 py-0.5 font-medium ${cat.badge}`}>{cat.label}</span>
            {meta.length > 0 && <span>{meta.join(' · ')}</span>}
          </div>
          {item.notes && (
            <p className="mt-1.5 line-clamp-2 whitespace-pre-wrap text-sm text-slate-500 dark:text-slate-400">
              {item.notes}
            </p>
          )}
          {(item.mapsUrl || mapsQuery) && (
            <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1" onClick={e => e.stopPropagation()}>
              {item.mapsUrl ? (
                <MapLink href={item.mapsUrl}>Open map</MapLink>
              ) : (
                <>
                  <MapLink href={gmapsUrl(mapsQuery)}>Google Maps</MapLink>
                  <MapLink href={amapsUrl(mapsQuery)}>Apple Maps</MapLink>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </li>
  )
}

function MapLink({ href, children }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 text-xs font-semibold text-sky-600 hover:underline dark:text-sky-400"
    >
      <IconMapPin className="size-3.5" />
      {children}
    </a>
  )
}
