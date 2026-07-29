import { useState } from 'react'
import { uid, useStore } from '../lib/store'
import {
  IconCheckCircle,
  IconChevronDown,
  IconCircle,
  IconPlus,
  IconX,
  iconBtn,
  inputCls,
} from './ui'

export default function PackingList({ trip }) {
  const { dispatch } = useStore()
  const list = trip.packing ?? []
  const packed = list.filter(p => p.done).length
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')

  function addItem(e) {
    e.preventDefault()
    const t = text.trim()
    if (!t) return
    dispatch({ type: 'packing/add', tripId: trip.id, item: { id: uid(), text: t, done: false } })
    setText('')
  }

  return (
    <section className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex w-full items-center gap-3 px-5 py-3.5 text-left"
        aria-expanded={open}
      >
        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-accent/15 text-lg">🎒</span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold">Packing list</span>
          <span className="block text-xs text-slate-500 dark:text-slate-400">
            {list.length === 0 ? 'Nothing on the list yet' : `${packed} of ${list.length} packed`}
          </span>
        </span>
        {list.length > 0 && packed === list.length && <span className="text-sm">✅</span>}
        <IconChevronDown
          className={`size-4.5 shrink-0 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div className="border-t border-slate-100 px-5 pb-4 pt-3 dark:border-slate-800">
          {list.length > 0 && (
            <ul className="mb-3 space-y-0.5">
              {list.map(p => (
                <li key={p.id} className="group flex items-center gap-2.5">
                  <button
                    onClick={() => dispatch({ type: 'packing/toggle', tripId: trip.id, itemId: p.id })}
                    className={`shrink-0 rounded-full p-1 transition ${
                      p.done
                        ? 'text-emerald-500 hover:text-emerald-600'
                        : 'text-slate-300 hover:text-slate-400 dark:text-slate-600 dark:hover:text-slate-500'
                    }`}
                    aria-label={p.done ? `Mark ${p.text} not packed` : `Mark ${p.text} packed`}
                  >
                    {p.done ? <IconCheckCircle className="size-5" /> : <IconCircle className="size-5" />}
                  </button>
                  <span
                    className={`min-w-0 flex-1 truncate py-1 text-sm ${
                      p.done ? 'text-slate-400 line-through dark:text-slate-500' : ''
                    }`}
                  >
                    {p.text}
                  </span>
                  <button
                    onClick={() => dispatch({ type: 'packing/delete', tripId: trip.id, itemId: p.id })}
                    className={`${iconBtn} shrink-0 p-1 opacity-40 group-hover:opacity-100`}
                    aria-label={`Remove ${p.text}`}
                  >
                    <IconX className="size-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <form onSubmit={addItem} className="flex gap-2">
            <input
              className={inputCls}
              value={text}
              onChange={e => setText(e.target.value)}
              placeholder="Add an item — passport, charger, sunscreen…"
              aria-label="New packing item"
            />
            <button
              type="submit"
              className="grid size-11 shrink-0 place-items-center rounded-xl bg-brand text-white transition hover:bg-brand-600 active:scale-[.97] dark:bg-brand-600 dark:hover:bg-brand-500"
              aria-label="Add packing item"
            >
              <IconPlus className="size-5" />
            </button>
          </form>
        </div>
      )}
    </section>
  )
}
