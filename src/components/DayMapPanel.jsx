import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { catById, titleFor } from '../lib/categories'
import { guessSpot, placeText, useDestinationCenter } from '../lib/geo'
import { MAP_STYLES, useMapStyle } from '../lib/mapStyles'
import { costCurrency, fmtMoney } from '../lib/money'
import { useOnlineEnabled } from '../lib/online'
import { fmtTimes } from '../lib/schedule'
import { useStore } from '../lib/store'
import { DocumentChips } from './Documents'
import MapLinks from './MapLinks'
import {
  btnChip,
  btnChipBrand,
  IconCheck,
  IconCheckCircle,
  IconChevronLeft,
  IconChevronRight,
  IconExpand,
  IconLayers,
  IconMapPin,
  IconPencil,
  IconRotate,
  IconRoute,
  IconShrink,
  IconX,
  IconXCircle,
  useDismiss,
} from './ui'
import CategoryIcon from './CategoryIcon'

const DayMap = lazy(() => import('./DayMap'))

// Plans that can sit on a map: everything but flights, which span two places.
export const mappable = day => day.items.filter(i => i.type !== 'flight')

/* Plans saved before the map existed get a best guess, one lookup a second
   (Photon's fair use). Each plan is tried once per text, so a miss does not
   ask again and again; editing the plan's place tries again. */
const tried = new Set()

function useGuesses(trip, days, center) {
  const { dispatch } = useStore()
  const [on] = useOnlineEnabled()
  const todo = days.flatMap(d =>
    mappable(d)
      .filter(i => !i.geo && !tried.has(`${i.id}:${placeText(i)}:${i.place}`))
      .map(item => ({ item, dayId: d.id })),
  )
  const key = todo.map(t => t.item.id).join(',')

  useEffect(() => {
    if (!on || !center || !key) return
    const ctrl = new AbortController()
    ;(async () => {
      for (const { item, dayId } of todo) {
        if (ctrl.signal.aborted) return
        tried.add(`${item.id}:${placeText(item)}:${item.place}`)
        try {
          const geo = await guessSpot(item, center, ctrl.signal)
          if (geo && !ctrl.signal.aborted) {
            const patch = { geo }
            dispatch({ type: 'item/update', tripId: trip.id, dayId, itemId: item.id, patch, animate: false })
          }
        } catch {
          tried.delete(`${item.id}:${placeText(item)}:${item.place}`)
          return // offline or Photon is busy — try again next time the map opens
        }
        await new Promise(r => setTimeout(r, 1100))
      }
    })()
    return () => ctrl.abort()
    // `todo` follows from `key`
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [on, center, key, trip.id, dispatch])
}

// One colour per day on the trip map, in order.
export const DAY_COLORS = ['#0ea5e9', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316']

/* The map for one day — or several, as the trip map — with the card of the
   pin tapped on it. Marking a plan done here or in the list shows on both at
   once. The map can go full screen (the same map, moved), where the card
   floats over its bottom. With several days, each has its own colour, its
   own line, and a chip to show it alone.

   runningId: the plan under way now (Trip mode), drawn pulsing.
   onStatus(item, status, dayId), onEdit(item, dayId). */
/* For Trip mode's map mode: `bare` fills its box edge to edge with no
   card, credits list or route link; `selectedId`/`onSelect` share the
   picked pin with a list beside the map; `onExpand` replaces the full
   screen button's action; `focusOffset` keeps picked pins clear of a sheet. */
export default function DayMapPanel({
  trip,
  days,
  runningId,
  routeUrl,
  onStatus,
  onEdit,
  className = 'h-64',
  bare = false,
  selectedId: sharedSelected,
  onSelect: onSharedSelect,
  onExpand,
  focusOffset,
}) {
  const [on] = useOnlineEnabled()
  const center = useDestinationCenter(trip.destination)
  const [styleId, setStyleId] = useMapStyle()
  const [ownSelected, setOwnSelected] = useState(null)
  const selectedId = sharedSelected !== undefined ? sharedSelected : ownSelected
  const setSelectedId = onSharedSelect ?? setOwnSelected
  const [full, setFull] = useState(false)
  const [inlineHost, setInlineHost] = useState(null)
  const [fullHost, setFullHost] = useState(null)
  const [onlyDay, setOnlyDay] = useState(null) // trip map: one day alone
  useGuesses(trip, days, center)

  const several = days.length > 1
  // every plan with its day: which day of the trip, and its number that day
  const entries = useMemo(
    () =>
      days.flatMap(d => {
        const dayNo = trip.days.findIndex(x => x.id === d.id) + 1
        return mappable(d).map((item, i) => ({ item, dayId: d.id, dayNo, n: i + 1 }))
      }),
    [days, trip.days],
  )
  const pins = useMemo(
    () =>
      entries
        .filter(e => e.item.geo && (!onlyDay || e.dayId === onlyDay))
        .map(({ item, dayId, dayNo, n }) => ({
          id: item.id,
          n,
          title: titleFor(item),
          lat: item.geo.lat,
          lng: item.geo.lng,
          guess: Boolean(item.geo.guess),
          group: dayId,
          color: several ? DAY_COLORS[(dayNo - 1) % DAY_COLORS.length] : undefined,
          state:
            item.status === 'done' || item.status === 'skipped' ? item.status : item.id === runningId ? 'now' : 'open',
        })),
    [entries, onlyDay, several, runningId],
  )
  const missing = entries.filter(e => !e.item.geo).length
  const picked = entries.find(e => e.item.id === selectedId && e.item.geo)
  const selected = picked?.item
  const at = pins.findIndex(p => p.id === selected?.id)
  // the next or previous stop on the map, going round
  const step = by => setSelectedId(pins[(at + by + pins.length) % pins.length]?.id ?? null)

  if (!on) {
    return (
      <p className="rounded-2xl bg-white px-4 py-3 text-center text-[13px] text-slate-500 ring-1 ring-slate-200 dark:bg-slate-900 dark:text-slate-400 dark:ring-slate-800">
        The map is off with the other online extras. Turn them on at the bottom of the home screen.
      </p>
    )
  }

  const card = selected && (
    <PinCard
      trip={trip}
      item={selected}
      n={several ? `Day ${picked.dayNo} · ${picked.n}` : picked.n}
      floating={full}
      onStatus={status => onStatus(selected, status, picked.dayId)}
      onEdit={() => onEdit(selected, picked.dayId)}
      onStep={pins.length > 1 ? step : null}
      onClose={() => setSelectedId(null)}
    />
  )
  const chrome = (
    <MapButtons
      styleId={styleId}
      onStyle={setStyleId}
      full={full || bare}
      onFull={onExpand ?? (() => setFull(f => !f))}
    />
  )

  return (
    <div className={bare ? 'h-full' : 'space-y-2'}>
      {several && (
        <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-0.5 [scrollbar-width:none]">
          {[
            { id: null, label: 'All days' },
            ...days.map((d, i) => ({ id: d.id, label: `Day ${trip.days.indexOf(d) + 1}`, i })),
          ].map(chip => (
            <button
              key={chip.id ?? 'all'}
              onClick={() => {
                setOnlyDay(chip.id)
                setSelectedId(null)
              }}
              aria-pressed={onlyDay === chip.id}
              className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1 text-[13px] font-semibold transition ${
                onlyDay === chip.id
                  ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
              }`}
            >
              {chip.id && (
                <span
                  className="size-2.5 rounded-full"
                  style={{ background: DAY_COLORS[trip.days.findIndex(x => x.id === chip.id) % DAY_COLORS.length] }}
                />
              )}
              {chip.label}
            </button>
          ))}
        </div>
      )}
      <div
        className={`relative isolate overflow-hidden bg-slate-100 dark:bg-slate-900 ${
          bare ? 'h-full' : `rounded-2xl shadow-sm ring-1 ring-slate-200 dark:ring-slate-800 ${className}`
        }`}
      >
        <div ref={setInlineHost} className="absolute inset-0" />
        <Suspense
          fallback={
            <div className="grid h-full place-items-center text-sm text-slate-400 dark:text-slate-500">
              Loading the map…
            </div>
          }
        >
          <DayMap
            pins={pins}
            center={center}
            selectedId={selected?.id ?? null}
            onSelect={setSelectedId}
            styleId={styleId}
            host={full ? fullHost : inlineHost}
            focusOffset={focusOffset ?? (full && selected ? 110 : 0)}
          />
        </Suspense>
        {full ? (
          <div className="absolute inset-0 grid place-items-center text-sm text-slate-400 dark:text-slate-500">
            Showing full screen
          </div>
        ) : (
          chrome
        )}
      </div>
      {!full && !bare && card}
      {routeUrl && !bare && (
        <a className={btnChip} href={routeUrl} target="_blank" rel="noopener noreferrer">
          <IconRoute className="size-3.5" />
          The day&apos;s route in Google Maps
        </a>
      )}
      {missing > 0 && !bare && (
        <p className="px-1 text-[12px] text-slate-400 dark:text-slate-500">
          {missing === 1 ? '1 plan is' : `${missing} plans are`} not on the map yet. Open a plan to pick its place.
        </p>
      )}
      {full && (
        <FullScreen onClose={() => setFull(false)}>
          <div ref={setFullHost} className="absolute inset-0" />
          {chrome}
          {card}
        </FullScreen>
      )}
    </div>
  )
}

/* The map over the whole screen. Back, Escape or the shrink button bring it
   back to its place. Dialogs opened from it (edit, documents) open above. */
function FullScreen({ onClose, children }) {
  useDismiss(onClose)
  return createPortal(
    <div
      className="anim-backdrop fixed inset-0 z-50 bg-slate-100 dark:bg-slate-900"
      role="region"
      aria-label="Day map, full screen"
    >
      {children}
    </div>,
    document.body,
  )
}

const mapBtn =
  'grid size-[29px] place-items-center rounded-[4px] bg-white text-slate-700 shadow-[0_0_0_2px_rgba(0,0,0,0.1)] transition hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700'

// The buttons on the map's left: its look, and full screen.
function MapButtons({ styleId, onStyle, full, onFull }) {
  const [open, setOpen] = useState(false)
  return (
    // the list of looks scrolls within the map, so a small map does not cut it off
    <div className="pointer-events-none absolute inset-2.5 top-[max(0.625rem,env(safe-area-inset-top))] z-10 flex flex-col items-start gap-2 [&>*]:pointer-events-auto">
      <button
        className={mapBtn}
        onClick={onFull}
        aria-label={full ? 'Leave full screen' : 'Full screen'}
        title={full ? 'Leave full screen' : 'Full screen'}
      >
        {full ? <IconShrink className="size-4" /> : <IconExpand className="size-4" />}
      </button>
      <button
        className={mapBtn}
        onClick={() => setOpen(o => !o)}
        aria-label="Map style"
        aria-expanded={open}
        title="Map style"
      >
        <IconLayers className="size-4" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0" onClick={() => setOpen(false)} />
          <ul className="anim-menu relative min-h-0 w-52 origin-top-left overflow-y-auto overscroll-contain rounded-xl bg-white py-1 shadow-lg ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-700">
            {MAP_STYLES.map(s => (
              <li key={s.id}>
                <button
                  onClick={() => {
                    onStyle(s.id)
                    setOpen(false)
                  }}
                  className="focus-inset flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm transition hover:bg-slate-100 dark:hover:bg-slate-800"
                  aria-pressed={styleId === s.id}
                >
                  <span className="grid size-4 shrink-0 place-items-center text-brand-600 dark:text-brand-300">
                    {styleId === s.id && <IconCheck className="size-4" />}
                  </span>
                  <span className="min-w-0">
                    <span className="block font-medium">{s.label}</span>
                    {s.hint && <span className="block text-[11px] text-slate-500 dark:text-slate-400">{s.hint}</span>}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}

/* What the plan holds, for the pin tapped: below the map, or floating over
   its bottom in full screen, with steps to the stop before and after. */
function PinCard({ trip, item, n, floating, onStatus, onEdit, onStep, onClose }) {
  const cat = catById(item.type)
  const times = fmtTimes(item)
  const open = item.status !== 'done' && item.status !== 'skipped'
  const cost = Number.isFinite(item.cost) ? fmtMoney(item.cost, costCurrency(trip, item)) : ''
  return (
    <div
      className={`anim-toast rounded-2xl bg-white p-3.5 ring-1 dark:bg-slate-900 ${
        floating
          ? 'absolute inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-10 mx-auto max-w-lg shadow-2xl ring-slate-200 dark:ring-slate-700'
          : 'shadow-sm ring-slate-200 dark:ring-slate-800'
      }`}
    >
      <div className="flex items-start gap-3">
        <span className={`grid size-10 shrink-0 place-items-center rounded-xl ${cat.badge}`}>
          <CategoryIcon type={item.type} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">
            <span className="text-slate-400">{n}.</span> {titleFor(item)}
          </p>
          <p className="truncate text-xs text-slate-500 dark:text-slate-400">
            {[
              times,
              cat.label,
              cost && `${cost}${item.paid ? ' paid' : ''}`,
              item.status === 'done' && 'Done',
              item.status === 'skipped' && 'Skipped',
            ]
              .filter(Boolean)
              .join(' · ')}
          </p>
        </div>
        {onStep && (
          <span className="flex shrink-0 gap-0.5">
            <button className={mapBtnSmall} onClick={() => onStep(-1)} aria-label="The stop before">
              <IconChevronLeft className="size-4" />
            </button>
            <button className={mapBtnSmall} onClick={() => onStep(1)} aria-label="The stop after">
              <IconChevronRight className="size-4" />
            </button>
          </span>
        )}
        <button className={mapBtnSmall} onClick={onClose} aria-label="Close">
          <IconX className="size-4" />
        </button>
      </div>

      {item.geo?.label && (
        <p className="mt-2 flex items-start gap-1.5 text-[13px] text-slate-600 dark:text-slate-300">
          <IconMapPin className="mt-0.5 size-3.5 shrink-0 text-slate-400" />
          <span className="min-w-0">{item.geo.label}</span>
        </p>
      )}
      {item.geo?.guess && (
        <p className="mt-1 text-[12px] text-amber-600 dark:text-amber-400">
          Best guess. Edit the plan to pick the place.
        </p>
      )}
      {item.notes && (
        <p className="mt-2 line-clamp-3 whitespace-pre-wrap text-[13px] text-slate-600 dark:text-slate-300">
          {item.notes}
        </p>
      )}
      <DocumentChips docs={item.attachments} className="mt-2" />

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        {open ? (
          <>
            <button className={btnChipBrand} onClick={() => onStatus('done')}>
              <IconCheckCircle className="size-3.5" />
              Done
            </button>
            <button className={btnChip} onClick={() => onStatus('skipped')}>
              <IconXCircle className="size-3.5" />
              Skip
            </button>
          </>
        ) : (
          <button className={btnChip} onClick={() => onStatus(undefined)}>
            <IconRotate className="size-3.5" />
            Back to planned
          </button>
        )}
        <button className={btnChip} onClick={onEdit}>
          <IconPencil className="size-3.5" />
          Edit
        </button>
        <span className="flex-1" />
        <MapLinks trip={trip} item={item} hero />
      </div>
    </div>
  )
}

const mapBtnSmall =
  'grid size-8 place-items-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-300'
