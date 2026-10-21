import { useState } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { airlineFromFlightNo, flightTrackerUrl } from '../lib/airlines'
import { airportCity, catById, flightCodes, titleFor } from '../lib/categories'
import { placeLinks } from '../lib/maps'
import { costCurrency, fmtMoney } from '../lib/money'
import { vtName } from '../lib/motion'
import { fmtClock, fmtDuration, endOf, startOf } from '../lib/schedule'
import { fmtKm } from '../lib/timeline'
import AirlineLogo from './AirlineLogo'
import CategoryIcon from './CategoryIcon'
import {
  IconAlert,
  IconCheck,
  IconCheckCircle,
  IconCircle,
  IconGrip,
  IconHourglass,
  IconNavigation,
  IconPaperclip,
  IconRadar,
  IconXCircle,
  PopIcon,
  Strike,
} from './ui'

/* One plan on the day's timeline: its time on the left, a dot in its
   category's colour on the line, and a slim card with what it is, where,
   and what it costs. Under it, what lies before the next stop — free time
   or an overlap, and how far it is.

   Dragging: a long press anywhere on the card on a phone; the grip that
   shows on hover with a mouse; the grip and arrow keys from a keyboard. */

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

// The address part of a picked place: "Red Fort, Netaji Subhash Marg, Delhi"
// under "Red fort" reads "Netaji Subhash Marg, Delhi".
function whereOf(item, title) {
  const label = item.geo?.label
  if (label) {
    const [first, ...rest] = label.split(', ')
    const same = first.toLowerCase().includes(title.toLowerCase()) || title.toLowerCase().includes(first.toLowerCase())
    return same && rest.length ? rest.join(', ') : label
  }
  const place = String(item.place ?? '').trim()
  return place && !/^https?:\/\//i.test(place) ? place : ''
}

function Leg({ leg }) {
  const { gap, km } = leg
  const parts = []
  if (gap?.kind === 'clash') {
    return (
      <span className="inline-flex items-center gap-1 text-rose-600 dark:text-rose-400">
        <IconAlert className="size-3" />
        {gap.minutes === 0 ? 'same time' : `overlaps ${fmtDuration(gap.minutes)}`}
        {km != null && <span className="text-slate-400 dark:text-slate-500">· {fmtKm(km)}</span>}
      </span>
    )
  }
  if (gap?.minutes > 0) parts.push(`${fmtDuration(gap.minutes)} ${gap.kind === 'free' ? 'free' : 'later'}`)
  if (km != null) parts.push(fmtKm(km))
  if (!parts.length) return null
  return (
    <span className="inline-flex items-center gap-1">
      <IconHourglass className="size-3" />
      {parts.join(' · ')}
    </span>
  )
}

function Card({
  trip,
  item,
  leg,
  first = true,
  last = true,
  onEdit,
  onSetStatus,
  ghost,
  overlay,
  arrived,
  dragRef,
  dragStyle,
  rowProps,
  handleRef,
  handleProps,
}) {
  const cat = catById(item.type)
  const title = titleFor(item)
  const status = STATUS_UI[item.status] ?? STATUS_UI.planned
  const skipped = item.status === 'skipped'
  const airline = item.type === 'flight' ? airlineFromFlightNo(item.flightNo) : null
  const tracker = item.type === 'flight' ? flightTrackerUrl(item.flightNo) : null
  const links = item.type === 'flight' ? null : placeLinks(trip, item)
  const directions = links && (links.kind === 'link' ? links.url : links.google)
  const docs = item.attachments?.length ?? 0

  const start = startOf(item)
  const end = endOf(item)

  // What it is beyond its name and icon, in one line.
  const meta = []
  if (item.type === 'flight') {
    if (airline) meta.push(airline.name)
    // The title has the codes (FRA → DEL); here the cities, or the codes
    // when the plan has a label of its own.
    const cities = [airportCity(item.from), airportCity(item.to)]
    if (item.title) meta.push(flightCodes(item))
    else if (cities.every(Boolean) && cities.join() !== flightCodes(item).split(' → ').join())
      meta.push(cities.join(' → '))
  } else {
    if (item.type === 'hotel') meta.push(item.hotelAction === 'check-out' ? 'Check-out' : 'Check-in')
    const where = whereOf(item, title)
    if (where) meta.push(where)
  }

  const done = item.status === 'done'
  // A done plan's dot turns into a green check.
  const dot = done ? (
    <span className="grid size-8 place-items-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-400/15 dark:text-emerald-400">
      <IconCheck key="done" className="anim-pop size-4" />
    </span>
  ) : (
    <span className={`grid size-8 place-items-center rounded-full ${cat.badge}`}>
      <CategoryIcon type={item.type} className="size-4" />
    </span>
  )

  // The card opens with Enter or Space too; keys pressed on the buttons and
  // links inside it stay theirs.
  const onKeyDown = e => {
    if (e.target !== e.currentTarget || (e.key !== 'Enter' && e.key !== ' ')) return
    e.preventDefault()
    onEdit?.()
  }

  return (
    <li
      ref={dragRef}
      id={overlay ? undefined : `plan-${item.id}`}
      {...rowProps}
      style={
        overlay ? dragStyle : { ...dragStyle, viewTransitionName: vtName('plan', item.id), viewTransitionClass: 'plan' }
      }
      className={`group/plan grid scroll-mt-40 select-none grid-cols-[2.25rem_2rem_minmax(0,1fr)] sm:grid-cols-[2.75rem_2rem_minmax(0,1fr)] gap-x-2.5 [-webkit-touch-callout:none] [touch-action:manipulation] ${
        ghost ? 'opacity-40' : ''
      } ${skipped ? 'opacity-60' : ''}`}
    >
      {/* the time, on the left of the line */}
      <span className="row-start-1 pt-2.5 text-right tabular-nums leading-tight">
        {start != null && (
          <span className="block text-xs font-semibold text-slate-700 sm:text-[13px] dark:text-slate-200">
            {fmtClock(start)}
          </span>
        )}
        {end != null && end !== start && (
          <span className="block text-xs font-semibold text-slate-400 sm:text-[13px] dark:text-slate-500">
            {fmtClock(end % 1440)}
            {/* the next day */}
            {end >= 1440 && (
              <span className="block text-[10px] font-bold leading-none text-amber-600 dark:text-amber-400">
                +1 day
              </span>
            )}
          </span>
        )}
      </span>

      {/* the line, with this plan's dot on it */}
      <span className="relative row-span-2 flex justify-center">
        {!overlay && (
          <span
            aria-hidden="true"
            className="absolute left-1/2 w-0.5 -translate-x-1/2 rounded-full bg-slate-200 dark:bg-slate-800"
            style={{ top: first ? '1.5rem' : 0, bottom: last ? 'calc(100% - 1.5rem)' : 0 }}
          />
        )}
        <span className="relative mt-1.5 rounded-full ring-4 ring-slate-50 dark:ring-slate-950">
          {airline && !done ? (
            <AirlineLogo iata={airline.iata} name={airline.name} className="size-8 rounded-full" fallback={dot} />
          ) : (
            dot
          )}
        </span>
      </span>

      {/* the card */}
      <div
        className={`card-focus col-start-3 row-start-1 flex min-w-0 items-start gap-1 rounded-xl bg-white py-2 pl-3 pr-1.5 ring-1 dark:bg-slate-900 ${
          overlay
            ? 'anim-lift shadow-2xl ring-brand-400 dark:ring-brand-500'
            : 'shadow-sm ring-slate-200 dark:ring-slate-800'
        } ${arrived ? 'anim-arrive' : ''}`}
      >
        <div
          className="card-hit min-w-0 flex-1 cursor-pointer rounded-lg py-0.5"
          onClick={onEdit}
          onKeyDown={onKeyDown}
          role="button"
          tabIndex={overlay ? -1 : 0}
          aria-label={`Edit ${title}`}
        >
          <span className="block truncate font-medium">
            <Strike on={skipped}>{title}</Strike>
          </span>
          {(meta.length > 0 || Number.isFinite(item.cost) || docs > 0 || tracker || directions) && (
            <span className="mt-0.5 flex min-w-0 items-center gap-x-1.5 text-xs text-slate-500 dark:text-slate-400">
              {meta.length > 0 && <span className="min-w-0 truncate">{meta.join(' · ')}</span>}
              {Number.isFinite(item.cost) && (
                <span className="shrink-0 font-semibold tabular-nums text-slate-600 dark:text-slate-300">
                  {meta.length > 0 && <span className="mr-1.5 font-normal text-slate-300 dark:text-slate-600">·</span>}
                  {fmtMoney(item.cost, costCurrency(trip, item))}
                  {item.paid && <span className="ml-1 font-medium text-emerald-600 dark:text-emerald-400">paid</span>}
                </span>
              )}
              {docs > 0 && (
                <span
                  className="inline-flex shrink-0 items-center gap-0.5"
                  title={`${docs} document${docs === 1 ? '' : 's'}`}
                >
                  <IconPaperclip className="size-3.5" />
                  {docs}
                </span>
              )}
              {tracker && (
                <a
                  href={tracker}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={e => e.stopPropagation()}
                  className="inline-flex shrink-0 items-center gap-1 font-semibold text-brand-600 hover:underline dark:text-brand-300"
                >
                  <IconRadar className="size-3.5" />
                  Track
                </a>
              )}
            </span>
          )}
          {item.notes && (
            <span className="mt-1 line-clamp-1 text-[13px] text-slate-500 dark:text-slate-400">{item.notes}</span>
          )}
        </div>

        {directions && (
          <a
            href={directions}
            target="_blank"
            rel="noopener noreferrer"
            onClick={e => e.stopPropagation()}
            className="shrink-0 rounded-full p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-brand-600 dark:text-slate-500 dark:hover:bg-slate-800 dark:hover:text-brand-300"
            aria-label={`Directions to ${title}`}
            title="Directions"
          >
            <IconNavigation className="size-4" />
          </a>
        )}
        <button
          onClick={e => {
            e.stopPropagation()
            onSetStatus?.(STATUS_CYCLE[item.status])
          }}
          className={`shrink-0 rounded-full p-1 transition ${status.cls}`}
          aria-label={status.label}
          title={status.label}
        >
          <PopIcon icon={status.icon} state={item.status} className="size-5.5" />
        </button>
        {/* with a mouse the grip shows on hover; on a phone, long-press the card */}
        <button
          ref={handleRef}
          {...handleProps}
          className="-ml-0.5 mt-1 shrink-0 cursor-grab rounded p-0.5 text-slate-300 opacity-0 transition group-hover/plan:opacity-100 focus-visible:opacity-100 active:cursor-grabbing pointer-coarse:hidden dark:text-slate-600"
          aria-label="Reorder"
        >
          <IconGrip className="size-4" />
        </button>
      </div>

      {/* what lies before the next stop */}
      {!last && leg && (
        <span className="col-start-3 row-start-2 flex items-center px-3 py-1.5 text-[11px] font-semibold text-slate-400 dark:text-slate-500">
          <Leg leg={leg} />
        </span>
      )}
      {!last && !leg && <span className="col-start-3 row-start-2 h-2" />}
    </li>
  )
}

export default function ItemCard({ trip, item, leg, first, last, onEdit, onSetStatus, arrivals }) {
  const [arrived] = useState(() => Boolean(arrivals?.current))
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
  })
  // A long press anywhere on the row drags on touch; the grip does with a
  // mouse and from the keyboard.
  const { onTouchStart, ...handleListeners } = listeners ?? {}
  return (
    <Card
      trip={trip}
      item={item}
      leg={leg}
      first={first}
      last={last}
      onEdit={onEdit}
      onSetStatus={onSetStatus}
      arrived={arrived}
      ghost={isDragging}
      dragRef={setNodeRef}
      dragStyle={{ transform: CSS.Transform.toString(transform), transition }}
      rowProps={{ onTouchStart }}
      handleRef={setActivatorNodeRef}
      handleProps={{ ...attributes, ...handleListeners }}
    />
  )
}

// Rendered inside <DragOverlay> — same card, no sortable wiring.
export function ItemCardOverlay({ trip, item }) {
  return (
    <ul className="list-none">
      <Card trip={trip} item={item} overlay />
    </ul>
  )
}
