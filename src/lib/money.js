// Money formatting + cost roll-ups. `currency` is an optional ISO 4217 code
// stored on the trip; unknown codes fall back to "1,234 XYZ".
export function fmtMoney(n, currency) {
  if (!Number.isFinite(n)) return ''
  const digits = n % 1 ? 2 : 0
  if (currency) {
    try {
      return new Intl.NumberFormat(undefined, {
        style: 'currency',
        currency,
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
      }).format(n)
    } catch {
      // not a valid ISO code — fall through to plain number + suffix
    }
  }
  const s = new Intl.NumberFormat(undefined, { maximumFractionDigits: digits }).format(n)
  return currency ? `${s} ${currency}` : s
}

const round2 = n => Math.round(n * 100) / 100

/* A plan's cost may be in another currency than the trip's. `trip.rates`
   holds what one unit of that currency is worth in the trip currency, typed
   in by the user — the app has no exchange-rate service, so it works offline.
   Without a rate the cost cannot be added up, and the budget says so. */
export const costCurrency = (trip, item) => item.currency || trip?.currency || ''

// The cost in the trip currency, 0 for no cost, null when there is no rate.
export function inTripCurrency(trip, item) {
  if (!Number.isFinite(item.cost)) return 0
  const cur = item.currency
  if (!cur || !trip?.currency || cur === trip.currency) return item.cost
  const rate = trip.rates?.[cur]
  return rate > 0 ? item.cost * rate : null
}

// Skipped plans don't count toward the budget.
const counts = item => item.status !== 'skipped' && Number.isFinite(item.cost)

export const dayCost = (trip, day) =>
  round2(day.items.reduce((sum, i) => sum + (counts(i) ? (inTripCurrency(trip, i) ?? 0) : 0), 0))

export const tripCost = trip => round2(trip.days.reduce((sum, d) => sum + dayCost(trip, d), 0))

/* Everything the budget card shows.
     planned      every cost that counts, in the trip currency
     paid         the part marked as paid
     byCategory   [{ type, amount }] largest first
     missingRates currencies used by plans with no rate yet
     split        null, or { share, balances: [{ name, paid, balance }],
                  settlements: [{ from, to, amount }] } once the trip has two
                  or more travellers — costs with a payer are shared equally */
export function budgetSummary(trip) {
  let planned = 0
  let paid = 0
  const byType = new Map()
  const missingRates = new Set()
  const travellers = trip.travellers ?? []
  const paidBy = new Map(travellers.map(n => [n, 0]))
  let shared = 0

  for (const day of trip.days) {
    for (const item of day.items) {
      if (!counts(item)) continue
      const amount = inTripCurrency(trip, item)
      if (amount == null) {
        missingRates.add(item.currency)
        continue
      }
      planned += amount
      if (item.paid) paid += amount
      byType.set(item.type, (byType.get(item.type) ?? 0) + amount)
      if (item.paidBy && paidBy.has(item.paidBy)) {
        paidBy.set(item.paidBy, paidBy.get(item.paidBy) + amount)
        shared += amount
      }
    }
  }

  let split = null
  if (travellers.length >= 2) {
    const share = shared / travellers.length
    const balances = travellers.map(name => ({
      name,
      paid: round2(paidBy.get(name)),
      balance: round2(paidBy.get(name) - share),
    }))
    split = { share: round2(share), balances, settlements: settle(balances) }
  }

  return {
    planned: round2(planned),
    paid: round2(paid),
    budget: trip.budget ?? null,
    byCategory: [...byType]
      .map(([type, amount]) => ({ type, amount: round2(amount) }))
      .sort((a, b) => b.amount - a.amount),
    missingRates: [...missingRates],
    split,
  }
}

// The fewest payments that even everyone out: the biggest debtor pays the
// biggest creditor until one of them is square.
function settle(balances) {
  const owe = balances.filter(b => b.balance < -0.005).map(b => ({ ...b, left: -b.balance }))
  const get = balances.filter(b => b.balance > 0.005).map(b => ({ ...b, left: b.balance }))
  owe.sort((a, b) => b.left - a.left)
  get.sort((a, b) => b.left - a.left)
  const out = []
  let i = 0
  let j = 0
  while (i < owe.length && j < get.length) {
    const amount = Math.min(owe[i].left, get[j].left)
    out.push({ from: owe[i].name, to: get[j].name, amount: round2(amount) })
    owe[i].left -= amount
    get[j].left -= amount
    if (owe[i].left < 0.005) i++
    if (get[j].left < 0.005) j++
  }
  return out
}
