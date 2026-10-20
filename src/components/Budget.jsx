import { useState } from 'react'
import { catById } from '../lib/categories'
import { budgetSummary, fmtMoney } from '../lib/money'
import { useStore } from '../lib/store'
import {
  btnChip,
  btnGhost,
  btnPrimary,
  Collapse,
  CountUp,
  Field,
  IconAlert,
  IconChevronDown,
  IconPencil,
  inputCls,
  Modal,
} from './ui'

/* The trip's money in one card: what is planned against the budget, what is
   paid, where it goes, and — with two or more travellers — who owes whom.
   Plans paid for by one traveller are shared equally between all of them. */

function Bar({ value, max, tone = 'bg-brand-500' }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0
  return (
    <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
      <div className={`bar-fill h-full rounded-full ${tone}`} style={{ '--fill': `${pct}%` }} />
    </div>
  )
}

export default function BudgetCard({ trip }) {
  const { dispatch } = useStore()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState(false)
  const sum = budgetSummary(trip)
  const cur = trip.currency
  const over = sum.budget != null && sum.planned > sum.budget
  const nothing = sum.planned === 0 && sum.budget == null && sum.missingRates.length === 0

  const line = nothing
    ? 'No costs yet'
    : sum.budget != null
      ? `${fmtMoney(sum.planned, cur)} of ${fmtMoney(sum.budget, cur)}${over ? ' — over budget' : ''}`
      : `${fmtMoney(sum.planned, cur)} planned · ${fmtMoney(sum.paid, cur)} paid`

  return (
    <section
      className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800"
      style={{ viewTransitionName: 'budget' }}
    >
      <button
        onClick={() => setOpen(o => !o)}
        className="focus-inset flex w-full items-center gap-3 rounded-2xl px-5 py-3.5 text-left"
        aria-expanded={open}
      >
        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-accent/15 text-lg">💶</span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold">Budget</span>
          <span
            className={`block truncate text-xs ${over ? 'font-semibold text-rose-600 dark:text-rose-400' : 'text-slate-500 dark:text-slate-400'}`}
          >
            {line}
          </span>
        </span>
        {sum.missingRates.length > 0 && <IconAlert className="size-4 shrink-0 text-amber-500" />}
        <IconChevronDown
          className={`size-4.5 shrink-0 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      <Collapse open={open}>
        <div className="space-y-4 border-t border-slate-100 px-5 pb-4 pt-3 text-sm dark:border-slate-800">
          {sum.budget != null && (
            <div className="space-y-1.5">
              <Bar value={sum.planned} max={sum.budget} tone={over ? 'bg-rose-500' : 'bg-brand-500'} />
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {over
                  ? `${fmtMoney(sum.planned - sum.budget, cur)} over`
                  : `${fmtMoney(sum.budget - sum.planned, cur)} left`}
              </p>
            </div>
          )}

          <dl className="grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/50">
              <dt className="text-xs text-slate-500 dark:text-slate-400">Planned</dt>
              <dd className="text-base font-bold tabular-nums">
                <CountUp value={sum.planned} format={v => fmtMoney(v, cur)} />
              </dd>
            </div>
            <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/50">
              <dt className="text-xs text-slate-500 dark:text-slate-400">Paid so far</dt>
              <dd className="text-base font-bold tabular-nums">
                <CountUp value={sum.paid} format={v => fmtMoney(v, cur)} />
              </dd>
            </div>
          </dl>

          {sum.missingRates.length > 0 && (
            <p className="flex items-start gap-2 rounded-xl bg-amber-50 p-3 text-[13px] text-amber-800 dark:bg-amber-400/10 dark:text-amber-300">
              <IconAlert className="mt-0.5 size-4 shrink-0" />
              Costs in {sum.missingRates.join(', ')} are left out until you add an exchange rate.
            </p>
          )}

          {sum.byCategory.length > 0 && (
            <ul className="space-y-2">
              {sum.byCategory.map(({ type, amount }) => {
                const cat = catById(type)
                return (
                  <li key={type} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium">
                        {cat.emoji} {cat.label}
                      </span>
                      <span className="tabular-nums text-slate-500 dark:text-slate-400">{fmtMoney(amount, cur)}</span>
                    </div>
                    <Bar value={amount} max={sum.byCategory[0].amount} />
                  </li>
                )
              })}
            </ul>
          )}

          {sum.split && (
            <div className="space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wide text-slate-400">
                Split · {fmtMoney(sum.split.share, cur)} each
              </h3>
              <ul className="space-y-1">
                {sum.split.balances.map(b => (
                  <li key={b.name} className="flex justify-between text-xs">
                    <span className="font-medium">{b.name}</span>
                    <span className="tabular-nums text-slate-500 dark:text-slate-400">
                      paid {fmtMoney(b.paid, cur)}
                    </span>
                  </li>
                ))}
              </ul>
              {sum.split.settlements.length === 0 ? (
                <p className="text-xs text-slate-500 dark:text-slate-400">Everyone is even.</p>
              ) : (
                <ul className="space-y-1">
                  {sum.split.settlements.map(s => (
                    <li key={`${s.from}-${s.to}`} className="text-xs font-semibold">
                      {s.from} owes {s.to} {fmtMoney(s.amount, cur)}
                    </li>
                  ))}
                </ul>
              )}
              <p className="text-[11px] text-slate-400 dark:text-slate-500">
                Only costs with a “Paid by” are split. Set it in each plan.
              </p>
            </div>
          )}

          <button className={btnChip} onClick={() => setEditing(true)}>
            <IconPencil className="size-3.5" />
            Budget, travellers and rates
          </button>
        </div>
      </Collapse>

      {editing && (
        <BudgetForm
          trip={trip}
          onClose={() => setEditing(false)}
          onSave={patch => {
            dispatch({ type: 'trip/update', id: trip.id, patch })
            setEditing(false)
          }}
        />
      )}
    </section>
  )
}

function BudgetForm({ trip, onSave, onClose }) {
  // Every other currency a plan uses gets a rate field.
  const used = [
    ...new Set(trip.days.flatMap(d => d.items.map(i => i.currency).filter(c => c && c !== trip.currency))),
    ...Object.keys(trip.rates ?? {}),
  ]
  const [budget, setBudget] = useState(trip.budget != null ? String(trip.budget) : '')
  const [travellers, setTravellers] = useState((trip.travellers ?? []).join(', '))
  const [rates, setRates] = useState(() =>
    Object.fromEntries([...new Set(used)].map(c => [c, trip.rates?.[c] != null ? String(trip.rates[c]) : ''])),
  )
  const parse = v => {
    const n = parseFloat(String(v).replace(',', '.'))
    return Number.isFinite(n) && n > 0 ? n : null
  }

  function submit(e) {
    e.preventDefault()
    const b = parse(budget)
    onSave({
      budget: b != null ? Math.round(b * 100) / 100 : undefined,
      travellers: [
        ...new Set(
          travellers
            .split(',')
            .map(t => t.trim())
            .filter(Boolean),
        ),
      ],
      rates: Object.fromEntries(
        Object.entries(rates)
          .map(([c, v]) => [c, parse(v)])
          .filter(([, v]) => v != null),
      ),
    })
  }

  return (
    <Modal title="Budget" onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <Field label={`Budget${trip.currency ? ` (${trip.currency})` : ''}`}>
          <input
            className={inputCls}
            value={budget}
            onChange={e => setBudget(e.target.value)}
            inputMode="decimal"
            placeholder="No limit"
          />
        </Field>
        <Field label="Travellers (comma-separated)">
          <input
            className={inputCls}
            value={travellers}
            onChange={e => setTravellers(e.target.value)}
            placeholder="e.g. Ana, Ben"
          />
        </Field>
        <p className="-mt-2.5 text-[13px] text-slate-400 dark:text-slate-500">
          With two or more, plans get a “Paid by” and the card shows who owes whom.
        </p>

        {Object.keys(rates).length > 0 && (
          <div className="space-y-2">
            <span className="block text-[13px] font-medium text-slate-500 dark:text-slate-400">
              Exchange rates — 1 unit in {trip.currency || 'the trip currency'}
            </span>
            {Object.keys(rates).map(c => (
              <label key={c} className="flex items-center gap-3">
                <span className="w-24 shrink-0 text-sm font-semibold">1 {c} =</span>
                <input
                  className={inputCls}
                  value={rates[c]}
                  onChange={e => setRates(prev => ({ ...prev, [c]: e.target.value }))}
                  inputMode="decimal"
                  placeholder="rate"
                  aria-label={`Rate for ${c}`}
                />
              </label>
            ))}
          </div>
        )}
        {!trip.currency && (
          <p className="text-[13px] text-slate-400 dark:text-slate-500">
            Set the trip currency (Edit trip) to convert costs in other currencies.
          </p>
        )}

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
