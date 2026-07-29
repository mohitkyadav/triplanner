import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { fmtDate } from '../lib/dates'
import { dayCost, fmtMoney } from '../lib/money'
import { dayRouteUrl } from '../lib/route'
import { useStore } from '../lib/store'
import ItemCard from './ItemCard'
import { IconBed, IconPencil, IconPlus, IconRoute, IconTrash, iconBtn, useToast } from './ui'

export default function DayCard({ trip, day, index, stays = [], isPast, isToday, onEditDay, onAddItem, onEditItem }) {
  const { dispatch } = useStore()
  const toast = useToast()
  // Makes the whole day a drop target so items can be dragged into empty days.
  const { setNodeRef, isOver } = useDroppable({ id: day.id })

  function setItemStatus(itemId, status) {
    dispatch({ type: 'item/update', tripId: trip.id, dayId: day.id, itemId, patch: { status } })
  }

  function deleteDay() {
    dispatch({ type: 'day/delete', tripId: trip.id, dayId: day.id })
    toast(`Day ${index + 1} deleted`, {
      label: 'Undo',
      onClick: () => dispatch({ type: 'day/add', tripId: trip.id, day }),
    })
  }

  const cost = dayCost(day)
  const routeUrl = dayRouteUrl(trip, day)

  return (
    <section
      id={`day-${day.id}`}
      className={`scroll-mt-18 transition-opacity duration-300 ${isPast ? 'opacity-55 focus-within:opacity-100 hover:opacity-100' : ''}`}
    >
      <div className="mb-2.5 flex items-center gap-2 px-1">
        <h2 className="text-lg font-bold">Day {index + 1}</h2>
        {day.date && (
          <span className="text-sm font-medium text-slate-500 dark:text-slate-400">{fmtDate(day.date)}</span>
        )}
        {isToday && (
          <span className="rounded-full bg-accent px-2 py-0.5 text-[11px] font-bold tracking-wide text-brand">
            Today
          </span>
        )}
        {day.title && (
          <span className="min-w-0 truncate text-sm text-slate-400 dark:text-slate-500">· {day.title}</span>
        )}
        <span className="flex-1" />
        {cost > 0 && (
          <span className="text-xs font-semibold tabular-nums text-slate-400 dark:text-slate-500">
            {fmtMoney(cost, trip.currency)}
          </span>
        )}
        {routeUrl && (
          <a
            className={iconBtn}
            href={routeUrl}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Open the day route in Google Maps"
            title="Day route in Google Maps"
          >
            <IconRoute className="size-4" />
          </a>
        )}
        <button className={iconBtn} onClick={onEditDay} aria-label="Edit day">
          <IconPencil className="size-4" />
        </button>
        <button className={iconBtn} onClick={deleteDay} aria-label="Delete day">
          <IconTrash className="size-4" />
        </button>
      </div>

      {stays.map(name => (
        <div
          key={name}
          className="mb-2 flex items-center gap-2.5 rounded-xl border border-dashed border-violet-300/70 bg-violet-50/60 px-3.5 py-2.5 text-sm font-medium text-violet-700 dark:border-violet-500/30 dark:bg-violet-500/5 dark:text-violet-300"
        >
          <IconBed className="size-4 shrink-0" />
          <span className="min-w-0 truncate">Staying at {name}</span>
        </div>
      ))}

      <div
        ref={setNodeRef}
        className={`-m-1 rounded-2xl p-1 transition-colors ${
          isOver && day.items.length === 0 ? 'bg-brand-100/70 dark:bg-brand-500/10' : ''
        }`}
      >
        <SortableContext items={day.items.map(i => i.id)} strategy={verticalListSortingStrategy}>
          {day.items.length > 0 && (
            <ul className="space-y-2">
              {day.items.map(item => (
                <ItemCard
                  key={item.id}
                  item={item}
                  currency={trip.currency}
                  onEdit={() => onEditItem(item)}
                  onSetStatus={status => setItemStatus(item.id, status)}
                />
              ))}
            </ul>
          )}
        </SortableContext>

        <button
          onClick={onAddItem}
          className={`${day.items.length > 0 ? 'mt-2 ' : ''}flex w-full items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-slate-200 px-3 py-2.5 text-sm font-medium text-slate-500 transition hover:border-brand-400 hover:text-brand-600 dark:border-slate-800 dark:text-slate-400 dark:hover:border-brand-500 dark:hover:text-brand-300`}
        >
          <IconPlus className="size-4" />
          {day.items.length === 0 ? 'Plan this day — flight, hotel, places…' : 'Add more'}
        </button>
      </div>
    </section>
  )
}
