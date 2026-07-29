const pad = n => String(n).padStart(2, '0')

const parse = iso => {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function todayISO() {
  const d = new Date()
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function addDaysISO(iso, n) {
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(y, m - 1, d + n)
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`
}

export function daysBetween(a, b) {
  return Math.round((parse(b) - parse(a)) / 864e5)
}

export function fmtDate(iso, opts = { weekday: 'short', month: 'short', day: 'numeric' }) {
  return iso ? parse(iso).toLocaleDateString(undefined, opts) : ''
}

// "3 days ago", "just now" — for backup times.
export function fmtAgo(iso) {
  const ms = Date.now() - new Date(iso ?? '').getTime()
  if (!Number.isFinite(ms)) return ''
  const minutes = Math.round(ms / 60000)
  if (minutes < 1) return 'just now'
  const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' })
  if (minutes < 60) return rtf.format(-minutes, 'minute')
  const hours = Math.round(minutes / 60)
  if (hours < 24) return rtf.format(-hours, 'hour')
  const days = Math.round(hours / 24)
  if (days < 31) return rtf.format(-days, 'day')
  return rtf.format(-Math.round(days / 30), 'month')
}

export const daysSince = iso => {
  const ms = Date.now() - new Date(iso ?? '').getTime()
  return Number.isFinite(ms) ? Math.floor(ms / 864e5) : null
}

export function fmtRange(a, b) {
  if (!a && !b) return ''
  if (a && b)
    return `${fmtDate(a, { month: 'short', day: 'numeric' })} – ${fmtDate(b, { month: 'short', day: 'numeric', year: 'numeric' })}`
  return fmtDate(a || b, { month: 'short', day: 'numeric', year: 'numeric' })
}
