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

export function fmtRange(a, b) {
  if (!a && !b) return ''
  if (a && b)
    return `${fmtDate(a, { month: 'short', day: 'numeric' })} – ${fmtDate(b, { month: 'short', day: 'numeric', year: 'numeric' })}`
  return fmtDate(a || b, { month: 'short', day: 'numeric', year: 'numeric' })
}
