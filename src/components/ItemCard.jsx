import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { catById, mapsProvider, titleFor } from '../lib/categories'
import {
  IconApple,
  IconCheckCircle,
  IconCircle,
  IconGoogle,
  IconGrip,
  IconLogIn,
  IconLogOut,
  IconMapPin,
  IconPlaneLanding,
  IconPlaneTakeoff,
  IconXCircle,
} from './ui'

const STATUS_CYCLE = { undefined: 'done', done: 'skipped', skipped: undefined }
const STATUS_UI = {
  done: { icon: IconCheckCircle, cls: 'text-emerald-500 hover:text-emerald-600', label: 'Done — tap to mark skipped' },
  skipped: { icon: IconXCircle, cls: 'text-slate-400 hover:text-slate-500', label: 'Skipped — tap to mark planned' },
  planned: {
    icon: IconCircle,
    cls: 'text-slate-300 hover:text-slate-400 dark:text-slate-600 dark:hover:text-slate-500',
    label: 'Planned — tap to mark done',
  },
}
const MAPS_META = {
  google: { icon: IconGoogle, label: 'Google Maps' },
  apple: { icon: IconApple, label: 'Apple Maps' },
  other: { icon: IconMapPin, label: 'Open map' },
}

function Card({ item, onEdit, onSetStatus, ghost, overlay, dragRef, dragStyle, handleRef, handleProps }) {
  const cat = catById(item.type)
  const title = titleFor(item)
  const status = STATUS_UI[item.status] ?? STATUS_UI.planned
  const skipped = item.status === 'skipped'
  const maps = item.mapsUrl ? MAPS_META[mapsProvider(item.mapsUrl)] : null

  let MetaIcon = null
  let metaText = ''
  if (item.type === 'flight') {
    MetaIcon = item.direction === 'departure' ? IconPlaneTakeoff : IconPlaneLanding
    metaText = item.direction === 'departure' ? 'Departure' : 'Arrival'
    if (item.location) metaText += ` · ${item.location}`
  } else if (item.type === 'hotel') {
    MetaIcon = item.hotelAction === 'check-out' ? IconLogOut : IconLogIn
    metaText = item.hotelAction === 'check-out' ? 'Check-out' : 'Check-in'
  }

  return (
    <li
      ref={dragRef}
      style={dragStyle}
      className={`relative flex items-start gap-2 rounded-xl bg-white p-3 ring-1 dark:bg-slate-900 ${
        ghost
          ? 'opacity-40 shadow-sm ring-slate-200 dark:ring-slate-800'
          : overlay
            ? 'shadow-2xl ring-brand-400 dark:ring-brand-500'
            : 'shadow-sm ring-slate-200 dark:ring-slate-800'
      }`}
    >
      <button
        ref={handleRef}
        {...handleProps}
        className="-m-1 mt-1.5 shrink-0 cursor-grab touch-none rounded p-1 text-slate-300 transition hover:text-slate-500 active:cursor-grabbing dark:text-slate-600 dark:hover:text-slate-400"
        aria-label="Reorder"
      >
        <IconGrip className="size-4" />
      </button>

      <div
        className={`flex min-w-0 flex-1 cursor-pointer items-start gap-3 ${skipped ? 'opacity-50' : ''}`}
        onClick={onEdit}
      >
        <span className={`grid size-10 shrink-0 place-items-center rounded-xl text-lg ${cat.badge}`}>
          {cat.emoji}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className={`min-w-0 flex-1 truncate font-medium ${skipped ? 'line-through' : ''}`}>{title}</span>
            {item.time && (
              <span className="shrink-0 rounded-md bg-slate-100 px-1.5 py-0.5 text-xs font-semibold tabular-nums text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                {item.time}
              </span>
            )}
            <button
              onClick={e => {
                e.stopPropagation()
                onSetStatus?.(STATUS_CYCLE[item.status])
              }}
              className={`-my-1 -mr-1.5 shrink-0 rounded-full p-1 transition ${status.cls}`}
              aria-label={status.label}
              title={status.label}
            >
              <status.icon className="size-5.5" />
            </button>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
            <span className={`rounded-md px-1.5 py-0.5 font-medium ${cat.badge}`}>{cat.label}</span>
            {metaText && (
              <span className="inline-flex items-center gap-1">
                <MetaIcon className="size-3.5" />
                {metaText}
              </span>
            )}
          </div>
          {item.notes && (
            <p className="mt-1.5 line-clamp-2 whitespace-pre-wrap text-sm text-slate-500 dark:text-slate-400">
              {item.notes}
            </p>
          )}
          {maps && (
            <div className="mt-1.5" onClick={e => e.stopPropagation()}>
              <a
                href={item.mapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand-600 hover:underline dark:text-brand-300"
              >
                <maps.icon className="size-3.5" />
                {maps.label}
              </a>
            </div>
          )}
        </div>
      </div>
    </li>
  )
}

export default function ItemCard({ item, onEdit, onSetStatus }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } =
    useSortable({ id: item.id })
  return (
    <Card
      item={item}
      onEdit={onEdit}
      onSetStatus={onSetStatus}
      ghost={isDragging}
      dragRef={setNodeRef}
      dragStyle={{ transform: CSS.Transform.toString(transform), transition }}
      handleRef={setActivatorNodeRef}
      handleProps={{ ...attributes, ...listeners }}
    />
  )
}

// Rendered inside <DragOverlay> — same card, no sortable wiring.
export function ItemCardOverlay({ item }) {
  return (
    <ul className="list-none">
      <Card item={item} overlay />
    </ul>
  )
}
