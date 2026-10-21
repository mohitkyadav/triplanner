import { useDroppable } from '@dnd-kit/core'
import { useState } from 'react'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { fmtDate } from '../lib/dates'
import { dayRouteUrl } from '../lib/maps'
import { dayCost, fmtMoney } from '../lib/money'
import { vtName } from '../lib/motion'
import { useStore } from '../lib/store'
import { daySummary, legBetween } from '../lib/timeline'
import DayMapPanel, { mappable } from './DayMapPanel'
import ItemCard from './ItemCard'
import {
  IconBed,
  IconCheck,
  IconChevronDown,
  IconMap,
  IconPencil,
  IconPlus,
  IconRoute,
  IconTrash,
  iconBtn,
  Menu,
  Modal,
  useToast,
} from './ui'
import WeatherChip from './WeatherChip'

/* One day of the trip: its header, a line that sums it up, and its plans
   as a timeline. During a trip, days already behind fold into one line
   (`folded`) until tapped. */
export default function DayCard({
  trip,
  day,
  index,
  stays = [],
  weather,
  isPast,
  isToday,
  folded,
  onUnfold,
  onEditDay,
  onAddItem,
  onEditItem,
  arrivals,
}) {
  const { dispatch } = useStore()
  const toast = useToast()
  // Makes the whole day a drop target so items can be dragged into empty days.
  const { setNodeRef, isOver } = useDroppable({ id: day.id })
  const [mapOpen, setMapOpen] = useState(false)

  function setItemStatus(itemId, status) {
    // no page transition: the circle animates itself, and taps stay quick
    dispatch({ type: 'item/update', tripId: trip.id, dayId: day.id, itemId, patch: { status }, animate: false })
  }

  function deleteDay() {
    dispatch({ type: 'day/delete', tripId: trip.id, dayId: day.id })
    toast(`Day ${index + 1} deleted`, {
      label: 'Undo',
      onClick: () => dispatch({ type: 'day/add', tripId: trip.id, day }),
    })
  }

  const cost = dayCost(trip, day)
  // "3 stops · 09:50–13:30 · 6.4 km · €62", then where you sleep
  const summary = [daySummary(day), cost > 0 && fmtMoney(cost, trip.currency)].filter(Boolean).join(' · ')
  const routeUrl = dayRouteUrl(trip, day)
  const section = {
    id: `day-${day.id}`,
    'data-day': day.id,
    style: { viewTransitionName: vtName('day', day.id) },
  }

  if (folded) {
    const done = day.items.filter(i => i.status === 'done').length
    const all = day.items.filter(i => i.status !== 'skipped').length
    return (
      <section {...section} className="scroll-mt-28">
        <button
          onClick={onUnfold}
          className="flex w-full items-center gap-2 rounded-xl px-1 py-1.5 text-left transition hover:bg-slate-100 dark:hover:bg-slate-900"
          aria-expanded="false"
          aria-label={`Day ${index + 1}, ${done} of ${all} done — show its plans`}
        >
          <span className="shrink-0 font-bold text-slate-500 dark:text-slate-400">Day {index + 1}</span>
          {day.date && <span className="shrink-0 text-sm text-slate-400 dark:text-slate-500">{fmtDate(day.date)}</span>}
          {day.title && (
            <span className="min-w-0 truncate text-sm text-slate-400 dark:text-slate-500">· {day.title}</span>
          )}
          <span className="flex-1" />
          {all > 0 && (
            <span
              className={`inline-flex shrink-0 items-center gap-1 text-xs font-semibold ${
                done === all ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400 dark:text-slate-500'
              }`}
            >
              {done === all && <IconCheck className="size-3.5" />}
              {done} of {all} done
            </span>
          )}
          <IconChevronDown className="size-4 shrink-0 text-slate-400" />
        </button>
      </section>
    )
  }

  return (
    <section
      {...section}
      className={`scroll-mt-28 transition-opacity duration-300 ${isPast ? 'opacity-55 focus-within:opacity-100 hover:opacity-100' : ''}`}
    >
      <div className={`flex items-center gap-2 px-1 ${summary || stays.length ? 'mb-0.5' : 'mb-2.5'}`}>
        <h2 className="shrink-0 whitespace-nowrap text-lg font-bold">Day {index + 1}</h2>
        {day.date && (
          <span className="shrink-0 whitespace-nowrap text-sm font-medium text-slate-500 dark:text-slate-400">
            {fmtDate(day.date)}
          </span>
        )}
        {isToday && (
          <span className="shrink-0 rounded-full bg-accent px-2 py-0.5 text-[11px] font-bold tracking-wide text-brand">
            Today
          </span>
        )}
        {day.title && (
          <span className="min-w-0 truncate text-sm text-slate-400 dark:text-slate-500">· {day.title}</span>
        )}
        <span className="min-w-0 flex-1" />
        <WeatherChip day={weather} />
        {mappable(day).length > 0 && (
          <button
            className={iconBtn}
            onClick={() => setMapOpen(true)}
            aria-label="Map of the day"
            title="Map of the day"
          >
            <IconMap className="size-4" />
          </button>
        )}
        {/* the rest in a menu, so the header fits a narrow phone */}
        <Menu
          label="More day actions"
          items={[
            { label: 'Edit day', icon: IconPencil, onClick: onEditDay },
            ...(routeUrl
              ? [
                  {
                    label: 'Day route in Google Maps',
                    icon: IconRoute,
                    onClick: () => window.open(routeUrl, '_blank', 'noopener,noreferrer'),
                  },
                ]
              : []),
            { label: 'Delete day', icon: IconTrash, onClick: deleteDay, danger: true },
          ]}
        />
      </div>
      {(summary || stays.length > 0) && (
        <p className="mb-2.5 flex flex-wrap items-center gap-x-1.5 px-1 text-xs font-medium tabular-nums text-slate-400 dark:text-slate-500">
          {summary && <span>{summary}</span>}
          {stays.map(name => (
            <span
              key={name}
              className="inline-flex items-center gap-1 text-violet-600 dark:text-violet-300"
              title={`Staying at ${name}`}
            >
              {summary && <span className="text-slate-300 dark:text-slate-600">·</span>}
              <IconBed className="size-3.5" />
              {name}
            </span>
          ))}
        </p>
      )}

      <div
        ref={setNodeRef}
        className={`-m-1 rounded-2xl p-1 transition-colors ${
          isOver && day.items.length === 0 ? 'bg-brand-100/70 dark:bg-brand-500/10' : ''
        }`}
      >
        <SortableContext items={day.items.map(i => i.id)} strategy={verticalListSortingStrategy}>
          {day.items.length > 0 && (
            <ul>
              {day.items.map((item, i) => (
                <ItemCard
                  key={item.id}
                  trip={trip}
                  item={item}
                  leg={i < day.items.length - 1 ? legBetween(item, day.items[i + 1]) : null}
                  first={i === 0}
                  last={i === day.items.length - 1}
                  onEdit={() => onEditItem(item)}
                  onSetStatus={status => setItemStatus(item.id, status)}
                  arrivals={arrivals}
                />
              ))}
            </ul>
          )}
        </SortableContext>

        {day.items.length === 0 ? (
          <button
            onClick={onAddItem}
            style={{ viewTransitionName: vtName('add', day.id) }}
            className="flex w-full items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-slate-200 px-3 py-2.5 text-sm font-medium text-slate-500 transition hover:border-brand-400 hover:text-brand-600 dark:border-slate-800 dark:text-slate-400 dark:hover:border-brand-500 dark:hover:text-brand-300"
          >
            <IconPlus className="size-4" />
            Plan this day — flight, hotel, places…
          </button>
        ) : (
          // a light "add" at the end of the line, under the cards
          <button
            onClick={onAddItem}
            style={{ viewTransitionName: vtName('add', day.id) }}
            className="ml-[5.75rem] mt-0.5 inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-[13px] font-semibold text-brand-600 transition hover:bg-brand-50 sm:ml-[6.25rem] dark:text-brand-300 dark:hover:bg-brand-500/10"
            aria-label={`Add a plan to day ${index + 1}`}
          >
            <IconPlus className="size-4" />
            Add
          </button>
        )}
      </div>
      {mapOpen && (
        <Modal title={`Day ${index + 1} on the map`} onClose={() => setMapOpen(false)}>
          <DayMapPanel
            trip={trip}
            days={[day]}
            className="h-[52dvh]"
            routeUrl={routeUrl}
            onStatus={(item, status) => setItemStatus(item.id, status)}
            onEdit={item => onEditItem(item)}
          />
        </Modal>
      )}
    </section>
  )
}
