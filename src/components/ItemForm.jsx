import { useEffect, useRef, useState } from 'react'
import { airlineFromFlightNo, callsign } from '../lib/airlines'
import { CATEGORIES } from '../lib/categories'
import { fmtDate } from '../lib/dates'
import { useFlightRoute } from '../lib/flightRoute'
import { coordsFromLink } from '../lib/geo'
import { findStay } from '../lib/stays'
import { placeLinks } from '../lib/maps'
import { reducedMotion } from '../lib/motion'
import AirlineLogo from './AirlineLogo'
import { DocumentList } from './Documents'
import { PlaceSpot, PlaceSuggestions } from './PlacePicker'
import {
  btnChip,
  btnDanger,
  btnGhost,
  btnPrimary,
  Field,
  IconCheckCircle,
  IconCircle,
  IconBed,
  IconXCircle,
  inputCls,
  Modal,
  PickerInput,
  Segmented,
  useToast,
} from './ui'
import CategoryIcon from './CategoryIcon'

const NOTE_HINTS = {
  restaurant: 'What to eat, must-try dishes, reservation info…',
  flight: 'Terminal, seat, booking reference…',
  hotel: 'Booking reference, address, breakfast times…',
  museum: 'Exhibitions to see, ticket info…',
  work: 'Meetings, calls, focus blocks…',
}

const dayName = (day, i) => [`Day ${i + 1}`, day.date && fmtDate(day.date), day.title].filter(Boolean).join(' · ')

/* onSave(item, toDayId, stay) — `toDayId` is the day the plan belongs on,
   which the form lets the user change ("Move to day…") when `days` is given.
   A hotel is a whole stay: `stay` is { checkIn: { dayId, time }, checkOut:
   { dayId, time } | null } and the caller saves both plans (lib/stays.js). */
export default function ItemForm({ initial, dayLabel, trip, days: givenDays, dayId, onSave, onDelete, onClose }) {
  const toast = useToast()
  const editing = Boolean(initial?.id)
  const days = givenDays ?? trip?.days ?? []
  // A hotel plan opens its whole stay; a check-out opens with its check-in's
  // details (name, cost, documents live there).
  const [stay] = useState(() => (initial?.type === 'hotel' && trip ? findStay(trip, initial) : null))
  const start = stay?.in?.item ?? initial
  const [type, setType] = useState(start?.type ?? 'landmark')
  const [status, setStatus] = useState(start?.status ?? 'planned')
  const [targetDay, setTargetDay] = useState(dayId)
  const [docs, setDocs] = useState(start?.attachments ?? [])
  const [spot, setSpot] = useState(start?.geo ?? null) // where it shows on the day map
  // The field place suggestions follow: the name or the map text, whichever
  // was typed in last; none once another field is in use.
  const [searchIn, setSearchIn] = useState(null)
  const nameRef = useRef(null)
  const [f, setF] = useState({
    title: start?.title ?? '',
    time: start?.time ?? '',
    endTime: start?.endTime ?? '',
    cost: start?.cost != null ? String(start.cost) : '',
    currency: start?.currency ?? '',
    paid: Boolean(start?.paid),
    paidBy: start?.paidBy ?? '',
    place: start?.place ?? '',
    notes: start?.notes ?? '',
    flightNo: start?.flightNo ?? '',
    from: start?.from ?? '',
    to: start?.to ?? '',
  })
  // A stay: the day and time of the check-in and of the check-out ('' for
  // none yet). A new stay checks out the next day, when there is one.
  const dayAt = i => days[i]?.id ?? ''
  const indexOf = id => days.findIndex(d => d.id === id)
  const [stayIn, setStayIn] = useState(() => ({
    dayId: stay?.in?.dayId ?? (initial?.hotelAction === 'check-out' ? dayAt(Math.max(0, indexOf(dayId) - 1)) : dayId),
    time: stay?.in?.item.time ?? '',
  }))
  const [stayOut, setStayOut] = useState(() => ({
    dayId: stay?.out?.dayId ?? (editing ? '' : dayAt(indexOf(dayId) + 1)),
    time: stay?.out?.item.time ?? '',
  }))
  const nights = stayOut.dayId ? indexOf(stayOut.dayId) - indexOf(stayIn.dayId) : 0
  function moveCheckIn(id) {
    setStayIn(prev => ({ ...prev, dayId: id }))
    // a check-out on or before the new check-in day moves to the day after
    if (stayOut.dayId && indexOf(stayOut.dayId) <= indexOf(id))
      setStayOut(prev => ({ ...prev, dayId: dayAt(indexOf(id) + 1) }))
  }

  // The flight number whose usual route has been looked at.
  const [routeFor, setRouteFor] = useState(null)
  const [filled, setFilled] = useState(null) // the route the airports were filled from
  const [typing, setTyping] = useState(null) // the route being typed into From and To
  const set = k => e => {
    if (k === 'from' || k === 'to') setTyping(null) // a person typing takes over
    setF(prev => ({ ...prev, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }))
  }

  // A filled-in route types itself into From and To, a letter at a time.
  useEffect(() => {
    if (!typing) return
    const longest = Math.max(typing.from.length, typing.to.length)
    let n = 0
    const timer = setInterval(() => {
      n += 1
      setF(prev => ({ ...prev, from: typing.from.slice(0, n), to: typing.to.slice(0, n) }))
      if (n >= longest) {
        clearInterval(timer)
        setTyping(null)
      }
    }, 28)
    return () => clearInterval(timer)
  }, [typing])

  const travellers = trip?.travellers ?? []

  function submit(e) {
    e.preventDefault()
    const cost = parseFloat(f.cost.replace(',', '.'))
    const hasCost = Number.isFinite(cost) && cost > 0
    const currency = f.currency.trim().toUpperCase()
    const item = {
      type,
      title: f.title.trim(),
      time: f.time,
      endTime: type === 'hotel' ? '' : f.endTime,
      cost: hasCost ? Math.round(cost * 100) / 100 : undefined,
      currency: hasCost && currency && currency !== trip?.currency ? currency : undefined,
      paid: hasCost && f.paid ? true : undefined,
      paidBy: hasCost && travellers.includes(f.paidBy) ? f.paidBy : undefined,
      place: f.place.trim(),
      notes: f.notes.trim(),
      status: status === 'planned' ? undefined : status,
      attachments: docs.length ? docs : undefined,
      geo: type === 'flight' ? undefined : (coordsFromLink(f.place) ?? spot ?? undefined),
      // fields an older version wrote, dropped on the next save
      mapsUrl: undefined,
      direction: undefined,
      location: undefined,
    }
    if (type === 'flight') {
      item.flightNo = f.flightNo.trim()
      item.from = f.from.trim()
      item.to = f.to.trim()
    }
    if (type === 'hotel') {
      item.hotelAction = 'check-in'
      item.time = stayIn.time
      return onSave(item, stayIn.dayId, { checkIn: stayIn, checkOut: stayOut.dayId ? stayOut : null })
    }
    onSave(item, targetDay)
  }

  const titleLabel = type === 'flight' ? 'Label (optional)' : type === 'hotel' ? 'Hotel name' : 'Name'
  const titlePlaceholder =
    type === 'flight' ? 'e.g. Off to Lisbon' : type === 'hotel' ? 'e.g. Hotel Alfama' : 'e.g. Louvre Museum'
  const airline = type === 'flight' ? airlineFromFlightNo(f.flightNo) : null
  const mappable = type !== 'flight'
  const linked = Boolean(coordsFromLink(f.place))
  const searching = mappable && !spot && !linked
  function pick(picked, place) {
    setSpot(picked)
    // a plan picked from the suggestions before it had a name takes the place's
    if (!f.title.trim()) setF(prev => ({ ...prev, title: place.name }))
  }
  // Drops the spot and goes back to the name, where suggestions show again.
  function pickAgain() {
    setSpot(null)
    nameRef.current?.focus()
  }
  const route = useFlightRoute(type === 'flight' ? f.flightNo : '')
  const code = callsign(f.flightNo)
  const shows = r => r && f.from === r.from && f.to === r.to
  // A new number with a known route fills the airports when they are empty or
  // still what an earlier number filled in. Typed airports are never
  // overwritten; the route is offered next to them instead.
  if (route && code !== routeFor) {
    setRouteFor(code)
    const free = (!f.from.trim() && !f.to.trim()) || shows(filled)
    if (free && reducedMotion()) setF(prev => ({ ...prev, from: route.from, to: route.to }))
    else if (free) setTyping(route)
    setFilled(free ? route : null)
  }
  // What the map buttons will do, shown live under the field.
  const mapHint =
    placeLinks(trip, { type, title: f.title, from: f.from, to: f.to, place: f.place, geo: spot ?? undefined }) ?? {}
  const otherDays = days && days.length > 1

  const costFields = (
    <div className="space-y-3">
      <div className="grid grid-cols-[1fr_5.5rem] gap-3">
        <Field label="Cost (optional)">
          <input
            className={inputCls}
            value={f.cost}
            onChange={set('cost')}
            placeholder="0"
            inputMode="decimal"
            pattern="[0-9]*[.,]?[0-9]*"
          />
        </Field>
        <Field label="Currency">
          <input
            className={`${inputCls} uppercase`}
            value={f.currency}
            onChange={set('currency')}
            placeholder={trip?.currency || 'EUR'}
            maxLength={3}
            autoCapitalize="characters"
            aria-label="Cost currency"
          />
        </Field>
      </div>
      {f.cost && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <label className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 dark:text-slate-300">
            <input type="checkbox" checked={f.paid} onChange={set('paid')} className="size-4 accent-brand-600" />
            Already paid
          </label>
          {travellers.length > 0 && (
            <label className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 dark:text-slate-300">
              Paid by
              <select
                className="rounded-lg bg-slate-100 px-2 py-1 text-sm dark:bg-slate-800"
                value={f.paidBy}
                onChange={set('paidBy')}
              >
                <option value="">Nobody yet</option>
                {travellers.map(t => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
      )}
    </div>
  )

  return (
    <Modal title={editing ? (type === 'hotel' ? 'Edit stay' : 'Edit plan') : `Add to ${dayLabel}`} onClose={onClose}>
      <form
        onSubmit={submit}
        className="space-y-4"
        onFocusCapture={e => {
          const field = e.target.dataset?.search
          if (field) setSearchIn(field)
          else if (e.target.matches('input, select, textarea')) setSearchIn(null)
        }}
      >
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-5" role="radiogroup" aria-label="Kind of plan">
          {CATEGORIES.map(c => (
            <button
              type="button"
              key={c.id}
              role="radio"
              aria-checked={type === c.id}
              onClick={() => setType(c.id)}
              className={`flex flex-col items-center gap-1 rounded-xl px-1 py-2 text-center transition ${
                type === c.id
                  ? 'bg-brand-50 ring-2 ring-brand-500 dark:bg-brand-500/10'
                  : 'ring-1 ring-slate-200 hover:bg-slate-50 dark:ring-slate-700 dark:hover:bg-slate-800'
              }`}
            >
              <CategoryIcon
                type={c.id}
                className={`size-6 transition-colors ${type === c.id ? 'text-brand-600 dark:text-brand-300' : 'text-slate-500 dark:text-slate-400'}`}
              />
              <span className="text-[11px] font-medium text-slate-600 dark:text-slate-300">{c.label}</span>
            </button>
          ))}
        </div>

        {type === 'flight' && (
          <>
            <Field label="Flight number">
              <input className={inputCls} value={f.flightNo} onChange={set('flightNo')} placeholder="LH 1178" />
            </Field>
            {airline && (
              <div className="-mt-2 flex items-center gap-2 text-[13px] font-medium text-slate-500 dark:text-slate-400">
                <AirlineLogo
                  key={airline.iata}
                  iata={airline.iata}
                  name={airline.name}
                  className="anim-pop size-6 rounded-md"
                  fallback={<span className="text-base leading-none">✈️</span>}
                />
                {airline.name}
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <Field label="From">
                <input className={inputCls} value={f.from} onChange={set('from')} placeholder="Berlin BER" />
              </Field>
              <Field label="To">
                <input className={inputCls} value={f.to} onChange={set('to')} placeholder="Lisbon LIS" />
              </Field>
              <Field label="Departs">
                <PickerInput type="time" value={f.time} onChange={set('time')} />
              </Field>
              <Field label="Arrives">
                <PickerInput type="time" value={f.endTime} onChange={set('endTime')} />
              </Field>
            </div>
            {route && !typing && !shows(route) && (
              <button
                type="button"
                className={btnChip}
                onClick={() => {
                  setTyping(reducedMotion() ? null : route)
                  if (reducedMotion()) setF(prev => ({ ...prev, from: route.from, to: route.to }))
                  setFilled(route)
                }}
              >
                Use {route.from} → {route.to}
              </button>
            )}
            {(typing || shows(filled)) && (
              <p className="-mt-2.5 text-[13px] text-slate-400 dark:text-slate-500">
                Filled in from this flight’s usual route (adsbdb.com). Check it against your booking, and add the times
                yourself.
              </p>
            )}
          </>
        )}

        <Field label={titleLabel}>
          <input
            ref={nameRef}
            data-search="title"
            className={inputCls}
            value={f.title}
            onChange={set('title')}
            placeholder={titlePlaceholder}
            required={type !== 'flight'}
            autoFocus={editing ? undefined : type !== 'flight'}
          />
        </Field>
        {mappable && <PlaceSpot spot={spot} linked={linked} onClear={pickAgain} />}
        {searching && searchIn === 'title' && <PlaceSuggestions trip={trip} text={f.title} onPick={pick} />}

        {type === 'hotel' && (
          <div className="space-y-3">
            <div className="grid grid-cols-[minmax(0,1fr)_7.5rem] gap-3">
              <Field label="Check-in">
                <select className={inputCls} value={stayIn.dayId} onChange={e => moveCheckIn(e.target.value)}>
                  {days.map((d, i) => (
                    <option key={d.id} value={d.id}>
                      {dayName(d, i)}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Time">
                <PickerInput
                  type="time"
                  value={stayIn.time}
                  onChange={e => setStayIn(prev => ({ ...prev, time: e.target.value }))}
                  aria-label="Check-in time"
                />
              </Field>
              <Field label="Check-out">
                <select
                  className={inputCls}
                  value={stayOut.dayId}
                  onChange={e => setStayOut(prev => ({ ...prev, dayId: e.target.value }))}
                >
                  <option value="">Not set yet</option>
                  {days.map((d, i) =>
                    i > indexOf(stayIn.dayId) ? (
                      <option key={d.id} value={d.id}>
                        {dayName(d, i)}
                      </option>
                    ) : null,
                  )}
                </select>
              </Field>
              <Field label="Time">
                <PickerInput
                  type="time"
                  value={stayOut.time}
                  onChange={e => setStayOut(prev => ({ ...prev, time: e.target.value }))}
                  disabled={!stayOut.dayId}
                  aria-label="Check-out time"
                />
              </Field>
            </div>
            <p className="-mt-1 flex items-center gap-1.5 text-[13px] text-slate-400 dark:text-slate-500">
              <IconBed className="size-3.5 shrink-0" />
              {nights > 0
                ? `${nights} night${nights === 1 ? '' : 's'} — the check-out shows on its day too.`
                : 'Add the check-out day and it shows on that day too.'}
            </p>
          </div>
        )}
        {type !== 'flight' && type !== 'hotel' && (
          <div className="grid grid-cols-2 gap-3">
            <Field label="Starts (optional)">
              <PickerInput type="time" value={f.time} onChange={set('time')} />
            </Field>
            <Field label="Ends (optional)">
              <PickerInput type="time" value={f.endTime} onChange={set('endTime')} />
            </Field>
          </div>
        )}

        {otherDays && type !== 'hotel' && (
          <Field label={editing ? 'Day (change it to move the plan)' : 'Day'}>
            <select className={inputCls} value={targetDay} onChange={e => setTargetDay(e.target.value)}>
              {days.map((d, i) => (
                <option key={d.id} value={d.id}>
                  {dayName(d, i)}
                </option>
              ))}
            </select>
          </Field>
        )}

        {costFields}

        <Field label="Map (optional)">
          <input
            data-search="place"
            className={inputCls}
            value={f.place}
            onChange={set('place')}
            placeholder="Address, place name, or a Maps link"
          />
        </Field>
        {searching && searchIn === 'place' && <PlaceSuggestions trip={trip} text={f.place} onPick={pick} />}
        <p className="-mt-2.5 text-[13px] text-slate-400 dark:text-slate-500">
          {mapHint.kind === 'link'
            ? 'A Maps link opens that exact place.'
            : mapHint.exact
              ? 'The map buttons and directions go to the exact spot you picked.'
              : mapHint.query
                ? `Opens a search for “${mapHint.query}”.`
                : 'Add a name above and the map buttons search for it.'}
        </p>

        <Field label="Notes (optional)">
          <textarea
            className={`${inputCls} min-h-20 resize-y`}
            value={f.notes}
            onChange={set('notes')}
            placeholder={NOTE_HINTS[type] ?? 'Tickets, tips, what to look for…'}
          />
        </Field>

        <div>
          <span className="mb-1.5 block text-[13px] font-medium text-slate-500 dark:text-slate-400">Documents</span>
          <DocumentList docs={docs} onChange={setDocs} onError={toast} />
        </div>

        {editing && (
          <Field label="Status">
            <Segmented
              value={status}
              onChange={setStatus}
              options={[
                { value: 'planned', label: 'Planned', icon: IconCircle },
                { value: 'done', label: 'Done', icon: IconCheckCircle },
                { value: 'skipped', label: 'Skipped', icon: IconXCircle },
              ]}
            />
          </Field>
        )}

        <div className="flex items-center gap-2 pt-1">
          {editing && (
            <button type="button" className={btnDanger} onClick={onDelete}>
              Delete
            </button>
          )}
          <span className="flex-1" />
          <button type="button" className={btnGhost} onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className={btnPrimary}>
            {editing ? 'Save' : 'Add'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
