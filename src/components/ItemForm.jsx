import { useState } from 'react'
import { CATEGORIES } from '../lib/categories'
import { btnDanger, btnGhost, btnPrimary, Field, inputCls, Modal, Segmented } from './ui'

const NOTE_HINTS = {
  restaurant: 'What to eat, must-try dishes, reservation info…',
  flight: 'Terminal, seat, booking reference…',
  hotel: 'Booking reference, address, breakfast times…',
  museum: 'Exhibitions to see, ticket info…',
}

export default function ItemForm({ initial, dayLabel, onSave, onDelete, onClose }) {
  const editing = Boolean(initial?.id)
  const [type, setType] = useState(initial?.type ?? 'landmark')
  const [f, setF] = useState({
    title: initial?.title ?? '',
    time: initial?.time ?? '',
    mapsUrl: initial?.mapsUrl ?? '',
    notes: initial?.notes ?? '',
    flightNo: initial?.flightNo ?? '',
    direction: initial?.direction ?? 'arrival',
    location: initial?.location ?? '',
    hotelAction: initial?.hotelAction ?? 'check-in',
  })
  const set = k => e => setF(prev => ({ ...prev, [k]: e.target.value }))

  function submit(e) {
    e.preventDefault()
    const item = {
      type,
      title: f.title.trim(),
      time: f.time,
      mapsUrl: f.mapsUrl.trim(),
      notes: f.notes.trim(),
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
                  ? 'bg-sky-50 ring-2 ring-sky-500 dark:bg-sky-500/10'
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
                { value: 'arrival', label: 'Arrival' },
                { value: 'departure', label: 'Departure' },
              ]}
            />
            <div className="grid grid-cols-2 gap-3">
              <Field label="Flight number">
                <input className={inputCls} value={f.flightNo} onChange={set('flightNo')} placeholder="LH 1178" />
              </Field>
              <Field label={f.direction === 'arrival' ? 'Arrival time' : 'Departure time'}>
                <input type="time" className={inputCls} value={f.time} onChange={set('time')} />
              </Field>
            </div>
            <Field label="Airport / location">
              <input className={inputCls} value={f.location} onChange={set('location')} placeholder="Lisbon LIS" />
            </Field>
          </>
        )}

        {type === 'hotel' && (
          <Segmented
            value={f.hotelAction}
            onChange={v => setF(prev => ({ ...prev, hotelAction: v }))}
            options={[
              { value: 'check-in', label: 'Check-in' },
              { value: 'check-out', label: 'Check-out' },
              { value: 'stay', label: 'Stay' },
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
          <Field label="Time (optional)">
            <input type="time" className={inputCls} value={f.time} onChange={set('time')} />
          </Field>
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

        <div className="flex items-center gap-2 pt-1">
          {editing && (
            <button
              type="button"
              className={btnDanger}
              onClick={() => window.confirm('Delete this from the plan?') && onDelete()}
            >
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
