import { useMemo, useState } from 'react'
import { addDaysISO, daysBetween, deviceTimeZone, timeZones } from '../lib/dates'
import { btnGhost, btnPrimary, Field, inputCls, Modal, PickerInput, Segmented } from './ui'

const plural = (n, word) => `${n} ${word}${Math.abs(n) === 1 ? '' : 's'}`

/* onSave(patch, { mode }) — when an edit moves the start date of a trip that
   already has plans, `mode` says whether the plans move with it ('shift') or
   stay on their dates ('keep'). */
export default function TripForm({ initial, onSave, onClose }) {
  const editing = Boolean(initial)
  const [f, setF] = useState({
    name: initial?.name ?? '',
    destination: initial?.destination ?? '',
    startDate: initial?.startDate ?? '',
    endDate: initial?.endDate ?? '',
    currency: initial?.currency ?? '',
    timeZone: initial?.timeZone ?? '',
  })
  const [mode, setMode] = useState('shift')
  const set = k => e => setF(prev => ({ ...prev, [k]: e.target.value }))
  // Moving the start moves the end along, so the trip keeps its length — the
  // way a calendar moves an event.
  const setStart = e => {
    const value = e.target.value
    setF(prev => ({
      ...prev,
      startDate: value,
      endDate:
        value && prev.startDate && prev.endDate
          ? addDaysISO(prev.endDate, daysBetween(prev.startDate, value))
          : prev.endDate,
    }))
  }
  const zones = useMemo(timeZones, [])
  const device = deviceTimeZone()

  const ordered =
    f.startDate && f.endDate && f.endDate < f.startDate ? [f.endDate, f.startDate] : [f.startDate, f.endDate]
  const shift = editing && initial.startDate && ordered[0] ? daysBetween(initial.startDate, ordered[0]) : 0
  const hasPlans = editing && initial.days.some(d => d.date && d.items.length > 0)
  const datesChanged = editing && (ordered[0] !== initial.startDate || ordered[1] !== initial.endDate)

  function submit(e) {
    e.preventDefault()
    const [startDate, endDate] = ordered
    onSave(
      {
        name: f.name.trim(),
        destination: f.destination.trim(),
        startDate,
        endDate,
        currency: f.currency.trim().toUpperCase(),
        timeZone: f.timeZone,
      },
      { mode: shift && hasPlans ? mode : 'shift' },
    )
  }

  return (
    <Modal title={editing ? 'Edit trip' : 'New trip'} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <Field label="Trip name">
          <input
            className={inputCls}
            value={f.name}
            onChange={set('name')}
            placeholder="e.g. Summer in Portugal"
            required
            autoFocus
          />
        </Field>
        <div className="grid grid-cols-[1fr_6.5rem] gap-3">
          <Field label="Destination (optional)">
            <input className={inputCls} value={f.destination} onChange={set('destination')} placeholder="e.g. Lisbon" />
          </Field>
          <Field label="Currency">
            <input
              className={`${inputCls} uppercase`}
              value={f.currency}
              onChange={set('currency')}
              placeholder="EUR"
              maxLength={3}
              autoCapitalize="characters"
            />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Start date">
            <PickerInput value={f.startDate} onChange={setStart} />
          </Field>
          <Field label="End date">
            <PickerInput value={f.endDate} onChange={set('endDate')} min={f.startDate || undefined} />
          </Field>
        </div>

        {datesChanged && hasPlans && shift !== 0 && (
          <div className="space-y-2 rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200 dark:bg-slate-800/50 dark:ring-slate-700">
            <p className="text-[13px] font-medium text-slate-600 dark:text-slate-300">
              The trip starts {plural(Math.abs(shift), 'day')} {shift > 0 ? 'later' : 'earlier'}. What about the plans?
            </p>
            <Segmented
              value={mode}
              onChange={setMode}
              options={[
                { value: 'shift', label: 'Move with the trip' },
                { value: 'keep', label: 'Keep their dates' },
              ]}
            />
          </div>
        )}
        {datesChanged && (
          <p className="text-[13px] text-slate-400 dark:text-slate-500">
            New dates get a day each. Empty days outside the dates are removed; days with plans are kept.
          </p>
        )}
        {!editing && (
          <p className="text-[13px] text-slate-400 dark:text-slate-500">
            Pick both dates and the days get created for you — you can always add or remove days later.
          </p>
        )}

        <Field label="Time zone">
          <select className={inputCls} value={f.timeZone} onChange={set('timeZone')}>
            <option value="">This device’s time{device ? ` (${device.replaceAll('_', ' ')})` : ''}</option>
            {zones.map(z => (
              <option key={z} value={z}>
                {z.replaceAll('_', ' ')}
              </option>
            ))}
          </select>
        </Field>
        <p className="-mt-2.5 text-[13px] text-slate-400 dark:text-slate-500">
          Trip mode tells “now” by the clock here, even when your phone is still on home time.
        </p>

        <div className="flex justify-end gap-2 pt-1">
          <button type="button" className={btnGhost} onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className={btnPrimary}>
            {editing ? 'Save' : 'Create trip'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
