import { useState } from 'react'
import { btnGhost, btnPrimary, Field, inputCls, Modal, PickerInput } from './ui'

export default function DayForm({ day, index, onSave, onClose }) {
  const [date, setDate] = useState(day.date ?? '')
  const [title, setTitle] = useState(day.title ?? '')

  function submit(e) {
    e.preventDefault()
    onSave({ date, title: title.trim() })
  }

  return (
    <Modal title={`Edit day ${index + 1}`} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <Field label="Date">
          <PickerInput value={date} onChange={e => setDate(e.target.value)} />
        </Field>
        <Field label="Label (optional)">
          <input
            className={inputCls}
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="e.g. Rome → Florence"
          />
        </Field>
        <p className="text-[13px] text-slate-400 dark:text-slate-500">Days are kept sorted by date.</p>
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" className={btnGhost} onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className={btnPrimary}>
            Save
          </button>
        </div>
      </form>
    </Modal>
  )
}
