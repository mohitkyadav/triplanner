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

// Skipped plans don't count toward the budget.
export const dayCost = day =>
  day.items.reduce((sum, i) => sum + (i.status !== 'skipped' && Number.isFinite(i.cost) ? i.cost : 0), 0)

export const tripCost = trip => trip.days.reduce((sum, d) => sum + dayCost(d), 0)
