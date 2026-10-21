import { useDroppable } from '@dnd-kit/core'
import { useState } from 'react'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { fmtDate } from '../lib/dates'
import { dayRouteUrl } from '../lib/maps'
import { dayCost, fmtMoney } from '../lib/money'
import { useStore } from '../lib/store'
import { vtName } from '../lib/motion'
import DayMapPanel, { mappable } from './DayMapPanel'
import ItemCard from './ItemCard'
import { daySummary, legBetween } from '../lib/timeline'
import { IconBed, IconMap, IconPencil, IconPlus, IconRoute, IconTrash, iconBtn, Menu, Modal, useToast } from './ui'
import WeatherChip from './WeatherChip'

export default function DayCard({
  trip,
  day,
  index,
  stays = [],
  weather,
  isPast,
  isToday,
  onEditDay,
  onAddItem,
  onEditItem,
  arrivals,
}) {
  const { dispatch } = useStore()
  const toast = useToast()
  // Makes the whole day a drop target so items can be dragged into empty days.
  const { setNodeRef, isOver } = useDroppable({ id: day.id })

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

  const [mapOpen, setMapOpen] = useState(false)
  const cost = dayCost(trip, day)
  // "3 stops · 09:50–13:30 · 6.4 km · €62"
  const summary = [daySummary(day), cost > 0 && fmtMoney(cost, trip.currency)].filter(Boolean).join(' · ')
  const routeUrl = dayRouteUrl(trip, day)

  return (
    <section
      id={`day-${day.id}`}
      style={{ viewTransitionName: vtName('day', day.id) }}
      className={`scroll-mt-18 transition-opacity duration-300 ${isPast ? 'opacity-55 focus-within:opacity-100 hover:opacity-100' : ''}`}
    >
      <div className={`flex items-center gap-2 px-1 ${summary ? 'mb-0.5' : 'mb-2.5'}`}>
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
      {summary && (
        <p className="mb-2.5 px-1 text-xs font-medium tabular-nums text-slate-400 dark:text-slate-500">{summary}</p>
      )}

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

        <button
          onClick={onAddItem}
          style={{ viewTransitionName: vtName('add', day.id) }}
          className={`${day.items.length > 0 ? 'ml-24 mt-1 w-[calc(100%-6rem)] ' : 'w-full '}flex items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-slate-200 px-3 py-2.5 text-sm font-medium text-slate-500 transition hover:border-brand-400 hover:text-brand-600 dark:border-slate-800 dark:text-slate-400 dark:hover:border-brand-500 dark:hover:text-brand-300`}
        >
          <IconPlus className="size-4" />
          {day.items.length === 0 ? 'Plan this day — flight, hotel, places…' : 'Add more'}
        </button>
      </div>
      {mapOpen && (
        <Modal title={`Day ${index + 1} on the map`} onClose={() => setMapOpen(false)}>
          <DayMapPanel
            trip={trip}
            day={day}
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
