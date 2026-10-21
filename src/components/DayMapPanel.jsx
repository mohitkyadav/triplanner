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

function useGuesses(trip, day, center) {
  const { dispatch } = useStore()
  const [on] = useOnlineEnabled()
  const todo = mappable(day).filter(i => !i.geo && !tried.has(`${i.id}:${placeText(i)}:${i.place}`))
  const key = todo.map(i => i.id).join(',')

  useEffect(() => {
    if (!on || !center || !key) return
    const ctrl = new AbortController()
    ;(async () => {
      for (const item of todo) {
        if (ctrl.signal.aborted) return
        tried.add(`${item.id}:${placeText(item)}:${item.place}`)
        try {
          const geo = await guessSpot(item, center, ctrl.signal)
          if (geo && !ctrl.signal.aborted) {
            const patch = { geo }
            dispatch({ type: 'item/update', tripId: trip.id, dayId: day.id, itemId: item.id, patch, animate: false })
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
  }, [on, center, key, trip.id, day.id, dispatch])
}

/* The map for one day, with the card of the pin tapped on it. Marking a
   plan done here or in the list shows on both at once. The map can go full
   screen (the same map, moved), where the card floats over its bottom.

   runningId: the plan under way now (Trip mode), drawn pulsing. */
export default function DayMapPanel({ trip, day, runningId, routeUrl, onStatus, onEdit, className = 'h-64' }) {
  const [on] = useOnlineEnabled()
  const center = useDestinationCenter(trip.destination)
  const [styleId, setStyleId] = useMapStyle()
  const [selectedId, setSelectedId] = useState(null)
  const [full, setFull] = useState(false)
  const [inlineHost, setInlineHost] = useState(null)
  const [fullHost, setFullHost] = useState(null)
  useGuesses(trip, day, center)

  const items = mappable(day)
  const pins = useMemo(
    () =>
      mappable(day)
        .map((item, i) => ({ item, n: i + 1 }))
        .filter(({ item }) => item.geo)
        .map(({ item, n }) => ({
          id: item.id,
          n,
          title: titleFor(item),
          lat: item.geo.lat,
          lng: item.geo.lng,
          guess: Boolean(item.geo.guess),
          state:
            item.status === 'done' || item.status === 'skipped' ? item.status : item.id === runningId ? 'now' : 'open',
        })),
    [day, runningId],
  )
  const missing = items.filter(i => !i.geo).length
  const selected = items.find(i => i.id === selectedId && i.geo)
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
      n={pins[at]?.n}
      floating={full}
      onStatus={status => onStatus(selected, status)}
      onEdit={() => onEdit(selected)}
      onStep={pins.length > 1 ? step : null}
      onClose={() => setSelectedId(null)}
    />
  )
  const chrome = <MapButtons styleId={styleId} onStyle={setStyleId} full={full} onFull={() => setFull(f => !f)} />

  return (
    <div className="space-y-2">
      <div
        className={`relative isolate overflow-hidden rounded-2xl bg-slate-100 shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800 ${className}`}
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
            focusOffset={full && selected ? 110 : 0}
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
      {!full && card}
      {routeUrl && (
        <a className={btnChip} href={routeUrl} target="_blank" rel="noopener noreferrer">
          <IconRoute className="size-3.5" />
          The day&apos;s route in Google Maps
        </a>
      )}
      {missing > 0 && (
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
