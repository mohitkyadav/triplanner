import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import { restrictToVerticalAxis } from '@dnd-kit/modifiers'
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { fmtDate } from '../lib/dates'
import { useStore } from '../lib/store'
import ItemCard from './ItemCard'
import { IconBed, IconPencil, IconPlus, IconTrash, iconBtn } from './ui'

export default function DayCard({ trip, day, index, stays = [], onEditDay, onAddItem, onEditItem }) {
  const { dispatch } = useStore()
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  function handleDragEnd({ active, over }) {
    if (!over || active.id === over.id) return
    const from = day.items.findIndex(i => i.id === active.id)
    const to = day.items.findIndex(i => i.id === over.id)
    if (from < 0 || to < 0) return
    dispatch({ type: 'item/move', tripId: trip.id, dayId: day.id, from, to })
  }

  function deleteDay() {
    const label = `Day ${index + 1}`
    if (day.items.length === 0 || window.confirm(`Delete ${label} and its ${day.items.length} plans?`)) {
      dispatch({ type: 'day/delete', tripId: trip.id, dayId: day.id })
    }
  }

  return (
    <section>
      <div className="mb-2.5 flex items-center gap-2 px-1">
        <h2 className="text-lg font-bold">Day {index + 1}</h2>
        {day.date && (
          <span className="text-sm font-medium text-slate-500 dark:text-slate-400">{fmtDate(day.date)}</span>
        )}
        {day.title && (
          <span className="min-w-0 truncate text-sm text-slate-400 dark:text-slate-500">· {day.title}</span>
        )}
        <span className="flex-1" />
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

      {day.items.length > 0 && (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          modifiers={[restrictToVerticalAxis]}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={day.items.map(i => i.id)} strategy={verticalListSortingStrategy}>
            <ul className="space-y-2">
              {day.items.map(item => (
                <ItemCard key={item.id} item={item} onEdit={() => onEditItem(item)} />
              ))}
            </ul>
          </SortableContext>
        </DndContext>
      )}

      <button
        onClick={onAddItem}
        className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-slate-200 px-3 py-2.5 text-sm font-medium text-slate-500 transition hover:border-sky-400 hover:text-sky-600 dark:border-slate-800 dark:text-slate-400 dark:hover:border-sky-500 dark:hover:text-sky-400"
      >
        <IconPlus className="size-4" />
        {day.items.length === 0 ? 'Plan this day — flight, hotel, places…' : 'Add more'}
      </button>
    </section>
  )
}
