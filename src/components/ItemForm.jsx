import { useState } from 'react'
import { airlineFromFlightNo } from '../lib/airlines'
import { CATEGORIES } from '../lib/categories'
import AirlineLogo from './AirlineLogo'
import {
  btnDanger,
  btnGhost,
  btnPrimary,
  Field,
  IconCheckCircle,
  IconCircle,
  IconLogIn,
  IconLogOut,
  IconPlaneLanding,
  IconPlaneTakeoff,
  IconXCircle,
  inputCls,
  Modal,
  PickerInput,
  Segmented,
} from './ui'

const NOTE_HINTS = {
  restaurant: 'What to eat, must-try dishes, reservation info…',
  flight: 'Terminal, seat, booking reference…',
  hotel: 'Booking reference, address, breakfast times…',
  museum: 'Exhibitions to see, ticket info…',
  work: 'Meetings, calls, focus blocks…',
}

export default function ItemForm({ initial, dayLabel, currency, onSave, onDelete, onClose }) {
  const editing = Boolean(initial?.id)
  const [type, setType] = useState(initial?.type ?? 'landmark')
  const [status, setStatus] = useState(initial?.status ?? 'planned')
  const [f, setF] = useState({
    title: initial?.title ?? '',
    time: initial?.time ?? '',
    cost: initial?.cost != null ? String(initial.cost) : '',
    mapsUrl: initial?.mapsUrl ?? '',
    notes: initial?.notes ?? '',
    flightNo: initial?.flightNo ?? '',
    direction: initial?.direction ?? 'arrival',
    location: initial?.location ?? '',
    hotelAction: initial?.hotelAction === 'check-out' ? 'check-out' : 'check-in',
  })
  const set = k => e => setF(prev => ({ ...prev, [k]: e.target.value }))

  function submit(e) {
    e.preventDefault()
    const cost = parseFloat(f.cost.replace(',', '.'))
    const item = {
      type,
      title: f.title.trim(),
      time: f.time,
      cost: Number.isFinite(cost) && cost > 0 ? Math.round(cost * 100) / 100 : undefined,
      mapsUrl: f.mapsUrl.trim(),
      notes: f.notes.trim(),
      status: status === 'planned' ? undefined : status,
    }
    if (type === 'flight') {
      item.flightNo = f.flightNo.trim()
      item.direction = f.direction
      item.location = f.location.trim()
    }
    if (type === 'hotel') item.hotelAction = f.hotelAction
    onSave(item)
  }

  const titleLabel =
    type === 'flight' ? 'Label (optional)' : type === 'hotel' ? 'Hotel name' : 'Name'
  const titlePlaceholder =
    type === 'flight' ? 'e.g. Berlin → Lisbon' : type === 'hotel' ? 'e.g. Hotel Alfama' : 'e.g. Louvre Museum'
  const airline = type === 'flight' ? airlineFromFlightNo(f.flightNo) : null
  const costLabel = currency ? `Cost (${currency})` : 'Cost (optional)'
  const costInput = (
    <input
      className={inputCls}
      value={f.cost}
      onChange={set('cost')}
      placeholder="0"
      inputMode="decimal"
      pattern="[0-9]*[.,]?[0-9]*"
    />
  )

  return (
    <Modal title={editing ? 'Edit plan' : `Add to ${dayLabel}`} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-5">
          {CATEGORIES.map(c => (
            <button
              type="button"
              key={c.id}
              onClick={() => setType(c.id)}
              className={`flex flex-col items-center gap-1 rounded-xl px-1 py-2 text-center transition ${
                type === c.id
                  ? 'bg-brand-50 ring-2 ring-brand-500 dark:bg-brand-500/10'
                  : 'ring-1 ring-slate-200 hover:bg-slate-50 dark:ring-slate-700 dark:hover:bg-slate-800'
              }`}
            >
              <span className="text-xl leading-none">{c.emoji}</span>
              <span className="text-[11px] font-medium text-slate-600 dark:text-slate-300">{c.label}</span>
            </button>
          ))}
        </div>

        {type === 'flight' && (
          <>
            <Segmented
              value={f.direction}
              onChange={v => setF(prev => ({ ...prev, direction: v }))}
              options={[
                { value: 'arrival', label: 'Arrival', icon: IconPlaneLanding },
                { value: 'departure', label: 'Departure', icon: IconPlaneTakeoff },
              ]}
            />
            <div className="grid grid-cols-2 gap-3">
              <Field label="Flight number">
                <input className={inputCls} value={f.flightNo} onChange={set('flightNo')} placeholder="LH 1178" />
              </Field>
              <Field label={f.direction === 'arrival' ? 'Arrival time' : 'Departure time'}>
                <PickerInput type="time" value={f.time} onChange={set('time')} />
              </Field>
            </div>
            {airline && (
              <div className="flex items-center gap-2 text-[13px] font-medium text-slate-500 dark:text-slate-400">
                <AirlineLogo
                  iata={airline.iata}
                  name={airline.name}
                  className="size-6 rounded-md"
                  fallback={<span className="text-base leading-none">✈️</span>}
                />
                {airline.name}
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <Field label="Airport / location">
                <input className={inputCls} value={f.location} onChange={set('location')} placeholder="Lisbon LIS" />
              </Field>
              <Field label={costLabel}>{costInput}</Field>
            </div>
          </>
        )}

        {type === 'hotel' && (
          <Segmented
            value={f.hotelAction}
            onChange={v => setF(prev => ({ ...prev, hotelAction: v }))}
            options={[
              { value: 'check-in', label: 'Check-in', icon: IconLogIn },
              { value: 'check-out', label: 'Check-out', icon: IconLogOut },
            ]}
          />
        )}

        <Field label={titleLabel}>
          <input
            className={inputCls}
            value={f.title}
            onChange={set('title')}
            placeholder={titlePlaceholder}
            required={type !== 'flight'}
            autoFocus={editing ? undefined : type !== 'flight'}
          />
        </Field>

        {type !== 'flight' && (
          <div className="grid grid-cols-2 gap-3">
            <Field label="Time (optional)">
              <PickerInput type="time" value={f.time} onChange={set('time')} />
            </Field>
            <Field label={costLabel}>{costInput}</Field>
          </div>
        )}

        <Field label="Maps link (optional)">
          <input
            type="url"
            className={inputCls}
            value={f.mapsUrl}
            onChange={set('mapsUrl')}
            placeholder="Paste a Google / Apple Maps link"
          />
        </Field>

        <Field label="Notes (optional)">
          <textarea
            className={`${inputCls} min-h-20 resize-y`}
            value={f.notes}
            onChange={set('notes')}
            placeholder={NOTE_HINTS[type] ?? 'Tickets, tips, what to look for…'}
          />
        </Field>

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
