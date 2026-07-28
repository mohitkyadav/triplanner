import { useState } from 'react'
import { btnGhost, btnPrimary, Field, inputCls, Modal } from './ui'

export default function TripForm({ initial, onSave, onClose }) {
  const editing = Boolean(initial)
  const [f, setF] = useState({
    name: initial?.name ?? '',
    destination: initial?.destination ?? '',
    startDate: initial?.startDate ?? '',
    endDate: initial?.endDate ?? '',
  })
  const set = k => e => setF(prev => ({ ...prev, [k]: e.target.value }))

  function submit(e) {
    e.preventDefault()
    let { startDate, endDate } = f
    if (startDate && endDate && endDate < startDate) [startDate, endDate] = [endDate, startDate]
    onSave({ name: f.name.trim(), destination: f.destination.trim(), startDate, endDate })
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
        <Field label="Destination (optional)">
          <input className={inputCls} value={f.destination} onChange={set('destination')} placeholder="e.g. Lisbon" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Start date">
            <input type="date" className={inputCls} value={f.startDate} onChange={set('startDate')} />
          </Field>
          <Field label="End date">
            <input type="date" className={inputCls} value={f.endDate} onChange={set('endDate')} min={f.startDate || undefined} />
          </Field>
        </div>
        {!editing && (
          <p className="text-[13px] text-slate-400 dark:text-slate-500">
            Pick both dates and the days get created for you — you can always add or remove days later.
          </p>
        )}
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
